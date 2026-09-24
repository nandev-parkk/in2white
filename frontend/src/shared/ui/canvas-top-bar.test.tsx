import { render, screen, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import { CanvasTopBar } from './canvas-top-bar'

it('빈 더 보기 버튼 없이 참여자 아바타를 표시하고 참여자 변경을 반영한다', async () => {
  const users = [
    { id: 'me', name: '김민지', presenceIndex: 1 },
    { id: 'other', name: '박서연', presenceIndex: 2 },
    { id: 'third', name: '이준호', presenceIndex: 3 },
    { id: 'fourth', name: '최지은', presenceIndex: 4 },
  ]
  const { rerender } = render(
    <CanvasTopBar title="문서" saveStatus="saved" users={users} />,
  )
  expect(
    screen.queryByRole('button', { name: '더 보기' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: '김민지' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '박서연' })).toBeInTheDocument()
  expect(screen.getByText('+1')).toBeInTheDocument()

  rerender(<CanvasTopBar title="문서" saveStatus="saved" users={[users[0]]} />)
  expect(screen.getByRole('img', { name: '김민지' })).toBeInTheDocument()
  await waitFor(() =>
    expect(
      screen.queryByRole('img', { name: '박서연' }),
    ).not.toBeInTheDocument(),
  )
  expect(screen.queryByText('+1')).not.toBeInTheDocument()
})
