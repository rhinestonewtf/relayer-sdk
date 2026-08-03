---
'@rhinestone/relayer-sdk': minor
---

`applyAttribution` no longer throws on a malformed suffix — it skips it and
returns the calldata unchanged.

Attribution is reporting; it must never be a precondition for filling an intent.
This function runs inside relayers we do not operate, so a bad suffix — which
could only come from a bug on the publishing side — must cost an attribution,
not a fill. The strictness was not protective either: a malformed suffix is inert
trailing calldata, so appending it is harmless, just useless.

`attributionGasOverhead` is gated on the same predicate, so the gas budgeted
always matches the bytes actually appended.

Callers wanting strictness can still call `assertValidAttributionSuffix`
directly; it is unchanged and still exported.
