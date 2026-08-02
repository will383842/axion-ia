#!/usr/bin/env tsx
/**
 * Qualiopi — Purge des données de TEST saisies dans la vraie numérotation.
 *
 * POURQUOI CE SCRIPT EXISTE EN PLUS DE `purge-demo-qualiopi.ts`
 * -------------------------------------------------------------
 * `qualiopi:purge-demo` ne cible que les identifiants `AXI-*-DEMO-*` semés par
 * `prisma/seeds/qualiopi/demo.ts`. Or les essais faits À LA MAIN dans la console
 * (juillet 2026) ont consommé la VRAIE séquence : `AXI-SESS-2026-001`,
 * `AXI-CLI-001`, `AXI-DEV-2026-001`… Aucun marqueur ne les distingue, donc aucun
 * outil ne pouvait les retirer.
 *
 * Conséquences constatées le 2026-08-02, avant purge :
 *   - 5 alertes système actives sur 5 portaient sur ces essais ;
 *   - le taux de satisfaction et le BPF intégraient une session fictive à
 *     1 200 € ;
 *   - la page « À traiter » réclamait des signatures sur des pièces d'essai.
 *
 * DÉCISION DE WILL (2026-08-02) : « il ne doit plus rester qu'une session, celle
 * d'INVEST SUN ; toutes les autres sont à supprimer ainsi que toutes les données
 * y afférentes ». Confirmée après que le risque a été signalé — la session
 * `AXI-SESS-2026-001` porte une VRAIE personne (Simone Blanc).
 *
 * CE QUI EST CONSERVÉ, ET POURQUOI
 * --------------------------------
 *   - `AXI-SESS-2026-003` (INVEST SUN) et TOUT ce qui s'y rattache ;
 *   - `AXI-CLI-003` INVEST SUN ;
 *   - `AXI-DEV-2026-003`, devis INVEST SUN de 3 500 € — brouillon, non demandé
 *     explicitement, mais « tout sauf INVEST SUN » le protège ;
 *   - la stagiaire **Simone Blanc** : elle est inscrite à la session conservée.
 *     Seule son inscription à la session d'essai disparaît ;
 *   - les FORMATIONS et les FORMATEURS : ce sont le catalogue et les
 *     intervenants réels, pas des données d'essai. Les supprimer serait une
 *     faute — les sessions d'essai pointaient sur de vraies formations ;
 *   - tout autre client du CRM. La suppression est pilotée par une liste
 *     NOMMÉE, jamais par « client sans session » : un prospect n'a pas de
 *     session, et l'heuristique aurait vidé la prospection.
 *
 * SUPPRESSION (pas archivage) : ces enregistrements n'ont aucune valeur
 * probante — ils décrivent des formations qui n'ont pas eu lieu.
 *
 * USAGE
 *   pnpm tsx prisma/scripts/purge-donnees-test-qualiopi.ts            # simulation
 *   pnpm tsx prisma/scripts/purge-donnees-test-qualiopi.ts --apply    # exécute
 *
 * L'ordre respecte les clés étrangères. Les relations `Restrict`
 * (FactureFormation, EmargementContresignature, DocumentSignature,
 * DocumentSignatureToken, EmargementSignature, EmargementToken) DOIVENT être
 * purgées avant leur parent, sinon Postgres refuse la suppression.
 */

import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Périmètre — listes NOMMÉES, jamais d'heuristique
// ─────────────────────────────────────────────────────────────────────────────

/** LA session conservée. Tout le reste des sessions part. */
const SESSION_CONSERVEE = "AXI-SESS-2026-003";

/** Clients d'essai (e-mails de test, SIRET 00000000000000). */
const CLIENTS_A_SUPPRIMER = ["AXI-CLI-001", "AXI-CLI-002"];

/** Devis d'essai. `AXI-DEV-2026-003` (INVEST SUN) est CONSERVÉ. */
const DEVIS_A_SUPPRIMER = ["AXI-DEV-2026-001", "AXI-DEV-2026-002", "AXI-DEV-2026-004"];

/** Stagiaires d'essai. Simone Blanc n'y figure PAS : elle est réelle. */
const STAGIAIRES_A_SUPPRIMER = ["williamsjullin+audit-stagiaire1@gmail.com"];

// ─────────────────────────────────────────────────────────────────────────────

interface Etape {
  libelle: string;
  compter: () => Promise<number>;
  supprimer: () => Promise<number>;
}

const vide = (ids: string[]) => ids.length === 0;

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  // Garde build (ADR 0026) : sous l'URL stub il n'y a aucune DB à purger.
  if (process.env.DATABASE_URL?.includes("stub.invalid")) {
    console.log("[purge-test] DATABASE_URL stub — rien à faire.");
    return;
  }

  // ── Garde-fou 1 : la session à conserver DOIT exister ─────────────────────
  // Sans elle, « toutes les sessions sauf celle-ci » vaut « toutes les
  // sessions ». On refuse d'exécuter plutôt que de tout détruire.
  const conservee = await prisma.trainingSession.findUnique({
    where: { numero: SESSION_CONSERVEE },
    select: { id: true, numero: true, titreSession: true },
  });
  if (conservee === null) {
    console.error(
      `\n❌ ARRÊT — la session à conserver (${SESSION_CONSERVEE}) est introuvable.\n` +
        `   Sans elle, ce script supprimerait TOUTES les sessions. Rien n'a été touché.\n`,
    );
    process.exitCode = 1;
    return;
  }

  const sessionsASupprimer = await prisma.trainingSession.findMany({
    where: { numero: { not: SESSION_CONSERVEE } },
    select: { id: true, numero: true, titreSession: true },
  });
  const sessionIds = sessionsASupprimer.map((s) => s.id);

  // ── Garde-fou 2 : la session conservée n'est JAMAIS dans le lot ───────────
  if (sessionIds.includes(conservee.id)) {
    console.error("\n❌ ARRÊT — incohérence : la session conservée figure dans le lot.\n");
    process.exitCode = 1;
    return;
  }

  const enrollments = vide(sessionIds)
    ? []
    : await prisma.enrollment.findMany({
        where: { sessionId: { in: sessionIds } },
        select: { id: true },
      });
  const enrollmentIds = enrollments.map((e) => e.id);

  const clients = await prisma.client.findMany({
    where: { numero: { in: CLIENTS_A_SUPPRIMER } },
    select: { id: true, numero: true, raisonSociale: true },
  });
  const clientIds = clients.map((c) => c.id);

  const devis = await prisma.devis.findMany({
    where: { numero: { in: DEVIS_A_SUPPRIMER } },
    select: { id: true, numero: true },
  });
  const devisIds = devis.map((d) => d.id);

  const stagiaires = await prisma.trainee.findMany({
    where: { email: { in: STAGIAIRES_A_SUPPRIMER } },
    select: { id: true, nom: true, prenom: true },
  });
  const traineeIds = stagiaires.map((t) => t.id);

  // Documents rattachés au lot : par session, par client d'essai, par stagiaire
  // d'essai. Un document de la session conservée ne peut pas y entrer.
  const documents = await prisma.documentGenere.findMany({
    where: {
      OR: [
        ...(vide(sessionIds) ? [] : [{ sessionId: { in: sessionIds } }]),
        ...(vide(clientIds) ? [] : [{ clientId: { in: clientIds } }]),
        ...(vide(traineeIds) ? [] : [{ traineeId: { in: traineeIds } }]),
      ],
    },
    select: { id: true, numero: true, type: true },
  });
  const documentIds = documents.map((d) => d.id);

  // ── Récapitulatif de ce qui est visé ──────────────────────────────────────
  console.log(
    apply
      ? "\n🧹 [purge-test] SUPPRESSION des données de test\n"
      : "\n🔍 [purge-test] SIMULATION — aucune écriture (ajouter --apply pour exécuter)\n",
  );
  console.log(`  CONSERVÉ : ${conservee.numero} — ${conservee.titreSession}`);
  console.log(`  CONSERVÉ : stagiaire Simone Blanc, client AXI-CLI-003, devis AXI-DEV-2026-003`);
  console.log(`  CONSERVÉ : toutes les formations et tous les formateurs\n`);
  console.log("  Sessions visées :");
  for (const s of sessionsASupprimer) console.log(`     – ${s.numero} — ${s.titreSession}`);
  console.log("  Clients visés :");
  for (const c of clients) console.log(`     – ${c.numero} — ${c.raisonSociale}`);
  console.log("  Devis visés :");
  for (const d of devis) console.log(`     – ${d.numero}`);
  console.log("  Stagiaires visés :");
  for (const t of stagiaires) console.log(`     – ${t.prenom} ${t.nom}`);
  console.log("");

  // ── Étapes, enfants → parents ─────────────────────────────────────────────
  const etapes: Etape[] = [
    {
      libelle: "Jetons de signature de document (Restrict)",
      compter: () =>
        vide(documentIds)
          ? Promise.resolve(0)
          : prisma.documentSignatureToken.count({
              where: { documentGenereId: { in: documentIds } },
            }),
      supprimer: async () =>
        vide(documentIds)
          ? 0
          : (
              await prisma.documentSignatureToken.deleteMany({
                where: { documentGenereId: { in: documentIds } },
              })
            ).count,
    },
    {
      libelle: "Signatures de document (Restrict)",
      compter: () =>
        vide(documentIds)
          ? Promise.resolve(0)
          : prisma.documentSignature.count({ where: { documentGenereId: { in: documentIds } } }),
      supprimer: async () =>
        vide(documentIds)
          ? 0
          : (
              await prisma.documentSignature.deleteMany({
                where: { documentGenereId: { in: documentIds } },
              })
            ).count,
    },
    {
      libelle: "Signatures d'émargement (Restrict)",
      compter: () =>
        vide(enrollmentIds)
          ? Promise.resolve(0)
          : prisma.emargementSignature.count({ where: { enrollmentId: { in: enrollmentIds } } }),
      supprimer: async () =>
        vide(enrollmentIds)
          ? 0
          : (
              await prisma.emargementSignature.deleteMany({
                where: { enrollmentId: { in: enrollmentIds } },
              })
            ).count,
    },
    {
      libelle: "Jetons d'émargement (Restrict)",
      compter: () =>
        vide(enrollmentIds)
          ? Promise.resolve(0)
          : prisma.emargementToken.count({ where: { enrollmentId: { in: enrollmentIds } } }),
      supprimer: async () =>
        vide(enrollmentIds)
          ? 0
          : (
              await prisma.emargementToken.deleteMany({
                where: { enrollmentId: { in: enrollmentIds } },
              })
            ).count,
    },
    {
      libelle: "Contresignatures formateur (Restrict)",
      compter: () =>
        vide(sessionIds)
          ? Promise.resolve(0)
          : prisma.emargementContresignature.count({ where: { sessionId: { in: sessionIds } } }),
      supprimer: async () =>
        vide(sessionIds)
          ? 0
          : (
              await prisma.emargementContresignature.deleteMany({
                where: { sessionId: { in: sessionIds } },
              })
            ).count,
    },
    {
      libelle: "Factures de formation (Restrict)",
      compter: () =>
        vide(sessionIds) && vide(clientIds)
          ? Promise.resolve(0)
          : prisma.factureFormation.count({
              where: {
                OR: [
                  ...(vide(sessionIds) ? [] : [{ sessionId: { in: sessionIds } }]),
                  ...(vide(clientIds) ? [] : [{ clientId: { in: clientIds } }]),
                ],
              },
            }),
      supprimer: async () =>
        vide(sessionIds) && vide(clientIds)
          ? 0
          : (
              await prisma.factureFormation.deleteMany({
                where: {
                  OR: [
                    ...(vide(sessionIds) ? [] : [{ sessionId: { in: sessionIds } }]),
                    ...(vide(clientIds) ? [] : [{ clientId: { in: clientIds } }]),
                  ],
                },
              })
            ).count,
    },
    {
      libelle: "Appréciations",
      compter: () =>
        vide(enrollmentIds) && vide(clientIds) && vide(traineeIds)
          ? Promise.resolve(0)
          : prisma.appreciation.count({
              where: {
                OR: [
                  ...(vide(enrollmentIds) ? [] : [{ enrollmentId: { in: enrollmentIds } }]),
                  ...(vide(clientIds) ? [] : [{ clientId: { in: clientIds } }]),
                  ...(vide(traineeIds) ? [] : [{ traineeId: { in: traineeIds } }]),
                ],
              },
            }),
      supprimer: async () =>
        vide(enrollmentIds) && vide(clientIds) && vide(traineeIds)
          ? 0
          : (
              await prisma.appreciation.deleteMany({
                where: {
                  OR: [
                    ...(vide(enrollmentIds) ? [] : [{ enrollmentId: { in: enrollmentIds } }]),
                    ...(vide(clientIds) ? [] : [{ clientId: { in: clientIds } }]),
                    ...(vide(traineeIds) ? [] : [{ traineeId: { in: traineeIds } }]),
                  ],
                },
              })
            ).count,
    },
    {
      libelle: "Réclamations",
      compter: () =>
        vide(enrollmentIds)
          ? Promise.resolve(0)
          : prisma.reclamation.count({ where: { enrollmentId: { in: enrollmentIds } } }),
      supprimer: async () =>
        vide(enrollmentIds)
          ? 0
          : (
              await prisma.reclamation.deleteMany({
                where: { enrollmentId: { in: enrollmentIds } },
              })
            ).count,
    },
    {
      libelle: "Documents générés (conventions, factures, émargements…)",
      compter: () => Promise.resolve(documentIds.length),
      supprimer: async () =>
        vide(documentIds)
          ? 0
          : (await prisma.documentGenere.deleteMany({ where: { id: { in: documentIds } } })).count,
    },
    {
      libelle: "Incidents",
      compter: () =>
        vide(sessionIds)
          ? Promise.resolve(0)
          : prisma.incident.count({ where: { sessionId: { in: sessionIds } } }),
      supprimer: async () =>
        vide(sessionIds)
          ? 0
          : (await prisma.incident.deleteMany({ where: { sessionId: { in: sessionIds } } })).count,
    },
    {
      libelle: "Dossiers de financement",
      compter: () =>
        vide(sessionIds)
          ? Promise.resolve(0)
          : prisma.dossierFinancement.count({ where: { trainingSessionId: { in: sessionIds } } }),
      supprimer: async () =>
        vide(sessionIds)
          ? 0
          : (
              await prisma.dossierFinancement.deleteMany({
                where: { trainingSessionId: { in: sessionIds } },
              })
            ).count,
    },
    {
      libelle: "Lignes de rémunération formateur",
      compter: () =>
        vide(sessionIds)
          ? Promise.resolve(0)
          : prisma.trainerFeeLine.count({ where: { sessionId: { in: sessionIds } } }),
      supprimer: async () =>
        vide(sessionIds)
          ? 0
          : (await prisma.trainerFeeLine.deleteMany({ where: { sessionId: { in: sessionIds } } }))
              .count,
    },
    {
      libelle: "Inscriptions (cascade : présences, évaluations, questionnaires)",
      compter: () => Promise.resolve(enrollmentIds.length),
      supprimer: async () =>
        vide(enrollmentIds)
          ? 0
          : (await prisma.enrollment.deleteMany({ where: { id: { in: enrollmentIds } } })).count,
    },
    {
      libelle: "Sessions (cascade : journées, créneaux, transitions, relevés)",
      compter: () => Promise.resolve(sessionIds.length),
      supprimer: async () =>
        vide(sessionIds)
          ? 0
          : (await prisma.trainingSession.deleteMany({ where: { id: { in: sessionIds } } })).count,
    },
    {
      libelle: "Devis d'essai",
      compter: () => Promise.resolve(devisIds.length),
      supprimer: async () =>
        vide(devisIds)
          ? 0
          : (await prisma.devis.deleteMany({ where: { id: { in: devisIds } } })).count,
    },
    {
      libelle: "Stagiaires d'essai (cascade : accès portail, demandes RGPD)",
      compter: () => Promise.resolve(traineeIds.length),
      supprimer: async () =>
        vide(traineeIds)
          ? 0
          : (await prisma.trainee.deleteMany({ where: { id: { in: traineeIds } } })).count,
    },
    {
      libelle: "Clients d'essai",
      compter: () => Promise.resolve(clientIds.length),
      supprimer: async () =>
        vide(clientIds)
          ? 0
          : (await prisma.client.deleteMany({ where: { id: { in: clientIds } } })).count,
    },
    {
      // Les alertes pointent leur cible par `cibleId`. Sans ce nettoyage, elles
      // survivraient à leur objet et resteraient affichées « À traiter » en
      // désignant une session qui n'existe plus.
      libelle: "Alertes système visant les objets supprimés",
      compter: () => {
        const cibles = [...sessionIds, ...clientIds, ...devisIds, ...traineeIds];
        return vide(cibles)
          ? Promise.resolve(0)
          : prisma.alerteSysteme.count({ where: { cibleId: { in: cibles } } });
      },
      supprimer: async () => {
        const cibles = [...sessionIds, ...clientIds, ...devisIds, ...traineeIds];
        return vide(cibles)
          ? 0
          : (await prisma.alerteSysteme.deleteMany({ where: { cibleId: { in: cibles } } })).count;
      },
    },
  ];

  let total = 0;
  for (const etape of etapes) {
    const n = apply ? await etape.supprimer() : await etape.compter();
    total += n;
    const icone = n === 0 ? "·" : apply ? "✓" : "→";
    console.log(`  ${icone} ${String(n).padStart(4)}  ${etape.libelle}`);
  }

  console.log(`\n${apply ? "✅ Supprimé" : "📋 À supprimer"} : ${total} ligne(s) au total.\n`);

  if (apply) {
    // Vérification post-purge : il ne doit rester QUE la session conservée.
    const restantes = await prisma.trainingSession.findMany({
      select: { numero: true, titreSession: true },
    });
    console.log("  Sessions restantes :");
    for (const s of restantes) console.log(`     ✓ ${s.numero} — ${s.titreSession}`);
    console.log(
      "\n  ⚠️  Les indicateurs Qualiopi et le BPF sont mis en cache : passer par\n" +
        "      « Synchroniser » sur la page Alertes pour recalculer.\n",
    );
  } else if (total > 0) {
    console.log("Pour exécuter réellement :  ajouter --apply\n");
  }
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
