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

type SidebarProps = React.ComponentProps<'div'> & {
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  workspaceLoading?: boolean
  workspace: WorkspaceSummary | null
  workspaces: WorkspaceSummary[]
  selectedWorkspaceId: string | null
  onWorkspaceChange: (workspaceId: string) => void
  onCreateWorkspace: () => void
  workspaceMembers: PresenceUser[]
  activeNav: SidebarNavKey
  onNavChange: (key: SidebarNavKey) => void
  onInviteMember?: () => void
  onLogout?: () => void
  userName: string
  userEmail: string
  userImageUrl?: string
}

function WorkspaceMark({ name }: { name?: string }) {
  return (
    <span className="bg-action-primary text-action-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold">
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
}: {
  collapsed: boolean
  loading: boolean
  workspace: WorkspaceSummary | null
  workspaces: WorkspaceSummary[]
  selectedWorkspaceId: string | null
  onWorkspaceChange: (workspaceId: string) => void
  onCreateWorkspace: () => void
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
  }, [close, open])

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
          'focus-visible:ring-action-focus-ring hover:bg-action-secondary-hover flex items-center rounded-md outline-none focus-visible:ring-3',
          collapsed
            ? 'size-10 justify-center'
            : 'h-14 w-full justify-between gap-2 px-1',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <WorkspaceMark name={workspace?.name} />
          {!collapsed && loading && (
            <span className="text-body-small text-foreground-secondary truncate">
              워크스페이스 불러오는 중
            </span>
          )}
          {!collapsed && !loading && (
            <span className="flex min-w-0 flex-1 flex-col items-start">
              <span className="text-label text-foreground-strong max-w-32 truncate">
                {workspace?.name ?? '워크스페이스 없음'}
              </span>
              {workspace && (
                <span className="text-foreground-tertiary text-[11px]">
                  {workspace.role === 'owner' ? '소유자' : '멤버'}
                </span>
              )}
            </span>
          )}
        </span>
        {!collapsed && !loading && (
          <ChevronsUpDown className="text-foreground-tertiary size-4 shrink-0" />
        )}
      </button>

      {open && (
        <div
          data-slot="workspace-switcher-popover"
          className={cn(
            'border-border bg-background-elevated absolute z-50 flex h-80 w-68 flex-col gap-2 rounded-lg border p-3 shadow-lg',
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
              className="pl-9"
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
                    'focus-visible:ring-action-focus-ring hover:bg-action-secondary-hover flex h-11 w-full items-center gap-2 rounded-md px-2 text-left outline-none focus-visible:ring-3',
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

          <div className="bg-border-subtle h-px w-full shrink-0" />
          <button
            type="button"
            onClick={() => {
              onCreateWorkspace()
              close()
            }}
            className="text-body-small text-foreground-secondary hover:bg-action-secondary-hover focus-visible:ring-action-focus-ring flex h-9 shrink-0 items-center gap-2 rounded-md px-2 text-left outline-none focus-visible:ring-3"
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
  icon: Icon,
  label,
  active,
  trailing,
  onClick,
}: {
  collapsed?: boolean
  icon: React.ElementType
  label: string
  active?: boolean
  trailing?: React.ReactNode
  onClick: () => void
}) {
  const content = (
    <button
      type="button"
      aria-label={collapsed ? label : undefined}
      onClick={onClick}
      className={cn(
        'focus-visible:ring-action-focus-ring flex h-11 w-full items-center justify-between gap-2 rounded-md p-3 text-left outline-none focus-visible:ring-3',
        collapsed && 'justify-center',
        active ? 'bg-action-secondary' : 'hover:bg-action-secondary-hover',
      )}
    >
      <span className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" />
        {!collapsed && (
          <span
            className={cn(
              'text-body',
              active
                ? 'text-foreground-strong font-semibold'
                : 'text-foreground-secondary',
            )}
          >
            {label}
          </span>
        )}
      </span>
      {!collapsed && trailing}
    </button>
  )

  if (!collapsed) return content

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

function Sidebar({
  className,
  collapsed,
  onCollapsedChange,
  workspaceLoading = false,
  workspace,
  workspaces,
  selectedWorkspaceId,
  onWorkspaceChange,
  onCreateWorkspace,
  workspaceMembers,
  activeNav,
  onNavChange,
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

  return (
    <div
      {...props}
      data-slot="sidebar"
      role="complementary"
      aria-label="워크스페이스 사이드바"
      className={cn(
        'border-border-subtle bg-background-default relative flex h-full flex-col gap-3 border-r p-3',
        isCollapsed
          ? 'w-(--layout-sidebar-width-collapsed)'
          : 'w-(--layout-sidebar-width-expanded)',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => {
          const nextCollapsed = !isCollapsed
          if (!isControlled) setUncontrolledCollapsed(nextCollapsed)
          onCollapsedChange?.(nextCollapsed)
        }}
        aria-label={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
        className={cn(
          'text-foreground-tertiary hover:bg-action-secondary-hover flex size-6 items-center justify-center rounded-md',
          isCollapsed ? 'self-center' : 'absolute top-3 right-3',
        )}
      >
        <PanelLeft className="size-4" />
      </button>

      <div
        className={cn(
          'flex flex-col gap-2',
          isCollapsed ? 'items-center' : 'pr-8',
        )}
      >
        <img
          src="/logo-mark.png"
          alt="in2white"
          className="size-7 rounded-sm"
        />
        <WorkspaceSwitcher
          collapsed={isCollapsed}
          loading={workspaceLoading}
          workspace={workspace}
          workspaces={workspaces}
          selectedWorkspaceId={selectedWorkspaceId}
          onWorkspaceChange={onWorkspaceChange}
          onCreateWorkspace={onCreateWorkspace}
        />
        {!isCollapsed && (
          <>
            <div className="flex items-center">
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
          </>
        )}
      </div>

      <SidebarNavItem
        collapsed={isCollapsed}
        icon={Folder}
        label="프로젝트"
        active={activeNav === 'projects'}
        onClick={() => onNavChange('projects')}
      />
      <SidebarNavItem
        collapsed={isCollapsed}
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
        collapsed={isCollapsed}
        icon={SlidersHorizontal}
        label="설정"
        active={activeNav === 'settings'}
        onClick={() => onNavChange('settings')}
      />

      <div className="flex-1" />

      <SidebarNavItem
        collapsed={isCollapsed}
        icon={LogOut}
        label="로그아웃"
        onClick={() => onLogout?.()}
      />

      <div className="bg-border-subtle h-px w-full" />

      <div
        className={cn(
          'flex items-center gap-2 p-3',
          isCollapsed && 'justify-center p-0',
        )}
      >
        <Avatar size="default">
          {userImageUrl && <AvatarImage src={userImageUrl} alt={userName} />}
          <AvatarFallback size="default">{userName.slice(0, 2)}</AvatarFallback>
        </Avatar>
        {!isCollapsed && (
          <div className="flex min-w-0 flex-col">
            <span className="text-body-small text-foreground-strong truncate font-semibold">
              {userName}
            </span>
            <span className="text-caption text-foreground-tertiary truncate">
              {userEmail}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export { Sidebar }
export type { SidebarNavKey }
