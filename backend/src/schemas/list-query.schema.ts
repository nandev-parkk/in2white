import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";

const pageSchema = z.coerce
  .number({ error: ERROR_MESSAGES.PAGE_INVALID })
  .int({ error: ERROR_MESSAGES.PAGE_INVALID })
  .min(1, { error: ERROR_MESSAGES.PAGE_INVALID });

const limitSchema = z.coerce
  .number({ error: ERROR_MESSAGES.LIMIT_INVALID })
  .int({ error: ERROR_MESSAGES.LIMIT_INVALID })
  .min(1, { error: ERROR_MESSAGES.LIMIT_INVALID })
  .max(100, { error: ERROR_MESSAGES.LIMIT_TOO_LARGE });

export const paginationQuerySchema = z.object({
  page: pageSchema.default(1),
  limit: limitSchema.default(20),
});

const searchSchema = z
  .string({ error: ERROR_MESSAGES.SEARCH_INVALID })
  .trim()
  .max(100, { error: ERROR_MESSAGES.SEARCH_TOO_LONG })
  .optional()
  .transform((search) => search || undefined);

export const listQuerySchema = paginationQuerySchema.extend({
  search: searchSchema,
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
