#!/usr/bin/env tsx
/**
 * Point 17 (#2464) — AUDIT EN LECTURE SEULE : commissions Journée IA déjà posées pour un apporteur
 * en grille v2 (contrat 2.6 ou antérieur). N'écrit rien en base. Sortie : identifiant, statut,
 * montant, numéro d'autofacture ; jamais de nom.
 *
 * Usage : pnpm tsx src/features/apporteurs-reseau/audit-journee-ia-v2-cli.ts
 * (emplacement prévu par le plan : scripts/apporteurs/audit-journee-ia-grille-v2.ts, dossier en
 * lecture seule dans la session de cette PR ; un simple `git mv` + ajustement des imports.)
 */
import { PrismaClient } from "../../../prisma/generated/client";
import { auditerJourneeIaGrilleV2, formaterAudit, PALIER_AUDITE } from "./audit-journee-ia-v2";

const prisma = new PrismaClient();

async function main() {
  const lues = await prisma.commissionApporteur.findMany({
    where: { palier: PALIER_AUDITE, parrainage: false },
    select: {
      id: true,
      statut: true,
      montantCents: true,
      autofactureNumero: true,
      palier: true,
      parrainage: true,
      creeAt: true,
      presentation: { select: { recueAt: true } },
      apporteur: { select: { signatureApporteur: true } },
    },
    orderBy: { creeAt: "asc" },
  });
  // eslint-disable-next-line no-console -- sortie du script
  console.log(formaterAudit(auditerJourneeIaGrilleV2(lues)));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
