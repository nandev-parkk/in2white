import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import type { WorkspaceSummary } from '@/entities/workspace'

import { Sidebar } from './sidebar'

const workspaceFixture: WorkspaceSummary = {
  id: 'workspace-1',
  name: 'My Workspace',
  ownerId: 'user-1',
  isDefault: true,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  role: 'owner',
}

const sidebarFixture = {
  workspace: workspaceFixture,
  workspaces: [
    workspaceFixture,
    {
      ...workspaceFixture,
      id: 'workspace-2',
      name: '브랜드 스튜디오',
      role: 'member' as const,
    },
  ],
  selectedWorkspaceId: 'workspace-1',
  workspaceMembers: [{ id: 'user-1', name: '테스터', presenceIndex: 1 }],
  activeNav: 'projects' as const,
  onNavChange: vi.fn(),
  onWorkspaceChange: vi.fn(),
  onCreateWorkspace: vi.fn(),
  onLogout: vi.fn(),
  userName: '테스터',
  userEmail: 'user@in2white.team',
}

describe('Sidebar', () => {
  it('워크스페이스 버튼을 열고 검색 결과를 선택한다', async () => {
    const user = userEvent.setup()
    const onWorkspaceChange = vi.fn()
    render(
      <Sidebar {...sidebarFixture} onWorkspaceChange={onWorkspaceChange} />,
    )

    const trigger = screen.getByRole('button', { name: 'My Workspace' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox').parentElement).toHaveClass(
      'h-80',
      'w-68',
      'top-full',
      'left-0',
      'mt-2',
    )
    expect(
      screen.getByRole('option', { name: /My Workspace/ }),
    ).toHaveAttribute('aria-selected', 'true')

    await user.type(
      screen.getByRole('searchbox', { name: '워크스페이스 검색' }),
      '브랜드',
    )

    expect(
      screen.getByRole('option', { name: /브랜드 스튜디오/ }),
    ).toBeVisible()
    expect(
      screen.queryByRole('option', { name: /My Workspace/ }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('option', { name: /브랜드 스튜디오/ }))
    expect(onWorkspaceChange).toHaveBeenCalledWith('workspace-2')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    expect(screen.getByRole('option', { name: /My Workspace/ })).toBeVisible()
  })

  it('폴딩하면 64px 사이드바와 메뉴 툴팁을 사용한다', async () => {
    const user = userEvent.setup()
    render(<Sidebar {...sidebarFixture} />)

    await user.click(screen.getByRole('button', { name: '사이드바 접기' }))

    expect(
      screen.getByRole('complementary', {
        name: '워크스페이스 사이드바',
      }),
    ).toHaveClass('w-(--layout-sidebar-width-collapsed)')

    const projectsButton = screen.getByRole('button', { name: '프로젝트' })
    expect(projectsButton).toBeInTheDocument()
    await user.hover(projectsButton)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('프로젝트')

    await user.click(screen.getByRole('button', { name: 'My Workspace' }))
    expect(screen.getByRole('listbox').parentElement).toHaveClass(
      'left-full',
      'top-0',
      'ml-2',
    )
  })

  it('collapsed 값을 외부에서 제어한다', async () => {
    const user = userEvent.setup()
    const onCollapsedChange = vi.fn()

    function ControlledSidebar() {
      const [collapsed, setCollapsed] = useState(false)

      return (
        <Sidebar
          {...sidebarFixture}
          collapsed={collapsed}
          onCollapsedChange={(nextCollapsed) => {
            onCollapsedChange(nextCollapsed)
            setCollapsed(nextCollapsed)
          }}
        />
      )
    }

    render(<ControlledSidebar />)

    await user.click(screen.getByRole('button', { name: '사이드바 접기' }))

    expect(onCollapsedChange).toHaveBeenCalledWith(true)
    expect(
      screen.getByRole('complementary', {
        name: '워크스페이스 사이드바',
      }),
    ).toHaveClass('w-(--layout-sidebar-width-collapsed)')
  })

  it('collapsed 없이 callback만 전달해도 내부 폴딩 상태를 갱신한다', async () => {
    const user = userEvent.setup()
    const onCollapsedChange = vi.fn()
    render(
      <Sidebar {...sidebarFixture} onCollapsedChange={onCollapsedChange} />,
    )

    await user.click(screen.getByRole('button', { name: '사이드바 접기' }))

    expect(onCollapsedChange).toHaveBeenCalledWith(true)
    expect(
      screen.getByRole('complementary', {
        name: '워크스페이스 사이드바',
      }),
    ).toHaveClass('w-(--layout-sidebar-width-collapsed)')
  })

  it('선택 팝오버를 Escape와 외부 pointerdown으로 닫는다', async () => {
    const user = userEvent.setup()
    render(<Sidebar {...sidebarFixture} />)

    const trigger = screen.getByRole('button', { name: 'My Workspace' })
    await user.click(trigger)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)
    fireEvent.pointerDown(document.body)

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('키보드로 워크스페이스 옵션을 이동하고 선택한다', async () => {
    const user = userEvent.setup()
    const onWorkspaceChange = vi.fn()
    render(
      <Sidebar {...sidebarFixture} onWorkspaceChange={onWorkspaceChange} />,
    )

    await user.click(screen.getByRole('button', { name: 'My Workspace' }))
    const searchbox = screen.getByRole('searchbox', {
      name: '워크스페이스 검색',
    })
    expect(searchbox).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: /My Workspace/ })).toHaveFocus()

    await user.keyboard('{ArrowDown}{Enter}')
    expect(onWorkspaceChange).toHaveBeenCalledWith('workspace-2')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('새 워크스페이스 생성 액션을 전달한다', async () => {
    const user = userEvent.setup()
    const onCreateWorkspace = vi.fn()
    render(
      <Sidebar {...sidebarFixture} onCreateWorkspace={onCreateWorkspace} />,
    )

    await user.click(screen.getByRole('button', { name: 'My Workspace' }))
    await user.click(
      screen.getByRole('button', { name: '새 워크스페이스 생성' }),
    )

    expect(onCreateWorkspace).toHaveBeenCalledOnce()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('선택한 워크스페이스 role을 한국어로 표시한다', () => {
    const { rerender } = render(<Sidebar {...sidebarFixture} />)

    expect(
      within(screen.getByRole('button', { name: 'My Workspace' })).getByText(
        '소유자',
      ),
    ).toBeInTheDocument()

    rerender(
      <Sidebar
        {...sidebarFixture}
        workspace={sidebarFixture.workspaces[1]}
        selectedWorkspaceId="workspace-2"
      />,
    )

    expect(
      within(screen.getByRole('button', { name: '브랜드 스튜디오' })).getByText(
        '멤버',
      ),
    ).toBeInTheDocument()
  })

  it('워크스페이스를 불러오는 동안 트리거를 비활성화한다', () => {
    render(<Sidebar {...sidebarFixture} workspaceLoading />)

    const trigger = screen.getByRole('button', {
      name: '워크스페이스 불러오는 중',
    })
    expect(trigger).toBeDisabled()
    expect(screen.getByText('워크스페이스 불러오는 중')).toBeInTheDocument()
  })

  it('빈 워크스페이스 상태에서도 생성 진입점을 제공한다', async () => {
    const user = userEvent.setup()
    render(
      <Sidebar
        {...sidebarFixture}
        workspace={null}
        workspaces={[]}
        selectedWorkspaceId={null}
      />,
    )

    await user.click(screen.getByRole('button', { name: '워크스페이스 선택' }))

    expect(screen.getByText('워크스페이스가 없습니다')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '새 워크스페이스 생성' }),
    ).toBeInTheDocument()
  })

  it('기존 내비게이션과 로그아웃 동작을 유지한다', async () => {
    const user = userEvent.setup()
    const onNavChange = vi.fn()
    const onLogout = vi.fn()
    render(
      <Sidebar
        {...sidebarFixture}
        onNavChange={onNavChange}
        onLogout={onLogout}
      />,
    )

    await user.click(screen.getByRole('button', { name: '프로젝트' }))
    await user.click(screen.getByRole('button', { name: '멤버' }))
    await user.click(screen.getByRole('button', { name: '설정' }))
    await user.click(screen.getByRole('button', { name: '로그아웃' }))

    expect(onNavChange).toHaveBeenNthCalledWith(1, 'projects')
    expect(onNavChange).toHaveBeenNthCalledWith(2, 'members')
    expect(onNavChange).toHaveBeenNthCalledWith(3, 'settings')
    expect(onLogout).toHaveBeenCalledOnce()
  })
})
