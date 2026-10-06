import type { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";
import { HttpError } from "@/utils/http-error";

export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? ERROR_MESSAGES.VALIDATION_ERROR,
    );
  }

  return parsed.data;
}
