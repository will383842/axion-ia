/**
 * Lectures de l'en-tête de la fiche (lot B1). LECTURE SEULE : `client_taches`, `EmailOutbox`,
 * `projet_suivis` et `clients_contacts` ne sont jamais écrits ici. Chaque lecture est protégée :
 * une panne devient `{ ok: false }` (affichée « Lecture impossible »), jamais 0 ni « rien ».
 */

import type { Client360 } from "@/server/qualiopi/crm/clients";
import { lireFilDesEchanges } from "@/features/dossier-client/fil-des-echanges";
import { lireProjetsDuClient, lireRencontresDuClient } from "@/features/dossier-client/queries";
import {
  assemblerPrestations,
  lireSuivisDesProjets,
} from "@/features/dossier-client/suivi-prestations";
import { lireQuestionnairesDeLaFiche } from "@/features/dossier-client/questionnaires-de-la-fiche";
import { prisma } from "@/lib/prisma";
import { calculerEncoursDuCents } from "@/server/qualiopi/crm/clients";

/** Ce que la lecture de l'en-tête demande au contexte de la fiche (structurel : `features/` ne remonte pas vers `components/`). */
export interface ContexteEnTete {
  readonly clientId: string;
  readonly adminPrefix: string;
  readonly voitEchanges: boolean;
  readonly maintenant: Date;
}
export type LireClient = (id: string) => Promise<Client360 | null>;

import { calculerPipeline, type PipelineCalcule } from "./pipeline";
import { santeDuCompte, type SanteDuCompte } from "./sante-du-compte";

export type Lecture<T> = { readonly ok: true; readonly valeur: T } | { readonly ok: false };

async function proteger<T>(lecture: () => Promise<T>): Promise<Lecture<T>> {
  try {
    return { ok: true, valeur: await lecture() };
  } catch {
    return { ok: false };
  }
}

export interface TacheOuverte {
  readonly intitule: string;
  readonly echeanceLe: Date;
  readonly responsable: string;
}

export interface QuestionnaireEnTete {
  readonly recus: number;
  readonly attendus: number | null;
  readonly avantLe: Date | null;
}

export interface EnTete {
  readonly statut: string;
  readonly prochaineTache: Lecture<TacheOuverte | null>;
  readonly nbTachesOuvertes: Lecture<number>;
  readonly nbEmailsAValider: Lecture<number>;
  readonly pipeline: Lecture<PipelineCalcule>;
  readonly sante: Lecture<SanteDuCompte>;
  readonly encours: Lecture<{ ttcCents: number; avantLe: Date | null }>;
  /** `null` dans la lecture : aucun questionnaire envoyé. */
  readonly questionnaire: Lecture<QuestionnaireEnTete | null>;
  readonly nbRendezVous: Lecture<number>;
  readonly nbPrestations: Lecture<number>;
  readonly nbPersonnes: Lecture<number>;
  readonly nbDevisEtFactures: Lecture<number>;
}

/** Minuit (UTC) du jour civil de Paris : `echeance_le` est une colonne DATE. */
function aujourdhuiParis(maintenant: Date): Date {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(maintenant);
  return new Date(`${s}T00:00:00.000Z`);
}

async function construire(ctx: ContexteEnTete, lireClient: LireClient): Promise<EnTete | null> {
  const id = ctx.clientId;
  const aujourdhui = aujourdhuiParis(ctx.maintenant);
  const client = await proteger(async () => {
    const c = await lireClient(id);
    if (c === null) throw new Error("fiche illisible");
    return c;
  });

  const [
    prochaineTache,
    nbTachesOuvertes,
    nbTachesEnRetard,
    nbEmailsAValider,
    rendezVous,
    fil,
    projets,
    questionnaires,
    nbPersonnes,
    nbDevis,
  ] = await Promise.all([
    proteger(async () => {
      const t = await prisma.clientTache.findFirst({
        where: { clientId: id, faiteLe: null },
        orderBy: [{ echeanceLe: "asc" }, { createdAt: "asc" }],
        select: { intitule: true, echeanceLe: true, responsableLabel: true },
      });
      return t === null
        ? null
        : { intitule: t.intitule, echeanceLe: t.echeanceLe, responsable: t.responsableLabel };
    }),
    proteger(() => prisma.clientTache.count({ where: { clientId: id, faiteLe: null } })),
    proteger(() =>
      prisma.clientTache.count({
        where: { clientId: id, faiteLe: null, echeanceLe: { lt: aujourdhui } },
      }),
    ),
    proteger(() => prisma.emailOutbox.count({ where: { clientId: id, statut: "a_valider" } })),
    proteger(() => lireRencontresDuClient(id)),
    proteger(() => lireFilDesEchanges(id, ctx.adminPrefix)),
    proteger(async () => {
      const ps = await lireProjetsDuClient(id);
      const suivis = await lireSuivisDesProjets(ps.map((p) => p.id));
      if (suivis === null) throw new Error("suivis illisibles");
      const chances =
        ps.length === 0
          ? []
          : await prisma.projetSuivi.findMany({
              where: { projetId: { in: ps.map((p) => p.id) } },
              select: { projetId: true, probabilitePct: true },
            });
      const parProjet = new Map(chances.map((c) => [c.projetId, c.probabilitePct]));
      return assemblerPrestations(ps, suivis).map((p) => ({
        etape: p.etape as string,
        montantCents: p.montantCents,
        probabilitePct: parProjet.get(p.projetId) ?? null,
      }));
    }),
    proteger(() => lireQuestionnairesDeLaFiche(id)),
    proteger(() => prisma.clientContact.count({ where: { clientId: id, statut: "actif" } })),
    proteger(() => prisma.devis.count({ where: { clientId: id } })),
  ]);

  const sante: Lecture<SanteDuCompte> =
    rendezVous.ok && fil.ok && nbTachesEnRetard.ok && client.ok
      ? {
          ok: true,
          valeur: santeDuCompte({
            maintenant: ctx.maintenant,
            dernierEchangeLe: dernierEchange(rendezVous.valeur, fil.valeur.fil, ctx.maintenant),
            nbFacturesEnRetard: client.valeur.facturesFormation.filter(
              (f) => f.avoirDeId === null && f.statut === "en_retard",
            ).length,
            nbTachesEnRetard: nbTachesEnRetard.valeur,
          }),
        }
      : { ok: false };

  const encours: EnTete["encours"] = client.ok
    ? {
        ok: true,
        valeur: {
          ttcCents: calculerEncoursDuCents(client.valeur.facturesFormation),
          avantLe: plusProcheEcheance(client.valeur.facturesFormation),
        },
      }
    : { ok: false };

  const questionnaire: EnTete["questionnaire"] = questionnaires.ok
    ? { ok: true, valeur: resumerQuestionnaire(questionnaires.valeur) }
    : { ok: false };

  return {
    statut: client.ok ? client.valeur.statut : "",
    prochaineTache,
    nbTachesOuvertes,
    nbEmailsAValider,
    pipeline: projets.ok ? { ok: true, valeur: calculerPipeline(projets.valeur) } : { ok: false },
    sante,
    encours,
    questionnaire,
    nbRendezVous: rendezVous.ok ? { ok: true, valeur: rendezVous.valeur.length } : { ok: false },
    nbPrestations: projets.ok ? { ok: true, valeur: projets.valeur.length } : { ok: false },
    nbPersonnes,
    nbDevisEtFactures:
      nbDevis.ok && client.ok
        ? { ok: true, valeur: nbDevis.valeur + client.valeur.facturesFormation.length }
        : { ok: false },
  };
}

/** Dernier rendez-vous tenu OU dernier e-mail parti (`statutEmail === "sent"`), le plus récent. */
export function dernierEchange(
  rendezVous: ReadonlyArray<{ statut: string | null; debutPrevu: Date | null }>,
  fil: ReadonlyArray<{ genre: string; statutEmail?: string; date: Date }>,
  maintenant: Date,
): Date | null {
  const dates = [
    ...rendezVous
      .filter((r) => r.statut === "tenu" && r.debutPrevu !== null)
      .map((r) => r.debutPrevu!),
    ...fil.filter((x) => x.genre === "email" && x.statutEmail === "sent").map((x) => x.date),
  ].filter((d) => d.getTime() <= maintenant.getTime());
  return dates.length === 0 ? null : new Date(Math.max(...dates.map((d) => d.getTime())));
}

function plusProcheEcheance(
  factures: ReadonlyArray<{ statut: string; avoirDeId: string | null; echeanceAt: Date | null }>,
): Date | null {
  const dates = factures
    .filter(
      (f) =>
        f.avoirDeId === null &&
        ["emise", "partiellement_payee", "en_retard"].includes(f.statut) &&
        f.echeanceAt !== null,
    )
    .map((f) => f.echeanceAt!.getTime());
  return dates.length === 0 ? null : new Date(Math.min(...dates));
}

function resumerQuestionnaire(
  qs: Awaited<ReturnType<typeof lireQuestionnairesDeLaFiche>>,
): QuestionnaireEnTete | null {
  const dernier = qs.find((q) => q.envoyeLe !== null);
  if (dernier === undefined) return null;
  const suivi = dernier.parPersonne?.suivi;
  const avantLe = dernier.parPersonne?.expireLe ?? dernier.expireLe;
  return suivi != null
    ? { recus: suivi.total.recus, attendus: suivi.total.attendus, avantLe }
    : { recus: dernier.reponses.dirigeant, attendus: null, avantLe };
}

/** Une seule lecture par affichage : l'en-tête et les compteurs partagent le même `ctx`. */
const parContexte = new WeakMap<ContexteEnTete, Promise<EnTete | null>>();
export function lireEnTete(ctx: ContexteEnTete, lireClient: LireClient): Promise<EnTete | null> {
  if (!ctx.voitEchanges) return Promise.resolve(null);
  let p = parContexte.get(ctx);
  if (p === undefined) {
    p = construire(ctx, lireClient);
    parContexte.set(ctx, p);
  }
  return p;
}
