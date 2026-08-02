/**
 * Qualiopi — Lecture CRM clients.
 *
 * Stub-aware (try/catch → [] / null). Jamais de `*OrThrow`. Tri par numéro.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../prisma/generated/client";
import type { Client, ClientStatut } from "@/server/qualiopi/crm/types";
import { estFactureOuverte } from "@/server/qualiopi/financements/statuts-facture";

export interface ListClientsOpts {
  /** Filtre par statut. */
  statut?: ClientStatut;
  /**
   * Recherche libre : raison sociale, SIRET, SIREN, numéro de fiche, contact.
   *
   * 🔴 Les identifiants sont NORMALISÉS avant comparaison. Un SIRET se lit
   * « 123 456 789 00011 » sur un Kbis, se copie avec ses espaces, et se stocke
   * sans. Comparer les chaînes telles quelles ne trouve rien — et l'utilisateur
   * en conclut que le client n'existe pas, puis le recrée en double.
   */
  recherche?: string;
  /** Limite (défaut 200). */
  limit?: number;
  /** Offset pour pagination. */
  offset?: number;
}

/**
 * Ne garde que les chiffres.
 *
 * Employé sur SIRET et SIREN, qui n'en contiennent que. Un utilisateur colle
 * « 123 456 789 00011 » ou « 123.456.789.00011 » ; la base stocke « 12345678900011 ».
 */
function chiffresSeuls(valeur: string): string {
  return valeur.replace(/\D/g, "");
}

/**
 * Construit le filtre de recherche.
 *
 * ⚠️ `mode: "insensitive"` sur la raison sociale : personne ne tape « SCI INVEST
 * SUN » en majuscules pour retrouver sa fiche. Sur les identifiants numériques
 * la casse n'existe pas, la normalisation suffit.
 *
 * ⚠️ Une recherche purement numérique interroge AUSSI la raison sociale : des
 * sociétés portent un chiffre dans leur nom, et l'exclure produirait un « aucun
 * résultat » incompréhensible.
 */
function filtreRecherche(terme: string): Prisma.ClientWhereInput | null {
  const q = terme.trim();
  if (q === "") return null;

  const ou: Prisma.ClientWhereInput[] = [
    { raisonSociale: { contains: q, mode: "insensitive" } },
    { numero: { contains: q, mode: "insensitive" } },
    { contactNom: { contains: q, mode: "insensitive" } },
    { contactEmail: { contains: q, mode: "insensitive" } },
  ];

  // Identifiants légaux : on compare sur la forme normalisée, pas sur ce qui a
  // été tapé. Un SIRET partiel (les 9 premiers chiffres = le SIREN) doit
  // trouver l'établissement : `startsWith` plutôt qu'égalité stricte.
  const chiffres = chiffresSeuls(q);
  if (chiffres.length >= 3) {
    ou.push({ siret: { startsWith: chiffres } }, { siren: { startsWith: chiffres } });
  }

  return { OR: ou };
}

/** Tous les clients CRM, triés par numéro. Stub-safe → [] au build. */
export async function listClients(opts?: ListClientsOpts): Promise<Client[]> {
  try {
    const filtres: Prisma.ClientWhereInput[] = [];
    if (opts?.statut) filtres.push({ statut: opts.statut });
    const recherche = opts?.recherche === undefined ? null : filtreRecherche(opts.recherche);
    if (recherche !== null) filtres.push(recherche);

    const rows = await prisma.client.findMany({
      ...(filtres.length > 0 ? { where: { AND: filtres } } : {}),
      orderBy: { numero: "asc" },
      ...(opts?.limit !== undefined ? { take: opts.limit } : {}),
      ...(opts?.offset !== undefined ? { skip: opts.offset } : {}),
    });
    return rows;
  } catch {
    return [];
  }
}

/** Client par id UUID. Stub-safe → null. */
export async function getClient(id: string): Promise<Client | null> {
  try {
    return await prisma.client.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/** Client par numéro AXI-CLI-NNN. Stub-safe → null. */
export async function getClientByNumero(numero: string): Promise<Client | null> {
  try {
    return await prisma.client.findUnique({ where: { numero } });
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vue 360° — un client, toutes ses affaires (fiche clients/[id])
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Include de la fiche 360°. UNE requête `findUnique` : chaque relation est
 * plafonnée à 10 lignes (la fiche affiche « les 10 derniers », les listes
 * dédiées font le reste), SAUF `facturesFormation`.
 *
 * ⚠️ `facturesFormation` est volontairement SANS `take` : l'encours dû se
 * calcule sur TOUTES les factures ouvertes du client. Un `take: 10` rendrait le
 * chiffre silencieusement faux dès la 11ᵉ facture — un montant tronqué est
 * pire qu'un montant absent. La volumétrie par client (dizaines de factures au
 * plus) rend le sur-coût négligeable ; l'affichage, lui, se limite aux 10
 * premières côté page.
 */
const CLIENT_360_INCLUDE = {
  sessions: {
    orderBy: { dateDebut: "desc" },
    take: 10,
    select: {
      id: true,
      numero: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      statut: true,
    },
  },
  coachingContracts: {
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      numero: true,
      interventionSlug: true,
      montantHtCents: true,
      dateSigneeAt: true,
      createdAt: true,
    },
  },
  auditMissions: {
    orderBy: { dateDebut: "desc" },
    take: 10,
    select: {
      id: true,
      numero: true,
      titre: true,
      dateDebut: true,
      dateFin: true,
      statut: true,
    },
  },
  devis: {
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      numero: true,
      statut: true,
      montantTotalHtCents: true,
      createdAt: true,
    },
  },
  facturesFormation: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      numero: true,
      statut: true,
      avoirDeId: true,
      montantHtCents: true,
      montantTtcCents: true,
      emiseAt: true,
      echeanceAt: true,
      createdAt: true,
      payments: { select: { amountCents: true, status: true } },
      avoirs: { select: { montantHtCents: true, montantTtcCents: true, statut: true } },
    },
  },
  documents: {
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, type: true, numero: true, createdAt: true },
  },
  dossiersFinancement: {
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      type: true,
      statut: true,
      financeurNom: true,
      echeanceFinanceurAt: true,
      createdAt: true,
    },
  },
  // Seuls les e-mails encore À VALIDER intéressent la fiche : un compteur qui
  // mélangerait l'historique envoyé dirait « 47 » sans rien signifier.
  _count: { select: { emailsEnAttente: { where: { statut: "a_valider" } } } },
} satisfies Prisma.ClientInclude;

/** Payload exact de `getClient360` — dérivé de l'include, pas dupliqué à la main. */
export type Client360 = Prisma.ClientGetPayload<{ include: typeof CLIENT_360_INCLUDE }>;

/** Ligne de facture minimale pour le calcul d'encours (sous-ensemble de Client360). */
export interface FactureEncoursInput {
  statut: string;
  avoirDeId: string | null;
  montantHtCents: number;
  montantTtcCents: number | null;
  payments: { amountCents: number; status: string }[];
  avoirs: { montantHtCents: number; montantTtcCents: number | null; statut: string }[];
}

/**
 * Reste dû net d'UNE facture — même formule que la fiche facture
 * (`facturation/[id]/page.tsx`) : TTC (repli HT) + avoirs non annulés (montants
 * NÉGATIFS en base) − encaissements `succeeded`.
 */
export function resteDuNetCents(f: FactureEncoursInput): number {
  const ttc = f.montantTtcCents ?? f.montantHtCents;
  const avoirsTtc = f.avoirs
    .filter((a) => a.statut !== "annulee")
    .reduce((acc, a) => acc + (a.montantTtcCents ?? a.montantHtCents), 0);
  const encaisse = f.payments
    .filter((p) => p.status === "succeeded")
    .reduce((acc, p) => acc + p.amountCents, 0);
  return ttc + avoirsTtc - encaisse;
}

/**
 * Encours dû d'un client : somme des restes dus nets de ses factures OUVERTES
 * (`emise`, `partiellement_payee`, `en_retard`). Les avoirs (`avoirDeId` non
 * null) sont exclus du périmètre : ils entrent déjà, en négatif, dans le reste
 * dû de la facture qu'ils corrigent — les compter à part les déduirait deux fois.
 */
export function calculerEncoursDuCents(factures: FactureEncoursInput[]): number {
  return factures
    .filter((f) => f.avoirDeId === null && estFactureOuverte(f.statut))
    .reduce((acc, f) => acc + resteDuNetCents(f), 0);
}

/** Fiche 360° d'un client (une seule requête, include plafonné). Stub-safe → null. */
export async function getClient360(id: string): Promise<Client360 | null> {
  try {
    return await prisma.client.findUnique({ where: { id }, include: CLIENT_360_INCLUDE });
  } catch {
    return null;
  }
}
