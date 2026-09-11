import * as React from 'react'
import { cn } from 'cn'
import {
  Check,
  ChevronsUpDown,
  Folder,
  LogOut,
  PanelLeft,
  Plus,
  Search,
  SlidersHorizontal,
  UserPlus,
  Users,
} from 'lucide-react'
import type { WorkspaceSummary } from '@/entities/workspace'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Input } from '@/shared/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import type { PresenceUser } from '@/shared/ui/presence-avatar-stack'

type SidebarNavKey = 'projects' | 'members' | 'settings'

const SIDEBAR_WIDTH_MIN = 64
const SIDEBAR_WIDTH_MAX = 240
const SIDEBAR_TOGGLE_OUTSIDE_MAX_WIDTH = 100
const SIDEBAR_TOGGLE_COLLAPSE_OUTSIDE_MAX_WIDTH = 120
const SIDEBAR_TOGGLE_INSIDE_MIN_WIDTH = 104
const SIDEBAR_VISUAL_COLLAPSED_MAX_WIDTH = 96
const SIDEBAR_COMPACT_MAX_WIDTH = 160
const SIDEBAR_BORDER_COLOR = 'var(--color-sidebar-border)'

type SidebarProps = React.ComponentProps<'div'> & {
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  workspaceLoading?: boolean
  workspace: WorkspaceSummary | null
  workspaces: WorkspaceSummary[]
  selectedWorkspaceId: string | null
  onWorkspaceChange: (workspaceId: string) => void
  onCreateWorkspace: () => void
  workspaceDialogOpen?: boolean
  workspaceMembers: PresenceUser[]
  activeNav: SidebarNavKey
  onNavChange: (key: SidebarNavKey) => void
  onUserClick?: () => void
  onInviteMember?: () => void
  onLogout?: () => void
  userName: string
  userEmail: string
  userImageUrl?: string
}

function WorkspaceMark({ name }: { name?: string }) {
  return (
    <span className="bg-action-primary text-action-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-lg text-sm font-bold">
      {name?.slice(0, 1) || 'W'}
    </span>
  )
}

function WorkspaceSwitcher({
  collapsed,
  loading,
  workspace,
  workspaces,
  selectedWorkspaceId,
  onWorkspaceChange,
  onCreateWorkspace,
  preserveOpen,
}: {
  collapsed: boolean
  loading: boolean
  workspace: WorkspaceSummary | null
  workspaces: WorkspaceSummary[]
  selectedWorkspaceId: string | null
  onWorkspaceChange: (workspaceId: string) => void
  onCreateWorkspace: () => void
  preserveOpen: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const listboxRef = React.useRef<HTMLDivElement>(null)

  const close = React.useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  React.useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (preserveOpen) return
      const target = event.target as Element
      if (
        target.closest(
          '[data-slot="dialog-overlay"], [data-slot="dialog-content"]',
        )
      ) {
        return
      }
      if (!containerRef.current?.contains(event.target as Node)) close()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      close()
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [close, open, preserveOpen])

  const normalizedQuery = query.toLocaleLowerCase()
  const filteredWorkspaces = workspaces.filter((item) =>
    item.name.toLocaleLowerCase().includes(normalizedQuery),
  )

  const getOptions = () =>
    Array.from(
      listboxRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ??
        [],
    )

  const handleListboxKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return

    const options = getOptions()
    if (options.length === 0) return

    event.preventDefault()
    const currentIndex = options.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'Home') return options[0].focus()
    if (event.key === 'End') return options.at(-1)?.focus()

    const direction = event.key === 'ArrowDown' ? 1 : -1
    const nextIndex =
      currentIndex === -1
        ? direction === 1
          ? 0
          : options.length - 1
        : (currentIndex + direction + options.length) % options.length
    options[nextIndex].focus()
  }

  const triggerLabel = loading
    ? '워크스페이스 불러오는 중'
    : (workspace?.name ?? '워크스페이스 선택')

  function handleWorkspaceSelect(workspaceId: string) {
    onWorkspaceChange(workspaceId)
    close()
    triggerRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-busy={loading || undefined}
        disabled={loading}
        onClick={() => {
          if (open) close()
          else setOpen(true)
        }}
        className={cn(
          'focus-visible:ring-action-focus-ring hover:bg-action-secondary-hover flex h-14 w-full min-w-0 items-center justify-start gap-2 overflow-hidden rounded-md px-1.5 transition-colors duration-150 outline-none focus-visible:ring-3',
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <WorkspaceMark name={workspace?.name} />
          <span
            data-slot="workspace-trigger-label"
            aria-hidden={collapsed}
            className={cn(
              'flex min-w-0 flex-1 items-center overflow-hidden transition-[max-width,opacity,transform] duration-200 ease-out motion-reduce:transition-none',
              collapsed
                ? 'max-w-0 -translate-x-1 opacity-0'
                : 'max-w-full opacity-100',
            )}
          >
            {loading ? (
              <span className="text-body-small text-foreground-secondary truncate">
                워크스페이스 불러오는 중
              </span>
            ) : workspace ? (
              <span className="flex w-full min-w-0 flex-1 flex-col items-start">
                <span
                  data-slot="workspace-name-row"
                  className="flex w-full min-w-0 items-center gap-1.5"
                >
                  <span className="text-label text-foreground-strong min-w-0 flex-1 truncate">
                    {workspace.name}
                  </span>
                  <ChevronsUpDown className="text-foreground-strong size-4 shrink-0 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none" />
                </span>
                <span className="text-foreground-tertiary text-[11px]">
                  {workspace.role === 'owner' ? '소유자' : '멤버'}
                </span>
              </span>
            ) : (
              <span className="flex w-full min-w-0 flex-1 items-center gap-1.5">
                <span className="text-body-small text-foreground-secondary min-w-0 flex-1 truncate">
                  워크스페이스 없음
                </span>
                <ChevronsUpDown className="text-foreground-strong size-4 shrink-0 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none" />
              </span>
            )}
          </span>
        </span>
      </button>

      {open && (
        <div
          data-slot="workspace-switcher-popover"
          className={cn(
            'border-border bg-background-elevated animate-in fade-in-0 zoom-in-95 absolute z-50 flex h-80 w-68 flex-col gap-2 rounded-lg border p-3 shadow-lg transition-[opacity,transform] duration-200 ease-out motion-reduce:animate-none motion-reduce:transition-none',
            collapsed ? 'top-0 left-full ml-2' : 'top-full left-0 mt-2',
          )}
        >
          <div className="relative shrink-0">
            <Search className="text-foreground-tertiary pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              autoFocus
              type="search"
              aria-label="워크스페이스 검색"
              placeholder="워크스페이스 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowDown') return
                event.preventDefault()
                getOptions()[0]?.focus()
              }}
              className="bg-background-subtle rounded-full border-transparent pl-9 focus:border-transparent"
            />
          </div>

          <div
            ref={listboxRef}
            role="listbox"
            aria-label="워크스페이스 목록"
            onKeyDown={handleListboxKeyDown}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            {filteredWorkspaces.map((item) => {
              const selected = item.id === selectedWorkspaceId
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => handleWorkspaceSelect(item.id)}
                  className={cn(
                    'focus-visible:ring-action-focus-ring hover:bg-action-secondary-hover flex h-11 w-full items-center gap-2 rounded-md px-2 text-left transition-[background-color,transform] duration-150 ease-out outline-none focus-visible:ring-3 active:scale-[0.99] motion-reduce:transition-none',
                    selected && 'bg-action-secondary',
                  )}
                >
                  <WorkspaceMark name={item.name} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body-small text-foreground-strong truncate font-semibold">
                      {item.name}
                    </span>
                    <span className="text-caption text-foreground-tertiary">
                      {item.role === 'owner' ? '소유자' : '멤버'}
                    </span>
                  </span>
                  {selected && (
                    <Check className="text-foreground-default size-4 shrink-0" />
                  )}
                </button>
              )
            })}
            {filteredWorkspaces.length === 0 && (
              <p className="text-body-small text-foreground-tertiary px-2 py-4 text-center">
                워크스페이스가 없습니다
              </p>
            )}
          </div>

          <div className="bg-border h-px w-full shrink-0" />
          <button
            type="button"
            onClick={() => {
              onCreateWorkspace()
            }}
            className="text-body-small text-foreground-secondary hover:bg-action-secondary-hover focus-visible:ring-action-focus-ring flex h-9 shrink-0 items-center gap-2 rounded-md px-2 text-left transition-[background-color,transform] duration-150 ease-out outline-none focus-visible:ring-3 active:scale-[0.99] motion-reduce:transition-none"
          >
            <Plus className="size-4" />새 워크스페이스 생성
          </button>
        </div>
      )}
    </div>
  )
}

function SidebarNavItem({
  collapsed,
  compact,
  icon: Icon,
  label,
  active,
  trailing,
  onClick,
}: {
  collapsed?: boolean
  compact?: boolean
  icon: React.ElementType
  label: string
  active?: boolean
  trailing?: React.ReactNode
  onClick: () => void
}) {
  const content = (
    <button
      type="button"
      aria-label={collapsed || compact ? label : undefined}
      onClick={onClick}
      className={cn(
        'focus-visible:ring-action-focus-ring flex h-11 w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-md p-3 text-left transition-[background-color,transform,color] duration-150 ease-out outline-none focus-visible:ring-3 active:scale-[0.99] motion-reduce:transition-none',
        active ? 'bg-action-secondary' : 'hover:bg-action-secondary-hover',
      )}
    >
      <span
        className="flex min-w-0 items-center gap-2"
      >
        <Icon className="size-4 shrink-0" />
        <span
          aria-hidden={collapsed}
          className={cn(
            'text-body min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap transition-[max-width,opacity,transform] duration-200 ease-out motion-reduce:transition-none',
            collapsed
              ? 'max-w-0 -translate-x-1 opacity-0'
              : compact
                ? 'max-w-12 opacity-100'
                : 'max-w-32 opacity-100',
            active
              ? 'text-foreground-strong font-semibold'
              : 'text-foreground-secondary',
          )}
        >
          {label}
        </span>
      </span>
      {!collapsed && !compact && trailing}
    </button>
  )

  if (!collapsed && !compact) return content

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

function Sidebar({
  className,
  style,
  collapsed,
  onCollapsedChange,
  workspaceLoading = false,
  workspace,
  workspaces,
  selectedWorkspaceId,
  onWorkspaceChange,
  onCreateWorkspace,
  workspaceDialogOpen = false,
  workspaceMembers,
  activeNav,
  onNavChange,
  onUserClick,
  onInviteMember,
  onLogout,
  userName,
  userEmail,
  userImageUrl,
  ...props
}: SidebarProps) {
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = React.useState(
    collapsed ?? false,
  )
  const isControlled = collapsed !== undefined
  const isCollapsed = isControlled ? collapsed : uncontrolledCollapsed
  const [layoutCollapsed, setLayoutCollapsed] = React.useState(isCollapsed)
  const [pendingCollapsed, setPendingCollapsed] = React.useState<
    boolean | null
  >(null)
  const pendingCollapsedRef = React.useRef<boolean | null>(null)
  const [sidebarWidth, setSidebarWidth] = React.useState(
    isCollapsed ? SIDEBAR_WIDTH_MIN : SIDEBAR_WIDTH_MAX,
  )
  const sidebarRef = React.useRef<HTMLDivElement>(null)
  const sidebarWidthRef = React.useRef(sidebarWidth)
  const previousCollapsedRef = React.useRef(isCollapsed)
  const [toggleOutside, setToggleOutside] = React.useState(isCollapsed)
  const toggleOutsideRef = React.useRef(toggleOutside)
  const [isResizing, setIsResizing] = React.useState(false)
  const resizeStateRef = React.useRef<{
    startX: number
    startWidth: number
  } | null>(null)

  const updateCollapsedState = React.useCallback(
    (nextCollapsed: boolean) => {
      if (!isControlled) setUncontrolledCollapsed(nextCollapsed)
      onCollapsedChange?.(nextCollapsed)
    },
    [isControlled, onCollapsedChange],
  )

  const updateToggleOutside = React.useCallback((nextOutside: boolean) => {
    toggleOutsideRef.current = nextOutside
    setToggleOutside(nextOutside)
  }, [])

  const updateSidebarWidth = React.useCallback((nextWidth: number) => {
    const clampedWidth = Math.min(
      SIDEBAR_WIDTH_MAX,
      Math.max(SIDEBAR_WIDTH_MIN, Math.round(nextWidth)),
    )
    sidebarWidthRef.current = clampedWidth
    setSidebarWidth(clampedWidth)
    return clampedWidth
  }, [])

  const updateToggleOutsideForWidth = React.useCallback(
    (width: number) => {
      const outsideMaxWidth =
        pendingCollapsedRef.current === true
          ? SIDEBAR_TOGGLE_COLLAPSE_OUTSIDE_MAX_WIDTH
          : SIDEBAR_TOGGLE_OUTSIDE_MAX_WIDTH

      if (
        toggleOutsideRef.current &&
        width >= SIDEBAR_TOGGLE_INSIDE_MIN_WIDTH
      ) {
        updateToggleOutside(false)
      } else if (
        !toggleOutsideRef.current &&
        width <= outsideMaxWidth
      ) {
        updateToggleOutside(true)
      }
    },
    [updateToggleOutside],
  )

  React.useEffect(() => {
    const sidebarElement = sidebarRef.current
    if (!sidebarElement || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return

      const borderBoxSize = Array.isArray(entry.borderBoxSize)
        ? entry.borderBoxSize[0]?.inlineSize
        : undefined
      updateToggleOutsideForWidth(
        borderBoxSize ?? entry.contentRect.width,
      )
    })

    observer.observe(sidebarElement)
    return () => observer.disconnect()
  }, [updateToggleOutsideForWidth])

  const commitCollapsedState = React.useCallback(
    (nextCollapsed: boolean) => {
      pendingCollapsedRef.current = null
      setPendingCollapsed(null)
      setLayoutCollapsed(nextCollapsed)
      updateToggleOutside(nextCollapsed)
      updateCollapsedState(nextCollapsed)
    },
    [updateCollapsedState, updateToggleOutside],
  )

  const requestCollapsedState = React.useCallback(
    (nextCollapsed: boolean) => {
      const targetWidth = nextCollapsed ? SIDEBAR_WIDTH_MIN : SIDEBAR_WIDTH_MAX
      const currentWidth = sidebarWidthRef.current
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches

      pendingCollapsedRef.current = nextCollapsed
      setPendingCollapsed(nextCollapsed)
      updateSidebarWidth(targetWidth)

      if (currentWidth === targetWidth || prefersReducedMotion) {
        commitCollapsedState(nextCollapsed)
      }
    },
    [commitCollapsedState, updateSidebarWidth],
  )

  React.useEffect(() => {
    if (pendingCollapsedRef.current !== null) return
    if (previousCollapsedRef.current === isCollapsed) return

    previousCollapsedRef.current = isCollapsed
    setLayoutCollapsed(isCollapsed)
    updateSidebarWidth(isCollapsed ? SIDEBAR_WIDTH_MIN : SIDEBAR_WIDTH_MAX)
    updateToggleOutside(isCollapsed)
  }, [
    isCollapsed,
    pendingCollapsed,
    updateSidebarWidth,
    updateToggleOutside,
  ])

  React.useEffect(() => {
    if (!isResizing) return

    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current
      if (!resizeState) return

      const nextWidth = updateSidebarWidth(
        resizeState.startWidth + event.clientX - resizeState.startX,
      )
      updateToggleOutsideForWidth(nextWidth)
    }
    const finishResize = () => {
      const finalWidth = sidebarWidthRef.current
      if (finalWidth === SIDEBAR_WIDTH_MIN && !isCollapsed) {
        commitCollapsedState(true)
      } else if (finalWidth === SIDEBAR_WIDTH_MAX && isCollapsed) {
        commitCollapsedState(false)
      }
      resizeStateRef.current = null
      setIsResizing(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', finishResize)
    window.addEventListener('pointercancel', finishResize)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', finishResize)
      window.removeEventListener('pointercancel', finishResize)
    }
  }, [
    commitCollapsedState,
    isCollapsed,
    isResizing,
    updateSidebarWidth,
    updateToggleOutsideForWidth,
  ])

  function handleResizePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return

    event.preventDefault()
    pendingCollapsedRef.current = null
    setPendingCollapsed(null)
    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
    }
    sidebarWidthRef.current = sidebarWidth
    setIsResizing(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handleResizeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return
    }

    event.preventDefault()
    if (event.key === 'Home') {
      requestCollapsedState(true)
      return
    }
    if (event.key === 'End') {
      requestCollapsedState(false)
      return
    }

    const nextWidth = updateSidebarWidth(
      sidebarWidth + (event.key === 'ArrowRight' ? 16 : -16),
    )
    updateToggleOutsideForWidth(nextWidth)
  }

  function handleToggleClick() {
    const currentTarget = pendingCollapsedRef.current ?? isCollapsed
    requestCollapsedState(!currentTarget)
  }

  function handleSidebarTransitionEnd(
    event: React.TransitionEvent<HTMLDivElement>,
  ) {
    if (
      event.target !== event.currentTarget ||
      event.propertyName !== 'width'
    ) {
      return
    }

    const nextCollapsed = pendingCollapsedRef.current
    if (nextCollapsed === null) return
    commitCollapsedState(nextCollapsed)
  }

  const visualCollapsed =
    layoutCollapsed &&
    sidebarWidth <= SIDEBAR_VISUAL_COLLAPSED_MAX_WIDTH &&
    pendingCollapsed !== false
  const workspaceMembersCollapsed = visualCollapsed || pendingCollapsed === true
  const compact =
    !visualCollapsed && sidebarWidth < SIDEBAR_COMPACT_MAX_WIDTH

  return (
    <div
      ref={sidebarRef}
      {...props}
      data-slot="sidebar"
      role="complementary"
      aria-label="워크스페이스 사이드바"
      style={{
        ...style,
        width: `${sidebarWidth}px`,
        borderRightColor: SIDEBAR_BORDER_COLOR,
      }}
      onTransitionEnd={handleSidebarTransitionEnd}
      className={cn(
        'border-sidebar-border bg-background-default relative flex h-full flex-col gap-3 border-r p-3 transition-[width] duration-300 ease-in-out motion-reduce:transition-none',
        isResizing && 'transition-none',
        layoutCollapsed
          ? 'w-(--layout-sidebar-width-collapsed)'
          : 'w-(--layout-sidebar-width-expanded)',
        className,
      )}
    >
      <div
        className="flex h-8 items-center pl-1"
      >
        <img
          src="/logo-mark.png"
          alt="in2white"
          className="size-8 rounded-sm"
        />
        <button
          type="button"
          onClick={handleToggleClick}
          aria-label={
            (pendingCollapsed ?? isCollapsed)
              ? '사이드바 펼치기'
              : '사이드바 접기'
          }
          className={cn(
            'text-foreground-strong hover:bg-action-secondary-hover absolute z-20 flex items-center justify-center transition-[left,top,height,border-radius,background-color,transform] duration-300 ease-in-out active:scale-[0.98] motion-reduce:transition-none',
            toggleOutside
              ? 'border-sidebar-border bg-background-default top-3 left-[calc(100%+1px)] h-8 w-6 rounded-l-none rounded-r-md border border-l-0'
              : 'left-[calc(100%-36px)] top-4 h-6 w-6 rounded-md',
          )}
          style={
            toggleOutside ? { borderColor: SIDEBAR_BORDER_COLOR } : undefined
          }
        >
          <PanelLeft className="size-4" />
        </button>
      </div>

      <div
        className={cn(
          'mt-2 flex min-h-[84px] flex-col gap-2 transition-[margin,gap] duration-200 ease-out motion-reduce:transition-none',
        )}
        data-slot="sidebar-workspace-section"
      >
        <WorkspaceSwitcher
          collapsed={visualCollapsed}
          loading={workspaceLoading}
          workspace={workspace}
          workspaces={workspaces}
          selectedWorkspaceId={selectedWorkspaceId}
          onWorkspaceChange={onWorkspaceChange}
          onCreateWorkspace={onCreateWorkspace}
          preserveOpen={workspaceDialogOpen}
        />
        <div
          data-slot="sidebar-workspace-members"
          aria-hidden={workspaceMembersCollapsed}
          className={cn(
            'flex h-5 items-center translate-y-0 opacity-100 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
            workspaceMembersCollapsed && 'pointer-events-none opacity-0',
          )}
        >
          {workspaceMembers.slice(0, 3).map((member) => (
            <Avatar
              key={member.id}
              size="small"
              className="ring-1.5 ring-background-default -mr-1 size-5"
            >
              {member.imageUrl && (
                <AvatarImage src={member.imageUrl} alt={member.name} />
              )}
              <AvatarFallback size="small" className="text-xs">
                {member.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          ))}
          {workspaceMembers.length > 3 && (
            <div className="border-1.5 border-background-default bg-background-subtle text-foreground-secondary flex size-5 items-center justify-center rounded-full text-[9px] font-semibold">
              +{workspaceMembers.length - 3}
            </div>
          )}
        </div>
      </div>

      <div
        data-slot="sidebar-navigation"
        className={cn(
          'mt-4 flex flex-col gap-1 transition-[gap,margin] duration-200 ease-out motion-reduce:transition-none',
        )}
      >
        <SidebarNavItem
          collapsed={visualCollapsed}
          compact={compact}
          icon={Folder}
          label="프로젝트"
          active={activeNav === 'projects'}
          onClick={() => onNavChange('projects')}
        />
        <SidebarNavItem
          collapsed={visualCollapsed}
          compact={compact}
          icon={Users}
          label="멤버"
          active={activeNav === 'members'}
          onClick={() => onNavChange('members')}
          trailing={
            onInviteMember && (
              <UserPlus
                className="text-foreground-tertiary hover:text-foreground-default size-4"
                onClick={(e) => {
                  e.stopPropagation()
                  onInviteMember()
                }}
              />
            )
          }
        />
        <SidebarNavItem
          collapsed={visualCollapsed}
          compact={compact}
          icon={SlidersHorizontal}
          label="설정"
          active={activeNav === 'settings'}
          onClick={() => onNavChange('settings')}
        />
      </div>

      <div className="flex-1" />

      <SidebarNavItem
        collapsed={visualCollapsed}
        compact={compact}
        icon={LogOut}
        label="로그아웃"
        onClick={() => onLogout?.()}
      />

      <div className="bg-border h-px w-full" />

      <div data-slot="sidebar-profile" className="min-h-16 w-full">
        <button
          type="button"
          aria-label={`사용자 정보: ${userName}`}
          onClick={() => onUserClick?.()}
          className="focus-visible:ring-action-focus-ring hover:bg-action-secondary-hover flex min-h-16 w-full items-center gap-2 rounded-md py-3 pr-3 pl-1 text-left transition-colors duration-150 outline-none focus-visible:ring-3"
        >
          <Avatar size="default">
            {userImageUrl && <AvatarImage src={userImageUrl} alt={userName} />}
            <AvatarFallback size="default">
              {userName.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          {!visualCollapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="text-body-small text-foreground-strong truncate font-semibold">
                {userName}
              </span>
              <span className="text-caption text-foreground-tertiary truncate">
                {userEmail}
              </span>
            </div>
          )}
        </button>
      </div>

      <div
        data-slot="sidebar-resize-handle"
        role="separator"
        aria-label="사이드바 크기 조절"
        aria-orientation="vertical"
        aria-valuemin={SIDEBAR_WIDTH_MIN}
        aria-valuemax={SIDEBAR_WIDTH_MAX}
        aria-valuenow={Math.round(sidebarWidth)}
        tabIndex={0}
        onPointerDown={handleResizePointerDown}
        onKeyDown={handleResizeKeyDown}
        className={cn(
          'hover:bg-sidebar-border focus-visible:bg-sidebar-border absolute top-0 right-0 z-30 h-full w-1 translate-x-1/2 cursor-col-resize transition-colors duration-150 outline-none',
          isResizing && 'bg-sidebar-border',
        )}
      />
    </div>
  )
}

export { Sidebar }
export type { SidebarNavKey }
