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

export type GroupeFiche = "meme-personne" | "recentes" | "actuelle";

export interface FicheRattachable {
  id: string;
  libelle: string;
  groupe: GroupeFiche;
}

// Fenêtre des fiches « récentes » : déclarée dans un module PUR, parce que le
// sélecteur qui l'annonce est un composant client (voir l'en-tête là-bas).
export { JOURS_FICHES_RECENTES };
const PLAFOND_PAR_GROUPE = 25;

const SELECT = {
  id: true,
  type: true,
  details: true,
  submittedAt: true,
  contactName: true,
} as const;

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
  const [memePersonne, recentes, actuelle] = await Promise.all([
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
  ]);

  const vus = new Set<string>();
  const fiches: FicheRattachable[] = [];
  const ajouter = (l: Ligne, groupe: GroupeFiche): void => {
    if (vus.has(l.id)) return;
    vus.add(l.id);
    fiches.push({ id: l.id, libelle: libelle(l), groupe });
  };

  if (actuelle) ajouter(actuelle as Ligne, "actuelle");
  for (const l of memePersonne as Ligne[]) ajouter(l, "meme-personne");
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
