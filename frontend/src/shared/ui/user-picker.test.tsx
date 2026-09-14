import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserPicker } from './user-picker'
const users = [
  { id: '1', name: '민지', email: 'minji@example.com' },
  { id: '2', name: '서준', email: 'seo@example.com', isMember: true },
]
it('키보드로 후보를 선택하고 기존 멤버는 실제로 비활성화한다', async () => {
  const onSelect = vi.fn()
  render(
    <UserPicker
      open
      onOpenChange={vi.fn()}
      users={users}
      onSelect={onSelect}
      searchValue=""
      onSearchChange={vi.fn()}
    />,
  )
  const candidate = screen.getByRole('button', { name: /민지/ })
  candidate.focus()
  await userEvent.keyboard('{Enter}')
  expect(onSelect).toHaveBeenCalledWith(users[0])
  expect(screen.getByRole('button', { name: /서준/ })).toBeDisabled()
})
it('로딩과 오류·재시도 및 후보 페이지 이동을 표시한다', async () => {
  const onRetry = vi.fn(),
    onPageChange = vi.fn()
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    users,
    onSelect: vi.fn(),
    searchValue: '',
    onSearchChange: vi.fn(),
    page: 1,
    totalPages: 2,
    onPageChange,
  }
  const { rerender } = render(<UserPicker {...props} loading />)
  expect(
    screen.getByRole('status', { name: '사용자 불러오는 중' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /민지/ })).not.toBeInTheDocument()
  rerender(
    <UserPicker {...props} error="검색하지 못했어요" onRetry={onRetry} />,
  )
  await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(onRetry).toHaveBeenCalledOnce()
  rerender(<UserPicker {...props} />)
  await userEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
  expect(onPageChange).toHaveBeenCalledWith(2)
})
it('로딩은 스켈레톤 셀로, 빈 결과는 공용 상태 컴포넌트로 표시한다', () => {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    users: [],
    onSelect: vi.fn(),
    onSearchChange: vi.fn(),
  }
  const { rerender } = render(<UserPicker {...props} searchValue="" loading />)
  const loading = screen.getByRole('status', { name: '사용자 불러오는 중' })
  expect(
    loading.querySelectorAll('[data-slot="skeleton-list-cell"]'),
  ).toHaveLength(5)
  expect(loading.querySelector('[data-slot="spinner"]')).toBeNull()

  rerender(<UserPicker {...props} searchValue="민지" />)
  const emptySearch = screen.getByTestId('user-picker-list')
  expect(
    emptySearch.querySelector('[data-slot="compact-empty-state"]'),
  ).toBeInTheDocument()
  expect(screen.getByText('검색 결과가 없어요')).toBeInTheDocument()
  expect(
    screen.getByText('다른 검색어로 다시 시도해보세요'),
  ).toBeInTheDocument()

  rerender(<UserPicker {...props} searchValue="" />)
  expect(screen.getByText('추가할 사용자가 없어요')).toBeInTheDocument()
})
