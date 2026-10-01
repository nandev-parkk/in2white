import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { listUsersRequest } from '@/entities/user'
import type { AdminWorkspaceMember } from '@/entities/workspace'

import { WorkspaceMemberAddDialog } from './WorkspaceMemberAddDialog'

vi.mock('@/entities/user', () => ({ listUsersRequest: vi.fn() }))

const existingMember: AdminWorkspaceMember = {
  userId: 'user-1',
  name: '김하나',
  email: 'hana@in2white.team',
  deactivatedAt: null,
  role: 'owner',
  joinedAt: '2026-09-20T00:00:00.000Z',
}

function candidates() {
  return {
    users: [
      {
        id: 'user-1',
        name: '김하나',
        email: 'hana@in2white.team',
        deactivatedAt: null,
        createdAt: '2026-09-20T00:00:00.000Z',
        workspaceCount: 2,
      },
      {
        id: 'user-2',
        name: '이두리',
        email: 'duri@in2white.team',
        deactivatedAt: null,
        createdAt: '2026-09-21T00:00:00.000Z',
        workspaceCount: 1,
      },
    ],
    pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
  }
}

function renderDialog(onSubmit = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceMemberAddDialog
        open
        members={[existingMember]}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />
    </QueryClientProvider>,
  )

  return { onSubmit }
}

describe('WorkspaceMemberAddDialog', () => {
  beforeEach(() => {
    vi.mocked(listUsersRequest).mockReset()
  })

  /* 이미 멤버인 사용자를 보내면 409다. 목록에서 미리 막아야 같은 실수를 반복하지 않는다. */
  it('검색 결과를 보여주고 이미 멤버인 사용자는 고를 수 없다', async () => {
    vi.mocked(listUsersRequest).mockResolvedValue(candidates())

    renderDialog()

    expect(
      await screen.findByRole('button', { name: /duri@in2white.team/ }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: /hana@in2white.team/ }),
    ).toBeDisabled()
    expect(screen.getByText('이미 멤버')).toBeInTheDocument()
  })

  it('검색어를 입력하면 검색 조건으로 다시 조회한다', async () => {
    vi.mocked(listUsersRequest).mockResolvedValue(candidates())

    renderDialog()
    await screen.findByRole('button', { name: /duri@in2white.team/ })

    await userEvent.type(screen.getByLabelText('추가할 사용자 검색'), '두리')

    await waitFor(() => {
      expect(listUsersRequest).toHaveBeenCalledWith(
        expect.objectContaining({ search: '두리', status: 'all' }),
      )
    })
  })

  it('사용자를 고르고 추가하면 해당 사용자 id를 전달한다', async () => {
    vi.mocked(listUsersRequest).mockResolvedValue(candidates())

    const { onSubmit } = renderDialog()

    await userEvent.click(
      await screen.findByRole('button', { name: /duri@in2white.team/ }),
    )
    await userEvent.click(screen.getByRole('button', { name: '추가' }))

    expect(onSubmit).toHaveBeenCalledWith('user-2')
  })

  it('고르기 전에는 추가할 수 없다', async () => {
    vi.mocked(listUsersRequest).mockResolvedValue(candidates())

    renderDialog()
    await screen.findByRole('button', { name: /duri@in2white.team/ })

    expect(screen.getByRole('button', { name: '추가' })).toBeDisabled()
  })
})
