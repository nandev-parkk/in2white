import type { WorkspaceSummary } from '../api/workspace'

import { selectDefaultWorkspace } from './select-default-workspace'

const workspaceFixture: WorkspaceSummary = {
  id: 'workspace-1',
  name: 'My Workspace',
  ownerId: 'user-1',
  isDefault: true,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  role: 'owner',
}

const otherWorkspaceFixture: WorkspaceSummary = {
  ...workspaceFixture,
  id: 'workspace-2',
  name: '브랜드 스튜디오',
  isDefault: false,
}

describe('selectDefaultWorkspace', () => {
  it('기본 workspace를 우선 선택한다', () => {
    expect(
      selectDefaultWorkspace([otherWorkspaceFixture, workspaceFixture]),
    ).toBe(workspaceFixture)
  })

  it('기본 workspace가 없으면 첫 workspace를 선택한다', () => {
    expect(selectDefaultWorkspace([otherWorkspaceFixture])).toBe(
      otherWorkspaceFixture,
    )
  })

  it('workspace 목록이 비면 null을 반환한다', () => {
    expect(selectDefaultWorkspace([])).toBeNull()
  })
})
