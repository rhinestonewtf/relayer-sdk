import type { Hex } from 'viem'
import { InvalidAttributionSuffixError } from './errors'

/**
 * ERC-8021 transaction attribution.
 *
 * Attribution is a suffix appended to the END of a transaction's calldata. It is
 * inert on-chain: contracts decode their arguments and ignore the trailing bytes,
 * so nothing about the transaction's behaviour changes. Indexers read it back off
 * `tx.input` afterwards to attribute the activity to an app.
 *
 * Every suffix ends with a constant 16-byte marker preceded by a one-byte schema
 * id, and is designed to be parsed BACKWARDS from the end of calldata:
 *
 *   schema 0  codes ∥ codesLength(1) ∥ schemaId(1) ∥ marker(16)
 *   schema 1  registry(20) ∥ chainId ∥ chainIdLength(1) ∥ codes ∥ codesLength(1) ∥ schemaId(1) ∥ marker(16)
 *   schema 2  cborData ∥ cborLength(2) ∥ schemaId(1) ∥ marker(16)
 *
 * Note the length byte comes AFTER the data it describes — that is what makes a
 * backwards walk possible. `codes` is a comma-separated ASCII list, so a single
 * Base builder code "baseapp" yields the 25-byte schema-0 suffix
 * `0x62617365617070070080218021802180218021802180218021`.
 *
 * Relayers do NOT need to construct or parse any of this. The orchestrator
 * publishes a ready-made blob on `RelayerActionV1.metadata.attributionSuffix`,
 * and a relayer's whole job is to append it with {@link applyAttribution} as the
 * LAST step before signing.
 */

/** The constant 16-byte ERC-8021 end marker: `0x8021` x 8. */
export const ERC8021_MARKER =
  '0x80218021802180218021802180218021' as const satisfies Hex

/** Canonical-registry schema — what Base builder codes use. */
export const ATTRIBUTION_SCHEMA_CANONICAL_REGISTRY = 0
/** Custom-registry schema. */
export const ATTRIBUTION_SCHEMA_CUSTOM_REGISTRY = 1
/** CBOR-encoded schema, for arbitrary annotation. */
export const ATTRIBUTION_SCHEMA_CBOR = 2

const MARKER_BYTES = 16
const SCHEMA_ID_BYTES = 1
const REGISTRY_ADDRESS_BYTES = 20
/** Shortest valid suffix: zero-length codes + codesLength + schemaId + marker. */
const MIN_SUFFIX_BYTES = MARKER_BYTES + SCHEMA_ID_BYTES + 1

const body = (value: Hex): string => value.slice(2).toLowerCase()
const byteLength = (value: Hex): number => body(value).length / 2
const MARKER_BODY = body(ERC8021_MARKER)

/** Reads `count` bytes ending at `end` (both in bytes from the start) as a number. */
function readUint(hex: string, end: number, count: number): number {
  return Number.parseInt(hex.slice((end - count) * 2, end * 2), 16)
}

/**
 * Builds a schema-0 attribution suffix for one or more attribution codes — e.g. a
 * Base builder code.
 *
 * @param codes - The code(s) as registered, e.g. `"baseapp"`. Multiple codes are
 *   joined with commas per the standard. ASCII only; the joined form must be
 *   0-255 bytes.
 *
 * @example
 * ```ts
 * encodeAttributionSuffix('baseapp')
 * // '0x62617365617070070080218021802180218021802180218021'
 * ```
 */
export function encodeAttributionSuffix(codes: string | string[]): Hex {
  const joined = Array.isArray(codes) ? codes.join(',') : codes
  const bytes = new TextEncoder().encode(joined)
  if (bytes.length > 255) {
    throw new InvalidAttributionSuffixError({
      reason: `attribution codes must be at most 255 bytes, got ${bytes.length}`,
    })
  }
  if (joined.includes('\0')) {
    throw new InvalidAttributionSuffixError({
      reason: 'attribution codes must not contain NUL',
    })
  }
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  const codesHex = Array.from(bytes, hex).join('')
  return `0x${codesHex}${hex(bytes.length)}${hex(
    ATTRIBUTION_SCHEMA_CANONICAL_REGISTRY,
  )}${MARKER_BODY}` as Hex
}

/**
 * Whether calldata already carries an ERC-8021 attribution suffix.
 *
 * Detection is by the trailing marker, exactly as an indexer would parse it. A
 * false positive is possible in principle — real ABI calldata could happen to end
 * in those 16 bytes — but the marker exists to make that vanishingly unlikely,
 * and the only consequence here is that we decline to append a second suffix.
 */
export function hasAttribution(data: Hex): boolean {
  const hex = body(data)
  return hex.length >= MIN_SUFFIX_BYTES * 2 && hex.endsWith(MARKER_BODY)
}

/** The schema id of a suffix, read from the byte preceding the marker. */
function schemaIdOf(hex: string): number {
  return readUint(hex, hex.length / 2 - MARKER_BYTES, SCHEMA_ID_BYTES)
}

/**
 * Schema 1's `chainIdLength`, i.e. how many bytes of chain id precede it.
 * `undefined` if the suffix is too short to carry one.
 */
function schema1ChainIdLength(hex: string): number | undefined {
  const total = hex.length / 2
  const codesLengthEnd = total - (MARKER_BYTES + SCHEMA_ID_BYTES)
  if (codesLengthEnd < 1) return undefined
  const codesLength = readUint(hex, codesLengthEnd, 1)
  const chainIdLengthEnd = codesLengthEnd - 1 - codesLength
  if (chainIdLengthEnd < 1) return undefined
  return readUint(hex, chainIdLengthEnd, 1)
}

/**
 * Total suffix size in bytes, walked backwards from the end of `hex`, or
 * `undefined` if the schema is one we cannot measure (a schema added after this
 * version) or the encoding is inconsistent.
 *
 * Pure measurement — it answers "where does the suffix begin", not "is this
 * suffix meaningful". Semantic checks belong in `assertValidAttributionSuffix`:
 * `splitAttribution` must be able to measure anything it might be handed, since
 * mis-measuring corrupts real calldata, which is far worse than reattaching a
 * degenerate suffix unchanged.
 */
function suffixSize(hex: string): number | undefined {
  const total = hex.length / 2
  const schemaIdEnd = total - MARKER_BYTES
  const schemaId = readUint(hex, schemaIdEnd, SCHEMA_ID_BYTES)
  const fixedTail = MARKER_BYTES + SCHEMA_ID_BYTES

  if (schemaId === ATTRIBUTION_SCHEMA_CBOR) {
    const cborLengthEnd = schemaIdEnd - SCHEMA_ID_BYTES
    if (cborLengthEnd < 2) return undefined
    return fixedTail + 2 + readUint(hex, cborLengthEnd, 2)
  }

  if (
    schemaId !== ATTRIBUTION_SCHEMA_CANONICAL_REGISTRY &&
    schemaId !== ATTRIBUTION_SCHEMA_CUSTOM_REGISTRY
  ) {
    return undefined
  }

  const codesLengthEnd = schemaIdEnd - SCHEMA_ID_BYTES
  if (codesLengthEnd < 1) return undefined
  const codesLength = readUint(hex, codesLengthEnd, 1)
  const withCodes = fixedTail + 1 + codesLength

  if (schemaId === ATTRIBUTION_SCHEMA_CANONICAL_REGISTRY) return withCodes

  // Schema 1 additionally carries the registry it resolves codes against.
  const chainIdLengthEnd = total - withCodes
  if (chainIdLengthEnd < 1) return undefined
  const chainIdLength = readUint(hex, chainIdLengthEnd, 1)
  return withCodes + 1 + chainIdLength + REGISTRY_ADDRESS_BYTES
}

/**
 * Splits calldata into its payload and its attribution suffix, if any.
 *
 * Use this before any transform that decodes and re-encodes calldata — an ABI
 * round-trip DROPS trailing bytes silently, so a suffix attached earlier would be
 * lost with no error. Rewrite `payload`, then reattach with {@link applyAttribution}.
 *
 * Conservative by design: if the suffix cannot be measured unambiguously (an
 * unrecognised schema, or a length prefix that overruns the calldata), this
 * reports no suffix rather than guessing a boundary. Guessing wrong would slice
 * bytes off the real calldata, which turns an attribution problem into a broken
 * transaction.
 *
 * @returns `suffix` is `undefined` when the calldata carries no measurable attribution.
 */
export function splitAttribution(data: Hex): {
  payload: Hex
  suffix: Hex | undefined
} {
  const none = { payload: data, suffix: undefined }
  if (!hasAttribution(data)) return none

  const hex = body(data)
  const size = suffixSize(hex)
  if (size === undefined) return none

  const cut = hex.length - size * 2
  // Only guard against cutting past the start of the calldata. An earlier
  // version also required a 4-byte selector to survive, which broke the property
  // that matters most here: split(apply(x)) === x. Attribution is legal on any
  // calldata, including a bare value transfer with an empty payload, and a
  // splitter that cannot round-trip its own output silently drops attribution
  // for those. The selector guard bought almost nothing against a false-positive
  // marker match either — a 16-byte marker collision is ~2^-128, and it only
  // helped in the sliver of cases where the bogus suffix nearly spanned the
  // whole calldata.
  if (cut < 0) return none

  return {
    payload: `0x${hex.slice(0, cut)}` as Hex,
    suffix: `0x${hex.slice(cut)}` as Hex,
  }
}

/**
 * Appends an ERC-8021 attribution suffix to transaction calldata.
 *
 * MUST be the last transform applied before signing. Anything that decodes and
 * re-encodes the calldata afterwards will drop the suffix silently.
 * {@link replaceRepaymentDestinations} in this package is suffix-preserving, so
 * the two compose in either order; a rewrite of your own is not.
 *
 * No-ops when `suffix` is undefined or empty, and refuses to append a second
 * suffix when one is already present — two markers would make the outer one
 * authoritative and misattribute the transaction.
 *
 * @param data - The finished calldata.
 * @param suffix - Typically `RelayerActionV1.metadata.attributionSuffix`.
 * @throws {InvalidAttributionSuffixError} if `suffix` is malformed. Failing the
 *   action is better than broadcasting calldata with garbage appended.
 *
 * @example
 * ```ts
 * const data = applyAttribution(finalCalldata, action.metadata.attributionSuffix)
 * await signAndSend({ to, value, data })
 * ```
 */
export function applyAttribution(data: Hex, suffix: Hex | undefined): Hex {
  if (!suffix || suffix === '0x') return data
  assertValidAttributionSuffix(suffix)
  if (hasAttribution(data)) return data
  return `0x${body(data)}${body(suffix)}` as Hex
}

/**
 * Extra intrinsic gas a suffix costs on the transaction that carries it:
 * EIP-2028's 16 gas per non-zero calldata byte, 4 per zero byte. Roughly 400 gas
 * for a typical builder code.
 *
 * Add this to a gas limit that was estimated on the UNSUFFIXED calldata — which
 * is the normal case, because attribution is applied after estimation. A
 * percentage buffer usually absorbs it, but relying on that couples a correctness
 * property to a tuning constant. Execution gas is unaffected: the suffix is never
 * read by any contract.
 *
 * Excludes the L2 data fee on rollups, which is priced per chain.
 */
export function attributionGasOverhead(suffix: Hex | undefined): bigint {
  if (!suffix || suffix === '0x') return 0n
  const hex = body(suffix)
  let gas = 0n
  for (let i = 0; i < hex.length; i += 2) {
    gas += hex.slice(i, i + 2) === '00' ? 4n : 16n
  }
  return gas
}

/**
 * Validates that a suffix is well-formed ERC-8021 before it is appended to
 * calldata we are about to sign.
 *
 * @throws {InvalidAttributionSuffixError}
 */
export function assertValidAttributionSuffix(suffix: Hex): void {
  const reject = (reason: string): never => {
    throw new InvalidAttributionSuffixError({ reason, suffix })
  }

  if (!/^0x[0-9a-fA-F]*$/.test(suffix)) reject('not a hex string')
  if (body(suffix).length % 2 !== 0) reject('odd number of hex digits')

  const size = byteLength(suffix)
  if (size < MIN_SUFFIX_BYTES) {
    reject(`too short: ${size} bytes, minimum ${MIN_SUFFIX_BYTES}`)
  }
  if (!body(suffix).endsWith(MARKER_BODY)) {
    reject('does not end with the ERC-8021 marker')
  }

  // The suffix must be self-consistent: its own internal length prefixes have to
  // describe exactly its own size. A suffix that measures shorter or longer than
  // it is would make any downstream split cut in the wrong place — into the real
  // calldata, or leaving stray bytes behind.
  const measured = suffixSize(body(suffix))
  if (measured === undefined) {
    reject('unrecognised or unmeasurable attribution schema')
  }
  if (measured !== size) {
    reject(
      `length prefix describes ${measured} bytes but the suffix is ${size}`,
    )
  }

  // Schema 1 resolves its codes against a registry identified by (address,
  // chainId). A zero-length chain id names no chain, so the registry cannot be
  // resolved and external parsers reject it — the suffix would ride on-chain and
  // attribute nothing. Structurally measurable but semantically useless, so it
  // is caught here rather than in suffixSize, which must stay pure measurement.
  if (schemaIdOf(body(suffix)) === ATTRIBUTION_SCHEMA_CUSTOM_REGISTRY) {
    if (schema1ChainIdLength(body(suffix)) === 0) {
      reject('schema 1 requires a non-empty registry chain id')
    }
  }
}
