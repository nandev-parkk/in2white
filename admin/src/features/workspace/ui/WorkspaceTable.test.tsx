import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { AdminWorkspaceListItem } from '@/entities/workspace'

import { WorkspaceTable } from './WorkspaceTable'

const workspaces: AdminWorkspaceListItem[] = [
  {
    id: 'workspace-1',
    name: '디자인팀',
    isDefault: false,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-21T00:00:00.000Z',
    owner: { id: 'user-1', name: '김하나', email: 'hana@in2white.team' },
    memberCount: 3,
    projectCount: 2,
  },
  {
    id: 'workspace-2',
    name: '김하나의 워크스페이스',
    isDefault: true,
    createdAt: '2026-09-19T00:00:00.000Z',
    updatedAt: '2026-09-19T00:00:00.000Z',
    owner: { id: 'user-1', name: '김하나', email: 'hana@in2white.team' },
    memberCount: 1,
    projectCount: 0,
  },
]

describe('WorkspaceTable', () => {
  it('열 머리글과 워크스페이스 정보를 보여준다', () => {
    render(<WorkspaceTable workspaces={workspaces} onSelect={vi.fn()} />)

    expect(
      screen.getByRole('columnheader', { name: '이름' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: '소유자' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: '멤버' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: '프로젝트' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: '생성일' }),
    ).toBeInTheDocument()

    expect(screen.getAllByText('hana@in2white.team')).toHaveLength(2)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  /* 기본 워크스페이스는 이름 변경·삭제가 막혀 있다. 목록에서 구분해야 헛클릭이 줄어든다. */
  it('기본 워크스페이스를 구분해서 보여준다', () => {
    render(<WorkspaceTable workspaces={workspaces} onSelect={vi.fn()} />)

    expect(screen.getByText('기본')).toBeInTheDocument()
  })

  it('이름을 누르면 해당 워크스페이스를 선택한다', async () => {
    const onSelect = vi.fn()
    render(<WorkspaceTable workspaces={workspaces} onSelect={onSelect} />)

    await userEvent.click(screen.getByRole('button', { name: '디자인팀' }))

    expect(onSelect).toHaveBeenCalledWith(workspaces[0])
  })
})
