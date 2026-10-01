import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { AdminUser } from '@/entities/user'

import { UserEditDialog } from './UserEditDialog'

const user: AdminUser = {
  id: 'user-1',
  name: '김하나',
  email: 'hana@in2white.team',
  deactivatedAt: null,
  createdAt: '2026-09-20T01:00:00.000Z',
}

function renderDialog(onSubmit = vi.fn()) {
  render(
    <UserEditDialog
      open
      user={user}
      onOpenChange={vi.fn()}
      onSubmit={onSubmit}
    />,
  )

  return { onSubmit }
}

describe('UserEditDialog', () => {
  it('현재 이메일과 이름으로 채워 보여준다', () => {
    renderDialog()

    expect(screen.getByLabelText('이메일')).toHaveValue('hana@in2white.team')
    expect(screen.getByLabelText('이름')).toHaveValue('김하나')
  })

  it('바뀐 항목만 보낸다', async () => {
    const { onSubmit } = renderDialog()

    await userEvent.clear(screen.getByLabelText('이름'))
    await userEvent.type(screen.getByLabelText('이름'), '김하늘')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(onSubmit).toHaveBeenCalledWith({ name: '김하늘' })
  })

  it('바꾼 내용이 없으면 저장하지 않고 안내를 보여준다', async () => {
    const { onSubmit } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(
      await screen.findByText('수정할 내용을 입력해주세요'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('공백만 덧붙인 수정도 저장하지 않는다', async () => {
    const { onSubmit } = renderDialog()

    await userEvent.type(screen.getByLabelText('이름'), '   ')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(
      await screen.findByText('수정할 내용을 입력해주세요'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
