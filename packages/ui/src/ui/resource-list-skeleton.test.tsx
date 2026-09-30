import { render, screen } from '@testing-library/react'
import { ResourceListSkeleton } from './resource-list-skeleton'

it('카드 보기는 여섯 자리와 문서 미리보기 영역을 유지한다', () => {
  const { container, rerender } = render(
    <ResourceListSkeleton view="grid" kind="project" />,
  )
  expect(
    container.querySelectorAll('[data-slot="resource-card-skeleton"]'),
  ).toHaveLength(6)
  expect(
    container.querySelectorAll('[data-slot="preview-skeleton"]'),
  ).toHaveLength(0)
  rerender(<ResourceListSkeleton view="grid" kind="whiteboard" />)
  expect(
    container.querySelectorAll('[data-slot="preview-skeleton"]'),
  ).toHaveLength(6)
})

it('테이블 보기는 실제 목록의 열과 다섯 행을 유지한다', () => {
  render(<ResourceListSkeleton view="table" kind="project" />)
  expect(screen.getAllByRole('columnheader', { hidden: true })).toHaveLength(5)
  expect(screen.getAllByRole('row', { hidden: true })).toHaveLength(6)
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})
