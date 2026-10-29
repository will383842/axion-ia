/**
 * Tour France IA : la fiche d'une ville (lecture seule).
 *
 * Pour une ville, on rapproche les mini-demandes des visios du Tour et on en tire, par personne, les
 * réponses de l'étape 2. Rien n'est copié : les réponses restent dans `calendly_events.raw_payload`
 * et sont relues à chaque affichage. Module PUR (aucune lecture, aucune écriture).
 *
 * Règles :
 *  · rapprochement par empreinte d'e-mail (`hashEmailForLookup`) ; une demande effacée à la demande
 *    de la personne, ou sans empreinte, n'a JAMAIS de visio ;
 *  · une visio sans demande est rattachée à la ville si la ville qu'elle déclare se résout vers la
 *    même clé ;
 *  · une visio annulée est affichée « annulée » et n'entre pas dans « visios prises » ;
 *  · une visio effacée (`_erasedAt`) n'a aucune réponse.
 */

import { entrepriseDeclaree } from "@/features/admin-rendezvous/a-venir";
import { reponsesDuBrut } from "@/server/calendly/type-rendez-vous";
import { profilDuTour, type ProfilDuTour } from "@/server/calendly/reponses-du-tour";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { SEUIL_PAR_VILLE } from "./comptage";
import type { DemandeConsole } from "./lectures";
import { resoudreVille } from "./villes";

export type StatutVisio = "prevue" | "annulee" | "passee";

export interface VisioTour {
  readonly id: string;
  readonly debut: Date | null;
  readonly statut: StatutVisio;
  /** Les réponses de l'étape 2 ; `null` si aucune, ou si la visio est effacée. */
  readonly profil: ProfilDuTour | null;
  readonly efface: boolean;
}

/** Une visio du Tour telle qu'elle est lue en base (colonnes utiles seulement). */
export interface VisioBrute {
  readonly id: string;
  readonly inviteeEmail: string | null;
  readonly startTime: Date | null;
  readonly status: string;
  readonly rawPayload: unknown;
}

/** Une demande de la console, avec l'empreinte de son e-mail (clé du rapprochement). */
export type DemandeFiche = DemandeConsole & { readonly emailHash: string | null };

export interface PersonneVille {
  readonly demande: DemandeFiche;
  /** Vrai si elle compte pour la ville (comptée et pas un doublon). */
  readonly compte: boolean;
  /** `null` : pas de visio rapprochée (« pas encore »). */
  readonly visio: VisioTour | null;
}

export interface FicheVille {
  readonly villeCle: string;
  readonly ville: string;
  /** Demandes reçues (hors écartées). */
  readonly recues: number;
  /** Demandes qui comptent pour la ville. */
  readonly comptees: number;
  /** Visios non annulées de la ville (avec ou sans mini-demande). */
  readonly visiosPrises: number;
  readonly ouverte: boolean;
  readonly seuil: number;
  readonly personnes: ReadonlyArray<PersonneVille>;
  readonly visiosSansDemande: ReadonlyArray<VisioTour>;
  /** Plus de lignes que le plafond de lecture : la fiche est un début. */
  readonly tronquee: boolean;
  /** La lecture des visios a échoué : « visios prises » et les réponses ne sont pas affichées. */
  readonly visiosIndisponibles: boolean;
}

function objet(x: unknown): Record<string, unknown> | null {
  return typeof x === "object" && x !== null && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : null;
}

function versVisio(v: VisioBrute, maintenant: Date): VisioTour {
  const efface = objet(v.rawPayload)?.["_erasedAt"] != null;
  const statut: StatutVisio =
    v.status === "canceled"
      ? "annulee"
      : v.startTime !== null && v.startTime.getTime() < maintenant.getTime()
        ? "passee"
        : "prevue";
  return {
    id: v.id,
    debut: v.startTime,
    statut,
    profil: efface ? null : profilDuTour(reponsesDuBrut(v.rawPayload)),
    efface,
  };
}

/** La visio à montrer quand une personne en a plusieurs : la plus récente non annulée, sinon la plus récente. */
function meilleureVisio(visios: ReadonlyArray<VisioTour>): VisioTour | null {
  const parDate = [...visios].sort((a, b) => (b.debut?.getTime() ?? 0) - (a.debut?.getTime() ?? 0));
  return parDate.find((v) => v.statut !== "annulee") ?? parDate[0] ?? null;
}

export function assemblerFicheVille(
  demandes: ReadonlyArray<DemandeFiche>,
  visios: ReadonlyArray<VisioBrute>,
  villeCle: string,
  options: {
    readonly tronquee?: boolean;
    readonly visiosIndisponibles?: boolean;
    readonly maintenant?: Date;
  } = {},
): FicheVille {
  const maintenant = options.maintenant ?? new Date();
  const visiosParEmpreinte = new Map<string, VisioTour[]>();
  const toutes: VisioTour[] = [];
  const villeDeVisio = new Map<string, string | null>();

  for (const brute of visios) {
    const visio = versVisio(brute, maintenant);
    toutes.push(visio);
    const h = hashEmailForLookup(brute.inviteeEmail);
    villeDeVisio.set(
      visio.id,
      resoudreVille(entrepriseDeclaree(brute.rawPayload).ville ?? "")?.cle ?? null,
    );
    if (h === null) continue;
    const liste = visiosParEmpreinte.get(h) ?? [];
    liste.push(visio);
    visiosParEmpreinte.set(h, liste);
  }

  const rapprochees = new Set<string>();
  const personnes: PersonneVille[] = demandes.map((demande) => {
    const peutAvoirUneVisio = demande.statut !== "effacee_rgpd" && demande.emailHash !== null;
    const trouvees = peutAvoirUneVisio
      ? (visiosParEmpreinte.get(demande.emailHash ?? "") ?? [])
      : [];
    const visio = meilleureVisio(trouvees);
    for (const v of trouvees) rapprochees.add(v.id);
    return { demande, compte: demande.compte && !demande.doublon, visio };
  });

  // Une visio dont l'adresse correspond à une demande de CETTE ville est déjà rattachée ; les autres
  // sont rattachées par la ville qu'elles déclarent.
  const visiosSansDemande = toutes.filter(
    (v) => !rapprochees.has(v.id) && villeDeVisio.get(v.id) === villeCle,
  );

  const lues = demandes.filter((d) => d.statut !== "ecartee");
  const comptees = personnes.filter((p) => p.compte && p.demande.statut !== "ecartee").length;
  const visiosPrises =
    personnes.filter((p) => p.visio !== null && p.visio.statut !== "annulee").length +
    visiosSansDemande.filter((v) => v.statut !== "annulee").length;
  const premiere = demandes[0];

  return {
    villeCle,
    ville: premiere?.ville ?? villeCle.replace(/^\?/, ""),
    recues: lues.length,
    comptees,
    visiosPrises,
    ouverte: comptees >= SEUIL_PAR_VILLE,
    seuil: SEUIL_PAR_VILLE,
    personnes,
    visiosSansDemande,
    tronquee: options.tronquee ?? false,
    visiosIndisponibles: options.visiosIndisponibles ?? false,
  };
}
