import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Project } from '@/entities/project'

import { ProjectTable } from './ProjectTable'

const projectFixture: Project = {
  id: 'project-1',
  workspaceId: 'workspace-1',
  name: '2026 브랜드 리뉴얼',
  description: '브랜드 아이덴티티와 로고 시스템을 새로 정리해요',
  creatorId: 'user-1',
  creator: { id: 'user-1', name: '김민지' },
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
}

const secondProjectFixture: Project = {
  ...projectFixture,
  id: 'project-2',
  name: '온보딩 플로우 개선',
  creator: { id: 'user-2', name: '이서준' },
}

describe('ProjectTable', () => {
  it('프로젝트 목록을 주요 열과 함께 표시한다', () => {
    render(
      <ProjectTable
        projects={[projectFixture, secondProjectFixture]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()
    expect(table).toHaveClass('min-w-[720px]')
    expect(table.parentElement).toHaveClass('overflow-x-auto')
    expect(
      screen.getByRole('columnheader', { name: '이름' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: '생성자' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: '생성일' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: '수정일' }),
    ).toBeInTheDocument()
    expect(screen.getByText(projectFixture.name)).toBeInTheDocument()
    expect(screen.getByText(secondProjectFixture.name)).toBeInTheDocument()
  })

  it('행별 더보기 메뉴에서 프로젝트를 수정한다', async () => {
    const onEdit = vi.fn()
    render(
      <ProjectTable
        projects={[projectFixture]}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />,
    )

    await userEvent.click(
      screen.getByRole('button', { name: `${projectFixture.name} 메뉴` }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: '수정' }))

    expect(onEdit).toHaveBeenCalledWith(projectFixture)
  })
})
