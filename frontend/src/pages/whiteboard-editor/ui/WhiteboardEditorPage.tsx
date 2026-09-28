import { lazy, Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileX } from 'lucide-react'
import { getWhiteboardDocumentRequest } from '@/entities/whiteboard-document'
import { useSessionStore } from '@/entities/session'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { ErrorState } from '@/shared/ui/error-state'
import { LoadingState } from '@/shared/ui/loading-state'
import { CanvasTopBar } from '@/shared/ui/canvas-top-bar'

const WhiteboardCanvas = lazy(
  () => import('@/features/whiteboard-editor/ui/WhiteboardCanvas'),
)
type Props = {
  workspaceId: string
  projectId: string
  documentId: string
  onBack: () => void
}
export function WhiteboardEditorPage({ ...props }: Props) {
  return (
    <WhiteboardEditorContent
      key={`${props.workspaceId}:${props.projectId}:${props.documentId}`}
      {...props}
    />
  )
}

function WhiteboardEditorContent({
  workspaceId,
  projectId,
  documentId,
  onBack,
}: Props) {
  const [startedAt, setStartedAt] = useState(Date.now)
  const accessToken = useSessionStore((state) => state.accessToken)
  const user = useSessionStore((state) => state.user)
  // 입장 후 세션이 폐기돼도 미저장 장면과 내보내기 화면은 유지한다.
  const [editorUser] = useState(user)
  const authenticated = !!accessToken && user?.id === editorUser?.id
  const query = useQuery({
    queryKey: [
      'whiteboard-document',
      editorUser?.id,
      workspaceId,
      projectId,
      documentId,
    ],
    queryFn: () =>
      getWhiteboardDocumentRequest(
        workspaceId,
        projectId,
        documentId,
        accessToken!,
      ),
    enabled: authenticated,
    retry: false,
    refetchOnWindowFocus: false,
  })
  if (!editorUser) return null
  const loading = (label: string) => (
    <main className="flex h-dvh flex-col">
      <CanvasTopBar title={query.data?.name ?? '화이트보드'} onBack={onBack} />
      <LoadingState
        label={label}
        startedAt={startedAt}
        className="bg-background-subtle min-h-0"
      />
    </main>
  )
  if (query.isPending) return loading('화이트보드를 불러오는 중')
  if (!query.data) {
    const missing =
      (query.error as { response?: { status?: number } }).response?.status ===
      404
    // 부재(404)는 실패가 아니라 빈 상태로, 로딩 실패만 ErrorState로 안내한다.
    return (
      <main className="bg-background-default flex min-h-dvh items-center justify-center">
        {missing ? (
          <EmptyState
            className="w-full max-w-90"
            icon={<FileX className="size-8" />}
            title="화이트보드를 찾을 수 없어요"
            description="삭제되었거나 접근할 수 없는 화이트보드예요"
            action={
              <Button variant="secondary" onClick={onBack}>
                프로젝트로 돌아가기
              </Button>
            }
          />
        ) : (
          <ErrorState
            className="w-full max-w-90"
            title="화이트보드를 불러오지 못했어요"
            action={
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setStartedAt(Date.now())
                    void query.refetch()
                  }}
                >
                  다시 시도
                </Button>
                <Button variant="secondary" onClick={onBack}>
                  프로젝트로 돌아가기
                </Button>
              </div>
            }
          />
        )}
      </main>
    )
  }
  return (
    <Suspense fallback={loading('편집기를 준비하는 중')}>
      <WhiteboardCanvas
        key={documentId}
        workspaceId={workspaceId}
        projectId={projectId}
        document={query.data}
        accessToken={authenticated ? accessToken! : ''}
        userId={editorUser.id}
        onBack={onBack}
      />
    </Suspense>
  )
}
