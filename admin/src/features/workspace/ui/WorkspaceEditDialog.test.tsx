import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { AdminWorkspaceSummary } from '@/entities/workspace'

import { WorkspaceEditDialog } from './WorkspaceEditDialog'

const workspace: AdminWorkspaceSummary = {
  id: 'workspace-1',
  name: '디자인팀',
  isDefault: false,
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-21T00:00:00.000Z',
}

function renderDialog(onSubmit = vi.fn()) {
  render(
    <WorkspaceEditDialog
      open
      workspace={workspace}
      onOpenChange={vi.fn()}
      onSubmit={onSubmit}
    />,
  )

  return { onSubmit }
}

describe('WorkspaceEditDialog', () => {
  it('현재 이름으로 채워 보여준다', () => {
    renderDialog()

    expect(screen.getByLabelText('워크스페이스 이름')).toHaveValue('디자인팀')
  })

  it('바꾼 이름을 보낸다', async () => {
    const { onSubmit } = renderDialog()

    await userEvent.clear(screen.getByLabelText('워크스페이스 이름'))
    await userEvent.type(screen.getByLabelText('워크스페이스 이름'), '브랜드팀')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(onSubmit).toHaveBeenCalledWith({ name: '브랜드팀' })
  })

  /* 같은 이름을 다시 보내면 감사 로그에 변경 없는 기록만 쌓인다. */
  it('바꾼 내용이 없으면 저장하지 않고 안내를 보여준다', async () => {
    const { onSubmit } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(
      await screen.findByText('변경할 이름을 입력해주세요'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('공백만 덧붙인 수정도 저장하지 않는다', async () => {
    const { onSubmit } = renderDialog()

    await userEvent.type(screen.getByLabelText('워크스페이스 이름'), '   ')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(
      await screen.findByText('변경할 이름을 입력해주세요'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
