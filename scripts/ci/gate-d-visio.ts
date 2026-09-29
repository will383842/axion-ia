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
 *   ⛔ (PR 3) DEUX CRÉATIONS SIMULTANÉES AU MÊME SIREN NE DONNENT QU'UNE FICHE.
 *   Deux clients Prisma (deux connexions, deux transactions) appellent en même
 *   temps la porte unique `creerOuRetrouverClient` avec le même SIREN : le
 *   verrou consultatif `pg_advisory_xact_lock(hashtext(…))` fait attendre la
 *   seconde, qui refait sa recherche APRÈS la validation de la première et la
 *   trouve. Attendu : une création, un refus, une seule fiche.
 *   Mutation qui fait rougir : retirer la boucle des verrous de la porte (les
 *   deux recherches passent avant les deux écritures : deux fiches). Angle
 *   mort : sans verrou, la course reste probabiliste ; on la joue cinq fois.
 *
 *   ⛔ (PR 6) LA CHAÎNE VISIO DE BOUT EN BOUT (`gate-d-chaine-visio.ts`) :
 *   dépôt des morceaux → transcription → précontrôles → passes → vérifications
 *   → validation → purge → 2ᵉ rendez-vous → retrait, avec un faux client
 *   OpenAI sur la vraie base. Contre-témoin : une P1 tronquée n'atteint jamais
 *   « à valider ».
 *
 * Aucune ligne ne reste : tout ce qui est créé est supprimé à la fin, et le
 * script le vérifie.
 */

import { PrismaClient } from "../../prisma/generated/client";
import { executerSousDrapeauEffacement } from "../../src/lib/rgpd-erase";
import { creerOuRetrouverClient } from "../../src/server/qualiopi/crm/porte-client";
import { chaineVisioDeBoutEnBout } from "./gate-d-chaine-visio";

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

/**
 * SIREN fictifs de la course (un par manche), jamais ceux d'une vraie
 * entreprise. Clé de Luhn VALIDE : la porte contrôle le SIREN comme la saisie
 * (`checkSirenFormat`) et refuse d'écrire un SIREN invalide.
 */
const SIRENS_COURSE = ["900000001", "900000019", "900000027", "900000035", "900000043"];

/**
 * ⛔ Deux créations simultanées au même SIREN, par deux connexions : une seule
 * fiche. Rend la liste des fautes ; nettoie ce qu'elle a créé.
 */
async function deuxCreationsSimultanees(): Promise<string[]> {
  const fautes: string[] = [];
  const a = new PrismaClient();
  const b = new PrismaClient();
  try {
    await Promise.all([a.$connect(), b.$connect()]);
    for (const siren of SIRENS_COURSE) {
      const [ra, rb] = await Promise.all([
        creerOuRetrouverClient(a, { raisonSociale: "Course A (Gate D)", siren }, null, {
          parAdminId: null,
        }),
        creerOuRetrouverClient(b, { raisonSociale: "Course B (Gate D)", siren }, null, {
          parAdminId: null,
        }),
      ]);
      const statuts = [ra.statut, rb.statut].sort();
      const fiches = await a.client.count({ where: { siren } });
      if (fiches !== 1 || statuts[0] !== "cree" || statuts[1] !== "refuse_siren") {
        fautes.push(
          `deux créations simultanées au SIREN ${siren} : ${fiches} fiche(s), statuts ${statuts.join(" / ")} (attendu : 1 fiche, cree / refuse_siren)`,
        );
      }
    }
  } finally {
    await a.client.deleteMany({ where: { siren: { in: SIRENS_COURSE } } });
    const restes = await a.client.count({ where: { siren: { in: SIRENS_COURSE } } });
    if (restes !== 0) fautes.push(`${restes} fiche(s) de la course restée(s) en base`);
    await Promise.all([a.$disconnect(), b.$disconnect()]);
  }
  return fautes;
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

  fautes.push(...(await deuxCreationsSimultanees()));

  // (PR 6) ⛔ La chaîne visio de bout en bout, faux OpenAI, vraie base.
  try {
    fautes.push(...(await chaineVisioDeBoutEnBout()));
  } catch (err) {
    fautes.push(`chaîne visio : ${err instanceof Error ? err.message : String(err)}`);
  }

  if (fautes.length > 0) {
    for (const f of fautes) console.error(`::error::[visio] ${f}`);
    process.exit(1);
  }
  console.log(
    "[visio] le drapeau d'effacement ne fuit pas hors de sa transaction (COMMIT et ROLLBACK)",
  );
  console.log(
    `[visio] deux créations simultanées au même SIREN ne donnent qu'une fiche (${SIRENS_COURSE.length} manches)`,
  );
}

main().catch((err: unknown) => {
  console.error("::error::[visio] gate-d-visio —", err instanceof Error ? err.message : err);
  process.exit(1);
});
