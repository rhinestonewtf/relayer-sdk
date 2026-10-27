---
"@rhinestone/relayer-sdk": patch
---

Leave a relayer context naming the multicall handler in place. An EOA same-chain
fill with destination ops sends the user's input to the multicall handler, which
pays the recipient; rewriting that context to the repayment address moved the
input to the relayer and reverted the fill. `RebalancingConfig` takes an optional
`multicallHandlerAddress`, defaulting to the production handler.
