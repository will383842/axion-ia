/**
 * Qualiopi — Lecture CRM clients.
 *
 * Stub-aware (try/catch → [] / null). Jamais de `*OrThrow`. Tri par numéro.
 */

import { prisma } from "@/lib/prisma";
import type { Client, ClientStatut } from "@/server/qualiopi/crm/types";

export interface ListClientsOpts {
  /** Filtre par statut. */
  statut?: ClientStatut;
  /** Limite (défaut 200). */
  limit?: number;
  /** Offset pour pagination. */
  offset?: number;
}

/** Tous les clients CRM, triés par numéro. Stub-safe → [] au build. */
export async function listClients(opts?: ListClientsOpts): Promise<Client[]> {
  try {
    const rows = await prisma.client.findMany({
      ...(opts?.statut ? { where: { statut: opts.statut } } : {}),
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
