import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CompactEmptyState } from './compact-empty-state'

describe('CompactEmptyState', () => {
  it('내용을 사용 가능한 영역의 수평·수직 중앙에 배치한다', () => {
    render(
      <CompactEmptyState
        icon={<span aria-hidden="true">?</span>}
        title="검색 결과가 없어요"
        description="다른 이름으로 검색해보세요"
      />,
    )

    const title = screen.getByText('검색 결과가 없어요')
    expect(title.parentElement).toHaveClass('items-center', 'justify-center')
  })
})
