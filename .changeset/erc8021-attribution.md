---
'@rhinestone/relayer-sdk': minor
---

Add ERC-8021 transaction attribution.

`applyAttribution(data, suffix)` appends the attribution suffix the orchestrator
publishes on `RelayerActionV1.metadata.attributionSuffix` to a transaction's
calldata, and `attributionGasOverhead(suffix)` returns the intrinsic gas to add
to a limit that was estimated before it. Also exported: `encodeAttributionSuffix`,
`splitAttribution`, `hasAttribution`, `assertValidAttributionSuffix`.

`replaceRepaymentDestinations` is now suffix-preserving. It decodes and
re-encodes the router call, and an ABI round-trip drops trailing bytes silently,
so attribution applied before the rewrite used to vanish with no error. It now
detaches and reattaches the suffix around its own re-encode, making the two
composable in either order.

See ATTRIBUTION.md for the relayer integration guide.
