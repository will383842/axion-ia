/**
 * La famille `formateur` des messages d'un rendez-vous : confirmation (F3), la veille et
 * une heure avant (F4) — lot F-CAL-2.
 *
 * Même mécanique que `rappels-appel.ts` (fenêtres quinze fois plus larges que la cadence,
 * marqueurs DISTINCTS posés seulement sur un succès réel, plafond par passage, lignes
 * anonymisées exclues), mais un autre canal : chaque message part par l'adaptateur des
 * formateurs (`qualiopi/formateurs-independants/envois.ts`), qui refuse tout texte non
 * validé par Will. La population est DISJOINTE de celles des familles client, apporteur
 * et salon : elles excluent toutes un échange formateur (lot F-CAL-1), celle-ci ne lit
 * que lui (type classé « formateur » OU nom « formateur », comme `estEchangeFormateur`),
 * et seulement RATTACHÉ à une candidature (marqueur ou adresse, `rattachement-formateur.ts`).
 *
 * 🔴 ÉTEINT À LA LIVRAISON : interrupteur `formateurs.suivi_echange` absent = aucun
 * passage, aucune lecture de `calendly_events` (seulement celle du réglage). Un échange formateur ne reçoit alors, comme avant,
 * que l'invitation d'agenda de Calendly.
 *
 * `maintenant` est un PARAMÈTRE (le banc l'appelle avec son horloge).
 */

import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { ERASED_PLACEHOLDER } from "@/lib/rgpd-erase";
import type { Prisma } from "../../../prisma/generated/client";

import { MOT_CLE_TYPE_ECHANGE_FORMATEUR } from "./echange-formateur";

/** Au plus 30 messages par passage et par moment (boîte partagée à 40 par heure). */
export const PLAFOND_PAR_PASSAGE_FORMATEUR = 30;

/**
 * La confirmation ne vise que les réservations VUES depuis moins de 48 h : allumer
 * l'interrupteur ne fait jamais partir « C'est confirmé » pour un échange réservé il y a
 * dix jours.
 */
export const FRAICHEUR_CONFIRMATION_MS = 48 * 60 * 60 * 1000;

type Marqueur = "confirmationEnvoyeeAt" | "rappelJ1EnvoyeAt" | "rappelEnvoyeAt";

export interface PassageFormateur {
  readonly moment: "confirmation" | "j1" | "h1";
  readonly gabarit: "formateur-echange-confirme" | "formateur-echange-rappel";
  /** Variante du gabarit (1 = la veille, 2 = une heure avant). */
  readonly etape: 1 | 2 | null;
  readonly marqueur: Marqueur;
  readonly fenetre: { readonly minMinutes: number; readonly maxMinutes: number } | null;
}

export const PASSAGES_FORMATEUR: readonly PassageFormateur[] = [
  {
    moment: "confirmation",
    gabarit: "formateur-echange-confirme",
    etape: null,
    marqueur: "confirmationEnvoyeeAt",
    fenetre: null,
  },
  {
    moment: "j1",
    gabarit: "formateur-echange-rappel",
    etape: 1,
    marqueur: "rappelJ1EnvoyeAt",
    fenetre: { minMinutes: 1440, maxMinutes: 1455 },
  },
  {
    moment: "h1",
    gabarit: "formateur-echange-rappel",
    etape: 2,
    marqueur: "rappelEnvoyeAt",
    fenetre: { minMinutes: 60, maxMinutes: 75 },
  },
];

/** Le filtre du marqueur, en objets explicites (voir `rappels-appel.ts`). */
function filtreNonEnvoye(m: Marqueur) {
  switch (m) {
    case "confirmationEnvoyeeAt":
      return { confirmationEnvoyeeAt: null };
    case "rappelJ1EnvoyeAt":
      return { rappelJ1EnvoyeAt: null };
    case "rappelEnvoyeAt":
      return { rappelEnvoyeAt: null };
  }
}

function marqueurPose(m: Marqueur, quand: Date) {
  switch (m) {
    case "confirmationEnvoyeeAt":
      return { confirmationEnvoyeeAt: quand };
    case "rappelJ1EnvoyeAt":
      return { rappelJ1EnvoyeAt: quand };
    case "rappelEnvoyeAt":
      return { rappelEnvoyeAt: quand };
  }
}

/** La population : un échange formateur, par la colonne OU par le nom (double verrou). */
export const SEULS_ECHANGES_FORMATEUR: Prisma.CalendlyEventWhereInput = {
  OR: [
    { typeRendezVous: "formateur" },
    { eventTypeName: { contains: MOT_CLE_TYPE_ECHANGE_FORMATEUR, mode: "insensitive" } },
  ],
};

export function heureParis(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function jourParis(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

function prenomDe(nom: string | null): string | null {
  const propre = (nom ?? "").trim();
  if (!propre || propre === ERASED_PLACEHOLDER) return null;
  return propre.split(/\s+/)[0] ?? null;
}

/** Les valeurs des [crochets] de F3 et F4, et le lien de visio s'il est utilisable. */
export function payloadEchange(rdv: {
  inviteeName: string | null;
  startTime: Date;
  location: string | null;
}): Record<string, unknown> {
  const heure = heureParis(rdv.startTime);
  const lieu = (rdv.location ?? "").trim();
  const prenom = prenomDe(rdv.inviteeName);
  return {
    ...(prenom ? { prenom } : {}),
    valeurs: { jour: jourParis(rdv.startTime), heure, "HH:MM": heure },
    ...(/^https:\/\//i.test(lieu) ? { lien: lieu } : {}),
  };
}

export interface EnvoiEchangeFormateur {
  readonly gabarit: PassageFormateur["gabarit"];
  readonly destinataire: string;
  readonly payload: Record<string, unknown>;
  readonly entityType: "JobApplication";
  readonly entityId: string;
  readonly jobId: string;
}

export interface DependancesRappelsFormateur {
  /** L'interrupteur `formateurs.suivi_echange`. Lecture en échec : coupé. */
  readonly allume: () => Promise<boolean>;
  /** Rend le statut de l'adaptateur des formateurs (`envoye`, `en-validation`, refus…). */
  readonly envoyer: (e: EnvoiEchangeFormateur) => Promise<string>;
}

export interface BilanPassageFormateur {
  readonly moment: PassageFormateur["moment"];
  readonly ok: boolean;
  readonly candidats: number;
  readonly envoyes: number;
  readonly refus: Readonly<Record<string, number>>;
  readonly plafondAtteint?: true;
}

async function allumeParDefaut(): Promise<boolean> {
  const { lireEtatsEntree } =
    await import("@/server/qualiopi/formateurs-independants/etats-entree");
  return (await lireEtatsEntree()).suivi_echange === true;
}

async function envoyerParDefaut(e: EnvoiEchangeFormateur): Promise<string> {
  const { envoyer } = await import("@/server/qualiopi/formateurs-independants/envois");
  return envoyer(e);
}

export async function executerPassageFormateur(
  p: PassageFormateur,
  maintenant: Date,
  envoyer: DependancesRappelsFormateur["envoyer"],
): Promise<BilanPassageFormateur> {
  const nowMs = maintenant.getTime();
  const refus: Record<string, number> = {};
  const startTime = p.fenetre
    ? {
        gte: new Date(nowMs + p.fenetre.minMinutes * 60_000),
        lt: new Date(nowMs + p.fenetre.maxMinutes * 60_000),
      }
    : { gt: maintenant };

  let lignes: Array<{
    id: string;
    inviteeName: string | null;
    inviteeEmail: string | null;
    startTime: Date | null;
    location: string | null;
    linkedJobApplicationId: string | null;
    linkedJobApplication: { email: string } | null;
  }>;
  try {
    lignes = await prisma.calendlyEvent.findMany({
      where: {
        status: "scheduled",
        startTime,
        ...filtreNonEnvoye(p.marqueur),
        // Seul un échange RATTACHÉ à une candidature reçoit nos messages : le départ
        // (`relecture-au-depart.ts`) relit la fiche, et un échange « à vérifier » n'en a pas.
        linkedJobApplicationId: { not: null },
        NOT: { inviteeName: ERASED_PLACEHOLDER },
        ...(p.fenetre ? {} : { capturedAt: { gte: new Date(nowMs - FRAICHEUR_CONFIRMATION_MS) } }),
        AND: [SEULS_ECHANGES_FORMATEUR],
      },
      orderBy: { startTime: "asc" },
      take: PLAFOND_PAR_PASSAGE_FORMATEUR + 1,
      select: {
        id: true,
        inviteeName: true,
        inviteeEmail: true,
        startTime: true,
        location: true,
        linkedJobApplicationId: true,
        // 🔴 Le destinataire est l'adresse de la CANDIDATURE, jamais `inviteeEmail` : la
        // route publique `client-event` peut avoir écrit cette colonne avec une autre adresse.
        linkedJobApplication: { select: { email: true } },
      },
    });
  } catch {
    return { moment: p.moment, ok: false, candidats: 0, envoyes: 0, refus };
  }

  const plafondAtteint = lignes.length > PLAFOND_PAR_PASSAGE_FORMATEUR;
  const aTraiter = lignes.slice(0, PLAFOND_PAR_PASSAGE_FORMATEUR);
  let envoyes = 0;
  for (const rdv of aTraiter) {
    if (!rdv.startTime || !rdv.linkedJobApplicationId || !rdv.linkedJobApplication) continue;
    let destinataire: string | null;
    try {
      destinataire = decryptPii(rdv.linkedJobApplication.email).trim();
    } catch {
      destinataire = null;
    }
    let statut: string;
    if (!destinataire || destinataire.endsWith("@erased.local")) {
      statut = "fiche-retiree";
    } else {
      try {
        statut = await envoyer({
          gabarit: p.gabarit,
          destinataire,
          payload: {
            ...payloadEchange({ ...rdv, startTime: rdv.startTime }),
            ...(p.etape ? { etape: p.etape } : {}),
          },
          entityType: "JobApplication",
          entityId: rdv.linkedJobApplicationId,
          // Hors du préfixe `fi-` des campagnes : un message d'échange n'est pas une relance.
          jobId: `formateur-echange-${p.moment}-${rdv.id}`,
        });
      } catch {
        statut = "indisponible";
      }
    }
    // 🔴 Panne ou texte pas encore validé : AUCUN marqueur, on retente au passage suivant.
    // Un texte non validé l'est pour toutes les lignes : on s'arrête. Une panne peut ne
    // toucher qu'une ligne : on passe à la suivante, sans bloquer la file.
    // Tout autre refus (adresse retenue, fiche retirée…) est DÉFINITIF pour ce moment : le
    // marqueur est posé, sinon la même ligne serait retentée chaque minute.
    const envoye = statut === "envoye" || statut === "en-validation";
    if (!envoye) {
      refus[statut] = (refus[statut] ?? 0) + 1;
      if (statut === "texte-non-valide") break;
      if (statut === "indisponible") continue;
    }
    try {
      await prisma.calendlyEvent.update({
        where: { id: rdv.id },
        data: marqueurPose(p.marqueur, maintenant),
        select: { id: true },
      });
    } catch {
      // Message parti, marqueur non posé : la clé d'envoi (`jobId`) empêche le doublon.
    }
    if (envoye) envoyes += 1;
  }
  return {
    moment: p.moment,
    ok: true,
    candidats: aTraiter.length,
    envoyes,
    refus,
    ...(plafondAtteint ? { plafondAtteint: true as const } : {}),
  };
}

/** Les trois passages, dans l'ordre. Interrupteur coupé : rien (une lecture du réglage). */
export async function envoyerMessagesEchangeFormateur(
  maintenant: Date,
  deps?: Partial<DependancesRappelsFormateur>,
): Promise<readonly BilanPassageFormateur[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return [];
  const d: DependancesRappelsFormateur = {
    allume: deps?.allume ?? allumeParDefaut,
    envoyer: deps?.envoyer ?? envoyerParDefaut,
  };
  let allume = false;
  try {
    allume = await d.allume();
  } catch {
    allume = false;
  }
  if (!allume) return [];
  const bilans: BilanPassageFormateur[] = [];
  for (const p of PASSAGES_FORMATEUR)
    bilans.push(await executerPassageFormateur(p, maintenant, d.envoyer));
  return bilans;
}
