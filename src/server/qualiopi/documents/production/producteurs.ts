/**
 * Qualiopi — PRODUCTEURS de pièces documentaires (couche SERVICE, S5).
 *
 * ## Pourquoi ce module existe
 *
 * Jusqu'au 2026-08-26, la construction des données de chaque pièce vivait DANS
 * les Server Actions de `actions/qualiopi/documents.ts` — un fichier
 * `"use server"` gardé par `requireAdminWrite`, donc inatteignable depuis un
 * worker BullMQ (`headers()` lève hors requête HTTP, cf.
 * `workers-no-guarded-actions.spec.ts`). Le worker `qualiopi-documents-worker`
 * a besoin des MÊMES constructions : les recopier aurait créé un jumeau qui
 * diverge au premier correctif (le motif payé 9 fois sur 11 au cahier D3).
 *
 * Les corps sont donc EXTRAITS ici, et les actions délèguent : garde admin +
 * validation + journal côté action, données + rendu + `generateDocument` ici.
 * Une seule construction par type de pièce, deux appelants.
 *
 * ⚠️ PAS de directive `"use server"` ici — ce module est un service serveur nu,
 * exactement comme `attestation-service.ts`. L'ajouter en ferait des endpoints
 * publics sans auth.
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { readFormationForDocs } from "@/server/qualiopi/formations/formation-snapshot";
import { normaliserObjectifsPedagogiques } from "@/server/qualiopi/formations/objectifs";
import { resolvePrincipalTrainerId } from "@/server/qualiopi/trainers/session-formateurs";
import { ecartEffectif, mentionStagiaires } from "@/server/qualiopi/documents/stagiaires-nommes";
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
import {
  montantPrisEnChargeCents,
  resteAChargeCents,
} from "@/server/qualiopi/financements/prise-en-charge-montant";
import { opcoLabel } from "@/server/qualiopi/financements/opco-referentiel";
import { lireModulesProgramme } from "@/server/qualiopi/documents/programme-modules";
import { construireTirageEmargement } from "@/server/qualiopi/documents/emargement-tirage";

// Gabarits PDF
import { ConventionPdf } from "@/server/qualiopi/documents/templates/convention";
import { ConventionTripartitePdf } from "@/server/qualiopi/documents/templates/convention-tripartite";
import { ContratFormationPdf } from "@/server/qualiopi/documents/templates/contrat-formation";
import { ConvocationPdf } from "@/server/qualiopi/documents/templates/convocation";
import { PositionnementPdf } from "@/server/qualiopi/documents/templates/positionnement";
import { GrilleEvaluationPdf } from "@/server/qualiopi/documents/templates/grille-evaluation";
import { SatisfactionPdf } from "@/server/qualiopi/documents/templates/satisfaction";
import { ReglementInterieurPdf } from "@/server/qualiopi/documents/templates/reglement-interieur";
import { LivretAccueilPdf } from "@/server/qualiopi/documents/templates/livret-accueil";
import { ProgrammeFormationPdf } from "@/server/qualiopi/documents/templates/programme-formation";
import { OrganisationActionPdf } from "@/server/qualiopi/documents/templates/organisation-action";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers partagés (déplacés depuis actions/qualiopi/documents.ts — une seule
// implémentation, réimportée par le fichier d'actions)
// ─────────────────────────────────────────────────────────────────────────────

export function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR");
}

export function modaliteLabel(
  m: "presentiel" | "distanciel" | "hybride",
): "Présentiel" | "Distanciel" | "Mixte" {
  if (m === "presentiel") return "Présentiel";
  if (m === "distanciel") return "Distanciel";
  return "Mixte";
}

export function modaliteLabelLower(
  m: "presentiel" | "distanciel" | "hybride",
): "présentiel" | "distanciel" | "mixte" {
  if (m === "presentiel") return "présentiel";
  if (m === "distanciel") return "distanciel";
  return "mixte";
}

/**
 * Nom du formateur principal d'une session. FK `formateurPrincipalId` prioritaire
 * (fiable, écrite par l'assignation), repli sur le Json `coFormateurs` (legacy),
 * puis `fallback` (raison sociale).
 */
export async function resolveFormateurNom(
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
  const arr = Array.isArray(input.coFormateurs) ? input.coFormateurs : [];
  const premier = arr[0] as { nom?: string; prenom?: string } | undefined;
  if (premier?.nom) {
    return [premier.prenom, premier.nom].filter(Boolean).join(" ");
  }
  return fallback;
}

/** Seule lecture d'`objectifsPedagogiques` à connaître `description` — SSOT. */
export const parseObjectifs = normaliserObjectifsPedagogiques;

export const NIVEAU_LABELS: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
  tous_niveaux: "Tous niveaux",
};

/**
 * Libellé de la sanction de l'action (art. L.6353-1 : « modalités de sanction »).
 * ⚠️ On ne promet JAMAIS une certification que l'action ne délivre pas.
 */
export function sanctionLabel(certificationType: string | null): string {
  if (certificationType === "rncp") {
    return "Certification enregistrée au Répertoire national des certifications professionnelles (RNCP).";
  }
  if (certificationType === "rs") {
    return "Certification enregistrée au Répertoire spécifique (RS).";
  }
  return "Attestation de fin de formation mentionnant les objectifs, la nature, la durée de l'action et les résultats de l'évaluation des acquis.";
}

/**
 * Lot 1ter §6 — les trois champs « stagiaires » d'une convention, d'un coup.
 * Écrit une fois : bipartite et tripartite doivent dire EXACTEMENT la même
 * chose des mêmes personnes.
 */
export function mentionsStagiairesDe(session: {
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

// ─────────────────────────────────────────────────────────────────────────────
// Contrat de résultat commun
// ─────────────────────────────────────────────────────────────────────────────

export type ResultatProduction =
  | {
      ok: true;
      documentId: string;
      numero: string;
      /** Informations annexes utiles au journal de l'appelant. */
      details?: Record<string, unknown>;
      /** Avertissement non bloquant à remonter à l'admin (ex. médiation absente). */
      avertissement?: string;
    }
  | { ok: false; motif: string };

export interface OptionsProduction {
  /** Régénération motivée = RECTIFICATION, pas duplicata (cf. documents-service). */
  rectificationMotif?: string;
  /**
   * Métadonnées de production à figer sur la pièce. Le worker S5 y pose
   * `{ genereParWorker: true, jalon }` : la pièce dit dans quelles conditions
   * elle est née, et le registre distingue un clic d'un automatisme.
   */
  metadata?: Record<string, unknown>;
}

function optionsGenerate(opts?: OptionsProduction): {
  rectificationMotif?: string;
  metadata?: Record<string, unknown>;
} {
  return {
    ...(opts?.rectificationMotif !== undefined
      ? { rectificationMotif: opts.rectificationMotif }
      : {}),
    ...(opts?.metadata !== undefined ? { metadata: opts.metadata } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Convention de formation (L.6353-1)
// ─────────────────────────────────────────────────────────────────────────────

export async function produireConvention(
  sessionId: string,
  opts?: OptionsProduction & { acomptePercent?: number },
): Promise<ResultatProduction> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      // 🔴 Sans lui, `DocumentGenere.clientId` restait NULL et le lien de
      // signature « client » était refusé. Gardé par refs-circuits.spec.ts.
      clientId: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      modalite: true,
      ...LIEU_DOCUMENT_SELECT,
      nbParticipantsPrevus: true,
      // Lot 1ter §6 — la convention doit NOMMER les stagiaires.
      enrollments: {
        select: {
          statut: true,
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
  if (!session) return { ok: false, motif: "Session introuvable" };
  if (!session.client) {
    return { ok: false, motif: "Session sans client — impossible de générer la convention" };
  }

  const identite = await getOrganismeIdentite();
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const objectifs = parseObjectifs(formationDoc.objectifsPedagogiques);

  const doc = await generateDocument({
    type: "convention",
    ...optionsGenerate(opts),
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
          ...mentionsStagiairesDe(session),
          prixHt: session.montantHtCents / 100,
          // Absent → le gabarit applique 30 % (usage commercial). `0` = payable
          // en totalité à réception de facture.
          ...(opts?.acomptePercent !== undefined ? { acomptePercent: opts.acomptePercent } : {}),
          dateConvention: formatDateFr(new Date()),
        },
        identite,
      }),
    // `clientId` non-null ici : la garde « Session sans client » a déjà refusé.
    refs: { sessionId, clientId: session.clientId! },
  });

  return {
    ok: true,
    documentId: doc.id,
    numero: doc.numero,
    details: { acomptePercent: opts?.acomptePercent ?? 30 },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Convention tripartite (L.6353-1/2 + subrogation OPCO)
// ─────────────────────────────────────────────────────────────────────────────

export async function produireConventionTripartite(
  sessionId: string,
  opts?: OptionsProduction,
): Promise<ResultatProduction> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      clientId: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      modalite: true,
      ...LIEU_DOCUMENT_SELECT,
      nbParticipantsPrevus: true,
      enrollments: {
        select: {
          statut: true,
          trainee: { select: { nom: true, prenom: true, fonction: true } },
        },
      },
      montantHtCents: true,
      opcoSubrogation: true,
      numeroDossierOpco: true,
      // 🔴 16/08 — `priseEnChargeMontantCents` est un TARIF : son sens dépend de
      // l'unité, et les plafonds le bornent. Sans ces champs, la convention
      // imprimait « 40,00 € » pour un OPCO couvrant 4 480 € (facteur 112).
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
  if (!session) return { ok: false, motif: "Session introuvable" };
  if (!session.client) return { ok: false, motif: "Session sans client" };

  const identite = await getOrganismeIdentite();
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const objectifs = parseObjectifs(formationDoc.objectifsPedagogiques);
  // Libellé, pas slug : `opcoIdentifie` stocke « akto », la pièce lit « Akto ».
  const nomOpco = session.client.opcoIdentifie
    ? opcoLabel(session.client.opcoIdentifie)
    : "OPCO (à préciser)";
  const numeroPriseEnCharge = session.numeroDossierOpco ?? session.client.opcoNumeroAdherent ?? "—";
  const prixHt = session.montantHtCents / 100;

  // 🔴 16/08 — le montant pris en charge se CALCULE, il ne se lit pas.
  // `null` = montant NON ÉTABLI : le gabarit le dit, au lieu d'imprimer 0.
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
    ...optionsGenerate(opts),
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
          ...mentionsStagiairesDe(session),
          prixHt,
          montantPrisEnCharge: priseEnChargeCents !== null ? priseEnChargeCents / 100 : null,
          resteAChargeClient: resteCents !== null ? resteCents / 100 : null,
          dateConvention: formatDateFr(new Date()),
        },
        identite,
      }),
    refs: { sessionId, clientId: session.clientId! },
  });

  return { ok: true, documentId: doc.id, numero: doc.numero };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Contrat de formation professionnelle (particulier / B2C, L.6353-3 à 7)
// ─────────────────────────────────────────────────────────────────────────────

export async function produireContratFormation(
  enrollmentId: string,
  opts?: OptionsProduction,
): Promise<ResultatProduction & { mediateurManquant?: boolean }> {
  // ⚠️ MÉDIATION DE LA CONSOMMATION — AVERTISSEMENT, PLUS BLOCAGE (décision
  // Will 2026-07-30). L'obligation L.612-1 C. conso ne disparaît pas, mais elle
  // ne se règle pas dans le code : le contrat sort, l'absence est VISIBLE
  // (avertissement) et TRACÉE (journal côté action). Le gabarit imprime la
  // clause de médiation dès que les deux clés de configuration sont posées.
  const [mediateurNom, mediateurUrl] = await Promise.all([
    getQualiopiConfig("mediateur_consommation_nom"),
    getQualiopiConfig("mediateur_consommation_url"),
  ]);
  const mediateurManquant = !mediateurNom?.trim() || !mediateurUrl?.trim();
  const avertissementMediation = mediateurManquant
    ? "Contrat émis SANS mention de médiation de la consommation : aucun médiateur n'est renseigné. Vendre une formation à un particulier impose d'avoir adhéré à un médiateur agréé CECMC et d'en publier les coordonnées (art. L.612-1 du Code de la consommation). Renseignez « mediateur_consommation_nom » et « mediateur_consommation_url » dans la configuration Qualiopi. Les conventions B2B ne sont pas concernées."
    : undefined;

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
          // 🔴 L'assiette de l'acompte est le RESTE À CHARGE, pas le prix total.
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
  if (!enrollment) return { ok: false, motif: "Inscription introuvable" };

  const identite = await getOrganismeIdentite();
  const session = enrollment.session;
  const trainee = enrollment.trainee;
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const objectifs = parseObjectifs(formationDoc.objectifsPedagogiques);
  const nomPrenom = `${trainee.prenom} ${trainee.nom}`.trim();

  // 🔴 L'acompte ANNONCÉ vient du calcul (`calculerAcompte`, assiette = reste à
  // charge), plus d'un pourcentage recalculé dans le gabarit. Ne lève jamais.
  const acompte = calculerAcompte({
    montantTotalHtCents: session.montantHtCents,
    priseEnChargeCents: session.priseEnChargeMontantCents ?? 0,
    subrogation: session.opcoSubrogation === true,
    // Un contrat individuel n'est pas un dossier CPF.
    cpf: false,
    nature: "particulier",
    tauxAcomptePct: PLAFOND_ACOMPTE_PARTICULIER_PCT,
    // La signature n'a pas encore eu lieu — `new Date()` comme date
    // d'engagement présumée ; `encaissementAutorise` reste l'autorité réelle.
    dateSignature: new Date(),
    dateDebutAction: new Date(session.dateDebut),
    dateFinAction: new Date(session.dateFin),
    nbEcheancesSolde: (await getQualiopiConfig("nb_echeances_solde_defaut")) || 3,
  });

  const doc = await generateDocument({
    type: "contrat",
    ...optionsGenerate(opts),
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
          // ⚠️ On ne garde QUE les échéances du solde : la première ligne de
          // l'échéancier est l'acompte, déjà affiché au-dessus.
          echeancierSolde: acompte.echeancier
            .filter((e) => !e.libelle.startsWith("Acompte"))
            .map((e) => ({
              libelle: e.libelle,
              montantEuros: e.montantCents / 100,
              dueLeLisible: e.dueLe === null ? null : formatDate(e.dueLe),
            })),
          dateContrat: formatDateFr(new Date()),
          // Rien n'est transmis tant qu'aucun médiateur n'est renseigné : le
          // gabarit n'imprime alors aucune clause.
          ...(mediateurManquant
            ? {}
            : {
                mediation: {
                  nom: (mediateurNom as string).trim(),
                  url: (mediateurUrl as string).trim(),
                },
              }),
        },
        identite,
      }),
    // `traineeId` fait partie de l'IDENTITÉ de la pièce (établie PAR stagiaire).
    refs: { sessionId: session.id, traineeId: trainee.id },
  });

  return {
    ok: true,
    documentId: doc.id,
    numero: doc.numero,
    mediateurManquant,
    details: {
      sessionId: session.id,
      ...(mediateurManquant ? { mentionMediationAbsente: true } : {}),
    },
    ...(avertissementMediation ? { avertissement: avertissementMediation } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Convocation (par stagiaire)
// ─────────────────────────────────────────────────────────────────────────────

export async function produireConvocation(
  enrollmentId: string,
  opts?: OptionsProduction,
): Promise<ResultatProduction> {
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
  if (!enrollment) return { ok: false, motif: "Inscription introuvable" };

  const identite = await getOrganismeIdentite();
  const session = enrollment.session;
  const trainee = enrollment.trainee;
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const formateurNom = await resolveFormateurNom(
    { formateurPrincipalId: session.formateurPrincipalId, coFormateurs: session.coFormateurs },
    identite.raisonSociale,
  );

  const nomStagiaire = `${trainee.prenom} ${trainee.nom}`.trim();
  const financement = session.financementType ?? undefined;

  // Horaires réels des journées déclarées — la convocation et la feuille
  // d'émargement doivent dire la même chose (CAA Nantes 20/04/2021).
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
    ...optionsGenerate(opts),
    buildElement: (numero) =>
      React.createElement(ConvocationPdf, {
        data: {
          numero,
          intituleFormation: session.titreSession,
          dateDebut: formatDate(new Date(session.dateDebut)),
          dateFin: formatDate(new Date(session.dateFin)),
          horaires: horairesReels,
          dureeHeures: formationDoc.dureeHeures ?? session.formation.dureeHeures,
          modalite: modaliteLabelLower(session.modalite),
          // `undefined` plutôt que « — » : le gabarit masque la ligne.
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
    // `traineeId` fait partie de l'IDENTITÉ de la pièce (établie PAR stagiaire).
    refs: { sessionId: session.id, traineeId: trainee.id },
  });

  return { ok: true, documentId: doc.id, numero: doc.numero, details: { sessionId: session.id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Feuille d'émargement présentiel
// ─────────────────────────────────────────────────────────────────────────────

export async function produireEmargement(
  sessionId: string,
  opts?: OptionsProduction,
): Promise<ResultatProduction> {
  // Le contenu est construit par `construireTirageEmargement`, partagé avec le
  // TIRAGE à la demande : les deux voies rendent exactement la même feuille.
  // ⚠️ Une session sans journée déclarée est REFUSÉE par le constructeur — une
  // feuille sans horaires réels est insuffisamment probante.
  const tirage = await construireTirageEmargement(sessionId);
  if (!tirage.ok) return { ok: false, motif: tirage.message };

  const doc = await generateDocument({
    type: "emargement",
    ...optionsGenerate(opts),
    buildElement: (numero) => tirage.element(numero),
    refs: { sessionId },
  });

  return {
    ok: true,
    documentId: doc.id,
    numero: doc.numero,
    details: { nbParticipants: tirage.nbParticipants },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Questionnaire de positionnement (support PDF)
// ─────────────────────────────────────────────────────────────────────────────

export async function produirePositionnement(
  sessionId: string,
  opts?: OptionsProduction,
): Promise<ResultatProduction> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, titreSession: true, dateDebut: true },
  });
  if (!session) return { ok: false, motif: "Session introuvable" };

  const identite = await getOrganismeIdentite();

  const doc = await generateDocument({
    type: "positionnement",
    ...optionsGenerate(opts),
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

  return { ok: true, documentId: doc.id, numero: doc.numero };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Grille d'évaluation des compétences (ind. 11) — par stagiaire
// ─────────────────────────────────────────────────────────────────────────────

export async function produireGrilleEvaluation(
  enrollmentId: string,
  opts?: OptionsProduction,
): Promise<ResultatProduction> {
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
  if (!enrollment) return { ok: false, motif: "Inscription introuvable" };

  const identite = await getOrganismeIdentite();
  const session = enrollment.session;
  const trainee = enrollment.trainee;
  const formateurNom = await resolveFormateurNom(
    { formateurPrincipalId: session.formateurPrincipalId, coFormateurs: session.coFormateurs },
    identite.raisonSociale,
  );
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const rawObjectifs = parseObjectifs(formationDoc.objectifsPedagogiques);
  const grilleVierge =
    rawObjectifs.length > 0
      ? rawObjectifs.map((libelle) => ({ libelle }))
      : [{ libelle: session.titreSession }];

  // 🔴 La grille lit l'évaluation ENREGISTRÉE quand elle existe (audit
  // 2026-08-03 : elle rendait toujours le formulaire vierge, pendant que
  // l'attestation du même dossier portait « Réussite — score 100 % »).
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

  // Repli sur la grille vierge : une évaluation absente doit produire un
  // formulaire imprimable, jamais faire échouer la génération.
  const competences = competencesEvaluees.length > 0 ? competencesEvaluees : grilleVierge;

  const doc = await generateDocument({
    type: "grille_evaluation",
    ...optionsGenerate(opts),
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
    refs: { sessionId: session.id, traineeId: trainee.id },
  });

  return { ok: true, documentId: doc.id, numero: doc.numero };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Questionnaire de satisfaction (ind. 31) — support PDF
// ─────────────────────────────────────────────────────────────────────────────

export async function produireSatisfaction(
  sessionId: string,
  opts?: OptionsProduction,
): Promise<ResultatProduction> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, titreSession: true, dateFin: true },
  });
  if (!session) return { ok: false, motif: "Session introuvable" };

  const identite = await getOrganismeIdentite();

  const doc = await generateDocument({
    type: "satisfaction",
    ...optionsGenerate(opts),
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

  return { ok: true, documentId: doc.id, numero: doc.numero };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Règlement intérieur
// ─────────────────────────────────────────────────────────────────────────────

export async function produireReglementInterieur(
  sessionId: string,
  opts?: OptionsProduction,
): Promise<ResultatProduction> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!session) return { ok: false, motif: "Session introuvable" };

  const identite = await getOrganismeIdentite();
  const dateVersion = formatDateFr(new Date());

  const doc = await generateDocument({
    type: "reglement_interieur",
    ...optionsGenerate(opts),
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

  return { ok: true, documentId: doc.id, numero: doc.numero };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Programme de l'action (annexe de la convention, art. R.6351-5)
// ─────────────────────────────────────────────────────────────────────────────

export async function produireProgramme(
  sessionId: string,
  opts?: OptionsProduction,
): Promise<ResultatProduction> {
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
  if (!session) return { ok: false, motif: "Session introuvable" };

  const identite = await getOrganismeIdentite();
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const objectifs = parseObjectifs(formationDoc.objectifsPedagogiques);
  const modules = lireModulesProgramme(formationDoc.programmeDetaille);

  // Les modalités d'évaluation décrivent le dispositif RÉEL de la plateforme —
  // le seuil de réussite est le seul paramètre variable.
  const seuil = session.formation.seuilReussitePct;
  const modalitesEvaluation =
    `Évaluation des prérequis et du niveau par questionnaire de positionnement avant l'entrée en formation. ` +
    `Évaluation des acquis en fin d'action au regard des objectifs pédagogiques ci-dessus ` +
    `(seuil de réussite : ${seuil} %). ` +
    `Recueil de la satisfaction des participants à l'issue de l'action.`;

  const doc = await generateDocument({
    type: "programme",
    ...optionsGenerate(opts),
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

  return {
    ok: true,
    documentId: doc.id,
    numero: doc.numero,
    details: { source: formationDoc.source, nbModules: modules.length },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Organisation de l'action (art. R.6351-5, ind. 9 et 12)
// ─────────────────────────────────────────────────────────────────────────────

export async function produireOrganisationAction(
  sessionId: string,
  opts?: OptionsProduction,
): Promise<ResultatProduction> {
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
  if (!session) return { ok: false, motif: "Session introuvable" };

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
    ...optionsGenerate(opts),
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

  return { ok: true, documentId: doc.id, numero: doc.numero, details: { nbJours } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Livret d'accueil stagiaire
// ─────────────────────────────────────────────────────────────────────────────

export async function produireLivretAccueil(
  sessionId: string,
  opts?: OptionsProduction,
): Promise<ResultatProduction> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, coFormateurs: true, formateurPrincipalId: true },
  });
  if (!session) return { ok: false, motif: "Session introuvable" };

  const identite = await getOrganismeIdentite();

  // Contact pédagogique — formateur principal ou identité OF.
  const formateurNom = await resolveFormateurNom(
    { formateurPrincipalId: session.formateurPrincipalId, coFormateurs: session.coFormateurs },
    identite.raisonSociale,
  );
  const dateVersion = formatDateFr(new Date());

  const doc = await generateDocument({
    type: "livret_accueil",
    ...optionsGenerate(opts),
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

  return { ok: true, documentId: doc.id, numero: doc.numero };
}
