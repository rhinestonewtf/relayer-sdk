import { type Address, isAddress } from 'viem'
import { InvalidAddressError } from './errors'
import type { EthAddress } from './types'

/**
 * Validates and normalizes an address string to an EthAddress.
 * Lowercases the address for consistent comparison.
 *
 * @param value - The address string to parse
 * @returns The normalized EthAddress
 * @throws Error if the address is invalid
 */
export function parseAddress(value: Address | string): EthAddress {
  if (!isAddress(value, { strict: false })) {
    throw new InvalidAddressError({ value })
  }
  return value.toLowerCase() as EthAddress
}
