import { MoreVertical } from 'lucide-react'

import type { WhiteboardDocument } from '@/entities/whiteboard-document'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@in2white/ui/dropdown-menu'
import { MESSAGES } from '@/shared/constants/messages'

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
          aria-label={MESSAGES.common.a11y.menu(document.name)}
          className="text-foreground-tertiary hover:bg-action-secondary-hover focus-visible:ring-action-focus-ring flex size-7 items-center justify-center rounded-md transition-colors duration-150 ease-out outline-none focus-visible:ring-3 motion-reduce:transition-none"
        >
          <MoreVertical className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onRename(document)}>
          {MESSAGES.whiteboard.action.rename}
        </DropdownMenuItem>
        <DropdownMenuItem variant="danger" onSelect={() => onDelete(document)}>
          {MESSAGES.common.action.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { WhiteboardDocumentMenu }
