import { existsSync, globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { MESSAGES } from '@/shared/constants/messages'

const SRC = join(process.cwd(), 'src')

/** 도메인을 가리지 않는 문구 묶음. shared는 여기까지만 안다. */
const NEUTRAL_DOMAINS = ['common', 'validation']

/**
 * shared에 남은 도메인 의존. 이 목록에 없는 위반은 실패로 잡는다.
 * 목록을 늘리지 말고 파일을 해당 계층으로 옮긴다.
 */
const DOMAIN_COUPLED_IN_SHARED = [
  // 앱 셸 위젯이라 도메인을 안다. 옮기는 작업은 #93.
  'shared/ui/sidebar.tsx',
]

/** `MESSAGES.project`처럼 도메인 묶음을 직접 짚는 표현. */
function domainReference() {
  const domains = Object.keys(MESSAGES).filter(
    (domain) => !NEUTRAL_DOMAINS.includes(domain),
  )
  return new RegExp(`MESSAGES\\.(${domains.join('|')})\\b`)
}

function sharedSourceFiles() {
  return globSync('shared/**/*.{ts,tsx}', { cwd: SRC })
    .map((path) => path.split(/[\\/]/).join('/'))
    .filter(
      (path) =>
        !path.includes('.test.') &&
        !path.includes('.stories.') &&
        !path.startsWith('shared/constants/messages/'),
    )
}

function read(path: string) {
  return readFileSync(join(SRC, path), 'utf8')
}

describe('FSD 계층 경계', () => {
  it('shared는 도메인 사전을 참조하지 않는다', () => {
    const pattern = domainReference()
    const offenders = sharedSourceFiles().filter(
      (path) =>
        !DOMAIN_COUPLED_IN_SHARED.includes(path) && pattern.test(read(path)),
    )

    expect(offenders).toEqual([])
  })

  it('허용 목록에 이미 정리된 파일을 남겨두지 않는다', () => {
    const pattern = domainReference()
    const stale = DOMAIN_COUPLED_IN_SHARED.filter(
      (path) => !pattern.test(read(path)),
    )

    expect(stale).toEqual([])
  })

  it('도메인 컴포넌트는 shared가 아니라 feature에 있다', () => {
    const relocated = {
      'shared/ui/canvas-top-bar.tsx':
        'features/whiteboard-editor/ui/CanvasTopBar.tsx',
      'shared/ui/user-picker.tsx': 'features/member/ui/UserPicker.tsx',
    }

    for (const [oldPath, newPath] of Object.entries(relocated)) {
      expect(existsSync(join(SRC, oldPath)), `${oldPath}는 없어야 한다`).toBe(
        false,
      )
      expect(existsSync(join(SRC, newPath)), `${newPath}가 있어야 한다`).toBe(
        true,
      )
    }
  })
})
