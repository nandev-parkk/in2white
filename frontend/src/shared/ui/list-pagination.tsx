import {
  Pagination,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/shared/ui/pagination'

type ListPaginationProps = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

function ListPagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
}: ListPaginationProps) {
  if (totalPages <= 1) return null

  return (
    <Pagination className="justify-center">
      <PaginationPrevious
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      />
      {Array.from({ length: totalPages }, (_, index) => index + 1).map(
        (pageNumber) => (
          <PaginationItem
            key={pageNumber}
            isActive={pageNumber === page}
            disabled={disabled}
            onClick={() => onPageChange(pageNumber)}
          >
            {pageNumber}
          </PaginationItem>
        ),
      )}
      <PaginationNext
        disabled={disabled || page >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
      />
    </Pagination>
  )
}

export { ListPagination }
