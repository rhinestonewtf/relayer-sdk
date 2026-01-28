import {
  acrossAdapterAbi,
  directRouteAbi,
  ecoAdapterAbi,
  intentExecutorAdapterAbi,
  multiCallAbi,
  relayAdapterAbi,
  sameChainAdapterAbi,
  singleCallAbi,
} from '@rhinestone/shared-configs'

/**
 * Collection of adapter ABIs used by the router.
 * Each adapter handles a specific settlement layer or execution pattern.
 */
export const adapters = {
  singleCallAbi,
  multiCallAbi,
  directRouteAbi,
  ecoAbi: ecoAdapterAbi,
  sameChainAbi: sameChainAdapterAbi,
  acrossAbi: acrossAdapterAbi,
  intentExecutorAbi: intentExecutorAdapterAbi,
  relayAbi: relayAdapterAbi,
} as const
