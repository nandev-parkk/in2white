import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { AdminUserListItem } from '@/entities/user'

import { UserTable } from './UserTable'

const users: AdminUserListItem[] = [
  {
    id: 'user-1',
    name: 'Kim User',
    email: 'kim@example.com',
    deactivatedAt: null,
    createdAt: '2026-09-20T00:00:00.000Z',
    workspaceCount: 2,
  },
  {
    id: 'user-2',
    name: 'Lee Stopped',
    email: 'lee@example.com',
    deactivatedAt: '2026-09-30T00:00:00.000Z',
    createdAt: '2026-09-21T00:00:00.000Z',
    workspaceCount: 0,
  },
]

describe('UserTable', () => {
  it('열 머리글과 사용자 정보를 보여준다', () => {
    render(<UserTable users={users} onSelect={vi.fn()} />)

    expect(
      screen.getByRole('columnheader', { name: '이름' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: '이메일' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: '상태' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: '워크스페이스' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: '가입일' }),
    ).toBeInTheDocument()

    expect(screen.getByText('kim@example.com')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  /* 정지 계정을 목록에서 구분하지 못하면 어드민이 이미 막힌 계정을 다시 정지한다. */
  it('정지 여부를 상태로 구분해서 보여준다', () => {
    render(<UserTable users={users} onSelect={vi.fn()} />)

    expect(screen.getByText('활성')).toBeInTheDocument()
    expect(screen.getByText('정지')).toBeInTheDocument()
  })

  it('이름을 누르면 해당 사용자를 선택한다', async () => {
    const onSelect = vi.fn()
    render(<UserTable users={users} onSelect={onSelect} />)

    await userEvent.click(screen.getByRole('button', { name: 'Kim User' }))

    expect(onSelect).toHaveBeenCalledWith(users[0])
  })
})
