/**
 * Lot S3 (C4) — le run mensuel et la validation d'un relevé, LANCÉS ENSEMBLE,
 * contre un VRAI Postgres migré (`pnpm test:integration tests/integration/remuneration`).
 *
 * Ce qu'un faux client ne peut pas prouver : que les deux écrivains se
 * sérialisent réellement. Le run lit le statut du relevé sous son verrou de
 * période ; si la validation n'en prend aucun, elle peut geler les lignes
 * PENDANT le run, qui en recrée alors de nouvelles rattachées au même relevé —
 * un relevé validé qui porte deux fois la même prestation.
 *
 * Chaque itération repart d'un relevé `a_valider`, puis joue
 * `Promise.all([run, valider])`. Attendu : jamais plus d'UNE ligne par
 * prestation, et un relevé dont le total égale la somme de ses lignes.
 *
 * Le test écrit et VALIDE ses lignes (une course ne se joue pas dans une
 * transaction annulée) sur un mois que rien d'autre n'occupe, puis efface tout
 * ce qu'il a créé. Sans `DATABASE_URL`, ce fichier ÉCHOUE — il ne se saute pas.
 */

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const URL_BASE = process.env.DATABASE_URL;
if (!URL_BASE || URL_BASE.includes("stub.invalid")) {
  throw new Error(
    "[remuneration] DATABASE_URL absente ou stub : ce test exige un vrai Postgres migré (Gate D).",
  );
}

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: null, role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: null, role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
// L'émission automatique qui suit la validation (PDF, e-mail) n'est pas l'objet
// de ce test : elle est neutralisée, la validation reste la vraie.
vi.mock("@/server/actions/qualiopi/autofacture", () => ({
  emettreAutofactureAction: vi.fn().mockResolvedValue({ error: "neutralisée par le test" }),
}));

import { prisma } from "../../../src/lib/prisma";
import { runRemunerationMensuelle } from "../../../src/server/qualiopi/remuneration/statements";
import { transitionStatementAction } from "../../../src/server/actions/qualiopi/trainer-remuneration";

/** Un mois lointain : aucune autre donnée ne peut s'y trouver. */
const PERIODE = { year: 2031, month: 3 } as const;
const ITERATIONS = 50;

const suffixe = randomUUID().slice(0, 8);
const ids = {
  offre: randomUUID(),
  formation: randomUUID(),
  session: randomUUID(),
  trainer: randomUUID(),
  regle: randomUUID(),
};

beforeAll(async () => {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "offres_site" ("id", "code", "titre_fr", "slug", "format_pedagogique", "public_vise_fr",
       "duree_heures_min", "duree_heures_max", "tarif_type", "promesse_principale_fr", "angle_pedagogique_fr", "updated_at")
     VALUES ($1::uuid, $2, 'Offre S3', $3, 'collectif_1jour', 'Public', 7, 7, 'fixe', 'Promesse', 'Angle', now())`,
    ids.offre,
    `TEST-S3-${suffixe}`,
    `offre-test-s3-${suffixe}`,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO "formations" ("id", "numero", "titre", "slug", "offre_site_id", "duree_heures", "updated_at")
     VALUES ($1::uuid, $2, 'Formation S3', $3, $4::uuid, 7, now())`,
    ids.formation,
    `TEST-FORM-S3-${suffixe}`,
    `formation-test-s3-${suffixe}`,
    ids.offre,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO "training_sessions" ("id", "numero", "titre_session", "formation_id", "date_debut", "date_fin",
       "modalite", "montant_ht_cents", "nb_participants_prevus", "statut", "updated_at")
     VALUES ($1::uuid, $2, 'Session S3', $3::uuid, '2031-03-12T08:00:00Z', '2031-03-12T16:00:00Z',
       'presentiel', 100000, 1, 'realisee', now())`,
    ids.session,
    `TEST-SESS-S3-${suffixe}`,
    ids.formation,
  );
  await prisma.trainer.create({
    data: {
      id: ids.trainer,
      nom: "Course",
      prenom: "S3",
      email: `s3-${suffixe}@example.invalid`,
      statut: "sous_traitant",
      regimeTvaHonoraires: "assujetti_20",
    },
  });
  await prisma.trainerCompensationRule.create({
    data: {
      id: ids.regle,
      trainerId: ids.trainer,
      model: "taux_journalier",
      tauxJourneeHtCents: 90_000,
      effectiveFrom: new Date("2030-01-01T00:00:00Z"),
    },
  });
  await prisma.sessionFormateur.create({
    data: { sessionId: ids.session, trainerId: ids.trainer },
  });
});

async function viderLaPeriode(): Promise<void> {
  await prisma.trainerFeeLine.deleteMany({ where: { trainerId: ids.trainer } });
  await prisma.trainerStatement.deleteMany({ where: { trainerId: ids.trainer } });
}

afterAll(async () => {
  await viderLaPeriode();
  await prisma.sessionFormateur.deleteMany({ where: { trainerId: ids.trainer } });
  await prisma.trainerCompensationRule.deleteMany({ where: { trainerId: ids.trainer } });
  await prisma.trainer.deleteMany({ where: { id: ids.trainer } });
  await prisma.$executeRawUnsafe(
    `DELETE FROM "training_sessions" WHERE "id" = $1::uuid`,
    ids.session,
  );
  await prisma.$executeRawUnsafe(`DELETE FROM "formations" WHERE "id" = $1::uuid`, ids.formation);
  await prisma.$executeRawUnsafe(`DELETE FROM "offres_site" WHERE "id" = $1::uuid`, ids.offre);
  await prisma.$disconnect();
});

describe("run mensuel ∥ validation du relevé (Postgres réel)", () => {
  it(`${ITERATIONS} courses : jamais deux lignes pour la même prestation`, async () => {
    const fautes: string[] = [];

    for (let i = 0; i < ITERATIONS; i += 1) {
      await viderLaPeriode();
      await runRemunerationMensuelle(PERIODE);
      const releve = await prisma.trainerStatement.update({
        where: {
          trainerId_periodeYear_periodeMonth: {
            trainerId: ids.trainer,
            periodeYear: PERIODE.year,
            periodeMonth: PERIODE.month,
          },
        },
        data: { statut: "a_valider" },
        select: { id: true },
      });

      const [, validation] = await Promise.all([
        runRemunerationMensuelle(PERIODE),
        transitionStatementAction({ id: releve.id, to: "valide" }),
      ]);
      if ("error" in validation) fautes.push(`#${i} validation refusée : ${validation.error}`);

      const lignes = await prisma.trainerFeeLine.findMany({
        where: { trainerId: ids.trainer, periodeYear: PERIODE.year, periodeMonth: PERIODE.month },
        select: { statementId: true, statut: true, montantHtCents: true },
      });
      const final = await prisma.trainerStatement.findUnique({
        where: { id: releve.id },
        select: { statut: true, totalHtCents: true },
      });
      if (lignes.length !== 1) fautes.push(`#${i} : ${lignes.length} lignes pour 1 prestation`);
      const rattachees = lignes.filter((l) => l.statementId === releve.id);
      const somme = rattachees.reduce((s, l) => s + l.montantHtCents, 0);
      if (final?.statut === "valide" && somme !== final.totalHtCents) {
        fautes.push(`#${i} : relevé validé à ${final.totalHtCents} pour ${somme} de lignes`);
      }
      if (final?.statut === "valide" && rattachees.some((l) => l.statut !== "valide")) {
        fautes.push(`#${i} : relevé validé portant une ligne non gelée`);
      }
    }

    expect(fautes).toEqual([]);
  }, 240_000);
});
