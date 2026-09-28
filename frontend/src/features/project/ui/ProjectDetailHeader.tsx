import { ArrowLeft, MoreVertical } from 'lucide-react'

import type { Project } from '@/entities/project'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { MESSAGES } from '@/shared/constants/messages'

type ProjectDetailHeaderProps = {
  project: Project
  canManage: boolean
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
}

function ProjectDetailHeader({
  project,
  canManage,
  onBack,
  onEdit,
  onDelete,
}: ProjectDetailHeaderProps) {
  return (
    <header className="flex flex-col gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              href="#"
              onClick={(event) => {
                event.preventDefault()
                onBack()
              }}
            >
              {MESSAGES.project.heading.list}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{project.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={MESSAGES.project.action.backToList}
            onClick={onBack}
            className="text-foreground-secondary hover:bg-action-secondary-hover focus-visible:ring-action-focus-ring flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-3"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-heading1 text-foreground-strong min-w-0 flex-1 truncate">
            {project.name}
          </h1>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={MESSAGES.common.a11y.menu(project.name)}
                  className="text-foreground-tertiary hover:bg-action-secondary-hover focus-visible:ring-action-focus-ring flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-3"
                >
                  <MoreVertical className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}>
                  {MESSAGES.common.action.edit}
                </DropdownMenuItem>
                <DropdownMenuItem variant="danger" onSelect={onDelete}>
                  {MESSAGES.common.action.delete}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {project.description && (
          <p className="text-body text-foreground-secondary">
            {project.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Avatar size="small">
          <AvatarFallback size="small">
            {project.creator.name.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <span className="text-body text-foreground-secondary">
          {MESSAGES.common.label.creator} {project.creator.name}
        </span>
      </div>
    </header>
  )
}

export { ProjectDetailHeader }
