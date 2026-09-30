/**
 * `pnpm enregistreur:contrat` — écrit le contrat de l'enregistreur Meet pour
 * l'extension (PR 5) :
 *
 *   extensions/enregistreur-meet/contrat.json     constantes + JSON Schema
 *   extensions/enregistreur-meet/contrat.sha256   empreinte de contrat.json
 *
 * Source unique : `src/lib/schemas/enregistreur.ts`. Ne jamais retoucher ces
 * deux fichiers à la main : `le-contrat-genere-suit-le-zod` et
 * `l-empreinte-du-contrat-de-l-extension-est-a-jour` rougiraient.
 *
 * Vérifier après coup : `git diff --exit-code extensions/enregistreur-meet/contrat.json`.
 */

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { texteDuContrat } from "../../src/lib/schemas/enregistreur";

const DOSSIER = join(process.cwd(), "extensions", "enregistreur-meet");
const texte = texteDuContrat();
const empreinte = createHash("sha256").update(texte, "utf8").digest("hex");

writeFileSync(join(DOSSIER, "contrat.json"), texte, "utf8");
writeFileSync(join(DOSSIER, "contrat.sha256"), `${empreinte}\n`, "utf8");
console.warn(`[enregistreur:contrat] contrat.json écrit (sha256 ${empreinte.slice(0, 12)}…)`);
