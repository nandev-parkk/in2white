import { describe, expect, it } from 'vitest'

import { formatCreatedAt, formatUpdatedAt } from './resource-date'

describe('resource-date', () => {
  it('생성일을 yyyy.MM.dd로 표기한다', () => {
    expect(formatCreatedAt('2026-01-12T00:00:00.000Z')).toBe('2026.01.12')
  })

  it('잘못된 값은 하이픈으로 표기한다', () => {
    expect(formatCreatedAt('not-a-date')).toBe('-')
    expect(formatUpdatedAt('not-a-date')).toBe('-')
  })

  it('수정일을 한국어 상대 시각으로 표기한다', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000)

    expect(formatUpdatedAt(threeHoursAgo.toISOString())).toContain('전')
  })
})
