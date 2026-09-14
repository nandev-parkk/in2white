import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSessionStore } from '@/entities/session'
import { axiosInstance } from '@/shared/api'
import { routeTree } from '@/routeTree.gen'
// 최초 Vite 페이지 변환 비용을 라우트 행동 테스트의 제한 시간과 분리한다.
import '@/pages/home'
vi.mock('@/shared/api', () => ({
  axiosInstance: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    interceptors: { response: { use: vi.fn(), eject: vi.fn() } },
  },
}))
const workspaces = [
  { id: 'ws', name: '테스트 팀', role: 'owner', isDefault: true },
  { id: 'next', name: '다음 팀', role: 'member', isDefault: false },
]
const members = [
  {
    userId: 'user',
    name: '실제 멤버',
    email: 'real@example.com',
    role: 'owner',
    joinedAt: '2026-09-01T00:00:00Z',
  },
]
beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  useSessionStore
    .getState()
    .setSession(`x.${btoa(JSON.stringify({ exp: 2000000000 }))}.x`, {
      id: 'user',
      name: '테스터',
      email: 'user@example.com',
    })
  vi.mocked(axiosInstance.get).mockImplementation(async (url) => ({
    data: String(url).endsWith('/workspaces')
      ? { workspaces }
      : String(url).includes('/members')
        ? {
            members,
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }
        : {
            projects: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
          },
  }))
})
afterEach(() => {
  cleanup()
  useSessionStore.getState().clearSession()
})
async function mount(path = '/workspaces/ws/members') {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}
it('멤버 경로에서 실제 멤버를 표시하고 워크스페이스 전환 후에도 멤버 목록을 유지한다', async () => {
  const router = await mount()
  expect(
    await screen.findByRole('heading', { name: '멤버' }, { timeout: 4000 }),
  ).toBeInTheDocument()
  expect(await screen.findByText('real@example.com')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '테스트 팀' }))
  await userEvent.click(screen.getByRole('option', { name: /다음 팀/ }))
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/workspaces/next/members'),
  )
  expect(
    screen.queryByRole('button', { name: '멤버 추가' }),
  ).not.toBeInTheDocument()
})
it('프로젝트와 멤버 사이드바가 실제 경로로 이동한다', async () => {
  const router = await mount('/workspaces/ws/projects')
  await screen.findByRole('heading', { name: '프로젝트' })
  await userEvent.click(
    within(screen.getByRole('complementary')).getByRole('button', {
      name: '멤버',
    }),
  )
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/workspaces/ws/members'),
  )
  await userEvent.click(
    within(screen.getByRole('complementary')).getByRole('button', {
      name: '프로젝트',
    }),
  )
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/workspaces/ws/projects'),
  )
})
it('비로그인 멤버 경로 접근은 로그인으로 이동한다', async () => {
  useSessionStore.getState().clearSession()
  const router = await mount()
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
})

it('프로젝트 화면의 멤버 초대 빠른 작업은 키보드로 열고 원래 버튼으로 포커스를 돌린다', async () => {
  const router = await mount('/workspaces/ws/projects')
  const invite = await screen.findByRole('button', { name: '멤버 초대' })
  invite.focus()
  await userEvent.keyboard('{Enter}')
  expect(
    await screen.findByRole('dialog', { name: '멤버 추가' }),
  ).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '닫기' }))
  expect(invite).toHaveFocus()
  expect(router.state.location.pathname).toBe('/workspaces/ws/projects')
})
