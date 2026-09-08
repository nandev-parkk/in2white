import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const iconSources = [
  'src/shared/ui/app-shell-header.tsx',
  'src/shared/ui/card.stories.tsx',
  'src/shared/ui/empty-state.stories.tsx',
  'src/shared/ui/list-cell.stories.tsx',
  'src/shared/ui/sidebar.tsx',
  'src/shared/ui/whiteboard-card.tsx',
]

describe('Iconography', () => {
  it('uses the canonical Lucide icons documented for the shared UI', () => {
    const source = iconSources
      .map((file) => readFileSync(resolve(process.cwd(), file), 'utf8'))
      .join('\n')

    expect(source).not.toMatch(
      /CalendarPlus|CalendarClock|FolderOpen|SearchX|FileQuestion|MoreHorizontal/,
    )
  })
})
