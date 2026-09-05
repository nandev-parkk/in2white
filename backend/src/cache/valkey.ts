import Redis from "iovalkey";
import { getEnv } from "@/config/env";

export const valkey = new Redis(getEnv().VALKEY_URL, {
  lazyConnect: true,
});
