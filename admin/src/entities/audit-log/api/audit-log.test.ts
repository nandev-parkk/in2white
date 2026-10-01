import { axiosInstance } from '@/shared/api'

import { listAuditLogsRequest, type AdminAuditLog } from './audit-log'

vi.mock('@/shared/api', () => ({
  axiosInstance: { get: vi.fn() },
}))

const auditLog: AdminAuditLog = {
  id: 'log-1',
  action: 'user.update',
  targetType: 'user',
  targetId: 'user-1',
  summary: '사용자 이름을 변경했어요',
  metadata: { before: { name: '김하나' }, after: { name: '김두리' } },
  ip: '203.0.113.7',
  userAgent: 'Mozilla/5.0',
  createdAt: '2026-09-30T10:00:00.000Z',
  admin: { id: 'admin-1', email: 'admin@in2white.team', name: '박관리' },
}

function mockListResponse() {
  vi.mocked(axiosInstance.get).mockResolvedValueOnce({
    data: {
      auditLogs: [auditLog],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    },
  })
}

function requestParams() {
  const [, config] = vi.mocked(axiosInstance.get).mock.calls[0] as [
    string,
    { params: Record<string, unknown> },
  ]

  return config.params
}

describe('audit log API requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('감사 로그 목록을 그대로 돌려준다', async () => {
    mockListResponse()

    await expect(listAuditLogsRequest({ page: 1, limit: 20 })).resolves.toEqual(
      {
        auditLogs: [auditLog],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    )
    expect(vi.mocked(axiosInstance.get).mock.calls[0][0]).toBe('/audit-logs')
  })

  /* 빈 필터를 보내면 백엔드가 400으로 막는다 — 선택하지 않은 조건은 쿼리에서 빼야 한다. */
  it('비어 있는 필터는 쿼리에서 뺀다', async () => {
    mockListResponse()

    await listAuditLogsRequest({ page: 2, limit: 20, action: '   ' })

    expect(requestParams()).toEqual({ page: 2, limit: 20 })
  })

  it('액션은 앞뒤 공백을 떼고 보낸다', async () => {
    mockListResponse()

    await listAuditLogsRequest({ page: 1, limit: 20, action: ' user.update ' })

    expect(requestParams()).toMatchObject({ action: 'user.update' })
  })

  /*
   * 어드민은 날짜를 고르지만 백엔드는 시각으로 비교한다. 종료일을 그대로 보내면 그날
   * 0시 이후의 기록이 모두 빠져 "오늘까지" 조회가 오늘을 빼먹는다.
   */
  it('기간은 화면에 표시하는 현지 날짜의 시작부터 끝까지 보낸다', async () => {
    mockListResponse()

    await listAuditLogsRequest({
      page: 1,
      limit: 20,
      from: '2026-09-01',
      to: '2026-09-30',
    })

    expect(requestParams()).toMatchObject({
      from: new Date(2026, 8, 1).toISOString(),
      to: new Date(2026, 9, 1, 0, 0, 0, -1).toISOString(),
    })
  })

  it('어드민과 대상 타입 조건을 그대로 전달한다', async () => {
    mockListResponse()

    await listAuditLogsRequest({
      page: 1,
      limit: 20,
      adminId: 'admin-1',
      targetType: 'workspace',
    })

    expect(requestParams()).toMatchObject({
      adminId: 'admin-1',
      targetType: 'workspace',
    })
  })
})
