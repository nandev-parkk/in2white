import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'

import {
  getDashboardMetricsRequest,
  type AdminDashboardMetrics,
} from '@/entities/dashboard'

import { DashboardPage } from './DashboardPage'

vi.mock('@/entities/dashboard', () => ({
  getDashboardMetricsRequest: vi.fn(),
}))

const metrics: AdminDashboardMetrics = {
  totals: {
    users: { total: 1280, deactivated: 12 },
    workspaces: { total: 340 },
    projects: { total: 912, deleted: 7 },
    whiteboardDocuments: { total: 4210, deleted: 23 },
  },
  trend: [
    { date: '2026-09-25', users: 3, projects: 1, whiteboardDocuments: 5 },
    { date: '2026-09-26', users: 0, projects: 0, whiteboardDocuments: 0 },
    { date: '2026-09-27', users: 1, projects: 2, whiteboardDocuments: 4 },
    { date: '2026-09-28', users: 2, projects: 0, whiteboardDocuments: 1 },
    { date: '2026-09-29', users: 0, projects: 1, whiteboardDocuments: 0 },
    { date: '2026-09-30', users: 4, projects: 3, whiteboardDocuments: 9 },
    { date: '2026-10-01', users: 1, projects: 0, whiteboardDocuments: 2 },
  ],
}

function renderDashboardPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.mocked(getDashboardMetricsRequest).mockReset()
  })

  it('총계 카드 4종을 보여준다', async () => {
    vi.mocked(getDashboardMetricsRequest).mockResolvedValue(metrics)

    renderDashboardPage()

    expect(await screen.findByText('1,280')).toBeInTheDocument()
    expect(screen.getByText('340')).toBeInTheDocument()
    expect(screen.getByText('912')).toBeInTheDocument()
    expect(screen.getByText('4,210')).toBeInTheDocument()
    expect(screen.getByText('사용자')).toBeInTheDocument()
    expect(screen.getByText('워크스페이스')).toBeInTheDocument()
  })

  /* 총계만 보면 정지·삭제된 것까지 살아 있는 것으로 읽힌다. 카드에 함께 적는다. */
  it('정지된 사용자와 삭제된 리소스 수를 함께 보여준다', async () => {
    vi.mocked(getDashboardMetricsRequest).mockResolvedValue(metrics)

    renderDashboardPage()

    expect(await screen.findByText('정지 12명')).toBeInTheDocument()
    expect(screen.getByText('삭제 7개')).toBeInTheDocument()
    expect(screen.getByText('삭제 23개')).toBeInTheDocument()
  })

  /*
   * 그래프는 눈으로만 읽을 수 있다. 같은 숫자를 표로도 제공해 스크린 리더에서도
   * 추이를 읽을 수 있게 한다.
   */
  it('최근 7일 추이를 날짜 순서대로 표로도 제공한다', async () => {
    vi.mocked(getDashboardMetricsRequest).mockResolvedValue(metrics)

    renderDashboardPage()

    const table = await screen.findByRole('table', {
      name: '최근 7일 생성 추이',
    })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(8)

    const firstDay = within(rows[1]).getAllByRole('cell')
    expect(firstDay.map((cell) => cell.textContent)).toEqual([
      '09.25',
      '3',
      '1',
      '5',
    ])
    expect(within(rows[7]).getAllByRole('cell')[0]).toHaveTextContent('10.01')
  })

  it('조회에 실패하면 오류와 다시 시도 버튼을 보여준다', async () => {
    vi.mocked(getDashboardMetricsRequest).mockRejectedValue(
      new Error('network'),
    )

    renderDashboardPage()

    expect(
      await screen.findByText('대시보드 지표를 불러오지 못했어요'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '다시 시도' }),
    ).toBeInTheDocument()
  })
})
