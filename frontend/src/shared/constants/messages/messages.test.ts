import { describe, expect, it } from 'vitest'
import { MESSAGES } from './index'

type Leaf = string | ((...args: never[]) => string)

function collectLeaves(
  node: unknown,
  path: string[] = [],
  acc: { path: string; value: Leaf }[] = [],
) {
  if (typeof node === 'string' || typeof node === 'function') {
    acc.push({ path: path.join('.'), value: node as Leaf })
    return acc
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    collectLeaves(value, [...path, key], acc)
  }
  return acc
}

const leaves = collectLeaves(MESSAGES)

describe('MESSAGES 사전', () => {
  it('말단 값이 하나 이상 있다', () => {
    expect(leaves.length).toBeGreaterThan(0)
  })

  it('모든 말단 값이 비어 있지 않은 문자열이거나 함수다', () => {
    const invalid = leaves.filter(({ value }) =>
      typeof value === 'string'
        ? value.trim() === ''
        : typeof value !== 'function',
    )
    expect(invalid.map(({ path }) => path)).toEqual([])
  })

  it('같은 문자열이 서로 다른 두 경로에 존재하지 않는다', () => {
    const byValue = new Map<string, string[]>()
    for (const { path, value } of leaves) {
      if (typeof value !== 'string') continue
      byValue.set(value, [...(byValue.get(value) ?? []), path])
    }
    const duplicated = [...byValue.entries()]
      .filter(([, paths]) => paths.length > 1)
      .map(([value, paths]) => `${value} → ${paths.join(', ')}`)
    expect(duplicated).toEqual([])
  })
})
