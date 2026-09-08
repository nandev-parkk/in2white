import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)

    if (entry.isDirectory()) return collectSourceFiles(path)
    if (!/\.(?:ts|tsx)$/.test(entry.name)) return []
    if (/\.test\.(?:ts|tsx)$/.test(entry.name)) return []

    return [path]
  })
}

const iconSourceFiles = collectSourceFiles(
  resolve(process.cwd(), 'src/shared/ui'),
)

const iconSource = iconSourceFiles
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')

describe('Iconography', () => {
  it('uses Lucide icons across all shared UI source and stories', () => {
    expect(iconSource).not.toMatch(
      /CalendarPlus|CalendarClock|FolderOpen|SearchX|FileQuestion|MoreHorizontal/,
    )
    expect(iconSource).not.toMatch(/<svg\b/i)
    expect(iconSource).not.toMatch(
      /from ['"][^'"]*(?:react-icons|heroicons|tabler\/icons|phosphor|iconify|radix-ui\/react-icons)[^'"]*['"]/i,
    )
  })
})
