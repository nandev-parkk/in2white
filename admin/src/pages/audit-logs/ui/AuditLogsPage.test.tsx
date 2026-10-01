import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  listAuditLogsRequest,
  type AdminAuditLog,
  type ListAuditLogsResponse,
} from '@/entities/audit-log'

import { AuditLogsPage } from './AuditLogsPage'

vi.mock('@/entities/audit-log', () => ({
  listAuditLogsRequest: vi.fn(),
}))

const admin = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  email: 'admin@in2white.team',
  name: '박관리',
}

/* 어드민 필터는 누른 행의 어드민만 걸러야 한다 — 두 기록의 행위자를 다르게 둔다. */
const otherAdmin = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  email: 'ops@in2white.team',
  name: '최운영',
}

const auditLogs: AdminAuditLog[] = [
  {
    id: 'log-1',
    action: 'user.update',
    targetType: 'user',
    targetId: 'user-1',
    summary: '사용자 이름을 변경했어요',
    metadata: { before: { name: '김하나' }, after: { name: '김두리' } },
    ip: '203.0.113.7',
    userAgent: 'Mozilla/5.0',
    createdAt: '2026-09-30T10:00:00.000Z',
    admin,
  },
  {
    id: 'log-2',
    action: 'workspace.delete',
    targetType: 'workspace',
    targetId: 'workspace-1',
    summary: '워크스페이스를 삭제했어요',
    metadata: {},
    ip: null,
    userAgent: null,
    createdAt: '2026-09-29T02:30:00.000Z',
    admin: otherAdmin,
  },
]

function listResponse(
  overrides?: Partial<ListAuditLogsResponse>,
): ListAuditLogsResponse {
  return {
    auditLogs,
    pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    ...overrides,
  }
}

function renderAuditLogsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuditLogsPage />
    </QueryClientProvider>,
  )
}

/* Radix Select는 jsdom에 없는 포인터 API를 쓴다. */
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {}
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
})

describe('AuditLogsPage', () => {
  beforeEach(() => {
    vi.mocked(listAuditLogsRequest).mockReset()
  })

  it('누가 언제 무엇을 했는지 목록으로 보여준다', async () => {
    vi.mocked(listAuditLogsRequest).mockResolvedValue(listResponse())

    renderAuditLogsPage()

    expect(await screen.findByText('user.update')).toBeInTheDocument()
    expect(screen.getByText('사용자 이름을 변경했어요')).toBeInTheDocument()
    expect(screen.getAllByText('박관리')).not.toHaveLength(0)
    expect(screen.getByText('workspace.delete')).toBeInTheDocument()
    expect(vi.mocked(listAuditLogsRequest).mock.calls[0][0]).toMatchObject({
      page: 1,
    })
  })

  /* 대상 타입은 DB에 문자열로 들어간다. 모르는 값이 와도 빈칸 대신 원래 값을 보여준다. */
  it('대상 타입을 한국어로 보여준다', async () => {
    vi.mocked(listAuditLogsRequest).mockResolvedValue(listResponse())

    renderAuditLogsPage()

    expect(await screen.findByText('사용자')).toBeInTheDocument()
    expect(screen.getByText('워크스페이스')).toBeInTheDocument()
  })

  it('액션을 입력하면 그 조건으로 다시 조회한다', async () => {
    vi.mocked(listAuditLogsRequest).mockResolvedValue(listResponse())

    renderAuditLogsPage()
    await screen.findByText('user.update')

    await userEvent.type(screen.getByLabelText('액션 검색'), 'user.')

    await waitFor(() => {
      expect(listAuditLogsRequest).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.', page: 1 }),
      )
    })
  })

  it('대상 타입을 고르면 그 조건으로 다시 조회한다', async () => {
    vi.mocked(listAuditLogsRequest).mockResolvedValue(listResponse())

    renderAuditLogsPage()
    await screen.findByText('user.update')

    await userEvent.click(screen.getByRole('combobox', { name: '대상 타입' }))
    await userEvent.click(
      await screen.findByRole('option', { name: '워크스페이스' }),
    )

    await waitFor(() => {
      expect(listAuditLogsRequest).toHaveBeenCalledWith(
        expect.objectContaining({ targetType: 'workspace', page: 1 }),
      )
    })
  })

  /* 날짜 입력은 jsdom에 UI가 없다. 값 변경 이벤트로 직접 채운다. */
  it('기간을 지정하면 그 조건으로 다시 조회한다', async () => {
    vi.mocked(listAuditLogsRequest).mockResolvedValue(listResponse())

    renderAuditLogsPage()
    await screen.findByText('user.update')

    fireEvent.change(screen.getByLabelText('시작일'), {
      target: { value: '2026-09-01' },
    })
    fireEvent.change(screen.getByLabelText('종료일'), {
      target: { value: '2026-09-30' },
    })

    await waitFor(() => {
      expect(listAuditLogsRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '2026-09-01',
          to: '2026-09-30',
          page: 1,
        }),
      )
    })
  })

  /*
   * 어드민 목록 API가 없으므로 기록에 찍힌 어드민을 눌러 거른다. uuid를 외워 입력하게
   * 하지 않는다.
   */
  it('어드민을 누르면 그 어드민의 기록만 조회하고 해제할 수 있다', async () => {
    vi.mocked(listAuditLogsRequest).mockResolvedValue(listResponse())

    renderAuditLogsPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '박관리 기록만 보기' }),
    )

    await waitFor(() => {
      expect(listAuditLogsRequest).toHaveBeenCalledWith(
        expect.objectContaining({ adminId: admin.id, page: 1 }),
      )
    })

    await userEvent.click(
      screen.getByRole('button', { name: '어드민 필터 해제' }),
    )

    await waitFor(() => {
      expect(listAuditLogsRequest).toHaveBeenLastCalledWith(
        expect.not.objectContaining({ adminId: admin.id }),
      )
    })
  })

  /* 변경 전후 값은 표에 다 들어가지 않는다. 표에서 열어 확인한다. */
  it('상세를 열면 변경 전후 값과 요청 정보를 보여준다', async () => {
    vi.mocked(listAuditLogsRequest).mockResolvedValue(listResponse())

    renderAuditLogsPage()

    await userEvent.click(
      await screen.findByRole('button', { name: 'user.update 상세' }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('203.0.113.7')
    expect(dialog).toHaveTextContent('Mozilla/5.0')
    expect(dialog).toHaveTextContent('"name": "김두리"')
  })

  it('다음 페이지를 누르면 그 페이지를 조회한다', async () => {
    vi.mocked(listAuditLogsRequest).mockResolvedValue(
      listResponse({
        pagination: { page: 1, limit: 20, total: 40, totalPages: 2 },
      }),
    )

    renderAuditLogsPage()
    await screen.findByText('user.update')

    await userEvent.click(screen.getByRole('button', { name: '다음 페이지' }))

    await waitFor(() => {
      expect(listAuditLogsRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      )
    })
  })

  it('결과가 없으면 빈 상태를 보여준다', async () => {
    vi.mocked(listAuditLogsRequest).mockResolvedValue(
      listResponse({
        auditLogs: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
    )

    renderAuditLogsPage()

    expect(await screen.findByText('감사 로그가 없어요')).toBeInTheDocument()
  })

  it('조건에 맞는 기록이 없으면 조건을 바꿔보라고 안내한다', async () => {
    vi.mocked(listAuditLogsRequest).mockResolvedValue(listResponse())

    renderAuditLogsPage()
    await screen.findByText('user.update')

    vi.mocked(listAuditLogsRequest).mockResolvedValue(
      listResponse({
        auditLogs: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
    )
    await userEvent.type(screen.getByLabelText('액션 검색'), 'nope')

    expect(
      await screen.findByText('조건에 맞는 감사 로그가 없어요'),
    ).toBeInTheDocument()
  })

  it('조회에 실패하면 오류와 다시 시도 버튼을 보여준다', async () => {
    vi.mocked(listAuditLogsRequest).mockRejectedValue(new Error('network'))

    renderAuditLogsPage()

    expect(
      await screen.findByText('감사 로그를 불러오지 못했어요'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '다시 시도' }),
    ).toBeInTheDocument()
  })
})
