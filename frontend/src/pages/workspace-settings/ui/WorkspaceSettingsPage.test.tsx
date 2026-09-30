import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkspaceSummary } from '@/entities/workspace'
import { useDeleteWorkspace, useUpdateWorkspace } from '@/features/workspace'
import {
  AuthenticatedWorkspaceLayout,
  type AuthenticatedWorkspaceLayoutProps,
} from '@/pages/shared/ui/AuthenticatedWorkspaceLayout'

import { WorkspaceSettingsPage } from './WorkspaceSettingsPage'

vi.mock('@/features/workspace', () => ({
  useDeleteWorkspace: vi.fn(),
  useUpdateWorkspace: vi.fn(),
}))
vi.mock('@/pages/shared/ui/AuthenticatedWorkspaceLayout', () => ({
  AuthenticatedWorkspaceLayout: vi.fn(),
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
let selectedWorkspace: WorkspaceSummary | null = workspaceFixture

function createPageProps() {
  return {
    workspaceId: workspaceFixture.id,
    onWorkspaceChange: vi.fn(),
    onNavChange: vi.fn(),
    onUserClick: vi.fn(),
    onDeleted: vi.fn(),
    onReturn: vi.fn(),
  }
}

describe('WorkspaceSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectedWorkspace = workspaceFixture
    updateMutation.isPending = false
    updateMutation.error = null
    updateMutation.mutateAsync.mockResolvedValue(workspaceFixture)
    deleteMutation.isPending = false
    deleteMutation.error = null
    deleteMutation.mutateAsync.mockResolvedValue(undefined)
    vi.mocked(useUpdateWorkspace).mockReturnValue(updateMutation as never)
    vi.mocked(useDeleteWorkspace).mockReturnValue(deleteMutation as never)
    vi.mocked(AuthenticatedWorkspaceLayout).mockImplementation(
      (props: AuthenticatedWorkspaceLayoutProps) => (
        <div data-testid="workspace-layout">
          {props.children({
            accessToken: 'token-1',
            selectedWorkspace,
          } as never)}
        </div>
      ),
    )
  })

  it('Owner에게 설정 제목, 이름 입력, 위험 구역을 표시한다', () => {
    const props = createPageProps()
    render(<WorkspaceSettingsPage {...props} />)

    expect(
      screen.getByRole('heading', { name: '설정', level: 1 }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: '워크스페이스 이름' }),
    ).toHaveValue(workspaceFixture.name)
    expect(
      screen.getByRole('heading', { name: '위험 구역' }),
    ).toBeInTheDocument()
    expect(useUpdateWorkspace).toHaveBeenCalledWith('token-1')

    const layoutProps = vi.mocked(AuthenticatedWorkspaceLayout).mock.calls[0][0]
    expect(layoutProps).toMatchObject({
      activeNav: 'settings',
      workspaceId: workspaceFixture.id,
      workspaceMode: 'required',
    })
    expect(layoutProps.onWorkspaceChange).toBe(props.onWorkspaceChange)
    expect(layoutProps.onNavChange).toBe(props.onNavChange)
    expect(layoutProps.onUserClick).toBe(props.onUserClick)
  })

  it('Member가 직접 접근하면 권한 거부 화면과 프로젝트 복귀 동작을 표시한다', async () => {
    const user = userEvent.setup()
    const props = createPageProps()
    selectedWorkspace = { ...workspaceFixture, role: 'member' }
    render(<WorkspaceSettingsPage {...props} />)

    expect(
      screen.getByRole('heading', { name: '존재하지 않는 워크스페이스예요' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: '브랜드 스튜디오로 돌아가기' }),
    )

    expect(props.onReturn).toHaveBeenCalledOnce()
  })
})
