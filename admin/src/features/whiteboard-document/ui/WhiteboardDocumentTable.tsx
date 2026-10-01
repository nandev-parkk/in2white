import { useMemo } from 'react'
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'

import type { AdminWhiteboardDocument } from '@/entities/whiteboard-document'
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

const features = tableFeatures({})
const columnHelper = createColumnHelper<
  typeof features,
  AdminWhiteboardDocument
>()

type WhiteboardDocumentTableProps = {
  whiteboardDocuments: AdminWhiteboardDocument[]
  onDelete: (document: AdminWhiteboardDocument) => void
  onRestore: (document: AdminWhiteboardDocument) => void
}

function WhiteboardDocumentTable({
  whiteboardDocuments,
  onDelete,
  onRestore,
}: WhiteboardDocumentTableProps) {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: MESSAGES.whiteboardDocument.column.name,
          cell: ({ row }) => (
            <span className="text-foreground-strong truncate font-medium">
              {row.original.name}
            </span>
          ),
        }),
        columnHelper.accessor('project', {
          header: MESSAGES.whiteboardDocument.column.project,
          /*
           * 프로젝트가 삭제돼 있으면 문서를 복구해도 제품에서는 보이지 않는다. 복구 모달
           * 전에 표에서 먼저 알려야 어드민이 프로젝트부터 복구할지 판단할 수 있다.
           */
          cell: ({ row }) => (
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-foreground-default truncate">
                {row.original.project.name}
              </span>
              {row.original.project.deletedAt !== null && (
                <Badge semantic="neutral">
                  {MESSAGES.whiteboardDocument.badge.projectDeleted}
                </Badge>
              )}
            </div>
          ),
        }),
        columnHelper.accessor('workspace', {
          header: MESSAGES.whiteboardDocument.column.workspace,
          cell: ({ row }) => row.original.workspace.name,
        }),
        columnHelper.accessor('creator', {
          header: MESSAGES.whiteboardDocument.column.creator,
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
        columnHelper.accessor('deletedAt', {
          header: MESSAGES.whiteboardDocument.column.status,
          cell: ({ row }) => (
            <Badge
              semantic={row.original.deletedAt === null ? 'success' : 'neutral'}
            >
              {row.original.deletedAt === null
                ? MESSAGES.whiteboardDocument.status.active
                : MESSAGES.whiteboardDocument.status.deleted}
            </Badge>
          ),
        }),
        columnHelper.accessor('createdAt', {
          header: MESSAGES.whiteboardDocument.column.createdAt,
          cell: ({ row }) => formatDate(row.original.createdAt),
        }),
        columnHelper.display({
          id: 'actions',
          header: MESSAGES.whiteboardDocument.column.actions,
          cell: ({ row }) =>
            row.original.deletedAt === null ? (
              <Button
                variant="tertiary"
                aria-label={MESSAGES.whiteboardDocument.a11y.delete(
                  row.original.name,
                )}
                onClick={() => onDelete(row.original)}
              >
                {MESSAGES.whiteboardDocument.action.delete}
              </Button>
            ) : (
              <Button
                variant="tertiary"
                aria-label={MESSAGES.whiteboardDocument.a11y.restore(
                  row.original.name,
                )}
                onClick={() => onRestore(row.original)}
              >
                {MESSAGES.whiteboardDocument.action.restore}
              </Button>
            ),
        }),
      ]),
    [onDelete, onRestore],
  )

  const table = useTable({ features, columns, data: whiteboardDocuments })

  return (
    <Table className="min-w-[1040px] table-fixed">
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

export { WhiteboardDocumentTable }
