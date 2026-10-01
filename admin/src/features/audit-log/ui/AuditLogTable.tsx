import { useMemo } from 'react'
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'

import type { AdminAuditLog } from '@/entities/audit-log'
import { MESSAGES } from '@/shared/constants/messages'
import { formatDateTime } from '@/shared/lib/format-date'
import { Button } from '@in2white/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@in2white/ui/table'

import { targetTypeLabel } from '../lib/target-type-label'

const features = tableFeatures({})
const columnHelper = createColumnHelper<typeof features, AdminAuditLog>()

type AuditLogTableProps = {
  auditLogs: AdminAuditLog[]
  onFilterAdmin: (auditLog: AdminAuditLog) => void
  onSelectDetail: (auditLog: AdminAuditLog) => void
}

function AuditLogTable({
  auditLogs,
  onFilterAdmin,
  onSelectDetail,
}: AuditLogTableProps) {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('createdAt', {
          header: MESSAGES.auditLog.column.createdAt,
          cell: ({ row }) => (
            <span className="text-foreground-default whitespace-nowrap">
              {formatDateTime(row.original.createdAt)}
            </span>
          ),
        }),
        /*
         * 어드민 목록 API가 없다. 기록에 찍힌 어드민을 눌러 거르게 해서 uuid를 외워
         * 입력하지 않도록 한다.
         */
        columnHelper.accessor('admin', {
          header: MESSAGES.auditLog.column.admin,
          cell: ({ row }) => (
            <Button
              variant="ghost"
              aria-label={MESSAGES.auditLog.a11y.filterByAdmin(
                row.original.admin.name,
              )}
              className="-mx-2 h-auto justify-start px-2 py-1"
              onClick={() => onFilterAdmin(row.original)}
            >
              <span className="flex min-w-0 flex-col items-start">
                <span className="text-foreground-default truncate">
                  {row.original.admin.name}
                </span>
                <span className="text-foreground-secondary truncate text-[12px]">
                  {row.original.admin.email}
                </span>
              </span>
            </Button>
          ),
        }),
        columnHelper.accessor('action', {
          header: MESSAGES.auditLog.column.action,
          cell: ({ row }) => (
            <span className="text-foreground-strong truncate font-medium">
              {row.original.action}
            </span>
          ),
        }),
        columnHelper.accessor('targetType', {
          header: MESSAGES.auditLog.column.target,
          cell: ({ row }) => (
            <div className="flex min-w-0 flex-col">
              <span className="text-foreground-default truncate">
                {targetTypeLabel(row.original.targetType)}
              </span>
              <span className="text-foreground-tertiary truncate text-[12px]">
                {row.original.targetId ?? MESSAGES.auditLog.detail.noValue}
              </span>
            </div>
          ),
        }),
        columnHelper.accessor('summary', {
          header: MESSAGES.auditLog.column.summary,
          cell: ({ row }) => (
            <span className="text-foreground-default truncate">
              {row.original.summary}
            </span>
          ),
        }),
        columnHelper.display({
          id: 'actions',
          header: MESSAGES.auditLog.column.actions,
          /* 변경 전후 값은 표에 들어가지 않는다. 모달에서 펼쳐 본다. */
          cell: ({ row }) => (
            <Button
              variant="tertiary"
              aria-label={MESSAGES.auditLog.a11y.detail(row.original.action)}
              onClick={() => onSelectDetail(row.original)}
            >
              {MESSAGES.auditLog.action.detail}
            </Button>
          ),
        }),
      ]),
    [onFilterAdmin, onSelectDetail],
  )

  const table = useTable({ features, columns, data: auditLogs })

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

export { AuditLogTable }
