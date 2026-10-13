import {
  acrossAdapterAbi,
  directRouteAbi,
  ecoAdapterAbi,
  intentExecutorAdapterAbi,
  intentExecutorAdapterGasRefundAbi,
  multiCallAbi,
  oftFeeAdapterAbi,
  relayAdapterAbi,
  sameChainAdapterAbi,
  singleCallAbi,
  singlecallAdapterAbi,
} from '@rhinestone/shared-configs'

const swapCallComponents = [
  { name: 'target', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'data', type: 'bytes' },
] as const

// compact-utils `src/swapper/SwapAdapter.sol`; @rhinestone/shared-configs
// ships its addresses but not its ABI.
const swapAdapterAbi = [
  {
    type: 'function',
    name: 'handleFill_swapAdapter_exactIn',
    stateMutability: 'payable',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'tokenIn', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'tokenOut', type: 'address' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'quotedAmountOut', type: 'uint256' },
      { name: 'orderRef', type: 'uint256' },
      { name: 'calls', type: 'tuple[]', components: swapCallComponents },
    ],
    outputs: [{ name: 'selector', type: 'bytes4' }],
  },
  {
    type: 'function',
    name: 'handleFill_swapAdapter_exactOut',
    stateMutability: 'payable',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'tokenIn', type: 'address' },
      { name: 'amountInMax', type: 'uint256' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountOut', type: 'uint256' },
      { name: 'quotedAmountIn', type: 'uint256' },
      { name: 'orderRef', type: 'uint256' },
      { name: 'calls', type: 'tuple[]', components: swapCallComponents },
    ],
    outputs: [{ name: 'selector', type: 'bytes4' }],
  },
] as const

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
  oftFeeAbi: oftFeeAdapterAbi,
  swapAbi: swapAdapterAbi,
} as const
