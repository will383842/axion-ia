#!/usr/bin/env tsx
/**
 * ESSAI DE FUMÉE de la transcription et d'une passe (après la mise en ligne
 * de la PR 6 ; LOTS-EXECUTION §1.2 « SUPPOSÉ, vérifié par l'essai »).
 *
 * À lancer DANS LE WORKER (seul à détenir la clé), sur un AUDIO PUBLIC
 * français de 3 minutes (domaine public, source notée dans JOURNAL.md) —
 * JAMAIS une voix réelle d'un client :
 *
 *   docker cp scripts/visio/essai-transcription.ts <worker>:/app/scripts/visio/
 *   docker cp extrait-domaine-public.webm <worker>:/tmp/essai.webm
 *   docker exec <worker> npx tsx scripts/visio/essai-transcription.ts /tmp/essai.webm 180
 *
 * Vérifie et IMPRIME DES NOMBRES seulement : segments rendus, langue
 * acceptée, fin du dernier segment ≥ durée − 20 s, jetons facturés ; puis une
 * passe P1 FICTIVE (`status = completed`, schéma respecté). Les deux coûts
 * sont tracés avec un `jobId` `visio-essai-…`.
 */

import { readFileSync } from "node:fs";

import { chargerCatalogue } from "../../src/server/visio/catalogue-ia";
import { instructionsDe } from "../../src/server/visio/consignes";
import { obtenirClientOpenAI } from "../../src/server/visio/openai/client";
import { portCoutReel } from "../../src/server/visio/openai/cout";
import { executerPasse } from "../../src/server/visio/openai/passe";
import {
  transcrireTranche,
  trancheTronquee,
} from "../../src/server/visio/openai/transcrire-tranche";
import { SCHEMAS_VISIO } from "../../src/server/visio/schemas";

async function main(): Promise<void> {
  if (process.env["CI"] === "true") throw new Error("l'essai de fumée ne tourne jamais en CI.");
  const [fichier, dureeS] = process.argv.slice(2);
  if (!fichier || !dureeS)
    throw new Error("usage : essai-transcription.ts <audio.webm> <durée en secondes>");
  const client = obtenirClientOpenAI();
  const jobId = `visio-essai-${Date.now()}`;
  const segments = await transcrireTranche(
    { client, cout: portCoutReel },
    {
      octets: readFileSync(fichier),
      dureeMs: Number(dureeS) * 1000,
      niveauFinMuet: false,
      decalageMs: 0,
      jobId: `${jobId}-transcription`,
    },
  );
  const fin = segments.reduce((m, s) => Math.max(m, s.finMs), 0);
  console.log(
    JSON.stringify({
      segments: segments.length,
      voix: [...new Set(segments.map((s) => s.locuteurBrut))].length,
      finDernierSegmentS: fin / 1000,
      tronquee: trancheTronquee(
        segments.map((s) => ({ end: s.finMs / 1000 })),
        Number(dureeS) * 1000,
        false,
      ),
    }),
  );
  const catalogue = await chargerCatalogue();
  const p1 = await executerPasse(
    { client, cout: portCoutReel },
    {
      passe: "extraire",
      schema: SCHEMAS_VISIO.extraction.schema,
      nomSchema: SCHEMAS_VISIO.extraction.nom,
      instructions: instructionsDe("extraire", catalogue.texte),
      entree:
        "<echange>date: 06/10/2026 · durée réelle: 00:01:00 · type: visio</echange>\n<transcription>\n[S0001 00:00:04 AXION] Bonjour, j'enregistre notre échange, d'accord ?\n[S0002 00:00:09 CLIENT_1] Oui, pas de souci, allez-y.\n[S0003 00:00:20 CLIENT_1] On serait douze commerciaux fictifs à former.\n</transcription>\nProduis l'extraction au format imposé.",
      jobId: `${jobId}-p1`,
    },
  );
  console.log(
    JSON.stringify({ p1: "completed", modele: p1.modele, faits: p1.sortie.faits.length }),
  );
}

main().catch((err: unknown) => {
  console.error(
    `[visio:essai] ${err instanceof Error ? `${err.name} ${(err as { code?: string }).code ?? ""}` : "erreur"}`,
  );
  process.exit(1);
});
