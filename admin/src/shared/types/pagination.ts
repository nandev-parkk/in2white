/** 백엔드 `createPaginationMeta`가 돌려주는 모양과 같다. */
export type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}
