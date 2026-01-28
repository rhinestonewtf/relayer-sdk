# @rhinestone/relayer-sdk

SDK for rewriting repayment destinations in router-encoded intent calldata.

Allows external relayers to redirect where they receive repayments when filling or claiming intents through the Rhinestone router.

## Installation

```bash
bun add @rhinestone/relayer-sdk viem
```

## Usage

```typescript
import {
  replaceRepaymentDestinations,
  parseAddress,
} from '@rhinestone/relayer-sdk'

// Rewrite repayment destination in router calldata
const rewritten = replaceRepaymentDestinations(
  routerAddress,
  originalCalldata,
  {
    address: parseAddress('0xYourRelayerAddress'),
    // Omit `chain` to preserve per-deposit origin chains (recommended for Across)
    // Or specify a chain to redirect all repayments there
  },
)
```

### Custom Contract Addresses

By default, the SDK uses production contract addresses from `@rhinestone/shared-configs`. For dev deployments or custom configurations:

```typescript
import {
  replaceRepaymentDestinations,
  parseAddress,
  type RebalancingConfig,
} from '@rhinestone/relayer-sdk'
import { contractAddressesDev } from '@rhinestone/shared-configs'

const config: RebalancingConfig = {
  routerAddress: parseAddress(contractAddressesDev['*'].router),
  intentExecutorAddress: parseAddress(contractAddressesDev['*'].intentExecutor),
}

const rewritten = replaceRepaymentDestinations(
  routerAddress,
  calldata,
  { address: myAddress },
  config,
)
```

## API

### `replaceRepaymentDestinations(to, data, destination, config?)`

Rewrites repayment destinations inside router-encoded intent calldata.

**Parameters:**

- `to: EthAddress` - Target contract address of the call
- `data: Hex` - ABI-encoded calldata (routeFill / routeClaim / optimized variant)
- `destination: RepaymentDestination` - Where to receive repayments
  - `address: EthAddress` - The repayment recipient
  - `chain?: number` - Override repayment chain. Omit to preserve original per-deposit chains.
- `config?: RebalancingConfig` - Optional contract address overrides

**Returns:** `Hex` - The calldata with rewritten repayment destinations

### `parseAddress(value)`

Validates and normalizes an address string to an `EthAddress`.

### Lower-Level Exports

For advanced use cases:

- `decodeRouterCall(data)` - Decode router calldata
- `functionSelectorToAdapterCallMap` - Map from selector to adapter metadata
- `AcrossRepaymentsRelayerContext` - Across-specific rewrite function
- `SameChainRepaymentsRelayerContext` - SameChain-specific rewrite function
- `EcoRepaymentsRelayerContext` - Eco-specific rewrite function
- `NoRelayerContext` - No-op rewrite function

## Supported Adapters

The SDK supports repayment rewriting for:

- **Across** - Cross-chain bridge adapter (tuple array of repayments)
- **SameChain** - Same-chain settlement adapter
- **Eco** - Eco protocol adapter
- **MultiCall** - Multi-call adapter (handleFill, handleJITClaim)

## License

MIT
