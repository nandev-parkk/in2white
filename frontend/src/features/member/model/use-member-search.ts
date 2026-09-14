import { useEffect, useState } from 'react'
export function useMemberSearch() {
  const [search, setSearch] = useState('')
  const [params, setParams] = useState({ search: '', page: 1, limit: 20 })
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setParams((current) =>
          current.search === search.trim()
            ? current
            : { ...current, search: search.trim(), page: 1 },
        ),
      300,
    )
    return () => clearTimeout(timer)
  }, [search])
  return {
    search,
    setSearch,
    params,
    setPage: (page: number) => setParams((current) => ({ ...current, page })),
  }
}
