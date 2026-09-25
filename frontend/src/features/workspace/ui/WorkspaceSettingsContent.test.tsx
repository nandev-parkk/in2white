import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkspaceSummary } from '@/entities/workspace'
import { useDeleteWorkspace, useUpdateWorkspace } from '@/features/workspace'
import { toast } from '@/shared/ui/toast'

import { WorkspaceSettingsContent } from './WorkspaceSettingsContent'

vi.mock('@/features/workspace', () => ({
  useDeleteWorkspace: vi.fn(),
  useUpdateWorkspace: vi.fn(),
}))

vi.mock('@/shared/ui/toast', () => ({
  toast: { success: vi.fn() },
}))

const workspaceFixture: WorkspaceSummary = {
  id: 'workspace-1',
  name: '브랜드 스튜디오',
  ownerId: 'user-1',
  isDefault: false,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  role: 'owner',
}

const updateMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
  error: null as Error | null,
}
const deleteMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
  error: null as Error | null,
}

function renderContent(
  workspace = workspaceFixture,
  onDeleted = vi.fn(),
) {
  return render(
    <WorkspaceSettingsContent
      workspace={workspace}
      accessToken="token-1"
      onDeleted={onDeleted}
    />,
  )
}

describe('WorkspaceSettingsContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateMutation.isPending = false
    updateMutation.error = null
    updateMutation.mutateAsync.mockResolvedValue(workspaceFixture)
    deleteMutation.isPending = false
    deleteMutation.error = null
    deleteMutation.mutateAsync.mockResolvedValue(undefined)
    vi.mocked(useUpdateWorkspace).mockReturnValue(updateMutation as never)
    vi.mocked(useDeleteWorkspace).mockReturnValue(deleteMutation as never)
  })

  it('현재 workspace 이름을 입력값으로 표시하고 변경이 없으면 저장을 막는다', () => {
    renderContent()

    expect(screen.getByRole('textbox', { name: '워크스페이스 이름' })).toHaveValue(
      workspaceFixture.name,
    )
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
    expect(useUpdateWorkspace).toHaveBeenCalledWith('token-1')
  })

  it('trim 결과가 비어 있거나 255자를 넘으면 저장을 막는다', () => {
    renderContent()
    const input = screen.getByRole('textbox', { name: '워크스페이스 이름' })
    const saveButton = screen.getByRole('button', { name: '저장' })

    fireEvent.change(input, { target: { value: '   ' } })
    expect(saveButton).toBeDisabled()

    fireEvent.change(input, { target: { value: 'a'.repeat(256) } })
    expect(saveButton).toBeDisabled()
  })

  it('저장 시 trim한 이름과 현재 workspace ID를 전달한다', async () => {
    const user = userEvent.setup()
    renderContent()
    const input = screen.getByRole('textbox', { name: '워크스페이스 이름' })

    await user.clear(input)
    await user.type(input, '  새 이름  ')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() =>
      expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
        workspaceId: workspaceFixture.id,
        name: '새 이름',
      }),
    )
    expect(toast.success).toHaveBeenCalledWith('워크스페이스 이름을 변경했어요')
  })

  it('이름 저장 중에는 저장 버튼을 비활성화한다', () => {
    updateMutation.isPending = true
    renderContent()
    fireEvent.change(screen.getByRole('textbox', { name: '워크스페이스 이름' }), {
      target: { value: '새 이름' },
    })

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
  })

  it('기본 workspace에는 위험 구역과 삭제 버튼을 표시하지 않는다', () => {
    renderContent({ ...workspaceFixture, isDefault: true })

    expect(screen.queryByRole('heading', { name: '위험 구역' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '워크스페이스 삭제' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: '워크스페이스 이름' }),
    ).toHaveAttribute('readonly')
    expect(
      screen.getByText('기본 워크스페이스의 이름은 변경할 수 없어요.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
  })

  it('삭제를 취소하면 delete mutation을 호출하지 않는다', async () => {
    const user = userEvent.setup()
    renderContent()

    expect(
      screen.getByText('워크스페이스와 내부 데이터가 함께 삭제됩니다.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '워크스페이스 삭제' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('브랜드 스튜디오를 삭제할까요?')
    expect(dialog).toHaveTextContent(
      '워크스페이스 안의 모든 프로젝트와 화이트보드 문서가 함께 삭제돼요.',
    )
    expect(dialog).toHaveTextContent('삭제 후에는 복구할 수 없어요.')

    await user.click(within(dialog).getByRole('button', { name: '취소' }))

    expect(deleteMutation.mutateAsync).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('삭제를 확인하면 workspace ID로 삭제하고 완료 콜백을 호출한다', async () => {
    const user = userEvent.setup()
    const onDeleted = vi.fn()
    renderContent(workspaceFixture, onDeleted)

    await user.click(screen.getByRole('button', { name: '워크스페이스 삭제' }))
    const dialog = screen.getByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: '워크스페이스 삭제' }),
    )

    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce())
    expect(deleteMutation.mutateAsync).toHaveBeenCalledWith(
      workspaceFixture.id,
    )
    expect(toast.success).toHaveBeenCalledWith('워크스페이스를 삭제했어요')
  })

  it('이름 저장 실패 후 입력값을 유지한다', async () => {
    const user = userEvent.setup()
    updateMutation.error = new Error('실패')
    updateMutation.mutateAsync.mockRejectedValueOnce(new Error('실패'))
    renderContent()
    const input = screen.getByRole('textbox', { name: '워크스페이스 이름' })
    await user.clear(input)
    await user.type(input, '새 이름')

    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(updateMutation.mutateAsync).toHaveBeenCalled())
    expect(input).toHaveValue('새 이름')
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('삭제 실패 후 확인 dialog를 유지한다', async () => {
    const user = userEvent.setup()
    const onDeleted = vi.fn()
    deleteMutation.error = new Error('실패')
    deleteMutation.mutateAsync.mockRejectedValueOnce(new Error('실패'))
    renderContent(workspaceFixture, onDeleted)

    await user.click(screen.getByRole('button', { name: '워크스페이스 삭제' }))
    const dialog = screen.getByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: '워크스페이스 삭제' }),
    )

    await waitFor(() => expect(deleteMutation.mutateAsync).toHaveBeenCalled())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(dialog).getByRole('alert')).toBeInTheDocument()
    expect(onDeleted).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })
})
