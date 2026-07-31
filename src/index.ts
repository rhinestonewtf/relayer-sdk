// Adapters
// biome-ignore lint/performance/noBarrelFile: Package entry point requires re-exports
export { adapters } from './adapters'
// ERC-8021 transaction attribution
export {
  ATTRIBUTION_SCHEMA_CANONICAL_REGISTRY,
  ATTRIBUTION_SCHEMA_CBOR,
  ATTRIBUTION_SCHEMA_CUSTOM_REGISTRY,
  applyAttribution,
  assertValidAttributionSuffix,
  attributionGasOverhead,
  ERC8021_MARKER,
  encodeAttributionSuffix,
  hasAttribution,
  splitAttribution,
} from './attribution'
// Errors
export {
  ContextMismatchError,
  InvalidAddressError,
  InvalidAttributionSuffixError,
  isRelayerError,
  isValidationError,
  RelayerError,
  UnsupportedAdapterError,
  UnsupportedDestinationError,
  UnsupportedRouteCallError,
} from './errors'
export { replaceRepaymentDestinations } from './rebalancing'
export type {
  AdapterCall,
  DecodeRouterCallReturnType,
  RelayerContextRewrite,
} from './router'
// Lower-level building blocks
export {
  AcrossRepaymentsRelayerContext,
  decodeRouterCall,
  EcoRepaymentsRelayerContext,
  functionSelectorToAdapterCallMap,
  NoRelayerContext,
  SameChainRepaymentsRelayerContext,
} from './router'
// Types
export type { RebalancingConfig, RepaymentDestination } from './types'
