import type { Request, Response } from "express";
import { createWorkspaceSchema, updateWorkspaceSchema } from "@/schemas/workspace.schema";
import {
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  updateWorkspace,
} from "@/services/workspace.service";
import { ERROR_MESSAGES } from "@/constants/messages";
import { HttpError } from "@/utils/http-error";

export async function createWorkspaceHandler(req: Request, res: Response) {
  if (!req.user) {
    throw new HttpError(401, "UNAUTHORIZED", ERROR_MESSAGES.MISSING_BEARER_TOKEN);
  }

  const parsed = createWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? ERROR_MESSAGES.VALIDATION_ERROR,
    );
  }

  const workspace = await createWorkspace({
    name: parsed.data.name,
    ownerId: req.user.sub,
  });

  res.status(201).json({ workspace });
}

export async function listWorkspacesHandler(req: Request, res: Response) {
  if (!req.user) {
    throw new HttpError(401, "UNAUTHORIZED", ERROR_MESSAGES.MISSING_BEARER_TOKEN);
  }

  const workspaceList = await listWorkspaces(req.user.sub);
  res.status(200).json({ workspaces: workspaceList });
}

export async function updateWorkspaceHandler(req: Request, res: Response) {
  if (!req.user) {
    throw new HttpError(401, "UNAUTHORIZED", ERROR_MESSAGES.MISSING_BEARER_TOKEN);
  }

  const parsed = updateWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? ERROR_MESSAGES.VALIDATION_ERROR,
    );
  }

  const workspace = await updateWorkspace({
    workspaceId: req.params.workspaceId,
    name: parsed.data.name,
    userId: req.user.sub,
  });

  res.status(200).json({ workspace });
}

export async function deleteWorkspaceHandler(req: Request, res: Response) {
  if (!req.user) {
    throw new HttpError(401, "UNAUTHORIZED", ERROR_MESSAGES.MISSING_BEARER_TOKEN);
  }

  await deleteWorkspace({
    workspaceId: req.params.workspaceId,
    userId: req.user.sub,
  });

  res.status(204).send();
}
