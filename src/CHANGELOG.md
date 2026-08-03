# @rhinestone/relayer-sdk

## 0.4.1

### Patch Changes

- d05e4cf: `applyAttribution` no longer throws on a malformed suffix — it skips it and
  returns the calldata unchanged.

  Attribution is reporting; it must never be a precondition for filling an intent.
  This function runs inside relayers we do not operate, so a bad suffix — which
  could only come from a bug on the publishing side — must cost an attribution,
  not a fill. The strictness was not protective either: a malformed suffix is inert
  trailing calldata, so appending it is harmless, just useless.

  `attributionGasOverhead` is gated on the same predicate, so the gas budgeted
  always matches the bytes actually appended.

  Callers wanting strictness can still call `assertValidAttributionSuffix`
  directly; it is unchanged and still exported.

## 0.4.0

### Minor Changes

- 95b292a: Add ERC-8021 transaction attribution.

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

## 0.3.8

### Patch Changes

- d731a24: Dry-run release to verify npm trusted publishing.

## 0.3.7

### Patch Changes

- 718fcdb: update shared configs

## 0.3.6

### Patch Changes

- def0fd1: update shared configs

## 0.3.5

### Patch Changes

- 1f57224: Add OFTFeeAdapter abi

## 0.3.4

### Patch Changes

- 560c9e9: update shared configs for latest abis

## 0.3.3

### Patch Changes

- 37cfcd8: Add singlecallAdapterAbi to adapters and router selector map

## 0.3.2

### Patch Changes

- c7b3983: relax @rhinestone/shared-configs to caret range

## 0.3.1

### Patch Changes

- 24d3951: bump @rhinestone/shared-configs

## 0.3.0

### Minor Changes

- 2ecaeae: Bump shared configs

### Patch Changes

- c8b340a: Patch release v0.2.1

## 0.2.0

### Minor Changes

- 7530f65: Initial public release of @rhinestone/relayer-sdk

  Features:

  - `replaceRepaymentDestinations()` - Rewrite repayment destinations in router calldata
  - Support for Across, SameChain, and Eco adapters
  - Low-level building blocks for custom rewrite logic

- 2f8b9a5: Add standalone executor relayer address rewrites
