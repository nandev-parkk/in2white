import { render, screen } from '@testing-library/react'
import { TriangleAlert } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import { ErrorState } from './error-state'

describe('ErrorState', () => {
  it('기본 아이콘으로 위험색 CircleAlert를 보여준다', () => {
    const { container } = render(<ErrorState title="불러오지 못했어요" />)

    const icon = container.querySelector('.lucide-circle-alert')

    expect(icon).not.toBeNull()
    expect(icon).toHaveClass('text-status-danger', 'size-8')
  })

  it('루트에 role="alert"를 부여해 실패를 즉시 알린다', () => {
    render(<ErrorState title="불러오지 못했어요" />)

    expect(screen.getByRole('alert')).toHaveTextContent('불러오지 못했어요')
  })

  it('제목과 기본 설명, 액션을 모두 렌더한다', () => {
    render(
      <ErrorState
        title="프로젝트를 불러오지 못했어요"
        action={<button type="button">다시 시도</button>}
      />,
    )

    expect(screen.getByText('프로젝트를 불러오지 못했어요')).toBeInTheDocument()
    expect(screen.getByText('잠시 후 다시 시도해보세요')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '다시 시도' }),
    ).toBeInTheDocument()
  })

  it('icon을 넘기면 기본 아이콘을 대체한다', () => {
    const { container } = render(
      <ErrorState
        title="불러오지 못했어요"
        icon={<TriangleAlert className="size-8" />}
      />,
    )

    expect(container.querySelector('.lucide-circle-alert')).toBeNull()
    expect(container.querySelector('.lucide-triangle-alert')).not.toBeNull()
  })

  it('size="compact"에서는 compact 레이아웃과 작은 아이콘을 쓴다', () => {
    const { container } = render(
      <ErrorState
        size="compact"
        title="워크스페이스를 불러오지 못했어요"
        action={<button type="button">다시 시도</button>}
      />,
    )

    expect(
      container.querySelector('[data-slot="compact-empty-state"]'),
    ).not.toBeNull()
    expect(container.querySelector('[data-slot="empty-state"]')).toBeNull()
    expect(container.querySelector('.lucide-circle-alert')).toHaveClass(
      'size-5',
    )
    expect(
      screen.getByRole('button', { name: '다시 시도' }),
    ).toBeInTheDocument()
  })
})
