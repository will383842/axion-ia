/**
 * Tour France IA : lire les demandes (PR-2a).
 *
 * Trois lectures, chacune dans son propre `try` (au build, la base est un stub qui rend `[]` ;
 * en production, une table pas encore migrée rend `[]` aussi — jamais une page en erreur) :
 *
 *   · `lireCompteursPublics` : les demandes COMPTÉES par ville, pour le futur compteur public
 *     (PR-2b). Écarte les demandes écartées par l'équipe ; garde les demandes dont la personne a
 *     demandé l'effacement (leur ligne reste comptée, le compteur ne recule pas) ;
 *   · `lireDemandesConsole` : la liste de la console, nom, e-mail et téléphone déchiffrés, avec le
 *     statut « rendez-vous pris » CALCULÉ : on cherche les rendez-vous du Tour DES ADRESSES des
 *     demandes affichées (`inviteeEmail IN (…)`, colonne insensible à la casse) et on compare les
 *     empreintes (aucune colonne sur `calendly_events`, aucun plafond arbitraire) ;
 *   · `compteurParVille` : le compteur de la console (toutes les demandes, et celles qui comptent).
 *
 * ⛔ La console qui appelle `lireDemandesConsole` doit avoir passé `gardeLectureAppels` : ce module
 * rend des coordonnées en clair et ne vérifie pas qui regarde.
 */

import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { dechiffrerChamp, lireChamp } from "./chiffrement";
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
  /** Téléphone saisi à la visio (Calendly), rattaché à la lecture ; `null` si aucun. */
  readonly telephoneVisio: string | null;
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

/** Les rendez-vous du Tour rattachés à la lecture : empreintes d'e-mail et téléphones saisis à la visio. */
interface RendezVousDuTour {
  readonly empreintes: Set<string>;
  /** Empreinte d'e-mail vers le téléphone saisi chez Calendly (le plus récent non vide gagne). */
  readonly telephones: Map<string, string>;
}

/**
 * Les rendez-vous du Tour (hors annulés) pour CES adresses : empreintes d'e-mail et téléphones
 * (lecture seule). `null` si la lecture échoue. Aucune adresse : rien à chercher, pas de requête.
 */
async function empreintesDesRendezVousDuTour(
  adresses: ReadonlyArray<string>,
): Promise<RendezVousDuTour | null> {
  if (adresses.length === 0) return { empreintes: new Set<string>(), telephones: new Map() };
  try {
    const rendezVous = await prisma.calendlyEvent.findMany({
      where: {
        typeRendezVous: "tour_de_france_ia",
        status: { not: "canceled" },
        inviteeEmail: { in: [...adresses] },
      },
      select: { inviteeEmail: true, inviteePhone: true },
      orderBy: { startTime: "desc" },
    });
    const empreintes = new Set<string>();
    const telephones = new Map<string, string>();
    for (const r of rendezVous) {
      const h = hashEmailForLookup(r.inviteeEmail);
      if (h === null) continue;
      empreintes.add(h);
      const tel = r.inviteePhone?.trim();
      if (tel && !telephones.has(h)) telephones.set(h, tel);
    }
    return { empreintes, telephones };
  } catch {
    return null;
  }
}

/** Les adresses lisibles des demandes (celles dont l'empreinte existe : pas les demandes vidées). */
function adressesLisibles(
  lignes: ReadonlyArray<{ readonly email: string; readonly emailHash: string | null }>,
): string[] {
  const adresses = new Set<string>();
  for (const l of lignes) {
    if (l.emailHash === null) continue;
    try {
      adresses.add(dechiffrerChamp("email", l.email));
    } catch {
      // Une adresse illisible ne se rapproche d'aucun rendez-vous.
    }
  }
  return [...adresses];
}

/**
 * Les statuts STOCKÉS à lire pour afficher ce statut : le filtre s'applique dans la requête, AVANT
 * le plafond. « Rendez-vous pris » est calculé : il peut venir d'une demande reçue ou relancée.
 */
function statutsStockes(statut: StatutAffiche | null | undefined): string[] | null {
  if (!statut) return null;
  return statut === "rdv_pris" ? ["recue", "relancee_main"] : [statut];
}

/** Les lignes brutes de la liste (la plus récente d'abord), une de plus que le plafond. */
function lireLignes(ville: string | null | undefined, statuts: string[] | null) {
  return prisma.tourDemande.findMany({
    where: {
      ...(ville ? { villeCle: ville } : {}),
      ...(statuts !== null ? { statut: { in: statuts } } : {}),
    },
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
    lignes = await lireLignes(filtre.ville, statutsStockes(filtre.statut));
  } catch {
    return { demandes: [], tronquee: false, rapprochementIndisponible: false };
  }
  const tronquee = lignes.length > PLAFOND_DEMANDES_CONSOLE;
  const affichees = lignes.slice(0, PLAFOND_DEMANDES_CONSOLE);
  const rendezVous = await empreintesDesRendezVousDuTour(adressesLisibles(affichees));
  const empreintes = rendezVous?.empreintes ?? null;

  const demandes: DemandeConsole[] = affichees.map((l) => ({
    id: l.id,
    nom: lireChamp("nom", l.nom),
    email: lireChamp("email", l.email),
    telephone: lireChamp("telephone", l.telephone),
    // Rattaché à la lecture (aucune écriture) ; jamais pour une demande effacée.
    telephoneVisio:
      l.statut === "effacee_rgpd" || l.emailHash === null
        ? null
        : (rendezVous?.telephones.get(l.emailHash) ?? null),
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
  /** Celles qui comptent (une par personne et par entreprise). */
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
