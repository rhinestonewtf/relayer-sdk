import {
  acrossAdapterAbi,
  directRouteAbi,
  ecoAdapterAbi,
  intentExecutorAdapterAbi,
  intentExecutorAdapterGasRefundAbi,
  multiCallAbi,
  relayAdapterAbi,
  sameChainAdapterAbi,
  singleCallAbi,
  singlecallAdapterAbi,
} from '@rhinestone/shared-configs'

/**
 * Collection of adapter ABIs used by the router.
 * Each adapter handles a specific settlement layer or execution pattern.
 */
export const adapters = {
  singleCallAbi,
  singlecallAdapterAbi,
  multiCallAbi,
  directRouteAbi,
  ecoAbi: ecoAdapterAbi,
  sameChainAbi: sameChainAdapterAbi,
  acrossAbi: acrossAdapterAbi,
  intentExecutorAbi: intentExecutorAdapterAbi,
  intentExecutorWithGasRefundAbi: intentExecutorAdapterGasRefundAbi,
  relayAbi: relayAdapterAbi,
} as const
