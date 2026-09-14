import Redis from "iovalkey";
import { getEnv } from "@/config/env";

export const valkey = new Redis(getEnv().VALKEY_URL, {
  lazyConnect: true,
});

export async function closeValkey(): Promise<void> {
  if (valkey.status === "wait" || valkey.status === "end") {
    return;
  }
  await valkey.quit();
}
