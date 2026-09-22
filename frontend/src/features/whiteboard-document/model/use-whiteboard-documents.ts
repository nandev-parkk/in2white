import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/entities/session'

import {
  createWhiteboardDocumentRequest,
  deleteWhiteboardDocumentRequest,
  listWhiteboardDocumentsRequest,
  updateWhiteboardDocumentRequest,
  type WhiteboardDocumentInput,
  type WhiteboardDocumentListParams,
} from '@/entities/whiteboard-document'

function listKey(workspaceId: string | null, projectId: string | null) {
  return ['whiteboard-documents', workspaceId, projectId]
}

export function useWhiteboardDocuments(
  accessToken: string | null,
  workspaceId: string | null,
  projectId: string | null,
  params: WhiteboardDocumentListParams,
) {
  const userId = useSessionStore((state) => state.user?.id)
  return useQuery({
    queryKey: [...listKey(workspaceId, projectId), userId, params],
    queryFn: () =>
      listWhiteboardDocumentsRequest(
        workspaceId as string,
        projectId as string,
        params,
        accessToken as string,
      ),
    enabled: Boolean(accessToken && workspaceId && projectId),
    placeholderData: (previousData, previousQuery) =>
      accessToken &&
      previousQuery?.queryKey[1] === workspaceId &&
      previousQuery.queryKey[2] === projectId &&
      previousQuery.queryKey[3] === userId
        ? previousData
        : undefined,
  })
}

export function useCreateWhiteboardDocument(
  accessToken: string | null,
  workspaceId: string | null,
  projectId: string | null,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: WhiteboardDocumentInput) =>
      createWhiteboardDocumentRequest(
        workspaceId as string,
        projectId as string,
        input,
        accessToken as string,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: listKey(workspaceId, projectId),
      }),
  })
}

export function useUpdateWhiteboardDocument(
  accessToken: string | null,
  workspaceId: string | null,
  projectId: string | null,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      documentId,
      input,
    }: {
      documentId: string
      input: WhiteboardDocumentInput
    }) =>
      updateWhiteboardDocumentRequest(
        workspaceId as string,
        projectId as string,
        documentId,
        input,
        accessToken as string,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: listKey(workspaceId, projectId),
      }),
  })
}

export function useDeleteWhiteboardDocument(
  accessToken: string | null,
  workspaceId: string | null,
  projectId: string | null,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (documentId: string) =>
      deleteWhiteboardDocumentRequest(
        workspaceId as string,
        projectId as string,
        documentId,
        accessToken as string,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: listKey(workspaceId, projectId),
      }),
  })
}
