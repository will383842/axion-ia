/**
 * Qualiopi — Lecture CRM clients.
 *
 * Stub-aware (try/catch → [] / null). Jamais de `*OrThrow`. Tri par numéro.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../prisma/generated/client";
import type { Client, ClientStatut } from "@/server/qualiopi/crm/types";

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
