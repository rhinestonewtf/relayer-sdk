---
"@rhinestone/relayer-sdk": patch
---

Recognise IntentExecutorExpAdapter and IntentExecutorExpAdapterGasRefund route fills and the executor's `execute*OpsExpWithGasRefund_*` entrypoints, rewriting the gas-refund recipient as for the non-expiring ones.
