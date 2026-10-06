import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Project } from '@/entities/project'

import { ProjectCard } from './ProjectCard'

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

describe('ProjectCard', () => {
  it('프로젝트 정보와 생성자 메타데이터를 표시한다', () => {
    render(
      <ProjectCard
        project={projectFixture}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('heading', { name: projectFixture.name }),
    ).toBeInTheDocument()
    expect(screen.getByText(projectFixture.description!)).toBeInTheDocument()
    expect(screen.getByText('김민지')).toBeInTheDocument()
    expect(screen.getByText(/생성일 2026\.01\.10/)).toBeInTheDocument()
    expect(screen.getByText(/수정일/)).toBeInTheDocument()

    const card = screen.getByRole('article')
    expect(card).toHaveClass('border-border')
    expect(card).toHaveClass('min-h-[204px]')
    expect(card).not.toHaveClass('h-[204px]')
    expect(screen.getByText(/수정일/).parentElement?.parentElement).toHaveClass(
      'pb-2',
    )
    expect(screen.getByText('김민지').parentElement).toHaveClass(
      'border-t',
      'pt-2',
    )
  })

  it('더보기 메뉴에서 수정과 삭제를 선택할 수 있다', async () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(
      <ProjectCard
        project={projectFixture}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )

    await userEvent.click(
      screen.getByRole('button', { name: `${projectFixture.name} 메뉴` }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: '수정' }))
    expect(onEdit).toHaveBeenCalledWith(projectFixture)

    await userEvent.click(
      screen.getByRole('button', { name: `${projectFixture.name} 메뉴` }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: '삭제' }))
    expect(onDelete).toHaveBeenCalledWith(projectFixture)
  })

  it('제목 버튼의 클릭 영역을 카드 전체로 늘리고 메뉴를 위에 둔다', () => {
    render(
      <ProjectCard
        project={projectFixture}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
      />,
    )

    const card = screen.getByRole('article')
    const titleButton = screen.getByRole('button', {
      name: projectFixture.name,
    })
    const menuButton = screen.getByRole('button', {
      name: `${projectFixture.name} 메뉴`,
    })

    expect(card).toHaveClass('relative')
    expect(titleButton).toHaveClass('after:absolute', 'after:inset-0')
    expect(menuButton.parentElement).toHaveClass('relative', 'z-10')
  })

  it('hover 강조를 그림자가 아니라 테두리 색으로 표현한다', () => {
    render(
      <ProjectCard
        project={projectFixture}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const card = screen.getByRole('article')

    expect(card).toHaveClass('hover:border-border-strong')
    expect(card).toHaveClass(
      'transition-colors',
      'duration-150',
      'ease-out',
      'motion-reduce:transition-none',
    )
    // Tailwind가 테스트 파일도 스캔하므로 클래스명을 문자열로 적지 않는다.
    expect(card.className).not.toMatch(/shadow/)
  })

  it('포인터가 올라가면 카드를 살짝 들어 올린다', async () => {
    const user = userEvent.setup()
    render(
      <ProjectCard
        project={projectFixture}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const card = screen.getByRole('article')
    await user.hover(card)
    await waitFor(() =>
      expect(card.style.transform).toContain('translateY(-2px)'),
    )
  })
})
