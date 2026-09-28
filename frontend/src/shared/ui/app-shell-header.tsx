import * as React from 'react'
import { cn } from '@/shared/lib/utils'
import { ChevronsUpDown } from 'lucide-react'
import { Search } from '@/shared/ui/search'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { MESSAGES } from '@/shared/constants/messages'

type AppShellHeaderProps = React.ComponentProps<'div'> & {
  workspaceName: string
  searchPlaceholder?: string
  userName: string
  userImageUrl?: string
  onSearchChange?: (value: string) => void
}

function AppShellHeader({
  className,
  workspaceName,
  searchPlaceholder = MESSAGES.project.form.searchLabel,
  userName,
  userImageUrl,
  onSearchChange,
  ...props
}: AppShellHeaderProps) {
  return (
    <div
      data-slot="app-shell-header"
      className={cn(
        'border-border-subtle bg-background-default flex items-center justify-between border-b px-(--layout-container-app-shell-padding-x) py-3',
        className,
      )}
      {...props}
    >
      <button type="button" className="flex items-center gap-1.5">
        <img
          src="/logo-mark.png"
          alt="in2white"
          className="size-6 rounded-sm"
        />
        <span className="text-heading3 text-foreground-strong">
          {workspaceName}
        </span>
        <ChevronsUpDown className="text-foreground-tertiary size-3.5" />
      </button>
      <div className="flex items-center gap-4">
        <Search
          placeholder={searchPlaceholder}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
        <Avatar size="default">
          {userImageUrl && <AvatarImage src={userImageUrl} alt={userName} />}
          <AvatarFallback size="default">{userName.slice(0, 2)}</AvatarFallback>
        </Avatar>
      </div>
    </div>
  )
}

export { AppShellHeader }
