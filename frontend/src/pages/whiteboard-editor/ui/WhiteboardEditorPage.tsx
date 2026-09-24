import { lazy, Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getWhiteboardDocumentRequest } from '@/entities/whiteboard-document'
import { useSessionStore } from '@/entities/session'
import { Button } from '@/shared/ui/button'
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
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <h1>
          {missing
            ? '화이트보드를 찾을 수 없어요'
            : '화이트보드를 불러오지 못했어요'}
        </h1>
        {!missing && (
          <Button
            onClick={() => {
              setStartedAt(Date.now())
              void query.refetch()
            }}
          >
            다시 시도
          </Button>
        )}
        <Button variant="secondary" onClick={onBack}>
          프로젝트로 돌아가기
        </Button>
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
