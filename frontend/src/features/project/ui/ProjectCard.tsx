import { CalendarDays, Clock3, Folder, MoreVertical } from 'lucide-react'
import { motion } from 'motion/react'

import type { Project } from '@/entities/project'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

import { useCardMotion } from '@/shared/lib/hooks/use-card-motion'
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
  const cardMotion = useCardMotion()

  return (
    <motion.article
      {...cardMotion}
      className="border-border bg-background-default flex min-h-[204px] min-w-0 flex-col rounded-md border p-4 transition-shadow duration-150 hover:shadow-md motion-reduce:transition-none"
    >
      <div className="flex items-center justify-between gap-2">
        <Folder className="text-foreground-default size-5" />
        {canManage && (
          <ProjectMenu project={project} onEdit={onEdit} onDelete={onDelete} />
        )}
      </div>

      <div className="mt-2 min-w-0 flex-1 pb-2">
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
        <p className="text-body text-foreground-secondary mt-2 line-clamp-2">
          {project.description || '설명 없음'}
        </p>
        <div className="text-caption text-foreground-tertiary mt-2 flex flex-col gap-1">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.25" />
            생성일 {formatCreatedAt(project.createdAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock3 className="size-3.25" />
            수정일 {formatUpdatedAt(project.updatedAt)}
          </span>
        </div>
      </div>

      <div className="border-border-subtle flex items-center justify-end gap-2 border-t pt-2">
        <Avatar size="small">
          <AvatarFallback size="small">
            {project.creator.name.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <span className="text-body-small text-foreground-secondary max-w-24 truncate">
          {project.creator.name}
        </span>
      </div>
    </motion.article>
  )
}

export { ProjectCard, ProjectMenu }
