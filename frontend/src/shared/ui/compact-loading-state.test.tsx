import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CompactLoadingState } from './compact-loading-state'

describe('CompactLoadingState', () => {
  it('내용을 사용 가능한 영역의 수평·수직 중앙에 배치한다', () => {
    render(
      <CompactLoadingState
        title="사용자 불러오는 중"
        description="잠시만 기다려주세요"
      />,
    )

    const title = screen.getByText('사용자 불러오는 중')
    expect(title.parentElement).toHaveClass('items-center', 'justify-center')
    expect(screen.getByText('잠시만 기다려주세요')).toBeInTheDocument()
  })

  it('래퍼 하나만 상태를 알리고 스피너는 보조기기에서 감춘다', () => {
    render(<CompactLoadingState title="사용자 불러오는 중" />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('사용자 불러오는 중')
    expect(status.querySelector('[data-slot="spinner"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })
})
