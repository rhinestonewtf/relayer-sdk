import { contractAddressesDev, routerAbi } from '@rhinestone/shared-configs'
import { encodeFunctionData } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  ContextMismatchError,
  InvalidAddressError,
  isRelayerError,
  isValidationError,
  type RebalancingConfig,
  RelayerError,
  replaceRepaymentDestinations,
  UnsupportedAdapterError,
  UnsupportedDestinationError,
  UnsupportedRouteCallError,
} from '../src'
import { parseAddress } from '../src/address'
import { decodeRouterCall } from '../src/router'

const ROUTER_ADDRESS_DEV = parseAddress(contractAddressesDev['*'].router)
const INTENT_EXECUTOR_ADDRESS_DEV = parseAddress(
  contractAddressesDev['*'].intentExecutor,
)

const devConfig: RebalancingConfig = {
  routerAddress: ROUTER_ADDRESS_DEV,
  intentExecutorAddress: INTENT_EXECUTOR_ADDRESS_DEV,
}

describe('UnsupportedAdapterError', () => {
  it('should be thrown for unknown adapter selector', () => {
    // Create a routeClaim call with an unknown adapter selector
    const unknownAdapterCalldata = '0xdeadbeef' // unknown selector
    const routeClaimData = encodeFunctionData({
      abi: routerAbi,
      functionName: 'routeClaim',
      args: [
        ['0x'], // relayer contexts
        [unknownAdapterCalldata], // adapter calls with unknown selector
      ],
    })

    expect(() =>
      replaceRepaymentDestinations(
        ROUTER_ADDRESS_DEV,
        routeClaimData,
        { address: parseAddress('0xdead00000000000000000000000000000000beef') },
        devConfig,
      ),
    ).toThrow(UnsupportedAdapterError)
  })

  it('should have correct context fields', () => {
    const error = new UnsupportedAdapterError({
      selector: '0xdeadbeef',
      index: 2,
      functionName: 'routeClaim',
    })

    expect(error.context).toEqual({
      selector: '0xdeadbeef',
      index: 2,
      functionName: 'routeClaim',
    })
    expect(error.errorType).toBe('UnsupportedAdapterError')
  })
})

describe('ContextMismatchError', () => {
  it('should be thrown when too few contexts are provided', () => {
    // Same chain adapter requires context, but we provide none
    // Using a real same-chain fill selector
    const sameChainFillSelector = '0x604f2d24' // sameChain fill selector
    const sameChainAdapterCall =
      `${sameChainFillSelector}${'00'.repeat(100)}` as const

    const routeClaimData = encodeFunctionData({
      abi: routerAbi,
      functionName: 'routeClaim',
      args: [
        [], // empty relayer contexts - should cause error
        [sameChainAdapterCall], // same chain adapter needs context
      ],
    })

    expect(() =>
      replaceRepaymentDestinations(
        ROUTER_ADDRESS_DEV,
        routeClaimData,
        { address: parseAddress('0xdead00000000000000000000000000000000beef') },
        devConfig,
      ),
    ).toThrow(ContextMismatchError)
  })

  it('should have correct context fields when too few contexts', () => {
    const error = new ContextMismatchError({
      expected: 3,
      actual: 1,
      adapterCalls: [
        { name: 'sameChain:fill', expectsContext: true },
        { name: 'across:fill', expectsContext: true },
      ],
    })

    expect(error.context.expected).toBe(3)
    expect(error.context.actual).toBe(1)
    expect(error.message).toContain('Expected 3')
    expect(error.message).toContain('1 were provided')
  })

  it('should have correct message when too many contexts', () => {
    const error = new ContextMismatchError({
      expected: 1,
      actual: 3,
      adapterCalls: [{ name: 'sameChain:fill', expectsContext: true }],
    })

    expect(error.message).toContain('More contexts were provided')
    expect(error.message).toContain('(3)')
    expect(error.message).toContain('(1)')
  })
})

describe('UnsupportedRouteCallError', () => {
  it('should be thrown for unsupported router function', () => {
    // Create calldata for a function that exists but isn't a route call
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

  it('should have correct context fields', () => {
    const error = new UnsupportedRouteCallError({
      functionName: 'someUnsupportedFunction',
    })

    expect(error.context).toEqual({ functionName: 'someUnsupportedFunction' })
    expect(error.errorType).toBe('UnsupportedRouteCallError')
    expect(error.message).toContain('someUnsupportedFunction')
  })
})

describe('UnsupportedDestinationError', () => {
  it('should be thrown for unrecognized target address', () => {
    const randomAddress = parseAddress(
      '0x1234567890123456789012345678901234567890',
    )

    expect(() =>
      replaceRepaymentDestinations(
        randomAddress,
        '0x',
        { address: parseAddress('0xdead00000000000000000000000000000000beef') },
        devConfig,
      ),
    ).toThrow(UnsupportedDestinationError)
  })

  it('should have correct context fields', () => {
    const error = new UnsupportedDestinationError({
      address: '0x1234567890123456789012345678901234567890',
    })

    expect(error.context).toEqual({
      address: '0x1234567890123456789012345678901234567890',
    })
    expect(error.errorType).toBe('UnsupportedDestinationError')
  })
})

describe('InvalidAddressError', () => {
  it('should be thrown for invalid ethereum address', () => {
    expect(() => parseAddress('not-an-address')).toThrow(InvalidAddressError)
    expect(() => parseAddress('0x123')).toThrow(InvalidAddressError)
    expect(() => parseAddress('')).toThrow(InvalidAddressError)
  })

  it('should have correct context fields', () => {
    const error = new InvalidAddressError({ value: 'bad-address' })

    expect(error.context).toEqual({ value: 'bad-address' })
    expect(error.errorType).toBe('InvalidAddressError')
    expect(error.message).toContain('bad-address')
  })
})

describe('Type guards', () => {
  it('isRelayerError returns true for RelayerError instances', () => {
    const relayerError = new RelayerError({ message: 'test' })
    const unsupportedAdapterError = new UnsupportedAdapterError({
      selector: '0xdeadbeef',
      index: 0,
      functionName: 'test',
    })
    const contextMismatchError = new ContextMismatchError({
      expected: 1,
      actual: 2,
      adapterCalls: [],
    })

    expect(isRelayerError(relayerError)).toBe(true)
    expect(isRelayerError(unsupportedAdapterError)).toBe(true)
    expect(isRelayerError(contextMismatchError)).toBe(true)
  })

  it('isRelayerError returns false for plain Error', () => {
    const plainError = new Error('plain error')
    const typeError = new TypeError('type error')

    expect(isRelayerError(plainError)).toBe(false)
    expect(isRelayerError(typeError)).toBe(false)
    expect(isRelayerError(null)).toBe(false)
    expect(isRelayerError(undefined)).toBe(false)
    expect(isRelayerError('string error')).toBe(false)
    expect(isRelayerError({ message: 'object' })).toBe(false)
  })

  it('isValidationError correctly identifies validation errors', () => {
    const invalidAddressError = new InvalidAddressError({ value: 'bad' })
    const contextMismatchError = new ContextMismatchError({
      expected: 1,
      actual: 2,
      adapterCalls: [],
    })
    const unsupportedAdapterError = new UnsupportedAdapterError({
      selector: '0x00000000',
      index: 0,
      functionName: 'test',
    })
    const plainError = new Error('plain')

    expect(isValidationError(invalidAddressError)).toBe(true)
    expect(isValidationError(contextMismatchError)).toBe(true)
    expect(isValidationError(unsupportedAdapterError)).toBe(false)
    expect(isValidationError(plainError)).toBe(false)
    expect(isValidationError(null)).toBe(false)
  })
})

describe('RelayerError base class', () => {
  it('should have correct default values', () => {
    const error = new RelayerError({ message: 'test message' })

    expect(error.message).toBe('test message')
    expect(error.context).toEqual({})
    expect(error.errorType).toBe('RelayerError')
    expect(error.name).toBe('RelayerError')
  })

  it('should accept custom context and errorType', () => {
    const error = new RelayerError({
      message: 'custom error',
      context: { key: 'value', nested: { a: 1 } },
      errorType: 'CustomError',
    })

    expect(error.message).toBe('custom error')
    expect(error.context).toEqual({ key: 'value', nested: { a: 1 } })
    expect(error.errorType).toBe('CustomError')
    expect(error.name).toBe('CustomError')
  })

  it('should be an instance of Error', () => {
    const error = new RelayerError({ message: 'test' })
    expect(error instanceof Error).toBe(true)
  })
})
