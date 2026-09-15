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
              프로젝트
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
            aria-label="프로젝트 목록으로"
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
                  aria-label={`${project.name} 메뉴`}
                  className="text-foreground-tertiary hover:bg-action-secondary-hover focus-visible:ring-action-focus-ring flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-3"
                >
                  <MoreVertical className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}>수정</DropdownMenuItem>
                <DropdownMenuItem variant="danger" onSelect={onDelete}>
                  삭제
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
          생성자 {project.creator.name}
        </span>
      </div>
    </header>
  )
}

export { ProjectDetailHeader }
