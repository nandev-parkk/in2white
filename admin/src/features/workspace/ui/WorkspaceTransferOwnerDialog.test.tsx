import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { AdminWorkspaceMember } from '@/entities/workspace'

import { WorkspaceTransferOwnerDialog } from './WorkspaceTransferOwnerDialog'

const owner: AdminWorkspaceMember = {
  userId: 'user-1',
  name: '김하나',
  email: 'hana@in2white.team',
  deactivatedAt: null,
  role: 'owner',
  joinedAt: '2026-09-20T00:00:00.000Z',
}

const member: AdminWorkspaceMember = {
  userId: 'user-2',
  name: '이두리',
  email: 'duri@in2white.team',
  deactivatedAt: null,
  role: 'member',
  joinedAt: '2026-09-21T00:00:00.000Z',
}

function renderDialog(members: AdminWorkspaceMember[], onSubmit = vi.fn()) {
  render(
    <WorkspaceTransferOwnerDialog
      open
      members={members}
      onOpenChange={vi.fn()}
      onSubmit={onSubmit}
    />,
  )

  return { onSubmit }
}

/* Radix Select는 jsdom에 없는 포인터 API를 쓴다. */
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {}
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
})

describe('WorkspaceTransferOwnerDialog', () => {
  /* 백엔드는 멤버가 아닌 대상을 400으로 막는다. 화면이 후보를 멤버로 제한해야 헛요청이 없다. */
  it('현재 소유자를 제외한 멤버만 후보로 보여준다', async () => {
    renderDialog([owner, member])

    await userEvent.click(screen.getByRole('combobox', { name: '새 소유자' }))

    expect(
      await screen.findByRole('option', {
        name: '이두리 (duri@in2white.team)',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: '김하나 (hana@in2white.team)' }),
    ).not.toBeInTheDocument()
  })

  it('멤버를 고르고 이전하면 해당 사용자 id를 전달한다', async () => {
    const { onSubmit } = renderDialog([owner, member])

    await userEvent.click(screen.getByRole('combobox', { name: '새 소유자' }))
    await userEvent.click(
      await screen.findByRole('option', {
        name: '이두리 (duri@in2white.team)',
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: '이전' }))

    expect(onSubmit).toHaveBeenCalledWith('user-2')
  })

  it('멤버를 고르기 전에는 이전할 수 없다', () => {
    renderDialog([owner, member])

    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled()
  })

  it('소유자뿐이면 이전할 멤버가 없다고 알린다', () => {
    renderDialog([owner])

    expect(screen.getByText('이전할 수 있는 멤버가 없어요')).toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: '새 소유자' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled()
  })
})
