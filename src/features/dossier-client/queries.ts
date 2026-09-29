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
import type { FaitAConsolider } from "@/features/dossier-client/consolider-faits";
import type {
  CompteRenduNonValide,
  DernierSuivi,
  PersonneDuClient,
  ProjetResume,
  QuestionSansReponse,
} from "@/features/dossier-client/preparer";

export const TEXTE_ILLISIBLE = "(illisible : clé de chiffrement absente)";

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

/** Les faits d'un client (tous les statuts utiles), énoncés déchiffrés. */
export async function lireFaitsDuClient(clientId: string): Promise<FaitDuDossier[]> {
  const lignes = await prisma.fait.findMany({
    where: { clientId, statut: { in: STATUTS_LUS } },
    select: {
      id: true,
      type: true,
      cle: true,
      portee: true,
      projetId: true,
      statut: true,
      suivi: true,
      enonce: true,
      texteCourt: true,
      montantMinCents: true,
      montantMaxCents: true,
      dateCible: true,
      quantite: true,
      refCatalogue: true,
      constateLe: true,
      citationDebutMs: true,
      rencontreId: true,
      contactSujetId: true,
      relation: true,
      relationAvecFaitId: true,
      remplaceParId: true,
      citationVerifiee: true,
    },
    orderBy: { constateLe: "desc" },
  });
  return lignes.map((l) => ({
    ...l,
    enonce: l.statut === "efface" ? "" : (lire(l.enonce) ?? ""),
    texteCourt: l.statut === "efface" ? null : lire(l.texteCourt),
  }));
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
    readonly statut: EmailOutboxStatus | null;
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
      emailsSuivi: r.emailsSuivi.map((e) => ({
        creeLe: e.creeLe,
        statut: e.emailOutbox?.statut ?? null,
      })),
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
