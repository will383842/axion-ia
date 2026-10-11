// Conformité RGPD (console) — le journal des incidents EN BASE : lecture et écriture.
// Les textes libres passent par `chiffrerChamps` / `dechiffrerChamps`, ici et nulle
// part ailleurs. ⛔ Aucune suppression : un incident se clôt.

import type { PrismaClient } from "../../../prisma/generated/client";

import { prisma } from "@/lib/prisma";

import type { Auteur } from "./base";
import { chiffrerChamps, dechiffrerChamps, type SaisieIncident } from "./incidents";

type Client = Pick<PrismaClient, "incidentDonnees">;

export interface Incident {
  id: string;
  numero: number;
  decouvertLe: Date;
  survenuLe: Date | null;
  description: string;
  donneesConcernees: string | null;
  nombrePersonnes: number | null;
  categoriesPersonnes: string | null;
  consequences: string | null;
  mesuresPrises: string | null;
  declareCnil: boolean | null;
  declareCnilLe: Date | null;
  motifNonDeclaration: string | null;
  personnesPrevenues: boolean | null;
  personnesPrevenuesLe: Date | null;
  motifNonInformation: string | null;
  statut: "ouvert" | "clos";
  closLe: Date | null;
  creeParNom: string;
  creeLe: Date;
}

const SELECTION = {
  id: true,
  numero: true,
  decouvertLe: true,
  survenuLe: true,
  description: true,
  donneesConcernees: true,
  nombrePersonnes: true,
  categoriesPersonnes: true,
  consequences: true,
  mesuresPrises: true,
  declareCnil: true,
  declareCnilLe: true,
  motifNonDeclaration: true,
  personnesPrevenues: true,
  personnesPrevenuesLe: true,
  motifNonInformation: true,
  statut: true,
  closLe: true,
  creeParNom: true,
  creeLe: true,
} as const;

/** Lecture stub-safe : au build ou sans base, la liste est vide. */
export async function listerIncidents(client: Client = prisma): Promise<Incident[] | null> {
  try {
    const lignes = await client.incidentDonnees.findMany({
      orderBy: [{ statut: "asc" }, { decouvertLe: "desc" }],
      take: 500,
      select: SELECTION,
    });
    return (lignes ?? []).map((l) => dechiffrerChamps(l) as Incident);
  } catch {
    return null;
  }
}

export async function lireIncident(numero: number, client: Client = prisma) {
  if (!Number.isInteger(numero) || numero < 1 || numero > 2_000_000_000) return null;
  const l = await client.incidentDonnees.findUnique({ where: { numero }, select: SELECTION });
  return l ? (dechiffrerChamps(l) as Incident) : null;
}

export async function creerIncident(
  saisie: SaisieIncident,
  auteur: Auteur,
  client: Client = prisma,
): Promise<{ id: string; numero: number }> {
  return client.incidentDonnees.create({
    data: { ...chiffrerChamps(saisie), creeParId: auteur.id, creeParNom: auteur.nom },
    select: { id: true, numero: true },
  });
}

export async function modifierIncident(
  id: string,
  saisie: SaisieIncident,
  client: Client = prisma,
): Promise<number> {
  const { count } = await client.incidentDonnees.updateMany({
    where: { id },
    data: chiffrerChamps(saisie),
  });
  return count;
}
