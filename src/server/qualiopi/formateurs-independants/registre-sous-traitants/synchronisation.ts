/**
 * Qualiopi ind. 27 — la SYNCHRONISATION du registre des sous-traitants avec les fiches
 * des formateurs indépendants (règles : `regles.ts`).
 *
 * - **Éteinte par défaut** (`formateurs.registre_sous_traitants`) : coupée, seul le
 *   réglage est lu ; rien n'est écrit.
 * - **Le registre visible est le registre existant** : sa ligne (`SousTraitant`) est
 *   écrite par SON service (`sous-traitants-service.ts`), jamais en direct. La table
 *   `registre_sous_traitants_independants` relie la fiche à cette ligne et porte la date
 *   d'entrée et le statut daté.
 * - **Idempotente** : une ligne par formateur (unicité en base) ; rejouée, elle ne crée
 *   rien. Un verrou consultatif empêche deux passages simultanés (tâche du matin et
 *   rattrapage depuis la console) de créer deux lignes visibles pour le même formateur.
 * - **Rien n'est supprimé** : une sortie est un statut, une date et un motif.
 * - **Journal** : identifiants, statuts et compteurs seulement.
 *
 * Module neutre (ni `server-only`, ni Next) : le worker l'importe. Ne lève jamais.
 */

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import {
  creerSousTraitant,
  updateSousTraitant,
  verifierDataGouv,
} from "@/server/qualiopi/registres/sous-traitants-service";

import { interrupteurAllume } from "../interrupteur-allume";

import {
  planifierSynchronisation,
  type FaitsFiche,
  type LigneExistante,
  type PlanLigne,
  type StatutRegistre,
} from "./regles";

export const ACTION_SYNCHRONISE = "qualiopi.registre_sous_traitants.synchronise";
export const ACTION_ENTREE = "qualiopi.registre_sous_traitants.entree";
export const ACTION_STATUT = "qualiopi.registre_sous_traitants.statut_change";

/** Clé du verrou consultatif (transaction) : un seul passage à la fois. */
const VERROU = "registre_sous_traitants_independants";
/** Le passage se fait dans la transaction qui tient le verrou ; il peut être long. */
const DUREE_MAX_MS = 5 * 60 * 1000;

async function lireFiches(): Promise<FaitsFiche[]> {
  const lues = await prisma.trainer.findMany({
    where: {
      OR: [
        {
          // Les fiches de test sont écartées par `estEligible` (règle pure, testée).
          statut: "sous_traitant",
          OR: [{ sousTraitantContratSigneAt: { not: null } }, { actif: true }],
        },
        { registreSousTraitant: { isNot: null } },
      ],
    },
    select: {
      id: true,
      prenom: true,
      nom: true,
      statut: true,
      actif: true,
      estTestInterne: true,
      siret: true,
      sousTraitantNda: true,
      sousTraitantContratSigneAt: true,
      activationValideeAt: true,
      finCollaborationAt: true,
      finCollaborationEffetAt: true,
      finCollaborationMotif: true,
      ndaVerifieListeAt: true,
      habilitations: {
        where: { retireAt: null },
        select: { formation: { select: { titre: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return lues.map((t) => ({
    trainerId: t.id,
    prenom: t.prenom,
    nom: t.nom,
    statut: t.statut,
    actif: t.actif,
    estTestInterne: t.estTestInterne,
    siret: t.siret,
    nda: t.sousTraitantNda,
    contratSigneAt: t.sousTraitantContratSigneAt,
    activationValideeAt: t.activationValideeAt,
    finCollaborationAt: t.finCollaborationAt,
    finCollaborationEffetAt: t.finCollaborationEffetAt,
    finCollaborationMotif: t.finCollaborationMotif,
    formations: t.habilitations.map((h) => h.formation.titre),
    ndaVerifieListeAt: t.ndaVerifieListeAt,
  }));
}

async function lireExistants(): Promise<LigneExistante[]> {
  const lues = await prisma.registreSousTraitantIndependant.findMany({
    select: {
      id: true,
      trainerId: true,
      sousTraitantId: true,
      statut: true,
      statutDepuis: true,
      dateSortie: true,
      motifSortie: true,
      sousTraitant: {
        select: {
          nom: true,
          siret: true,
          nda: true,
          objetPrestation: true,
          contratSigneAt: true,
          actif: true,
          verifieDataGouvAt: true,
        },
      },
    },
  });
  return lues.map((l) => ({
    registreId: l.id,
    trainerId: l.trainerId,
    sousTraitantId: l.sousTraitantId,
    statut: l.statut,
    statutDepuis: l.statutDepuis,
    dateSortie: l.dateSortie,
    motifSortie: l.motifSortie,
    generique: l.sousTraitant,
  }));
}

async function planActuel(maintenant: Date): Promise<PlanLigne[]> {
  const [fiches, existants] = await Promise.all([lireFiches(), lireExistants()]);
  return planifierSynchronisation(fiches, existants, maintenant);
}

// ─── Aperçu ─────────────────────────────────────────────────────────────────

export interface LigneApercu {
  readonly trainerId: string;
  readonly libelle: string;
  readonly sorte: PlanLigne["sorte"];
  /** Ce qui changerait, en clair (champs et statut). */
  readonly detail: string;
}

export interface Apercu {
  readonly allume: boolean;
  readonly lignes: ReadonlyArray<LigneApercu>;
}

const LIBELLES_CHAMPS: Readonly<Record<string, string>> = {
  siret: "SIRET",
  nda: "NDA",
  objetPrestation: "formations habilitées",
  contratSigneAt: "date du contrat-cadre",
  actif: "actif au registre",
};

const LIBELLES_STATUT: Readonly<Record<StatutRegistre, string>> = {
  actif: "actif",
  suspendu: "suspendu",
  sorti: "sorti",
};

function detail(p: PlanLigne): string {
  if (p.sorte === "inchange") return "À jour";
  if (p.sorte === "creer") return `Entrée au registre, statut ${LIBELLES_STATUT[p.statut.statut]}`;
  const parts = Object.keys(p.generique).map((k) => LIBELLES_CHAMPS[k] ?? k);
  if (p.verifieDataGouvAt !== null) parts.push("vérification de la liste publique");
  if (p.statut !== null) parts.push(`statut → ${LIBELLES_STATUT[p.statut.statut]}`);
  return `Mise à jour : ${parts.join(", ")}`;
}

/** Ce que ferait la synchronisation, sans rien écrire. Lit même interrupteur coupé. */
export async function apercuSynchronisation(maintenant: Date): Promise<Apercu> {
  const [allume, plan] = await Promise.all([
    interrupteurAllume("registre_sous_traitants"),
    planActuel(maintenant),
  ]);
  return {
    allume,
    lignes: plan.map((p) => ({
      trainerId: p.trainerId,
      libelle: p.libelle,
      sorte: p.sorte,
      detail: detail(p),
    })),
  };
}

// ─── Synchronisation ────────────────────────────────────────────────────────

export interface BilanSynchronisation {
  readonly etat: "coupe" | "deja_en_cours" | "fait" | "echec";
  readonly crees: number;
  readonly misAJour: number;
  readonly sorties: number;
  readonly inchanges: number;
  readonly erreurs: number;
}

const RIEN = { crees: 0, misAJour: 0, sorties: 0, inchanges: 0, erreurs: 0 } as const;

async function appliquer(p: PlanLigne, maintenant: Date, parId: string | null): Promise<void> {
  const session = parId === null ? null : { userId: parId };
  if (p.sorte === "creer") {
    const ligne = await creerSousTraitant({
      nom: p.generique.nom,
      objetPrestation: p.generique.objetPrestation,
      actif: p.generique.actif,
      ...(p.generique.siret !== null ? { siret: p.generique.siret } : {}),
      ...(p.generique.nda !== null ? { nda: p.generique.nda } : {}),
      ...(p.generique.contratSigneAt !== null
        ? { contratSigneAt: p.generique.contratSigneAt }
        : {}),
    });
    if (p.verifieDataGouvAt !== null) await verifierDataGouv(ligne.id, p.verifieDataGouvAt);
    const registre = await prisma.registreSousTraitantIndependant.create({
      data: {
        trainerId: p.trainerId,
        sousTraitantId: ligne.id,
        dateEntree: p.dateEntree,
        statut: p.statut.statut,
        statutDepuis: maintenant,
        dateSortie: p.statut.dateSortie,
        motifSortie: p.statut.motifSortie,
        synchroniseAt: maintenant,
      },
      select: { id: true },
    });
    await journaliser(prisma, {
      action: ACTION_ENTREE,
      targetType: "Trainer",
      targetId: p.trainerId,
      changes: { registreId: registre.id, sousTraitantId: ligne.id, statut: p.statut.statut },
      session,
    });
    return;
  }
  if (p.sorte === "inchange") return;
  if (Object.keys(p.generique).length > 0) await updateSousTraitant(p.sousTraitantId, p.generique);
  if (p.verifieDataGouvAt !== null) await verifierDataGouv(p.sousTraitantId, p.verifieDataGouvAt);
  await prisma.registreSousTraitantIndependant.update({
    where: { id: p.registreId },
    data: {
      synchroniseAt: maintenant,
      ...(p.statut !== null
        ? {
            statut: p.statut.statut,
            statutDepuis: maintenant,
            dateSortie: p.statut.dateSortie,
            motifSortie: p.statut.motifSortie,
          }
        : {}),
    },
  });
  if (p.statut !== null) {
    await journaliser(prisma, {
      action: ACTION_STATUT,
      targetType: "Trainer",
      targetId: p.trainerId,
      changes: { registreId: p.registreId, statut: p.statut.statut },
      session,
    });
  }
}

/**
 * Inscrit au registre chaque formateur indépendant qui doit y être, met à jour les
 * lignes existantes. Même fonction pour la tâche du matin (`parId: null`) et pour le
 * rattrapage depuis la console (l'administrateur).
 */
export async function synchroniserRegistre(input: {
  readonly maintenant: Date;
  readonly parId: string | null;
}): Promise<BilanSynchronisation> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return { etat: "coupe", ...RIEN };
  try {
    if (!(await interrupteurAllume("registre_sous_traitants"))) return { etat: "coupe", ...RIEN };
    return await prisma.$transaction(
      async (tx) => {
        const verrou = await tx.$queryRaw<Array<{ verrou: boolean }>>`
          SELECT pg_try_advisory_xact_lock(hashtext(${VERROU})) AS verrou`;
        if (verrou[0]?.verrou !== true) return { etat: "deja_en_cours" as const, ...RIEN };
        const plan = await planActuel(input.maintenant);
        const compte = { crees: 0, misAJour: 0, sorties: 0, inchanges: 0, erreurs: 0 };
        for (const p of plan) {
          try {
            await appliquer(p, input.maintenant, input.parId);
            if (p.sorte === "creer") compte.crees++;
            else if (p.sorte === "inchange") compte.inchanges++;
            else {
              compte.misAJour++;
              if (p.statut?.statut === "sorti") compte.sorties++;
            }
          } catch (err) {
            compte.erreurs++;
            console.error(
              "[registre-sous-traitants] fiche non synchronisée :",
              err instanceof Error ? err.name : "erreur",
            );
          }
        }
        await journaliser(prisma, {
          action: ACTION_SYNCHRONISE,
          targetType: "RegistreSousTraitants",
          targetId: null,
          changes: compte,
          session: input.parId === null ? null : { userId: input.parId },
        });
        return { etat: "fait" as const, ...compte };
      },
      { timeout: DUREE_MAX_MS, maxWait: 10_000 },
    );
  } catch (err) {
    console.error(
      "[registre-sous-traitants] synchronisation en échec :",
      err instanceof Error ? err.name : "erreur",
    );
    return { etat: "echec", ...RIEN };
  }
}
