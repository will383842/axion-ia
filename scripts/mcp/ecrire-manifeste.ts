/**
 * `pnpm mcp:manifeste` — produit `src/server/mcp/manifeste.json`.
 *
 * Le fichier versionné porte le manifeste (indenté, pour la revue) ET son
 * empreinte canonique — celle que le socle inscrit dans `adapters.lock.json`.
 * La garde `src/server/mcp/__tests__/manifeste.spec.ts` recalcule les deux
 * depuis le code : un outil modifié sans régénération fait rougir la CI, et
 * dit quelle commande relancer.
 *
 * ⚠️ Le SHA couvre le TEXTE CANONIQUE (clés triées, sans espace), pas ce
 *    fichier indenté. Recalculer un SHA sur le fichier donnerait une autre
 *    valeur, et le socle refuserait l'adaptateur pour « empreinte divergente ».
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  construireManifeste,
  empreinteDuManifeste,
  texteDuManifeste,
} from "../../src/server/mcp/manifeste";

const CIBLE = resolve(process.cwd(), "src/server/mcp/manifeste.json");

const manifeste = construireManifeste();
const empreinte = empreinteDuManifeste(manifeste);
const octets = Buffer.byteLength(texteDuManifeste(manifeste), "utf8");

const document = {
  $note:
    "Généré par `pnpm mcp:manifeste`. Ne pas éditer à la main : la garde compare " +
    "au code. `manifestSha` couvre le texte canonique, pas ce fichier.",
  manifestSha: empreinte,
  octetsCanoniques: octets,
  manifeste,
};

writeFileSync(CIBLE, `${JSON.stringify(document, null, 2)}\n`, "utf8");

console.log(
  `✅ [mcp:manifeste] ${String(manifeste.tools.length)} outil(s) · ${String(octets)} octets ` +
    `canoniques · ${empreinte}\n   → ${CIBLE}`,
);
