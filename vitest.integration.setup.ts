// Integration setup — charge `.env` dans process.env AVANT les tests integration.
// Sans ça, des secrets présents (DATABASE_URL, REDIS_URL, VOYAGE/ANTHROPIC keys)
// paraissent absents (faux négatif piège — cf. PROMPT §1.0 point 4).
// Loader zéro-dépendance (dotenv n'est pas installé ; Node 24 a --env-file mais
// vitest ne le propage pas aux forks).
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(name: string): void {
  const p = resolve(process.cwd(), name);
  if (!existsSync(p)) return;
  const content = readFileSync(p, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // ne pas écraser une variable déjà fournie par l'environnement réel
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

// `.env.local` prioritaire sur `.env` (convention Next.js).
loadEnvFile(".env.local");
loadEnvFile(".env");
