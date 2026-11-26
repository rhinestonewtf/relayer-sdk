// compact-utils `IStandaloneIntentExpiryExecutor` and the IntentExecutorExpAdapter /
// IntentExecutorExpAdapterGasRefund Router adapters; @rhinestone/shared-configs
// does not ship these ABIs yet.

const operationComponents = [{ name: 'data', type: 'bytes' }] as const

const multiChainOpsExpComponents = [
  { name: 'account', type: 'address' },
  { name: 'expires', type: 'uint256' },
  { name: 'chainIndex', type: 'uint256' },
  { name: 'otherChains', type: 'bytes32[]' },
  { name: 'nonce', type: 'uint256' },
  { name: 'ops', type: 'tuple', components: operationComponents },
  { name: 'signature', type: 'bytes' },
] as const

const singleChainOpsExpComponents = [
  { name: 'account', type: 'address' },
  { name: 'nonce', type: 'uint256' },
  { name: 'expires', type: 'uint256' },
  { name: 'ops', type: 'tuple', components: operationComponents },
  { name: 'signature', type: 'bytes' },
] as const

const gasRefundComponents = [
  { name: 'token', type: 'address' },
  { name: 'exchangeRate', type: 'uint256' },
  { name: 'overhead', type: 'uint256' },
] as const

const executeWithGasRefundOutputs = [
  { name: 'account', type: 'address' },
  { name: 'nonce', type: 'uint256' },
] as const

export const intentExecutorExpAbi = [
  {
    type: 'function',
    name: 'executeMultichainOpsExp',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'signedOps',
        type: 'tuple',
        components: multiChainOpsExpComponents,
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'executeMultichainOpsExpWithGasRefund_ERC20',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'signedOps',
        type: 'tuple',
        components: multiChainOpsExpComponents,
      },
      { name: 'gasRefund', type: 'tuple', components: gasRefundComponents },
      { name: 'gasRefundRecipient', type: 'address' },
    ],
    outputs: executeWithGasRefundOutputs,
  },
  {
    type: 'function',
    name: 'executeMultichainOpsExpWithGasRefund_ETH',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'signedOps',
        type: 'tuple',
        components: multiChainOpsExpComponents,
      },
      { name: 'packedOverhead', type: 'uint256' },
      { name: 'gasRefundRecipient', type: 'address' },
    ],
    outputs: executeWithGasRefundOutputs,
  },
  {
    type: 'function',
    name: 'executeSinglechainOpsExp',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'signedOps',
        type: 'tuple',
        components: singleChainOpsExpComponents,
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'executeSinglechainOpsExpWithGasRefund_ERC20',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'signedOps',
        type: 'tuple',
        components: singleChainOpsExpComponents,
      },
      { name: 'gasRefund', type: 'tuple', components: gasRefundComponents },
      { name: 'gasRefundRecipient', type: 'address' },
    ],
    outputs: executeWithGasRefundOutputs,
  },
  {
    type: 'function',
    name: 'executeSinglechainOpsExpWithGasRefund_ETH',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'signedOps',
        type: 'tuple',
        components: singleChainOpsExpComponents,
      },
      { name: 'packedOverhead', type: 'uint256' },
      { name: 'gasRefundRecipient', type: 'address' },
    ],
    outputs: executeWithGasRefundOutputs,
  },
] as const

export const intentExecutorExpAdapterAbi = [
  {
    type: 'function',
    name: 'handleFill_intentExecutor_executeMultichainOpsExp',
    stateMutability: 'payable',
    inputs: [{ name: 'executorCalldata', type: 'bytes' }],
    outputs: [{ name: '', type: 'bytes4' }],
  },
  {
    type: 'function',
    name: 'handleFill_intentExecutor_executeSinglechainOpsExp',
    stateMutability: 'payable',
    inputs: [{ name: 'executorCalldata', type: 'bytes' }],
    outputs: [{ name: '', type: 'bytes4' }],
  },
] as const

export const intentExecutorExpAdapterGasRefundAbi = [
  {
    type: 'function',
    name: 'handleFill_intentExecutor_executeMultichainOpsExp_gasRefund',
    stateMutability: 'payable',
    inputs: [
      { name: 'ops', type: 'tuple', components: multiChainOpsExpComponents },
      { name: 'gasRefund', type: 'tuple', components: gasRefundComponents },
    ],
    outputs: [{ name: '', type: 'bytes4' }],
  },
  {
    type: 'function',
    name: 'handleFill_intentExecutor_executeSinglechainOpsExp_gasRefund',
    stateMutability: 'payable',
    inputs: [
      { name: 'ops', type: 'tuple', components: singleChainOpsExpComponents },
      { name: 'gasRefund', type: 'tuple', components: gasRefundComponents },
    ],
    outputs: [{ name: '', type: 'bytes4' }],
  },
] as const
