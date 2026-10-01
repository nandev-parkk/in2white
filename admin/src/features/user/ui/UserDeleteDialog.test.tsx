import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { AdminUser, UserDeletionImpact } from '@/entities/user'

import { UserDeleteDialog } from './UserDeleteDialog'

const user: AdminUser = {
  id: 'user-1',
  name: 'Kim User',
  email: 'kim@example.com',
  deactivatedAt: null,
  createdAt: '2026-09-20T00:00:00.000Z',
}

const impact: UserDeletionImpact['impact'] = {
  ownedWorkspaceCount: 2,
  otherWorkspaceMembershipCount: 1,
  projectCount: 5,
  whiteboardDocumentCount: 12,
}

function renderDialog(onConfirm = vi.fn()) {
  render(
    <UserDeleteDialog
      open
      user={user}
      impact={impact}
      onOpenChange={vi.fn()}
      onConfirm={onConfirm}
    />,
  )

  return { onConfirm }
}

describe('UserDeleteDialog', () => {
  /* 하드 삭제는 되돌릴 수 없다. 함께 사라지는 범위를 먼저 보여주고 확인을 받는다. */
  it('연쇄 삭제될 리소스 수를 보여준다', () => {
    renderDialog()

    expect(screen.getByText('소유 워크스페이스 2개')).toBeInTheDocument()
    expect(screen.getByText('다른 워크스페이스 멤버십 1개')).toBeInTheDocument()
    expect(screen.getByText('프로젝트 5개')).toBeInTheDocument()
    expect(screen.getByText('화이트보드 문서 12개')).toBeInTheDocument()
  })

  it('이메일을 입력하기 전에는 삭제할 수 없다', () => {
    renderDialog()

    expect(screen.getByRole('button', { name: '계정 삭제' })).toBeDisabled()
  })

  it('다른 이메일을 입력하면 삭제 버튼이 잠긴 상태로 남는다', async () => {
    const { onConfirm } = renderDialog()

    await userEvent.type(
      screen.getByLabelText('확인용 이메일'),
      'other@example.com',
    )

    expect(screen.getByRole('button', { name: '계정 삭제' })).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('대상 이메일과 일치하면 삭제를 실행한다', async () => {
    const { onConfirm } = renderDialog()

    await userEvent.type(
      screen.getByLabelText('확인용 이메일'),
      '  Kim@Example.COM  ',
    )

    const deleteButton = screen.getByRole('button', { name: '계정 삭제' })
    expect(deleteButton).toBeEnabled()

    await userEvent.click(deleteButton)

    expect(onConfirm).toHaveBeenCalledWith('kim@example.com')
  })
})
