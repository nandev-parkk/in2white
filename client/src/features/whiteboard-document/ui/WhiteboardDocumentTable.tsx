import type { WhiteboardDocument } from '@/entities/whiteboard-document'
import { formatCreatedAt, formatUpdatedAt } from '@/shared/lib/resource-date'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@in2white/ui/table'

import { WhiteboardDocumentMenu } from './WhiteboardDocumentMenu'
import { MESSAGES } from '@/shared/constants/messages'

type WhiteboardDocumentTableProps = {
  documents: WhiteboardDocument[]
  onOpen?: (documentId: string) => void
  onRename: (document: WhiteboardDocument) => void
  onDelete: (document: WhiteboardDocument) => void
  canManage?: (document: WhiteboardDocument) => boolean
}

function WhiteboardDocumentTable({
  documents,
  onOpen,
  onRename,
  onDelete,
  canManage = () => true,
}: WhiteboardDocumentTableProps) {
  return (
    <Table className="min-w-[1008px] table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[420px]">
            {MESSAGES.common.label.name}
          </TableHead>
          <TableHead className="w-[180px]">
            {MESSAGES.common.label.creator}
          </TableHead>
          <TableHead className="w-[180px]">
            {MESSAGES.common.label.createdAt}
          </TableHead>
          <TableHead className="w-[180px]">
            {MESSAGES.common.label.updatedAt}
          </TableHead>
          <TableHead
            className="w-12"
            aria-label={MESSAGES.common.a11y.rowActions}
          />
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((document) => (
          <TableRow key={document.id} className="hover:bg-background-subtle">
            <TableCell>
              <span className="text-card-title text-foreground-strong block truncate">
                {onOpen ? (
                  <button
                    type="button"
                    className="text-left hover:underline focus-visible:outline-2"
                    onClick={() => onOpen(document.id)}
                  >
                    {document.name}
                  </button>
                ) : (
                  document.name
                )}
              </span>
            </TableCell>
            <TableCell>
              <span className="truncate">{document.creator.name}</span>
            </TableCell>
            <TableCell>
              <span className="whitespace-nowrap">
                {formatCreatedAt(document.createdAt)}
              </span>
            </TableCell>
            <TableCell>
              <span className="whitespace-nowrap">
                {formatUpdatedAt(document.updatedAt)}
              </span>
            </TableCell>
            <TableCell>
              {canManage(document) && (
                <WhiteboardDocumentMenu
                  document={document}
                  onRename={onRename}
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

export { WhiteboardDocumentTable }
