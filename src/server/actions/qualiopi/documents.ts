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
import { resolvePrincipalTrainerId } from "@/server/qualiopi/trainers/session-formateurs";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { formatLieu } from "@/server/qualiopi/lieu/format-lieu";
import { ProgrammeFormationPdf } from "@/server/qualiopi/documents/templates/programme-formation";
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
import { EmargementPdf } from "@/server/qualiopi/documents/templates/emargement";
import { construireFeuillePdf, LIBELLE_DEMI } from "@/server/qualiopi/emargement/feuille-pdf";
import { PositionnementPdf } from "@/server/qualiopi/documents/templates/positionnement";
import { GrilleEvaluationPdf } from "@/server/qualiopi/documents/templates/grille-evaluation";
import { SatisfactionPdf } from "@/server/qualiopi/documents/templates/satisfaction";
import { CertificatRealisationPdf } from "@/server/qualiopi/documents/templates/certificat-realisation";
import { KitOpcoPdf } from "@/server/qualiopi/documents/templates/kit-opco";
import { KitCpfPdf } from "@/server/qualiopi/documents/templates/kit-cpf";
import { KitFranceTravailPdf } from "@/server/qualiopi/documents/templates/kit-france-travail";
import { LettreMissionPdf } from "@/server/qualiopi/documents/templates/lettre-mission";
import { ReglementInterieurPdf } from "@/server/qualiopi/documents/templates/reglement-interieur";
import { LivretAccueilPdf } from "@/server/qualiopi/documents/templates/livret-accueil";
import { InventaireMoyensPdf } from "@/server/qualiopi/documents/templates/inventaire-moyens";
import { ContratSousTraitancePdf } from "@/server/qualiopi/documents/templates/contrat-sous-traitance";
import { readFormationForDocs } from "@/server/qualiopi/formations/formation-snapshot";
import { normaliserObjectifsPedagogiques } from "@/server/qualiopi/formations/objectifs";
import { listMoyens } from "@/server/qualiopi/moyens/moyens-service";
import { getSousTraitant } from "@/server/qualiopi/registres/sous-traitants-service";
import { opcoLabel } from "@/server/qualiopi/financements/opco-referentiel";

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

const sessionIdSchema = z.object({ sessionId: z.string().uuid() });

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
});
const enrollmentIdSchema = z.object({ enrollmentId: z.string().uuid() });

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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = genererConventionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, acomptePercent } = parsed.data;

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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

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
      montantHtCents: true,
      opcoSubrogation: true,
      numeroDossierOpco: true,
      priseEnChargeMontantCents: true,
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
  const montantPrisEnCharge = (session.priseEnChargeMontantCents ?? 0) / 100;
  const prixHt = session.montantHtCents / 100;

  const doc = await generateDocument({
    type: "convention_tripartite",
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
          prixHt,
          montantPrisEnCharge,
          resteAChargeClient: Math.max(0, prixHt - montantPrisEnCharge),
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
  const { enrollmentId } = parsed.data;

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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId } = parsed.data;

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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      titreSession: true,
      dateDebut: true,
      modalite: true,
      ...LIEU_DOCUMENT_SELECT,
      enrollments: {
        where: { statut: { notIn: ["exclu", "abandon"] } },
        select: {
          trainee: { select: { nom: true, prenom: true, entreprise: true } },
        },
      },
    },
  });
  if (!session) return { error: "Session introuvable" };

  const identite = await getOrganismeIdentite();
  // ⚠️ Pas de `resolveFormateurNom` ici : le formateur est désormais porté
  // JOURNÉE PAR JOURNÉE par `construireFeuillePdf` (désistement, co-animation).
  // Un nom unique en tête de feuille contredirait le tableau qui suit, et
  // CAA Nantes 20/04/2021 sanctionne précisément les feuilles dont le formateur
  // annoncé ne correspond pas à celui qui a animé.

  const participants = session.enrollments.map((e) => ({
    nom: `${e.trainee.prenom} ${e.trainee.nom}`.trim(),
    ...(e.trainee.entreprise !== null && e.trainee.entreprise !== undefined
      ? { entreprise: e.trainee.entreprise }
      : {}),
  }));

  // 🔴 Les données viennent désormais de `session_jours` : horaires RÉELS,
  // multi-jours, modules, formateur par journée, écart de signature et ancrage
  // de chaîne. Le « 09h00–17h00 » codé en dur produisait une pièce fausse dès
  // qu'une session durait plus d'un jour.
  const feuille = await construireFeuillePdf(sessionId);
  if (feuille === null || feuille.journees.length === 0) {
    return {
      error:
        "Les journées de cette session ne sont pas déclarées. Renseignez-les avec leurs horaires réels : une feuille d'émargement sans horaires exacts est insuffisamment probante.",
    };
  }

  const journees = feuille.journees.map((j) => ({
    dateLisible: j.dateLisible,
    horaires: j.horaires,
    formateurNom: j.formateurNom,
    modules: j.modules,
    entetes: j.demiJournees.map((dj) => LIBELLE_DEMI[dj]),
    lignes: j.lignes.map((l) => ({
      nom: l.stagiaireNom,
      entreprise: l.entreprise ?? "",
      cases: l.cases.map((c) =>
        c.signeAHeure === null
          ? ""
          : [
              `Signé ${c.signeAHeure}`,
              // Mitigation obligatoire de D13 : un écart de 40 h visible et
              // assumé se défend, le même écart muet ne se défend pas.
              c.ecart === null ? "" : `(${c.ecart})`,
              c.surPosteFormateur ? "— poste formateur" : "",
            ]
              .filter(Boolean)
              .join(" "),
      ),
      // Empreinte tronquée : de quoi recouper le registre sans rendre la
      // feuille illisible.
      ancrage:
        l.empreinteTete === null ? "—" : `${l.nbSignatures} · ${l.empreinteTete.slice(0, 10)}`,
    })),
    // Une ligne par demi-journée contresignée : « Matin — Williams Jullin,
    // signé 12h05 ». Le nom du formateur figuré est celui qui a CONTRESIGNÉ.
    contresignatures: j.contresignatures.map(
      (c) => `${LIBELLE_DEMI[c.demiJournee]} — ${c.formateurNom}, signé ${c.signeAHeure}`,
    ),
    // 🔴 H2 — demi-journées de CE jour SANS contresignature formateur. Une
    // journée où seule la matinée est contresignée (co-animation « chacun la
    // sienne ») était rendue comme complète : le trou de l'après-midi (signature
    // formateur exigée, CAA Nantes 20/04/2021) était invisible à l'auditeur.
    contresignaturesManquantes: j.demiJournees
      // Le grain « journee » (créneau hérité d'un import, M4) n'est jamais
      // contresigné — la contresignature se fait par demi-journée. Ne pas le
      // compter comme « manquant », sinon faux « feuille incomplète » (L-C).
      .filter((dj) => dj !== "journee" && !j.contresignatures.some((c) => c.demiJournee === dj))
      .map((dj) => LIBELLE_DEMI[dj]),
  }));

  const doc = await generateDocument({
    type: "emargement",
    buildElement: (numero) =>
      React.createElement(EmargementPdf, {
        data: {
          numero,
          intituleFormation: feuille.intituleFormation,
          numeroSession: feuille.numeroSession,
          lieu: resolveLieuDocument(session, identite),
          nda: identite.nda,
          journees,
          totalSignatures: feuille.totalSignatures,
        },
        identite,
      }),
    refs: { sessionId },
  });

  await logQualiopiActivity({
    action: "qualiopi.document.emargement.genere",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { documentId: doc.id, numero: doc.numero, nbParticipants: participants.length },
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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, titreSession: true, dateDebut: true },
  });
  if (!session) return { error: "Session introuvable" };

  const identite = await getOrganismeIdentite();

  const doc = await generateDocument({
    type: "positionnement",
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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId } = parsed.data;

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
  const competences =
    rawObjectifs.length > 0
      ? rawObjectifs.map((libelle) => ({ libelle }))
      : [{ libelle: session.titreSession }];

  const doc = await generateDocument({
    type: "grille_evaluation",
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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, titreSession: true, dateFin: true },
  });
  if (!session) return { error: "Session introuvable" };

  const identite = await getOrganismeIdentite();

  const doc = await generateDocument({
    type: "satisfaction",
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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId } = parsed.data;

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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId } = parsed.data;

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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = enrollmentIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { enrollmentId } = parsed.data;

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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

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
      formation: { select: { dureeHeures: true } },
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
    tarifJourneeHtCents: number | null;
    sousTraitantNda: string | null;
  } | null = null;

  if (principalTrainerId) {
    trainer = await prisma.trainer.findUnique({
      where: { id: principalTrainerId },
      select: {
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        tarifJourneeHtCents: true,
        sousTraitantNda: true,
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

  const tarifJourHt = trainer?.tarifJourneeHtCents ? trainer.tarifJourneeHtCents / 100 : 0;

  const doc = await generateDocument({
    type: "lettre_mission",
    buildElement: (numero) =>
      React.createElement(LettreMissionPdf, {
        data: {
          numero,
          formateur: {
            nomPrenom,
            adresse: "—",
            email: trainer?.email ?? identite.email,
            ...(trainer?.telephone !== null && trainer?.telephone !== undefined
              ? { telephone: trainer.telephone }
              : {}),
            specialite: "Formation Intelligence Artificielle",
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
          dateMission: formatDateFr(new Date()),
        },
        identite,
      }),
    refs: { sessionId },
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

// ─────────────────────────────────────────────────────────────────────────────
// 13. Règlement intérieur (L.6352-3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le règlement intérieur des stagiaires.
 * Document de session (joint à la convocation).
 */
export async function genererReglementInterieurAction(input: {
  sessionId: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!session) return { error: "Session introuvable" };

  const identite = await getOrganismeIdentite();
  const dateVersion = formatDateFr(new Date());

  const doc = await generateDocument({
    type: "reglement_interieur",
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
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

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
// 14. Livret d'accueil stagiaire
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère le livret d'accueil stagiaire pour une session.
 * Les contacts pédagogiques sont lus depuis la SiteSetting ou depuis le
 * formateur principal de la session.
 */
export async function genererLivretAccueilAction(input: {
  sessionId: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const adminSession = await requireAdminWrite();
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;

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
  const adminSession = await requireAdminWrite();
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
      afestHabiliteAt: true,
      sousTraitantNda: true,
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
  const habilitations = await prisma.trainerHabilitation.findMany({
    where: { trainerId: trainer.id },
    select: { formation: { select: { titre: true } } },
    orderBy: { formation: { titre: "asc" } },
  });
  const titresHabilitations: string[] = habilitations.map((h) => h.formation.titre);

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
  const aDesHabilitations = trainer.formationsHabilitees.length > 0;
  if (!aDesCompetences && !aDesHabilitations && nbCvSource === 0) {
    return {
      error:
        "Fiche non versée : ce formateur n'a ni domaine de compétence, ni habilitation, ni CV source. Renseignez sa maîtrise (indicateur 21) avant de verser sa fiche au dossier.",
    };
  }

  const data = {
    ...buildCvFormateurData(trainer, titresHabilitations, maintenant),
    cvJoint: nbCvSource > 0,
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
      nbHabilitations: titresHabilitations.length,
    },
    session: adminSession,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}
