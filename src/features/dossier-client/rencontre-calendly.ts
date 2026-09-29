/**
 * La RENCONTRE du dossier client née d'un rendez-vous Calendly
 * (chantier visio, PR 4 ; plan V-05, V-07, V-07b).
 *
 * `assurerRencontrePourCalendly(calendlyEventId)` rend la rencontre de ce
 * rendez-vous — la crée au besoin — et resynchronise sa copie (titre, dates,
 * type). C'est la SEULE fonction qui crée une rencontre depuis Calendly :
 * le balayage du worker, « Après l'appel » de la console, le suivi du
 * rendez-vous et la reprise de l'historique l'appellent tous.
 *
 * ## Ce qu'elle refuse
 *
 * Un rendez-vous HORS de la liste blanche (`server/visio/liste-blanche-types`) :
 * échange apporteur, entretien de candidat, tout type non déclaré. Elle rend
 * alors `{ statut: "hors_liste_blanche" }` et n'écrit RIEN — l'onglet
 * « Rendez-vous » garde son suivi Calendly comme avant.
 *
 * ## Ce qu'elle écrit, dans UNE transaction
 *
 *   · la rencontre : source `calendly`, type (visio / téléphone, dérivé comme
 *     partout du lieu Calendly), copie du titre, des dates et des URI (elles
 *     survivent à la purge des 36 mois), code Meet s'il se lit dans le lieu ;
 *   · les participants : le titulaire, les invités qu'il a ajoutés
 *     (`event_guests`), et Williams — chacun avec l'empreinte de son adresse,
 *     jamais l'adresse elle-même ;
 *   · une PROPOSITION de fiche (`rattacher.ts`, A4 : jamais un rattachement) ;
 *   · `repriseHistorique = true` si le rendez-vous commence AVANT la borne du
 *     balayage : il n'appelle alors ni rappel ni alerte (V-07b).
 *
 * ## La borne
 *
 * Tant que le balayage n'a jamais tourné, la borne est
 * `DEBUT_BALAYAGE_DOSSIER_PAR_DEFAUT` (la mise en ligne de cette PR). Dès son
 * premier passage, c'est la date de ce passage, lue dans
 * `battements_circuit` (`premierLe`, écrit une seule fois). Tout ce qui
 * précède passe par `scripts/visio/reprendre-historique-calendly.ts`.
 *
 * Module NEUTRE (sans `server-only`, sans Next) : le worker l'importe.
 */

import type { RencontreType } from "../../../prisma/generated/client";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { canalDuRendezVous } from "@/server/calendly/canal";
import { estRendezVousDuDossier } from "@/server/visio/liste-blanche-types";
import { lireBorneDuBalayage } from "@/server/visio/battement";
import type { BaseTransactionnelle, Tx } from "./base";
import { proposerRattachement, type IndicesDeRattachement } from "./rattacher";

/**
 * Borne par défaut du balayage : la mise en ligne de cette PR (jour cible du
 * plan, 03/10/2026). Un rendez-vous plus ancien est une REPRISE d'historique.
 */
export const DEBUT_BALAYAGE_DOSSIER_PAR_DEFAUT = new Date("2026-10-03T00:00:00+02:00");

/** Nom affiché de Williams dans les participants. */
export const NOM_WILLIAMS = "Williams Jullin";

/** Ce que la fonction lit d'un rendez-vous Calendly. */
export interface RendezVousCalendlyLu {
  readonly id: string;
  readonly eventTypeName: string;
  readonly linkedJobApplicationId: string | null;
  readonly startTime: Date | null;
  readonly endTime: Date | null;
  readonly inviteeName: string | null;
  readonly inviteeEmail: string | null;
  readonly location: string | null;
  readonly eventUri: string | null;
  readonly inviteeUri: string | null;
  readonly rawPayload: unknown;
}

export type ResultatAssurer =
  | { readonly statut: "hors_liste_blanche" }
  | { readonly statut: "introuvable" }
  | { readonly statut: "creee" | "existante"; readonly rencontreId: string };

export interface OptionsAssurer {
  readonly maintenant?: Date;
  /** Force la borne (tests, reprise d'historique). Défaut : lue en base. */
  readonly borne?: Date;
  /** Reprise de l'historique : la rencontre est marquée `repriseHistorique`. */
  readonly repriseHistorique?: boolean;
}

// ── Lecture de la charge Calendly (pure) ─────────────────────────────────────

function objet(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

function adresses(liste: unknown, champ: string): string[] {
  if (!Array.isArray(liste)) return [];
  return liste.flatMap((x) => {
    const v = objet(x)?.[champ];
    return typeof v === "string" && v.includes("@") ? [v.trim()] : [];
  });
}

/** Les invités ajoutés par le titulaire (`event.event_guests`). */
export function invitesDuRendezVous(rawPayload: unknown): string[] {
  return adresses(objet(objet(rawPayload)?.["event"])?.["event_guests"], "email");
}

/** Le compte de l'hôte Calendly (Williams), s'il est dans la charge. */
export function compteDeLHote(rawPayload: unknown): string | null {
  return (
    adresses(objet(objet(rawPayload)?.["event"])?.["event_memberships"], "user_email")[0] ?? null
  );
}

/** Les réponses au formulaire, question → réponse (texte non vide). */
export function reponsesCalendly(
  rawPayload: unknown,
): Array<{ question: string; reponse: string }> {
  const qa = objet(objet(rawPayload)?.["invitee"])?.["questions_and_answers"];
  if (!Array.isArray(qa)) return [];
  return qa.flatMap((x) => {
    const q = objet(x)?.["question"];
    const a = objet(x)?.["answer"];
    return typeof q === "string" && typeof a === "string" && a.trim() !== ""
      ? [{ question: q.trim(), reponse: a.trim() }]
      : [];
  });
}

/** « Nom de l'entreprise » et « Ville de l'entreprise » du formulaire. */
export function entrepriseDeclaree(rawPayload: unknown): {
  nom: string | null;
  ville: string | null;
} {
  const r = reponsesCalendly(rawPayload);
  const ville = r.find((x) => /ville/i.test(x.question))?.reponse ?? null;
  const nom =
    r.find(
      (x) => /entreprise|soci[ée]t[ée]|structure/i.test(x.question) && !/ville/i.test(x.question),
    )?.reponse ?? null;
  return { nom, ville };
}

/** Le code Meet « abc-defg-hij » d'un lien Meet, ou `null`. */
export function codeMeet(location: string | null | undefined): string | null {
  if (!location) return null;
  const m = /meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})\b/i.exec(location);
  return m?.[1]?.toLowerCase() ?? null;
}

/** Le type de rencontre, dérivé du lieu Calendly comme partout ailleurs. */
export function typeDeRencontre(location: string | null, rawPayload: unknown): RencontreType {
  const canal = canalDuRendezVous(location, rawPayload);
  return canal === "visio" ? "visio" : canal === "telephone" ? "telephone" : "inconnu";
}

// ── Écriture ─────────────────────────────────────────────────────────────────

const CHAMPS_CALENDLY = {
  id: true,
  eventTypeName: true,
  linkedJobApplicationId: true,
  startTime: true,
  endTime: true,
  inviteeName: true,
  inviteeEmail: true,
  location: true,
  eventUri: true,
  inviteeUri: true,
  rawPayload: true,
} as const;

/** La fiche de la rencontre que celle-ci remplace (report fait sur le site). */
async function clientDuReport(tx: Tx, eventUri: string | null): Promise<string | null> {
  if (!eventUri) return null;
  const report = await tx.calendlyReport.findUnique({
    where: { nouvelEventUri: eventUri },
    select: { ancienEventUri: true },
  });
  if (report === null) return null;
  const ancienne = await tx.rencontre.findFirst({
    where: { calendlyEventUri: report.ancienEventUri },
    select: { clientId: true, clientProposeId: true },
  });
  return ancienne?.clientId ?? ancienne?.clientProposeId ?? null;
}

/**
 * Rend la rencontre du rendez-vous Calendly, la crée au besoin. Voir l'en-tête.
 * Ouvre sa propre transaction ; passer `dansLaTransaction(tx)` pour rester
 * dans celle de l'appelant.
 */
export async function assurerRencontrePourCalendly(
  db: BaseTransactionnelle,
  calendlyEventId: string,
  options: OptionsAssurer = {},
): Promise<ResultatAssurer> {
  const maintenant = options.maintenant ?? new Date();
  return db.$transaction(async (tx): Promise<ResultatAssurer> => {
    const ev = (await tx.calendlyEvent.findUnique({
      where: { id: calendlyEventId },
      select: CHAMPS_CALENDLY,
    })) as RendezVousCalendlyLu | null;
    if (ev === null) return { statut: "introuvable" };
    if (!estRendezVousDuDossier(ev)) return { statut: "hors_liste_blanche" };

    const type = typeDeRencontre(ev.location, ev.rawPayload);
    const copie = {
      titre: ev.eventTypeName.slice(0, 255),
      debutPrevu: ev.startTime,
      finPrevue: ev.endTime,
      datesSynchroniseesLe: maintenant,
      type,
      meetCode: codeMeet(ev.location),
      calendlyEventUri: ev.eventUri,
      calendlyInviteeUri: ev.inviteeUri,
    };

    const existante = await tx.rencontre.findUnique({
      where: { calendlyEventId },
      select: { id: true },
    });
    if (existante !== null) {
      await tx.rencontre.update({ where: { id: existante.id }, data: copie });
      return { statut: "existante", rencontreId: existante.id };
    }

    const borne =
      options.borne ?? (await lireBorneDuBalayage(tx)) ?? DEBUT_BALAYAGE_DOSSIER_PAR_DEFAUT;
    const reprise =
      options.repriseHistorique === true ||
      (ev.startTime !== null && ev.startTime.getTime() < borne.getTime());

    const rencontre = await tx.rencontre.create({
      data: {
        source: "calendly",
        calendlyEventId,
        ...copie,
        rattachementStatut: "a_classer",
        repriseHistorique: reprise,
      },
      select: { id: true },
    });

    // Les participants : jamais une adresse, seulement son empreinte.
    const invites = invitesDuRendezVous(ev.rawPayload);
    await tx.rencontreParticipant.create({
      data: {
        rencontreId: rencontre.id,
        nomAffiche: (ev.inviteeName ?? "Invité à compléter").slice(0, 200),
        emailHash: hashEmailForLookup(ev.inviteeEmail),
        role: "client",
      },
    });
    for (const email of invites) {
      await tx.rencontreParticipant.create({
        data: {
          rencontreId: rencontre.id,
          nomAffiche: email.split("@")[0]?.slice(0, 200) ?? "Invité",
          emailHash: hashEmailForLookup(email),
          role: "client",
        },
      });
    }
    await tx.rencontreParticipant.create({
      data: {
        rencontreId: rencontre.id,
        nomAffiche: NOM_WILLIAMS,
        emailHash: hashEmailForLookup(compteDeLHote(ev.rawPayload)),
        role: "axion",
      },
    });

    const indices: IndicesDeRattachement = {
      emailTitulaire: ev.inviteeEmail,
      emailsInvites: invites,
      entrepriseDeclaree: entrepriseDeclaree(ev.rawPayload).nom,
      clientDuReport: await clientDuReport(tx, ev.eventUri),
    };
    await proposerRattachement(tx, rencontre.id, indices);

    return { statut: "creee", rencontreId: rencontre.id };
  });
}
