import { intentExecutorAbi } from '@rhinestone/shared-configs'
import { decodeFunctionData, encodeFunctionData, type Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import { parseAddress } from '../src/address'
import { rewriteStandaloneExecutorCall } from '../src/standaloneExecutor'
import type { InternalRepaymentDestination } from '../src/types'

const ORIGINAL_RECIPIENT = '0x1111111111111111111111111111111111111111'
const NEW_RELAYER_ADDRESS = '0x2222222222222222222222222222222222222222'

const destination: InternalRepaymentDestination = {
  address: parseAddress(NEW_RELAYER_ADDRESS),
}

const sampleSingleChainOps = {
  account: '0x3333333333333333333333333333333333333333' as const,
  nonce: 1n,
  ops: { data: '0xdeadbeef' as Hex },
  signature: '0xabcd' as Hex,
}

const sampleMultiChainOps = {
  account: '0x3333333333333333333333333333333333333333' as const,
  chainIndex: 0n,
  otherChains: [`0x${'00'.repeat(32)}`] as [`0x${string}`],
  nonce: 1n,
  ops: { data: '0xdeadbeef' as Hex },
  signature: '0xabcd' as Hex,
}

const sampleGasRefundERC20 = {
  token: '0x4444444444444444444444444444444444444444' as const,
  exchangeRate: 1000000n,
  overhead: 21000n,
}

// ETH variants use just overhead (uint256) instead of the full GasRefund struct
const sampleOverhead = 21000n

describe('rewriteStandaloneExecutorCall', () => {
  describe('gas refund functions - should rewrite gasRefundRecipient', () => {
    it('should rewrite executeSinglechainOpsWithGasRefund_ERC20', () => {
      const data = encodeFunctionData({
        abi: intentExecutorAbi,
        functionName: 'executeSinglechainOpsWithGasRefund_ERC20',
        args: [sampleSingleChainOps, sampleGasRefundERC20, ORIGINAL_RECIPIENT],
      })

      const result = rewriteStandaloneExecutorCall(data, destination)

      const decoded = decodeFunctionData({
        abi: intentExecutorAbi,
        data: result,
      })

      expect(decoded.functionName).toBe(
        'executeSinglechainOpsWithGasRefund_ERC20',
      )
      expect(decoded.args![2]).toBe(NEW_RELAYER_ADDRESS)
    })

    it('should rewrite executeSinglechainOpsWithGasRefund_ETH', () => {
      const data = encodeFunctionData({
        abi: intentExecutorAbi,
        functionName: 'executeSinglechainOpsWithGasRefund_ETH',
        args: [sampleSingleChainOps, sampleOverhead, ORIGINAL_RECIPIENT],
      })

      const result = rewriteStandaloneExecutorCall(data, destination)

      const decoded = decodeFunctionData({
        abi: intentExecutorAbi,
        data: result,
      })

      expect(decoded.functionName).toBe(
        'executeSinglechainOpsWithGasRefund_ETH',
      )
      expect(decoded.args![2]).toBe(NEW_RELAYER_ADDRESS)
    })

    it('should rewrite executeMultichainOpsWithGasRefund_ERC20', () => {
      const data = encodeFunctionData({
        abi: intentExecutorAbi,
        functionName: 'executeMultichainOpsWithGasRefund_ERC20',
        args: [sampleMultiChainOps, sampleGasRefundERC20, ORIGINAL_RECIPIENT],
      })

      const result = rewriteStandaloneExecutorCall(data, destination)

      const decoded = decodeFunctionData({
        abi: intentExecutorAbi,
        data: result,
      })

      expect(decoded.functionName).toBe(
        'executeMultichainOpsWithGasRefund_ERC20',
      )
      expect(decoded.args![2]).toBe(NEW_RELAYER_ADDRESS)
    })

    it('should rewrite executeMultichainOpsWithGasRefund_ETH', () => {
      const data = encodeFunctionData({
        abi: intentExecutorAbi,
        functionName: 'executeMultichainOpsWithGasRefund_ETH',
        args: [sampleMultiChainOps, sampleOverhead, ORIGINAL_RECIPIENT],
      })

      const result = rewriteStandaloneExecutorCall(data, destination)

      const decoded = decodeFunctionData({
        abi: intentExecutorAbi,
        data: result,
      })

      expect(decoded.functionName).toBe('executeMultichainOpsWithGasRefund_ETH')
      expect(decoded.args![2]).toBe(NEW_RELAYER_ADDRESS)
    })

    it('should preserve other arguments when rewriting ERC20 variant', () => {
      const data = encodeFunctionData({
        abi: intentExecutorAbi,
        functionName: 'executeSinglechainOpsWithGasRefund_ERC20',
        args: [sampleSingleChainOps, sampleGasRefundERC20, ORIGINAL_RECIPIENT],
      })

      const result = rewriteStandaloneExecutorCall(data, destination)

      const decoded = decodeFunctionData({
        abi: intentExecutorAbi,
        data: result,
      })

      const [ops, gasRefund] = decoded.args as [
        typeof sampleSingleChainOps,
        typeof sampleGasRefundERC20,
        string,
      ]

      expect(ops.account).toBe(sampleSingleChainOps.account)
      expect(ops.nonce).toBe(sampleSingleChainOps.nonce)
      expect(ops.ops.data).toBe(sampleSingleChainOps.ops.data)
      expect(ops.signature).toBe(sampleSingleChainOps.signature)
      expect(gasRefund.token).toBe(sampleGasRefundERC20.token)
      expect(gasRefund.exchangeRate).toBe(sampleGasRefundERC20.exchangeRate)
      expect(gasRefund.overhead).toBe(sampleGasRefundERC20.overhead)
    })

    it('should preserve other arguments when rewriting ETH variant', () => {
      const data = encodeFunctionData({
        abi: intentExecutorAbi,
        functionName: 'executeSinglechainOpsWithGasRefund_ETH',
        args: [sampleSingleChainOps, sampleOverhead, ORIGINAL_RECIPIENT],
      })

      const result = rewriteStandaloneExecutorCall(data, destination)

      const decoded = decodeFunctionData({
        abi: intentExecutorAbi,
        data: result,
      })

      const [ops, overhead] = decoded.args as [
        typeof sampleSingleChainOps,
        bigint,
        string,
      ]

      expect(ops.account).toBe(sampleSingleChainOps.account)
      expect(ops.nonce).toBe(sampleSingleChainOps.nonce)
      expect(ops.ops.data).toBe(sampleSingleChainOps.ops.data)
      expect(ops.signature).toBe(sampleSingleChainOps.signature)
      expect(overhead).toBe(sampleOverhead)
    })
  })

  describe('non-gas-refund functions - should return unchanged', () => {
    it('should return executeSinglechainOps unchanged', () => {
      const data = encodeFunctionData({
        abi: intentExecutorAbi,
        functionName: 'executeSinglechainOps',
        args: [sampleSingleChainOps],
      })

      const result = rewriteStandaloneExecutorCall(data, destination)

      expect(result).toBe(data)
    })

    it('should return executeMultichainOps unchanged', () => {
      const data = encodeFunctionData({
        abi: intentExecutorAbi,
        functionName: 'executeMultichainOps',
        args: [sampleMultiChainOps],
      })

      const result = rewriteStandaloneExecutorCall(data, destination)

      expect(result).toBe(data)
    })
  })

  describe('edge cases', () => {
    it('should handle zero address as original recipient', () => {
      const zeroAddress = '0x0000000000000000000000000000000000000000'
      const data = encodeFunctionData({
        abi: intentExecutorAbi,
        functionName: 'executeSinglechainOpsWithGasRefund_ERC20',
        args: [sampleSingleChainOps, sampleGasRefundERC20, zeroAddress],
      })

      const result = rewriteStandaloneExecutorCall(data, destination)

      const decoded = decodeFunctionData({
        abi: intentExecutorAbi,
        data: result,
      })

      expect(decoded.args![2]).toBe(NEW_RELAYER_ADDRESS)
    })

    it('should handle same address for original and destination', () => {
      const sameDestination: InternalRepaymentDestination = {
        address: parseAddress(ORIGINAL_RECIPIENT),
      }

      const data = encodeFunctionData({
        abi: intentExecutorAbi,
        functionName: 'executeSinglechainOpsWithGasRefund_ERC20',
        args: [sampleSingleChainOps, sampleGasRefundERC20, ORIGINAL_RECIPIENT],
      })

      const result = rewriteStandaloneExecutorCall(data, sameDestination)

      const decoded = decodeFunctionData({
        abi: intentExecutorAbi,
        data: result,
      })

      expect(decoded.args![2]).toBe(ORIGINAL_RECIPIENT)
    })
  })
})
