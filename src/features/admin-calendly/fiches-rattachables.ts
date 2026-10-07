// Les fiches qu'on peut rattacher à un rendez-vous — pour le SÉLECTEUR de la
// fiche d'un appel (2026-09-19).
//
// ── Ce que ce module remplace ─────────────────────────────────────────────
// Le rattachement manuel se faisait en recopiant un UUID dans un champ texte.
// Personne ne le faisait : il fallait ouvrir la demande dans un autre onglet,
// trouver son identifiant dans l'URL, revenir, coller. Mesure R5 du 19/09 :
// 37 rendez-vous, 37 rattachés à rien.
//
// ── Ce que le sélecteur propose ───────────────────────────────────────────
//   1. les fiches de la MÊME PERSONNE (même empreinte d'adresse) — le cas
//      normal, et celui que le rattachement automatique couvre déjà pour un
//      échange apporteur ;
//   1 bis. les fiches apporteur dont le NOM correspond, quand l'adresse diffère
//      (2026-10-05) : un candidat venu d'Indeed porte sur sa fiche une adresse
//      RELAIS (`marienoelmafogangocxep_uuo@indeedemail.com`), alors qu'il
//      réserve Calendly avec sa vraie adresse. Aucune empreinte ne correspond,
//      et la fiche, vieille de plusieurs semaines, sort de la fenêtre des
//      récentes : l'échange restait rattaché à rien et l'e-mail d'issue était
//      bloqué. On PROPOSE ; on ne rattache jamais seul sur une ressemblance ;
//   2. les fiches RÉCENTES du même public (apporteurs pour un échange
//      apporteur, le reste pour un appel client) — pour la personne qui a
//      réservé avec une autre adresse que celle de sa demande ;
//   3. la fiche DÉJÀ rattachée, même si elle ne tombe dans aucun des deux
//      groupes : un sélecteur qui ne sait pas afficher la valeur courante la
//      ferait disparaître au premier enregistrement.
//
// Lecture seule. Appelé par la fiche d'un appel, APRÈS `gardeLectureAppels`.

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { estApporteur, FILTRE_APPORTEUR_PRISMA } from "@/lib/commercial-application/est-apporteur";
import { resolveSubmissionLabel } from "@/features/admin-submissions/type-labels";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { JOURS_FICHES_RECENTES } from "@/lib/calendly/fenetre-rattachement";
import { motsDuNom, nomCorrespond } from "@/lib/calendly/nom-fiche";

export { motsDuNom, nomCorrespond };

export type GroupeFiche = "meme-personne" | "nom-probable" | "recentes" | "actuelle" | "recherche";

export interface FicheRattachable {
  id: string;
  libelle: string;
  groupe: GroupeFiche;
  /** Titre du groupe, affiché par le sélecteur (qui ne le recalcule pas : poids du bundle). */
  intitule: string;
}

// Fenêtre des fiches « récentes » : déclarée dans un module PUR, parce que le
// sélecteur qui l'annonce est un composant client (voir l'en-tête là-bas).
export { JOURS_FICHES_RECENTES };
const INTITULE_GROUPE: Record<GroupeFiche, string> = {
  actuelle: "Fiche rattachée",
  "meme-personne": "Même adresse e-mail",
  "nom-probable": "Même nom, autre adresse (à vérifier)",
  recentes: `Reçues ces ${JOURS_FICHES_RECENTES} derniers jours`,
  recherche: "Résultats de la recherche",
};
const PLAFOND_PAR_GROUPE = 25;
const PLAFOND_NOM_PROBABLE = 5;
/** Combien de dossiers apporteur on relit (et déchiffre) pour chercher un nom. */
const PLAFOND_LECTURE_NOMS = 600;

const SELECT = {
  id: true,
  type: true,
  details: true,
  submittedAt: true,
  contactName: true,
} as const;

const SELECT_NOM = { ...SELECT, contactEmail: true } as const;

interface Ligne {
  id: string;
  type: string;
  details: unknown;
  submittedAt: Date;
  contactName: string | null;
}

function dechiffrer(v: string | null | undefined): string | null {
  if (!v) return null;
  try {
    const clair = decryptPii(v);
    return typeof clair === "string" && clair.length > 0 ? clair : null;
  } catch {
    return null;
  }
}

function libelle(l: Ligne): string {
  const d =
    l.details && typeof l.details === "object" && !Array.isArray(l.details)
      ? (l.details as { unifiedType?: unknown })
      : null;
  const nature = estApporteur(l.details)
    ? "Dossier apporteur"
    : resolveSubmissionLabel(l.type, typeof d?.unifiedType === "string" ? d.unifiedType : null);
  const nom = dechiffrer(l.contactName);
  return [nature, nom, `reçu le ${formatDateFrShort(l.submittedAt)}`].filter(Boolean).join(" · ");
}

export async function listerFichesRattachables(rdv: {
  inviteeEmail: string | null;
  inviteeName?: string | null;
  linkedSubmissionId: string | null;
  estEchangeApporteur: boolean;
}): Promise<FicheRattachable[]> {
  // L'empreinte peut lever en production si la clé manque : le sélecteur perd
  // alors son premier groupe, il ne fait pas tomber la fiche.
  let empreinte: string | null = null;
  try {
    empreinte = hashEmailForLookup(rdv.inviteeEmail);
  } catch {
    empreinte = null;
  }

  const depuis = new Date(Date.now() - JOURS_FICHES_RECENTES * 86_400_000);
  const mots = rdv.estEchangeApporteur ? motsDuNom(rdv.inviteeName) : [];
  const [memePersonne, recentes, actuelle, dossiersNommes] = await Promise.all([
    empreinte
      ? prisma.submission.findMany({
          where: { contactEmailHash: empreinte, deletedAt: null },
          orderBy: { submittedAt: "desc" },
          take: PLAFOND_PAR_GROUPE,
          select: SELECT,
        })
      : Promise.resolve([] as Ligne[]),
    // Le groupe « récentes » suit le public du rendez-vous. Côté apporteur, la
    // clause JSON est POSITIVE ; côté client, on ne peut pas écrire son
    // contraire en base sans perdre les lignes sans clé (un `NOT` sur un chemin
    // JSON les exclut aussi) : on filtre donc en mémoire.
    prisma.submission.findMany({
      where: {
        deletedAt: null,
        submittedAt: { gte: depuis },
        ...(rdv.estEchangeApporteur ? FILTRE_APPORTEUR_PRISMA : {}),
      },
      orderBy: { submittedAt: "desc" },
      take: PLAFOND_PAR_GROUPE * 2,
      select: SELECT,
    }),
    rdv.linkedSubmissionId
      ? prisma.submission.findUnique({ where: { id: rdv.linkedSubmissionId }, select: SELECT })
      : Promise.resolve(null),
    // Seulement pour un échange apporteur dont le nom se cherche (deux mots).
    mots.length > 0
      ? prisma.submission.findMany({
          where: { deletedAt: null, ...FILTRE_APPORTEUR_PRISMA },
          orderBy: { submittedAt: "desc" },
          take: PLAFOND_LECTURE_NOMS,
          select: SELECT_NOM,
        })
      : Promise.resolve([] as Array<Ligne & { contactEmail: string | null }>),
  ]);

  const vus = new Set<string>();
  const fiches: FicheRattachable[] = [];
  const ajouter = (l: Ligne, groupe: GroupeFiche): void => {
    if (vus.has(l.id)) return;
    vus.add(l.id);
    fiches.push({ id: l.id, libelle: libelle(l), groupe, intitule: INTITULE_GROUPE[groupe] });
  };

  if (actuelle) ajouter(actuelle as Ligne, "actuelle");
  for (const l of memePersonne as Ligne[]) ajouter(l, "meme-personne");
  let probables = 0;
  for (const l of dossiersNommes as Array<Ligne & { contactEmail: string | null }>) {
    if (probables >= PLAFOND_NOM_PROBABLE) break;
    if (vus.has(l.id) || !estApporteur(l.details)) continue;
    if (!nomCorrespond(mots, dechiffrer(l.contactName), dechiffrer(l.contactEmail))) continue;
    ajouter(l, "nom-probable");
    probables += 1;
  }
  let n = 0;
  for (const l of recentes as Ligne[]) {
    if (n >= PLAFOND_PAR_GROUPE) break;
    if (estApporteur(l.details) !== rdv.estEchangeApporteur) continue;
    if (vus.has(l.id)) continue;
    ajouter(l, "recentes");
    n += 1;
  }
  return fiches;
}

// ── RECHERCHE LIBRE (2026-10-07, cas « Krafft ») ──────────────────────────
// Un échange réservé sous un nom d'un seul mot (« Krafft »), avec une autre
// adresse que celle de la candidature : aucun groupe ci-dessus ne le retrouve
// (pas de recherche par un seul mot, adresse différente, fiche hors des 25
// récentes). Will restait bloqué sur « Rattache-le d'abord ». On cherche donc
// dans TOUTES les fiches du même public, sur le nom, l'adresse et le téléphone,
// un seul mot accepté. On PROPOSE ; rien n'est rattaché sans l'enregistrement.

/** Combien de fiches on relit (et déchiffre) pour une recherche. */
const PLAFOND_LECTURE_RECHERCHE = 3000;
/** Combien de résultats on rend. */
const PLAFOND_RESULTATS_RECHERCHE = 20;

/** Minuscules, sans accents ni ponctuation superflue : « Élodie » → « elodie ». */
export function normaliserRecherche(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Une fiche correspond-elle à la recherche ? Chaque terme doit se trouver dans le
 * nom, l'adresse ou le téléphone (chiffres seuls pour un terme de chiffres).
 */
export function ficheCorrespond(
  termes: readonly string[],
  f: { nom: string | null; email: string | null; telephone: string | null },
): boolean {
  if (termes.length === 0) return false;
  const texte = normaliserRecherche(`${f.nom ?? ""} ${f.email ?? ""}`);
  const chiffres = (f.telephone ?? "").replace(/\D/g, "");
  return termes.every((t) => {
    const tc = t.replace(/\D/g, "");
    if (tc.length >= 4 && tc.length === t.replace(/[\s.+()-]/g, "").length) {
      // Un numéro : comparé sur ses 9 derniers chiffres (0612… = +33612…).
      return chiffres.includes(tc.slice(-9));
    }
    return texte.includes(t);
  });
}

export async function rechercherFichesRattachables(
  q: string,
  estEchangeApporteur: boolean,
): Promise<FicheRattachable[]> {
  const termes = normaliserRecherche(q)
    .split(" ")
    .filter((t) => t.length >= 2);
  if (termes.length === 0) return [];
  const lignes = (await prisma.submission.findMany({
    where: { deletedAt: null, ...(estEchangeApporteur ? FILTRE_APPORTEUR_PRISMA : {}) },
    orderBy: { submittedAt: "desc" },
    take: PLAFOND_LECTURE_RECHERCHE,
    select: { ...SELECT_NOM, contactPhone: true },
  })) as Array<Ligne & { contactEmail: string | null; contactPhone: string | null }>;
  const resultats: FicheRattachable[] = [];
  for (const l of lignes) {
    if (resultats.length >= PLAFOND_RESULTATS_RECHERCHE) break;
    if (estApporteur(l.details) !== estEchangeApporteur) continue;
    const fiche = {
      nom: dechiffrer(l.contactName),
      email: dechiffrer(l.contactEmail),
      telephone: dechiffrer(l.contactPhone),
    };
    if (!ficheCorrespond(termes, fiche)) continue;
    // L'adresse dans le libellé : deux homonymes se distinguent, et c'est la donnée
    // qui dit à Will qu'il tient la bonne personne (adresse relais Indeed, etc.).
    const lib = [libelle(l), fiche.email].filter(Boolean).join(" · ");
    resultats.push({
      id: l.id,
      libelle: lib,
      groupe: "recherche",
      intitule: INTITULE_GROUPE.recherche,
    });
  }
  return resultats;
}
