import { useMemo } from 'react'
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'

import type { AdminUser, AdminUserListItem } from '@/entities/user'
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

/*
 * 검색·필터·페이지네이션은 서버가 처리한다. 테이블은 받은 페이지를 그리는 역할만 하므로
 * 정렬·필터 기능을 등록하지 않는다 — 클라이언트 정렬을 켜면 현재 페이지 안에서만
 * 정렬돼 전체 순서와 다르게 보인다.
 */
const features = tableFeatures({})
const columnHelper = createColumnHelper<typeof features, AdminUserListItem>()

type UserTableProps = {
  users: AdminUserListItem[]
  onSelect: (user: AdminUserListItem) => void
}

function UserStatusBadge({ user }: { user: Pick<AdminUser, 'deactivatedAt'> }) {
  const deactivated = user.deactivatedAt !== null

  return (
    <Badge semantic={deactivated ? 'danger' : 'success'}>
      {deactivated
        ? MESSAGES.user.status.deactivated
        : MESSAGES.user.status.active}
    </Badge>
  )
}

function UserTable({ users, onSelect }: UserTableProps) {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: MESSAGES.user.column.name,
          cell: ({ row }) => (
            <button
              type="button"
              onClick={() => onSelect(row.original)}
              className="text-foreground-strong focus-visible:ring-action-focus-ring block w-full truncate rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-3"
            >
              {row.original.name}
            </button>
          ),
        }),
        columnHelper.accessor('email', {
          header: MESSAGES.user.column.email,
        }),
        columnHelper.accessor('deactivatedAt', {
          header: MESSAGES.user.column.status,
          cell: ({ row }) => <UserStatusBadge user={row.original} />,
        }),
        columnHelper.accessor('workspaceCount', {
          header: MESSAGES.user.column.workspaceCount,
        }),
        columnHelper.accessor('createdAt', {
          header: MESSAGES.user.column.createdAt,
          cell: ({ row }) => formatDate(row.original.createdAt),
        }),
      ]),
    [onSelect],
  )

  const table = useTable({ features, columns, data: users })

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

export { UserStatusBadge, UserTable }
