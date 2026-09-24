import { describe, expect, it } from 'vitest'
import { cn } from '@/shared/lib/utils'

describe('디자인 토큰 클래스 병합', () => {
  it('색상 변경이 글자 크기를 제거하지 않고 동일 속성만 덮어쓴다', () => {
    expect(
      cn('text-heading1 text-foreground-strong', 'text-status-danger'),
    ).toBe('text-heading1 text-status-danger')
    expect(cn('text-body', 'text-caption', { hidden: false })).toBe(
      'text-caption',
    )
  })
})
