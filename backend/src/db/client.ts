import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { getEnv } from "@/config/env";
import * as schema from "@/db/schema";

const queryClient = postgres(getEnv().DATABASE_URL, {
  max: 10,
});

export const db = drizzle(queryClient, { schema });
