import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MESSAGES } from '@/shared/constants/messages'

import { WhiteboardDocumentFormDialog } from './WhiteboardDocumentFormDialog'

function renderDialog(
  overrides: Partial<
    React.ComponentProps<typeof WhiteboardDocumentFormDialog>
  > = {},
) {
  const props = {
    open: true,
    title: '새 화이트보드 만들기',
    submitLabel: '만들기',
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  }

  render(<WhiteboardDocumentFormDialog {...props} />)
  return props
}

describe('WhiteboardDocumentFormDialog', () => {
  it('이름이 비어 있으면 제출하지 않고 오류를 보여준다', async () => {
    const props = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: '만들기' }))

    expect(
      screen.getByText(MESSAGES.whiteboard.form.nameRequired),
    ).toBeInTheDocument()
    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('앞뒤 공백을 제거한 이름을 전달한다', async () => {
    const props = renderDialog()

    await userEvent.type(screen.getByLabelText('이름'), '  킥오프 화이트보드  ')
    await userEvent.click(screen.getByRole('button', { name: '만들기' }))

    expect(props.onSubmit).toHaveBeenCalledWith({ name: '킥오프 화이트보드' })
  })

  it('초기 이름을 입력값으로 채운다', () => {
    renderDialog({
      initialName: '로고 스케치 v2',
      title: '화이트보드 이름 변경',
      submitLabel: '저장',
    })

    expect(screen.getByLabelText('이름')).toHaveValue('로고 스케치 v2')
  })

  it('오류 문구를 보여준다', () => {
    renderDialog({ error: '화이트보드를 만들지 못했어요' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      '화이트보드를 만들지 못했어요',
    )
  })

  it('로딩 중에는 제출해도 onSubmit을 호출하지 않는다', async () => {
    const props = renderDialog({ loading: true, initialName: '킥오프' })

    await userEvent.click(screen.getByRole('button', { name: '만들기' }))

    expect(props.onSubmit).not.toHaveBeenCalled()
  })
})
