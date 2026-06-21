import type { User } from "@prisma/client";
import { runClientChasingScheduler } from "@/lib/services/chasing/client-chasing-service";

export async function runClientChasingCheck(input: {
  workspaceId: string;
  user: Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson" | "email" | "name">;
  requestOrigin?: string | null;
}) {
  return runClientChasingScheduler(input);
}
