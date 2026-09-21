import { createServer } from "node:http";
import { createApp } from "@/app";
import { createWhiteboardCollaborationServer } from "@/realtime/whiteboard-collaboration";

export function createApplicationServer(
  shutdownDeadlineAt: () => number = () => Number.POSITIVE_INFINITY,
) {
  // Socket.IO가 기존 HTTP listener를 감싸 polling 요청을 독점 처리하도록 먼저 연결한다.
  const httpServer = createServer(
    createApp({
      onWhiteboardDocumentDeleted: (documentId) => collaboration.documentDeleted(documentId),
    }),
  );
  const collaboration = createWhiteboardCollaborationServer(httpServer, { shutdownDeadlineAt });
  return { httpServer, collaboration };
}
