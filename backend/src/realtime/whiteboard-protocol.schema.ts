import { z } from "zod";

const finiteNumberSchema = z.number().finite();
const finiteNonnegativeIntegerSchema = z.number().finite().int().nonnegative();
const reservedFileIds = new Set(["__proto__", "constructor", "prototype"]);
const isReservedFileId = (fileId: string): boolean => reservedFileIds.has(fileId);
export const whiteboardFileIdSchema = z
  .string()
  .min(1)
  .max(255)
  .refine((fileId) => !isReservedFileId(fileId), {
    message: "Reserved file id is not allowed",
  });

export const whiteboardElementSchema = z
  .object({
    id: z.string().min(1).max(255),
    version: z.number().int().nonnegative(),
    versionNonce: z.number().int().nonnegative(),
    isDeleted: z.boolean(),
  })
  .passthrough();

export const whiteboardFileSchema = z
  .object({
    id: whiteboardFileIdSchema,
    mimeType: z.string(),
    dataURL: z.string(),
    created: finiteNumberSchema,
    lastRetrieved: finiteNonnegativeIntegerSchema.optional(),
    version: finiteNonnegativeIntegerSchema.optional(),
  })
  .passthrough();

const whiteboardFileUpdatesSchema = z
  .unknown()
  .superRefine((value, context) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return;
    }

    for (const fileId of Object.keys(value)) {
      if (isReservedFileId(fileId)) {
        context.addIssue({
          code: "custom",
          message: "Reserved file id is not allowed",
          path: [fileId],
        });
      }
    }
  })
  .pipe(
    z.record(whiteboardFileIdSchema, whiteboardFileSchema).superRefine((files, context) => {
      for (const [fileId, file] of Object.entries(files)) {
        if (file.id !== fileId) {
          context.addIssue({
            code: "custom",
            message: "File map key must match file.id",
            path: [fileId, "id"],
          });
        }
      }
    }),
  );

export const whiteboardJoinPayloadSchema = z.object({
  workspaceId: z.uuid(),
  projectId: z.uuid(),
  documentId: z.uuid(),
});

export const whiteboardSceneUpdatePayloadSchema = z.object({
  documentId: z.uuid(),
  clientUpdateId: z.uuid(),
  elements: z.array(whiteboardElementSchema).max(2000),
  fileUpdates: whiteboardFileUpdatesSchema.optional(),
});

export const whiteboardPresenceUpdatePayloadSchema = z.object({
  documentId: z.uuid(),
  cursor: z.object({ x: z.number().finite(), y: z.number().finite() }).nullable(),
  activeElementIds: z.array(z.string().min(1).max(255)).max(50),
});

export type WhiteboardJoinPayload = z.infer<typeof whiteboardJoinPayloadSchema>;
export type WhiteboardSceneUpdatePayload = z.infer<typeof whiteboardSceneUpdatePayloadSchema>;
export type WhiteboardPresenceUpdatePayload = z.infer<typeof whiteboardPresenceUpdatePayloadSchema>;
