import crypto from "crypto";
import type { OfficialUpdateConnector, OfficialUpdatePayload } from "@/lib/connectors/update-connector";

export function hashUpdateContent(rawContent: string) {
  return crypto.createHash("sha256").update(rawContent).digest("hex");
}

export function dedupeByHash(updates: OfficialUpdatePayload[]) {
  const seen = new Set<string>();
  return updates.filter((update) => {
    const hash = hashUpdateContent(update.rawContent);
    if (seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });
}

export async function ingestUpdates(connectors: OfficialUpdateConnector[]) {
  const fetched = await Promise.all(connectors.map((connector) => connector.fetchUpdates()));
  return dedupeByHash(fetched.flat());
}
