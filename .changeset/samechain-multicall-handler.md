---
"@rhinestone/relayer-sdk": minor
---

Leave a relayer context naming the multicall handler in place. An EOA same-chain
fill with destination ops sends the user's input to the multicall handler, which
pays the recipient; rewriting that context to the repayment address moved the
input to the relayer and reverted the fill. `RebalancingConfig` requires
`multicallHandlerAddress`; without a config the production handler applies.
