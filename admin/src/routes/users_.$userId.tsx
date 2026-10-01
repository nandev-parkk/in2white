import { createFileRoute } from '@tanstack/react-router'

import { redirectIfUnauthenticated } from '@/features/auth/model/route-guards'
import { UserDetailPage } from '@/pages/user-detail'
import { AdminAppShell } from '@/widgets/app-shell'

/*
 * `users_`로 두어 목록 라우트를 부모로 삼지 않는다. 상세는 목록 안의 중첩 화면이
 * 아니라 독립 화면이다.
 */
export const Route = createFileRoute('/users_/$userId')({
  beforeLoad: redirectIfUnauthenticated,
  component: UserDetailRoute,
})

function UserDetailRoute() {
  const { userId } = Route.useParams()

  return (
    <AdminAppShell>
      <UserDetailPage userId={userId} />
    </AdminAppShell>
  )
}
