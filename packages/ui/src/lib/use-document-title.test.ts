import { renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'

import { useDocumentTitle } from './use-document-title'

it('페이지 이동·이름 변경에 맞춰 제목을 갱신하고 해제 시 기본 제목을 복구한다', () => {
  document.title = 'in2white'
  const { rerender, unmount } = renderHook(
    ({ title }) => useDocumentTitle(title),
    { initialProps: { title: 'in2white | 프로젝트' } },
  )
  expect(document.title).toBe('in2white | 프로젝트')
  rerender({ title: 'in2white | 서비스 기획' })
  expect(document.title).toBe('in2white | 서비스 기획')
  rerender({ title: 'in2white | 수정된 문서명' })
  expect(document.title).toBe('in2white | 수정된 문서명')
  unmount()
  expect(document.title).toBe('in2white')
})
