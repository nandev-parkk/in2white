import { MoreVertical } from 'lucide-react'

import type { WhiteboardDocument } from '@/entities/whiteboard-document'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

type WhiteboardDocumentMenuProps = {
  document: WhiteboardDocument
  onRename: (document: WhiteboardDocument) => void
  onDelete: (document: WhiteboardDocument) => void
}

function WhiteboardDocumentMenu({
  document,
  onRename,
  onDelete,
}: WhiteboardDocumentMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${document.name} 메뉴`}
          className="text-foreground-tertiary hover:bg-action-secondary-hover focus-visible:ring-action-focus-ring flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-3"
        >
          <MoreVertical className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onRename(document)}>
          이름 변경
        </DropdownMenuItem>
        <DropdownMenuItem variant="danger" onSelect={() => onDelete(document)}>
          삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { WhiteboardDocumentMenu }
