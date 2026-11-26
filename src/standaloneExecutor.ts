import { intentExecutorAbi } from '@rhinestone/shared-configs'
import {
  decodeFunctionData,
  encodeFunctionData,
  type Hex,
  toFunctionSelector,
} from 'viem'
import { intentExecutorExpAbi } from './intentExecutorExp'
import type { InternalRepaymentDestination } from './types'

const executorAbi = [...intentExecutorAbi, ...intentExecutorExpAbi] as const

// Build selector set for gas refund functions
const gasRefundSelectors: Set<Hex> = new Set(
  executorAbi
    .filter(
      (item): item is (typeof executorAbi)[number] & { type: 'function' } =>
        item.type === 'function' && item.name.includes('WithGasRefund'),
    )
    .map((item) => toFunctionSelector(item)),
)

/**
 * Rewrites the gasRefundRecipient address in standalone intent executor calls.
 *
 * For functions with "WithGasRefund" in the name, the last parameter is
 * the gasRefundRecipient address which gets replaced with the destination address.
 *
 * Non-gas-refund functions are returned unchanged.
 *
 * @param data - ABI-encoded intent executor calldata
 * @param destination - The repayment destination to write
 * @returns The calldata with rewritten gasRefundRecipient (or unchanged if not a gas refund function)
 */
export function rewriteStandaloneExecutorCall(
  data: Hex,
  destination: InternalRepaymentDestination,
): Hex {
  const selector = data.slice(0, 10) as Hex

  if (!gasRefundSelectors.has(selector)) {
    // Not a gas refund function, return unchanged
    return data
  }

  const decoded = decodeFunctionData({
    abi: executorAbi,
    data,
  })

  // Last arg is gasRefundRecipient - replace it
  const args = [...decoded.args!] as unknown[]
  args[args.length - 1] = destination.address

  return encodeFunctionData({
    abi: executorAbi,
    functionName: decoded.functionName,
    args: args as never,
  })
}
