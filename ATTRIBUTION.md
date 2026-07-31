# ERC-8021 attribution for relayers

Integration note for anyone filling Rhinestone intents — our own relayer and
third-party relayers alike.

## What we're asking for

Some clients want their on-chain activity attributed to them under
[ERC-8021](https://eip.tools/eip/8021) (Base calls these *builder codes*). We
cannot do this for them, because we never sign a transaction: **the relayer that
fills the intent is the only party that can attribute it.**

The change on your side is one line.

## What it is

Attribution is a short suffix appended to the **end of transaction calldata**.
Contracts decode their arguments and ignore trailing bytes, so the transaction
behaves identically — indexers read the suffix back off `tx.input` afterwards.

We verified this is inert against **real replayed Base mainnet transactions**,
covering every calldata shape our fills and claims take: the Router's
`optimized_routeFill921336808`, the RelayerPot's `relayETH7172445` /
`relayERC202076776083` (which forward raw calldata by `calldatasize()`), the pot
multicall, `routeClaim`, direct IntentExecutor fills, and third-party relayer
entry contracts. In every case success, return data and emitted logs were
byte-identical with and without the suffix.

It cannot invalidate any signature: the atomic-fill signature is taken over the
adapter contexts, and the user's intent signature is EIP-712 over the order —
neither covers `msg.data`.

## What changes

`RelayerActionV1.metadata` gains one optional field:

```jsonc
{
  "type": "RelayerActionV1",
  "metadata": {
    "userAddress": "0x…",
    "sponsorFee": 0.42,
    "attributionSuffix": "0x7a79666169050080218021802180218021802180218021"
  }
}
```

It carries a **ready-made blob**, not a code — appending it is a byte
concatenation, so you need no ERC-8021 encoding logic and cannot get the layout
subtly wrong. It is absent on the large majority of actions.

**Ignoring the field is safe.** You produce a valid transaction; it is simply
unattributed. Nothing breaks, no action fails, and you can adopt whenever suits.

## How to implement it

```ts
import { applyAttribution, attributionGasOverhead } from '@rhinestone/relayer-sdk'

const data = applyAttribution(finalCalldata, action.metadata.attributionSuffix)
const gasLimit = estimatedGas + attributionGasOverhead(action.metadata.attributionSuffix)

await signAndSubmit({ to, value, data, gasLimit })
```

If you'd rather not take the dependency, the equivalent is `data + suffix.slice(2)`.

`assertValidAttributionSuffix` (which `applyAttribution` calls for you) accepts
only schemas this package can fully verify — schema 0 and schema 1. Schema 2
(CBOR) is declined rather than waved through, because approving a payload we
never decoded is a false assurance. We only emit schema 0, so this affects
nothing today.

`applyAttribution` additionally refuses to append twice (two markers would make
the outer one authoritative and misattribute the transaction) and rejects a
malformed suffix rather than signing calldata with garbage on the end.

### The one rule: append last

Apply it **after every transform, immediately before signing.**

Anything that decodes and re-encodes the calldata drops trailing bytes *silently* —
no error, no revert, just an unattributed transaction and an indexer reporting
nothing. In practice that means after any repayment rewriting, multicall
wrapping, or pot routing you do.

`replaceRepaymentDestinations` from this package is suffix-preserving as of
v0.4.0 (it detaches and reattaches around its own re-encode), so those two
compose in either order. A rewrite of your own will not.

If you re-sign on fee bumps, make sure the bumped transaction carries the same
suffixed calldata — attribution has to survive the transaction that actually
lands, not just the first attempt.

## Gas

The suffix costs **intrinsic calldata gas only**: 16 per non-zero byte, 4 per
zero byte, so roughly 400 gas for a typical code, plus a negligible L1 data fee
on rollups. Execution gas is unaffected — no contract ever reads it.

Because attribution is applied after estimation, add
`attributionGasOverhead(suffix)` to your gas limit. A percentage buffer usually
absorbs it, but that couples a correctness property to a tuning constant.

## Verifying it worked

The suffix is on the transaction we already index, so we can confirm attribution
end-to-end and will report per-relayer coverage back to you. If you want to check
locally, a suffixed transaction's `tx.input` ends with the 16-byte marker
`0x80218021802180218021802180218021`.
