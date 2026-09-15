import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Project } from '@/entities/project'

import { ProjectDetailHeader } from './ProjectDetailHeader'

const project: Project = {
  id: 'project-1',
  workspaceId: 'workspace-1',
  name: '2026 브랜드 리뉴얼',
  description: '브랜드 아이덴티티 전면 개편을 위한 프로젝트예요',
  creatorId: 'user-1',
  creator: { id: 'user-1', name: '김민지' },
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T03:00:00.000Z',
}

function renderHeader(
  overrides: Partial<React.ComponentProps<typeof ProjectDetailHeader>> = {},
) {
  const props = {
    project,
    canManage: true,
    onBack: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  }

  render(<ProjectDetailHeader {...props} />)
  return props
}

describe('ProjectDetailHeader', () => {
  it('Breadcrumb, 제목, 설명, 생성자를 보여준다', () => {
    renderHeader()

    expect(screen.getByRole('link', { name: '프로젝트' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '2026 브랜드 리뉴얼' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('브랜드 아이덴티티 전면 개편을 위한 프로젝트예요'),
    ).toBeInTheDocument()
    expect(screen.getByText('생성자 김민지')).toBeInTheDocument()
  })

  it('설명이 없으면 설명 영역을 렌더링하지 않는다', () => {
    renderHeader({ project: { ...project, description: null } })

    expect(
      screen.queryByText('브랜드 아이덴티티 전면 개편을 위한 프로젝트예요'),
    ).not.toBeInTheDocument()
  })

  it('뒤로가기 버튼과 Breadcrumb 링크가 onBack을 호출한다', async () => {
    const props = renderHeader()

    await userEvent.click(
      screen.getByRole('button', { name: '프로젝트 목록으로' }),
    )
    expect(props.onBack).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('link', { name: '프로젝트' }))
    expect(props.onBack).toHaveBeenCalledTimes(2)
  })

  it('관리 권한이 없으면 프로젝트 메뉴를 렌더링하지 않는다', () => {
    renderHeader({ canManage: false })

    expect(
      screen.queryByRole('button', { name: '2026 브랜드 리뉴얼 메뉴' }),
    ).not.toBeInTheDocument()
  })

  it('메뉴에서 수정과 삭제를 호출한다', async () => {
    const props = renderHeader()

    await userEvent.click(
      screen.getByRole('button', { name: '2026 브랜드 리뉴얼 메뉴' }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: '수정' }))
    expect(props.onEdit).toHaveBeenCalled()

    await userEvent.click(
      screen.getByRole('button', { name: '2026 브랜드 리뉴얼 메뉴' }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: '삭제' }))
    expect(props.onDelete).toHaveBeenCalled()
  })
})
