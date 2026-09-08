import type { Request, Response } from "express";
import { listQuerySchema } from "@/schemas/list-query.schema";
import { createProjectSchema, projectParamsSchema } from "@/schemas/project.schema";
import { createProject, listProjects } from "@/services/project.service";
import { parseOrThrow } from "@/utils/parse-or-throw";
import { requireUser } from "@/utils/require-user";

export async function createProjectHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { workspaceId } = parseOrThrow(projectParamsSchema, req.params);
  const { name, description } = parseOrThrow(createProjectSchema, req.body);

  const project = await createProject({
    workspaceId,
    name,
    description,
    creatorId: user.sub,
  });

  res.status(201).json({ project });
}

export async function listProjectsHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { workspaceId } = parseOrThrow(projectParamsSchema, req.params);
  const { search, page, limit } = parseOrThrow(listQuerySchema, req.query);

  const result = await listProjects({
    workspaceId,
    userId: user.sub,
    search,
    page,
    limit,
  });

  res.status(200).json(result);
}
