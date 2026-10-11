import { headers } from "next/headers";
import { decideAccess, requestFrom, type Access } from "../src/app-guard.ts";
import { authEnvFromProcess, readDb, type AppDatabase } from "../src/request-db.ts";

export async function readAccess(): Promise<{ access: Access; db: AppDatabase | null }> {
  const headerList = await headers();
  const request = requestFrom(headerList.get("host"), headerList.get("cookie"));
  return {
    access: await decideAccess(request, authEnvFromProcess()),
    db: readDb(),
  };
}
