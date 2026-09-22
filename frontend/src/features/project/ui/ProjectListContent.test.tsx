import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Project } from '@/entities/project'

import { ProjectListContent } from './ProjectListContent'

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
  creatorId: 'user-2',
  creator: { id: 'user-2', name: '이서준' },
}

const mockUseProjects = vi.fn()
const mockUseCreateProject = vi.fn()
const mockUseUpdateProject = vi.fn()
const mockUseDeleteProject = vi.fn()

vi.mock('@/features/project', () => ({
  useProjects: (...args: unknown[]) => mockUseProjects(...args),
  useCreateProject: (...args: unknown[]) => mockUseCreateProject(...args),
  useUpdateProject: (...args: unknown[]) => mockUseUpdateProject(...args),
  useDeleteProject: (...args: unknown[]) => mockUseDeleteProject(...args),
}))

function projectQuery(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      projects: [projectFixture, secondProjectFixture],
      pagination: { page: 1, limit: 12, total: 2, totalPages: 1 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  }
}

function mutationResult() {
  return {
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }
}

describe('ProjectListContent', () => {
  afterEach(() => vi.useRealTimers())
  beforeEach(() => {
    mockUseProjects.mockReset()
    mockUseCreateProject.mockReset()
    mockUseUpdateProject.mockReset()
    mockUseDeleteProject.mockReset()
    mockUseProjects.mockReturnValue(projectQuery())
    mockUseCreateProject.mockReturnValue(mutationResult())
    mockUseUpdateProject.mockReturnValue(mutationResult())
    mockUseDeleteProject.mockReturnValue(mutationResult())
  })

  it('최초 로딩은 300ms 뒤 선택한 보기 형태로 표시한다', () => {
    vi.useFakeTimers()
    mockUseProjects.mockReturnValue(
      projectQuery({ data: undefined, isLoading: true }),
    )
    render(
      <ProjectListContent
        accessToken="token-1"
        workspaceId="workspace-1"
        userId="user-1"
      />,
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(
      document.querySelectorAll('[data-slot="resource-card-skeleton"]'),
    ).toHaveLength(6)
    act(() => vi.advanceTimersByTime(300))
    expect(
      screen.getByRole('status', { name: '프로젝트를 불러오는 중' }),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '목록 보기' }))
    expect(
      document.querySelectorAll('[data-slot="resource-card-skeleton"]'),
    ).toHaveLength(0)
    expect(screen.getAllByRole('row', { hidden: true })).toHaveLength(6)
    expect(screen.getByRole('status')).toBeVisible()
  })

  it('오래 기다린 오류에서 재시도하면 300ms 지연을 새로 시작한다', () => {
    vi.useFakeTimers()
    const retry = vi.fn(() =>
      mockUseProjects.mockReturnValue(
        projectQuery({ data: undefined, isLoading: true }),
      ),
    )
    mockUseProjects.mockReturnValue(
      projectQuery({ data: undefined, isError: true, refetch: retry }),
    )
    render(
      <ProjectListContent
        accessToken="token-1"
        workspaceId="workspace-1"
        userId="user-1"
        loadingStartedAt={Date.now() - 1000}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(299))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('status')).toBeVisible()
  })

  it('빈 검색을 지운 뒤에도 새 응답 전에는 이전 빈 상태를 유지한다', async () => {
    const empty = projectQuery({
      data: {
        projects: [],
        pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
      },
    })
    mockUseProjects.mockReturnValue(empty)
    render(
      <ProjectListContent
        accessToken="token-1"
        workspaceId="workspace-1"
        userId="user-1"
      />,
    )
    await userEvent.type(screen.getByRole('searchbox'), '없는 검색')
    expect(screen.getByText('검색 결과가 없어요')).toBeInTheDocument()
    mockUseProjects.mockReturnValue({
      ...empty,
      isPlaceholderData: true,
      isFetching: true,
    })
    await userEvent.click(screen.getByRole('button', { name: '검색어 지우기' }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByText('검색 결과가 없어요')).toBeInTheDocument()
    expect(screen.queryByText('아직 프로젝트가 없어요')).not.toBeInTheDocument()
  })

  it('프로젝트 목록과 기본 그리드 도구 모음을 표시한다', () => {
    render(
      <ProjectListContent
        accessToken="token-1"
        workspaceId="workspace-1"
        userId="user-1"
        workspaceRole="owner"
      />,
    )

    expect(
      screen.getByRole('heading', { name: '프로젝트' }),
    ).toBeInTheDocument()
    expect(screen.getByText(projectFixture.name)).toBeInTheDocument()
    expect(screen.getByText(secondProjectFixture.name)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '프로젝트 생성' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '카드 보기' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '카드 보기' })).toHaveClass(
      'aria-pressed:ring-1',
      'aria-pressed:ring-border',
      'aria-pressed:shadow-sm',
    )
    expect(screen.getByRole('button', { name: '프로젝트 생성' })).toHaveClass(
      'h-9',
    )
    expect(
      screen.getByRole('group', { name: '프로젝트 보기 방식' }),
    ).toHaveClass('h-9', 'rounded-lg', 'p-1')
    expect(screen.getByTestId('project-grid')).toHaveClass(
      'grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]',
      'min-[1360px]:grid-cols-4',
    )
    expect(screen.getByRole('searchbox').parentElement).toHaveClass(
      'w-full',
      'max-w-80',
    )
    expect(mockUseProjects).toHaveBeenLastCalledWith('token-1', 'workspace-1', {
      page: 1,
      limit: 12,
      search: '',
    })
  })

  it('검색어 입력 시 검색 파라미터를 전달하고 페이지를 첫 페이지로 돌린다', async () => {
    render(
      <ProjectListContent
        accessToken="token-1"
        workspaceId="workspace-1"
        userId="user-1"
        workspaceRole="owner"
      />,
    )

    await userEvent.type(screen.getByRole('searchbox'), '브랜드')

    expect(mockUseProjects).toHaveBeenLastCalledWith('token-1', 'workspace-1', {
      page: 1,
      limit: 12,
      search: '브랜드',
    })

    await userEvent.click(screen.getByRole('button', { name: '검색어 지우기' }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })

  it('프로젝트가 없으면 Figma 기준 빈 상태와 생성 버튼을 중앙에 표시한다', () => {
    mockUseProjects.mockReturnValue(
      projectQuery({
        data: {
          projects: [],
          pagination: { page: 1, limit: 12, total: 0, totalPages: 1 },
        },
      }),
    )

    render(
      <ProjectListContent
        accessToken="token-1"
        workspaceId="workspace-1"
        userId="user-1"
        workspaceRole="owner"
      />,
    )

    const emptyState = screen.getByText('아직 프로젝트가 없어요').parentElement
    expect(emptyState).toHaveClass('flex-1', 'items-center', 'justify-center')
    expect(screen.getByText('아직 프로젝트가 없어요')).toBeInTheDocument()
    expect(
      screen.getByText(
        '새 프로젝트를 만들어 팀과 화이트보드로 협업을 시작해보세요',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '새 프로젝트 만들기' }),
    ).toHaveAttribute('data-size', 'large')
  })

  it('검색 결과가 없으면 초기화 버튼이 있는 중앙 빈 상태를 표시한다', async () => {
    mockUseProjects.mockReturnValue(
      projectQuery({
        data: {
          projects: [],
          pagination: { page: 1, limit: 12, total: 0, totalPages: 1 },
        },
      }),
    )

    render(
      <ProjectListContent
        accessToken="token-1"
        workspaceId="workspace-1"
        userId="user-1"
        workspaceRole="owner"
      />,
    )

    await userEvent.type(screen.getByRole('searchbox'), '없는 프로젝트')

    const emptyState = screen.getByText('검색 결과가 없어요').parentElement
    expect(emptyState).toHaveClass('flex-1', 'items-center', 'justify-center')
    expect(screen.getByText('검색 결과가 없어요')).toBeInTheDocument()
    expect(
      screen.getByText('다른 검색어로 다시 시도해보세요'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '검색 결과 초기화' }),
    ).toBeInTheDocument()
  })

  it('목록 보기로 전환하고 페이지를 이동한다', async () => {
    mockUseProjects.mockImplementation((_token, _workspaceId, params) =>
      projectQuery({
        data: {
          projects: [projectFixture],
          pagination: {
            page: params.page,
            limit: 12,
            total: 24,
            totalPages: 2,
          },
        },
      }),
    )
    render(
      <ProjectListContent
        accessToken="token-1"
        workspaceId="workspace-1"
        userId="user-1"
        workspaceRole="owner"
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '목록 보기' }))
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '목록 보기' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '목록 보기' })).toHaveClass(
      'aria-pressed:ring-1',
      'aria-pressed:ring-border',
      'aria-pressed:shadow-sm',
    )

    await userEvent.click(screen.getByRole('button', { name: '2' }))
    await waitFor(() =>
      expect(mockUseProjects).toHaveBeenLastCalledWith(
        'token-1',
        'workspace-1',
        { page: 2, limit: 12, search: '' },
      ),
    )
  })

  it('마지막 페이지의 마지막 프로젝트를 삭제하면 이전 페이지로 보정한다', async () => {
    const deleteMutation = mutationResult()
    deleteMutation.mutateAsync.mockResolvedValue(undefined)
    mockUseDeleteProject.mockReturnValue(deleteMutation)
    mockUseProjects.mockImplementation((_token, _workspaceId, params) =>
      projectQuery({
        data: {
          projects: [projectFixture],
          pagination: {
            page: params.page,
            limit: 12,
            total: 13,
            totalPages: 2,
          },
        },
      }),
    )
    render(
      <ProjectListContent
        accessToken="token-1"
        workspaceId="workspace-1"
        userId="user-1"
        workspaceRole="owner"
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '2' }))
    await userEvent.click(
      screen.getByRole('button', { name: `${projectFixture.name} 메뉴` }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: '삭제' }))
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))

    await waitFor(() =>
      expect(mockUseProjects).toHaveBeenLastCalledWith(
        'token-1',
        'workspace-1',
        { page: 1, limit: 12, search: '' },
      ),
    )
  })

  it('생성 버튼에서 프로젝트 생성 모달을 열고 입력을 제출한다', async () => {
    const createMutation = mutationResult()
    createMutation.mutateAsync.mockResolvedValue(projectFixture)
    mockUseCreateProject.mockReturnValue(createMutation)
    render(
      <ProjectListContent
        accessToken="token-1"
        workspaceId="workspace-1"
        userId="user-1"
        workspaceRole="owner"
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '프로젝트 생성' }))
    await userEvent.type(screen.getByLabelText('이름'), '새 프로젝트')
    await userEvent.click(screen.getByRole('button', { name: '만들기' }))

    await waitFor(() =>
      expect(createMutation.mutateAsync).toHaveBeenCalledWith({
        name: '새 프로젝트',
        description: null,
      }),
    )
  })

  it('프로젝트 메뉴에서 수정과 삭제 모달을 연다', async () => {
    render(
      <ProjectListContent
        accessToken="token-1"
        workspaceId="workspace-1"
        userId="user-1"
        workspaceRole="owner"
      />,
    )

    await userEvent.click(
      screen.getByRole('button', { name: `${projectFixture.name} 메뉴` }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: '수정' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('프로젝트 수정')
    await userEvent.click(screen.getByRole('button', { name: '취소' }))

    await userEvent.click(
      screen.getByRole('button', { name: `${projectFixture.name} 메뉴` }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: '삭제' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('프로젝트 삭제')
  })

  it('멤버는 자신이 만든 프로젝트에만 수정·삭제 메뉴를 볼 수 있다', () => {
    render(
      <ProjectListContent
        accessToken="token-1"
        workspaceId="workspace-1"
        userId="user-1"
        workspaceRole="member"
      />,
    )

    expect(
      screen.getByRole('button', { name: `${projectFixture.name} 메뉴` }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: `${secondProjectFixture.name} 메뉴`,
      }),
    ).not.toBeInTheDocument()
  })

  it('목록 조회 실패 시 다시 시도 버튼을 제공한다', async () => {
    const refetch = vi.fn()
    mockUseProjects.mockReturnValue(
      projectQuery({ data: undefined, isError: true, refetch }),
    )
    render(
      <ProjectListContent
        accessToken="token-1"
        workspaceId="workspace-1"
        userId="user-1"
        workspaceRole="owner"
      />,
    )

    expect(screen.getByText('프로젝트를 불러오지 못했어요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('프로젝트 제목을 누르면 상세 이동 콜백을 호출한다', async () => {
    const onProjectOpen = vi.fn()
    render(
      <ProjectListContent
        accessToken="token-1"
        workspaceId="workspace-1"
        userId="user-1"
        workspaceRole="owner"
        onProjectOpen={onProjectOpen}
      />,
    )

    await userEvent.click(
      screen.getByRole('button', { name: '2026 브랜드 리뉴얼' }),
    )

    expect(onProjectOpen).toHaveBeenCalledWith('project-1')
  })
})
