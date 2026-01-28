import { routerAbi } from '@rhinestone/shared-configs'
import { encodeAbiParameters, encodeFunctionData } from 'viem'
import { describe, expect, it } from 'vitest'
import { UnsupportedRouteCallError } from '../src'
import { decodeRouterCall } from '../src/router'

describe('decodeRouterCall', () => {
  describe('routeClaim', () => {
    it('should decode valid routeClaim call', () => {
      const routeClaimData = encodeFunctionData({
        abi: routerAbi,
        functionName: 'routeClaim',
        args: [
          ['0xaabbccdd'], // relayer contexts
          ['0x11223344'], // adapter calls
        ],
      })

      const result = decodeRouterCall(routeClaimData)

      expect(result.functionName).toBe('routeClaim')
      expect(result.isOptimizedRouteCall).toBe(false)
      expect(result.args).toBeDefined()
    })

    it('should decode routeClaim with empty arrays', () => {
      const routeClaimData = encodeFunctionData({
        abi: routerAbi,
        functionName: 'routeClaim',
        args: [[], []],
      })

      const result = decodeRouterCall(routeClaimData)

      expect(result.functionName).toBe('routeClaim')
      expect(result.isOptimizedRouteCall).toBe(false)
    })
  })

  describe('optimized_routeFill921336808', () => {
    it('should decode optimized routeFill call', () => {
      // The optimized version takes (bytes[] relayerContexts, bytes adapterContexts, bytes signature)
      // where adapterContexts is packed bytes[]
      const packedAdapterContexts = encodeAbiParameters(
        [{ type: 'bytes[]', name: 'adapterContexts' }],
        [['0x11223344']],
      )

      const optimizedData = encodeFunctionData({
        abi: routerAbi,
        functionName: 'optimized_routeFill921336808',
        args: [
          ['0xaabbccdd'], // relayer contexts
          packedAdapterContexts, // packed adapter contexts
          '0xdeadbeef', // signature
        ],
      })

      const result = decodeRouterCall(optimizedData)

      expect(result.functionName).toBe('optimized_routeFill921336808')
      expect(result.isOptimizedRouteCall).toBe(true)
      expect(result.args).toBeDefined()
    })

    it('should correctly identify optimized call by function name prefix', () => {
      const packedAdapterContexts = encodeAbiParameters(
        [{ type: 'bytes[]', name: 'adapterContexts' }],
        [[]],
      )

      const optimizedData = encodeFunctionData({
        abi: routerAbi,
        functionName: 'optimized_routeFill921336808',
        args: [[], packedAdapterContexts, '0x'],
      })

      const result = decodeRouterCall(optimizedData)

      expect(result.functionName.startsWith('optimized')).toBe(true)
      expect(result.isOptimizedRouteCall).toBe(true)
    })
  })

  describe('Unsupported functions', () => {
    it('should throw UnsupportedRouteCallError for non-route function', () => {
      // Create calldata for a function that exists but isn't a route function
      const initializeData = encodeFunctionData({
        abi: routerAbi,
        functionName: 'initialize',
        args: [
          '0x0000000000000000000000000000000000000001',
          '0x0000000000000000000000000000000000000002',
          '0x0000000000000000000000000000000000000003',
        ],
      })

      expect(() => decodeRouterCall(initializeData)).toThrow(
        UnsupportedRouteCallError,
      )
    })

    it('should throw with correct function name in error', () => {
      const pauseData = encodeFunctionData({
        abi: routerAbi,
        functionName: 'pauseRouter',
        args: [],
      })

      try {
        decodeRouterCall(pauseData)
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(UnsupportedRouteCallError)
        if (err instanceof UnsupportedRouteCallError) {
          expect(err.context.functionName).toBe('pauseRouter')
        }
      }
    })
  })

  describe('Return type structure', () => {
    it('should return object with all expected fields', () => {
      const routeClaimData = encodeFunctionData({
        abi: routerAbi,
        functionName: 'routeClaim',
        args: [['0xaa'], ['0xbb']],
      })

      const result = decodeRouterCall(routeClaimData)

      // Check that all expected fields are present
      expect('functionName' in result).toBe(true)
      expect('args' in result).toBe(true)
      expect('isOptimizedRouteCall' in result).toBe(true)
    })

    it('should return args matching input', () => {
      const contexts = ['0xaabbccdd', '0x11223344'] as const
      const adapters = ['0x55667788'] as const

      const routeClaimData = encodeFunctionData({
        abi: routerAbi,
        functionName: 'routeClaim',
        args: [contexts, adapters],
      })

      const result = decodeRouterCall(routeClaimData)
      const args = result.args as [readonly string[], readonly string[]]

      expect(args[0]).toEqual(contexts)
      expect(args[1]).toEqual(adapters)
    })
  })
})
