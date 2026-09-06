import * as React from 'react'
import { cn } from 'cn'
import {
  ChevronsUpDown,
  Folder,
  LogOut,
  PanelLeft,
  SlidersHorizontal,
  UserPlus,
  Users,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import type { PresenceUser } from '@/shared/ui/presence-avatar-stack'

type SidebarNavKey = 'projects' | 'members' | 'settings'

type SidebarProps = React.ComponentProps<'div'> & {
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  workspaceName: string
  workspaceMembers: PresenceUser[]
  activeNav: SidebarNavKey
  onNavChange: (key: SidebarNavKey) => void
  onInviteMember?: () => void
  onLogout?: () => void
  userName: string
  userEmail: string
  userImageUrl?: string
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
  collapsed = false,
  onCollapsedChange,
  workspaceName,
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
  return (
    <div
      data-slot="sidebar"
      className={cn(
        'border-border-subtle bg-background-default relative flex h-full flex-col gap-3 border-r p-3',
        collapsed
          ? 'w-(--layout-sidebar-width-collapsed)'
          : 'w-(--layout-sidebar-width-expanded)',
        className,
      )}
      {...props}
    >
      <button
        type="button"
        onClick={() => onCollapsedChange?.(!collapsed)}
        aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        className={cn(
          'text-foreground-tertiary hover:bg-action-secondary-hover flex size-6 items-center justify-center rounded-md',
          collapsed ? 'self-center' : 'absolute top-3 right-3',
        )}
      >
        <PanelLeft className="size-4" />
      </button>

      <div
        className={cn(
          'flex flex-col gap-2',
          collapsed ? 'items-center' : 'pr-8',
        )}
      >
        <div className="bg-action-primary size-9 rounded-lg" />
        {!collapsed && (
          <>
            <button
              type="button"
              className="hover:bg-action-secondary-hover flex h-10 w-full items-center justify-between gap-2 rounded-md"
            >
              <span className="flex min-w-0 flex-1 flex-col items-start">
                <span className="text-label text-foreground-strong truncate">
                  {workspaceName}
                </span>
                <span className="text-foreground-tertiary text-[11px]">
                  소유자
                </span>
              </span>
              <ChevronsUpDown className="text-foreground-tertiary size-4 shrink-0" />
            </button>
            <div className="flex items-center">
              {workspaceMembers.slice(0, 3).map((member) => (
                <Avatar
                  key={member.id}
                  size="small"
                  className="ring-1.5 ring-background-default -mr-1"
                >
                  {member.imageUrl && (
                    <AvatarImage src={member.imageUrl} alt={member.name} />
                  )}
                  <AvatarFallback size="small">
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
        collapsed={collapsed}
        icon={Folder}
        label="프로젝트"
        active={activeNav === 'projects'}
        onClick={() => onNavChange('projects')}
      />
      <SidebarNavItem
        collapsed={collapsed}
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
        collapsed={collapsed}
        icon={SlidersHorizontal}
        label="설정"
        active={activeNav === 'settings'}
        onClick={() => onNavChange('settings')}
      />

      <div className="flex-1" />

      <SidebarNavItem
        collapsed={collapsed}
        icon={LogOut}
        label="로그아웃"
        onClick={() => onLogout?.()}
      />

      <div className="bg-border-subtle h-px w-full" />

      <div
        className={cn(
          'flex items-center gap-2 p-3',
          collapsed && 'justify-center p-0',
        )}
      >
        <Avatar size="default">
          {userImageUrl && <AvatarImage src={userImageUrl} alt={userName} />}
          <AvatarFallback size="default">{userName.slice(0, 2)}</AvatarFallback>
        </Avatar>
        {!collapsed && (
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
