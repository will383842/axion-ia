/**
 * Créer un rendez-vous dans la console — en 2 clics depuis un projet
 * (chantier visio, PR 4 ; plan V-05b, décision B9 prise sur recommandation).
 *
 * Les réservations Calendly clients (Diagnostic IA, Échange projet, Salon —
 * chantier « Types de rendez-vous », 2026-10) ne couvrent que la PREMIÈRE
 * prise de contact. Un client qui revient — deuxième, troisième rendez-vous,
 * réunion improvisée — n'a pas de réservation Calendly : sans cet écran, ses
 * rendez-vous n'entreraient jamais dans son dossier, et le pilote n'aurait pas
 * de rencontre de test.
 *
 * ## Ce que la rencontre est, et n'est pas
 *
 * Elle naît `saisie_manuelle`, `planifie`, rangée (`valide`) sur une fiche
 * client EXISTANTE — la base l'exige (CHECK `rencontres_saisie_sur_fiche_validee`) :
 * c'est ce qui garantit qu'aucun entretien de candidat ni échange apporteur
 * n'entre au dossier par cette porte. Son statut évolue ensuite par
 * `enregistrerSuivi()`, et par lui seul.
 *
 * ## La case « test interne »
 *
 * Refusée ici (et pas seulement masquée à l'écran) hors mode pilote et hors
 * de la fiche du client fictif (`client-test.ts`).
 *
 * ## L'e-mail d'invitation d'une visio
 *
 * Pour une visio, un e-mail d'invitation (date, heure, lien) est PRÉPARÉ et
 * garé dans « E-mails à valider » (`exigerValidation: true`) : Will le relit,
 * l'envoie ou l'écarte s'il a déjà écrit au client. Rien ne part sans lui.
 * La phrase d'information sur l'enregistrement n'y figure que lorsque
 * l'enregistrement est ANNONCÉ par la notice (`ENREGISTREMENT_ANNONCE_AUX_CLIENTS`,
 * DÉRIVÉ de la source unique `src/server/visio/visio-annonce.ts`, correction
 * anti-doublon D2) ou pour une rencontre de test : avant, elle promettrait
 * au client un traitement que la politique de confidentialité ne décrit pas.
 */

import type { RencontreType } from "../../../prisma/generated/client";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import type { BaseTransactionnelle } from "./base";
import { codeMeet, NOM_WILLIAMS } from "./rencontre-calendly";
import { estClientTestInterne, modePiloteDisponible, caseTestInterneVisible } from "./client-test";
import { ENREGISTREMENT_ANNONCE_AUX_CLIENTS } from "@/server/visio/visio-annonce";

/** Durées proposées (minutes). */
export const DUREES_RENDEZ_VOUS = [15, 30, 45, 60, 90, 120] as const;

export class ErreurCreationRencontre extends Error {}

export interface EntreeCreerRencontre {
  readonly clientId: string;
  readonly projetId?: string | null;
  readonly type: Extract<RencontreType, "visio" | "telephone" | "presentiel">;
  readonly debut: Date;
  readonly dureeMin: number;
  readonly titre?: string | null;
  /** Lien Meet (https) : facultatif. */
  readonly lienVisio?: string | null;
  /** Personnes de la fiche invitées. */
  readonly contactIds?: readonly string[];
  readonly testInterne?: boolean;
  readonly parAdminId: string;
}

export interface InvitationAPreparer {
  readonly destinataire: string;
  readonly payload: {
    readonly titre: string;
    readonly debutIso: string;
    readonly dureeMin: number;
    readonly lienVisio: string | null;
    readonly phraseEnregistrement: boolean;
  };
}

export interface ResultatCreerRencontre {
  readonly rencontreId: string;
  /** L'e-mail à garer pour validation (visio avec une personne joignable), ou `null`. */
  readonly invitation: InvitationAPreparer | null;
}

/** « Rendez-vous du 3 octobre 2026 » — titre par défaut, modifiable. */
export function titreParDefaut(debut: Date): string {
  const jour = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(debut);
  return `Rendez-vous du ${jour}`;
}

/** Un lien de visio acceptable : https seulement (même règle que la carte). */
export function lienVisioValide(lien: string | null | undefined): string | null {
  const v = (lien ?? "").trim();
  if (v === "") return null;
  try {
    return new URL(v).protocol === "https:" ? v : null;
  } catch {
    return null;
  }
}

/** Crée la rencontre. Voir l'en-tête. */
export async function creerRencontre(
  db: BaseTransactionnelle,
  e: EntreeCreerRencontre,
): Promise<ResultatCreerRencontre> {
  if (!Number.isFinite(e.debut.getTime())) {
    throw new ErreurCreationRencontre("Date ou heure invalide.");
  }
  if (!Number.isInteger(e.dureeMin) || e.dureeMin < 5 || e.dureeMin > 480) {
    throw new ErreurCreationRencontre("Durée invalide (de 5 minutes à 8 heures).");
  }
  const lien = lienVisioValide(e.lienVisio);
  if ((e.lienVisio ?? "").trim() !== "" && lien === null) {
    throw new ErreurCreationRencontre("Le lien de la visio doit commencer par https://.");
  }

  return db.$transaction(async (tx): Promise<ResultatCreerRencontre> => {
    const fiche = await tx.client.findUnique({ where: { id: e.clientId }, select: { id: true } });
    if (fiche === null) throw new ErreurCreationRencontre("Fiche client introuvable.");
    if (e.projetId) {
      const p = await tx.projet.findUnique({
        where: { id: e.projetId },
        select: { clientId: true },
      });
      if (p === null || p.clientId !== e.clientId) {
        throw new ErreurCreationRencontre("Ce projet n'appartient pas à ce client.");
      }
    }
    if (e.testInterne === true) {
      const visible = caseTestInterneVisible({
        modePilote: await modePiloteDisponible(tx),
        surLeClientFictif: await estClientTestInterne(tx, e.clientId),
      });
      if (!visible) {
        throw new ErreurCreationRencontre(
          "Un rendez-vous de test ne se crée qu'en mode pilote, sur la fiche du client fictif.",
        );
      }
    }

    const titre = (e.titre ?? "").trim().slice(0, 255) || titreParDefaut(e.debut);
    const maintenant = new Date();
    const rencontre = await tx.rencontre.create({
      data: {
        source: "saisie_manuelle",
        type: e.type,
        estTestInterne: e.testInterne === true,
        titre,
        debutPrevu: e.debut,
        finPrevue: new Date(e.debut.getTime() + e.dureeMin * 60_000),
        statut: "planifie",
        clientId: e.clientId,
        projetId: e.projetId ?? null,
        rattachementStatut: "valide",
        rattacheParId: e.parAdminId,
        rattacheLe: maintenant,
        creeeParId: e.parAdminId,
        meetCode: codeMeet(lien),
      },
      select: { id: true },
    });

    await tx.rencontreParticipant.create({
      data: { rencontreId: rencontre.id, nomAffiche: NOM_WILLIAMS, role: "axion" },
    });

    let premiereAdresse: string | null = null;
    for (const contactId of [...new Set(e.contactIds ?? [])]) {
      const c = await tx.clientContact.findUnique({
        where: { id: contactId },
        select: { id: true, clientId: true, nom: true },
      });
      if (c === null || c.clientId !== e.clientId) {
        throw new ErreurCreationRencontre("Une personne choisie n'appartient pas à ce client.");
      }
      const adresse = await tx.clientContactAdresse.findFirst({
        where: { contactId },
        orderBy: { ajouteeLe: "asc" },
        select: { email: true },
      });
      premiereAdresse ??= adresse?.email ?? null;
      await tx.rencontreParticipant.create({
        data: {
          rencontreId: rencontre.id,
          clientId: e.clientId,
          contactId,
          nomAffiche: c.nom.slice(0, 200),
          emailHash: hashEmailForLookup(adresse?.email ?? null),
          role: "client",
        },
      });
    }

    await tx.rencontreRattachementEvenement.create({
      data: {
        rencontreId: rencontre.id,
        action: "valide",
        nouveauClientId: e.clientId,
        nouveauProjetId: e.projetId ?? null,
        parAdminId: e.parAdminId,
      },
    });

    const invitation: InvitationAPreparer | null =
      e.type === "visio" && premiereAdresse !== null
        ? {
            destinataire: premiereAdresse,
            payload: {
              titre,
              debutIso: e.debut.toISOString(),
              dureeMin: e.dureeMin,
              lienVisio: lien,
              phraseEnregistrement: ENREGISTREMENT_ANNONCE_AUX_CLIENTS || e.testInterne === true,
            },
          }
        : null;

    return { rencontreId: rencontre.id, invitation };
  });
}
