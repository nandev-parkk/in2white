import type { Project } from '@/entities/project'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

import { formatCreatedAt, formatUpdatedAt } from '@/shared/lib/resource-date'
import { ProjectMenu } from './ProjectCard'

type ProjectTableProps = {
  projects: Project[]
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
  canManage?: (project: Project) => boolean
  onOpen?: (project: Project) => void
}

function ProjectTable({
  projects,
  onEdit,
  onDelete,
  canManage = () => true,
  onOpen,
}: ProjectTableProps) {
  return (
    <Table className="min-w-[1008px] table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead>이름</TableHead>
          <TableHead className="w-[180px]">생성자</TableHead>
          <TableHead className="w-[180px] text-right">생성일</TableHead>
          <TableHead className="w-[180px] text-right">수정일</TableHead>
          <TableHead className="w-12" aria-label="작업" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => (
          <TableRow key={project.id}>
            <TableCell>
              {onOpen ? (
                <button
                  type="button"
                  onClick={() => onOpen(project)}
                  className="text-card-title text-foreground-strong focus-visible:ring-action-focus-ring block w-full truncate rounded-sm text-left outline-none hover:underline focus-visible:ring-3"
                >
                  {project.name}
                </button>
              ) : (
                <span className="text-card-title text-foreground-strong block truncate">
                  {project.name}
                </span>
              )}
            </TableCell>
            <TableCell>
              <span className="truncate">{project.creator.name}</span>
            </TableCell>
            <TableCell className="text-right">
              <span className="whitespace-nowrap">
                {formatCreatedAt(project.createdAt)}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <span className="whitespace-nowrap">
                {formatUpdatedAt(project.updatedAt)}
              </span>
            </TableCell>
            <TableCell>
              {canManage(project) && (
                <ProjectMenu
                  project={project}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export { ProjectTable }
