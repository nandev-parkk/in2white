import { render, screen, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import { PresenceAvatarStack } from './presence-avatar-stack'

it('참여자가 나가면 퇴장 모션 뒤 아바타를 제거한다', async () => {
  const users = [
    { id: 'first', name: '김민지', presenceIndex: 1 },
    { id: 'leaving', name: '박서연', presenceIndex: 2 },
  ]
  const { rerender } = render(<PresenceAvatarStack users={users} />)

  rerender(<PresenceAvatarStack users={[users[0]]} />)
  expect(screen.getByRole('img', { name: '박서연' })).toBeInTheDocument()
  await waitFor(
    () =>
      expect(
        screen.queryByRole('img', { name: '박서연' }),
      ).not.toBeInTheDocument(),
    { timeout: 1500 },
  )
})
