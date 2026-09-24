import { CalendarDays, Clock3, Folder, MoreVertical } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

import type { Project } from '@/entities/project'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

import { formatCreatedAt, formatUpdatedAt } from '@/shared/lib/resource-date'

type ProjectCardProps = {
  project: Project
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
  canManage?: boolean
  onOpen?: (project: Project) => void
}

function ProjectMenu({ project, onEdit, onDelete }: ProjectCardProps) {
  return (
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
        <DropdownMenuItem onSelect={() => onEdit(project)}>
          수정
        </DropdownMenuItem>
        <DropdownMenuItem variant="danger" onSelect={() => onDelete(project)}>
          삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ProjectCard({
  project,
  onEdit,
  onDelete,
  canManage = true,
  onOpen,
}: ProjectCardProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.article
      whileHover={prefersReducedMotion ? undefined : { y: -2 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
      transition={{ type: 'tween', duration: 0.16, ease: 'easeOut' }}
      className="border-border bg-background-default flex min-h-[204px] min-w-0 flex-col rounded-md border p-4 transition-shadow duration-150 hover:shadow-md motion-reduce:transition-none"
    >
      <div className="flex items-center justify-between gap-2">
        <Folder className="text-foreground-default size-4" />
        {canManage && (
          <ProjectMenu project={project} onEdit={onEdit} onDelete={onDelete} />
        )}
      </div>

      <div className="mt-3 min-w-0 flex-1 pb-3">
        <h2 className="text-card-title text-foreground-strong truncate">
          {onOpen ? (
            <button
              type="button"
              onClick={() => onOpen(project)}
              className="focus-visible:ring-action-focus-ring block w-full truncate rounded-sm text-left outline-none hover:underline focus-visible:ring-3"
            >
              {project.name}
            </button>
          ) : (
            project.name
          )}
        </h2>
        <p className="text-body text-foreground-secondary mt-1 line-clamp-2">
          {project.description || '설명 없음'}
        </p>
        <div className="text-caption text-foreground-tertiary mt-3 flex flex-col gap-1">
          <span className="flex items-center gap-1">
            <CalendarDays className="size-3" />
            생성일 {formatCreatedAt(project.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <Clock3 className="size-3" />
            수정일 {formatUpdatedAt(project.updatedAt)}
          </span>
        </div>
      </div>

      <div className="border-border-subtle flex items-center justify-end gap-2 border-t pt-3">
        <Avatar size="small">
          <AvatarFallback size="small">
            {project.creator.name.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <span className="text-caption text-foreground-secondary max-w-24 truncate">
          {project.creator.name}
        </span>
      </div>
    </motion.article>
  )
}

export { ProjectCard, ProjectMenu }
