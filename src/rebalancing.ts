import { contractAddresses, routerAbi } from '@rhinestone/shared-configs'
import {
  type Address,
  decodeAbiParameters,
  encodeFunctionData,
  type Hex,
  sliceHex,
} from 'viem'
import { parseAddress } from './address'
import {
  ContextMismatchError,
  UnsupportedAdapterError,
  UnsupportedDestinationError,
} from './errors'
import {
  decodeRouterCall,
  functionSelectorToAdapterCallMap,
  NoRelayerContext,
} from './router'
import type {
  InternalRepaymentDestination,
  RebalancingConfig,
  RepaymentDestination,
} from './types'

const DEFAULT_ROUTER_ADDRESS = parseAddress(contractAddresses['*'].router)
const DEFAULT_INTENT_EXECUTOR_ADDRESS = parseAddress(
  contractAddresses['*'].intentExecutor,
)

/**
 * Rewrites repayment destinations inside router-encoded intent calldata.
 *
 * Decodes the router call, walks each adapter call in the route, and replaces
 * the relayer context (repayment address / chain) for every adapter that
 * carries one (Across, SameChain, Eco).
 *
 * @param to - Target contract address of the call
 * @param data - ABI-encoded calldata (routeFill / routeClaim / optimized variant)
 * @param destination - The repayment destination to write into each relayer context.
 *   Omit `chain` to preserve per-deposit origin chains (recommended for Across).
 * @param config - Optional override for router / intent-executor addresses.
 *   Defaults to production addresses from `@rhinestone/shared-configs`.
 * @returns The calldata with rewritten repayment destinations
 * @throws Error if the target address is not recognized or adapter call is unknown
 *
 * @example
 * ```ts
 * // Simple usage with defaults
 * const rewritten = replaceRepaymentDestinations(
 *   routerAddress,
 *   originalCalldata,
 *   { address: '0x...' },
 * )
 *
 * // With custom config (e.g., dev deployment)
 * const rewritten = replaceRepaymentDestinations(
 *   routerAddress,
 *   originalCalldata,
 *   { address: '0x...' },
 *   {
 *     routerAddress: '0x...',
 *     intentExecutorAddress: '0x...',
 *   },
 * )
 * ```
 */
export function replaceRepaymentDestinations(
  to: Address,
  data: Hex,
  destination: RepaymentDestination,
  config?: RebalancingConfig,
): Hex {
  // Normalize addresses internally
  const normalizedTo = parseAddress(to)
  const routerAddress = config?.routerAddress
    ? parseAddress(config.routerAddress)
    : DEFAULT_ROUTER_ADDRESS
  const intentExecutorAddress = config?.intentExecutorAddress
    ? parseAddress(config.intentExecutorAddress)
    : DEFAULT_INTENT_EXECUTOR_ADDRESS
  const normalizedDestination: InternalRepaymentDestination = {
    address: parseAddress(destination.address),
    chain: destination.chain,
  }

  if (normalizedTo === intentExecutorAddress) {
    // Intent executor calls don't need repayment context modification
    return data
  }

  if (normalizedTo === routerAddress) {
    const {
      functionName: routerFunctionName,
      args: routerCallArgs,
      isOptimizedRouteCall,
    } = decodeRouterCall(data)

    let contextIndex = 0
    const relayerContextData = routerCallArgs![0] as Hex[]
    const adaptersCallData = !isOptimizedRouteCall
      ? (routerCallArgs![1] as Hex[])
      : decodeAbiParameters(
          [{ type: 'bytes[]', name: 'adapterContexts' }],
          routerCallArgs![1] as Hex,
        )[0]

    // Track adapter calls for better error diagnostics
    const adapterCalls = []

    for (let i = 0; i < adaptersCallData.length; i++) {
      const adapterCallBytes = adaptersCallData[i]
      const selector = sliceHex(adapterCallBytes, 0, 4)
      const adapterCall = functionSelectorToAdapterCallMap[selector]

      if (!adapterCall) {
        throw new UnsupportedAdapterError({
          selector,
          index: i,
          functionName: routerFunctionName,
        })
      }

      adapterCalls.push({
        name: `${adapterCall.adapterName}:${adapterCall.functionName}`,
        expectsContext: adapterCall.rewriteRelayerContext !== NoRelayerContext,
      })

      const rewriteF = adapterCall.rewriteRelayerContext
      if (rewriteF !== NoRelayerContext) {
        if (contextIndex >= relayerContextData.length) {
          throw new ContextMismatchError({
            expected: contextIndex + 1,
            actual: relayerContextData.length,
            adapterCalls,
          })
        }
        const currentContext = relayerContextData[contextIndex]
        relayerContextData[contextIndex] = rewriteF(
          currentContext,
          normalizedDestination,
        )
        contextIndex++
      }
    }

    if (contextIndex !== relayerContextData.length) {
      throw new ContextMismatchError({
        expected: contextIndex,
        actual: relayerContextData.length,
        adapterCalls,
      })
    }

    return encodeFunctionData({
      functionName: routerFunctionName,
      args: routerCallArgs,
      abi: routerAbi,
    })
  }

  throw new UnsupportedDestinationError({ address: to })
}
