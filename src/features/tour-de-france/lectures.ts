/**
 * Tour France IA : lire les demandes (PR-2a).
 *
 * Trois lectures, chacune dans son propre `try` (au build, la base est un stub qui rend `[]` ;
 * en production, une table pas encore migrée rend `[]` aussi — jamais une page en erreur) :
 *
 *   · `lireCompteursPublics` : les demandes COMPTÉES par ville, pour le futur compteur public
 *     (PR-2b). Écarte les demandes écartées par l'équipe ; garde les demandes dont la personne a
 *     demandé l'effacement (leur clé de comptage est gardée, le compteur ne recule pas) ;
 *   · `lireDemandesConsole` : la liste de la console, nom, e-mail et téléphone déchiffrés, avec le
 *     statut « rendez-vous pris » CALCULÉ en comparant l'empreinte de l'e-mail à celle des
 *     rendez-vous Calendly du Tour (aucune colonne sur `calendly_events`) ;
 *   · `compteurParVille` : le compteur de la console (toutes les demandes, et celles qui comptent).
 *
 * ⛔ La console qui appelle `lireDemandesConsole` doit avoir passé `gardeLectureAppels` : ce module
 * rend des coordonnées en clair et ne vérifie pas qui regarde.
 */

import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import type { GroupeVille } from "./comptage";
import { statutAffiche } from "./rapprochement";
import {
  lireFichesProches,
  versRattachement,
  type FicheProcheStockee,
  type Rattachement,
  type StatutAffiche,
} from "./types";

/** Au plus ce nombre de demandes lues pour la console (la liste dit si elle est tronquée). */
export const PLAFOND_DEMANDES_CONSOLE = 500;

/** Au plus ce nombre de rendez-vous du Tour relus pour le rapprochement. */
const PLAFOND_RENDEZ_VOUS = 5000;

// ─────────────────────────────────────────────────────────────────────────────
// Le compteur public (PR-2b)
// ─────────────────────────────────────────────────────────────────────────────

/** Les demandes comptées, groupées par ville. `[]` si la lecture échoue. */
export async function lireCompteursPublics(): Promise<GroupeVille[]> {
  try {
    const lignes = await prisma.tourDemande.groupBy({
      by: ["villeCle", "villeNom"],
      where: { compte: true, statut: { not: "ecartee" } },
      _count: { _all: true },
    });
    return lignes.map((l) => ({
      villeCle: l.villeCle,
      villeNom: l.villeNom,
      total: l._count._all,
    }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// La console
// ─────────────────────────────────────────────────────────────────────────────

export interface FiltreConsole {
  /** La clé d'une ville (`lyon`, `?annecy`). */
  readonly ville?: string | null;
  /** Le statut AFFICHÉ. */
  readonly statut?: StatutAffiche | null;
}

export interface DemandeConsole {
  readonly id: string;
  readonly nom: string;
  readonly email: string;
  readonly telephone: string;
  readonly villeCle: string;
  /** Le nom du référentiel, sinon la ville telle que tapée. */
  readonly ville: string;
  readonly creeLe: Date;
  readonly statut: StatutAffiche;
  readonly rattachement: Rattachement;
  readonly clientId: string | null;
  readonly fichesProches: ReadonlyArray<FicheProcheStockee>;
  /** Vrai si elle compte pour sa ville. */
  readonly compte: boolean;
  /** Vrai si une autre demande tenait déjà la clé de comptage. */
  readonly doublon: boolean;
  readonly depuis: string | null;
}

export interface ListeConsole {
  readonly demandes: ReadonlyArray<DemandeConsole>;
  /** Plus de demandes que le plafond : la liste est un début. */
  readonly tronquee: boolean;
  /** Le rapprochement avec les rendez-vous a échoué : « rendez-vous pris » n'est pas affiché. */
  readonly rapprochementIndisponible: boolean;
}

/** Les empreintes d'e-mail des rendez-vous du Tour (hors annulés). `null` si la lecture échoue. */
async function empreintesDesRendezVousDuTour(): Promise<Set<string> | null> {
  try {
    const rendezVous = await prisma.calendlyEvent.findMany({
      where: {
        typeRendezVous: "tour_de_france_ia",
        status: { not: "canceled" },
        inviteeEmail: { not: null },
      },
      select: { inviteeEmail: true },
      take: PLAFOND_RENDEZ_VOUS,
    });
    const empreintes = new Set<string>();
    for (const r of rendezVous) {
      const h = hashEmailForLookup(r.inviteeEmail);
      if (h !== null) empreintes.add(h);
    }
    return empreintes;
  } catch {
    return null;
  }
}

/** Déchiffre sans jamais lever : une valeur illisible s'affiche « illisible ». */
function clair(valeur: string): string {
  try {
    return decryptPii(valeur);
  } catch {
    return "illisible";
  }
}

/** Les lignes brutes de la liste (la plus récente d'abord), une de plus que le plafond. */
function lireLignes(ville: string | null | undefined) {
  return prisma.tourDemande.findMany({
    where: ville ? { villeCle: ville } : {},
    orderBy: { creeLe: "desc" },
    take: PLAFOND_DEMANDES_CONSOLE + 1,
    select: {
      id: true,
      nom: true,
      email: true,
      telephone: true,
      emailHash: true,
      villeSaisie: true,
      villeCle: true,
      villeNom: true,
      statut: true,
      rattachement: true,
      clientId: true,
      fichesProches: true,
      compte: true,
      doublonDeId: true,
      depuis: true,
      creeLe: true,
    },
  });
}

export async function lireDemandesConsole(filtre: FiltreConsole = {}): Promise<ListeConsole> {
  let lignes: Awaited<ReturnType<typeof lireLignes>>;
  try {
    lignes = await lireLignes(filtre.ville);
  } catch {
    return { demandes: [], tronquee: false, rapprochementIndisponible: false };
  }
  const tronquee = lignes.length > PLAFOND_DEMANDES_CONSOLE;
  const empreintes = await empreintesDesRendezVousDuTour();

  const demandes: DemandeConsole[] = lignes.slice(0, PLAFOND_DEMANDES_CONSOLE).map((l) => ({
    id: l.id,
    nom: clair(l.nom),
    email: clair(l.email),
    telephone: clair(l.telephone),
    villeCle: l.villeCle,
    ville: l.villeNom ?? l.villeSaisie,
    creeLe: l.creeLe,
    statut: statutAffiche(l, empreintes ?? new Set<string>()),
    rattachement: versRattachement(l.rattachement),
    clientId: l.clientId,
    fichesProches: lireFichesProches(l.fichesProches),
    compte: l.compte,
    doublon: l.doublonDeId !== null,
    depuis: l.depuis,
  }));

  return {
    demandes: filtre.statut ? demandes.filter((d) => d.statut === filtre.statut) : demandes,
    tronquee,
    rapprochementIndisponible: empreintes === null,
  };
}

export interface LigneVilleConsole {
  readonly villeCle: string;
  readonly ville: string;
  /** Toutes les demandes de la ville (hors écartées). */
  readonly demandes: number;
  /** Celles qui comptent (une par personne, entreprise et téléphone). */
  readonly comptees: number;
}

/** Le compteur par ville de la console, de la plus comptée à la moins comptée. `[]` si la lecture échoue. */
export async function compteurParVille(): Promise<LigneVilleConsole[]> {
  try {
    const lignes = await prisma.tourDemande.groupBy({
      by: ["villeCle", "villeNom", "compte"],
      where: { statut: { not: "ecartee" } },
      _count: { _all: true },
    });
    const parVille = new Map<string, { ville: string; demandes: number; comptees: number }>();
    for (const l of lignes) {
      const courant = parVille.get(l.villeCle) ?? {
        ville: l.villeNom ?? l.villeCle.replace(/^\?/, ""),
        demandes: 0,
        comptees: 0,
      };
      courant.demandes += l._count._all;
      if (l.compte) courant.comptees += l._count._all;
      parVille.set(l.villeCle, courant);
    }
    return [...parVille.entries()]
      .map(([villeCle, v]) => ({ villeCle, ...v }))
      .sort((a, b) => b.comptees - a.comptees || a.ville.localeCompare(b.ville, "fr"));
  } catch {
    return [];
  }
}
