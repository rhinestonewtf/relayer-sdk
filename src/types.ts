import type { Address } from 'viem'

declare const __brand: unique symbol

/**
 * Internal branded Ethereum address type.
 * Lowercase-normalized and intersects with viem's Address type.
 * @internal
 */
export type EthAddress = Address & { [__brand]: 'EthAddress' }

/**
 * Where the relayer wants to be repaid.
 *
 * - `address` — the repayment recipient address.
 * - `chain` — override the repayment chain. When omitted, each repayment
 *   entry preserves its original chain (e.g., Across tuples keep their
 *   per-deposit origin chains). Pass explicitly to redirect all repayments
 *   to a single chain.
 */
export type RepaymentDestination = {
  address: Address
  chain?: number
}

/**
 * Contract addresses required to identify router vs intent-executor calls.
 * When omitted from `replaceRepaymentDestinations`, defaults to production
 * addresses from `@rhinestone/shared-configs`.
 */
export type RebalancingConfig = {
  routerAddress: Address
  intentExecutorAddress: Address
}

/**
 * Internal version of RepaymentDestination with normalized addresses.
 * @internal
 */
export type InternalRepaymentDestination = {
  address: EthAddress
  chain?: number
}
