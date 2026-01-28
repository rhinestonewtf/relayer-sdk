import { contractAddressesDev, routerAbi } from '@rhinestone/shared-configs'
import { encodeFunctionData } from 'viem'
import { describe, expect, it } from 'vitest'
import { type RebalancingConfig, replaceRepaymentDestinations } from '../src'
import { parseAddress } from '../src/address'

const ROUTER_ADDRESS_DEV = parseAddress(contractAddressesDev['*'].router)
const INTENT_EXECUTOR_ADDRESS_DEV = parseAddress(
  contractAddressesDev['*'].intentExecutor,
)

const devConfig: RebalancingConfig = {
  routerAddress: ROUTER_ADDRESS_DEV,
  intentExecutorAddress: INTENT_EXECUTOR_ADDRESS_DEV,
}

describe('Edge cases', () => {
  describe('Empty adapter calls array', () => {
    it('should handle routeClaim with no adapter calls', () => {
      const routeClaimData = encodeFunctionData({
        abi: routerAbi,
        functionName: 'routeClaim',
        args: [
          [], // empty relayer contexts
          [], // empty adapter calls
        ],
      })

      const result = replaceRepaymentDestinations(
        ROUTER_ADDRESS_DEV,
        routeClaimData,
        { address: parseAddress('0xdead00000000000000000000000000000000beef') },
        devConfig,
      )

      // Should return equivalent encoded data without errors
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.startsWith('0x')).toBe(true)
    })
  })

  describe('Intent executor passthrough', () => {
    it('should return data unchanged for intent executor calls', () => {
      const originalData = '0xdeadbeefcafebabe'

      const result = replaceRepaymentDestinations(
        INTENT_EXECUTOR_ADDRESS_DEV,
        originalData,
        { address: parseAddress('0xdead00000000000000000000000000000000beef') },
        devConfig,
      )

      expect(result).toBe(originalData)
    })

    it('should not modify any bytes for intent executor', () => {
      const complexData = `0x${'0123456789abcdef'.repeat(100)}` as `0x${string}`

      const result = replaceRepaymentDestinations(
        INTENT_EXECUTOR_ADDRESS_DEV,
        complexData,
        {
          address: parseAddress('0x1111111111111111111111111111111111111111'),
          chain: 999,
        },
        devConfig,
      )

      expect(result).toBe(complexData)
    })
  })

  describe('Address normalization', () => {
    it('should normalize uppercase address to lowercase', () => {
      const uppercase = '0xDEAD00000000000000000000000000000000BEEF'
      const parsed = parseAddress(uppercase)

      expect(parsed).toBe('0xdead00000000000000000000000000000000beef')
    })

    it('should normalize mixed case address to lowercase', () => {
      const mixedCase = '0xDeAd00000000000000000000000000000000BeEf'
      const parsed = parseAddress(mixedCase)

      expect(parsed).toBe('0xdead00000000000000000000000000000000beef')
    })

    it('should preserve already lowercase address', () => {
      const lowercase = '0xdead00000000000000000000000000000000beef'
      const parsed = parseAddress(lowercase)

      expect(parsed).toBe(lowercase)
    })

    it('should handle checksum addresses', () => {
      // Valid EIP-55 checksum address
      const checksumAddress = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
      const parsed = parseAddress(checksumAddress)

      expect(parsed).toBe('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed')
    })
  })

  describe('Single adapter with no relayer context', () => {
    it('should handle direct route adapter that needs no context', () => {
      // directRoute onFill_inRouter_collectFee doesn't require relayer context
      const directRouteSelector = '0x85934dde' // onFill_inRouter_collectFee
      const directRouteCall =
        `${directRouteSelector}${'00'.repeat(64)}` as const

      const routeClaimData = encodeFunctionData({
        abi: routerAbi,
        functionName: 'routeClaim',
        args: [
          [], // no contexts needed
          [directRouteCall],
        ],
      })

      const result = replaceRepaymentDestinations(
        ROUTER_ADDRESS_DEV,
        routeClaimData,
        { address: parseAddress('0xdead00000000000000000000000000000000beef') },
        devConfig,
      )

      expect(result).toBeDefined()
      expect(result.startsWith('0x')).toBe(true)
    })
  })

  describe('Custom config', () => {
    it('should use custom router address from config', () => {
      const customRouter = parseAddress(
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      )
      const customIntentExecutor = parseAddress(
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      )

      const customConfig: RebalancingConfig = {
        routerAddress: customRouter,
        intentExecutorAddress: customIntentExecutor,
      }

      // Using custom intent executor should passthrough
      const result = replaceRepaymentDestinations(
        customIntentExecutor,
        '0xdeadbeef',
        { address: parseAddress('0x1111111111111111111111111111111111111111') },
        customConfig,
      )

      expect(result).toBe('0xdeadbeef')
    })
  })

  describe('Destination with and without chain', () => {
    it('should work with only address provided', () => {
      const routeClaimData = encodeFunctionData({
        abi: routerAbi,
        functionName: 'routeClaim',
        args: [[], []],
      })

      // Should not throw when chain is omitted
      expect(() =>
        replaceRepaymentDestinations(
          ROUTER_ADDRESS_DEV,
          routeClaimData,
          {
            address: parseAddress('0xdead00000000000000000000000000000000beef'),
          },
          devConfig,
        ),
      ).not.toThrow()
    })

    it('should work with address and chain provided', () => {
      const routeClaimData = encodeFunctionData({
        abi: routerAbi,
        functionName: 'routeClaim',
        args: [[], []],
      })

      // Should not throw when chain is provided
      expect(() =>
        replaceRepaymentDestinations(
          ROUTER_ADDRESS_DEV,
          routeClaimData,
          {
            address: parseAddress('0xdead00000000000000000000000000000000beef'),
            chain: 1,
          },
          devConfig,
        ),
      ).not.toThrow()
    })
  })
})
