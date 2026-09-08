import { useState } from 'react'
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
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

let resizeObserverCallback: ResizeObserverCallback | null = null

class MockResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeObserverCallback = callback
  }

  observe() {}

  disconnect() {}

  unobserve() {}
}

vi.stubGlobal('ResizeObserver', MockResizeObserver)

function emitSidebarWidth(width: number) {
  if (!resizeObserverCallback) {
    throw new Error('ResizeObserver callback is not registered')
  }

  act(() => {
    resizeObserverCallback?.([
      {
        borderBoxSize: [{ inlineSize: width, blockSize: 800 }],
        contentBoxSize: [{ inlineSize: width, blockSize: 800 }],
        contentRect: { width } as DOMRectReadOnly,
        devicePixelContentBoxSize: [{ inlineSize: width, blockSize: 800 }],
        target: document.body,
      } as unknown as ResizeObserverEntry,
    ], {} as ResizeObserver)
  })
}

describe('Sidebar', () => {
  it('Figma 기준 사이드바 시각 규칙을 적용한다', async () => {
    const user = userEvent.setup()
    render(<Sidebar {...sidebarFixture} />)

    const sidebar = screen.getByRole('complementary', {
      name: '워크스페이스 사이드바',
    })
    const toggle = screen.getByRole('button', { name: '사이드바 접기' })
    const logo = screen.getByRole('img', { name: 'in2white' })
    const workspaceTrigger = screen.getByRole('button', {
      name: 'My Workspace',
    })

    expect(logo).toHaveClass('size-8')
    expect(toggle).toHaveClass('text-foreground-strong')
    expect(workspaceTrigger.parentElement?.parentElement).not.toHaveClass(
      'pr-8',
    )
    expect(
      workspaceTrigger.querySelector('.lucide-chevrons-up-down'),
    ).toHaveClass('text-foreground-strong', 'transition-[opacity,transform]')

    const workspaceName = screen.getByText('My Workspace')
    const chevron = workspaceTrigger.querySelector('.lucide-chevrons-up-down')
    expect(workspaceName.parentElement).toHaveAttribute(
      'data-slot',
      'workspace-name-row',
    )
    expect(chevron?.parentElement).toBe(workspaceName.parentElement)

    await user.click(workspaceTrigger)

    const searchbox = screen.getByRole('searchbox', {
      name: '워크스페이스 검색',
    })
    expect(searchbox).toHaveClass(
      'border-transparent',
      'bg-background-subtle',
      'rounded-full',
      'pl-9',
    )
    expect(
      screen.getByRole('button', { name: '새 워크스페이스 생성' })
        .previousElementSibling,
    ).toHaveClass('bg-border')
    expect(
      screen.getByRole('button', { name: '로그아웃' }).nextElementSibling,
    ).toHaveClass('bg-border')
    expect(sidebar).toBeInTheDocument()
  })

  it('접힌 사이드바의 로고와 외부 토글을 상단에 배치한다', async () => {
    const user = userEvent.setup()
    render(<Sidebar {...sidebarFixture} />)

    await user.click(screen.getByRole('button', { name: '사이드바 접기' }))

    const sidebar = screen.getByRole('complementary', {
      name: '워크스페이스 사이드바',
    })
    const logo = screen.getByRole('img', { name: 'in2white' })
    const toggle = screen.getByRole('button', { name: '사이드바 펼치기' })
    const navigation = sidebar.querySelector('[data-slot="sidebar-navigation"]')

    fireEvent.transitionEnd(sidebar, { propertyName: 'width' })

    expect(sidebar).toHaveClass('transition-[width]')
    expect(logo.parentElement).not.toHaveClass('relative')
    expect(toggle).toHaveClass(
      'left-[calc(100%+1px)]',
      'top-3',
      'bg-background-default',
      'border-sidebar-border',
      'rounded-l-none',
      'rounded-r-md',
      'border-l-0',
      'h-8',
      'w-6',
    )
    expect(logo.parentElement).toHaveClass('h-8', 'pl-1')
    expect(logo.parentElement).not.toHaveClass('justify-center')
    expect(screen.getByText('프로젝트')).toHaveClass(
      'max-w-0',
      'whitespace-nowrap',
      'opacity-0',
      'text-ellipsis',
    )
    expect(navigation).toHaveClass('gap-1')
    expect(
      screen.getByRole('button', { name: '프로젝트' }).firstElementChild,
    ).toHaveClass('flex', 'items-center', 'gap-2')
    expect(
      screen.getByRole('button', { name: '프로젝트' }).firstElementChild,
    ).not.toHaveClass('justify-center')
    const workspaceTriggerLabel = screen
      .getByRole('button', { name: 'My Workspace' })
      .querySelector('[data-slot="workspace-trigger-label"]')
    expect(workspaceTriggerLabel).toHaveClass('max-w-0')
    expect(workspaceTriggerLabel?.querySelector('.text-label')).toHaveClass(
      'truncate',
    )
  })

  it('접기 전환 중에는 메뉴 기준점을 유지하고 폭 전환 후에만 접힌다', async () => {
    const user = userEvent.setup()
    const onCollapsedChange = vi.fn()
    render(
      <Sidebar {...sidebarFixture} onCollapsedChange={onCollapsedChange} />,
    )

    const sidebar = screen.getByRole('complementary', {
      name: '워크스페이스 사이드바',
    })
    const projectsButton = screen.getByRole('button', { name: '프로젝트' })

    await user.click(screen.getByRole('button', { name: '사이드바 접기' }))

    expect(sidebar).toHaveStyle({ width: '64px' })
    expect(projectsButton.firstElementChild).not.toHaveClass('justify-center')
    expect(screen.getByText('프로젝트')).toHaveClass(
      'max-w-12',
      'text-ellipsis',
    )
    expect(onCollapsedChange).not.toHaveBeenCalled()

    fireEvent.transitionEnd(sidebar, { propertyName: 'width' })

    expect(
      screen.getByRole('button', { name: '프로젝트' }).firstElementChild,
    ).not.toHaveClass('justify-center')
    expect(screen.getByText('프로젝트')).toHaveClass('max-w-0', 'opacity-0')
    expect(onCollapsedChange).toHaveBeenCalledWith(true)
  })

  it('중간 폭에서도 로고의 수평 기준점을 유지한다', () => {
    render(<Sidebar {...sidebarFixture} collapsed />)

    const logo = screen.getByRole('img', { name: 'in2white' })
    const resizeHandle = screen.getByRole('separator', {
      name: '사이드바 크기 조절',
    })

    expect(logo.parentElement).toHaveClass('h-8', 'pl-1')
    expect(logo.parentElement).not.toHaveClass('justify-center')

    fireEvent.pointerDown(resizeHandle, { clientX: 64 })
    fireEvent.pointerMove(document, { clientX: 100 })

    expect(logo.parentElement).toHaveClass('h-8', 'pl-1')
    expect(logo.parentElement).not.toHaveClass('justify-center')
  })

  it('콜랩스 버튼은 같은 수평 기준선에서 안팎 위치만 애니메이션한다', () => {
    render(<Sidebar {...sidebarFixture} />)

    const sidebar = screen.getByRole('complementary', {
      name: '워크스페이스 사이드바',
    })
    const toggle = screen.getByRole('button', { name: '사이드바 접기' })

    expect(toggle).toHaveClass(
      'top-4',
      'left-[calc(100%-36px)]',
      'h-6',
      'w-6',
      'transition-[left,top,height,border-radius,background-color,transform]',
      'duration-300',
      'ease-in-out',
    )

    fireEvent.click(toggle)

    expect(toggle).toHaveClass('top-4', 'left-[calc(100%-36px)]', 'h-6')

    fireEvent.transitionEnd(sidebar, { propertyName: 'width' })

    expect(toggle).toHaveClass('top-3', 'left-[calc(100%+1px)]', 'h-8')
  })

  it('콜랩스 버튼 위치를 실제 사이드바 폭 기준으로 전환한다', () => {
    const { unmount } = render(<Sidebar {...sidebarFixture} />)
    const toggle = screen.getByRole('button', { name: '사이드바 접기' })

    fireEvent.click(toggle)
    expect(toggle).toHaveClass('left-[calc(100%-36px)]')

    emitSidebarWidth(121)
    expect(toggle).toHaveClass('left-[calc(100%-36px)]')

    emitSidebarWidth(120)
    expect(toggle).toHaveClass('left-[calc(100%+1px)]')

    unmount()
    render(<Sidebar {...sidebarFixture} collapsed />)

    const expandToggle = screen.getByRole('button', {
      name: '사이드바 펼치기',
    })
    fireEvent.click(expandToggle)
    expect(expandToggle).toHaveClass('left-[calc(100%+1px)]')

    emitSidebarWidth(95)
    expect(expandToggle).toHaveClass('left-[calc(100%+1px)]')

    emitSidebarWidth(104)
    expect(expandToggle).toHaveClass('left-[calc(100%-36px)]')
  })

  it('접힌 상태에서 워크스페이스 도형이 버튼 안에서 잘리지 않는다', () => {
    render(<Sidebar {...sidebarFixture} collapsed />)

    const workspaceTrigger = screen.getByRole('button', {
      name: 'My Workspace',
    })
    const workspaceMark = workspaceTrigger.querySelector('.size-6')

    expect(workspaceTrigger).toHaveClass(
      'w-full',
      'justify-start',
      'px-1.5',
    )
    expect(workspaceMark).toHaveClass('size-6', 'shrink-0')
  })

  it('워크스페이스 참여 유저 영역을 유지한 채 부드럽게 숨기고 표시한다', async () => {
    const user = userEvent.setup()
    render(<Sidebar {...sidebarFixture} />)

    const sidebar = screen.getByRole('complementary', {
      name: '워크스페이스 사이드바',
    })
    const workspaceMembers = sidebar.querySelector(
      '[data-slot="sidebar-workspace-members"]',
    ) as HTMLElement

    expect(workspaceMembers).toHaveClass(
      'h-5',
      'opacity-100',
      'transition-[opacity,transform]',
    )
    expect(workspaceMembers).not.toHaveClass('opacity-0')

    await user.click(screen.getByRole('button', { name: '사이드바 접기' }))

    expect(workspaceMembers).toHaveClass(
      'h-5',
      'opacity-0',
      'pointer-events-none',
      'translate-y-0',
    )
    expect(workspaceMembers).not.toHaveClass('translate-y-1')

    fireEvent.transitionEnd(sidebar, { propertyName: 'width' })
    await user.click(screen.getByRole('button', { name: '사이드바 펼치기' }))

    expect(workspaceMembers).toHaveClass('h-5', 'opacity-100')
    expect(workspaceMembers).not.toHaveClass('opacity-0')
  })

  it('중간 폭에서는 메뉴 라벨을 compact ellipsis 상태로 표시한다', () => {
    render(<Sidebar {...sidebarFixture} collapsed />)

    const resizeHandle = screen.getByRole('separator', {
      name: '사이드바 크기 조절',
    })
    const projectLabel = screen.getByText('프로젝트')
    const projectContent = screen.getByRole('button', {
      name: '프로젝트',
    }).firstElementChild

    fireEvent.pointerDown(resizeHandle, { clientX: 64 })
    fireEvent.pointerMove(document, { clientX: 100 })

    expect(projectLabel).toHaveClass('max-w-12', 'opacity-100')
    expect(projectContent).not.toHaveClass('justify-center')

    fireEvent.pointerMove(document, { clientX: 240 })

    expect(screen.getByText('프로젝트')).toHaveClass(
      'max-w-32',
      'opacity-100',
    )
  })

  it('사이드바 리사이즈 핸들로 64px에서 240px 사이의 폭을 조절한다', () => {
    const onCollapsedChange = vi.fn()
    render(
      <Sidebar {...sidebarFixture} onCollapsedChange={onCollapsedChange} />,
    )

    const sidebar = screen.getByRole('complementary', {
      name: '워크스페이스 사이드바',
    })
    const resizeHandle = screen.getByRole('separator', {
      name: '사이드바 크기 조절',
    })

    expect(resizeHandle).toHaveClass('cursor-col-resize')
    expect(resizeHandle).toHaveAttribute('aria-valuemin', '64')
    expect(resizeHandle).toHaveAttribute('aria-valuemax', '240')
    expect(resizeHandle).toHaveAttribute('aria-valuenow', '240')

    fireEvent.pointerDown(resizeHandle, { clientX: 240 })
    fireEvent.pointerMove(document, { clientX: 140 })

    expect(sidebar).toHaveStyle({ width: '140px' })
    expect(resizeHandle).toHaveAttribute('aria-valuenow', '140')
    expect(screen.getByText('프로젝트')).toHaveClass(
      'max-w-12',
      'text-ellipsis',
    )
    expect(
      screen.getByRole('button', { name: '프로젝트' }).firstElementChild,
    ).not.toHaveClass('justify-center')
    expect(onCollapsedChange).not.toHaveBeenCalled()

    fireEvent.pointerMove(document, { clientX: -100 })
    expect(sidebar).toHaveStyle({ width: '64px' })
    expect(resizeHandle).toHaveAttribute('aria-valuenow', '64')
    expect(screen.getByText('프로젝트')).toHaveClass('max-w-12')
    expect(onCollapsedChange).not.toHaveBeenCalled()

    fireEvent.pointerUp(document)
    expect(screen.getByText('프로젝트')).toHaveClass('max-w-0')
    expect(onCollapsedChange).toHaveBeenCalledWith(true)

    fireEvent.pointerDown(resizeHandle, { clientX: 64 })
    fireEvent.pointerMove(document, { clientX: 400 })
    expect(sidebar).toHaveStyle({ width: '240px' })
    expect(resizeHandle).toHaveAttribute('aria-valuenow', '240')
    expect(screen.getByText('프로젝트')).toHaveClass('max-w-32')
    expect(
      screen.getByRole('button', { name: '프로젝트' }).firstElementChild,
    ).not.toHaveClass('justify-center')

    fireEvent.pointerUp(document)
    expect(screen.getByText('프로젝트')).toHaveClass('max-w-32')
    expect(onCollapsedChange).toHaveBeenCalledWith(false)
  })

  it('접힌 상태에서 리사이즈해도 토글은 로고와 겹치지 않는다', () => {
    render(<Sidebar {...sidebarFixture} collapsed />)

    const sidebar = screen.getByRole('complementary', {
      name: '워크스페이스 사이드바',
    })
    const resizeHandle = screen.getByRole('separator', {
      name: '사이드바 크기 조절',
    })
    const toggle = screen.getByRole('button', { name: '사이드바 펼치기' })

    expect(toggle).toHaveClass(
      'border-sidebar-border',
      'left-[calc(100%+1px)]',
    )

    fireEvent.pointerDown(resizeHandle, { clientX: 64 })
    expect(resizeHandle).toHaveClass('bg-sidebar-border')

    fireEvent.pointerMove(document, { clientX: 80 })
    expect(sidebar).toHaveStyle({ width: '80px' })
    expect(toggle).toHaveClass('left-[calc(100%+1px)]')
    expect(toggle).not.toHaveClass('right-3')

    fireEvent.pointerMove(document, { clientX: 96 })
    expect(sidebar).toHaveStyle({ width: '96px' })
    expect(toggle).toHaveClass('left-[calc(100%+1px)]')
    expect(toggle).not.toHaveClass('right-3')

    fireEvent.pointerMove(document, { clientX: 128 })
    expect(sidebar).toHaveStyle({ width: '128px' })
    expect(toggle).toHaveClass('left-[calc(100%-36px)]')
    expect(toggle).not.toHaveClass('left-[calc(100%+1px)]')
  })

  it('접힘과 펼침 전환에서 메뉴와 주요 아이콘의 가로 기준점을 유지한다', async () => {
    const user = userEvent.setup()
    render(<Sidebar {...sidebarFixture} />)

    const sidebar = screen.getByRole('complementary', {
      name: '워크스페이스 사이드바',
    })
    const getProjectContent = () =>
      screen.getByRole('button', { name: '프로젝트' }).firstElementChild
    const workspaceTrigger = screen.getByRole('button', {
      name: 'My Workspace',
    })
    const profile = sidebar.querySelector(
      '[data-slot="sidebar-profile"]',
    ) as HTMLElement

    expect(getProjectContent()).not.toHaveClass('justify-center')
    expect(workspaceTrigger).toHaveClass('w-full', 'justify-start')
    expect(profile).not.toHaveClass('justify-center')

    await user.click(screen.getByRole('button', { name: '사이드바 접기' }))
    fireEvent.transitionEnd(sidebar, { propertyName: 'width' })

    expect(getProjectContent()).not.toHaveClass('justify-center')
    expect(workspaceTrigger).toHaveClass('w-full', 'justify-start')
    expect(profile).not.toHaveClass('justify-center')

    await user.click(screen.getByRole('button', { name: '사이드바 펼치기' }))

    expect(getProjectContent()).not.toHaveClass('justify-center')
    expect(workspaceTrigger).toHaveClass('w-full', 'justify-start')
    expect(profile).not.toHaveClass('justify-center')
  })

  it('사이드바와 외부 콜랩스 버튼이 동일한 보더 색상을 사용한다', () => {
    render(<Sidebar {...sidebarFixture} collapsed />)

    const sidebar = screen.getByRole('complementary', {
      name: '워크스페이스 사이드바',
    })
    const toggle = screen.getByRole('button', { name: '사이드바 펼치기' })

    expect(sidebar.style.borderRightColor).toBe('var(--color-sidebar-border)')
    expect(toggle.style.borderColor).toBe('var(--color-sidebar-border)')
  })

  it('접힌 상태에서 보더를 눌렀다 놓아도 레이아웃을 바꾸지 않는다', () => {
    render(<Sidebar {...sidebarFixture} collapsed />)

    const sidebar = screen.getByRole('complementary', {
      name: '워크스페이스 사이드바',
    })
    const resizeHandle = screen.getByRole('separator', {
      name: '사이드바 크기 조절',
    })
    const toggle = screen.getByRole('button', { name: '사이드바 펼치기' })
    const workspaceMembers = sidebar.querySelector(
      '[data-slot="sidebar-workspace-members"]',
    ) as HTMLElement

    expect(toggle).toHaveClass('left-[calc(100%+1px)]')
    expect(workspaceMembers).toHaveClass('opacity-0', 'pointer-events-none')
    expect(
      screen.getByRole('button', { name: '프로젝트' }).firstElementChild,
    ).not.toHaveClass('justify-center')

    fireEvent.pointerDown(resizeHandle, { clientX: 64 })
    expect(toggle).toHaveClass('left-[calc(100%+1px)]')
    expect(workspaceMembers).toHaveClass('opacity-0', 'pointer-events-none')
    expect(
      screen.getByRole('button', { name: '프로젝트' }).firstElementChild,
    ).not.toHaveClass('justify-center')

    fireEvent.pointerUp(document)
    expect(toggle).toHaveClass('left-[calc(100%+1px)]')
    expect(workspaceMembers).toHaveClass('opacity-0', 'pointer-events-none')
    expect(
      screen.getByRole('button', { name: '프로젝트' }).firstElementChild,
    ).not.toHaveClass('justify-center')
  })

  it('접었다 펴도 확장 레이아웃으로 동일하게 돌아온다', async () => {
    const user = userEvent.setup()
    render(<Sidebar {...sidebarFixture} />)

    const sidebar = screen.getByRole('complementary', {
      name: '워크스페이스 사이드바',
    })

    await user.click(screen.getByRole('button', { name: '사이드바 접기' }))
    fireEvent.transitionEnd(sidebar, { propertyName: 'width' })

    await user.click(screen.getByRole('button', { name: '사이드바 펼치기' }))

    expect(sidebar).toHaveStyle({ width: '240px' })
    expect(screen.getByText('프로젝트')).toHaveClass('max-w-32')
    expect(
      screen.getByRole('button', { name: '프로젝트' }).firstElementChild,
    ).not.toHaveClass('justify-center')
    expect(screen.getByText('테스터')).toBeVisible()
    expect(screen.getByRole('button', { name: '사이드바 접기' })).toHaveClass(
      'left-[calc(100%+1px)]',
    )

    fireEvent.transitionEnd(sidebar, { propertyName: 'width' })

    expect(screen.getByText('프로젝트')).toHaveClass('max-w-32')
    expect(screen.getByText('테스터')).toBeVisible()
    expect(screen.getByRole('button', { name: '사이드바 접기' })).toHaveClass(
      'top-4',
      'left-[calc(100%-36px)]',
    )
  })

  it('접힌 상태에서도 로그아웃과 프로필 슬롯의 높이를 유지한다', async () => {
    const user = userEvent.setup()
    render(<Sidebar {...sidebarFixture} />)

    const sidebar = screen.getByRole('complementary', {
      name: '워크스페이스 사이드바',
    })
    const profile = sidebar.querySelector(
      '[data-slot="sidebar-profile"]',
    ) as HTMLElement

    expect(profile).toHaveClass('min-h-16')
    expect(screen.getByRole('button', { name: '로그아웃' })).toHaveClass('h-11')

    await user.click(screen.getByRole('button', { name: '사이드바 접기' }))
    fireEvent.transitionEnd(sidebar, { propertyName: 'width' })

    expect(profile).toHaveClass('min-h-16')
    expect(screen.getByRole('button', { name: '로그아웃' })).toHaveClass('h-11')
  })

  it('접혀도 워크스페이스 슬롯과 메뉴의 세로 기준을 유지한다', async () => {
    const user = userEvent.setup()
    render(<Sidebar {...sidebarFixture} />)

    const sidebar = screen.getByRole('complementary', {
      name: '워크스페이스 사이드바',
    })
    const workspaceSection = sidebar.querySelector(
      '[data-slot="sidebar-workspace-section"]',
    ) as HTMLElement
    const workspaceMembers = sidebar.querySelector(
      '[data-slot="sidebar-workspace-members"]',
    ) as HTMLElement
    const navigation = sidebar.querySelector(
      '[data-slot="sidebar-navigation"]',
    ) as HTMLElement

    expect(workspaceSection).toHaveClass('mt-2', 'min-h-[84px]')
    expect(workspaceMembers).toHaveClass('h-5')
    expect(navigation).toHaveClass('mt-4')

    await user.click(screen.getByRole('button', { name: '사이드바 접기' }))
    fireEvent.transitionEnd(sidebar, { propertyName: 'width' })

    expect(workspaceMembers).toHaveClass('opacity-0', 'pointer-events-none')
    expect(workspaceMembers).toHaveClass('h-5')
    expect(navigation).toHaveClass('mt-4')
  })

  it('드래그를 중간 폭에서 끝내면 해당 폭을 유지한다', () => {
    render(<Sidebar {...sidebarFixture} />)

    const sidebar = screen.getByRole('complementary', {
      name: '워크스페이스 사이드바',
    })
    const resizeHandle = screen.getByRole('separator', {
      name: '사이드바 크기 조절',
    })

    fireEvent.pointerDown(resizeHandle, { clientX: 240 })
    fireEvent.pointerMove(document, { clientX: 180 })
    fireEvent.pointerUp(document)

    expect(sidebar).toHaveStyle({ width: '180px' })
  })

  it('접힘과 펼침 전환에 자연스러운 폭 애니메이션을 적용한다', () => {
    render(<Sidebar {...sidebarFixture} />)

    const sidebar = screen.getByRole('complementary', {
      name: '워크스페이스 사이드바',
    })
    const toggle = screen.getByRole('button', { name: '사이드바 접기' })

    expect(sidebar).toHaveClass(
      'transition-[width]',
      'duration-300',
      'ease-in-out',
    )

    fireEvent.click(toggle)

    expect(sidebar).toHaveStyle({ width: '64px' })
  })

  it('워크스페이스가 없어도 선택 chevron을 표시한다', () => {
    render(
      <Sidebar
        {...sidebarFixture}
        workspace={null}
        workspaces={[]}
        selectedWorkspaceId={null}
      />,
    )

    const workspaceTrigger = screen.getByRole('button', {
      name: '워크스페이스 선택',
    })

    expect(workspaceTrigger).toHaveTextContent('워크스페이스 없음')
    expect(
      workspaceTrigger.querySelector('.lucide-chevrons-up-down'),
    ).toHaveClass('text-foreground-strong')
  })

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

    fireEvent.transitionEnd(
      screen.getByRole('complementary', {
        name: '워크스페이스 사이드바',
      }),
      { propertyName: 'width' },
    )

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

    fireEvent.transitionEnd(
      screen.getByRole('complementary', {
        name: '워크스페이스 사이드바',
      }),
      { propertyName: 'width' },
    )

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

    fireEvent.transitionEnd(
      screen.getByRole('complementary', {
        name: '워크스페이스 사이드바',
      }),
      { propertyName: 'width' },
    )

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
    expect(screen.getByRole('listbox')).toBeInTheDocument()
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
