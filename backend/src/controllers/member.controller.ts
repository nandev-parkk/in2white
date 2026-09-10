import type { Request, Response } from "express";
import { listQuerySchema } from "@/schemas/list-query.schema";
import {
  addMemberBodySchema,
  memberParamsSchema,
  memberRemoveParamsSchema,
} from "@/schemas/member.schema";
import { addMember, listMembers, removeMember } from "@/services/member.service";
import { parseOrThrow } from "@/utils/parse-or-throw";
import { requireUser } from "@/utils/require-user";

export async function listMembersHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { workspaceId } = parseOrThrow(memberParamsSchema, req.params);
  const { search, page, limit } = parseOrThrow(listQuerySchema, req.query);

  const result = await listMembers({
    workspaceId,
    requesterId: user.sub,
    search,
    page,
    limit,
  });

  res.status(200).json(result);
}

export async function addMemberHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { workspaceId } = parseOrThrow(memberParamsSchema, req.params);
  const { userId } = parseOrThrow(addMemberBodySchema, req.body);

  const member = await addMember({
    workspaceId,
    requesterId: user.sub,
    userId,
  });

  res.status(201).json({ member });
}

export async function removeMemberHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { workspaceId, userId } = parseOrThrow(memberRemoveParamsSchema, req.params);

  await removeMember({
    workspaceId,
    requesterId: user.sub,
    userId,
  });

  res.status(204).send();
}
