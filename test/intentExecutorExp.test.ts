import { contractAddressesDev, routerAbi } from '@rhinestone/shared-configs'
import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  type Hex,
} from 'viem'
import { describe, expect, it } from 'vitest'
import {
  adapters,
  functionSelectorToAdapterCallMap,
  NoRelayerContext,
  type RebalancingConfig,
  replaceRepaymentDestinations,
  SameChainRepaymentsRelayerContext,
  UnsupportedAdapterError,
} from '../src'
import { parseAddress } from '../src/address'
import { intentExecutorExpAbi } from '../src/intentExecutorExp'
import { rewriteStandaloneExecutorCall } from '../src/standaloneExecutor'

const ROUTER_ADDRESS_DEV = parseAddress(contractAddressesDev['*'].router)
const devConfig: RebalancingConfig = {
  routerAddress: ROUTER_ADDRESS_DEV,
  intentExecutorAddress: parseAddress(contractAddressesDev['*'].intentExecutor),
  multicallHandlerAddress: parseAddress(
    contractAddressesDev['*'].multicallHandler,
  ),
}

const ORIGINAL_RECIPIENT = parseAddress(
  '0x1111111111111111111111111111111111111111',
)
const NEW_RECIPIENT = parseAddress('0x2222222222222222222222222222222222222222')

const singleChainOpsExp = {
  account: parseAddress('0x3333333333333333333333333333333333333333'),
  nonce: 1n,
  expires: 1_900_000_000n,
  ops: { data: '0xdeadbeef' as Hex },
  signature: '0xabcd' as Hex,
}

const multiChainOpsExp = {
  account: parseAddress('0x3333333333333333333333333333333333333333'),
  expires: 1_900_000_000n,
  chainIndex: 0n,
  otherChains: [`0x${'00'.repeat(32)}`] as Hex[],
  nonce: 1n,
  ops: { data: '0xdeadbeef' as Hex },
  signature: '0xabcd' as Hex,
}

const gasRefund = {
  token: parseAddress('0x4444444444444444444444444444444444444444'),
  exchangeRate: 1_000_000n,
  overhead: 21_000n,
}

function routeFill(relayerContexts: Hex[], adapterCalls: Hex[]): Hex {
  return encodeFunctionData({
    abi: routerAbi,
    functionName: 'optimized_routeFill921336808',
    args: [
      relayerContexts,
      encodeAbiParameters([{ type: 'bytes[]' }], [adapterCalls]),
      '0xdeadbeef',
    ],
  })
}

function decodedRelayerContexts(data: Hex): readonly Hex[] {
  const { args } = decodeFunctionData({ abi: routerAbi, data })
  return args![0] as readonly Hex[]
}

describe('IntentExecutorExpAdapter', () => {
  it.each([
    ['0xe3859d16', 'handleFill_intentExecutor_executeSinglechainOpsExp'],
    ['0xcec0df7f', 'handleFill_intentExecutor_executeMultichainOpsExp'],
  ] as const)('resolves %s to %s without relayer context', (selector, functionName) => {
    expect(functionSelectorToAdapterCallMap[selector]).toEqual({
      adapterName: 'intentExecutorExpAbi',
      functionName,
      rewriteRelayerContext: NoRelayerContext,
    })
  })

  it.each([
    'handleFill_intentExecutor_executeSinglechainOpsExp',
    'handleFill_intentExecutor_executeMultichainOpsExp',
  ] as const)('passes a %s route fill through unchanged', (functionName) => {
    const fill = routeFill(
      [],
      [
        encodeFunctionData({
          abi: adapters.intentExecutorExpAbi,
          functionName,
          args: ['0x1234'],
        }),
      ],
    )

    expect(
      replaceRepaymentDestinations(
        ROUTER_ADDRESS_DEV,
        fill,
        { address: NEW_RECIPIENT },
        devConfig,
      ),
    ).toEqual(fill)
  })
})

describe('IntentExecutorExpAdapterGasRefund', () => {
  it.each([
    [
      '0xc9d9e747',
      'handleFill_intentExecutor_executeSinglechainOpsExp_gasRefund',
    ],
    [
      '0x82802218',
      'handleFill_intentExecutor_executeMultichainOpsExp_gasRefund',
    ],
  ] as const)('resolves %s to %s with a packed-address relayer context', (selector, functionName) => {
    expect(functionSelectorToAdapterCallMap[selector]).toEqual({
      adapterName: 'intentExecutorExpWithGasRefundAbi',
      functionName,
      rewriteRelayerContext: SameChainRepaymentsRelayerContext,
    })
  })

  it.each([
    [
      'single-chain',
      encodeFunctionData({
        abi: adapters.intentExecutorExpWithGasRefundAbi,
        functionName:
          'handleFill_intentExecutor_executeSinglechainOpsExp_gasRefund',
        args: [singleChainOpsExp, gasRefund],
      }),
    ],
    [
      'multi-chain',
      encodeFunctionData({
        abi: adapters.intentExecutorExpWithGasRefundAbi,
        functionName:
          'handleFill_intentExecutor_executeMultichainOpsExp_gasRefund',
        args: [multiChainOpsExp, gasRefund],
      }),
    ],
  ] as const)('rewrites the 20-byte refund recipient of a %s fill', (_, adapterCall) => {
    const fill = routeFill(
      [encodePacked(['address'], [ORIGINAL_RECIPIENT])],
      [adapterCall],
    )

    const rewritten = replaceRepaymentDestinations(
      ROUTER_ADDRESS_DEV,
      fill,
      { address: NEW_RECIPIENT },
      devConfig,
    )

    expect(decodedRelayerContexts(rewritten)).toEqual([NEW_RECIPIENT])
  })
})

describe('Exp executor selector outside the adapter map', () => {
  it('throws UnsupportedAdapterError for the raw executeSinglechainOpsExp selector', () => {
    const fill = routeFill([], ['0x7f602dc3'])

    expect(() =>
      replaceRepaymentDestinations(
        ROUTER_ADDRESS_DEV,
        fill,
        { address: NEW_RECIPIENT },
        devConfig,
      ),
    ).toThrow(UnsupportedAdapterError)
  })
})

describe('rewriteStandaloneExecutorCall with Exp entrypoints', () => {
  const destination = { address: NEW_RECIPIENT }

  it.each([
    [
      '0xe4859670',
      encodeFunctionData({
        abi: intentExecutorExpAbi,
        functionName: 'executeSinglechainOpsExpWithGasRefund_ERC20',
        args: [singleChainOpsExp, gasRefund, ORIGINAL_RECIPIENT],
      }),
    ],
    [
      '0x96b5b50c',
      encodeFunctionData({
        abi: intentExecutorExpAbi,
        functionName: 'executeSinglechainOpsExpWithGasRefund_ETH',
        args: [singleChainOpsExp, 21_000n, ORIGINAL_RECIPIENT],
      }),
    ],
    [
      '0x92e3ada1',
      encodeFunctionData({
        abi: intentExecutorExpAbi,
        functionName: 'executeMultichainOpsExpWithGasRefund_ERC20',
        args: [multiChainOpsExp, gasRefund, ORIGINAL_RECIPIENT],
      }),
    ],
    [
      '0x929084c7',
      encodeFunctionData({
        abi: intentExecutorExpAbi,
        functionName: 'executeMultichainOpsExpWithGasRefund_ETH',
        args: [multiChainOpsExp, 21_000n, ORIGINAL_RECIPIENT],
      }),
    ],
  ] as const)('rewrites only the gasRefundRecipient of %s', (selector, data) => {
    expect(data.slice(0, 10)).toBe(selector)

    const rewritten = rewriteStandaloneExecutorCall(data, destination)
    const original = decodeFunctionData({ abi: intentExecutorExpAbi, data })
    const decoded = decodeFunctionData({
      abi: intentExecutorExpAbi,
      data: rewritten,
    })

    expect(decoded.functionName).toBe(original.functionName)
    expect(decoded.args.slice(0, -1)).toEqual(original.args.slice(0, -1))
    expect(decoded.args.at(-1)).toBe(NEW_RECIPIENT)
  })

  it.each([
    [
      '0x7f602dc3',
      encodeFunctionData({
        abi: intentExecutorExpAbi,
        functionName: 'executeSinglechainOpsExp',
        args: [singleChainOpsExp],
      }),
    ],
    [
      '0xfba85265',
      encodeFunctionData({
        abi: intentExecutorExpAbi,
        functionName: 'executeMultichainOpsExp',
        args: [multiChainOpsExp],
      }),
    ],
  ] as const)('returns %s unchanged', (selector, data) => {
    expect(data.slice(0, 10)).toBe(selector)
    expect(rewriteStandaloneExecutorCall(data, destination)).toBe(data)
  })
})
