import { useMemo } from 'react'
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'

import type { AdminProjectListItem } from '@/entities/project'
import { MESSAGES } from '@/shared/constants/messages'
import { formatDate } from '@/shared/lib/format-date'
import { Badge } from '@in2white/ui/badge'
import { Button } from '@in2white/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@in2white/ui/table'

/* 워크스페이스 표와 같다 — 검색·필터·페이지네이션을 서버가 하므로 기능을 등록하지 않는다. */
const features = tableFeatures({})
const columnHelper = createColumnHelper<typeof features, AdminProjectListItem>()

type ProjectTableProps = {
  projects: AdminProjectListItem[]
  onSelect: (project: AdminProjectListItem) => void
  onDelete: (project: AdminProjectListItem) => void
  onRestore: (project: AdminProjectListItem) => void
}

function ProjectTable({
  projects,
  onSelect,
  onDelete,
  onRestore,
}: ProjectTableProps) {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: MESSAGES.project.column.name,
          cell: ({ row }) => (
            <button
              type="button"
              onClick={() => onSelect(row.original)}
              className="text-foreground-strong focus-visible:ring-action-focus-ring max-w-full min-w-0 truncate rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-3"
            >
              {row.original.name}
            </button>
          ),
        }),
        columnHelper.accessor('workspace', {
          header: MESSAGES.project.column.workspace,
          cell: ({ row }) => row.original.workspace.name,
        }),
        columnHelper.accessor('creator', {
          header: MESSAGES.project.column.creator,
          cell: ({ row }) => (
            <div className="flex min-w-0 flex-col">
              <span className="text-foreground-default truncate">
                {row.original.creator.name}
              </span>
              <span className="text-foreground-secondary truncate text-[12px]">
                {row.original.creator.email}
              </span>
            </div>
          ),
        }),
        columnHelper.accessor('whiteboardDocumentCount', {
          header: MESSAGES.project.column.documentCount,
          cell: ({ row }) =>
            MESSAGES.project.detail.countSuffix(
              row.original.whiteboardDocumentCount,
            ),
        }),
        columnHelper.accessor('deletedAt', {
          header: MESSAGES.project.column.status,
          cell: ({ row }) => (
            <Badge
              semantic={row.original.deletedAt === null ? 'success' : 'neutral'}
            >
              {row.original.deletedAt === null
                ? MESSAGES.project.status.active
                : MESSAGES.project.status.deleted}
            </Badge>
          ),
        }),
        columnHelper.accessor('createdAt', {
          header: MESSAGES.project.column.createdAt,
          cell: ({ row }) => formatDate(row.original.createdAt),
        }),
        columnHelper.display({
          id: 'actions',
          header: MESSAGES.project.column.actions,
          /*
           * 삭제와 복구는 서로 배타적이다 — 둘 다 두면 이미 삭제된 프로젝트에 삭제를
           * 눌러 404를 받는다. 이름은 aria-label로 넣어 어느 행의 버튼인지 드러낸다.
           */
          cell: ({ row }) =>
            row.original.deletedAt === null ? (
              <Button
                variant="tertiary"
                aria-label={MESSAGES.project.a11y.delete(row.original.name)}
                onClick={() => onDelete(row.original)}
              >
                {MESSAGES.project.action.delete}
              </Button>
            ) : (
              <Button
                variant="tertiary"
                aria-label={MESSAGES.project.a11y.restore(row.original.name)}
                onClick={() => onRestore(row.original)}
              >
                {MESSAGES.project.action.restore}
              </Button>
            ),
        }),
      ]),
    [onDelete, onRestore, onSelect],
  )

  const table = useTable({ features, columns, data: projects })

  return (
    <Table className="min-w-[960px] table-fixed">
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder ? null : (
                  <table.FlexRender header={header} />
                )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id} className="hover:bg-background-subtle">
            {row.getAllCells().map((cell) => (
              <TableCell key={cell.id} className="truncate">
                <table.FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export { ProjectTable }
