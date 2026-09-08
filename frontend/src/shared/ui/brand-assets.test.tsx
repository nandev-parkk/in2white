import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { WorkspaceSummary } from '@/entities/workspace'

import { AppShellHeader } from './app-shell-header'
import { Sidebar } from './sidebar'

const workspace: WorkspaceSummary = {
  id: 'workspace-1',
  name: '인투화이트 디자인팀',
  ownerId: 'user-1',
  isDefault: true,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  role: 'owner',
}

const members = [{ id: 'minji', name: '김민지', presenceIndex: 1 }]

describe('Brand assets', () => {
  it('uses the in2white logo mark in the app shell header', () => {
    render(
      <AppShellHeader workspaceName="인투화이트 디자인팀" userName="김민지" />,
    )

    expect(screen.getByAltText('in2white')).toHaveAttribute(
      'src',
      '/logo-mark.png',
    )
  })

  it('uses the in2white logo mark in the sidebar', () => {
    render(
      <Sidebar
        workspace={workspace}
        workspaces={[workspace]}
        selectedWorkspaceId={workspace.id}
        onWorkspaceChange={() => undefined}
        onCreateWorkspace={() => undefined}
        workspaceMembers={members}
        activeNav="projects"
        onNavChange={() => undefined}
        userName="김민지"
        userEmail="minji.kim@in2white.com"
      />,
    )

    expect(screen.getByAltText('in2white')).toHaveAttribute(
      'src',
      '/logo-mark.png',
    )
  })
})
