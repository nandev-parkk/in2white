import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')

/*
 * 범용 프리미티브가 `@in2white/ui`로 옮겨가면서 같은 검사가 그 패키지로 함께
 * 갔다. 여기 남은 도메인 컴포넌트·위젯·페이지도 같은 규약을 지켜야 하므로
 * `client/src` 전체를 대상으로 다시 세운다.
 */
function sourceFiles() {
  return globSync('**/*.{ts,tsx}', { cwd: SRC })
    .map((path) => path.split(/[\\/]/).join('/'))
    .filter((path) => !path.includes('.test.'))
}

function read(path: string) {
  return readFileSync(join(SRC, path), 'utf8')
}

/** 디자인에서 걷어낸 아이콘. 다시 들어오면 시각 언어가 갈린다. */
const RETIRED_ICONS =
  /\b(CalendarPlus|CalendarClock|FolderOpen|SearchX|FileQuestion|MoreHorizontal)\b/

/** Lucide 외의 아이콘 공급원. */
const FOREIGN_ICON_LIBRARY =
  /from ['"][^'"]*(?:react-icons|heroicons|tabler\/icons|phosphor|iconify|radix-ui\/react-icons)[^'"]*['"]/i

describe('아이콘 계약', () => {
  it('걷어낸 아이콘을 다시 쓰지 않는다', () => {
    const offenders = sourceFiles().filter((path) =>
      RETIRED_ICONS.test(read(path)),
    )

    expect(offenders).toEqual([])
  })

  it('인라인 svg 대신 아이콘 컴포넌트를 쓴다', () => {
    const offenders = sourceFiles().filter((path) => /<svg\b/i.test(read(path)))

    expect(offenders).toEqual([])
  })

  it('Lucide 외의 아이콘 라이브러리를 들이지 않는다', () => {
    const offenders = sourceFiles().filter((path) =>
      FOREIGN_ICON_LIBRARY.test(read(path)),
    )

    expect(offenders).toEqual([])
  })
})
