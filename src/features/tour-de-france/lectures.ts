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
 *   · `compteurParVille` : le compteur de la console (toutes les demandes, et celles qui comptent) ;
 *   · `lireFicheVille` : la fiche d'une ville, mini-demandes et visios rapprochées (lecture seule) ;
 *   · `etatsCrm` : l'état d'envoi au CRM Pro (outbox), sans le corps ni l'erreur.
 *
 * ⛔ La console qui appelle `lireDemandesConsole` doit avoir passé `gardeLectureAppels` : ce module
 * rend des coordonnées en clair et ne vérifie pas qui regarde.
 */

import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { dechiffrerChamp, lireChamp } from "./chiffrement";
import type { GroupeVille } from "./comptage";
import {
  assemblerFicheVille,
  refCrmDemande,
  refCrmVisio,
  type DemandeFiche,
  type FicheVille,
  type LigneCrm,
} from "./fiche-ville";
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

// ─────────────────────────────────────────────────────────────────────────────
// La fiche d'une ville
// ─────────────────────────────────────────────────────────────────────────────

/** Au plus ce nombre de visios du Tour lues pour une fiche de ville (la fiche dit si elle est tronquée). */
export const PLAFOND_VISIOS_FICHE = 300;

/** Au plus ce nombre d'empreintes d'e-mail de demandes lues pour écarter les visios d'une autre ville. */
const PLAFOND_EMPREINTES_DEMANDES = 5000;

/**
 * L'état d'envoi au CRM Pro des enregistrements `refs` (`site:tour-demande:<id>`,
 * `site:calendly_event:<id>`). Lecture seule de `crm_sync_outbox`.
 *
 * ⛔ On ne sélectionne JAMAIS `payload` (coordonnées en clair) ni `lastError` : seuls le statut, la
 * réponse du CRM, la date d'envoi et le nombre de tentatives sortent. `null` si la lecture échoue.
 */
export async function etatsCrm(refs: string[]): Promise<LigneCrm[] | null> {
  if (refs.length === 0) return [];
  try {
    return await prisma.crmSyncOutbox.findMany({
      where: { subjectRef: { in: refs } },
      select: { subjectRef: true, status: true, crmResult: true, sentAt: true, attempts: true },
    });
  } catch {
    return null;
  }
}

/** Les empreintes d'e-mail des demandes de TOUT le Tour (hors effacées). Vide si la lecture échoue. */
async function empreintesDesDemandesDuTour(): Promise<Set<string>> {
  try {
    const lignes = await prisma.tourDemande.findMany({
      where: { emailHash: { not: null } },
      select: { emailHash: true },
      take: PLAFOND_EMPREINTES_DEMANDES,
    });
    const empreintes = new Set<string>();
    for (const l of lignes) {
      if (l.emailHash !== null) empreintes.add(l.emailHash);
    }
    return empreintes;
  } catch {
    return new Set<string>();
  }
}

/**
 * La fiche d'une ville : ses mini-demandes, et pour chacune la visio rapprochée par l'empreinte de
 * l'e-mail avec les réponses de l'étape 2 (lues dans `raw_payload`, jamais copiées). Lecture
 * seule. Chaque lecture a son `try` : une panne rend une fiche vide ou sans visios
 * (`visiosIndisponibles`), jamais une exception.
 *
 * ⛔ La page qui l'appelle doit avoir passé `gardeLectureAppels` : ce module rend des coordonnées en
 * clair et ne vérifie pas qui regarde.
 */
export async function lireFicheVille(villeCle: string): Promise<FicheVille> {
  let lignes: Awaited<ReturnType<typeof lireLignes>> = [];
  try {
    lignes = await lireLignes(villeCle, null);
  } catch {
    lignes = [];
  }
  let visios: Array<{
    id: string;
    inviteeEmail: string | null;
    startTime: Date | null;
    status: string;
    rawPayload: unknown;
  }> = [];
  let visiosIndisponibles = false;
  try {
    visios = await prisma.calendlyEvent.findMany({
      where: { typeRendezVous: "tour_de_france_ia" },
      orderBy: { startTime: "desc" },
      take: PLAFOND_VISIOS_FICHE,
      select: { id: true, inviteeEmail: true, startTime: true, status: true, rawPayload: true },
    });
  } catch {
    visiosIndisponibles = true;
    visios = [];
  }

  const affichees = lignes.slice(0, PLAFOND_DEMANDES_CONSOLE);

  // « Rendez-vous pris » : comme la page des demandes, par les adresses AFFICHÉES (aucun plafond de
  // 300). Si cette lecture échoue, on se rabat sur les visios déjà lues.
  const rendezVous = await empreintesDesRendezVousDuTour(adressesLisibles(affichees));
  let empreintesPrises: Set<string>;
  if (rendezVous !== null) {
    empreintesPrises = rendezVous.empreintes;
  } else {
    empreintesPrises = new Set<string>();
    for (const v of visios) {
      if (v.status === "canceled") continue;
      const h = hashEmailForLookup(v.inviteeEmail);
      if (h !== null) empreintesPrises.add(h);
    }
  }

  const empreintesDemandesDuTour = await empreintesDesDemandesDuTour();
  const lignesCrm = await etatsCrm([
    ...affichees.map((l) => refCrmDemande(l.id)),
    ...visios.map((v) => refCrmVisio(v.id)),
  ]);
  const demandes: DemandeFiche[] = affichees.map((l) => ({
    id: l.id,
    nom: lireChamp("nom", l.nom),
    email: lireChamp("email", l.email),
    telephone: lireChamp("telephone", l.telephone),
    telephoneVisio: null,
    villeCle: l.villeCle,
    ville: l.villeNom ?? l.villeSaisie,
    creeLe: l.creeLe,
    statut: statutAffiche(l, empreintesPrises),
    rattachement: versRattachement(l.rattachement),
    clientId: l.clientId,
    fichesProches: lireFichesProches(l.fichesProches),
    compte: l.compte,
    doublon: l.doublonDeId !== null,
    depuis: l.depuis,
    emailHash: l.emailHash,
  }));

  return assemblerFicheVille(demandes, visios, villeCle, {
    tronquee: lignes.length > PLAFOND_DEMANDES_CONSOLE || visios.length >= PLAFOND_VISIOS_FICHE,
    visiosIndisponibles,
    lignesCrm,
    empreintesDemandesDuTour,
  });
}
