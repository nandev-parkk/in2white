import type { Project } from '@/entities/project'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

import {
  formatProjectCreatedAt,
  formatProjectUpdatedAt,
} from '../lib/project-date'
import { ProjectMenu } from './ProjectCard'

type ProjectTableProps = {
  projects: Project[]
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
  canManage?: (project: Project) => boolean
}

function ProjectTable({
  projects,
  onEdit,
  onDelete,
  canManage = () => true,
}: ProjectTableProps) {
  return (
    <Table className="min-w-[1008px] table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[420px]">이름</TableHead>
          <TableHead className="w-[180px]">생성자</TableHead>
          <TableHead className="w-[180px]">생성일</TableHead>
          <TableHead className="w-[180px]">수정일</TableHead>
          <TableHead className="w-12" aria-label="작업" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => (
          <TableRow key={project.id}>
            <TableCell>
              <span className="text-card-title text-foreground-strong block truncate">
                {project.name}
              </span>
            </TableCell>
            <TableCell>
              <span className="truncate">{project.creator.name}</span>
            </TableCell>
            <TableCell>
              <span className="whitespace-nowrap">
                {formatProjectCreatedAt(project.createdAt)}
              </span>
            </TableCell>
            <TableCell>
              <span className="whitespace-nowrap">
                {formatProjectUpdatedAt(project.updatedAt)}
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
