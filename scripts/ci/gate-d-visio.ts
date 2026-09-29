#!/usr/bin/env tsx
/**
 * Gate D — COMPORTEMENTS DU CHANTIER VISIO SUR UNE VRAIE BASE, par le vrai
 * client Prisma (PR 2 : squelette ; étendu en PR 3 et PR 6).
 *
 * Ce que `tests/sql/dossier-client-comportement.sql` ne peut pas prouver,
 * parce qu'il ne passe pas par le pool Prisma :
 *
 *   ⛔ LE DRAPEAU D'EFFACEMENT NE FUIT PAS HORS DE SA TRANSACTION.
 *   `src/lib/rgpd-erase.ts` pose `axion.effacement_rgpd` en `SET LOCAL`, une
 *   première dans ce dépôt (vérification V3-C8). Si c'était un `SET` de
 *   session, la connexion rendue au pool garderait le drapeau, et la requête
 *   suivante — de n'importe quel écran — pourrait réécrire un fait. On force
 *   donc UNE seule connexion (`connection_limit=1`), on passe par
 *   `executerSousDrapeauEffacement`, puis on vérifie sur cette même connexion
 *   que le drapeau est retombé et que le trigger refuse de nouveau.
 *
 * Mutation qui fait rougir : remplacer `SET LOCAL` par `SET` dans
 * `executerSousDrapeauEffacement`.
 *
 * Aucune ligne ne reste : tout ce qui est créé est supprimé à la fin, et le
 * script le vérifie.
 */

import { PrismaClient } from "../../prisma/generated/client";
import { executerSousDrapeauEffacement } from "../../src/lib/rgpd-erase";

const CLIENT_ID = "00000000-0000-4000-8000-0000000000c9";
const FAIT_ID = "00000000-0000-4000-8000-0000000000f9";

function urlUneConnexion(): string {
  const brute = process.env["DATABASE_URL"];
  if (!brute) throw new Error("DATABASE_URL absente");
  const url = new URL(brute);
  url.searchParams.set("connection_limit", "1");
  return url.toString();
}

async function drapeau(db: PrismaClient): Promise<string | null> {
  const r = await db.$queryRaw<Array<{ v: string | null }>>`
    SELECT current_setting('axion.effacement_rgpd', true) AS v`;
  return r[0]?.v ?? null;
}

/** Vrai si la réécriture de l'énoncé est refusée par le trigger. */
async function reecritureRefusee(db: PrismaClient, valeur: string): Promise<boolean> {
  try {
    await db.fait.update({ where: { id: FAIT_ID }, data: { enonce: valeur } });
    return false;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/immuable|AXV01/.test(message)) throw err;
    return true;
  }
}

async function main(): Promise<void> {
  const db = new PrismaClient({ datasources: { db: { url: urlUneConnexion() } } });
  const fautes: string[] = [];
  try {
    await db.client.create({
      data: {
        id: CLIENT_ID,
        numero: "AXI-CLI-VISIO-GATE-D",
        raisonSociale: "Client fictif (Gate D)",
      },
    });
    await db.fait.create({
      data: {
        id: FAIT_ID,
        clientId: CLIENT_ID,
        portee: "entreprise",
        type: "besoin",
        cle: "global",
        enonce: "enc:v1:avant",
        certitude: "dit_explicitement",
        confiance: "haute",
        source: "saisie_manuelle",
        constateLe: new Date(),
      },
    });

    // 1. Sans drapeau : refusé.
    if (!(await reecritureRefusee(db, "enc:v1:sans-drapeau"))) {
      fautes.push("sans drapeau, la réécriture d'un fait a été ACCEPTÉE");
    }

    // 2. Sous le drapeau, par la seule porte : accepté.
    await executerSousDrapeauEffacement(db, async (tx) => {
      await tx.fait.update({ where: { id: FAIT_ID }, data: { enonce: "" } });
    });

    // 3. Même connexion, juste après : le drapeau est retombé.
    const apres = await drapeau(db);
    if (apres === "on")
      fautes.push("le drapeau d'effacement a FUI hors de sa transaction (COMMIT)");
    if (!(await reecritureRefusee(db, "enc:v1:apres-commit"))) {
      fautes.push("après la transaction d'effacement, la réécriture d'un fait est ACCEPTÉE");
    }

    // 4. Une transaction d'effacement qui échoue ne laisse pas non plus le drapeau.
    try {
      await executerSousDrapeauEffacement(db, async () => {
        throw new Error("échec volontaire");
      });
    } catch {
      // attendu
    }
    if ((await drapeau(db)) === "on") {
      fautes.push("le drapeau d'effacement a FUI hors d'une transaction annulée (ROLLBACK)");
    }
    if (!(await reecritureRefusee(db, "enc:v1:apres-rollback"))) {
      fautes.push("après une transaction d'effacement annulée, la réécriture est ACCEPTÉE");
    }
  } finally {
    // Nettoyage : la suppression d'un fait n'est pas bloquée par le trigger
    // (il ne garde que la MODIFICATION du contenu).
    await db.fait.deleteMany({ where: { id: FAIT_ID } });
    await db.client.deleteMany({ where: { id: CLIENT_ID } });
    const restes = (await db.fait.count()) + (await db.client.count({ where: { id: CLIENT_ID } }));
    if (restes !== 0) fautes.push(`${restes} ligne(s) de test restée(s) en base`);
    await db.$disconnect();
  }

  if (fautes.length > 0) {
    for (const f of fautes) console.error(`::error::[visio] ${f}`);
    process.exit(1);
  }
  console.log(
    "[visio] le drapeau d'effacement ne fuit pas hors de sa transaction (COMMIT et ROLLBACK)",
  );
}

main().catch((err: unknown) => {
  console.error("::error::[visio] gate-d-visio —", err instanceof Error ? err.message : err);
  process.exit(1);
});
