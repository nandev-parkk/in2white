import type { Request, Response } from "express";
import { createWorkspaceSchema, updateWorkspaceSchema } from "@/schemas/workspace.schema";
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspaceDetail,
  listWorkspaces,
  updateWorkspace,
} from "@/services/workspace.service";
import { parseOrThrow } from "@/utils/parse-or-throw";
import { requireUser } from "@/utils/require-user";

export async function createWorkspaceHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { name } = parseOrThrow(createWorkspaceSchema, req.body);

  const workspace = await createWorkspace({ name, ownerId: user.sub });

  res.status(201).json({ workspace });
}

export async function listWorkspacesHandler(req: Request, res: Response) {
  const user = requireUser(req);

  const workspaceList = await listWorkspaces(user.sub);
  res.status(200).json({ workspaces: workspaceList });
}

export async function getWorkspaceDetailHandler(req: Request, res: Response) {
  const user = requireUser(req);

  const workspace = await getWorkspaceDetail({
    workspaceId: req.params.workspaceId,
    userId: user.sub,
  });

  res.status(200).json({ workspace });
}

export async function updateWorkspaceHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { name } = parseOrThrow(updateWorkspaceSchema, req.body);

  const workspace = await updateWorkspace({
    workspaceId: req.params.workspaceId,
    name,
    userId: user.sub,
  });

  res.status(200).json({ workspace });
}

export async function deleteWorkspaceHandler(req: Request, res: Response) {
  const user = requireUser(req);

  await deleteWorkspace({
    workspaceId: req.params.workspaceId,
    userId: user.sub,
  });

  res.status(204).send();
}
