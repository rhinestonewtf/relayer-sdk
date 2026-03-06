import { routerAbi } from '@rhinestone/shared-configs'
import type { AbiFunction, DecodeFunctionDataReturnType, Hex } from 'viem'
import {
  decodeAbiParameters,
  decodeFunctionData,
  encodeAbiParameters,
  encodePacked,
  toFunctionSelector,
} from 'viem'
import { adapters } from './adapters'
import { UnsupportedRouteCallError } from './errors'
import type { EthAddress, InternalRepaymentDestination } from './types'

const supportedRouteCalls = [
  'routeClaim',
  'routeFill',
  'optimized_routeFill921336808',
]

/**
 * Return type for decodeRouterCall, extends viem's decoded function data
 * with metadata about whether this is an optimized route call.
 */
export type DecodeRouterCallReturnType = DecodeFunctionDataReturnType<
  typeof routerAbi
> & {
  isOptimizedRouteCall: boolean
}

/**
 * Decodes router calldata and validates it's a supported route function.
 *
 * @param data - The ABI-encoded router calldata
 * @returns Decoded function data with optimization flag
 * @throws Error if the function is not a supported route call
 */
export function decodeRouterCall(data: Hex): DecodeRouterCallReturnType {
  const routerCall = decodeFunctionData({
    abi: routerAbi,
    data,
  })
  if (!supportedRouteCalls.includes(routerCall.functionName)) {
    throw new UnsupportedRouteCallError({
      functionName: routerCall.functionName,
    })
  }
  const isOptimizedRouteCall = routerCall.functionName.startsWith('optimized')
  return {
    ...routerCall,
    isOptimizedRouteCall,
  }
}

/**
 * Function signature for adapter-specific relayer context rewrite functions.
 * Takes the original encoded context and a repayment destination,
 * returns the rewritten encoded context.
 * @internal
 */
export type RelayerContextRewrite = (
  original: Hex,
  repayment: InternalRepaymentDestination,
) => Hex

/**
 * Metadata for a single adapter function, resolved from its 4-byte selector.
 */
export type AdapterCall = {
  functionName: string
  adapterName: string
  rewriteRelayerContext: RelayerContextRewrite
}

/**
 * No-op rewrite for adapters that don't need repayment context modification.
 * @internal
 */
export const NoRelayerContext: RelayerContextRewrite = (
  original: Hex,
  _repayment: InternalRepaymentDestination,
): Hex => {
  return original
}

const acrossRelayerContext = [
  {
    type: 'tuple[]',
    components: [
      { name: 'repaymentChain', type: 'uint256' },
      { name: 'repaymentAddress', type: 'address' },
    ],
  },
]

/**
 * Rewrites Across adapter relayer context.
 * Across contexts contain an array of (repaymentChain, repaymentAddress) tuples,
 * one per deposit/origin chain.
 *
 * When `repayment.chain` is provided, all tuples are updated to that chain.
 * When omitted, each tuple preserves its original repaymentChain.
 * @internal
 */
export const AcrossRepaymentsRelayerContext: RelayerContextRewrite = (
  original: Hex,
  repayment: InternalRepaymentDestination,
): Hex => {
  const decoded = decodeAbiParameters(acrossRelayerContext, original)
  const contexts = decoded[0] as {
    repaymentChain: bigint
    repaymentAddress: EthAddress
  }[]

  for (const context of contexts) {
    context.repaymentAddress = repayment.address
    if (repayment.chain) {
      context.repaymentChain = BigInt(repayment.chain)
    }
  }

  return encodeAbiParameters(acrossRelayerContext, [contexts])
}

const sameChainRelayerContext = ['address']

/**
 * Rewrites SameChain adapter relayer context.
 * Simply encodes the new repayment address.
 * @internal
 */
export const SameChainRepaymentsRelayerContext: RelayerContextRewrite = (
  _original: Hex,
  repayment: InternalRepaymentDestination,
): Hex => {
  return encodePacked(sameChainRelayerContext, [repayment.address])
}

const ecoRelayerContext = ['address']

/**
 * Rewrites Eco adapter relayer context.
 * Simply encodes the new repayment address (claimant).
 * @internal
 */
export const EcoRepaymentsRelayerContext: RelayerContextRewrite = (
  _original: Hex,
  repayment: InternalRepaymentDestination,
): Hex => {
  return encodePacked(ecoRelayerContext, [repayment.address])
}

type RewriteLookup = (f: AbiFunction) => RelayerContextRewrite

const lookup = (
  defaultCtx: RelayerContextRewrite,
  overrides?: { [name: string]: RelayerContextRewrite },
): RewriteLookup => {
  return (f: AbiFunction) => {
    const override = overrides?.[f.name]
    if (override) {
      return override
    }
    return defaultCtx
  }
}

const adapterRelayerContextMap: {
  [K in keyof typeof adapters]: RewriteLookup
} = {
  singleCallAbi: lookup(NoRelayerContext),
  singlecallAdapterAbi: lookup(NoRelayerContext),
  multiCallAbi: lookup(NoRelayerContext, {
    multicall_handleJITClaim: SameChainRepaymentsRelayerContext,
    multicall_handleFill: SameChainRepaymentsRelayerContext,
  }),
  directRouteAbi: lookup(NoRelayerContext),
  sameChainAbi: lookup(SameChainRepaymentsRelayerContext),
  ecoAbi: lookup(EcoRepaymentsRelayerContext),
  acrossAbi: lookup(AcrossRepaymentsRelayerContext),
  intentExecutorAbi: lookup(NoRelayerContext),
  intentExecutorWithGasRefundAbi: lookup(SameChainRepaymentsRelayerContext),
  relayAbi: lookup(NoRelayerContext),
  oftFeeAbi: lookup(NoRelayerContext),
}

function buildSelectorToAdapterCallMap(): { [key: Hex]: AdapterCall } {
  const map: { [key: Hex]: AdapterCall } = {}

  for (const key of Object.keys(adapters) as (keyof typeof adapters)[]) {
    const lookupFn = adapterRelayerContextMap[key]
    const abi = adapters[key]

    for (const item of abi.filter((v) => v.type === 'function')) {
      const functionSelector = toFunctionSelector(item)
      map[functionSelector] = {
        functionName: item.name,
        adapterName: key,
        rewriteRelayerContext: lookupFn(item),
      }
    }
  }

  return map
}

/**
 * Pre-built map from 4-byte function selector to adapter call metadata.
 * Used to look up the appropriate rewrite function for each adapter call.
 */
export const functionSelectorToAdapterCallMap: Readonly<{
  [key: Hex]: AdapterCall
}> = buildSelectorToAdapterCallMap()
