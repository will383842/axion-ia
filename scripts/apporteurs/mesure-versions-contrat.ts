#!/usr/bin/env tsx
/**
 * Lot G1 (relevé mensuel, Q8) — MESURE EN LECTURE SEULE : apporteurs et commissions par version
 * de contrat signée. N'écrit rien en base. Sortie : des comptes, jamais de donnée personnelle.
 *
 * Usage : pnpm tsx scripts/apporteurs/mesure-versions-contrat.ts [AAAA-MM-JJ]
 * (date de début de fenêtre des commissions ; défaut 2026-11-26, bascule 2.8)
 */
import { PrismaClient } from "../../prisma/generated/client";
import {
  type ClientLecture,
  formaterRapport,
  mesurerDepuisBase,
} from "../../src/features/apporteurs-reseau/mesure-versions/mesure";

const prisma = new PrismaClient();

async function main() {
  const depuis = process.argv[2] ?? "2026-11-26";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(depuis)) throw new Error("Date attendue : AAAA-MM-JJ");
  // Adaptateur de LECTURE : seuls `findMany` et des `select` fixes sont exposés.
  const lecture: ClientLecture = {
    apporteurReseau: {
      findMany: () =>
        prisma.apporteurReseau.findMany({
          where: { statut: { in: ["a_verifier", "signe", "resilie"] } },
          select: { id: true, statut: true, signatureApporteur: true },
        }),
    },
    commissionApporteur: {
      findMany: () =>
        prisma.commissionApporteur.findMany({
          where: { creeAt: { gte: new Date(`${depuis}T00:00:00+01:00`) } },
          select: { apporteurId: true },
        }),
    },
  };
  const mesure = await mesurerDepuisBase(lecture);
  console.log(formaterRapport(mesure, depuis));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
