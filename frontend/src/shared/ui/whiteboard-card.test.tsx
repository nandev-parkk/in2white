import { render, screen } from '@testing-library/react'

import { WhiteboardCard } from './whiteboard-card'

function renderCard(menu?: React.ReactNode) {
  render(
    <WhiteboardCard
      title="킥오프 화이트보드"
      createdAtLabel="2026.01.12"
      updatedAtLabel="3시간 전"
      creatorName="김민지"
      menu={menu}
    />,
  )
}

describe('WhiteboardCard', () => {
  it('제목, 생성일, 수정일, 생성자를 보여준다', () => {
    renderCard()

    expect(screen.getByText('킥오프 화이트보드')).toBeInTheDocument()
    expect(screen.getByText('생성일 2026.01.12')).toBeInTheDocument()
    expect(screen.getByText('수정일 3시간 전')).toBeInTheDocument()
    expect(screen.getByText('김민지')).toBeInTheDocument()
  })

  it('menu를 주지 않으면 메뉴 영역을 렌더링하지 않는다', () => {
    renderCard()

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('menu 슬롯에 넘긴 노드를 렌더링한다', () => {
    renderCard(<button type="button">더 보기</button>)

    expect(screen.getByRole('button', { name: '더 보기' })).toBeInTheDocument()
  })
})
