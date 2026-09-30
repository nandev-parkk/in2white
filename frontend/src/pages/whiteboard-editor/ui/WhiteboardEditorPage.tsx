import { lazy, Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileX } from 'lucide-react'
import { getWhiteboardDocumentRequest } from '@/entities/whiteboard-document'
import { useSessionStore } from '@/entities/session'
import { Button } from '@in2white/ui/button'
import { EmptyState } from '@in2white/ui/empty-state'
import { ErrorState } from '@in2white/ui/error-state'
import { LoadingState } from '@in2white/ui/loading-state'
import { CanvasTopBar } from '@/features/whiteboard-editor/ui/CanvasTopBar'
import { MESSAGES } from '@/shared/constants/messages'

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
      <CanvasTopBar
        title={query.data?.name ?? MESSAGES.whiteboard.heading.fallbackTitle}
        onBack={onBack}
      />
      <LoadingState
        label={label}
        startedAt={startedAt}
        className="bg-background-subtle min-h-0"
      />
    </main>
  )
  if (query.isPending) return loading(MESSAGES.whiteboard.a11y.loading)
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
            title={MESSAGES.whiteboard.error.notFound}
            description={MESSAGES.whiteboard.error.notFoundDescription}
            action={
              <Button variant="secondary" onClick={onBack}>
                {MESSAGES.whiteboard.action.backToProject}
              </Button>
            }
          />
        ) : (
          <ErrorState
            className="w-full max-w-90"
            title={MESSAGES.whiteboard.error.loadFailed}
            action={
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setStartedAt(Date.now())
                    void query.refetch()
                  }}
                >
                  {MESSAGES.common.action.retry}
                </Button>
                <Button variant="secondary" onClick={onBack}>
                  {MESSAGES.whiteboard.action.backToProject}
                </Button>
              </div>
            }
          />
        )}
      </main>
    )
  }
  return (
    <Suspense fallback={loading(MESSAGES.whiteboard.a11y.editorLoading)}>
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
