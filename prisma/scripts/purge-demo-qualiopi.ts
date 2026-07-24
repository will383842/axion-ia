#!/usr/bin/env tsx
/**
 * Qualiopi — Purge des données de démonstration (`pnpm qualiopi:seed-demo`).
 *
 * POURQUOI
 * --------
 * `prisma/seeds/qualiopi/demo.ts` sème un jeu de données complet destiné aux
 * démos et aux captures d'écran : 1 client, 1 devis, 1 formation, 1 session,
 * 2 stagiaires, présences, évaluations, questionnaires, attestation, facture,
 * réclamation, 3 veilles, 1 partenariat, 1 sous-traitant, 1 revue de direction,
 * 4 appréciations, 3 moyens pédagogiques, 1 dépense BPF.
 *
 * Ces lignes se retrouvent dans PRESQUE TOUS les écrans de la console Qualiopi.
 * Une fois la démo passée, elles sont du bruit — et pire, elles faussent les
 * indicateurs de pilotage (taux de satisfaction, de présence, BPF).
 *
 * Ce script les retire. Toutes les entités de démo portent un identifiant
 * stable (`AXI-*-DEMO-*`, `@demo.axion-ia.invalid`) ou le préfixe `[DEMO]`, ce
 * qui rend le ciblage exact : AUCUNE donnée réelle ne peut être touchée.
 *
 * SUPPRESSION (pas archivage) : contrairement au catalogue obsolète, la donnée
 * de démo n'a aucune valeur probante à conserver. Elle est fictive.
 *
 * USAGE
 *   pnpm qualiopi:purge-demo             # simulation — n'écrit RIEN
 *   pnpm qualiopi:purge-demo --apply     # exécute la suppression
 *
 * L'ordre de suppression respecte les clés étrangères (enfants d'abord).
 */

import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Identifiants stables du jeu de démo (miroir de `DEMO` dans demo.ts)
// ─────────────────────────────────────────────────────────────────────────────

const DEMO = {
  CLIENT: "AXI-CLI-DEMO-001",
  DEVIS: "AXI-DEV-2026-DEMO-001",
  FORMATION: "AXI-FOR-DEMO-001",
  SESSION: "AXI-SES-DEMO-001",
  ATTESTATION: "AXI-ATT-DEMO-001",
  FACTURE: "AXI-FAC-2026-DEMO-001",
  RECLAMATION: "AXI-REC-DEMO-001",
  OFFRE_CODE: "AXI-OFF-DEMO-001",
  TRAINER_EMAIL: "formateur.demo@demo.axion-ia.invalid",
  STAGIAIRE_EMAILS: ["marie.martin@demo.axion-ia.invalid", "thomas.dubois@demo.axion-ia.invalid"],
  QUESTIONNAIRE_TOKENS: [
    "DEMO-QST-SAT-001-TOKEN-STABLE-AXION",
    "DEMO-QST-SAT-002-TOKEN-STABLE-AXION",
    "DEMO-QST-POS-001-TOKEN-STABLE-AXION",
    "DEMO-QST-POS-002-TOKEN-STABLE-AXION",
  ],
  /** Clés SiteSetting renseignées avec des valeurs fictives — NON supprimées. */
  SETTINGS_REFERENT_HANDICAP: [
    "referent_handicap_nom",
    "referent_handicap_email",
    "referent_handicap_telephone",
  ],
} as const;

/** Préfixe textuel porté par toutes les entités de démo « libres ». */
const MARQUEUR = "[DEMO]";

// ─────────────────────────────────────────────────────────────────────────────

interface Etape {
  libelle: string;
  compter: () => Promise<number>;
  supprimer: () => Promise<number>;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  // Garde build (ADR 0026) : sous l'URL stub il n'y a aucune DB à purger.
  if (process.env.DATABASE_URL?.includes("stub.invalid")) {
    console.log("[qualiopi:purge-demo] DATABASE_URL stub — rien à faire.");
    return;
  }

  // Résolution des identifiants internes (nécessaires aux suppressions en cascade
  // manuelle : présences, évaluations, inscriptions… n'ont pas de marqueur propre).
  const session = await prisma.trainingSession.findUnique({
    where: { numero: DEMO.SESSION },
    select: { id: true },
  });
  const client = await prisma.client.findUnique({
    where: { numero: DEMO.CLIENT },
    select: { id: true },
  });
  const formation = await prisma.formation.findUnique({
    where: { numero: DEMO.FORMATION },
    select: { id: true },
  });
  const trainees = await prisma.trainee.findMany({
    where: { email: { in: [...DEMO.STAGIAIRE_EMAILS] } },
    select: { id: true },
  });
  const traineeIds = trainees.map((t) => t.id);

  const enrollments = session
    ? await prisma.enrollment.findMany({
        where: { sessionId: session.id },
        select: { id: true },
      })
    : [];
  const enrollmentIds = enrollments.map((e) => e.id);

  // Revue de direction : identifiée par l'année, mais on ne la supprime QUE si
  // son contenu porte le marqueur (une vraie revue 2026 ne doit pas sauter).
  const revue2026 = await prisma.revueDirection.findUnique({
    where: { annee: 2026 },
    select: { id: true, decisions: true, planActions: true },
  });
  const revueEstDemo =
    revue2026 != null &&
    JSON.stringify([revue2026.decisions, revue2026.planActions]).includes(MARQUEUR);

  // ── Étapes, dans l'ordre des dépendances (enfants → parents) ───────────────
  const etapes: Etape[] = [
    {
      libelle: "Créneaux de présence",
      compter: () =>
        enrollmentIds.length === 0
          ? Promise.resolve(0)
          : prisma.presenceCreneau.count({ where: { enrollmentId: { in: enrollmentIds } } }),
      supprimer: async () =>
        enrollmentIds.length === 0
          ? 0
          : (
              await prisma.presenceCreneau.deleteMany({
                where: { enrollmentId: { in: enrollmentIds } },
              })
            ).count,
    },
    {
      libelle: "Évaluations des acquis",
      compter: () =>
        enrollmentIds.length === 0
          ? Promise.resolve(0)
          : prisma.evaluationAcquis.count({ where: { enrollmentId: { in: enrollmentIds } } }),
      supprimer: async () =>
        enrollmentIds.length === 0
          ? 0
          : (
              await prisma.evaluationAcquis.deleteMany({
                where: { enrollmentId: { in: enrollmentIds } },
              })
            ).count,
    },
    {
      libelle: "Questionnaires (positionnement + satisfaction)",
      compter: () =>
        prisma.questionnaire.count({ where: { token: { in: [...DEMO.QUESTIONNAIRE_TOKENS] } } }),
      supprimer: async () =>
        (
          await prisma.questionnaire.deleteMany({
            where: { token: { in: [...DEMO.QUESTIONNAIRE_TOKENS] } },
          })
        ).count,
    },
    {
      libelle: "Documents générés (attestation, convention…)",
      compter: () =>
        prisma.documentGenere.count({
          where: documentsDemoWhere(session?.id, client?.id, formation?.id),
        }),
      supprimer: async () =>
        (
          await prisma.documentGenere.deleteMany({
            where: documentsDemoWhere(session?.id, client?.id, formation?.id),
          })
        ).count,
    },
    {
      libelle: "Factures de formation",
      compter: () => prisma.factureFormation.count({ where: { numero: DEMO.FACTURE } }),
      supprimer: async () =>
        (await prisma.factureFormation.deleteMany({ where: { numero: DEMO.FACTURE } })).count,
    },
    {
      libelle: "Appréciations (stagiaire, entreprise, financeur, formateur)",
      compter: () =>
        client == null
          ? Promise.resolve(0)
          : prisma.appreciation.count({ where: { clientId: client.id } }),
      supprimer: async () =>
        client == null
          ? 0
          : (await prisma.appreciation.deleteMany({ where: { clientId: client.id } })).count,
    },
    {
      libelle: "Inscriptions",
      compter: () => Promise.resolve(enrollmentIds.length),
      supprimer: async () =>
        enrollmentIds.length === 0
          ? 0
          : (await prisma.enrollment.deleteMany({ where: { id: { in: enrollmentIds } } })).count,
    },
    {
      libelle: "Stagiaires",
      compter: () => Promise.resolve(traineeIds.length),
      supprimer: async () =>
        traineeIds.length === 0
          ? 0
          : (await prisma.trainee.deleteMany({ where: { id: { in: traineeIds } } })).count,
    },
    {
      libelle: "Session de formation",
      compter: () => prisma.trainingSession.count({ where: { numero: DEMO.SESSION } }),
      supprimer: async () =>
        (await prisma.trainingSession.deleteMany({ where: { numero: DEMO.SESSION } })).count,
    },
    {
      libelle: "Devis",
      compter: () => prisma.devis.count({ where: { numero: DEMO.DEVIS } }),
      supprimer: async () =>
        (await prisma.devis.deleteMany({ where: { numero: DEMO.DEVIS } })).count,
    },
    {
      libelle: "Formation",
      compter: () => prisma.formation.count({ where: { numero: DEMO.FORMATION } }),
      supprimer: async () =>
        (await prisma.formation.deleteMany({ where: { numero: DEMO.FORMATION } })).count,
    },
    {
      libelle: "Réclamation",
      compter: () => prisma.reclamation.count({ where: { numero: DEMO.RECLAMATION } }),
      supprimer: async () =>
        (await prisma.reclamation.deleteMany({ where: { numero: DEMO.RECLAMATION } })).count,
    },
    {
      libelle: "Client",
      compter: () => prisma.client.count({ where: { numero: DEMO.CLIENT } }),
      supprimer: async () =>
        (await prisma.client.deleteMany({ where: { numero: DEMO.CLIENT } })).count,
    },
    {
      libelle: "Formateur de démonstration",
      compter: () => prisma.trainer.count({ where: { email: DEMO.TRAINER_EMAIL } }),
      supprimer: async () =>
        (await prisma.trainer.deleteMany({ where: { email: DEMO.TRAINER_EMAIL } })).count,
    },
    {
      libelle: "Veilles réglementaires",
      compter: () => prisma.veille.count({ where: { titre: { startsWith: MARQUEUR } } }),
      supprimer: async () =>
        (await prisma.veille.deleteMany({ where: { titre: { startsWith: MARQUEUR } } })).count,
    },
    {
      libelle: "Partenariats",
      compter: () => prisma.partenariat.count({ where: { nom: { startsWith: MARQUEUR } } }),
      supprimer: async () =>
        (await prisma.partenariat.deleteMany({ where: { nom: { startsWith: MARQUEUR } } })).count,
    },
    {
      libelle: "Sous-traitants",
      compter: () => prisma.sousTraitant.count({ where: { nom: { startsWith: MARQUEUR } } }),
      supprimer: async () =>
        (await prisma.sousTraitant.deleteMany({ where: { nom: { startsWith: MARQUEUR } } })).count,
    },
    {
      libelle: "Revue de direction 2026 (fictive)",
      compter: () => Promise.resolve(revueEstDemo ? 1 : 0),
      supprimer: async () =>
        revueEstDemo
          ? (await prisma.revueDirection.deleteMany({ where: { annee: 2026 } })).count
          : 0,
    },
    {
      libelle: "Moyens pédagogiques",
      compter: () =>
        prisma.moyenPedagogique.count({ where: { libelle: { startsWith: MARQUEUR } } }),
      supprimer: async () =>
        (await prisma.moyenPedagogique.deleteMany({ where: { libelle: { startsWith: MARQUEUR } } }))
          .count,
    },
    {
      libelle: "Dépenses BPF",
      compter: () => prisma.bpfDepense.count({ where: { libelle: { startsWith: MARQUEUR } } }),
      supprimer: async () =>
        (await prisma.bpfDepense.deleteMany({ where: { libelle: { startsWith: MARQUEUR } } }))
          .count,
    },
    {
      libelle: "Offre de démonstration",
      compter: () => prisma.offreSite.count({ where: { code: DEMO.OFFRE_CODE } }),
      supprimer: async () =>
        (await prisma.offreSite.deleteMany({ where: { code: DEMO.OFFRE_CODE } })).count,
    },
  ];

  console.log(
    apply
      ? "\n🧹 [qualiopi:purge-demo] SUPPRESSION des données de démonstration\n"
      : "\n🔍 [qualiopi:purge-demo] SIMULATION — aucune écriture (ajouter --apply pour exécuter)\n",
  );

  let total = 0;
  for (const etape of etapes) {
    const n = apply ? await etape.supprimer() : await etape.compter();
    total += n;
    const icone = n === 0 ? "·" : apply ? "✓" : "→";
    console.log(`  ${icone} ${String(n).padStart(4)}  ${etape.libelle}`);
  }

  console.log(`\n${apply ? "✅ Supprimé" : "📋 À supprimer"} : ${total} ligne(s) au total.\n`);

  // ── Avertissement : réglages Qualiopi encore fictifs ───────────────────────
  const settingsDemo = await prisma.siteSetting.findMany({
    where: { key: { in: [...DEMO.SETTINGS_REFERENT_HANDICAP] } },
    select: { key: true, value: true },
  });
  const fictifs = settingsDemo.filter(
    (s) =>
      JSON.stringify(s.value).includes(MARQUEUR) ||
      JSON.stringify(s.value).includes("demo.axion-ia.invalid"),
  );
  if (fictifs.length > 0) {
    console.log("⚠️  RÉFÉRENT HANDICAP encore renseigné avec des valeurs FICTIVES :");
    for (const s of fictifs) console.log(`      ${s.key} = ${JSON.stringify(s.value)}`);
    console.log(
      "    NON supprimé par ce script : les vider ferait remonter l'alerte critique\n" +
        "    « referent_handicap_absent ». À REMPLACER par les vraies coordonnées dans\n" +
        "    la console (Qualiopi → Configuration) — indicateur off.26.\n",
    );
  }

  if (!apply && total > 0) {
    console.log("Pour exécuter réellement :  pnpm qualiopi:purge-demo --apply\n");
  }
}

/**
 * Documents de démo : ceux rattachés à la session/client/formation de démo, plus
 * l'attestation identifiée par son numéro (au cas où ses FK auraient été
 * dissociées par un `onDelete: SetNull` antérieur).
 */
function documentsDemoWhere(
  sessionId: string | undefined,
  clientId: string | undefined,
  formationId: string | undefined,
): Record<string, unknown> {
  const or: Record<string, unknown>[] = [{ numero: DEMO.ATTESTATION }];
  if (sessionId) or.push({ sessionId });
  if (clientId) or.push({ clientId });
  if (formationId) or.push({ formationId });
  return { OR: or };
}

main()
  .catch((err) => {
    console.error("[qualiopi:purge-demo] ÉCHEC :", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
