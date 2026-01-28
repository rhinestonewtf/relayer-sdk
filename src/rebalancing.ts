import { contractAddresses, routerAbi } from '@rhinestone/shared-configs'
import {
  decodeAbiParameters,
  encodeFunctionData,
  type Hex,
  sliceHex,
} from 'viem'
import { parseAddress } from './address'
import {
  decodeRouterCall,
  functionSelectorToAdapterCallMap,
  NoRelayerContext,
} from './router'
import type {
  EthAddress,
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
 *   { address: myRelayerAddress },
 * )
 *
 * // With custom config (e.g., dev deployment)
 * const rewritten = replaceRepaymentDestinations(
 *   routerAddress,
 *   originalCalldata,
 *   { address: myRelayerAddress },
 *   {
 *     routerAddress: parseAddress(devContracts.router),
 *     intentExecutorAddress: parseAddress(devContracts.intentExecutor),
 *   },
 * )
 * ```
 */
export function replaceRepaymentDestinations(
  to: EthAddress,
  data: Hex,
  destination: RepaymentDestination,
  config?: RebalancingConfig,
): Hex {
  const routerAddress = config?.routerAddress ?? DEFAULT_ROUTER_ADDRESS
  const intentExecutorAddress =
    config?.intentExecutorAddress ?? DEFAULT_INTENT_EXECUTOR_ADDRESS

  if (to === intentExecutorAddress) {
    // Intent executor calls don't need repayment context modification
    return data
  }

  if (to === routerAddress) {
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
        throw new Error(
          `Unknown adapter call at ${i}, selector: ${selector} for ${routerFunctionName}`,
        )
      }

      adapterCalls.push({
        name: `${adapterCall.adapterName}:${adapterCall.functionName}`,
        expectsContext: adapterCall.rewriteRelayerContext !== NoRelayerContext,
      })

      const rewriteF = adapterCall.rewriteRelayerContext
      if (rewriteF !== NoRelayerContext) {
        if (contextIndex >= relayerContextData.length) {
          throw new Error(
            `Mismatch: Adapter call ${adapterCall.adapterName}:${adapterCall.functionName} at index ${i} requires a relayer context, but none are available for ${routerFunctionName}. Call list ${JSON.stringify(adapterCalls, undefined, 2)}`,
          )
        }
        const currentContext = relayerContextData[contextIndex]
        relayerContextData[contextIndex] = rewriteF(currentContext, destination)
        contextIndex++
      }
    }

    if (contextIndex !== relayerContextData.length) {
      throw new Error(
        `Data mismatch: More contexts were provided than were consumed by the adapter calls for ${routerFunctionName}. Call list: ${JSON.stringify(adapterCalls, undefined, 2)}`,
      )
    }

    return encodeFunctionData({
      functionName: routerFunctionName,
      args: routerCallArgs,
      abi: routerAbi,
    })
  }

  throw new Error('Unsupported destination')
}
