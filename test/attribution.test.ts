import { describe, expect, it } from 'vitest'
import {
  applyAttribution,
  assertValidAttributionSuffix,
  attributionGasOverhead,
  ERC8021_MARKER,
  encodeAttributionSuffix,
  hasAttribution,
  splitAttribution,
} from '../src/attribution'
import { InvalidAttributionSuffixError } from '../src/errors'

// Vectors below are taken verbatim from ox's ERC-8021 conformance tests
// (wevm/ox, src/erc8021/_test/Attribution.test.ts) so that our encoding is
// pinned to a working third-party implementation rather than to our own reading
// of the spec. Note the length byte follows the data it describes — that is what
// makes the suffix parseable backwards from the end of calldata.
const BASEAPP = '0x62617365617070070080218021802180218021802180218021'
const TWO_CODES =
  '0x626173656170702c6d6f7270686f0e0080218021802180218021802180218021'
const NO_CODES = '0x000080218021802180218021802180218021'
// schema 1: registry(20) ∥ chainId(2) ∥ chainIdLength(1) ∥ codes(14) ∥ len ∥ id ∥ marker
const SCHEMA_1_SUFFIX =
  '0xcccccccccccccccccccccccccccccccccccccccc210502626173656170702c6d6f7270686f0e0180218021802180218021802180218021'
// schema 2: cborData(11) ∥ cborLength(2) ∥ schemaId(1) ∥ marker
const SCHEMA_2_SUFFIX =
  '0xa161616762617365617070000b0280218021802180218021802180218021'

describe('encodeAttributionSuffix', () => {
  it("matches ox's canonical schema-0 vector for a single code", () => {
    expect(encodeAttributionSuffix('baseapp')).toBe(BASEAPP)
  })

  it("matches ox's vector for multiple codes", () => {
    expect(encodeAttributionSuffix(['baseapp', 'morpho'])).toBe(TWO_CODES)
    expect(encodeAttributionSuffix('baseapp,morpho')).toBe(TWO_CODES)
  })

  it("matches ox's vector for no codes", () => {
    expect(encodeAttributionSuffix('')).toBe(NO_CODES)
  })

  it('is 25 bytes for a 7-character code', () => {
    expect((encodeAttributionSuffix('baseapp').length - 2) / 2).toBe(25)
  })

  it('rejects codes longer than the one-byte length prefix can describe', () => {
    expect(() => encodeAttributionSuffix('a'.repeat(256))).toThrow(
      InvalidAttributionSuffixError,
    )
  })
})

describe('applyAttribution', () => {
  const data =
    '0xdeadbeef00000000000000000000000000000000000000000000000000000001'

  it('appends the suffix to the end of the calldata', () => {
    expect(applyAttribution(data, BASEAPP)).toBe(`${data}${BASEAPP.slice(2)}`)
  })

  it('leaves the original calldata byte-for-byte intact', () => {
    expect(applyAttribution(data, BASEAPP).startsWith(data)).toBe(true)
  })

  it('is a no-op when no suffix is configured', () => {
    expect(applyAttribution(data, undefined)).toBe(data)
    expect(applyAttribution(data, '0x')).toBe(data)
  })

  it('refuses to append a second suffix', () => {
    // Two markers would make the outer one authoritative and silently
    // misattribute the transaction to whoever appended last.
    const once = applyAttribution(data, BASEAPP)
    expect(applyAttribution(once, BASEAPP)).toBe(once)
  })

  it('throws rather than appending a malformed suffix', () => {
    expect(() => applyAttribution(data, '0xdeadbeef')).toThrow(
      InvalidAttributionSuffixError,
    )
  })
})

describe('hasAttribution', () => {
  it('is false for ordinary calldata', () => {
    expect(hasAttribution('0xdeadbeef')).toBe(false)
  })

  it('is true once a suffix has been applied', () => {
    expect(hasAttribution(applyAttribution('0xdeadbeef', BASEAPP))).toBe(true)
  })

  it('is false for calldata shorter than the minimum suffix', () => {
    expect(hasAttribution(ERC8021_MARKER)).toBe(false)
  })
})

describe('splitAttribution', () => {
  const payload = '0xdeadbeefcafebabe'

  it.each([
    ['schema 0', BASEAPP],
    ['schema 0, multiple codes', TWO_CODES],
    ['schema 0, no codes', NO_CODES],
    ['schema 1', SCHEMA_1_SUFFIX],
    ['schema 2', SCHEMA_2_SUFFIX],
  ])('round-trips %s: split(apply(x)) === x', (_name, suffix) => {
    expect(splitAttribution(applyAttribution(payload, suffix))).toEqual({
      payload,
      suffix,
    })
  })

  it('returns unattributed calldata untouched', () => {
    expect(splitAttribution('0xdeadbeef')).toEqual({
      payload: '0xdeadbeef',
      suffix: undefined,
    })
  })

  it('does not split a schema it cannot measure', () => {
    // A future schema id we have no length rule for. Reporting "no suffix" loses
    // attribution; guessing a boundary would corrupt the calldata.
    const unknown = `0xdeadbeef0009${ERC8021_MARKER.slice(2)}` as const
    expect(splitAttribution(unknown).suffix).toBeUndefined()
  })

  it('refuses to cut into the 4-byte selector', () => {
    // codesLength claims 0xff bytes of codes, far more than the calldata holds.
    const overlong = `0xdeadbeefff0080218021802180218021802180218021` as const
    expect(splitAttribution(overlong).payload).toBe(overlong)
  })
})

describe('assertValidAttributionSuffix', () => {
  it.each([
    ['schema 0', BASEAPP],
    ['schema 1', SCHEMA_1_SUFFIX],
    ['schema 2', SCHEMA_2_SUFFIX],
  ])('accepts a well-formed %s suffix', (_name, suffix) => {
    expect(() => assertValidAttributionSuffix(suffix)).not.toThrow()
  })

  it('rejects a suffix without the marker', () => {
    expect(() =>
      assertValidAttributionSuffix(
        '0x62617365617070070000000000000000000000000000000000',
      ),
    ).toThrow(/marker/)
  })

  it('rejects a suffix that is too short', () => {
    expect(() => assertValidAttributionSuffix('0x8021')).toThrow(/too short/)
  })

  it('rejects a non-hex suffix', () => {
    expect(() => assertValidAttributionSuffix('0xzz' as never)).toThrow(/hex/)
  })

  it('rejects a length prefix that disagrees with the suffix size', () => {
    // Claims 3 bytes of codes but carries 7. Splitting this downstream would cut
    // four bytes off the end of the real calldata.
    const lying =
      '0x62617365617070030080218021802180218021802180218021' as const
    expect(() => assertValidAttributionSuffix(lying)).toThrow(/length prefix/)
  })

  it('rejects a schema-1 suffix with a zero-length registry chain id', () => {
    // Structurally measurable, but it names no chain, so the registry cannot be
    // resolved and external parsers reject it. Approving it would let a suffix
    // ride on-chain and attribute nothing — the exact failure this validator
    // exists to prevent.
    // registry(20) | chainId(0 bytes) | chainIdLength(0x00) | codes(14) |
    // codesLength(0x0e) | schemaId(0x01) | marker.
    const noChainId =
      '0xcccccccccccccccccccccccccccccccccccccccc00626173656170702c6d6f7270686f0e0180218021802180218021802180218021'

    expect(() => assertValidAttributionSuffix(noChainId)).toThrow(/chain id/)
  })

  it('still accepts a schema-1 suffix that carries a chain id', () => {
    expect(() => assertValidAttributionSuffix(SCHEMA_1_SUFFIX)).not.toThrow()
  })

  it('rejects an unrecognised schema', () => {
    const unknown = `0x0009${ERC8021_MARKER.slice(2)}` as const
    expect(() => assertValidAttributionSuffix(unknown)).toThrow(/unrecognised/)
  })
})

describe('attributionGasOverhead', () => {
  it('charges 16 gas per non-zero byte and 4 per zero byte', () => {
    // BASEAPP is 25 bytes, of which two ("codesLength" is 0x07, "schemaId" 0x00)
    // — only the schemaId byte is zero.
    expect(attributionGasOverhead(BASEAPP)).toBe(24n * 16n + 1n * 4n)
  })

  it('is zero when there is nothing to append', () => {
    expect(attributionGasOverhead(undefined)).toBe(0n)
    expect(attributionGasOverhead('0x')).toBe(0n)
  })

  it('stays in the low hundreds for a realistic code', () => {
    // Sanity bound: if this ever grows into the thousands, the assumption that a
    // percentage gas buffer absorbs attribution no longer holds.
    expect(attributionGasOverhead(BASEAPP)).toBeLessThan(1000n)
  })
})
