import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { WorkspaceAccessDeniedPage } from './WorkspaceAccessDeniedPage'

describe('WorkspaceAccessDeniedPage', () => {
  it('Figma 권한 없음 화면의 문구와 기본 workspace 복귀 버튼을 표시한다', async () => {
    const onReturn = vi.fn()

    render(
      <WorkspaceAccessDeniedPage
        workspaceName="My Workspace"
        onReturn={onReturn}
      />,
    )

    const heading = screen.getByRole('heading', {
      name: '존재하지 않는 워크스페이스예요',
    })
    expect(heading).toBeInTheDocument()
    expect(heading).not.toHaveClass('whitespace-nowrap')
    expect(
      screen.getByText('입력한 워크스페이스를 찾을 수 없어요'),
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'My Workspace로 돌아가기' }),
    )

    expect(onReturn).toHaveBeenCalledOnce()
  })
})
