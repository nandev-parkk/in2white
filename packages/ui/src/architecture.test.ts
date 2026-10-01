import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')

function sourceFiles(pattern: string) {
  return globSync(pattern, { cwd: SRC })
    .map((path) => path.split(/[\\/]/).join('/'))
    .filter((path) => !path.includes('.test.') && !path.includes('.stories.'))
}

function read(path: string) {
  return readFileSync(join(SRC, path), 'utf8')
}

/*
 * 이 패키지는 제품 도메인을 몰라야 한다. 도메인 문구가 들어오는 순간
 * 어드민을 포함한 다른 앱이 화이트보드 용어를 끌고 오게 된다.
 */
describe('공유 패키지 경계', () => {
  it('제품 도메인 문구 사전을 참조하지 않는다', () => {
    const offenders = sourceFiles('**/*.{ts,tsx}').filter((path) =>
      /\bMESSAGES\b/.test(read(path)),
    )

    expect(offenders).toEqual([])
  })
})

/** Tailwind 전환 유틸. framer-motion의 `transition={...}` prop과 섞이지 않게 좁힌다. */
const TRANSITION_UTILITY = /transition-(colors|shadow|transform|all|\[)/

/** `animate-spin`처럼 키프레임을 도는 유틸. */
const ANIMATE_UTILITY = /["' ]animate-(spin|pulse|bounce|in|out)\b/

/*
 * 이 저장소는 움직이는 모든 곳에 prefers-reduced-motion 예외를 함께 붙인다.
 * 한 곳이라도 빠지면 모션을 끈 사용자에게 그 컴포넌트만 움직인다.
 */
describe('모션 계약', () => {
  it('전환을 쓰는 파일은 reduced-motion 예외를 함께 쓴다', () => {
    const offenders = sourceFiles('**/*.tsx').filter((path) => {
      const source = read(path)
      return (
        TRANSITION_UTILITY.test(source) && !source.includes('motion-reduce:')
      )
    })

    expect(offenders).toEqual([])
  })

  it('키프레임 애니메이션을 쓰는 파일도 reduced-motion 예외를 쓴다', () => {
    const offenders = sourceFiles('**/*.tsx').filter((path) => {
      const source = read(path)
      return ANIMATE_UTILITY.test(source) && !source.includes('motion-reduce:')
    })

    expect(offenders).toEqual([])
  })
})
