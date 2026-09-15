import type { WhiteboardDocument } from '@/entities/whiteboard-document'
import { formatCreatedAt, formatUpdatedAt } from '@/shared/lib/resource-date'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

import { WhiteboardDocumentMenu } from './WhiteboardDocumentMenu'

type WhiteboardDocumentTableProps = {
  documents: WhiteboardDocument[]
  onRename: (document: WhiteboardDocument) => void
  onDelete: (document: WhiteboardDocument) => void
  canManage?: (document: WhiteboardDocument) => boolean
}

function WhiteboardDocumentTable({
  documents,
  onRename,
  onDelete,
  canManage = () => true,
}: WhiteboardDocumentTableProps) {
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
        {documents.map((document) => (
          <TableRow key={document.id}>
            <TableCell>
              <span className="text-card-title text-foreground-strong block truncate">
                {document.name}
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
