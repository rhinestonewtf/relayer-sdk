# Rhinestone Relayer SDK

SDK for rewriting repayment destinations in router-encoded intent calldata.

Docs: https://docs.rhinestone.dev/

## Commands

- `bun run build` - Build the project (clean + tsc)
- `bun run test` - Run tests (vitest)
- `bun run check` - Lint and format (biome)
- `bun run typecheck` - Type check without emit

## Stack

- Runtime: Bun
- Language: TypeScript (strict mode)
- Testing: Vitest
- Linting: Biome
- Dependencies: viem (peer), @rhinestone/shared-configs

## Structure

- `/src` - Main package source (`@rhinestone/relayer-sdk`)
- `/src/index.ts` - Public exports
- `/src/rebalancing.ts` - Main replaceRepaymentDestinations function
- `/src/router.ts` - Router decoding and adapter rewrite functions
- `/src/adapters.ts` - Adapter ABI collection
- `/src/address.ts` - EthAddress type and parseAddress utility
- `/src/types.ts` - Shared type definitions
- `/test` - Unit tests

## Patterns

- Use viem types for addresses, chains, and hex values
- EthAddress is a branded type that intersects with viem's Address
- Contract addresses default to production but can be overridden via config
- Adapter-specific rewrite functions handle different context encodings

## Testing

- Run single test: `bun run test -- path/to/file.test.ts`
- Tests use real encoded calldata from the relayer
