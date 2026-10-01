/**
 * TOUTES les lectures du dossier client passent par ici (chantier visio, plan
 * §3.9). Ce nom de module est un MARQUEUR : la garde
 * `admin-calendly/__tests__/la-lecture-est-gardee-comme-l-ecriture.spec.ts`
 * exige que toute page qui l'importe consulte le rôle (`peutVoirLesEchanges`
 * ou `gardeLectureEchanges`) — et toute page qui lit directement un modèle
 * `rgpd: dossier-client` aussi.
 *
 * Les paroles (énoncés, textes courts, questions, comptes rendus) sont
 * déchiffrées ICI, par `dechiffrerParole` seulement (garde
 * `le-circuit-ne-chiffre-qu-avec-chiffrer-parole`). Une valeur qu'on ne sait pas
 * déchiffrer (clé absente) ne fait pas tomber la page : elle s'affiche
 * « (illisible) », et le panneau technique signalera la clé.
 *
 * ⚠️ Appelé APRÈS la garde, jamais avant : ces fonctions ne vérifient pas le
 * rôle elles-mêmes (elles sont aussi lues par des tests et des scripts).
 */

import type {
  EmailOutboxStatus,
  FaitPortee,
  FaitStatut,
  FaitType,
  ProjetStatut,
  RencontreStatut,
  RencontreType,
  RendezVousIssue,
  RendezVousSuite,
  RoleDansProjet,
} from "../../../prisma/generated/client";
import { prisma } from "@/lib/prisma";
import { dechiffrerParole } from "@/lib/chiffrer-parole";
import { lireFaitsDUnClient, TEXTE_ILLISIBLE } from "@/features/dossier-client/lire-faits";
import { preparationEchouee } from "@/features/dossier-client/questionnaire-etat";
import { ORDRE_QUI_REPOND } from "@/server/visio/questionnaire-en-ligne/constantes";
import { urlQuestionnaire } from "@/server/visio/questionnaire-en-ligne/jeton";
import { versionRemplacable } from "@/server/visio/questionnaire-en-ligne/regles";
import {
  etatsDesEmailsSuivi,
  type EtatEmailSuivi,
} from "@/features/dossier-client/etat-email-suivi";
import type { FaitAConsolider } from "@/features/dossier-client/consolider-faits";
import type {
  CompteRenduNonValide,
  DernierSuivi,
  PersonneDuClient,
  ProjetResume,
  QuestionSansReponse,
} from "@/features/dossier-client/preparer";

export { TEXTE_ILLISIBLE };

/** Déchiffre sans faire tomber la page. */
function lire(valeur: string | null): string | null {
  if (valeur === null) return null;
  try {
    return dechiffrerParole(valeur);
  } catch {
    return TEXTE_ILLISIBLE;
  }
}

/** Statuts de fait qui comptent pour le dossier : on ne lit ni les rejetés ni les remplacés. */
const STATUTS_LUS: FaitStatut[] = ["propose", "en_attente", "valide", "efface"];

export interface FaitDuDossier extends FaitAConsolider {
  readonly citationVerifiee: boolean;
}

/**
 * Les faits d'un client (tous les statuts utiles), énoncés déchiffrés — par
 * LA lecture partagée avec le worker (`lire-faits.ts`).
 */
export async function lireFaitsDuClient(clientId: string): Promise<FaitDuDossier[]> {
  return lireFaitsDUnClient(prisma, clientId, { statuts: STATUTS_LUS, illisible: TEXTE_ILLISIBLE });
}

export interface FaitARanger {
  readonly id: string;
  readonly type: FaitType;
  readonly enonce: string;
  readonly constateLe: Date;
}

/** Les faits pas encore rangés dans un projet (cases à cocher de « Nouveau projet »). */
export async function lireFaitsARanger(clientId: string): Promise<FaitARanger[]> {
  const lignes = await prisma.fait.findMany({
    where: {
      clientId,
      portee: "a_ranger" satisfies FaitPortee,
      statut: { in: ["propose", "en_attente"] },
    },
    select: { id: true, type: true, enonce: true, constateLe: true },
    orderBy: { constateLe: "desc" },
  });
  return lignes.map((l) => ({ ...l, enonce: lire(l.enonce) ?? "" }));
}

export interface ProjetDuDossier extends ProjetResume {
  readonly createdAt: Date;
  readonly devis: ReadonlyArray<{ id: string; numero: string; statut: string }>;
  readonly nbQuestionnaires: number;
  readonly contacts: ReadonlyArray<{ contactId: string; role: RoleDansProjet }>;
}

export async function lireProjetsDuClient(clientId: string): Promise<ProjetDuDossier[]> {
  const projets = await prisma.projet.findMany({
    where: { clientId },
    select: {
      id: true,
      numero: true,
      titre: true,
      statut: true,
      derniereReouvertureLe: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  if (projets.length === 0) return [];
  const ids = projets.map((p) => p.id);
  const [liens, questionnaires, contacts] = await Promise.all([
    prisma.projetDevis.findMany({
      where: { projetId: { in: ids } },
      select: { projetId: true, devisId: true },
    }),
    prisma.questionnaireCadrage.groupBy({
      by: ["projetId"],
      where: { projetId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.projetContact.findMany({
      where: { projetId: { in: ids } },
      select: { projetId: true, contactId: true, role: true },
    }),
  ]);
  const devis =
    liens.length === 0
      ? []
      : await prisma.devis.findMany({
          where: { id: { in: liens.map((l) => l.devisId) } },
          select: { id: true, numero: true, statut: true },
        });
  return projets.map((p) => ({
    ...p,
    devis: liens
      .filter((l) => l.projetId === p.id)
      .flatMap((l) => {
        const d = devis.find((x) => x.id === l.devisId);
        return d !== undefined ? [{ id: d.id, numero: d.numero, statut: String(d.statut) }] : [];
      }),
    nbQuestionnaires: questionnaires.find((q) => q.projetId === p.id)?._count._all ?? 0,
    contacts: contacts
      .filter((c) => c.projetId === p.id)
      .map((c) => ({ contactId: c.contactId, role: c.role })),
  }));
}

export interface PersonneDuDossier extends PersonneDuClient {
  readonly telephone: string | null;
  readonly statut: "actif" | "parti";
  readonly estContactFacturation: boolean;
  readonly oppositionIaLe: Date | null;
  readonly adresses: ReadonlyArray<{ email: string; nature: "pro" | "perso" }>;
  readonly roles: ReadonlyArray<{ projetId: string; role: RoleDansProjet }>;
}

export async function lirePersonnesDuClient(clientId: string): Promise<PersonneDuDossier[]> {
  const contacts = await prisma.clientContact.findMany({
    where: { clientId },
    select: {
      id: true,
      nom: true,
      fonction: true,
      telephone: true,
      statut: true,
      estContactFacturation: true,
      oppositionIaLe: true,
      adresses: { select: { email: true, nature: true }, orderBy: { ajouteeLe: "asc" } },
    },
    orderBy: [{ estContactFacturation: "desc" }, { nom: "asc" }],
  });
  if (contacts.length === 0) return [];
  const ids = contacts.map((c) => c.id);
  const [presences, roles] = await Promise.all([
    prisma.rencontreParticipant.groupBy({
      by: ["contactId"],
      where: { contactId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.projetContact.findMany({
      where: { contactId: { in: ids } },
      select: { contactId: true, projetId: true, role: true },
    }),
  ]);
  return contacts.map((c) => ({
    ...c,
    rencontree: presences.some((p) => p.contactId === c.id && p._count._all > 0),
    roles: roles
      .filter((r) => r.contactId === c.id)
      .map((r) => ({ projetId: r.projetId, role: r.role })),
  }));
}

/**
 * Le résumé « En bref » d'un compte rendu validé. Le contenu est un JSON
 * chiffré en un bloc (`compteRendu.vN`) ; son gabarit arrive avec la PR du
 * compte rendu. On lit `enBref` s'il existe, sans jamais faire tomber la page.
 */
export function enBrefDuContenu(contenuClair: string | null): string | null {
  if (contenuClair === null || contenuClair === "" || contenuClair === TEXTE_ILLISIBLE) {
    return contenuClair === TEXTE_ILLISIBLE ? TEXTE_ILLISIBLE : null;
  }
  try {
    const json = JSON.parse(contenuClair) as { enBref?: unknown; en_bref?: unknown };
    const v = json.enBref ?? json.en_bref;
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.filter((x) => typeof x === "string").join(" ");
    return null;
  } catch {
    return null;
  }
}

export interface RencontreDuDossier {
  readonly id: string;
  readonly titre: string;
  readonly type: RencontreType;
  readonly debutPrevu: Date | null;
  readonly statut: RencontreStatut | null;
  readonly projetId: string | null;
  readonly estTestInterne: boolean;
  readonly issue: RendezVousIssue | null;
  readonly compteRenduValide: {
    readonly valideLe: Date | null;
    readonly enBref: string | null;
  } | null;
  readonly compteRenduEnCours: boolean;
  readonly emailsSuivi: ReadonlyArray<{
    readonly creeLe: Date;
    /** Lu dans `email_outbox`, ou — sans e-mail — dans l'étape `email_suivi`. */
    readonly etat: EtatEmailSuivi;
  }>;
}

/** Les rencontres d'un client, de la plus récente à la plus ancienne. */
export async function lireRencontresDuClient(clientId: string): Promise<RencontreDuDossier[]> {
  const lignes = await prisma.rencontre.findMany({
    where: { clientId },
    select: {
      id: true,
      titre: true,
      type: true,
      debutPrevu: true,
      statut: true,
      projetId: true,
      estTestInterne: true,
      suivi: { select: { issue: true } },
      comptesRendus: {
        where: { statut: { in: ["valide", "brouillon", "a_valider"] } },
        select: { statut: true, contenu: true, valideLe: true },
      },
      emailsSuivi: {
        select: { creeLe: true, emailOutbox: { select: { statut: true } } },
        orderBy: { creeLe: "desc" },
      },
      traitements: { where: { etape: "email_suivi" }, select: { statut: true }, take: 1 },
    },
    orderBy: [{ debutPrevu: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });
  return lignes.map((r) => {
    const valide = r.comptesRendus.find((c) => c.statut === "valide");
    return {
      id: r.id,
      titre: r.titre,
      type: r.type,
      debutPrevu: r.debutPrevu,
      statut: r.statut,
      projetId: r.projetId,
      estTestInterne: r.estTestInterne,
      issue: r.suivi?.issue ?? null,
      compteRenduValide:
        valide !== undefined
          ? { valideLe: valide.valideLe, enBref: enBrefDuContenu(lire(valide.contenu)) }
          : null,
      compteRenduEnCours: r.comptesRendus.some((c) => c.statut !== "valide"),
      emailsSuivi: (() => {
        const lignes = r.emailsSuivi.map((e) => ({
          creeLe: e.creeLe,
          statut: e.emailOutbox?.statut ?? null,
        }));
        const etats = etatsDesEmailsSuivi(lignes, r.traitements[0]?.statut ?? null);
        return lignes.map((l, i) => ({ creeLe: l.creeLe, etat: etats[i]! }));
      })(),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Les trois lectures nommées de « Préparer » (plan §3.13, vérification C15)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La dernière suite convenue, sur les rencontres du projet choisi — ou, sans
 * projet choisi, sur les SEULES rencontres de l'entreprise (`projetId: null`) :
 * plan §3.13 bloc 1, « projet non choisi : portée entreprise seulement ». La
 * suite d'une rencontre de projet n'apparaît jamais hors de ce projet.
 * Les rencontres sans date prévue passent en dernier (Postgres met les NULL
 * en tête d'un tri décroissant).
 */
export async function lireDernierSuivi(
  clientId: string,
  projetId: string | null,
): Promise<DernierSuivi | null> {
  const ligne = await prisma.rencontreSuivi.findFirst({
    where: {
      rencontre: { clientId, projetId },
      valideLe: { not: null },
    },
    select: {
      suite: true,
      suiteLe: true,
      rencontre: { select: { titre: true } },
    },
    orderBy: { rencontre: { debutPrevu: { sort: "desc", nulls: "last" } } },
  });
  if (ligne === null) return null;
  return {
    suite: ligne.suite as RendezVousSuite | null,
    suiteLe: ligne.suiteLe,
    rencontreTitre: ligne.rencontre.titre,
  };
}

/** Questions de questionnaire envoyées, sans réponse, pour les projets ouverts du client. */
export async function lireQuestionsSansReponse(clientId: string): Promise<QuestionSansReponse[]> {
  const lignes = await prisma.questionnaireQuestion.findMany({
    where: {
      reponse: null,
      questionnaire: { clientId, statut: { in: ["copie", "reponse_recue"] } },
    },
    select: { id: true, texte: true, questionnaire: { select: { projetId: true } } },
    orderBy: { ordre: "asc" },
  });
  return lignes
    .map((l) => ({ id: l.id, texte: lire(l.texte) ?? "", projetId: l.questionnaire.projetId }))
    .filter((q) => q.texte !== "");
}

export async function lireComptesRendusNonValides(
  clientId: string,
): Promise<CompteRenduNonValide[]> {
  const lignes = await prisma.compteRendu.findMany({
    where: { rencontre: { clientId }, statut: { in: ["brouillon", "a_valider"] } },
    select: { rencontreId: true, createdAt: true, rencontre: { select: { titre: true } } },
    orderBy: { createdAt: "asc" },
  });
  return lignes.map((l) => ({
    rencontreId: l.rencontreId,
    rencontreTitre: l.rencontre.titre,
    depuis: l.createdAt,
  }));
}

export async function lireEnregistrementsRefuses(clientId: string): Promise<Date[]> {
  const lignes = await prisma.enregistrement.findMany({
    where: { rencontre: { clientId }, statut: "refuse" },
    select: { debut: true },
    orderBy: { debut: "desc" },
  });
  return lignes.map((l) => l.debut);
}

export interface EvenementDeProjet {
  readonly action: string;
  readonly ancienStatut: ProjetStatut | null;
  readonly nouveauStatut: ProjetStatut | null;
  readonly survenuLe: Date;
}

export async function lireHistoriqueProjet(projetId: string): Promise<EvenementDeProjet[]> {
  return prisma.projetEvenement.findMany({
    where: { projetId },
    select: { action: true, ancienStatut: true, nouveauStatut: true, survenuLe: true },
    orderBy: { survenuLe: "desc" },
  });
}

/**
 * Les phrases exactes (citations VÉRIFIÉES) de faits validés, déchiffrées —
 * pour l'aide au devis (PR 7). ⚠️ Appelée seulement pour un rôle de
 * `ROLES_DOSSIER_ECHANGES` : pour tout autre rôle, la page ne l'appelle pas et
 * l'aide rend `citations: null`.
 */
export async function lireCitationsDesFaits(
  ids: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const lignes = await prisma.fait.findMany({
    where: { id: { in: [...ids] }, statut: "valide", citationVerifiee: true },
    select: { id: true, citation: true },
  });
  const sortie = new Map<string, string>();
  for (const l of lignes) {
    const c = lire(l.citation);
    if (c !== null && c !== "") sortie.set(l.id, c);
  }
  return sortie;
}

export interface QuestionDuQuestionnaire {
  readonly id: string;
  readonly ordre: number;
  readonly texte: string;
  readonly poseeDeViveVoix: boolean;
  readonly reponse: string | null;
  /** Faits tirés de la réponse (proposés, en attente ou validés). */
  readonly faits: ReadonlyArray<{
    readonly id: string;
    readonly statut: FaitStatut;
    readonly enonce: string;
    readonly citation: string | null;
  }>;
}

export interface QuestionnaireDuProjet {
  readonly id: string;
  readonly version: number;
  readonly statut: "brouillon" | "copie" | "reponse_recue" | "clos";
  /** Vrai tant que le worker n'a pas rempli les questions. */
  readonly enPreparation: boolean;
  /** En préparation, mais l'étape ne tourne plus (échec, suspension) : à relancer. */
  readonly preparationEchouee: boolean;
  readonly genereLe: Date;
  /** `en_ligne` : le client répond sur la page publique (lien secret). */
  readonly mode: "a_copier" | "en_ligne";
  readonly reponseRecueLe: Date | null;
  /** « Qui répond ? » saisi par le client en ligne (ligne d'ordre 0), ou `null`. */
  readonly repondant: string | null;
  /** L'URL publique du questionnaire, montrée à Will (`null` hors `en_ligne`). */
  readonly lienEnLigne: string | null;
  /** « Écrire mes questions » remplacerait-il cette version (`versionRemplacable`) ? */
  readonly remplacable: boolean;
  readonly questions: ReadonlyArray<QuestionDuQuestionnaire>;
}

/** Le dernier questionnaire de cadrage d'un projet (PR 7), paroles déchiffrées. */
export async function lireQuestionnaireDuProjet(
  projetId: string,
): Promise<QuestionnaireDuProjet | null> {
  const q = await prisma.questionnaireCadrage.findFirst({
    where: { projetId },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      statut: true,
      modele: true,
      genereLe: true,
      mode: true,
      reponseRecueLe: true,
      questions: {
        orderBy: { ordre: "asc" },
        select: {
          id: true,
          ordre: true,
          texte: true,
          poseeDeViveVoix: true,
          reponse: true,
          reponseRecueLe: true,
          _count: { select: { faitsProduits: true } },
          faitsProduits: {
            where: { statut: { in: ["propose", "en_attente", "valide"] } },
            select: { id: true, statut: true, enonce: true, citation: true },
          },
        },
      },
    },
  });
  if (!q) return null;
  // La ligne d'ordre 0 n'est pas une question : c'est « Qui répond ? », saisi en ligne.
  const quiRepond = q.questions.find((x) => x.ordre === ORDRE_QUI_REPOND);
  const questions = q.questions.filter((x) => x.ordre !== ORDRE_QUI_REPOND);
  const enPreparation = q.statut === "brouillon" && q.modele === null && questions.length === 0;
  // L'étape `questionnaire` s'attache à une rencontre du projet (l'ancrage) :
  // si aucune n'est en vol, la préparation a échoué et se relance.
  const etapes = enPreparation
    ? await prisma.traitementVisio.findMany({
        where: { etape: "questionnaire", rencontre: { projetId } },
        select: { statut: true },
      })
    : [];
  return {
    id: q.id,
    version: q.version,
    statut: q.statut,
    enPreparation,
    preparationEchouee: preparationEchouee(
      enPreparation,
      etapes.map((e) => e.statut),
    ),
    genereLe: q.genereLe,
    mode: q.mode,
    reponseRecueLe: q.reponseRecueLe,
    repondant: quiRepond ? lire(quiRepond.reponse) : null,
    lienEnLigne: q.mode === "en_ligne" ? urlQuestionnaire(q.id) : null,
    remplacable: versionRemplacable({
      statut: q.statut,
      modele: q.modele,
      questions: questions.map((x) => ({
        reponseRecueLe: x.reponseRecueLe,
        faits: x._count.faitsProduits,
      })),
    }),
    questions: questions.map((x) => ({
      id: x.id,
      ordre: x.ordre,
      texte: lire(x.texte) ?? "",
      poseeDeViveVoix: x.poseeDeViveVoix,
      reponse: lire(x.reponse),
      faits: x.faitsProduits.map((f) => ({
        id: f.id,
        statut: f.statut,
        enonce: lire(f.enonce) ?? "",
        citation: lire(f.citation),
      })),
    })),
  };
}

export interface EmailSuiviDuDossier {
  readonly id: string;
  readonly rencontreId: string;
  readonly contactNom: string;
  readonly creeLe: Date;
  /** `null` : pas (ou plus) dans « E-mails à valider » — voir `etat`. */
  readonly statut: EmailOutboxStatus | null;
  /** Ce que Will lit (`etat-email-suivi.ts`) : jamais « en préparation » pour un échec. */
  readonly etat: EtatEmailSuivi;
  readonly sujet: string | null;
  readonly envoyeLe: Date | null;
}

/**
 * Les e-mails de suivi d'UNE rencontre, avec le destinataire et l'objet, leur
 * état LU dans `email_outbox` — vue « E-mail de suivi » (PR 7). L'onglet
 * Échanges, lui, lit l'état par `lireRencontresDuClient`.
 */
export async function lireEmailsDeSuivi(rencontreId: string): Promise<EmailSuiviDuDossier[]> {
  const lignes = await prisma.emailSuivi.findMany({
    where: { rencontreId },
    orderBy: { creeLe: "desc" },
    take: 50,
    select: {
      id: true,
      rencontreId: true,
      contactId: true,
      creeLe: true,
      emailOutbox: { select: { statut: true, sujet: true, envoyeAt: true } },
    },
  });
  const contacts = await prisma.clientContact.findMany({
    where: { id: { in: [...new Set(lignes.map((l) => l.contactId))] } },
    select: { id: true, nom: true },
  });
  const nomDe = new Map(contacts.map((c) => [c.id, c.nom]));
  const etape = await prisma.traitementVisio.findFirst({
    where: { rencontreId, etape: "email_suivi" },
    select: { statut: true },
  });
  const etats = etatsDesEmailsSuivi(
    lignes.map((l) => ({ creeLe: l.creeLe, statut: l.emailOutbox?.statut ?? null })),
    etape?.statut ?? null,
  );
  return lignes.map((l, i) => ({
    id: l.id,
    etat: etats[i]!,
    rencontreId: l.rencontreId,
    contactNom: nomDe.get(l.contactId) ?? "—",
    creeLe: l.creeLe,
    statut: l.emailOutbox?.statut ?? null,
    sujet: l.emailOutbox?.sujet ?? null,
    envoyeLe: l.emailOutbox?.envoyeAt ?? null,
  }));
}
