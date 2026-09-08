export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function getPaginationOffset({ page, limit }: Pick<PaginationMeta, "page" | "limit">) {
  return (page - 1) * limit;
}

export function createPaginationMeta({
  page,
  limit,
  total,
}: {
  page: number;
  limit: number;
  total: number;
}): PaginationMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
