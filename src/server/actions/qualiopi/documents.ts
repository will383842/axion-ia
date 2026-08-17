/**
 * Qualiopi — Server Actions Génération Documentaire (T19 Cluster D).
 *
 * 15 actions — une par type de document réglementaire :
 *   convention, convention_tripartite, convocation, emargement,
 *   positionnement, grille_evaluation, satisfaction, certificat_realisation,
 *   kit_opco, kit_cpf, kit_france_travail, lettre_mission,
 *   reglement_interieur, livret_accueil, inventaire_moyens (A14).
 *
 * Pattern : genererFactureFormationAction (financements.ts).
 * Chacune :
 *   1. requireAdminWrite + stub-aware early-exit.
 *   2. Charge les données réelles via Prisma.
 *   3. Appelle generateDocument({ type, buildElement:(numero)=>React.createElement(XxxPdf,{data:{...,numero}}), refs }).
 *   4. Log activity qualiopi.document.<type>.genere.
 *   5. Retourne ActionResult<{documentId, numero}>.
 *
 * certificat_realisation (R.6313-3) : durée affichée en centièmes via
 * formatHeuresCentiemes (jamais "7h00") — obligatoire OPCO Atlas.
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", retourne une erreur
 * sans toucher la base (contrat ADR 0026).
 *
 * TS strict (exactOptionalPropertyTypes) : spread conditionnel pour tout
 * champ optionnel.
 */

"use server";

import React from "react";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ecartEffectif, mentionStagiaires } from "@/server/qualiopi/documents/stagiaires-nommes";

/**
 * Lot 1ter §6 — les trois champs « stagiaires » d'une convention, d'un coup.
 *
 * Écrit ici plutôt qu'inséré deux fois : la convention bipartite et la
 * tripartite doivent dire EXACTEMENT la même chose des mêmes personnes. Deux
 * constructions recopiées divergeraient, et l'écart se lirait comme deux
 * versions du même contrat.
 */
function mentionsStagiairesDe(session: {
  nbParticipantsPrevus: number;
  enrollments: ReadonlyArray<{
    statut: string;
    trainee: { nom: string; prenom: string; fonction: string | null };
  }>;
}): {
  stagiairesNommes: readonly string[];
  stagiairesADesigner: string | null;
  ecartEffectif: string | null;
} {
  const mention = mentionStagiaires(
    session.enrollments.map((e) => ({
      nom: e.trainee.nom,
      prenom: e.trainee.prenom,
      fonction: e.trainee.fonction,
      statut: e.statut,
    })),
  );
  return {
    stagiairesNommes: mention.nommes,
    stagiairesADesigner: mention.aDesigner,
    ecartEffectif: ecartEffectif({
      prevu: session.nbParticipantsPrevus,
      nomme: mention.effectifNomme,
    }),
  };
}

import { resolvePrincipalTrainerId } from "@/server/qualiopi/trainers/session-formateurs";
import {
  requireAdminWrite,
  requireHabilitation,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { formatLieu } from "@/server/qualiopi/lieu/format-lieu";
import { ProgrammeFormationPdf } from "@/server/qualiopi/documents/templates/programme-formation";
import { OrganisationActionPdf } from "@/server/qualiopi/documents/templates/organisation-action";
import { lireModulesProgramme } from "@/server/qualiopi/documents/programme-modules";
import {
  LIEU_DOCUMENT_SELECT,
  resolveLieuConvocation,
  resolveLieuDocument,
} from "@/server/qualiopi/lieu/resolve-lieu-document";
import {
  calculerAcompte,
  PLAFOND_ACOMPTE_PARTICULIER_PCT,
} from "@/server/qualiopi/financements/acompte";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { CvFormateurPdf } from "@/server/qualiopi/documents/templates/cv-formateur";
import { buildCvFormateurData } from "@/server/qualiopi/documents/cv-formateur-data";

// Templates
import { ConventionPdf } from "@/server/qualiopi/documents/templates/convention";
import { ConventionTripartitePdf } from "@/server/qualiopi/documents/templates/convention-tripartite";
import { ContratFormationPdf } from "@/server/qualiopi/documents/templates/contrat-formation";
import { ConvocationPdf } from "@/server/qualiopi/documents/templates/convocation";
import { construireTirageEmargement } from "@/server/qualiopi/documents/emargement-tirage";
import { PositionnementPdf } from "@/server/qualiopi/documents/templates/positionnement";
import { GrilleEvaluationPdf } from "@/server/qualiopi/documents/templates/grille-evaluation";
import { SatisfactionPdf } from "@/server/qualiopi/documents/templates/satisfaction";
import { CertificatRealisationPdf } from "@/server/qualiopi/documents/templates/certificat-realisation";
import { KitOpcoPdf } from "@/server/qualiopi/documents/templates/kit-opco";
import { KitCpfPdf } from "@/server/qualiopi/documents/templates/kit-cpf";
import { KitFranceTravailPdf } from "@/server/qualiopi/documents/templates/kit-france-travail";
import {
  LettreMissionPdf,
  type FormationConfiee,
  type LigneRemuneration,
} from "@/server/qualiopi/documents/templates/lettre-mission";
import { resolveRegle, type RegleRemuneration } from "@/server/qualiopi/remuneration/calcul";
import { libelleRemuneration } from "@/server/qualiopi/remuneration/libelle";
import { ReglementInterieurPdf } from "@/server/qualiopi/documents/templates/reglement-interieur";
import { LivretAccueilPdf } from "@/server/qualiopi/documents/templates/livret-accueil";
import { InventaireMoyensPdf } from "@/server/qualiopi/documents/templates/inventaire-moyens";
import { ListeFormateursPdf } from "@/server/qualiopi/documents/templates/liste-formateurs";
import { AutorisationCaptationPdf } from "@/server/qualiopi/documents/templates/autorisation-captation";
import { ContratSousTraitancePdf } from "@/server/qualiopi/documents/templates/contrat-sous-traitance";
import { ProcedureSousTraitancePdf } from "@/server/qualiopi/documents/templates/procedure-sous-traitance";
import { readFormationForDocs } from "@/server/qualiopi/formations/formation-snapshot";
import { coachingInterventionLabel } from "@/server/formateur/coaching-options";
import { normaliserObjectifsPedagogiques } from "@/server/qualiopi/formations/objectifs";
import { listMoyens } from "@/server/qualiopi/moyens/moyens-service";
import { listTrainers } from "@/server/qualiopi/trainers/trainers";
import { getSousTraitant } from "@/server/qualiopi/registres/sous-traitants-service";
import { opcoLabel } from "@/server/qualiopi/financements/opco-referentiel";
import {
  montantPrisEnChargeCents,
  resteAChargeCents,
} from "@/server/qualiopi/financements/prise-en-charge-montant";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STUB = "stub.invalid";

function isStub(): boolean {
  return process.env.DATABASE_URL?.includes(STUB) ?? false;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR");
}

function modaliteLabel(
  m: "presentiel" | "distanciel" | "hybride",
): "Présentiel" | "Distanciel" | "Mixte" {
  if (m === "presentiel") return "Présentiel";
  if (m === "distanciel") return "Distanciel";
  return "Mixte";
}

function modaliteLabelLower(
  m: "presentiel" | "distanciel" | "hybride",
): "présentiel" | "distanciel" | "mixte" {
  if (m === "presentiel") return "présentiel";
  if (m === "distanciel") return "distanciel";
  return "mixte";
}

/**
 * Nom du formateur principal d'une session. FK `formateurPrincipalId` prioritaire
 * (fiable, écrite par l'assignation), repli sur le Json `coFormateurs` (legacy),
 * puis `fallback` (raison sociale). Corrige le nom du formateur sur les documents
 * légaux (auparavant toujours le fallback car coFormateurs est vide en pratique).
 */
async function resolveFormateurNom(
  input: { formateurPrincipalId: string | null; coFormateurs: unknown },
  fallback: string,
): Promise<string> {
  const principalTrainerId = resolvePrincipalTrainerId(input);
  if (principalTrainerId) {
    try {
      const t = await prisma.trainer.findUnique({
        where: { id: principalTrainerId },
        select: { nom: true, prenom: true },
      });
      if (t) return `${t.prenom} ${t.nom}`.trim();
    } catch {
      // fall through
    }
  }
  // Repli legacy : nom inline éventuel dans coFormateurs[0].
  const arr = Array.isArray(input.coFormateurs) ? input.coFormateurs : [];
  const premier = arr[0] as { nom?: string; prenom?: string } | undefined;
  if (premier?.nom) {
    return [premier.prenom, premier.nom].filter(Boolean).join(" ");
  }
  return fallback;
}

/** Extrait les objectifs pédagogiques depuis un champ Json. */
/**
 * Seule des cinq lectures d'`objectifsPedagogiques` à connaître `description`,
 * donc la seule qui sortait juste sur le catalogue — c'est en la comparant aux
 * quatre autres qu'on a trouvé le défaut (parcours à blanc 2026-07-27).
 * Conservée sous son nom d'origine, mais déléguée : une seule implémentation.
 */
const parseObjectifs = normaliserObjectifsPedagogiques;

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Motif d'une RECTIFICATION, commun à toutes les actions de génération.
 *
 * 🔴 Audit pré-visite 2026-08-04. Régénérer une pièce depuis la console la
 * marquait « COPIE » — y compris quand on la refaisait justement parce que
 * l'original était FAUX. Le kit OPCO en est le cas d'école : `AXI-DOC-2026-018`
 * imprimait cinq lignes l'une par-dessus l'autre, `AXI-DOC-2026-024` corrigeait
 * le rendu et sortait filigranée. Restait à choisir, devant l'auditeur, entre
 * un original illisible et une copie exacte.
 *
 * Le motif est ce qui distingue les deux gestes, et il n'y a que l'humain
 * devant l'écran pour le connaître. Il est donc SAISI, jamais deviné : une
 * régénération sans raison écrite reste un duplicata et garde son filigrane.
 *
 * ⚠️ Longueur minimale alignée sur la contrainte `CHECK` en base (10) : les deux
 * couches disent la même chose, faute de quoi un motif accepté ici ferait
 * échouer l'écriture.
 */
const rectificationMotifSchema = z.string().trim().min(10).max(500).optional();

const sessionIdSchema = z.object({
  sessionId: z.string().uuid(),
  rectificationMotif: rectificationMotifSchema,
});

/**
 * Entrée de la convention bipartite — seul document de session paramétrable.
 *
 * `acomptePercent` : 0–100, entier. PAS de plafond à 30 % et c'est voulu — le
 * gabarit le documente : le plafond de l'art. L.6353-6 protège une personne
 * physique (contrat B2C), une convention lie des professionnels et l'acompte y
 * est purement contractuel. `0` est une valeur légitime (convention établie
 * après la tenue de l'action : « payable en totalité à réception de facture »).
 * Absent → 30 %, l'usage commercial en vigueur, inchangé pour l'existant.
 */
const genererConventionSchema = z.object({
  sessionId: z.string().uuid(),
  acomptePercent: z.number().int().min(0).max(100).optional(),
  rectificationMotif: rectificationMotifSchema,
});
const enrollmentIdSchema = z.object({
  enrollmentId: z.string().uuid(),
  rectificationMotif: rectificationMotifSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Convention de formation (L.6353-1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère la convention de formation professionnelle bipartite (L.6353-1).
 * Basée sur les données de la session + formation + client.
 */
export async function genererConventionAction(input: {
  sessionId: string;
  acomptePercent?: number;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = genererConventionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, acomptePercent, rectificationMotif } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      // 🔴 Sans lui, `DocumentGenere.clientId` restait NULL et le lien de
      // signature « client » était refusé (« Aucun client n'est rattaché à
      // cette pièce ») — le circuit convention: [client, axionia] était déclaré
      // mais structurellement inatteignable. Constaté sur la PREMIÈRE
      // convention réelle (AXI-DOC-2026-003, INVEST SUN, 2026-07-31).
      // Gardé par refs-circuits.spec.ts.
      clientId: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      modalite: true,
      ...LIEU_DOCUMENT_SELECT,
      nbParticipantsPrevus: true,
      // 🔴 Lot 1ter §6 — la convention doit NOMMER les stagiaires. Vérifié sur
      // `AXI-DOC-2026-032` : « Effectif prévu : 1 stagiaire », personne de
      // nommé, alors que Simone Blanc y était inscrite. La même personne doit
      // se retrouver sur l'émargement, l'évaluation et l'attestation.
      enrollments: {
        select: {
          statut: true,
          // `fonction` vit sur le stagiaire, pas sur l'inscription.
          trainee: { select: { nom: true, prenom: true, fonction: true } },
        },
      },
      montantHtCents: true,
      formationSnapshot: true,
      formation: {
        select: {
          objectifsPedagogiques: true,
          dureeHeures: true,
          offreSite: { select: { publicViseFr: true } },
        },
      },
      client: {
        select: {
          raisonSociale: true,
          siret: true,
          adresse: true,
          contactNom: true,
          contactEmail: true,
        },
      },
    },
  });
  if (!session) return { error: "Session introuvable" };
  if (!session.client)
    return { error: "Session sans client — impossible de générer la convention" };

  const identite = await getOrganismeIdentite();
  // Données formation depuis le snapshot légal (WS5), repli LIVE si legacy.
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const objectifs = parseObjectifs(formationDoc.objectifsPedagogiques);

  const doc = await generateDocument({
    type: "convention",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(ConventionPdf, {
        data: {
          numero,
          client: {
            raisonSociale: session.client!.raisonSociale,
            siret: session.client!.siret ?? "—",
            adresse: session.client!.adresse ?? "—",
            contact: session.client!.contactNom ?? session.client!.contactEmail ?? "—",
          },
          intitule: session.titreSession,
          objectifs: objectifs.length > 0 ? objectifs : [session.titreSession],
          publicVise: session.formation.offreSite.publicViseFr,
          dureeHeures: formationDoc.dureeHeures ?? session.formation.dureeHeures,
          dateDebut: formatDate(new Date(session.dateDebut)),
          dateFin: formatDate(new Date(session.dateFin)),
          modalite: modaliteLabel(session.modalite),
          lieu: resolveLieuDocument(session, identite),
          effectif: session.nbParticipantsPrevus,
          // Lot 1ter §6 — les stagiaires sont NOMMÉS, et l'écart entre la
          // prévision (`nbParticipantsPrevus`, saisie à la création) et les
          // inscrits (un FAIT) est dit plutôt que laissé à découvrir.
          ...mentionsStagiairesDe(session),
          prixHt: session.montantHtCents / 100,
          // Absent → le gabarit applique 30 % (usage commercial). `0` = payable
          // en totalité à réception de facture — le gabarit rend la mention, pas
          // une ligne « Acompte (0 %) : 0,00 € ».
          ...(acomptePercent !== undefined ? { acomptePercent } : {}),
          dateConvention: formatDateFr(new Date()),
        },
        identite,
      }),
    // `clientId` est non-null ici : la garde « Session sans client » a déjà
    // refusé la génération sinon. C'est lui qui rend le lien de signature
    // « client » émissible sur la pièce.
    refs: { sessionId, clientId: session.clientId! },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.convention.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    // L'acompte est une CLAUSE de la pièce : sa valeur (et le fait qu'elle ait
    // été choisie ou laissée au défaut) appartient au journal.
    changes: { documentId: doc.id, numero: doc.numero, acomptePercent: acomptePercent ?? 30 },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Convention tripartite (L.6353-1/2 + subrogation OPCO)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère la convention tripartite OF + Client + OPCO (subrogation de paiement).
 */
export async function genererConventionTripartiteAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      // Même défaut, même remède que la convention bipartite : sans `clientId`
      // dans les refs, le lien de signature « client » de la tripartite était
      // refusé à l'émission. Gardé par refs-circuits.spec.ts.
      clientId: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      modalite: true,
      ...LIEU_DOCUMENT_SELECT,
      nbParticipantsPrevus: true,
      // 🔴 Lot 1ter §6 — la convention doit NOMMER les stagiaires. Vérifié sur
      // `AXI-DOC-2026-032` : « Effectif prévu : 1 stagiaire », personne de
      // nommé, alors que Simone Blanc y était inscrite. La même personne doit
      // se retrouver sur l'émargement, l'évaluation et l'attestation.
      enrollments: {
        select: {
          statut: true,
          // `fonction` vit sur le stagiaire, pas sur l'inscription.
          trainee: { select: { nom: true, prenom: true, fonction: true } },
        },
      },
      montantHtCents: true,
      opcoSubrogation: true,
      numeroDossierOpco: true,
      // 🔴 16/08 — `priseEnChargeMontantCents` était sélectionné SEUL et lu comme
      // un total. C'est un TARIF : son sens dépend entièrement de l'unité, et
      // les plafonds le bornent. Sans ces quatre champs, la convention imprimait
      // « Prise en charge OPCO : 40,00 € » pour un OPCO couvrant 40 €/h sur 14 h
      // et 8 participants, soit 4 480 € — un facteur 112, sur la pièce que lit
      // le financeur et que trois parties signent.
      priseEnChargeMontantCents: true,
      priseEnChargeUnite: true,
      priseEnChargePlafondFormationCents: true,
      priseEnChargePlafondAnnuelCents: true,
      formationSnapshot: true,
      formation: {
        select: {
          objectifsPedagogiques: true,
          dureeHeures: true,
          offreSite: { select: { publicViseFr: true } },
        },
      },
      client: {
        select: {
          raisonSociale: true,
          siret: true,
          adresse: true,
          contactNom: true,
          contactEmail: true,
          opcoIdentifie: true,
          opcoNumeroAdherent: true,
        },
      },
    },
  });
  if (!session) return { error: "Session introuvable" };
  if (!session.client) return { error: "Session sans client" };

  const identite = await getOrganismeIdentite();
  // Données formation depuis le snapshot légal (WS5), repli LIVE si legacy.
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const objectifs = parseObjectifs(formationDoc.objectifsPedagogiques);
  // Libellé, pas slug : `opcoIdentifie` stocke « akto », la convention
  // tripartite doit lire « Akto ». Le motif existe déjà dans
  // facturation-service.ts et facturation-1to1.ts.
  const nomOpco = session.client.opcoIdentifie
    ? opcoLabel(session.client.opcoIdentifie)
    : "OPCO (à préciser)";
  const numeroPriseEnCharge = session.numeroDossierOpco ?? session.client.opcoNumeroAdherent ?? "—";
  const prixHt = session.montantHtCents / 100;

  // 🔴 16/08 — le montant pris en charge se CALCULE, il ne se lit pas.
  //
  // `priseEnChargeMontantCents` est un TARIF (€/h, €/j, €/formation,
  // €/an/salarié) : le lire brut imprimait « 40,00 € » là où l'OPCO couvre
  // 40 €/h × 14 h × 8 participants = 4 480 €. Sur une pièce contractuelle
  // signée par trois parties, avec un reste à charge faux du même écart.
  //
  // ⚠️ `null` = montant NON ÉTABLI (tarif absent, unité absente, durée requise
  // et inconnue). Le gabarit le dit alors, au lieu d'imprimer 0 — un zéro se
  // lirait comme « le financeur ne prend rien en charge », ce qui est une
  // affirmation, et une affirmation fausse.
  const basePriseEnCharge = {
    priseEnChargeMontantCents: session.priseEnChargeMontantCents,
    priseEnChargeUnite: session.priseEnChargeUnite,
    priseEnChargePlafondFormationCents: session.priseEnChargePlafondFormationCents,
    priseEnChargePlafondAnnuelCents: session.priseEnChargePlafondAnnuelCents,
    dureeHeures: formationDoc.dureeHeures ?? session.formation.dureeHeures,
    nbParticipants: session.nbParticipantsPrevus,
  };
  const priseEnChargeCents = montantPrisEnChargeCents(basePriseEnCharge);
  const resteCents = resteAChargeCents(basePriseEnCharge, session.montantHtCents);

  const doc = await generateDocument({
    type: "convention_tripartite",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(ConventionTripartitePdf, {
        data: {
          numero,
          client: {
            raisonSociale: session.client!.raisonSociale,
            siret: session.client!.siret ?? "—",
            adresse: session.client!.adresse ?? "—",
            contact: session.client!.contactNom ?? session.client!.contactEmail ?? "—",
          },
          opco: {
            nom: nomOpco,
            numeroPriseEnCharge,
          },
          intitule: session.titreSession,
          objectifs: objectifs.length > 0 ? objectifs : [session.titreSession],
          publicVise: session.formation.offreSite.publicViseFr,
          dureeHeures: formationDoc.dureeHeures ?? session.formation.dureeHeures,
          dateDebut: formatDate(new Date(session.dateDebut)),
          dateFin: formatDate(new Date(session.dateFin)),
          modalite: modaliteLabel(session.modalite),
          lieu: resolveLieuDocument(session, identite),
          effectif: session.nbParticipantsPrevus,
          // Lot 1ter §6 — les stagiaires sont NOMMÉS, et l'écart entre la
          // prévision (`nbParticipantsPrevus`, saisie à la création) et les
          // inscrits (un FAIT) est dit plutôt que laissé à découvrir.
          ...mentionsStagiairesDe(session),
          prixHt,
          // `null` quand le montant n'est pas établi : le gabarit le DIT.
          montantPrisEnCharge: priseEnChargeCents !== null ? priseEnChargeCents / 100 : null,
          resteAChargeClient: resteCents !== null ? resteCents / 100 : null,
          dateConvention: formatDateFr(new Date()),
        },
        identite,
      }),
    // Non-null : la garde « Session sans client » a déjà refusé sinon. La
    // partie « financeur », elle, se résout via `sessionId` (dossier de
    // financement le plus récent) — les deux refs sont donc nécessaires.
    refs: { sessionId, clientId: session.clientId! },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.convention_tripartite.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2bis. Contrat de formation professionnelle (particulier / B2C, L.6353-3 à 7)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le contrat de formation professionnelle pour un PARTICULIER qui finance
 * lui-même sa formation (L.6353-3 à L.6353-7). Par inscription (enrollment) =
 * un stagiaire personne physique. Distinct de la convention (personnes morales).
 *
 * Le prix porté au contrat est le montant net de la session (formation exonérée
 * de TVA). Pour une session inter à plusieurs particuliers, renseigner le
 * montant par stagiaire au niveau de la session.
 */
export async function genererContratFormationAction(input: {
  enrollmentId: string;
  rectificationMotif?: string;
}): Promise<
  ActionResult<{ documentId: string; numero: string; avertissement?: string | undefined }>
> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  // ⚠️ MÉDIATION DE LA CONSOMMATION — AVERTISSEMENT, PLUS BLOCAGE (2026-07-30).
  //
  // Le contrat de formation de l'article L.6353-3 s'adresse à une personne
  // physique agissant pour son propre compte, donc à un CONSOMMATEUR. L'article
  // L.612-1 du Code de la consommation impose alors d'avoir adhéré à un
  // médiateur agréé et d'en publier les coordonnées — amende administrative
  // jusqu'à 15 000 € pour une personne morale.
  //
  // L'audit de certification (2026-07-26, F50) avait posé ici un REFUS pur et
  // simple. Décision de Will du 2026-07-30 : ne plus bloquer. L'obligation
  // légale, elle, ne disparaît pas — mais elle ne se règle pas dans le code, et
  // un outil qui refuse de produire le document laisse l'admin sans issue le
  // jour où il en a besoin. Le rôle du logiciel s'arrête à dire ce qui manque.
  //
  // Donc : le contrat est émis, et l'absence de médiateur est
  //   • rendue VISIBLE à l'admin (avertissement retourné avec le document) ;
  //   • TRACÉE dans le journal d'audit, avec le numéro du contrat concerné.
  //
  // Ce second point est le plus important. Le jour d'un contrôle, la question
  // ne sera pas « le logiciel bloquait-il ? » mais « quels contrats ont été
  // émis sans la mention ? ». Sans trace, la réponse est introuvable ; avec
  // elle, la liste s'extrait du journal en une requête.
  //
  // Pour faire disparaître l'avertissement : renseigner
  // « mediateur_consommation_nom » et « mediateur_consommation_url » dans la
  // configuration Qualiopi, après adhésion effective à un médiateur agréé.
  //
  // 🔴 PIÈGE À CONNAÎTRE le jour où ce sera fait : `contrat-formation.tsx`
  // n'imprime AUCUNE clause de médiation, ni aujourd'hui ni avec les clés
  // renseignées. Le refus posé en 2026-07-26 protégeait donc l'émission d'un
  // document qui, même conforme côté configuration, n'aurait pas porté la
  // mention — une conformité de façade. Renseigner les deux clés éteindra
  // l'avertissement SANS ajouter la clause au contrat : il faudra aussi
  // modifier le gabarit, sous peine de croire le contrat en règle alors qu'il
  // ne l'est pas. Ne pas retirer ce commentaire avant que le gabarit l'imprime.
  //
  // ⚠️ N'affecte QUE le contrat individuel. La convention B2B ne relève pas du
  // droit de la consommation et n'a jamais été concernée.
  const [mediateurNom, mediateurUrl] = await Promise.all([
    getQualiopiConfig("mediateur_consommation_nom"),
    getQualiopiConfig("mediateur_consommation_url"),
  ]);
  const mediateurManquant = !mediateurNom?.trim() || !mediateurUrl?.trim();
  const avertissementMediation = mediateurManquant
    ? "Contrat émis SANS mention de médiation de la consommation : aucun médiateur n'est renseigné. Vendre une formation à un particulier impose d'avoir adhéré à un médiateur agréé CECMC et d'en publier les coordonnées (art. L.612-1 du Code de la consommation). Renseignez « mediateur_consommation_nom » et « mediateur_consommation_url » dans la configuration Qualiopi. Les conventions B2B ne sont pas concernées."
    : undefined;

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId, rectificationMotif } = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      trainee: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } },
      session: {
        select: {
          id: true,
          titreSession: true,
          dateDebut: true,
          dateFin: true,
          modalite: true,
          ...LIEU_DOCUMENT_SELECT,
          montantHtCents: true,
          // 🔴 Nécessaire au calcul de l'acompte : l'assiette est le RESTE À
          // CHARGE, pas le prix total. Sans cette lecture, le contrat annonçait
          // 30 % du total — sur 2 000 € dont 1 200 € financés, 600 € au lieu de
          // 240. Le client signait un chiffre que le système n'appliquait pas.
          priseEnChargeMontantCents: true,
          opcoSubrogation: true,
          formationSnapshot: true,
          formation: {
            select: {
              objectifsPedagogiques: true,
              dureeHeures: true,
            },
          },
        },
      },
    },
  });
  if (!enrollment) return { error: "Inscription introuvable" };

  const identite = await getOrganismeIdentite();
  const session = enrollment.session;
  const trainee = enrollment.trainee;
  // Données formation depuis le snapshot légal (WS5), repli LIVE si legacy.
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const objectifs = parseObjectifs(formationDoc.objectifsPedagogiques);
  const nomPrenom = `${trainee.prenom} ${trainee.nom}`.trim();

  // 🔴 L'acompte ANNONCÉ vient désormais du calcul, plus d'un pourcentage
  // recalculé dans le gabarit.
  //
  // Le gabarit accepte `acompteEuros` depuis le 2026-07-27, précisément pour
  // que le contrat imprime ce qui a été CONVENU au lieu de recalculer un
  // plafond. Mais personne ne le lui fournissait : il retombait donc toujours
  // sur 30 % de `prixNet`, c'est-à-dire du TOTAL. Le correctif était à moitié
  // posé — la moitié visible, pas la moitié agissante.
  //
  // `calculerAcompte` prend pour assiette le RESTE À CHARGE, ce que le
  // particulier avance réellement de sa poche. Les deux étages ne se
  // contredisent pas : 30 % du reste à charge est toujours ≤ 30 % du prix
  // convenu, plafond que `facturation-hub` fait respecter au refus.
  //
  // ⚠️ Ne lève jamais : un contexte incohérent est ramené à des bornes sûres.
  // Une exception ici bloquerait l'émission du contrat, ce qui est pire qu'un
  // acompte à zéro.
  const acompte = calculerAcompte({
    montantTotalHtCents: session.montantHtCents,
    priseEnChargeCents: session.priseEnChargeMontantCents ?? 0,
    subrogation: session.opcoSubrogation === true,
    // Un contrat individuel n'est pas un dossier CPF : le CPF passe par la
    // Caisse des dépôts, jamais par un contrat de gré à gré avec l'organisme.
    cpf: false,
    nature: "particulier",
    tauxAcomptePct: PLAFOND_ACOMPTE_PARTICULIER_PCT,
    // 🔴 Les bornes de l'action, sans lesquelles le point (3) de L6353-6 reste
    // une citation : `calculerAcompte` ne peut DATER les échéances du solde que
    // s'il connaît la période sur laquelle l'action se déroule.
    //
    // ⚠️ La signature n'a pas encore eu lieu — on prend donc `new Date()` comme
    // date d'engagement présumée pour borner la première échéance après le délai
    // de rétractation. Le contrat imprimé annonce un échéancier calculé à SA date
    // d'émission ; si la signature est plus tardive, le garde-fou serveur
    // (`encaissementAutorise`) reste l'autorité sur l'encaissement réel.
    dateSignature: new Date(),
    dateDebutAction: new Date(session.dateDebut),
    dateFinAction: new Date(session.dateFin),
    // « En 3 fois » par défaut, réglable. ⚠️ Le plancher légal de 2 échéances du
    // particulier reste appliqué par `calculerAcompte` : ce réglage ne peut pas
    // descendre sous la loi.
    nbEcheancesSolde: (await getQualiopiConfig("nb_echeances_solde_defaut")) || 3,
  });

  const doc = await generateDocument({
    type: "contrat",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(ContratFormationPdf, {
        data: {
          numero,
          stagiaire: {
            nomPrenom,
            ...(trainee.email ? { email: trainee.email } : {}),
            ...(trainee.telephone !== null && trainee.telephone !== undefined
              ? { telephone: trainee.telephone }
              : {}),
          },
          intitule: session.titreSession,
          objectifs: objectifs.length > 0 ? objectifs : [session.titreSession],
          dureeHeures: formationDoc.dureeHeures ?? session.formation.dureeHeures,
          dateDebut: formatDate(new Date(session.dateDebut)),
          dateFin: formatDate(new Date(session.dateFin)),
          modalite: modaliteLabel(session.modalite),
          lieu: resolveLieuDocument(session, identite),
          prixNet: session.montantHtCents / 100,
          // Ce que le système DEMANDERA réellement, pas un plafond recalculé.
          acompteEuros: acompte.acompteCents / 100,
          // 🔴 L'échéancier DATÉ, transmis au gabarit. Sans cette ligne, la prop
          // `echeancierSolde` serait un paramètre mort — exactement le défaut F1
          // trouvé sur le devis (un gabarit câblé qu'aucun producteur n'alimente).
          //
          // ⚠️ On ne garde QUE les échéances du solde : la première ligne de
          // `acompte.echeancier` est l'acompte, déjà affiché au-dessus. La
          // dédoubler donnerait un contrat où le stagiaire paie deux fois.
          echeancierSolde: acompte.echeancier
            .filter((e) => !e.libelle.startsWith("Acompte"))
            .map((e) => ({
              libelle: e.libelle,
              montantEuros: e.montantCents / 100,
              dueLeLisible: e.dueLe === null ? null : formatDate(e.dueLe),
            })),
          dateContrat: formatDateFr(new Date()),
        },
        identite,
      }),
    // ⚠️ `traineeId` fait partie de l'IDENTITÉ de la pièce : ces documents sont
    // établis PAR STAGIAIRE. Sans lui, la détection de régénération marquait
    // « copie » toutes les pièces des stagiaires suivants d'une même session.
    refs: { sessionId: session.id, traineeId: trainee.id },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.contrat.genere",
    targetType: "Enrollment",
    targetId: enrollmentId,
    changes: {
      documentId: doc.id,
      numero: doc.numero,
      sessionId: session.id,
      // Trace de conformité. Le jour d'un contrôle, la question sera « quels
      // contrats ont été émis sans la mention de médiation ? » — cette clé rend
      // la liste extractible du journal, contrat par contrat, au lieu de la
      // laisser introuvable.
      ...(mediateurManquant ? { mentionMediationAbsente: true } : {}),
    },
    session: adminSession,
  });

  return {
    data: {
      documentId: doc.id,
      numero: doc.numero,
      ...(avertissementMediation ? { avertissement: avertissementMediation } : {}),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Convocation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère une convocation pour un stagiaire inscrit à une session.
 * enrollmentId identifie le couple stagiaire × session.
 */
export async function genererConvocationAction(input: {
  enrollmentId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId, rectificationMotif } = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      trainee: { select: { id: true, nom: true, prenom: true, entreprise: true } },
      session: {
        select: {
          id: true,
          titreSession: true,
          dateDebut: true,
          dateFin: true,
          modalite: true,
          ...LIEU_DOCUMENT_SELECT,
          formationSnapshot: true,
          formation: { select: { dureeHeures: true } },
          coFormateurs: true,
          formateurPrincipalId: true,
          numeroDossierOpco: true,
          financementType: true,
        },
      },
    },
  });
  if (!enrollment) return { error: "Inscription introuvable" };

  const identite = await getOrganismeIdentite();
  const session = enrollment.session;
  const trainee = enrollment.trainee;
  // Durée depuis le snapshot légal (WS5), repli LIVE si legacy.
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const formateurNom = await resolveFormateurNom(
    { formateurPrincipalId: session.formateurPrincipalId, coFormateurs: session.coFormateurs },
    identite.raisonSociale,
  );

  const nomStagiaire = `${trainee.prenom} ${trainee.nom}`.trim();
  const financement = session.financementType ?? undefined;

  // Horaires réels : un seul créneau si toutes les journées ont les mêmes, la
  // liste sinon. Rien n'est inventé — sans journées déclarées, on le dit.
  const joursConvocation = await prisma.sessionJour.findMany({
    where: { sessionId: session.id },
    select: { heureDebut: true, heureFin: true },
    orderBy: { date: "asc" },
  });
  const plages = [...new Set(joursConvocation.map((j) => `${j.heureDebut}–${j.heureFin}`))];
  const horairesReels =
    plages.length === 0 ? "horaires communiqués par l'organisme" : plages.join(", ");

  const lieuConvocation = resolveLieuConvocation(session, identite);

  const doc = await generateDocument({
    type: "convocation",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(ConvocationPdf, {
        data: {
          numero,
          intituleFormation: session.titreSession,
          dateDebut: formatDate(new Date(session.dateDebut)),
          dateFin: formatDate(new Date(session.dateFin)),
          // Horaires RÉELS des journées déclarées, jamais un « 09h00–17h00 »
          // codé en dur : la convocation et la feuille d'émargement doivent dire
          // la même chose, et CAA Nantes 20/04/2021 sanctionne précisément les
          // intitulés et horaires divergents entre documents.
          horaires: horairesReels,
          dureeHeures: formationDoc.dureeHeures ?? session.formation.dureeHeures,
          modalite: modaliteLabelLower(session.modalite),
          // Le gabarit masque déjà cette ligne en distanciel. `undefined` plutôt
          // que « — » : une convocation qui affiche « Lieu : — » est pire que
          // muette, elle laisse croire que l'information a été cherchée et
          // qu'elle n'existe pas.
          ...(lieuConvocation !== undefined ? { lieu: lieuConvocation } : {}),
          nomFormateur: formateurNom,
          contactEmail: identite.email,
          nomStagiaire,
          ...(trainee.entreprise !== null && trainee.entreprise !== undefined
            ? { entreprise: trainee.entreprise }
            : {}),
          ...(financement !== null && financement !== undefined ? { financement } : {}),
          ...(session.numeroDossierOpco !== null && session.numeroDossierOpco !== undefined
            ? { numeroOrdrePriseEnCharge: session.numeroDossierOpco }
            : {}),
        },
        identite,
      }),
    // ⚠️ `traineeId` fait partie de l'IDENTITÉ de la pièce : ces documents sont
    // établis PAR STAGIAIRE. Sans lui, la détection de régénération marquait
    // « copie » toutes les pièces des stagiaires suivants d'une même session.
    refs: { sessionId: session.id, traineeId: trainee.id },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.convocation.genere",
    targetType: "Enrollment",
    targetId: enrollmentId,
    changes: { documentId: doc.id, numero: doc.numero, sessionId: session.id },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Feuille d'émargement présentiel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère la feuille d'émargement présentiel pour une session.
 * Inclut tous les stagiaires inscrits (statut ≠ exclu/abandon).
 */
export async function genererEmargementAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;

  // ⚠️ Pas de `resolveFormateurNom` ici : le formateur est porté JOURNÉE PAR
  // JOURNÉE par `construireFeuillePdf` (désistement, co-animation). Un nom
  // unique en tête de feuille contredirait le tableau qui suit, et CAA Nantes
  // 20/04/2021 sanctionne précisément les feuilles dont le formateur annoncé ne
  // correspond pas à celui qui a animé.
  //
  // Le contenu de la feuille est construit par `construireTirageEmargement`,
  // partagé avec le TIRAGE à la demande (`/api/qualiopi/sessions/[id]/
  // emargement`). Les deux voies doivent rendre exactement la même feuille :
  // celle du registre est figée à l'émission, le tirage la rejoue à jour.
  const tirage = await construireTirageEmargement(sessionId);
  if (!tirage.ok) return { error: tirage.message };

  const doc = await generateDocument({
    type: "emargement",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) => tirage.element(numero),
    refs: { sessionId },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.emargement.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero, nbParticipants: tirage.nbParticipants },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Questionnaire de positionnement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le questionnaire de positionnement pour une session.
 * Le questionnaire est pré-rempli avec le titre de la session.
 */
export async function genererPositionnementAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, titreSession: true, dateDebut: true },
  });
  if (!session) return { error: "Session introuvable" };

  const identite = await getOrganismeIdentite();

  const doc = await generateDocument({
    type: "positionnement",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(PositionnementPdf, {
        data: {
          numero,
          intituleFormation: session.titreSession,
          dateSession: formatDate(new Date(session.dateDebut)),
        },
        identite,
      }),
    refs: { sessionId },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.positionnement.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Grille d'évaluation des compétences (indicateur Qualiopi n°11)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère la grille d'évaluation pour un stagiaire d'une session.
 * Les compétences sont extraites des objectifs pédagogiques de la formation.
 */
export async function genererGrilleEvaluationAction(input: {
  enrollmentId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId, rectificationMotif } = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      trainee: { select: { id: true, nom: true, prenom: true } },
      session: {
        select: {
          id: true,
          titreSession: true,
          dateDebut: true,
          coFormateurs: true,
          formateurPrincipalId: true,
          formationSnapshot: true,
          formation: { select: { objectifsPedagogiques: true } },
        },
      },
    },
  });
  if (!enrollment) return { error: "Inscription introuvable" };

  const identite = await getOrganismeIdentite();
  const session = enrollment.session;
  const trainee = enrollment.trainee;
  const formateurNom = await resolveFormateurNom(
    { formateurPrincipalId: session.formateurPrincipalId, coFormateurs: session.coFormateurs },
    identite.raisonSociale,
  );
  // Objectifs depuis le snapshot légal (WS5), repli LIVE si legacy.
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const rawObjectifs = parseObjectifs(formationDoc.objectifsPedagogiques);
  const grilleVierge =
    rawObjectifs.length > 0
      ? rawObjectifs.map((libelle) => ({ libelle }))
      : [{ libelle: session.titreSession }];

  // 🔴 Audit pré-visite 2026-08-03. La grille ne lisait JAMAIS l'évaluation
  // enregistrée : elle rendait toujours le formulaire vierge, même quand une
  // évaluation finale existait en base.
  //
  // Sur le premier dossier réel, la grille affichait « Score total : — / 15 »
  // pendant que l'attestation du même dossier portait « Réussite — score 100 % ».
  // Régénérer ne changeait rien, puisque la source n'était pas consultée.
  //
  // Deux pièces du même dossier qui se contredisent sur l'atteinte des
  // objectifs, c'est exactement ce qu'un contrôle relève — et l'indicateur 11
  // n'est pas graduable.
  //
  // La forme stockée dans `evaluationAcquis.competences` est déjà celle
  // qu'attend le gabarit (`{ libelle, note, observations }`) : on la reprend
  // telle quelle, sans re-mapper, pour qu'écran et PDF ne puissent pas diverger.
  const evaluationFinale = await prisma.evaluationAcquis.findFirst({
    where: { enrollmentId, type: "finale" },
    orderBy: { dateEvaluation: "desc" },
    select: { competences: true, recommandations: true },
  });

  const competencesEvaluees = Array.isArray(evaluationFinale?.competences)
    ? (evaluationFinale.competences as unknown[]).flatMap((c) => {
        if (c === null || typeof c !== "object") return [];
        const o = c as Record<string, unknown>;
        const libelle = typeof o["libelle"] === "string" ? o["libelle"] : null;
        if (libelle === null || libelle.trim() === "") return [];
        const note = o["note"];
        const observations = o["observations"];
        return [
          {
            libelle,
            ...(note === 1 || note === 2 || note === 3 ? { note } : {}),
            ...(typeof observations === "string" && observations.trim() !== ""
              ? { observations }
              : {}),
          },
        ];
      })
    : [];

  // Repli sur la grille vierge : une évaluation absente ou illisible doit
  // produire un formulaire imprimable, jamais faire échouer la génération.
  const competences = competencesEvaluees.length > 0 ? competencesEvaluees : grilleVierge;

  const doc = await generateDocument({
    type: "grille_evaluation",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(GrilleEvaluationPdf, {
        data: {
          numero,
          intituleFormation: session.titreSession,
          dateEvaluation: formatDate(new Date(session.dateDebut)),
          typeEvaluation: "finale",
          nomFormateur: formateurNom,
          nomStagiaire: `${trainee.prenom} ${trainee.nom}`.trim(),
          competences,
          ...(typeof evaluationFinale?.recommandations === "string" &&
          evaluationFinale.recommandations.trim() !== ""
            ? { recommandations: evaluationFinale.recommandations }
            : {}),
        },
        identite,
      }),
    // ⚠️ `traineeId` fait partie de l'IDENTITÉ de la pièce : ces documents sont
    // établis PAR STAGIAIRE. Sans lui, la détection de régénération marquait
    // « copie » toutes les pièces des stagiaires suivants d'une même session.
    refs: { sessionId: session.id, traineeId: trainee.id },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.grille_evaluation.genere",
    targetType: "Enrollment",
    targetId: enrollmentId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Questionnaire de satisfaction (indicateur Qualiopi n°31)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le questionnaire de satisfaction à chaud pour une session.
 */
export async function genererSatisfactionAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, titreSession: true, dateFin: true },
  });
  if (!session) return { error: "Session introuvable" };

  const identite = await getOrganismeIdentite();

  const doc = await generateDocument({
    type: "satisfaction",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(SatisfactionPdf, {
        data: {
          numero,
          intituleFormation: session.titreSession,
          dateSession: formatDate(new Date(session.dateFin)),
        },
        identite,
      }),
    refs: { sessionId },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.satisfaction.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Certificat de réalisation (R.6313-3 — durée en centièmes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le certificat de réalisation pour un stagiaire (R.6313-3).
 *
 * ⚠️ DURÉE EN CENTIÈMES OBLIGATOIRE : formatHeuresCentiemes(dureeHeures).
 *    Utilisé par OPCO Atlas. La durée réelle est lue depuis dureeReelleHeures
 *    si disponible, sinon fallback sur la durée de formation prévue.
 */
export async function genererCertificatRealisationAction(input: {
  enrollmentId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  // Acte ENGAGEANT : certificat de realisation R.6313-3 : piece opposable au financeur.
  const adminSession = await requireHabilitation("attester");
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId, rectificationMotif } = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      statut: true,
      tauxPresencePct: true,
      trainee: {
        select: {
          id: true,
          nom: true,
          prenom: true,
          fonction: true,
        },
      },
      session: {
        select: {
          id: true,
          titreSession: true,
          dateDebut: true,
          dateFin: true,
          dureeReelleHeures: true,
          // F30 — portée sur le certificat de réalisation (arrêté 21/12/2018).
          modalite: true,
          formationSnapshot: true,
          formation: {
            select: {
              dureeHeures: true,
              titre: true,
            },
          },
          client: {
            select: {
              raisonSociale: true,
              siret: true,
              adresse: true,
            },
          },
        },
      },
    },
  });
  if (!enrollment) return { error: "Inscription introuvable" };

  // Conformité R.6313-3 : un certificat de réalisation atteste d'heures réellement
  // suivies. Un stagiaire en abandon ou exclu ne peut PAS recevoir de certificat
  // (cohérent avec l'attestation, cf. attestation-service.ts). Garde bloquante.
  if (enrollment.statut === "abandon" || enrollment.statut === "exclu") {
    return {
      error:
        "Certificat refusé : le stagiaire est en abandon/exclu. Aucun certificat de réalisation ne peut être émis (R.6313-3).",
    };
  }

  // 🔴 Constaté EN PRODUCTION le 2026-07-26 — et déjà matérialisé.
  //
  // Le statut d'abandon était la SEULE garde. Plus bas, la durée n'est pondérée
  // par le taux de présence que `if (tauxPresencePct !== null)` : quand le taux
  // est inconnu, le certificat atteste donc la durée PRÉVUE comme si elle avait
  // été réalisée. Rien n'exigeait qu'une seule heure ait été constatée.
  //
  // Ce n'est pas théorique : un `certificat_realisation` a été émis le 22/07 en
  // production alors que `emargement_signatures` comptait ZÉRO ligne. La pièce
  // que l'auditrice contrôle en premier attestait d'heures que rien ne prouvait.
  //
  // R.6313-3 : un certificat de réalisation atteste d'heures RÉELLEMENT suivies.
  // Deux conditions, donc, et elles sont distinctes :
  //   1. le taux de présence doit avoir été MESURÉ — un taux inconnu n'est pas un
  //      taux de 100 % ;
  //   2. il doit reposer sur une TRACE — au moins une signature d'émargement
  //      rattachée à cette inscription. Un taux saisi à la main sans émargement
  //      est une déclaration, pas une preuve, et c'est précisément ce qu'un
  //      contrôle de service fait sanctionne.
  //
  // On refuse plutôt que d'émettre une pièce fausse : un certificat manquant se
  // rattrape en émargeant, un certificat surdéclaré engage l'organisme devant le
  // financeur.
  if (enrollment.tauxPresencePct === null) {
    return {
      error:
        "Certificat refusé : le taux de présence n'a pas été calculé. Un certificat de réalisation atteste d'heures réellement suivies (R.6313-3) — il ne peut pas reposer sur la durée prévue.",
    };
  }

  const signatures = await prisma.emargementSignature.count({
    where: { enrollmentId: enrollment.id },
  });
  if (signatures === 0) {
    return {
      error:
        "Certificat refusé : aucune signature d'émargement n'est rattachée à cette inscription. Le taux de présence doit reposer sur une trace vérifiable, pas sur une saisie (R.6313-3, indicateurs 9 et 11).",
    };
  }

  const identite = await getOrganismeIdentite();
  const session = enrollment.session;
  const trainee = enrollment.trainee;
  // Durée + intitulé depuis le snapshot légal (WS5), repli LIVE si legacy.
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const dureePrevue = formationDoc.dureeHeures ?? session.formation.dureeHeures;

  // Durée RÉALISÉE PAR CE STAGIAIRE (R.6313-3) : base = durée réelle de la session
  // si déclarée, sinon durée prévue ; puis TOUJOURS pondérée par le taux de présence
  // individuel quand il est connu.
  //
  // 🔴 #2 — avant, la pondération par le taux ne s'appliquait QUE si `dureeReelleHeures`
  // était null : un stagiaire à 50 % d'une session de 16 h réelles obtenait un
  // certificat « 16 h réalisées » (durée SESSION) alors que son attestation portait
  // « 8 h suivies » (durée INDIVIDUELLE). Deux pièces du même dossier divergeaient, et
  // le certificat SUR-DÉCLARAIT les heures à l'OPCO. Les deux mesurent désormais les
  // heures réellement suivies par le bénéficiaire = taux × (durée réelle ?? prévue).
  const baseDuree = session.dureeReelleHeures ?? dureePrevue;
  let dureeHeures = baseDuree;
  if (enrollment.tauxPresencePct !== null) {
    dureeHeures = Math.round((enrollment.tauxPresencePct * baseDuree) / 100);
  }

  const dirigeant = await getQualiopiConfig("dirigeant_nom");

  const doc = await generateDocument({
    type: "certificat_realisation",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(CertificatRealisationPdf, {
        data: {
          numero,
          dateEmission: formatDateFr(new Date()),
          identite,
          ...(dirigeant ? { dirigeant } : {}),
          entreprise: {
            raisonSociale: session.client?.raisonSociale ?? identite.raisonSociale,
            ...(session.client?.siret !== null && session.client?.siret !== undefined
              ? { siret: session.client.siret }
              : {}),
            ...(session.client?.adresse !== null && session.client?.adresse !== undefined
              ? { adresse: session.client.adresse }
              : {}),
          },
          stagiaire: {
            nom: trainee.nom,
            prenom: trainee.prenom,
            ...(trainee.fonction !== null && trainee.fonction !== undefined
              ? { fonction: trainee.fonction }
              : {}),
          },
          // #9 — intitulé de la SESSION (comme convention/convocation/émargement/
          // attestation), pas le titre catalogue : sinon un certificat de
          // réalisation portait un intitulé divergent des autres pièces du dossier.
          intituleAction: session.titreSession ?? formationDoc.titre ?? session.formation.titre,
          dateDebut: formatDate(new Date(session.dateDebut)),
          dateFin: formatDate(new Date(session.dateFin)),
          // ⚠️ dureeHeures en décimal — formatHeuresCentiemes appelé dans le template
          dureeHeures,
          // F30 — modalité réelle de la session. Le modèle annexé à l'arrêté du
          // 21 décembre 2018 distingue présentiel et distanciel, et un contrôle
          // de service fait porte précisément là-dessus. La nature de l'action
          // prend son défaut « action de formation » dans le template.
          modalite: session.modalite,
        },
      }),
    // ⚠️ `traineeId` fait partie de l'IDENTITÉ de la pièce : ces documents sont
    // établis PAR STAGIAIRE. Sans lui, la détection de régénération marquait
    // « copie » toutes les pièces des stagiaires suivants d'une même session.
    refs: { sessionId: session.id, traineeId: trainee.id },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.certificat_realisation.genere",
    targetType: "Enrollment",
    targetId: enrollmentId,
    changes: {
      documentId: doc.id,
      numero: doc.numero,
      dureeHeures,
      sessionId: session.id,
    },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Kit OPCO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le kit dossier OPCO (pièces + ventilation horaire + financement).
 */
export async function genererKitOpcoAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  // Acte ENGAGEANT : kit OPCO depose au nom du client (mandat).
  const adminSession = await requireHabilitation("deposer_demande_financeur");
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      montantHtCents: true,
      priseEnChargeMontantCents: true,
      priseEnChargeUnite: true,
      numeroDossierOpco: true,
      enrollments: {
        where: { statut: { notIn: ["exclu", "abandon"] } },
        select: {
          trainee: { select: { nom: true, prenom: true } },
          session: {
            select: {
              dureeReelleHeures: true,
              formationSnapshot: true,
              formation: { select: { dureeHeures: true } },
            },
          },
        },
      },
      client: {
        select: { opcoIdentifie: true },
      },
    },
  });
  if (!session) return { error: "Session introuvable" };

  const identite = await getOrganismeIdentite();
  const nomOpco = session.client?.opcoIdentifie
    ? opcoLabel(session.client.opcoIdentifie)
    : "OPCO (à préciser)";
  const numeroDossier = session.numeroDossierOpco ?? "—";
  const baremeCents = session.priseEnChargeMontantCents ?? 0;

  // Ventilation par participant
  const ventilation = session.enrollments.map((e) => {
    // Durée depuis le snapshot légal (WS5), repli LIVE si legacy.
    const fd = readFormationForDocs(e.session.formationSnapshot, e.session.formation);
    const dureeH = e.session.dureeReelleHeures ?? fd.dureeHeures ?? e.session.formation.dureeHeures;
    const prise = Math.round((baremeCents * dureeH) / 100) * 100;
    const prixTotal = session.montantHtCents;
    const parPart =
      session.enrollments.length > 0
        ? Math.round(prixTotal / session.enrollments.length)
        : prixTotal;
    const rac = Math.max(0, parPart - prise);
    return {
      nomParticipant: `${e.trainee.prenom} ${e.trainee.nom}`.trim(),
      heuresRealisees: dureeH,
      baremePrisEnChargeHeureCents: baremeCents,
      montantPrisEnChargeCents: prise,
      resteAChargeCents: rac,
    };
  });

  const totalPrisEnCharge = ventilation.reduce((s, v) => s + v.montantPrisEnChargeCents, 0);
  const totalRac = ventilation.reduce((s, v) => s + v.resteAChargeCents, 0);

  const doc = await generateDocument({
    type: "kit_opco",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(KitOpcoPdf, {
        data: {
          numero,
          dateEmission: formatDateFr(new Date()),
          identite,
          nomOpco,
          numeroDossier,
          intituleFormation: session.titreSession,
          dateDebut: formatDate(new Date(session.dateDebut)),
          dateFin: formatDate(new Date(session.dateFin)),
          ventilation,
          totalPrisEnChargeCents: totalPrisEnCharge,
          totalResteAChargeCents: totalRac,
        },
      }),
    refs: { sessionId },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.kit_opco.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Kit CPF / EDOF
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le kit dossier CPF/EDOF pour un stagiaire inscrit.
 */
export async function genererKitCpfAction(input: {
  enrollmentId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  // Acte ENGAGEANT : kit CPF/EDOF depose au nom du stagiaire.
  const adminSession = await requireHabilitation("deposer_demande_financeur");
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId, rectificationMotif } = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      trainee: { select: { id: true, nom: true, prenom: true } },
      session: {
        select: {
          id: true,
          titreSession: true,
          dateDebut: true,
          dateFin: true,
          montantHtCents: true,
          priseEnChargeMontantCents: true,
          formation: { select: { codeCpf: true } },
        },
      },
    },
  });
  if (!enrollment) return { error: "Inscription introuvable" };

  const identite = await getOrganismeIdentite();
  const session = enrollment.session;
  const trainee = enrollment.trainee;
  const codeCpf = session.formation.codeCpf ?? "—";
  const coutTotal = session.montantHtCents;
  const montantCpf = session.priseEnChargeMontantCents ?? 0;
  // R4 (audit) : participation forfaitaire CPF (réforme 2024) câblée au SiteSetting
  // `cpf_reste_a_charge` (€). Reste à charge = le résiduel s'il existe, sinon la
  // participation obligatoire minimale (sauf exemptions demandeur d'emploi /
  // co-financement employeur — à arbitrer par Will). Évite un RAC à 0 illégal.
  const racFloorEuros = await getQualiopiConfig("cpf_reste_a_charge");
  const racFloorCents = Math.round((typeof racFloorEuros === "number" ? racFloorEuros : 0) * 100);
  const residuel = Math.max(0, coutTotal - montantCpf);
  const resteACharge = residuel > 0 ? residuel : racFloorCents;

  const doc = await generateDocument({
    type: "kit_cpf",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(KitCpfPdf, {
        data: {
          numero,
          dateEmission: formatDateFr(new Date()),
          identite,
          beneficiaire: {
            nom: trainee.nom,
            prenom: trainee.prenom,
          },
          codeCpf,
          intituleFormation: session.titreSession,
          dateDebut: formatDate(new Date(session.dateDebut)),
          dateFin: formatDate(new Date(session.dateFin)),
          montantCpfCents: montantCpf,
          resteAChargeCents: resteACharge,
          coutTotalCents: coutTotal,
        },
      }),
    // ⚠️ `traineeId` fait partie de l'IDENTITÉ de la pièce : ces documents sont
    // établis PAR STAGIAIRE. Sans lui, la détection de régénération marquait
    // « copie » toutes les pièces des stagiaires suivants d'une même session.
    refs: { sessionId: session.id, traineeId: trainee.id },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.kit_cpf.genere",
    targetType: "Enrollment",
    targetId: enrollmentId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Kit France Travail (AIF / POEI / CSP)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le kit dossier France Travail pour un stagiaire.
 * Le dispositif (AIF/POEI/CSP) est lu depuis la session.
 */
export async function genererKitFranceTravailAction(input: {
  enrollmentId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  // Acte ENGAGEANT : kit France Travail (AIF/POEI/CSP).
  const adminSession = await requireHabilitation("deposer_demande_financeur");
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId, rectificationMotif } = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      trainee: { select: { id: true, nom: true, prenom: true } },
      session: {
        select: {
          id: true,
          titreSession: true,
          dateDebut: true,
          dateFin: true,
          montantHtCents: true,
          priseEnChargeMontantCents: true,
          ftDispositif: true,
          numeroDossierOpco: true,
          ftPoeiOffreEmploiNumero: true,
        },
      },
    },
  });
  if (!enrollment) return { error: "Inscription introuvable" };

  const identite = await getOrganismeIdentite();
  const session = enrollment.session;
  const trainee = enrollment.trainee;

  type Dispositif = "AIF" | "POEI" | "CSP";
  const FT_MAP: Record<string, Dispositif> = {
    aif: "AIF",
    poei: "POEI",
    csp: "CSP",
  };
  const dispositif: Dispositif = session.ftDispositif
    ? (FT_MAP[session.ftDispositif] ?? "AIF")
    : "AIF";

  const coutTotal = session.montantHtCents;
  const montantAide = session.priseEnChargeMontantCents ?? 0;
  const resteACharge = Math.max(0, coutTotal - montantAide);

  const doc = await generateDocument({
    type: "kit_france_travail",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(KitFranceTravailPdf, {
        data: {
          numero,
          dateEmission: formatDateFr(new Date()),
          identite,
          dispositif,
          beneficiaire: {
            nom: trainee.nom,
            prenom: trainee.prenom,
          },
          intituleFormation: session.titreSession,
          dateDebut: formatDate(new Date(session.dateDebut)),
          dateFin: formatDate(new Date(session.dateFin)),
          ...(session.numeroDossierOpco !== null && session.numeroDossierOpco !== undefined
            ? { numeroDossierFranceTravail: session.numeroDossierOpco }
            : {}),
          montants: {
            montantAideFranceTravailCents: montantAide,
            resteAChargeCents: resteACharge,
            coutTotalCents: coutTotal,
          },
        },
      }),
    // ⚠️ `traineeId` fait partie de l'IDENTITÉ de la pièce : ces documents sont
    // établis PAR STAGIAIRE. Sans lui, la détection de régénération marquait
    // « copie » toutes les pièces des stagiaires suivants d'une même session.
    refs: { sessionId: session.id, traineeId: trainee.id },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.kit_france_travail.genere",
    targetType: "Enrollment",
    targetId: enrollmentId,
    changes: { documentId: doc.id, numero: doc.numero, dispositif },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Lettre de mission formateur
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère la lettre de mission pour le formateur principal d'une session.
 * Lit les données du formateur via le premier co-formateur.
 */
export async function genererLettreMissionAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      modalite: true,
      ...LIEU_DOCUMENT_SELECT,
      coFormateurs: true,
      formateurPrincipalId: true,
      formationSnapshot: true,
      // `slug` : la clé de résolution du barème (`TrainerCompensationRule.
      // interventionSlug`) — la lettre imprime désormais la rémunération que la
      // paie appliquera, pas le tarif générique de la fiche.
      formation: { select: { slug: true, dureeHeures: true } },
    },
  });
  if (!session) return { error: "Session introuvable" };

  // Durée depuis le snapshot légal (WS5), repli LIVE si legacy.
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);

  // Résolution du formateur principal — FK prioritaire, repli Json legacy.
  const principalTrainerId = resolvePrincipalTrainerId({
    formateurPrincipalId: session.formateurPrincipalId,
    coFormateurs: session.coFormateurs,
  });
  const arr = Array.isArray(session.coFormateurs) ? session.coFormateurs : [];
  const premierRaw = arr[0] as { id?: string; nom?: string; prenom?: string } | undefined;
  let trainer: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    statut: string;
    tarifJourneeHtCents: number | null;
    sousTraitantNda: string | null;
    adresseProfessionnelle: string | null;
  } | null = null;

  if (principalTrainerId) {
    trainer = await prisma.trainer.findUnique({
      where: { id: principalTrainerId },
      select: {
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        statut: true,
        tarifJourneeHtCents: true,
        sousTraitantNda: true,
        adresseProfessionnelle: true,
      },
    });
  }

  const identite = await getOrganismeIdentite();

  // 🔴 REFUS plutôt que fabrication d'un nom.
  //
  // Le repli historique était en cascade : formateur résolu → sinon un nom lu
  // dans le Json brut → sinon LA RAISON SOCIALE DE L'ORGANISME. La dernière
  // branche produisait une lettre de mission désignant « Axion-IA » comme
  // formateur — une pièce d'indicateur 21 qui nomme une personne morale là où
  // elle doit nommer une personne physique.
  //
  // ⚠️ Et la branche du milieu était morte pour toute donnée bien formée :
  // `parseCoFormateurs` n'accepte que `trainerId`, tandis que le repli lisait
  // `id`, `nom` et `prenom` — des champs que les entrées courantes ne portent
  // pas. On tombait donc directement sur la raison sociale.
  //
  // Depuis que la lettre est SIGNABLE, l'incohérence devient visible : le
  // service de signature refuse un signataire non résolvable (il ne scelle
  // jamais une identité fabriquée), si bien que le générateur produisait une
  // pièce que personne ne pouvait signer. Mieux vaut refuser de l'émettre.
  //
  // Impact MESURÉ avant ce changement, pas supposé : une seule session sans
  // formateur principal en production, son `co_formateurs` est vide, et AUCUNE
  // lettre de mission n'a jamais été émise. On retire donc le défaut avant son
  // premier cas réel.
  const nomPrenom = trainer
    ? `${trainer.prenom} ${trainer.nom}`.trim()
    : premierRaw?.prenom && premierRaw?.nom
      ? `${premierRaw.prenom} ${premierRaw.nom}`.trim()
      : "";
  if (nomPrenom === "") {
    return {
      error:
        "Aucun formateur n'est rattaché à cette session : une lettre de mission doit nommer la personne qui reçoit la mission. Désignez le formateur principal, puis régénérez la lettre.",
    };
  }

  // 🔴 Réservée aux SOUS-TRAITANTS (2026-08-01). Le document s'intitule
  // « Lettre de mission formateur sous-traitant » et le générateur ne regardait
  // pas le statut : un salarié recevait la même lettre — sans fondement, son
  // contrat de travail couvre déjà l'animation — et le dirigeant se serait
  // confié une mission à lui-même. (Statut inconnu = formateur legacy résolu
  // depuis le Json seul : on n'invente pas un refus sur une donnée absente.)
  if (trainer !== null) {
    const refus = refusLettreSelonStatut(trainer.statut, nomPrenom);
    if (refus !== null) return { error: refus };
  }

  const tarifJourHt = trainer?.tarifJourneeHtCents ? trainer.tarifJourneeHtCents / 100 : 0;

  // 🔴 La rémunération vient du barème RÉSOLU — le même `resolveRegle` que la
  // paie mensuelle (`statements.ts`). Avant ce branchement, la lettre imprimait
  // le tarif générique de la fiche pendant que la paie appliquait la règle :
  // deux chiffres contradictoires possibles sur une pièce SIGNÉE.
  const regles = principalTrainerId ? await chargerReglesRemuneration(principalTrainerId) : [];
  const remunerations = compresserRemunerations([
    {
      intitule: session.titreSession,
      libelle: libelleRemuneration(
        principalTrainerId
          ? resolveRegle(regles, {
              trainerId: principalTrainerId,
              prestationType: "formation_collective",
              interventionSlug: session.formation.slug,
              date: new Date(session.dateDebut),
            })
          : null,
        trainer?.tarifJourneeHtCents ?? null,
      ),
    },
  ]);

  const doc = await generateDocument({
    type: "lettre_mission",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(LettreMissionPdf, {
        data: {
          numero,
          formateur: {
            nomPrenom,
            email: trainer?.email ?? identite.email,
            ...(trainer?.telephone !== null && trainer?.telephone !== undefined
              ? { telephone: trainer.telephone }
              : {}),
            // Adresse PROFESSIONNELLE — la ligne était systématiquement absente
            // faute de champ en base, sur une pièce qui doit identifier les
            // deux parties.
            ...(trainer?.adresseProfessionnelle ? { adresse: trainer.adresseProfessionnelle } : {}),
            specialite: "Formation Intelligence Artificielle",
            // Sans lui, le gabarit qualifie TOUT intervenant de « mandataire
            // sous-traitant » — faux pour le dirigeant qui anime lui-même.
            ...(trainer?.statut ? { statut: trainer.statut } : {}),
            ...(trainer?.sousTraitantNda !== null && trainer?.sousTraitantNda !== undefined
              ? { siretOuSirenOuNaf: trainer.sousTraitantNda }
              : {}),
          },
          objetMission:
            "Animation de la formation professionnelle continue dans le cadre du programme pédagogique défini par l'organisme de formation.",
          formations: [
            {
              intitule: session.titreSession,
              dateDebut: formatDate(new Date(session.dateDebut)),
              dateFin: formatDate(new Date(session.dateFin)),
              // Le lieu RÉEL prime sur la modalité : c'est là que le formateur
              // doit se rendre. Repli sur la modalité seule quand aucun lieu
              // n'est saisi — comportement historique, jamais un « — » nu.
              lieuOuModalite: formatLieu(session) ?? modaliteLabel(session.modalite),
              dureeHeures: formationDoc.dureeHeures ?? session.formation.dureeHeures,
            },
          ],
          tarifJourHt,
          remunerations,
          dateMission: formatDateFr(new Date()),
        },
        identite,
      }),
    // `trainerId` en plus de la session : c'est lui qui rend la pièce
    // retrouvable et signable sans détour par la session (cf. lettre-cadre).
    refs: { sessionId, ...(principalTrainerId !== null ? { trainerId: principalTrainerId } : {}) },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.lettre_mission.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

/**
 * Refus de la lettre selon le statut du formateur — `null` si elle est due.
 *
 * Le message explique le POURQUOI : un bouton qui refuse sans dire pour qui la
 * pièce existe pousserait l'admin à contourner, pas à comprendre.
 */
function refusLettreSelonStatut(statut: string, nomPrenom: string): string | null {
  if (statut === "salarie") {
    return `${nomPrenom} est enregistré comme salarié : son contrat de travail couvre déjà l'animation, une lettre de mission de sous-traitance n'a pas de fondement pour lui. Elle est réservée aux formateurs sous-traitants.`;
  }
  if (statut === "dirigeant") {
    return `${nomPrenom} est le dirigeant-formateur de l'organisme : il ne peut pas se confier une mission à lui-même par lettre de sous-traitance. Ses compétences se justifient par CV et diplômes (indicateur 21).`;
  }
  return null;
}

/**
 * Règles de rémunération du formateur, converties pour `resolveRegle`.
 * (Conversion Decimal→number : jamais de `Decimal` hors de Prisma.)
 */
async function chargerReglesRemuneration(trainerId: string): Promise<RegleRemuneration[]> {
  const rules = await prisma.trainerCompensationRule.findMany({ where: { trainerId } });
  return rules.map((r) => {
    const base: RegleRemuneration = {
      trainerId: r.trainerId,
      prestationType: r.prestationType,
      interventionSlug: r.interventionSlug,
      model: r.model,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
    };
    if (r.tauxJourneeHtCents !== null) base.tauxJourneeHtCents = r.tauxJourneeHtCents;
    if (r.tauxHoraireHtCents !== null) base.tauxHoraireHtCents = r.tauxHoraireHtCents;
    if (r.forfaitHtCents !== null) base.forfaitHtCents = r.forfaitHtCents;
    if (r.commissionPct !== null) base.commissionPct = r.commissionPct.toNumber();
    return base;
  });
}

/**
 * Une seule ligne quand toutes les formations partagent le même barème —
 * répéter dix fois la même phrase ferait chercher une différence qui n'existe
 * pas. Dès qu'un libellé diffère, chaque formation garde sa ligne nominative.
 */
function compresserRemunerations(lignes: LigneRemuneration[]): LigneRemuneration[] {
  if (lignes.length > 1 && lignes.every((l) => l.libelle === lignes[0]!.libelle)) {
    return [{ intitule: null, libelle: lignes[0]!.libelle }];
  }
  return lignes;
}

/** `yyyy-mm-dd` (input date) → Date UTC minuit. Le schéma zod garantit la forme. */
function dateDepuisIso(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

const lettreCadreListeSchema = z.object({
  sessionId: z.string().uuid(),
  dateDebut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const lettreCadreSchema = lettreCadreListeSchema
  .extend({
    sessionIds: z.array(z.string().uuid()).max(100).default([]),
    // Coachings 1-to-1 (conseil) et audits (Will 2026-08-01 : « on peut avoir
    // des sous-traitants aussi » sur ces prestations). Optionnels — une
    // lettre-cadre peut ne couvrir que des formations, que des coachings, ou un
    // mélange.
    coachingIds: z.array(z.string().uuid()).max(100).default([]),
    auditIds: z.array(z.string().uuid()).max(100).default([]),
  })
  .refine((v) => v.sessionIds.length + v.coachingIds.length + v.auditIds.length > 0, {
    message: "Aucune prestation sélectionnée",
  });

/** Ligne candidate renvoyée à l'écran de composition de la lettre-cadre. */
interface PrestationCandidate {
  id: string;
  numero: string;
  titre: string;
  du: string;
  au: string;
}

/**
 * Prestations candidates à une lettre-CADRE : formations collectives, coachings
 * 1-to-1 (conseil) et audits de la période dont l'intervenant est le formateur
 * principal de la session d'origine.
 *
 * ⚠️ Sessions : pré-filtre SQL large (FK OU affectation), recoupé en mémoire
 * par `resolvePrincipalTrainerId` — le même motif que
 * `lireLettresMissionDuFormateur`, seul le résolveur sait retomber sur le Json
 * legacy. Coachings et audits portent une FK directe, pas de résolveur.
 */
export async function listerSessionsLettreCadreAction(input: {
  sessionId: string;
  dateDebut: string;
  dateFin: string;
}): Promise<
  ActionResult<{
    formateur: string;
    sessions: PrestationCandidate[];
    coachings: PrestationCandidate[];
    audits: PrestationCandidate[];
  }>
> {
  await requireAdminWrite();
  if (isStub()) return { error: "Indisponible en mode build (stub)" };

  const parsed = lettreCadreListeSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, dateDebut, dateFin } = parsed.data;
  if (dateDebut > dateFin) return { error: "La date de début est postérieure à la date de fin." };

  const origine = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { formateurPrincipalId: true, coFormateurs: true },
  });
  if (!origine) return { error: "Session introuvable" };
  const trainerId = resolvePrincipalTrainerId(origine);
  if (trainerId === null) {
    return {
      error:
        "Aucun formateur principal n'est désigné sur cette session : désignez-le d'abord, la lettre-cadre est établie à son nom.",
    };
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { nom: true, prenom: true, statut: true },
  });
  if (!trainer) return { error: "Formateur introuvable" };
  const nomPrenom = `${trainer.prenom} ${trainer.nom}`.trim();
  const refus = refusLettreSelonStatut(trainer.statut, nomPrenom);
  if (refus !== null) return { error: refus };

  const debut = dateDepuisIso(dateDebut);
  const finExclue = dateDepuisIso(dateFin);
  finExclue.setUTCDate(finExclue.getUTCDate() + 1);

  const [candidates, coachings, audits] = await Promise.all([
    prisma.trainingSession.findMany({
      where: {
        dateDebut: { gte: debut, lt: finExclue },
        OR: [{ formateurPrincipalId: trainerId }, { sessionFormateurs: { some: { trainerId } } }],
      },
      orderBy: { dateDebut: "asc" },
      select: {
        id: true,
        numero: true,
        titreSession: true,
        dateDebut: true,
        dateFin: true,
        formateurPrincipalId: true,
        coFormateurs: true,
      },
    }),
    prisma.coachingSession.findMany({
      where: { trainerId, dateSeance: { gte: debut, lt: finExclue } },
      orderBy: { dateSeance: "asc" },
      select: {
        id: true,
        interventionSlug: true,
        dateSeance: true,
        dateSeanceFin: true,
        beneficiaireEntreprise: true,
      },
    }),
    prisma.auditMission.findMany({
      where: { formateurId: trainerId, dateDebut: { gte: debut, lt: finExclue } },
      orderBy: { dateDebut: "asc" },
      select: { id: true, numero: true, titre: true, dateDebut: true, dateFin: true },
    }),
  ]);

  return {
    data: {
      formateur: nomPrenom,
      sessions: candidates
        .filter((s) => resolvePrincipalTrainerId(s) === trainerId)
        .map((s) => ({
          id: s.id,
          numero: s.numero,
          titre: s.titreSession,
          du: formatDate(new Date(s.dateDebut)),
          au: formatDate(new Date(s.dateFin)),
        })),
      coachings: coachings.map((c) => ({
        id: c.id,
        numero: "",
        // L'entreprise, jamais le NOM du bénéficiaire : l'écran de composition
        // n'a pas besoin d'exposer une personne physique.
        titre: `${coachingInterventionLabel(c.interventionSlug)}${
          c.beneficiaireEntreprise ? ` (${c.beneficiaireEntreprise})` : ""
        }`,
        du: formatDate(new Date(c.dateSeance)),
        au: formatDate(new Date(c.dateSeanceFin ?? c.dateSeance)),
      })),
      audits: audits.map((a) => ({
        id: a.id,
        numero: a.numero,
        titre: a.titre,
        du: formatDate(new Date(a.dateDebut)),
        au: formatDate(new Date(a.dateFin)),
      })),
    },
  };
}

/**
 * Génère une lettre de mission-CADRE : UNE lettre, UNE signature du
 * sous-traitant, couvrant toutes les formations cochées de la période.
 *
 * Décision Will 2026-08-01 (« les deux, au choix au moment de générer ») : la
 * lettre par session reste `genererLettreMissionAction`, inchangée ; celle-ci
 * s'y ajoute pour le formateur récurrent — à 200 formateurs, une signature par
 * session ne tient pas.
 *
 * 🔴 La pièce est ancrée par `refs.trainerId`, PAS par une session : c'est ce
 * rattachement que l'espace formateur et l'action de signature lisent. Les
 * sessions couvertes vivent dans `metadata.lettreCadre` — affichage et
 * rapprochement console, jamais l'autorisation.
 *
 * ⚠️ La liste reçue du client est REVALIDÉE session par session : chacune doit
 * avoir pour formateur principal celui de la lettre. Sans ce recoupement, un
 * identifiant étranger glissé dans la requête ferait signer au sous-traitant
 * une formation qui ne lui est pas confiée.
 */
export async function genererLettreMissionCadreAction(input: {
  sessionId: string;
  dateDebut: string;
  dateFin: string;
  sessionIds?: string[];
  coachingIds?: string[];
  auditIds?: string[];
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = lettreCadreSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, dateDebut, dateFin, sessionIds, coachingIds, auditIds } = parsed.data;
  if (dateDebut > dateFin) return { error: "La date de début est postérieure à la date de fin." };

  const origine = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { formateurPrincipalId: true, coFormateurs: true },
  });
  if (!origine) return { error: "Session introuvable" };
  const trainerId = resolvePrincipalTrainerId(origine);
  if (trainerId === null) {
    return {
      error:
        "Aucun formateur principal n'est désigné sur cette session : désignez-le d'abord, la lettre-cadre est établie à son nom.",
    };
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      nom: true,
      prenom: true,
      email: true,
      telephone: true,
      statut: true,
      tarifJourneeHtCents: true,
      sousTraitantNda: true,
      adresseProfessionnelle: true,
    },
  });
  if (!trainer) return { error: "Formateur introuvable" };
  const nomPrenom = `${trainer.prenom} ${trainer.nom}`.trim();
  const refus = refusLettreSelonStatut(trainer.statut, nomPrenom);
  if (refus !== null) return { error: refus };

  // Liste vide = pas de requête : `in: []` rendrait [] de toute façon, et les
  // trois familles sont indépendantes.
  const [sessions, coachings, audits] = await Promise.all([
    sessionIds.length === 0
      ? []
      : prisma.trainingSession.findMany({
          where: { id: { in: sessionIds } },
          orderBy: { dateDebut: "asc" },
          select: {
            id: true,
            numero: true,
            titreSession: true,
            dateDebut: true,
            dateFin: true,
            modalite: true,
            ...LIEU_DOCUMENT_SELECT,
            formateurPrincipalId: true,
            coFormateurs: true,
            formationSnapshot: true,
            formation: { select: { slug: true, dureeHeures: true } },
          },
        }),
    coachingIds.length === 0
      ? []
      : prisma.coachingSession.findMany({
          where: { id: { in: coachingIds } },
          orderBy: { dateSeance: "asc" },
          select: {
            id: true,
            trainerId: true,
            interventionSlug: true,
            dateSeance: true,
            dateSeanceFin: true,
            beneficiaireEntreprise: true,
            ...LIEU_DOCUMENT_SELECT,
          },
        }),
    auditIds.length === 0
      ? []
      : prisma.auditMission.findMany({
          where: { id: { in: auditIds } },
          orderBy: { dateDebut: "asc" },
          select: {
            id: true,
            numero: true,
            titre: true,
            formateurId: true,
            dateDebut: true,
            dateFin: true,
            dureeHeures: true,
            ...LIEU_DOCUMENT_SELECT,
          },
        }),
  ]);
  if (
    sessions.length !== sessionIds.length ||
    coachings.length !== coachingIds.length ||
    audits.length !== auditIds.length
  ) {
    return { error: "Une des prestations sélectionnées est introuvable. Rechargez la liste." };
  }
  // 🔴 Chaque prestation doit appartenir au formateur de la lettre — les
  // sessions via le résolveur (Json legacy), coachings et audits via leur FK.
  const etrangere = sessions.find((s) => resolvePrincipalTrainerId(s) !== trainerId);
  if (etrangere !== undefined) {
    return {
      error: `La session ${etrangere.numero} n'a pas ${nomPrenom} pour formateur principal : elle ne peut pas figurer sur sa lettre de mission.`,
    };
  }
  if (coachings.some((c) => c.trainerId !== trainerId)) {
    return {
      error: `Un des coachings sélectionnés n'est pas animé par ${nomPrenom} : il ne peut pas figurer sur sa lettre de mission.`,
    };
  }
  const auditEtranger = audits.find((a) => a.formateurId !== trainerId);
  if (auditEtranger !== undefined) {
    return {
      error: `L'audit ${auditEtranger.numero} n'est pas confié à ${nomPrenom} : il ne peut pas figurer sur sa lettre de mission.`,
    };
  }

  const identite = await getOrganismeIdentite();
  const regles = await chargerReglesRemuneration(trainerId);

  /** Heures d'un créneau, 0 si la fin manque (le gabarit affichera « — »). */
  const heuresCreneau = (debut: Date, fin: Date | null): number => {
    if (fin === null) return 0;
    const h = (fin.getTime() - debut.getTime()) / 3_600_000;
    return h > 0 ? Math.round(h * 10) / 10 : 0;
  };

  const formations: FormationConfiee[] = [
    ...sessions.map((s) => {
      const formationDoc = readFormationForDocs(s.formationSnapshot, s.formation);
      return {
        intitule: s.titreSession,
        dateDebut: formatDate(new Date(s.dateDebut)),
        dateFin: formatDate(new Date(s.dateFin)),
        lieuOuModalite: formatLieu(s) ?? modaliteLabel(s.modalite),
        dureeHeures: formationDoc.dureeHeures ?? s.formation.dureeHeures,
      };
    }),
    // L'ENTREPRISE bénéficiaire, jamais le nom de la personne accompagnée : la
    // lettre part chez le sous-traitant, elle n'a pas à porter l'identité d'un
    // tiers physique que le protocole AFEST couvre déjà.
    ...coachings.map((c) => ({
      intitule: `Coaching 1-to-1 — ${coachingInterventionLabel(c.interventionSlug)}${
        c.beneficiaireEntreprise ? ` (${c.beneficiaireEntreprise})` : ""
      }`,
      dateDebut: formatDate(new Date(c.dateSeance)),
      dateFin: formatDate(new Date(c.dateSeanceFin ?? c.dateSeance)),
      lieuOuModalite: formatLieu(c) ?? "—",
      dureeHeures: heuresCreneau(new Date(c.dateSeance), c.dateSeanceFin),
    })),
    ...audits.map((a) => ({
      intitule: `Audit — ${a.titre}`,
      dateDebut: formatDate(new Date(a.dateDebut)),
      dateFin: formatDate(new Date(a.dateFin)),
      lieuOuModalite: formatLieu(a) ?? "—",
      dureeHeures: a.dureeHeures ?? 0,
    })),
  ];
  const remunerations = compresserRemunerations([
    ...sessions.map((s) => ({
      intitule: s.titreSession,
      libelle: libelleRemuneration(
        resolveRegle(regles, {
          trainerId,
          prestationType: "formation_collective",
          interventionSlug: s.formation.slug,
          date: new Date(s.dateDebut),
        }),
        trainer.tarifJourneeHtCents,
      ),
    })),
    ...coachings.map((c) => ({
      intitule: `Coaching 1-to-1 — ${coachingInterventionLabel(c.interventionSlug)}`,
      libelle: libelleRemuneration(
        resolveRegle(regles, {
          trainerId,
          prestationType: "coaching_1to1",
          interventionSlug: c.interventionSlug,
          date: new Date(c.dateSeance),
        }),
        trainer.tarifJourneeHtCents,
      ),
    })),
    ...audits.map((a) => ({
      intitule: `Audit — ${a.titre}`,
      libelle: libelleRemuneration(
        resolveRegle(regles, {
          trainerId,
          prestationType: "audit",
          interventionSlug: null,
          date: new Date(a.dateDebut),
        }),
        trainer.tarifJourneeHtCents,
      ),
    })),
  ]);

  const doc = await generateDocument({
    type: "lettre_mission",
    buildElement: (numero) =>
      React.createElement(LettreMissionPdf, {
        data: {
          numero,
          formateur: {
            nomPrenom,
            email: trainer.email,
            ...(trainer.telephone !== null ? { telephone: trainer.telephone } : {}),
            ...(trainer.adresseProfessionnelle ? { adresse: trainer.adresseProfessionnelle } : {}),
            specialite: "Formation Intelligence Artificielle",
            // Sans lui, le gabarit qualifie TOUT intervenant de « mandataire
            // sous-traitant » — faux pour le dirigeant qui anime lui-même.
            ...(trainer?.statut ? { statut: trainer.statut } : {}),
            ...(trainer.sousTraitantNda !== null
              ? { siretOuSirenOuNaf: trainer.sousTraitantNda }
              : {}),
          },
          objetMission:
            "Animation et réalisation des prestations listées ci-dessous (formations professionnelles continues, accompagnements individuels, audits le cas échéant), dans le cadre des programmes et référentiels définis par l'organisme de formation.",
          periode: {
            du: formatDateFr(dateDepuisIso(dateDebut)),
            au: formatDateFr(dateDepuisIso(dateFin)),
          },
          formations,
          tarifJourHt: trainer.tarifJourneeHtCents ? trainer.tarifJourneeHtCents / 100 : 0,
          remunerations,
          dateMission: formatDateFr(new Date()),
        },
        identite,
      }),
    refs: { trainerId },
    metadata: {
      lettreCadre: {
        du: dateDebut,
        au: dateFin,
        sessionIds: sessions.map((s) => s.id),
        coachingIds: coachings.map((c) => c.id),
        auditIds: audits.map((a) => a.id),
      },
    },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.lettre_mission_cadre.genere",
    targetType: "Trainer",
    targetId: trainerId,
    changes: {
      documentId: doc.id,
      numero: doc.numero,
      du: dateDebut,
      au: dateFin,
      sessions: sessions.length,
      coachings: coachings.length,
      audits: audits.length,
    },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. Règlement intérieur (L.6352-3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le règlement intérieur des stagiaires.
 * Document de session (joint à la convocation).
 */
export async function genererReglementInterieurAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!session) return { error: "Session introuvable" };

  const identite = await getOrganismeIdentite();
  const dateVersion = formatDateFr(new Date());

  const doc = await generateDocument({
    type: "reglement_interieur",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(ReglementInterieurPdf, {
        data: {
          numero,
          dateVersion,
        },
        identite,
      }),
    refs: { sessionId },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.reglement_interieur.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 13 bis. Programme de l'action de formation (annexe de la convention)
// ─────────────────────────────────────────────────────────────────────────────

const NIVEAU_LABELS: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
  tous_niveaux: "Tous niveaux",
};

/**
 * Libellé de la sanction de l'action (art. L.6353-1 : « modalités de sanction »).
 *
 * ⚠️ On ne promet JAMAIS une certification que l'action ne délivre pas. Une
 * formation non certifiante sanctionne par une attestation de fin de formation
 * — c'est exact, opposable, et suffisant. Annoncer « certification » sur une
 * action `aucune` serait une allégation trompeuse au sens du Code de la
 * consommation, sur la pièce même qui est annexée au contrat.
 */
function sanctionLabel(certificationType: string | null): string {
  if (certificationType === "rncp") {
    return "Certification enregistrée au Répertoire national des certifications professionnelles (RNCP).";
  }
  if (certificationType === "rs") {
    return "Certification enregistrée au Répertoire spécifique (RS).";
  }
  return "Attestation de fin de formation mentionnant les objectifs, la nature, la durée de l'action et les résultats de l'évaluation des acquis.";
}

/**
 * Génère le programme de l'action de formation d'une session.
 *
 * 🔴 C'est l'annexe que la convention annonce en section « Documents annexés »
 * depuis l'origine, et que rien ne produisait — pour aucune des formations du
 * catalogue. C'est aussi l'une des trois pièces exigées à l'appui de la
 * déclaration d'activité (art. R.6351-5), avec la première convention signée et
 * la liste des intervenants.
 *
 * Les données pédagogiques viennent du SNAPSHOT via `readFormationForDocs`,
 * exactement comme la convention : les deux pièces d'un même dossier décrivent
 * ainsi la même action, même si la formation est refondue plus tard.
 */
export async function genererProgrammeAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      titreSession: true,
      modalite: true,
      formationSnapshot: true,
      ...LIEU_DOCUMENT_SELECT,
      formation: {
        select: {
          titre: true,
          dureeHeures: true,
          objectifsPedagogiques: true,
          programmeDetaille: true,
          methodesPedagogiques: true,
          moyensTechniques: true,
          versionProgramme: true,
          certificationType: true,
          prerequis: true,
          niveau: true,
          accessibleHandicap: true,
          seuilReussitePct: true,
          offreSite: { select: { publicViseFr: true } },
        },
      },
    },
  });
  if (!session) return { error: "Session introuvable" };

  const identite = await getOrganismeIdentite();
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const objectifs = parseObjectifs(formationDoc.objectifsPedagogiques);
  const modules = lireModulesProgramme(formationDoc.programmeDetaille);

  // Les modalités d'évaluation ne sont pas un champ libre de la formation :
  // elles décrivent le dispositif RÉEL de la plateforme (positionnement amont,
  // évaluation des acquis, satisfaction), dont le seuil de réussite est le seul
  // paramètre variable. Les inventer par formation les ferait diverger de ce que
  // le système produit effectivement.
  const seuil = session.formation.seuilReussitePct;
  const modalitesEvaluation =
    `Évaluation des prérequis et du niveau par questionnaire de positionnement avant l'entrée en formation. ` +
    `Évaluation des acquis en fin d'action au regard des objectifs pédagogiques ci-dessus ` +
    `(seuil de réussite : ${seuil} %). ` +
    `Recueil de la satisfaction des participants à l'issue de l'action.`;

  const doc = await generateDocument({
    type: "programme",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    identite,
    buildElement: (numero) =>
      React.createElement(ProgrammeFormationPdf, {
        data: {
          numero,
          intitule: formationDoc.titre ?? session.titreSession,
          ...(formationDoc.versionProgramme
            ? { versionProgramme: formationDoc.versionProgramme }
            : {}),
          dateEdition: formatDateFr(new Date()),
          dureeHeures: formationDoc.dureeHeures ?? session.formation.dureeHeures,
          modalite: modaliteLabel(session.modalite),
          lieu: resolveLieuDocument(session, identite),
          publicVise: session.formation.offreSite.publicViseFr,
          prerequis: session.formation.prerequis,
          niveau: NIVEAU_LABELS[session.formation.niveau] ?? session.formation.niveau,
          accessibleHandicap: session.formation.accessibleHandicap,
          objectifs,
          modules,
          methodesPedagogiques:
            formationDoc.methodesPedagogiques ?? session.formation.methodesPedagogiques,
          ...(session.formation.moyensTechniques
            ? { moyensTechniques: session.formation.moyensTechniques }
            : {}),
          modalitesEvaluation,
          sanction: sanctionLabel(formationDoc.certificationType),
          ...(identite.referentHandicapEmail
            ? { referentHandicapEmail: identite.referentHandicapEmail }
            : {}),
        },
        identite,
      }),
    refs: { sessionId },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.programme.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: {
      documentId: doc.id,
      numero: doc.numero,
      // Traçabilité utile en cas de contestation : d'où vient ce qui est imprimé,
      // et le découpage était-il structuré au moment de l'édition.
      source: formationDoc.source,
      nbModules: modules.length,
    },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 13 bis. Organisation de l'action (art. R.6351-5, indicateurs 9 et 12)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Le PROGRAMME dit ce qui est enseigné ; cette pièce dit QUAND, OÙ et COMMENT.
 * Le calendrier vient de `session_jours` — les mêmes horaires que l'émargement,
 * pour que deux pièces d'un même dossier ne se contredisent jamais.
 */
export async function genererOrganisationActionAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      modalite: true,
      dateDebut: true,
      dateFin: true,
      dureeReelleHeures: true,
      nbParticipantsPrevus: true,
      ...LIEU_DOCUMENT_SELECT,
      formation: { select: { dureeHeures: true } },
      formateurPrincipal: { select: { prenom: true, nom: true } },
      jours: {
        orderBy: { date: "asc" },
        select: {
          date: true,
          heureDebut: true,
          heureFin: true,
          horairesConfirmes: true,
          trainer: { select: { prenom: true, nom: true } },
        },
      },
    },
  });
  if (!session) return { error: "Session introuvable" };

  const identite = await getOrganismeIdentite();

  const formateurPrincipal = session.formateurPrincipal
    ? `${session.formateurPrincipal.prenom} ${session.formateurPrincipal.nom}`
    : "";

  const jours = session.jours.map((j) => ({
    date: formatDate(j.date),
    heureDebut: j.heureDebut,
    heureFin: j.heureFin,
    horairesConfirmes: j.horairesConfirmes,
    formateur: j.trainer ? `${j.trainer.prenom} ${j.trainer.nom}` : "",
  }));

  // Rythme lisible, calculé depuis le calendrier réel — jamais saisi à la main.
  // « Consécutives » = aucun trou calendaire ; un week-end au milieu suffit à
  // basculer sur « réparties », ce qui est exactement l'information attendue.
  const nbJours = session.jours.length;
  let rythme: string;
  if (nbJours === 0) {
    rythme = `Du ${formatDate(session.dateDebut)} au ${formatDate(session.dateFin)} (calendrier détaillé non arrêté).`;
  } else if (nbJours === 1) {
    rythme = `1 journée, le ${jours[0]!.date} (${jours[0]!.heureDebut} – ${jours[0]!.heureFin}).`;
  } else {
    const premier = session.jours[0]!.date.getTime();
    const dernier = session.jours[nbJours - 1]!.date.getTime();
    const etendueJours = Math.round((dernier - premier) / 86_400_000) + 1;
    const repartition = etendueJours === nbJours ? "consécutives" : "réparties";
    rythme = `${nbJours} journées ${repartition}, du ${jours[0]!.date} au ${jours[nbJours - 1]!.date}.`;
  }

  const doc = await generateDocument({
    type: "organisation_action",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    identite,
    buildElement: (numero) =>
      React.createElement(OrganisationActionPdf, {
        data: {
          numero,
          intitule: session.titreSession,
          numeroSession: session.numero,
          dateEdition: formatDateFr(new Date()),
          dureeHeures: session.dureeReelleHeures ?? session.formation.dureeHeures,
          modalite: modaliteLabel(session.modalite),
          lieu: resolveLieuDocument(session, identite),
          effectifPrevu: session.nbParticipantsPrevus,
          jours,
          rythme,
          formateurPrincipal,
          ...(identite.referentHandicapEmail
            ? { referentHandicapEmail: identite.referentHandicapEmail }
            : {}),
        },
        identite,
      }),
    refs: { sessionId },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.organisation_action.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero, nbJours },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. Livret d'accueil stagiaire
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le livret d'accueil stagiaire pour une session.
 * Les contacts pédagogiques sont lus depuis la SiteSetting ou depuis le
 * formateur principal de la session.
 */
export async function genererLivretAccueilAction(input: {
  sessionId: string;
  rectificationMotif?: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, rectificationMotif } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, coFormateurs: true, formateurPrincipalId: true },
  });
  if (!session) return { error: "Session introuvable" };

  const identite = await getOrganismeIdentite();

  // Contact pédagogique — formateur principal ou identité OF
  const formateurNom = await resolveFormateurNom(
    { formateurPrincipalId: session.formateurPrincipalId, coFormateurs: session.coFormateurs },
    identite.raisonSociale,
  );
  const dateVersion = formatDateFr(new Date());

  const doc = await generateDocument({
    type: "livret_accueil",
    // Régénération motivée = RECTIFICATION, pas duplicata (cf. `rectificationMotif`).
    ...(rectificationMotif !== undefined ? { rectificationMotif } : {}),
    buildElement: (numero) =>
      React.createElement(LivretAccueilPdf, {
        data: {
          numero,
          contactPedagogique: {
            nomPrenom: formateurNom,
            email: identite.email,
            ...(identite.telephone ? { telephone: identite.telephone } : {}),
          },
          dateVersion,
        },
        identite,
      }),
    refs: { sessionId },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.livret_accueil.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. Inventaire des moyens pédagogiques (A14 — off.17/18/19)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère l'inventaire des moyens pédagogiques et techniques (doc A14).
 * Document officiel numéroté (AXI-FORM) — snapshot de la table
 * `moyens_pedagogiques` à date (actifs ET retirés, statut affiché : la
 * traçabilité des moyens retirés est une valeur d'audit).
 */
export async function genererInventaireMoyensAction(): Promise<
  ActionResult<{ documentId: string; numero: string }>
> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const moyens = await listMoyens({ take: 1000 });
  if (moyens.length === 0) {
    return { error: "Aucun moyen pédagogique enregistré — inventaire vide non générable" };
  }

  const identite = await getOrganismeIdentite();
  const dateEdition = formatDateFr(new Date());

  const doc = await generateDocument({
    type: "inventaire_moyens",
    buildElement: (numero) =>
      React.createElement(InventaireMoyensPdf, {
        data: {
          numero,
          dateEdition,
          moyens: moyens.map((m) => ({
            categorie: m.categorie,
            libelle: m.libelle,
            description: m.description,
            localisation: m.localisation,
            actif: m.actif,
            dateVerification: m.dateVerification
              ? m.dateVerification.toLocaleDateString("fr-FR")
              : "",
          })),
        },
        identite,
      }),
  });

  await logQualiopiActivity({
    action: "qualiopi.document.inventaire_moyens.genere",
    targetType: "DocumentGenere",
    targetId: doc.id,
    changes: { documentId: doc.id, numero: doc.numero, nbMoyens: moyens.length },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 15 bis. Autorisation de captation (art. 9 C. civ. + RGPD)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Autorisation d'image et de voix d'UN stagiaire, pour UNE action.
 *
 * 🔴 Pièce SÉPARÉE des contrats à dessein. Un consentement doit être LIBRE :
 * enfoui dans la convention, le refus serait indissociable du refus de la
 * formation, et la CNIL écarte les consentements qui conditionnent l'accès à un
 * service. La pièce dit d'ailleurs noir sur blanc que refuser n'a aucune
 * conséquence — c'est cette phrase qui la rend valable.
 *
 * ⚠️ Les finalités sont ÉNUMÉRÉES, jamais génériques : « toute utilisation par
 * l'organisme » n'est pas un consentement spécifique, c'est un blanc-seing, et
 * il est nul. Les valeurs par défaut couvrent les usages réels de l'organisme ;
 * l'appelant peut les restreindre, jamais les remplacer par un mot creux.
 */
export async function genererAutorisationCaptationAction(input: {
  enrollmentId: string;
  finalites?: string[];
  supports?: string[];
  dureeAnnees?: number;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = z
    .object({
      enrollmentId: z.string().uuid(),
      finalites: z.array(z.string().min(3).max(200)).max(10).optional(),
      supports: z.array(z.string().min(3).max(200)).max(10).optional(),
      dureeAnnees: z.number().int().min(1).max(10).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId, finalites, supports, dureeAnnees } = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      trainee: { select: { id: true, nom: true, prenom: true, entreprise: true } },
      session: {
        select: {
          id: true,
          titreSession: true,
          dateDebut: true,
          ...LIEU_DOCUMENT_SELECT,
        },
      },
    },
  });
  if (!enrollment) return { error: "Inscription introuvable" };

  const { trainee, session } = enrollment;
  const identite = await getOrganismeIdentite();

  const doc = await generateDocument({
    type: "autorisation_captation",
    identite,
    buildElement: (numero) =>
      React.createElement(AutorisationCaptationPdf, {
        data: {
          numero,
          personne: {
            nomPrenom: `${trainee.prenom} ${trainee.nom}`,
            qualite: "Stagiaire",
            ...(trainee.entreprise ? { entreprise: trainee.entreprise } : {}),
          },
          intitule: session.titreSession,
          dateAction: formatDate(session.dateDebut),
          lieu: resolveLieuDocument(session, identite),
          dateEdition: formatDateFr(new Date()),
          finalites: finalites ?? [
            "Illustrer les supports de formation et les comptes rendus pédagogiques de l'organisme",
            "Améliorer la qualité des prestations par l'analyse interne des séances",
            "Présenter l'activité de l'organisme sur son site internet et ses supports de communication",
          ],
          supports: supports ?? [
            "Supports pédagogiques et documents internes de l'organisme",
            "Site internet de l'organisme",
            "Comptes de l'organisme sur les réseaux sociaux professionnels",
          ],
          dureeAnnees: dureeAnnees ?? 3,
        },
        identite,
      }),
    // `traineeId` fait partie de l'IDENTITÉ de la pièce : un consentement est
    // individuel. Sans lui, la détection de régénération marquerait « copie »
    // les autorisations des stagiaires suivants d'une même session.
    refs: { sessionId: session.id, traineeId: trainee.id },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.autorisation_captation.genere",
    targetType: "Enrollment",
    targetId: enrollmentId,
    changes: { documentId: doc.id, numero: doc.numero, traineeId: trainee.id },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 15 ter. Liste des formateurs et qualifications (R.6351-5, indicateur 21)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La LISTE des intervenants — à ne pas confondre avec `cv_formateur`, qui est
 * une FICHE par personne. Le formulaire de déclaration d'activité et
 * l'indicateur 21 réclament une liste : qui intervient, à quel titre, en lien
 * avec quelles prestations, sous quel lien contractuel.
 *
 * 🔴 Seuls les intervenants ACTIFS sont listés. Un formateur désactivé
 * n'intervient plus ; le faire figurer sur une pièce qui décrit l'effectif
 * courant serait une déclaration inexacte, dans le sens le plus embarrassant —
 * annoncer des moyens humains dont on ne dispose pas.
 */
export async function genererListeFormateursAction(): Promise<
  ActionResult<{ documentId: string; numero: string }>
> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const trainers = await listTrainers({ actifOnly: true });
  if (trainers.length === 0) {
    return {
      error:
        "Aucun intervenant actif enregistré — une liste vide ne prouverait aucun moyen humain. Renseignez au moins un formateur avant de générer la liste.",
    };
  }

  // Intitulés des formations habilitées, résolus en UNE requête pour tous les
  // intervenants : un `findMany` par formateur ferait N+1 sur une page admin.
  const tousIds = [...new Set(trainers.flatMap((t) => t.formationIdsHabilites))];
  const formations =
    tousIds.length > 0
      ? await prisma.formation.findMany({
          where: { id: { in: tousIds } },
          select: { id: true, titre: true },
        })
      : [];
  const titreParId = new Map(formations.map((f) => [f.id, f.titre]));

  // Un CV SOURCE validé, jamais `Trainer.cvUrl` : ce dernier pointe vers la
  // FICHE produite par l'organisme, qui ne prouve rien sur les compétences —
  // c'est le raisonnement déjà tenu par `genererCvFormateurAction`.
  const cvParTrainer = new Map<string, number>();
  const cvs = await prisma.trainerDocument.groupBy({
    by: ["trainerId"],
    where: { type: "cv", statutValidation: "valide" },
    _count: { _all: true },
  });
  for (const c of cvs) cvParTrainer.set(c.trainerId, c._count._all);

  const identite = await getOrganismeIdentite();

  const doc = await generateDocument({
    type: "liste_formateurs",
    identite,
    buildElement: (numero) =>
      React.createElement(ListeFormateursPdf, {
        data: {
          numero,
          dateEdition: formatDateFr(new Date()),
          formateurs: trainers.map((t) => {
            const domaines = Array.isArray(t.domainesCompetences)
              ? (t.domainesCompetences as unknown[]).filter(
                  (d): d is string => typeof d === "string",
                )
              : [];
            return {
              nomPrenom: `${t.prenom} ${t.nom}`,
              statut: t.statut,
              domaines,
              nbHabilitations: t.nbHabilitations,
              // Trois suffisent à montrer le LIEN avec les prestations : la
              // liste exhaustive de 57 intitulés noierait la pièce.
              exemplesHabilitations: t.formationIdsHabilites
                .map((id) => titreParId.get(id))
                .filter((titre): titre is string => typeof titre === "string")
                .slice(0, 3),
              cvAuDossier: (cvParTrainer.get(t.id) ?? 0) > 0,
              ...(t.sousTraitantNda ? { sousTraitantNda: t.sousTraitantNda } : {}),
              depuis: t.dateEmbauche ? formatDate(t.dateEmbauche) : "",
            };
          }),
        },
        identite,
      }),
  });

  await logQualiopiActivity({
    action: "qualiopi.document.liste_formateurs.genere",
    targetType: "DocumentGenere",
    targetId: doc.id,
    changes: { documentId: doc.id, numero: doc.numero, nbFormateurs: trainers.length },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 16. Contrat de sous-traitance (indicateur 27 — L.6316-3)
// ─────────────────────────────────────────────────────────────────────────────

const sousTraitantIdSchema = z.object({ sousTraitantId: z.string().uuid() });

/**
 * Génère le contrat de sous-traitance écrit d'un sous-traitant du registre
 * (indicateur 27). Précise les missions confiées (depuis `objetPrestation`) et
 * porte la clause de vérification de la conformité RNQ (la date de vérification
 * data.gouv.fr est reportée depuis le registre). Document officiel numéroté
 * (AXI-FORM).
 *
 * La rémunération en honoraires n'est pas stockée au registre : une modalité par
 * défaut (facturation par mission) est portée au contrat, à affiner par l'OF.
 */
export async function genererContratSousTraitanceAction(input: {
  sousTraitantId: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sousTraitantIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sousTraitantId } = parsed.data;

  const sousTraitant = await getSousTraitant(sousTraitantId);
  if (!sousTraitant) return { error: "Sous-traitant introuvable" };

  const identite = await getOrganismeIdentite();

  // Missions : `objetPrestation` peut contenir plusieurs lignes (une par mission).
  const missions = sousTraitant.objetPrestation
    .split("\n")
    .map((m) => m.trim())
    .filter((m) => m.length > 0);

  const doc = await generateDocument({
    type: "contrat_sous_traitance",
    identite,
    // 🔴 Sans ce rattachement, la pièce n'était reliée au sous-traitant par RIEN :
    // impossible, depuis un `documents_generes.id`, de savoir à qui adresser le
    // lien de signature. Le contact ajouté sur la fiche serait resté
    // inatteignable.
    refs: { sousTraitantId },
    buildElement: (numero) =>
      React.createElement(ContratSousTraitancePdf, {
        data: {
          numero,
          sousTraitant: {
            nom: sousTraitant.nom,
            ...(sousTraitant.siret !== null ? { siret: sousTraitant.siret } : {}),
            ...(sousTraitant.nda !== null ? { nda: sousTraitant.nda } : {}),
          },
          missions,
          dateDebut: formatDateFr(sousTraitant.contratSigneAt ?? new Date()),
          remuneration:
            "Honoraires précisés par mission (devis / bon de commande), facturés après réalisation.",
          conformiteVerifieeAt: sousTraitant.verifieDataGouvAt
            ? formatDateFr(new Date(sousTraitant.verifieDataGouvAt))
            : "",
          dateContrat: formatDateFr(new Date()),
        },
        identite,
      }),
  });

  await logQualiopiActivity({
    action: "qualiopi.document.contrat_sous_traitance.genere",
    targetType: "SousTraitant",
    targetId: sousTraitantId,
    changes: { documentId: doc.id, numero: doc.numero },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fiche formateur versée au dossier de preuves (ind. 21)
// ─────────────────────────────────────────────────────────────────────────────

const trainerIdSchema = z.object({ trainerId: z.string().uuid() });

/** Libellés des actions de développement des compétences (ind. 22). */
const DEV_ACTION_LABELS: Record<string, string> = {
  entretien_professionnel: "Entretien professionnel",
  formation_suivie: "Formation suivie",
  veille: "Veille",
  autre: "Autre",
};

/**
 * Verse la fiche formateur au dossier de preuves et ferme la boucle ind. 21.
 *
 * À distinguer de `genererCvFormateurAction` (`exports-pdf.ts`), qui produit un
 * PDF ÉPHÉMÈRE téléchargé par le navigateur, sans numéro ni rétention. Ici le
 * document est officiel : numéro séquentiel immuable, hash SHA-256, stockage R2,
 * conservation — et surtout `Trainer.cvUrl` pointe ensuite vers sa route de
 * téléchargement stable, ce qui rend l'indicateur 21 couvert.
 *
 * L'indicateur 21 est à non-conformité MAJEURE même en cas de manquement partiel :
 * sa couverture (`conformite-service.ts`) exige un formateur actif dont `cvUrl`
 * est non nul et `cvUploadedAt` de moins de 24 mois. Les deux sont posés ici.
 *
 * ⚠️ Le référentiel exige que la MAÎTRISE des compétences soit « vérifiée par le
 * prestataire », pas seulement qu'un CV existe. Ce document matérialise cette
 * vérification en rattachant explicitement les compétences aux formations
 * habilitées ; il ne dispense pas de tenir cette vérification à jour.
 */
export async function verserFicheFormateurAction(input: {
  trainerId: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  // Acte ENGAGEANT : la fiche formateur materialise la verification des competences (ind. 21/22).
  const adminSession = await requireHabilitation("habiliter_formateur");
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = trainerIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { trainerId } = parsed.data;

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      id: true,
      actif: true,
      nom: true,
      prenom: true,
      email: true,
      telephone: true,
      statut: true,
      cvUrl: true,
      domainesCompetences: true,
      formationsHabilitees: true,
      dateEmbauche: true,
      // 2026-08-10 : `afestHabiliteAt` n'est plus lu — le bloc « Habilitation
      // AFEST » a été retiré de la fiche formateur (1-to-1 = conseil, décision Will).
      sousTraitantNda: true,
      adresseProfessionnelle: true,
      sousTraitantVerifieAt: true,
    },
  });
  if (!trainer) return { error: "Formateur introuvable" };

  // Un formateur désactivé ne compte pas pour l'indicateur 21 (`conformite-service`
  // filtre sur `actif: true`) : verser sa fiche ne couvrirait rien et laisserait
  // une pièce orpheline au dossier.
  if (!trainer.actif) {
    return { error: "Formateur désactivé : réactivez-le avant de verser sa fiche." };
  }

  // Titres des formations habilitées, lus depuis `TrainerHabilitation` — la source
  // qui fait foi pour la garde d'assignation.
  //
  // 🔴 Audit certification 2026-07-25 (F11) : cette résolution interrogeait
  // `formation.id IN trainer.formationsHabilitees`, or la colonne legacy contient
  // des SLUGS en production. Elle ne résolvait donc RIEN, et le CV formateur —
  // pièce de preuve de l'indicateur 21 — sortait sans aucune habilitation, pendant
  // que la liste des formateurs en annonçait 33. Deux pièces du même dossier se
  // contredisaient.
  //
  // 🔴 Audit blanc 2026-08-15 : cette requête ne portait AUCUN filtre de statut.
  // La fiche versée au dossier énumérait 57 formations habilitées quand le
  // catalogue en comptait 22 — une trentaine d'intitulés retirés de l'offre y
  // figuraient encore. La pièce remise à l'auditrice habilitait donc
  // l'intervenant sur des prestations qui n'existent plus, et sur-déclarait son
  // périmètre de 159 %, alors que la liste se compare directement au catalogue.
  //
  // `not: "archive"` plutôt que `= "actif"` : le statut `publie` désigne une
  // formation bel et bien à l'offre, l'écarter sous-déclarerait le périmètre —
  // l'erreur symétrique, tout aussi fausse devant un auditeur. Même doctrine que
  // `listFormationOptions` (`remuneration/rules-queries.ts`) et que le Formation
  // Engine.
  //
  // ⚠️ Le filtre ne supprime RIEN en base : la ligne `TrainerHabilitation`
  // subsiste et réapparaîtra si la formation est désarchivée. Il n'écarte du
  // DOCUMENT que ce qui n'est plus proposé.
  const habilitations = await prisma.trainerHabilitation.findMany({
    where: { trainerId: trainer.id, formation: { statut: { not: "archive" } } },
    select: { formation: { select: { titre: true } } },
    orderBy: { formation: { titre: "asc" } },
  });
  const titresHabilitations: string[] = habilitations.map((h) => h.formation.titre);

  // Actions d'entretien / développement des compétences (ind. 22).
  //
  // 🔴 Audit blanc 2026-08-15 : la mention légale au pied de la fiche affirmait
  // « synthétise […] l'entretien de ces compétences (indicateur 22) » sans en
  // restituer UNE SEULE ligne. Une pièce qui annonce une preuve qu'elle ne porte
  // pas est pire qu'une pièce muette : elle oriente l'auditeur vers un constat.
  // Les actions sont donc listées, et leur absence est écrite noir sur blanc
  // plutôt que passée sous silence (`[]` → section rendue avec le constat).
  const actionsDeveloppementRaw = await prisma.trainerDevelopmentAction.findMany({
    where: { trainerId: trainer.id },
    orderBy: { dateAction: "desc" },
    // Borne haute défensive : la fiche est une synthèse, pas un journal. 50
    // lignes couvrent très largement les 3 ans de cycle de certification.
    take: 50,
    select: { type: true, dateAction: true, description: true },
  });
  const actionsDeveloppement = actionsDeveloppementRaw.map((a) => ({
    date: formatDateFr(a.dateAction),
    type: DEV_ACTION_LABELS[a.type] ?? a.type,
    description: a.description,
  }));

  const identite = await getOrganismeIdentite();
  const maintenant = new Date();

  // `cvJoint` = un CV SOURCE est-il versé au dossier du formateur ?
  // Surtout PAS `trainer.cvUrl != null` : au premier versement ce champ est encore
  // nul, la fiche imprimerait donc « CV non joint »… alors qu'elle EST la pièce,
  // et `cvUrl` pointera vers elle une seconde plus tard. Le même document
  // affirmerait deux choses opposées selon l'ordre des clics.
  const nbCvSource = await prisma.trainerDocument.count({
    where: { trainerId, type: "cv", statutValidation: "valide" },
  });

  // 🔴 #1 — off.21 est une NON-CONFORMITÉ MAJEURE : « la maîtrise des compétences
  // des intervenants est VÉRIFIÉE ». Verser une fiche VIDE (aucune compétence, aucune
  // habilitation, aucun CV source) posait quand même `cvUrl` → l'indicateur passait
  // VERT sur un clic, sans rien prouver. On refuse : une fiche qui ne documente rien
  // ne peut pas attester d'une maîtrise. ⚠️ NOTE JURISTE : que des compétences
  // SAISIES constituent une maîtrise « vérifiée » reste un arbitrage (le contrôle
  // peut exiger des pièces sources) — cette garde n'écarte que le cas totalement vide.
  const aDesCompetences =
    Array.isArray(trainer.domainesCompetences) && trainer.domainesCompetences.length > 0;
  // 🔴 Lit `titresHabilitations` — ce que la fiche IMPRIME — et non le tableau
  // legacy `trainer.formationsHabilitees`, qui compte aussi les formations
  // archivées (et, historiquement, des ids orphelins). Sur cet écart la garde ne
  // gardait plus rien : un formateur habilité sur 30 formations toutes retirées
  // du catalogue la franchissait, et la fiche sortait sans une seule
  // habilitation tout en posant `cvUrl` — indicateur 21 vert sur une pièce vide.
  const aDesHabilitations = titresHabilitations.length > 0;
  if (!aDesCompetences && !aDesHabilitations && nbCvSource === 0) {
    return {
      error:
        "Fiche non versée : ce formateur n'a ni domaine de compétence, ni habilitation sur une formation du catalogue en vigueur, ni CV source. Renseignez sa maîtrise (indicateur 21) avant de verser sa fiche au dossier.",
    };
  }

  const data = {
    ...buildCvFormateurData(trainer, titresHabilitations, maintenant),
    // Écrase la déduction faite depuis `cvUrl` : ici on COMPTE les CV sources
    // validés, la seule lecture qui ne confonde pas un CV téléversé avec la
    // fiche que cette action s'apprête à produire.
    cvJoint: nbCvSource > 0,
    pieceCompetences: nbCvSource > 0 ? ("cv_televerse" as const) : ("fiche_organisme" as const),
    actionsDeveloppement,
  };

  let doc: { id: string; numero: string };
  try {
    doc = await generateDocument({
      type: "cv_formateur",
      buildElement: () => React.createElement(CvFormateurPdf, { data, identite }),
      identite,
    });
  } catch (err) {
    // `generateDocument` peut lever : identité d'organisme incomplète, échec de
    // rendu react-pdf, R2 indisponible. Sans ce filet, l'exception remontait
    // brute au client React et l'admin voyait une erreur générique au lieu de
    // la cause — alors que toutes les autres actions du fichier retournent
    // `{ error }`.
    return {
      error:
        err instanceof Error
          ? `Génération de la fiche impossible : ${err.message}`
          : "Génération de la fiche impossible.",
    };
  }

  // Fermeture de la boucle ind. 21 : `cvUrl` pointe vers la route stable de
  // téléchargement du document (signature R2 à la demande), et non vers une URL
  // signée qui expirerait, ni vers une clé R2 brute illisible au manifeste d'audit.
  //
  // URL ABSOLUE : `updateTrainerSchema` valide `cvUrl` en `z.string().url()`, et
  // le manifeste d'audit imprime cette valeur telle quelle pour l'auditeur — un
  // chemin relatif y serait non résolvable.
  const baseUrl = (process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com").replace(
    /\/+$/,
    "",
  );
  try {
    await prisma.trainer.update({
      where: { id: trainerId },
      data: {
        cvUrl: `${baseUrl}/api/qualiopi/documents/${doc.id}`,
        cvUploadedAt: maintenant,
      },
    });
  } catch {
    // Le document EXISTE désormais au dossier (numéro consommé, PDF conservé)
    // mais la boucle n'est pas fermée : l'indicateur 21 restera non couvert.
    // On le dit explicitement plutôt que de laisser croire à un succès.
    return {
      error: `Fiche générée (${doc.numero}) mais le formateur n'a pas pu être mis à jour. Relancez le versement.`,
    };
  }

  await logQualiopiActivity({
    action: "qualiopi.formateur.fiche.versee",
    targetType: "Trainer",
    targetId: trainerId,
    changes: {
      documentId: doc.id,
      numero: doc.numero,
      nbCompetences: data.domainesCompetences.length,
      // Habilitations RETENUES (catalogue en vigueur) — c'est ce chiffre qui doit
      // se retrouver sur la pièce, et donc dans la trace.
      nbHabilitations: titresHabilitations.length,
      nbActionsDeveloppement: actionsDeveloppement.length,
      pieceCompetences: data.pieceCompetences,
    },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Procédure de sous-traitance (indicateur 27)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Version de la procédure. À INCRÉMENTER dès qu'un article du gabarit change,
 * sans quoi deux tirages portant le même numéro de version diraient des choses
 * différentes — et c'est exactement ce qu'un auditeur relève.
 */
const PROCEDURE_SOUS_TRAITANCE_VERSION = "1.0";

/**
 * Génère la procédure écrite des dispositions en matière de sous-traitance et de
 * co-traitance (indicateur 27).
 *
 * 🔴 Cette pièce vivait HORS application, dans un fichier Markdown relu à la
 * main : la première chose que l'auditeur demande sur l'indicateur 27 n'était ni
 * numérotée, ni horodatée, ni versée au registre des documents. Toutes les
 * autres pièces Qualiopi se génèrent d'un bouton ; celle-ci exigeait d'ouvrir un
 * fichier, de l'imprimer et de le signer.
 *
 * Le texte est figé dans le gabarit : une procédure qualité n'est pas un
 * formulaire, ses articles engagent l'organisme et doivent être identiques d'une
 * édition à l'autre. Seuls varient l'identité, la version, la date et le
 * signataire.
 *
 * Aucun `refs` : la procédure ne se rattache à AUCUN sous-traitant — elle vaut
 * avant le premier recours, c'est tout son intérêt au regard de l'indicateur.
 */
export async function genererProcedureSousTraitanceAction(): Promise<
  ActionResult<{ documentId: string; numero: string }>
> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const identite = await getOrganismeIdentite();

  // Le signataire vient de la configuration, jamais d'une saisie libre : une
  // procédure approuvée par « l'organisme » sans personne physique identifiée
  // n'engage personne, et c'est un défaut déjà relevé sur les attestations.
  const [dirigeantNom, dirigeantFonction] = await Promise.all([
    getQualiopiConfig("dirigeant_nom").catch(() => ""),
    getQualiopiConfig("dirigeant_fonction").catch(() => ""),
  ]);

  const signataireNom =
    typeof dirigeantNom === "string" && dirigeantNom.trim() !== ""
      ? dirigeantNom.trim()
      : identite.raisonSociale;
  const signataireQualite =
    typeof dirigeantFonction === "string" && dirigeantFonction.trim() !== ""
      ? dirigeantFonction.trim()
      : "Nom, qualité, signature et cachet";

  const doc = await generateDocument({
    type: "procedure_sous_traitance",
    identite,
    buildElement: (numero) =>
      React.createElement(ProcedureSousTraitancePdf, {
        data: {
          numero,
          version: PROCEDURE_SOUS_TRAITANCE_VERSION,
          applicableLe: formatDateFr(new Date()),
          signataireNom,
          signataireQualite,
        },
        identite,
      }),
  });

  await logQualiopiActivity({
    action: "qualiopi.document.procedure_sous_traitance.genere",
    targetType: "DocumentGenere",
    targetId: doc.id,
    changes: { numero: doc.numero, version: PROCEDURE_SOUS_TRAITANCE_VERSION },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 24. Annulation d'une pièce au registre
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Longueur minimale du motif — alignée sur la contrainte `CHECK` de la
 * migration. Une seule règle, écrite deux fois parce qu'aucune des deux couches
 * ne peut faire confiance à l'autre ; qu'elles disent la MÊME chose est ce qui
 * évite qu'un motif accepté par le formulaire fasse planter l'écriture.
 */
const MOTIF_ANNULATION_MIN = 10;

const annulerDocumentSchema = z.object({
  documentId: z.string().uuid(),
  motif: z.string().trim().min(MOTIF_ANNULATION_MIN).max(500),
});

/**
 * Annule une pièce au registre : elle reste, elle cesse de faire foi.
 *
 * ## Pourquoi une annulation et pas une suppression
 *
 * Trois raisons, et aucune n'est théorique.
 *
 * **Le numéro est alloué dans une série continue** (CGI, art. 242 nonies A
 * ann. II). Supprimer la ligne laisse un trou, et un trou dans une série
 * documentaire est précisément ce qu'un contrôle relève — la purge de test du
 * 02/08 en a déjà laissé deux (`AXI-DOC` commence à 002, `AXI-ATT` à 003).
 *
 * **La pièce peut porter une signature réelle.** `AXI-DOC-2026-007`, celle qui
 * motive cette action, est `statut_signature = signee`. Supprimer la pièce
 * effacerait la preuve d'un acte qui a bel et bien eu lieu.
 *
 * **Une annulation motivée est une démonstration de maîtrise.** Une
 * contradiction interne laissée en place est un constat ; la même contradiction
 * annulée, datée et motivée montre au contraire un processus qui se corrige.
 * C'est pour ça que le motif est OBLIGATOIRE, ici comme en base.
 *
 * ⚠️ N'annule PAS les signatures portées par la pièce. Elles restent au registre
 * des signatures : la personne a signé, ce fait ne se réécrit pas. C'est la
 * VALEUR de la pièce qui tombe, pas l'historique.
 */
export async function annulerDocumentAction(input: {
  documentId: string;
  motif: string;
}): Promise<ActionResult<{ numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Annulation désactivée en mode build (stub)" };

  const parsed = annulerDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: `Motif obligatoire (${MOTIF_ANNULATION_MIN} caractères minimum) — il est lu par l'auditeur.`,
    };
  }
  const { documentId, motif } = parsed.data;

  const doc = await prisma.documentGenere.findUnique({
    where: { id: documentId },
    select: { id: true, numero: true, annuleeAt: true },
  });
  if (doc === null) return { error: "Pièce introuvable" };
  // Refus explicite plutôt que ré-écriture silencieuse : réannuler écraserait
  // la date et le motif d'origine, c'est-à-dire la trace même qu'on cherche à
  // produire.
  if (doc.annuleeAt !== null) return { error: `La pièce ${doc.numero} est déjà annulée.` };

  // L'auteur est nommé, jamais réduit à un identifiant : « annulée par
  // 4f3a-… » ne dit rien à un auditeur. Repli sur le rôle si le compte n'a pas
  // de nom — mieux vaut « Administrateur » qu'un UUID.
  const auteur = await prisma.adminUser.findUnique({
    where: { id: adminSession.userId },
    select: { name: true },
  });
  const annuleePar =
    typeof auteur?.name === "string" && auteur.name.trim() !== ""
      ? auteur.name.trim()
      : adminSession.role;

  await prisma.documentGenere.update({
    where: { id: documentId },
    data: { annuleeAt: new Date(), annuleeMotif: motif, annuleePar },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.annulee",
    targetType: "DocumentGenere",
    targetId: documentId,
    changes: { numero: doc.numero, motif, annuleePar },
    session: adminSession,
  });

  return { data: { numero: doc.numero } };
}
