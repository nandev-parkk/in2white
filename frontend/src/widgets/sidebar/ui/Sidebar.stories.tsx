import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import type { WorkspaceSummary } from '@/entities/workspace'
import type { PresenceUser } from '@/shared/ui/presence-avatar-stack'

import { Sidebar, type SidebarNavKey } from './Sidebar'

const PROFILE_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"%3E%3Crect width="80" height="80" fill="%23dce8ff"/%3E%3Ccircle cx="40" cy="31" r="15" fill="%23efb394"/%3E%3Cpath d="M22 29c2-13 10-20 19-20 11 0 18 8 18 21-7-3-12-8-17-14-5 7-11 11-20 13Z" fill="%233a4055"/%3E%3Cpath d="M12 80c3-20 14-30 28-30s25 10 28 30" fill="%235b75d6"/%3E%3C/svg%3E'

const MEMBERS: PresenceUser[] = [
  { id: 'minji', name: '김민지', imageUrl: PROFILE_IMAGE, presenceIndex: 1 },
  { id: 'seoyeon', name: '박서연', presenceIndex: 2 },
  { id: 'junho', name: '이준호', presenceIndex: 3 },
  { id: 'jieun', name: '최지은', presenceIndex: 4 },
  { id: 'doyun', name: '정도윤', presenceIndex: 5 },
]

const NAV_LABELS: Record<SidebarNavKey, string> = {
  projects: '프로젝트',
  members: '멤버',
  settings: '설정',
}

const WORKSPACE: WorkspaceSummary = {
  id: 'workspace-1',
  name: '인투화이트 디자인팀',
  ownerId: 'user-1',
  isDefault: true,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  role: 'owner',
}

type SidebarStoryProps = Pick<
  ComponentProps<typeof Sidebar>,
  | 'workspace'
  | 'workspaces'
  | 'selectedWorkspaceId'
  | 'onWorkspaceChange'
  | 'onCreateWorkspace'
  | 'workspaceMembers'
  | 'userName'
  | 'userEmail'
  | 'userImageUrl'
  | 'collapsed'
  | 'activeNav'
>

function SidebarExample({
  workspace,
  workspaces,
  selectedWorkspaceId,
  onWorkspaceChange,
  onCreateWorkspace,
  workspaceMembers,
  userName,
  userEmail,
  userImageUrl = PROFILE_IMAGE,
  collapsed: controlledCollapsed = false,
  activeNav: controlledActiveNav,
}: SidebarStoryProps) {
  const [collapsed, setCollapsed] = useState(controlledCollapsed)
  const [previousControlledCollapsed, setPreviousControlledCollapsed] =
    useState(controlledCollapsed)
  const [activeNav, setActiveNav] = useState<SidebarNavKey | null>(
    controlledActiveNav,
  )
  const [previousControlledActiveNav, setPreviousControlledActiveNav] =
    useState(controlledActiveNav)
  const [lastAction, setLastAction] = useState('사이드바를 조작해 보세요.')

  if (previousControlledCollapsed !== controlledCollapsed) {
    setPreviousControlledCollapsed(controlledCollapsed)
    setCollapsed(controlledCollapsed)
  }

  if (previousControlledActiveNav !== controlledActiveNav) {
    setPreviousControlledActiveNav(controlledActiveNav)
    setActiveNav(controlledActiveNav)
  }

  const handleNavChange = (key: SidebarNavKey) => {
    setActiveNav(key)
    setLastAction(`${NAV_LABELS[key]} 메뉴를 선택했습니다.`)
  }

  return (
    <div className="flex h-160 w-full">
      <Sidebar
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        workspace={workspace}
        workspaces={workspaces}
        selectedWorkspaceId={selectedWorkspaceId}
        onWorkspaceChange={onWorkspaceChange}
        onCreateWorkspace={onCreateWorkspace}
        workspaceMembers={workspaceMembers}
        activeNav={activeNav}
        onNavChange={handleNavChange}
        onInviteMember={() => setLastAction('멤버 초대를 시작했습니다.')}
        onLogout={() => setLastAction('로그아웃을 선택했습니다.')}
        userName={userName}
        userEmail={userEmail}
        userImageUrl={userImageUrl}
      />
      <main className="bg-background-canvas flex min-w-0 flex-1 items-center justify-center p-8">
        <div className="text-center">
          <p className="text-heading3 text-foreground-strong">
            현재 메뉴: {activeNav ? NAV_LABELS[activeNav] : '없음'}
          </p>
          <p className="text-body text-foreground-secondary mt-2">
            {lastAction}
          </p>
        </div>
      </main>
    </div>
  )
}

const meta = {
  title: 'Widgets/Sidebar',
  component: Sidebar,
  parameters: { layout: 'fullscreen' },
  args: {
    collapsed: false,
    workspace: WORKSPACE,
    workspaces: [WORKSPACE],
    selectedWorkspaceId: WORKSPACE.id,
    onWorkspaceChange: () => undefined,
    onCreateWorkspace: () => undefined,
    workspaceMembers: MEMBERS,
    activeNav: 'projects',
    onNavChange: () => undefined,
    userName: '김민지',
    userEmail: 'minji.kim@in2white.com',
    userImageUrl: PROFILE_IMAGE,
  },
  render: (args) => (
    <SidebarExample
      collapsed={args.collapsed}
      activeNav={args.activeNav}
      workspace={args.workspace}
      workspaces={args.workspaces}
      selectedWorkspaceId={args.selectedWorkspaceId}
      onWorkspaceChange={args.onWorkspaceChange}
      onCreateWorkspace={args.onCreateWorkspace}
      workspaceMembers={args.workspaceMembers}
      userName={args.userName}
      userEmail={args.userEmail}
      userImageUrl={args.userImageUrl}
    />
  ),
} satisfies Meta<typeof Sidebar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Collapsed: Story = {
  args: { collapsed: true },
}

export const MembersActive: Story = {
  args: { activeNav: 'members' },
}

export const ImageFallbackAndActions: Story = {
  args: { userImageUrl: '/없는-프로필.png', activeNav: 'settings' },
}
