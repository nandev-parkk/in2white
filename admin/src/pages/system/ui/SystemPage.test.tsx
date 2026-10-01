import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  getSystemStatusRequest,
  type AdminSystemStatus,
} from '@/entities/system'

import { SystemPage } from './SystemPage'

vi.mock('@/entities/system', () => ({
  getSystemStatusRequest: vi.fn(),
}))

const status: AdminSystemStatus = {
  checkedAt: '2026-09-30T10:00:00.000Z',
  database: { status: 'up', latencyMs: 12 },
  cache: { status: 'up', latencyMs: 3 },
  realtime: { documentCount: 2, participantCount: 5, socketCount: 6 },
}

function renderSystemPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <SystemPage />
    </QueryClientProvider>,
  )
}

describe('SystemPage', () => {
  beforeEach(() => {
    vi.mocked(getSystemStatusRequest).mockReset()
  })

  it('DB와 캐시 상태를 응답 시간과 함께 보여준다', async () => {
    vi.mocked(getSystemStatusRequest).mockResolvedValue(status)

    renderSystemPage()

    expect(await screen.findByText('데이터베이스')).toBeInTheDocument()
    expect(screen.getByText('캐시')).toBeInTheDocument()
    expect(screen.getAllByText('정상')).toHaveLength(2)
    expect(screen.getByText('12ms')).toBeInTheDocument()
    expect(screen.getByText('3ms')).toBeInTheDocument()
  })

  /* 의존성이 죽어도 응답은 200이다. 화면이 비지 않고 죽은 것만 드러나야 한다. */
  it('의존성이 죽으면 그 항목만 응답 없음으로 보여준다', async () => {
    vi.mocked(getSystemStatusRequest).mockResolvedValue({
      ...status,
      cache: { status: 'down', latencyMs: 2000 },
    })

    renderSystemPage()

    expect(await screen.findByText('응답 없음')).toBeInTheDocument()
    expect(screen.getByText('정상')).toBeInTheDocument()
  })

  it('실시간 화이트보드 세션 수를 보여준다', async () => {
    vi.mocked(getSystemStatusRequest).mockResolvedValue(status)

    renderSystemPage()

    expect(await screen.findByText('열린 문서')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  /* 소켓 서버 없이 HTTP 앱만 띄운 구성에서는 알 수 없다. 0건으로 속이지 않는다. */
  it('실시간 정보를 읽을 수 없으면 0이 아니라 알 수 없다고 알린다', async () => {
    vi.mocked(getSystemStatusRequest).mockResolvedValue({
      ...status,
      realtime: null,
    })

    renderSystemPage()

    expect(
      await screen.findByText('실시간 서버 정보를 읽을 수 없어요'),
    ).toBeInTheDocument()
    expect(screen.queryByText('열린 문서')).not.toBeInTheDocument()
  })

  it('점검 시각을 보여준다', async () => {
    vi.mocked(getSystemStatusRequest).mockResolvedValue(status)

    renderSystemPage()

    expect(await screen.findByText(/기준/)).toBeInTheDocument()
  })

  it('다시 점검을 누르면 상태를 다시 조회한다', async () => {
    vi.mocked(getSystemStatusRequest).mockResolvedValue(status)

    renderSystemPage()
    await screen.findByText('데이터베이스')

    await userEvent.click(screen.getByRole('button', { name: '다시 점검' }))

    await waitFor(() => {
      expect(getSystemStatusRequest).toHaveBeenCalledTimes(2)
    })
  })

  it('조회에 실패하면 오류와 다시 시도 버튼을 보여준다', async () => {
    vi.mocked(getSystemStatusRequest).mockRejectedValue(new Error('network'))

    renderSystemPage()

    expect(
      await screen.findByText('운영 상태를 불러오지 못했어요'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '다시 시도' }),
    ).toBeInTheDocument()
  })
})
