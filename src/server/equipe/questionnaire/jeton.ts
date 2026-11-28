import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Jeton du lien personnel du questionnaire : 32 octets aléatoires, base64url. Seul son sha256 est stocké. */
export function genererJetonQuestionnaire(): string {
  return randomBytes(32).toString("base64url");
}

export function hacherJetonQuestionnaire(jeton: string): string {
  return createHash("sha256").update(jeton, "utf8").digest("hex");
}
