import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CanvasTopBar } from './canvas-top-bar'

it('빈 더 보기 버튼 없이 참여자 아바타를 표시하고 참여자 변경을 반영한다', async () => {
  const users = [
    { id: 'me', name: '김민지', presenceIndex: 1 },
    { id: 'other', name: '박서연', presenceIndex: 2 },
    { id: 'third', name: '이준호', presenceIndex: 3 },
    { id: 'fourth', name: '최지은', presenceIndex: 4 },
  ]
  const { rerender } = render(
    <CanvasTopBar title="문서" saveStatus="saved" users={users} />,
  )
  expect(
    screen.queryByRole('button', { name: '더 보기' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: '김민지' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '박서연' })).toBeInTheDocument()
  expect(screen.getByText('+1')).toBeInTheDocument()

  rerender(<CanvasTopBar title="문서" saveStatus="saved" users={[users[0]]} />)
  expect(screen.getByRole('img', { name: '김민지' })).toBeInTheDocument()
  await waitFor(() =>
    expect(
      screen.queryByRole('img', { name: '박서연' }),
    ).not.toBeInTheDocument(),
  )
  expect(screen.queryByText('+1')).not.toBeInTheDocument()
})

describe('저장 상태 배지', () => {
  const cases = [
    { status: 'saved', label: '저장 완료', semantic: 'success' },
    { status: 'saving', label: '저장 중', semantic: 'neutral' },
    { status: 'connecting', label: '연결 중', semantic: 'neutral' },
    { status: 'disconnected', label: '동기화가 끊겼어요', semantic: 'danger' },
    { status: 'error', label: '저장 상태 확인 필요', semantic: 'danger' },
  ] as const

  it.each(cases)(
    '$status 상태를 $semantic 배지와 $label 라벨로 표시한다',
    ({ status, label, semantic }) => {
      const { container } = render(
        <CanvasTopBar title="문서" saveStatus={status} />,
      )

      const badge = container.querySelector('[data-slot="badge"]')
      expect(badge).not.toBeNull()
      expect(badge).toHaveAttribute('data-semantic', semantic)
      expect(badge).toHaveTextContent(label)
    },
  )

  it.each(cases)('$status 상태에서 저장됨 문구를 쓰지 않는다', ({ status }) => {
    const { container } = render(
      <CanvasTopBar title="문서" saveStatus={status} />,
    )

    expect(screen.queryByText('저장됨')).not.toBeInTheDocument()
    expect(container.textContent).not.toContain('저장됨')
  })

  it.each(cases)(
    '$status 상태 배지만 접근성 트리에 라벨을 알린다',
    ({ status, label }) => {
      const { container } = render(
        <CanvasTopBar title="문서" saveStatus={status} />,
      )

      const badge = screen.getByRole('status')
      expect(badge).toHaveAttribute('data-slot', 'badge')
      expect(badge).toHaveAttribute('aria-live', 'polite')
      expect(badge).toHaveTextContent(label)

      const icon = container.querySelector('[data-slot="badge"] svg')
      expect(icon).not.toBeNull()
      expect(icon).toHaveAttribute('aria-hidden', 'true')
    },
  )

  it('saveStatus가 없으면 배지를 렌더하지 않는다', () => {
    const { container } = render(<CanvasTopBar title="문서" />)

    expect(container.querySelector('[data-slot="badge"]')).toBeNull()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
