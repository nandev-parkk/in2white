import { useMemo } from 'react'
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'

import type { AdminWorkspaceListItem } from '@/entities/workspace'
import { MESSAGES } from '@/shared/constants/messages'
import { formatDate } from '@/shared/lib/format-date'
import { Badge } from '@in2white/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@in2white/ui/table'

/* 사용자 표와 같다 — 검색·페이지네이션을 서버가 하므로 정렬·필터 기능을 등록하지 않는다. */
const features = tableFeatures({})
const columnHelper = createColumnHelper<
  typeof features,
  AdminWorkspaceListItem
>()

type WorkspaceTableProps = {
  workspaces: AdminWorkspaceListItem[]
  onSelect: (workspace: AdminWorkspaceListItem) => void
}

function WorkspaceTable({ workspaces, onSelect }: WorkspaceTableProps) {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: MESSAGES.workspace.column.name,
          cell: ({ row }) => (
            <div className="flex min-w-0 items-center gap-2">
              {/* 배지를 버튼 밖에 두어 버튼 이름이 워크스페이스 이름만 남게 한다. */}
              <button
                type="button"
                onClick={() => onSelect(row.original)}
                className="text-foreground-strong focus-visible:ring-action-focus-ring min-w-0 truncate rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-3"
              >
                {row.original.name}
              </button>
              {row.original.isDefault && (
                <Badge semantic="neutral">
                  {MESSAGES.workspace.badge.default}
                </Badge>
              )}
            </div>
          ),
        }),
        columnHelper.accessor('owner', {
          header: MESSAGES.workspace.column.owner,
          cell: ({ row }) => (
            <div className="flex min-w-0 flex-col">
              <span className="text-foreground-default truncate">
                {row.original.owner.name}
              </span>
              <span className="text-foreground-secondary truncate text-[12px]">
                {row.original.owner.email}
              </span>
            </div>
          ),
        }),
        columnHelper.accessor('memberCount', {
          header: MESSAGES.workspace.column.memberCount,
        }),
        columnHelper.accessor('projectCount', {
          header: MESSAGES.workspace.column.projectCount,
        }),
        columnHelper.accessor('createdAt', {
          header: MESSAGES.workspace.column.createdAt,
          cell: ({ row }) => formatDate(row.original.createdAt),
        }),
      ]),
    [onSelect],
  )

  const table = useTable({ features, columns, data: workspaces })

  return (
    <Table className="min-w-[840px] table-fixed">
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

export { WorkspaceTable }
