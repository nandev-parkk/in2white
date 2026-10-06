import { describe, expect, it } from 'vitest'
import { diffScene, mergeScene, nextBatch, isSaved } from './scene-sync'

const shape = (
  id: string,
  version = 1,
  versionNonce = 1,
  isDeleted = false,
) => ({ id, version, versionNonce, isDeleted })
const file = (version = 0) => ({
  id: 'image',
  dataURL: 'data:image/png;base64,AA==',
  mimeType: 'image/png',
  created: 1,
  version,
})

describe('장면 동기화', () => {
  it('요소 index가 바뀌면 배열 순서도 바꿔 앞뒤 배치를 복원한다', () => {
    const base = {
      elements: [
        { ...shape('a'), index: 'a0' },
        { ...shape('b'), index: 'a1' },
      ],
    }
    const moved = { ...shape('a', 2), index: 'a2' }
    expect(
      mergeScene(base, { elements: [moved] }).elements.map(
        (element) => element.id,
      ),
    ).toEqual(['b', 'a'])
    expect(
      mergeScene(
        { elements: [moved, base.elements[1]] },
        { elements: [] },
      ).elements.map((element) => element.id),
    ).toEqual(['b', 'a'])
  })
  it('서로 다른 요소와 삭제를 보존하고 오래된 응답이 새 편집을 덮지 않는다', () => {
    const merged = mergeScene(
      { elements: [shape('a', 3), shape('b')] },
      { elements: [shape('a', 2), shape('b', 2, 1, true), shape('c')] },
    )
    expect(merged.elements).toEqual([
      shape('a', 3),
      shape('b', 2, 1, true),
      shape('c'),
    ])
  })
  it('서버와 같은 nonce 우선순위로 충돌을 해결한다', () => {
    expect(
      mergeScene(
        { elements: [shape('a', 1, 5)] },
        { elements: [shape('a', 1, 4)] },
      ).elements,
    ).toEqual([shape('a', 1, 5)])
  })
  it('변경된 요소·파일만 전송하고 lastRetrieved 변화는 무시한다', () => {
    const base = { elements: [shape('a')], files: { image: file() } }
    expect(
      diffScene(base, {
        ...base,
        files: { image: { ...file(), lastRetrieved: 2 } },
      }),
    ).toEqual({ elements: [] })
    expect(
      diffScene(base, { elements: [shape('a', 2)], files: { image: file(1) } }),
    ).toEqual({ elements: [shape('a', 2)], fileUpdates: { image: file(1) } })
  })
  it('pending이 있거나 실제 저장 revision이 뒤처지면 저장됨이 아니다', () => {
    expect(isSaved(2, 1, false)).toBe(false)
    expect(isSaved(2, 2, true)).toBe(false)
    expect(isSaved(2, 2, false)).toBe(true)
  })
  it('큰 변경을 분할하고 단일 초과 파일을 명시적으로 거부한다', () => {
    const delta = {
      elements: Array.from({ length: 2001 }, (_, i) => shape(String(i))),
    }
    expect(nextBatch(delta).elements).toHaveLength(2000)
    expect(() =>
      nextBatch({
        elements: [],
        fileUpdates: { image: { ...file(), dataURL: 'x'.repeat(1_048_576) } },
      }),
    ).toThrow()
  })
})
