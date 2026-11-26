---
"@rhinestone/relayer-sdk": patch
---

Recognise the expiring standalone intent fills. Route fills through the
IntentExecutorExpAdapter (`handleFill_intentExecutor_executeSinglechainOpsExp`,
`handleFill_intentExecutor_executeMultichainOpsExp`) no longer throw
`UnsupportedAdapterError` and pass through unchanged, as the adapter takes no
relayer context. Fills through the IntentExecutorExpAdapterGasRefund have their
20-byte gas-refund recipient context rewritten to the repayment address. Direct
calls to the executor's `execute*OpsExpWithGasRefund_*` entrypoints have their
`gasRefundRecipient` rewritten, as the non-expiring ones do.
