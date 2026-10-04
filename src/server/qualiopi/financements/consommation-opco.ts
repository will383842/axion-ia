/**
 * Qualiopi — Ce que l'OPCO a déjà pris en charge pour un client, par année
 * civile (lot OPCO A7d, manque n°4 de la critique de complétude).
 *
 * L'enveloppe d'un OPCO pour une entreprise est ANNUELLE : ce qui a été accordé
 * en mars n'est plus disponible en octobre. Jusqu'ici l'estimation du devis
 * repartait de l'enveloppe brute. On somme ici, pour un client × OPCO × année :
 *   · ACCORDÉ  : `montantAccordeCents` des dossiers `accord_recu | facture |
 *     paiement_recu | clos` (à défaut de montant d'accord saisi, le montant
 *     demandé : mieux vaut sous-estimer ce qui reste que le promettre) ;
 *   · EN COURS : `montantDemandeCents` des dossiers `envoye` (déposés, sans
 *     réponse) — rendu SÉPARÉMENT, ce n'est pas encore un engagement de l'OPCO.
 * Un dossier `a_monter` n'a rien demandé ; un dossier `refuse` n'a rien pris.
 *
 * Année civile (fuseau de Paris) : celle de la DATE DE DÉBUT de la session liée
 * — c'est l'exercice sur lequel l'OPCO impute la formation —, à défaut celle de
 * l'accord (date portée sur l'accord écrit, puis clic d'accord), puis du dépôt
 * ou de l'envoi, puis de la création du dossier.
 *
 * OPCO du dossier : le nom du financeur quand il désigne un OPCO sans
 * ambiguïté (`suggererOpco`), sinon l'OPCO du client (`opcoDuClient`). Seuls
 * les dossiers `opco` et `mixte` comptent.
 *
 * Lecture stub-safe : une base absente (build `stub.invalid`) ou en échec rend
 * `null` — « consommation inconnue » —, jamais une exception ni un zéro.
 */

import { prisma } from "@/lib/prisma";
import { parisDateISO } from "@/server/qualiopi/presence/time";
import { opcoDuClient, type OpcoClient, type OpcoId } from "./opco-referentiel";
import { suggererOpco } from "./opco-suggestion";

export const STATUTS_ACCORDES = ["accord_recu", "facture", "paiement_recu", "clos"] as const;
export const STATUTS_EN_COURS = ["envoye"] as const;
const TYPES_OPCO = ["opco", "mixte"] as const;

export interface DossierConsommation {
  type: string;
  statut: string;
  financeurNom: string | null;
  montantAccordeCents: number | null;
  montantDemandeCents: number | null;
  accordAt: Date | null;
  accordEcritLe: Date | null;
  envoyeAt: Date | null;
  depotFaitLe: Date | null;
  createdAt: Date;
  /** Date de début de la session liée, s'il y en a une. */
  sessionDateDebut: Date | null;
}

export interface ConsommationOpco {
  annee: number;
  /** Montants accordés par l'OPCO, en centimes. */
  accordeCents: number;
  /** Montants demandés, dossiers déposés sans réponse, en centimes. */
  enCoursCents: number;
}

/** Année civile d'un instant, en heure de Paris. */
export function anneeParis(d: Date): number {
  return Number(parisDateISO(d).slice(0, 4));
}

/** L'année sur laquelle le dossier consomme l'enveloppe (voir l'en-tête). */
export function anneeDuDossier(d: DossierConsommation): number {
  const reference =
    d.sessionDateDebut ??
    d.accordEcritLe ??
    d.accordAt ??
    d.depotFaitLe ??
    d.envoyeAt ??
    d.createdAt;
  return anneeParis(reference);
}

/** L'OPCO d'un dossier : son financeur s'il est reconnu, sinon celui du client. */
export function opcoDuDossier(
  financeurNom: string | null,
  opcoClient: OpcoId | null,
): OpcoId | null {
  return suggererOpco({ opco: null, opcoIdentifie: financeurNom }) ?? opcoClient;
}

function centimes(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
}

/** Agrégation PURE pour un OPCO et une année. */
export function agregerConsommation(
  dossiers: ReadonlyArray<DossierConsommation>,
  opco: OpcoId,
  annee: number,
  opcoClient: OpcoId | null,
): ConsommationOpco {
  let accordeCents = 0;
  let enCoursCents = 0;
  for (const d of dossiers) {
    if (!(TYPES_OPCO as readonly string[]).includes(d.type)) continue;
    if (opcoDuDossier(d.financeurNom, opcoClient) !== opco) continue;
    if (anneeDuDossier(d) !== annee) continue;
    if ((STATUTS_ACCORDES as readonly string[]).includes(d.statut)) {
      accordeCents += centimes(d.montantAccordeCents ?? d.montantDemandeCents);
    } else if ((STATUTS_EN_COURS as readonly string[]).includes(d.statut)) {
      enCoursCents += centimes(d.montantDemandeCents);
    }
  }
  return { annee, accordeCents, enCoursCents };
}

/** Le strict nécessaire du client Prisma (injectable en test). */
interface BaseConsommation {
  dossierFinancement: {
    findMany(args: unknown): Promise<
      Array<
        Omit<DossierConsommation, "sessionDateDebut"> & {
          trainingSession: { dateDebut: Date } | null;
          client: OpcoClient | null;
        }
      >
    >;
  };
}

async function lireDossiers(
  clientId: string,
  db: BaseConsommation,
): Promise<{ dossiers: DossierConsommation[]; opcoClient: OpcoId | null }> {
  const lignes = await db.dossierFinancement.findMany({
    where: {
      clientId,
      type: { in: [...TYPES_OPCO] },
      statut: { in: [...STATUTS_ACCORDES, ...STATUTS_EN_COURS] },
    },
    select: {
      type: true,
      statut: true,
      financeurNom: true,
      montantAccordeCents: true,
      montantDemandeCents: true,
      accordAt: true,
      accordEcritLe: true,
      envoyeAt: true,
      depotFaitLe: true,
      createdAt: true,
      trainingSession: { select: { dateDebut: true } },
      client: { select: { opco: true, opcoIdentifie: true } },
    },
  });
  const opcoClient = opcoDuClient(lignes[0]?.client ?? null);
  return {
    opcoClient,
    dossiers: lignes.map(({ trainingSession, client: _client, ...d }) => ({
      ...d,
      sessionDateDebut: trainingSession?.dateDebut ?? null,
    })),
  };
}

/**
 * Consommation de l'enveloppe d'un OPCO par un client sur une année civile.
 * `null` = inconnue (base indisponible) : l'appelant garde son comportement.
 */
export async function consommationOpcoAnnee(
  clientId: string,
  opco: OpcoId,
  annee: number,
  db: BaseConsommation = prisma as unknown as BaseConsommation,
): Promise<ConsommationOpco | null> {
  const r = await consommationOpcoParAnnee(clientId, opco, [annee], db);
  return r?.[0] ?? null;
}

/** Même lecture pour plusieurs années, en UNE requête (fiche client). */
export async function consommationOpcoParAnnee(
  clientId: string,
  opco: OpcoId,
  annees: ReadonlyArray<number>,
  db: BaseConsommation = prisma as unknown as BaseConsommation,
): Promise<ConsommationOpco[] | null> {
  try {
    const { dossiers, opcoClient } = await lireDossiers(clientId, db);
    return annees.map((a) => agregerConsommation(dossiers, opco, a, opcoClient));
  } catch {
    return null;
  }
}
