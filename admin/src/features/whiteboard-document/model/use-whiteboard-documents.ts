import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  deleteWhiteboardDocumentRequest,
  listWhiteboardDocumentsRequest,
  restoreWhiteboardDocumentRequest,
  type WhiteboardDocumentListParams,
} from '@/entities/whiteboard-document'
import { QUERY_KEYS } from '@/shared/api'

export function useWhiteboardDocuments(params: WhiteboardDocumentListParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.whiteboardDocuments, params],
    queryFn: () => listWhiteboardDocumentsRequest(params),
    placeholderData: (previousData) => previousData,
  })
}

/*
 * 프로젝트 목록·상세의 문서 수와 워크스페이스 상세의 문서 수가 함께 바뀐다. 문서 목록만
 * 새로 받으면 프로젝트 화면에 옛 숫자가 남는다. 어느 프로젝트의 문서인지는 호출부마다
 * 달라서 프로젝트 키는 접두사째로 비운다.
 */
function useWhiteboardDocumentMutation<TData>(
  request: (documentId: string) => Promise<TData>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    /* 요청 함수를 그대로 넘기면 TanStack Query의 컨텍스트가 두 번째 인자로 따라붙는다. */
    mutationFn: (documentId: string) => request(documentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.whiteboardDocuments,
      })
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects })
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.projectDetails,
      })
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.workspaces })
    },
  })
}

export function useDeleteWhiteboardDocument() {
  return useWhiteboardDocumentMutation(deleteWhiteboardDocumentRequest)
}

export function useRestoreWhiteboardDocument() {
  return useWhiteboardDocumentMutation(restoreWhiteboardDocumentRequest)
}
