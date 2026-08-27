// Worker BullMQ — Qualiopi production documentaire AU JALON (S5, 2026-08-26).
//
// Queue `documents-auto`, cadence HORAIRE (`15 * * * *` — décalé de l'heure
// pile pour ne pas percuter `convocation-j5`). Patron miroir de
// `qualiopi-formation-crons-worker.ts` : handler idempotent, fail-soft par
// pièce, stub-aware (ADR 0026).
//
// Décision de Will (2026-08-26) : « que le système génère ET envoie en
// fonction du type de client, automatiquement ». La DÉCISION (quoi produire,
// pour qui, quand) vit dans le module PUR
// `qualiopi/documents/production-au-jalon.ts`, gardé par les specs G1-G5 —
// écrites et vues rougir AVANT ce worker. La CONSTRUCTION des pièces vit dans
// `qualiopi/documents/production/producteurs.ts`, partagée avec les Server
// Actions de la console (jamais de jumeau).
//
// ⚠️ PILOTÉ PAR L'ÉTAT, jamais par une fenêtre de date — leçon M2 payée deux
// fois (convocation-j5, liens-emargement-j0) : la sélection porte sur le
// statut des sessions et l'ABSENCE de pièce, donc un passage manqué se
// rattrape au suivant.
//
// ## Idempotence — qui garantit quoi
//
//   1. Le module pur DÉDUPLIQUE contre les pièces vivantes non-copies lues
//      dans l'instantané (G3) ;
//   2. juste avant chaque création, le worker RE-VÉRIFIE l'existence en base
//      (lecture fraîche) : la table `documents_generes` sert de verrou par
//      pièce. `concurrency: 1` + worker SEUL producteur automatique = aucune
//      course interne possible ; une course avec un clic admin simultané est
//      fermée par cette relecture à quelques millisecondes près ;
//   3. le verrou DUR — un index unique partiel `(type, session_id, trainee_id)
//      WHERE annulee_at IS NULL AND est_copie = false` — relève d'une
//      migration Prisma, hors du périmètre de ce lot (schéma gelé). Tant qu'il
//      n'existe pas, le pire cas d'une course perdue est une pièce marquée
//      « COPIE » par `estUneRegenerationDe`, pas un second original.

import { Worker } from "bullmq";
import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import {
  bilanProductionsAuJalon,
  type InstantaneProduction,
  type ProductionAFaire,
  type Financement,
  type TypeClient,
} from "@/server/qualiopi/documents/production-au-jalon";
import type { ResultatProduction } from "@/server/qualiopi/documents/production/producteurs";
import {
  produireConvention,
  produireConventionTripartite,
  produireContratFormation,
  produireConvocation,
  produireEmargement,
  produirePositionnement,
  produireGrilleEvaluation,
  produireSatisfaction,
  produireReglementInterieur,
  produireProgramme,
  produireOrganisationAction,
  produireLivretAccueil,
} from "@/server/qualiopi/documents/production/producteurs";

// ─────────────────────────────────────────────────────────────────────────────
// Types job
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentsAutoJobType = "documents-auto.production";

export interface DocumentsAutoJobData {
  type: DocumentsAutoJobType;
  tick: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Producteurs par type — la table de dispatch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un producteur reçoit la production décidée par le module pur et rend le
 * résultat de la couche service. La clé d'entrée (sessionId ou enrollmentId)
 * dépend du GRAIN de la pièce — le module pur fournit les deux.
 */
type Producteur = (
  production: ProductionAFaire,
  sessionId: string,
  metadata: Record<string, unknown>,
) => Promise<ResultatProduction>;

const PRODUCTEURS: Partial<Record<string, Producteur>> = {
  // Pièces de SESSION.
  programme: (_p, sessionId, metadata) => produireProgramme(sessionId, { metadata }),
  reglement_interieur: (_p, sessionId, metadata) =>
    produireReglementInterieur(sessionId, { metadata }),
  livret_accueil: (_p, sessionId, metadata) => produireLivretAccueil(sessionId, { metadata }),
  organisation_action: (_p, sessionId, metadata) =>
    produireOrganisationAction(sessionId, { metadata }),
  positionnement: (_p, sessionId, metadata) => produirePositionnement(sessionId, { metadata }),
  satisfaction: (_p, sessionId, metadata) => produireSatisfaction(sessionId, { metadata }),
  emargement: (_p, sessionId, metadata) => produireEmargement(sessionId, { metadata }),
  convention: (_p, sessionId, metadata) => produireConvention(sessionId, { metadata }),
  convention_tripartite: (_p, sessionId, metadata) =>
    produireConventionTripartite(sessionId, { metadata }),

  // Pièces PAR STAGIAIRE — le module pur garantit `enrollmentId` non nul (G4).
  convocation: (p, _sessionId, metadata) => produireConvocation(p.enrollmentId!, { metadata }),
  contrat: (p, _sessionId, metadata) => produireContratFormation(p.enrollmentId!, { metadata }),
  grille_evaluation: (p, _sessionId, metadata) =>
    produireGrilleEvaluation(p.enrollmentId!, { metadata }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Passage horaire : charge les sessions actives, décide via le module pur,
 * produit via la couche service. Fail-soft par pièce ET par session.
 */
async function handleProductionAuJalon(): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.log("[documents-auto] production: stub DB, skip");
    return;
  }

  const now = new Date();
  // Une session `realisee` reste candidate 90 jours : au-delà, ses pièces
  // d'après-réalisation manquantes relèvent d'un écart à consigner, pas d'une
  // production tardive — même borne que satisfaction-j1 / suivi-j30.
  const plafondRealisee = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const sessions = await prisma.trainingSession.findMany({
    where: {
      OR: [
        { statut: { in: ["planifiee", "en_cours"] } },
        { statut: "realisee", dateFin: { gte: plafondRealisee } },
      ],
    },
    select: {
      id: true,
      numero: true,
      statut: true,
      dateDebut: true,
      dateFin: true,
      financementType: true,
      client: { select: { type: true } },
      enrollments: {
        where: { ...inscriptionsActives() },
        select: {
          id: true,
          traineeId: true,
          financementType: true,
          client: { select: { type: true } },
        },
      },
      // L'instantané des pièces : le module pur déduplique dessus (G3).
      documents: {
        where: { annuleeAt: null, estCopie: false },
        select: { type: true, traineeId: true },
      },
    },
    // Garde-fou de volume : le passage est HORAIRE, le reliquat passe au
    // suivant — préférable à un passage qui rend des heures de PDF d'un coup.
    take: 100,
  });

  let produites = 0;
  let enEchec = 0;
  let ecarteesParPertinence = 0;
  let ecarteesParJalon = 0;
  let dejaPresentes = 0;
  let sansPorteur = 0;
  let sansProducteur = 0;

  for (const session of sessions) {
    try {
      const instantane: InstantaneProduction = {
        session: {
          id: session.id,
          statut: session.statut,
          dateDebut: session.dateDebut,
          dateFin: session.dateFin,
          financementType: (session.financementType as Financement | null) ?? null,
          clientType: (session.client?.type as TypeClient | undefined) ?? null,
        },
        enrollments: session.enrollments.map((e) => ({
          id: e.id,
          traineeId: e.traineeId,
          // Overrides R-INTER : le financement / payeur de CE participant.
          financementType: (e.financementType as Financement | null) ?? null,
          clientType: (e.client?.type as TypeClient | undefined) ?? null,
        })),
        piecesExistantes: session.documents.map((d) => ({
          type: d.type,
          traineeId: d.traineeId,
          annuleeAt: null,
          estCopie: false,
        })),
      };

      const bilan = bilanProductionsAuJalon(instantane, now);
      ecarteesParPertinence += bilan.ecarteesParPertinence;
      ecarteesParJalon += bilan.ecarteesParJalon;
      dejaPresentes += bilan.dejaPresentes;
      sansPorteur += bilan.sansPorteur;

      for (const production of bilan.productions) {
        const producteur = PRODUCTEURS[production.type];
        if (!producteur) {
          // Ne devrait jamais arriver : le module pur écarte déjà les types
          // hors lot. Compté et dit, jamais tu — un type ajouté au jalon sans
          // producteur se verrait ici dès le premier passage.
          sansProducteur++;
          console.error(
            `[documents-auto] production: type ${production.type} décidé par le module ` +
              `mais SANS producteur — table PRODUCTEURS à compléter`,
          );
          continue;
        }

        try {
          // 🔴 RE-VÉRIFICATION FRAÎCHE juste avant le create — la table
          // `documents_generes` comme verrou par pièce. L'instantané date du
          // début du passage ; un clic admin a pu produire la même pièce
          // entre-temps. Relire à quelques millisecondes du create ferme la
          // fenêtre autant qu'elle peut l'être sans index unique en base.
          const deja = await prisma.documentGenere.findFirst({
            where: {
              type: production.type,
              sessionId: session.id,
              traineeId: production.traineeId,
              annuleeAt: null,
              estCopie: false,
            },
            select: { id: true },
          });
          if (deja !== null) {
            dejaPresentes++;
            continue;
          }

          const resultat = await producteur(production, session.id, {
            // La pièce dit dans quelles conditions elle est née : le registre
            // distingue un clic admin d'un automatisme, et le jalon retenu.
            genereParWorker: true,
            jalon: production.jalon,
          });

          if (resultat.ok) {
            produites++;
          } else {
            // Fail-soft par pièce : une session sans journée déclarée (feuille
            // d'émargement refusée), sans client (convention refusée)… le
            // motif est journalisé, le passage suivant retentera.
            enEchec++;
            console.error(
              `[documents-auto] production: ${production.type} refusée sur ${session.numero} — ${resultat.motif}`,
            );
          }
        } catch (err) {
          enEchec++;
          console.error(
            `[documents-auto] production: erreur ${production.type} sur ${session.numero}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    } catch (err) {
      console.error(
        `[documents-auto] production: erreur session ${session.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[documents-auto] production: ${produites} pièce(s) produite(s), ${enEchec} en échec, ` +
      `${dejaPresentes} déjà présente(s), ${ecarteesParPertinence} écartée(s) par pertinence, ` +
      `${ecarteesParJalon} écartée(s) par jalon, ${sansPorteur} sans porteur, ` +
      `${sansProducteur} sans producteur (${sessions.length} session(s) scannée(s))`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher + worker
// ─────────────────────────────────────────────────────────────────────────────

const HANDLERS: Record<DocumentsAutoJobType, () => Promise<void>> = {
  "documents-auto.production": handleProductionAuJalon,
};

/** Logique de dispatch pure (exportée pour les tests). */
export async function documentsAutoHandler(data: DocumentsAutoJobData): Promise<void> {
  const handler = HANDLERS[data.type];
  if (!handler) {
    console.warn(`[documents-auto-worker] unknown job type: ${data.type}`);
    return;
  }
  await handler();
}

export function startQualiopiDocumentsWorker(): Worker<DocumentsAutoJobData> {
  const worker = new Worker<DocumentsAutoJobData>(
    "documents-auto",
    async (job) => {
      await documentsAutoHandler(job.data);
    },
    {
      connection: getBullConnectionOrThrow(),
      // ⚠️ 1 et pas plus : c'est une pièce du contrat d'idempotence (cf.
      // l'en-tête). Deux passages concurrents produiraient chacun leur
      // exemplaire avant que l'autre n'ait écrit le sien.
      concurrency: 1,
      // Le rendu PDF de plusieurs pièces peut dépasser les 2 min par défaut :
      // un verrou trop court ferait rejouer le job PENDANT qu'il tourne.
      lockDuration: 600_000,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  worker.on("ready", () => console.log("[documents-auto-worker] ready"));
  worker.on("failed", (job, err) => {
    console.error(`[documents-auto-worker] failed type=${job?.data?.type ?? "?"}: ${err.message}`);
    captureWorkerError("documents-auto", "documents-auto", job, err);
  });

  return worker;
}
