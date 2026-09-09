import type { Request, Response } from "express";
import { listQuerySchema } from "@/schemas/list-query.schema";
import { memberParamsSchema } from "@/schemas/member.schema";
import { listMembers } from "@/services/member.service";
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
