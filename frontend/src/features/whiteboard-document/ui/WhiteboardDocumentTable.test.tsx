import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { WhiteboardDocument } from '@/entities/whiteboard-document'

import { WhiteboardDocumentTable } from './WhiteboardDocumentTable'

const documents: WhiteboardDocument[] = [
  {
    id: 'document-1',
    projectId: 'project-1',
    name: '킥오프 화이트보드',
    creatorId: 'user-1',
    creator: { id: 'user-1', name: '김민지' },
    createdAt: '2026-01-12T00:00:00.000Z',
    updatedAt: '2026-01-12T00:00:00.000Z',
  },
  {
    id: 'document-2',
    projectId: 'project-1',
    name: '로고 스케치 v2',
    creatorId: 'user-2',
    creator: { id: 'user-2', name: '이서준' },
    createdAt: '2026-01-14T00:00:00.000Z',
    updatedAt: '2026-01-14T00:00:00.000Z',
  },
]

describe('WhiteboardDocumentTable', () => {
  it('이름·생성자·생성일·수정일 컬럼을 보여준다', () => {
    render(
      <WhiteboardDocumentTable
        documents={documents}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('columnheader', { name: '이름' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: '생성자' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: '생성일' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: '수정일' }),
    ).toBeInTheDocument()
    expect(screen.getByText('킥오프 화이트보드')).toBeInTheDocument()
    expect(screen.getByText('2026.01.12')).toBeInTheDocument()
  })

  it('관리 권한이 없는 문서에는 메뉴를 렌더링하지 않는다', () => {
    render(
      <WhiteboardDocumentTable
        documents={documents}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        canManage={(document) => document.id === 'document-1'}
      />,
    )

    expect(
      screen.getByRole('button', { name: '킥오프 화이트보드 메뉴' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '로고 스케치 v2 메뉴' }),
    ).not.toBeInTheDocument()
  })

  it('메뉴에서 이름 변경과 삭제를 호출한다', async () => {
    const onRename = vi.fn()
    const onDelete = vi.fn()
    render(
      <WhiteboardDocumentTable
        documents={[documents[0]]}
        onRename={onRename}
        onDelete={onDelete}
      />,
    )

    await userEvent.click(
      screen.getByRole('button', { name: '킥오프 화이트보드 메뉴' }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: '이름 변경' }))

    expect(onRename).toHaveBeenCalledWith(documents[0])

    await userEvent.click(
      screen.getByRole('button', { name: '킥오프 화이트보드 메뉴' }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: '삭제' }))

    expect(onDelete).toHaveBeenCalledWith(documents[0])
  })
})
