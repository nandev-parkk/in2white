import { z } from 'zod'

import { MESSAGES } from '@/shared/constants/messages'

/* 백엔드 `workspaceNameSchema`와 같은 제약이다. 둘이 어긋나면 서버에서만 실패한다. */
export const updateWorkspaceFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, MESSAGES.workspace.validation.nameRequired)
    .max(255, MESSAGES.workspace.validation.nameTooLong),
})

export type UpdateWorkspaceFormValues = z.infer<
  typeof updateWorkspaceFormSchema
>
