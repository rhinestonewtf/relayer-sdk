---
"@rhinestone/relayer-sdk": patch
---

Recognise the SwapAdapter's `handleFill_swapAdapter_exactIn` and
`handleFill_swapAdapter_exactOut` in route fills. A deferred destination swap's
child fill no longer throws `UnsupportedAdapterError`; the SwapAdapter takes no
relayer context, so its call passes through unchanged.
