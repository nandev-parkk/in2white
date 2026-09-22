import { act, render, screen } from '@testing-library/react'
import { DelayedLoading, LoadingState } from './loading-state'

afterEach(() => vi.useRealTimers())

it('300ms 전에는 숨기고 이후에만 로딩을 안내한다', () => {
  vi.useFakeTimers()
  render(<LoadingState label="프로젝트를 불러오는 중" />)
  act(() => vi.advanceTimersByTime(299))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  act(() => vi.advanceTimersByTime(1))
  expect(screen.getByRole('status')).toHaveTextContent('프로젝트를 불러오는 중')
})

it('빠른 완료 후 타이머를 정리하고 다음 로딩은 처음부터 기다린다', () => {
  vi.useFakeTimers()
  const { rerender } = render(<LoadingState label="로딩" />)
  act(() => vi.advanceTimersByTime(100))
  rerender(<p>결과</p>)
  expect(vi.getTimerCount()).toBe(0)
  act(() => vi.advanceTimersByTime(500))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  rerender(<LoadingState label="로딩" />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  act(() => vi.advanceTimersByTime(300))
  expect(screen.getByRole('status')).toBeInTheDocument()
  rerender(<p>결과</p>)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('연속 편집기 로딩은 같은 시작 시간을 사용해 다시 숨겨지지 않는다', () => {
  vi.useFakeTimers()
  const startedAt = Date.now()
  const first = render(<LoadingState label="문서 조회" startedAt={startedAt} />)
  act(() => vi.advanceTimersByTime(300))
  first.unmount()
  render(<LoadingState label="편집기 준비" startedAt={startedAt} />)
  expect(screen.getByRole('status')).toHaveTextContent('편집기 준비')
})

it('스켈레톤 영역은 유지하지만 빠른 요청에서는 보이거나 안내되지 않는다', () => {
  vi.useFakeTimers()
  render(
    <DelayedLoading className="min-h-64">
      <div role="status" aria-label="멤버 불러오는 중">
        스켈레톤
      </div>
    </DelayedLoading>,
  )
  expect(screen.getByText('스켈레톤')).not.toBeVisible()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  act(() => vi.advanceTimersByTime(300))
  expect(screen.getByRole('status')).toBeVisible()
})
