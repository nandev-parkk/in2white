import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import {
  Pagination,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/shared/ui/pagination'

type PaginationStoryArgs = ComponentProps<typeof Pagination> & {
  initialPage?: number
  totalPages?: number
}

function PaginationExample({
  initialPage = 3,
  totalPages = 7,
  ...args
}: PaginationStoryArgs) {
  const [page, setPage] = useState(initialPage)
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)

  return (
    <div className="flex flex-col items-center gap-3">
      <Pagination {...args}>
        <PaginationPrevious
          disabled={page === 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        />
        {pages.map((pageNumber) => (
          <PaginationItem
            key={pageNumber}
            isActive={page === pageNumber}
            onClick={() => setPage(pageNumber)}
          >
            {pageNumber}
          </PaginationItem>
        ))}
        <PaginationNext
          disabled={page === totalPages}
          onClick={() =>
            setPage((current) => Math.min(totalPages, current + 1))
          }
        />
      </Pagination>
      <p className="text-caption text-foreground-secondary">
        전체 {totalPages}페이지 중 {page}페이지
      </p>
    </div>
  )
}

const meta = {
  title: 'Shared UI/Compositions/Pagination',
  component: Pagination,
  parameters: { layout: 'centered' },
  args: { initialPage: 3, totalPages: 7 },
  render: (args) => <PaginationExample {...args} />,
} satisfies Meta<PaginationStoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const FirstPage: Story = {
  args: { initialPage: 1, totalPages: 5 },
}

export const LastPage: Story = {
  args: { initialPage: 5, totalPages: 5 },
}
