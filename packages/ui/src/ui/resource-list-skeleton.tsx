import { Skeleton } from './skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table'
import type { ListView } from './view-toggle'
import { COMMON_MESSAGES } from '../constants/common-messages'

export function ListToolbarSkeleton() {
  return (
    <div
      data-slot="list-toolbar-skeleton"
      aria-hidden="true"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <Skeleton className="h-9 w-full max-w-80" />
      <Skeleton className="h-9 w-48 max-w-full" />
    </div>
  )
}

export function ResourceListSkeleton({
  view,
  kind,
}: {
  view: ListView
  kind: 'project' | 'whiteboard'
}) {
  if (view === 'table') {
    return (
      <div aria-hidden="true" className="min-w-0">
        <Table className="min-w-[1008px] table-fixed">
          <TableHeader>
            <TableRow>
              {[
                COMMON_MESSAGES.label.name,
                COMMON_MESSAGES.label.creator,
                COMMON_MESSAGES.label.createdAt,
                COMMON_MESSAGES.label.updatedAt,
                '',
              ].map((label, index) => (
                <TableHead
                  key={index}
                  className={
                    index === 0
                      ? 'w-[420px]'
                      : index === 4
                        ? 'w-12'
                        : 'w-[180px]'
                  }
                >
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }, (_, row) => (
              <TableRow key={row}>
                <TableCell>
                  <Skeleton className="h-5 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="size-4" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3 min-[1360px]:grid-cols-4"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          data-slot="resource-card-skeleton"
          className="border-border-subtle min-w-0 overflow-hidden rounded-md border"
        >
          {kind === 'whiteboard' && (
            <Skeleton
              data-slot="preview-skeleton"
              className="h-26 rounded-none"
            />
          )}
          <div className="flex flex-col gap-2 p-4">
            {kind === 'project' && <Skeleton className="mb-1 size-7" />}
            <Skeleton className="h-6 w-3/4" />
            {kind === 'project' && <Skeleton className="h-5 w-full" />}
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3.5 w-28" />
            </div>
            <div className="border-border-subtle mt-1 border-t pt-2">
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
