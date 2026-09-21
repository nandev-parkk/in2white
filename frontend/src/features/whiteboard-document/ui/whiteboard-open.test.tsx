import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { WhiteboardCard } from '@/shared/ui/whiteboard-card'
import { WhiteboardDocumentTable } from './WhiteboardDocumentTable'
it('카드 제목은 키보드로 열 수 있고 별도 메뉴는 문서를 열지 않는다', async () => {
  const open = vi.fn()
  render(
    <WhiteboardCard
      title="문서"
      createdAtLabel=""
      updatedAtLabel=""
      creatorName="사용자"
      onOpen={open}
      menu={<button>메뉴</button>}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: '메뉴' }))
  expect(open).not.toHaveBeenCalled()
  screen.getByRole('button', { name: '문서' }).focus()
  await userEvent.keyboard('{Enter}')
  expect(open).toHaveBeenCalledOnce()
})
it('표 제목에서 문서 id로 상세를 연다', async () => {
  const open = vi.fn()
  render(
    <WhiteboardDocumentTable
      documents={[
        {
          id: 'doc',
          name: '문서',
          projectId: 'project',
          creatorId: 'user',
          creator: { id: 'user', name: '사용자' },
          createdAt: '2026-09-21T00:00:00Z',
          updatedAt: '2026-09-21T00:00:00Z',
        },
      ]}
      onOpen={open}
      onRename={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: '문서' }))
  expect(open).toHaveBeenCalledWith('doc')
})
