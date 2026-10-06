import { describe, expect, it } from 'vitest'
import { queryClient } from './query-client'

const retry = queryClient.getDefaultOptions().queries?.retry

function shouldRetry(error: unknown) {
  if (typeof retry === 'function') return retry(0, error as Error)
  return typeof retry === 'number' && retry > 0
}

describe('query rate-limit retry', () => {
  it('does not retry a 429 response', () => {
    expect(shouldRetry({ isAxiosError: true, response: { status: 429 } })).toBe(
      false,
    )
  })

  it('keeps one retry for other transient failures', () => {
    expect(shouldRetry({ isAxiosError: true, response: { status: 503 } })).toBe(
      true,
    )
  })
})
