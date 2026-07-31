import type { Hex } from 'viem'

/**
 * Base error class for all relayer SDK errors.
 * Provides structured error information with context for debugging.
 */
export class RelayerError extends Error {
  private readonly _message: string
  private readonly _context: Record<string, unknown>
  private readonly _errorType: string

  constructor(params: {
    message: string
    context?: Record<string, unknown>
    errorType?: string
  }) {
    super(params.message)
    this._message = params.message
    this._context = params.context ?? {}
    this._errorType = params.errorType ?? 'RelayerError'
    this.name = this._errorType
  }

  override get message(): string {
    return this._message
  }

  get context(): Record<string, unknown> {
    return this._context
  }

  get errorType(): string {
    return this._errorType
  }
}

/**
 * Error thrown when an unknown adapter function selector is encountered.
 */
export class UnsupportedAdapterError extends RelayerError {
  constructor(params: {
    selector: Hex
    index: number
    functionName: string
  }) {
    super({
      message: `Unknown adapter call at index ${params.index}, selector: ${params.selector} for ${params.functionName}`,
      context: params,
      errorType: 'UnsupportedAdapterError',
    })
  }
}

/**
 * Error thrown when the number of relayer contexts doesn't match
 * the number of adapter calls that require them.
 */
export class ContextMismatchError extends RelayerError {
  constructor(params: {
    expected: number
    actual: number
    adapterCalls: Array<{ name: string; expectsContext: boolean }>
  }) {
    const message =
      params.expected > params.actual
        ? `Mismatch: Expected ${params.expected} relayer contexts but only ${params.actual} were provided`
        : `Mismatch: More contexts were provided (${params.actual}) than were consumed (${params.expected}) by the adapter calls`
    super({
      message,
      context: params,
      errorType: 'ContextMismatchError',
    })
  }
}

/**
 * Error thrown when an unsupported router function is called.
 */
export class UnsupportedRouteCallError extends RelayerError {
  constructor(params: { functionName: string }) {
    super({
      message: `Unsupported route function call: ${params.functionName}`,
      context: params,
      errorType: 'UnsupportedRouteCallError',
    })
  }
}

/**
 * Error thrown when the target address is not a recognized
 * router or intent executor address.
 */
export class UnsupportedDestinationError extends RelayerError {
  constructor(params: { address: string }) {
    super({
      message: `Unsupported destination address: ${params.address}`,
      context: params,
      errorType: 'UnsupportedDestinationError',
    })
  }
}

/**
 * Error thrown when an invalid Ethereum address is provided.
 */
export class InvalidAddressError extends RelayerError {
  constructor(params: { value: string }) {
    super({
      message: `Invalid Ethereum address: ${params.value}`,
      context: params,
      errorType: 'InvalidAddressError',
    })
  }
}

/**
 * Error thrown when an ERC-8021 attribution suffix is malformed.
 *
 * Raised before the suffix is appended to calldata we are about to sign: a
 * malformed suffix means either misattributed activity or, if a downstream
 * consumer splits it back off at the wrong boundary, corrupted calldata. Both
 * are worse than failing the action.
 */
export class InvalidAttributionSuffixError extends RelayerError {
  constructor(params: { reason: string; suffix?: Hex }) {
    super({
      message: `Invalid ERC-8021 attribution suffix: ${params.reason}`,
      context: params,
      errorType: 'InvalidAttributionSuffixError',
    })
  }
}

/**
 * Type guard to check if an error is a RelayerError.
 */
export function isRelayerError(err: unknown): err is RelayerError {
  return err instanceof RelayerError
}

/**
 * Type guard to check if an error is a validation error
 * (InvalidAddressError or ContextMismatchError).
 */
export function isValidationError(err: unknown): boolean {
  return (
    err instanceof InvalidAddressError || err instanceof ContextMismatchError
  )
}
