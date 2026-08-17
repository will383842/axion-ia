/**
 * Qualiopi — À QUI s'adresse la relance d'une facture impayée (sous-lot 8E).
 *
 * ## Le défaut que ce module ferme
 *
 * Constaté à l'audit OPCO du 15/08 (`_AUDIT/OPCO-COMMERCIAL-2026-08-15/`, T4) :
 * la relance retenait `facture.client?.contactEmail`, **quel que soit le
 * destinataire de la facture**. Or en subrogation la facture est libellée à
 * l'OPCO (`destinataire-facture.ts`) : c'est le financeur qui doit, pas le
 * client.
 *
 * 🔴 Ce que ça produisait concrètement : une **mise en demeure** au ton « avant
 * contentieux », chiffrant des pénalités L.441-10, adressée à une entreprise qui
 * **ne doit rien sur cette facture**. C'est la faute symétrique de celle que
 * `relance-contexte.ts` avait été écrit pour éviter — relancer quelqu'un qui a
 * déjà payé — et elle est pire : là, on réclame à quelqu'un qui n'a jamais dû.
 *
 * ## La règle, en une phrase
 *
 * > Le destinataire d'une relance se dérive du **destinataire de la facture**,
 * > jamais du client de la session. Et quand ce destinataire n'a pas de contact
 * > connu, on **refuse** — on ne se rabat pas sur le client.
 *
 * Le repli est la vraie faute, pas l'absence d'adresse. Une relance non envoyée
 * se voit et se corrige en une minute (« renseignez le gestionnaire ») ; une
 * relance envoyée au mauvais débiteur ne se rattrape pas.
 *
 * ## Pourquoi un module pur, et pas deux corrections locales
 *
 * Le destinataire était calculé à **deux** endroits — `relance-contexte.ts` (ce
 * que l'écran ANNONCE avant l'envoi) et `facturation-hub.ts` (ce que l'action
 * ENVOIE réellement). Deux calculs de la même chose finissent par diverger, et
 * ici la divergence serait invisible : l'écran montrerait une adresse, l'e-mail
 * partirait à une autre. Principe 11 du plan console — un état affiché à deux
 * endroits est calculé par UN seul service.
 *
 * Aucun import Prisma ni Next : mêmes entrées, mêmes sorties.
 */

import type { FactureFormationDestinataire } from "../../../../prisma/generated/client";
import { opcoLabel } from "./opco-referentiel";

/**
 * Qualité du débiteur — ce que l'écran doit dire à l'admin AVANT qu'il clique.
 * « financeur » couvre OPCO et France Travail : ce qui les rapproche (ce n'est
 * pas le client, et le contact vit sur le dossier de financement) compte plus
 * ici que ce qui les distingue.
 */
export type QualiteDebiteur = "entreprise" | "financeur" | "beneficiaire";

/** Le dossier de financement, vu par ce module — sous-ensemble strictement utile. */
export interface DossierPourRelance {
  financeurNom: string | null;
  financeurContactNom: string | null;
  financeurContactEmail: string | null;
  numeroDossierExterne: string | null;
  subrogation: boolean;
}

/** Le client, vu par ce module. */
export interface ClientPourRelance {
  raisonSociale: string | null;
  contactNom: string | null;
  contactEmail: string | null;
  opcoIdentifie?: string | null;
}

export interface EntreeRelance {
  destinataire: FactureFormationDestinataire;
  /** Identité figée sur la facture au moment de l'émission. */
  destinataireNom: string;
  dossier: DossierPourRelance | null | undefined;
  client: ClientPourRelance | null | undefined;
}

export interface DestinataireRelance {
  qualite: QualiteDebiteur;
  /** Adresse retenue, ou `null` quand elle est inconnue. */
  email: string | null;
  /** Nom d'appel dans le corps du message. Jamais vide. */
  nom: string;
  /**
   * Ce qui empêche l'envoi, rédigé pour être affiché TEL QUEL à l'admin, ou
   * `null` si la relance est envoyable.
   *
   * 🔴 Il est renseigné **uniquement** quand l'empêchement est réel. Ne jamais
   * s'en servir pour signaler une simple préférence : un écran qui refuse sans
   * raison sérieuse apprend à ses utilisateurs à passer outre.
   */
  empechement: string | null;
  /**
   * Rappel de contexte affiché à côté du destinataire (« facture subrogée à
   * l'OPCO — dossier n° … »). `null` quand il n'y a rien de particulier à dire.
   */
  precision: string | null;
}

/** Nom lisible du financeur, du plus précis au plus générique. */
function nomFinanceur(entree: EntreeRelance): string {
  const dossier = entree.dossier;
  const nomDossier = dossier?.financeurNom?.trim();
  if (nomDossier != null && nomDossier !== "") return nomDossier;

  if (entree.destinataire === "france_travail") return "France Travail";

  const opcoId = entree.client?.opcoIdentifie?.trim();
  if (opcoId != null && opcoId !== "") return opcoLabel(opcoId);

  // `destinataireNom` a été figé à l'émission par `resoudreDestinataireFacture`
  // et vaut déjà « Atlas » ou « OPCO (à préciser) ». C'est le dernier recours
  // honnête : il vient de la facture elle-même.
  return entree.destinataireNom;
}

/**
 * Résout le destinataire d'une relance.
 *
 * ⚠️ Le paramètre `emailForce` est l'adresse saisie à la main par l'admin dans
 * la boîte de dialogue. Elle **prime**, y compris sur un empêchement : l'admin
 * peut connaître le gestionnaire du dossier sans que la base le porte encore, et
 * lui interdire d'envoyer reviendrait à exiger une saisie en base pour envoyer
 * un e-mail. Ce qu'on ne fait jamais, en revanche, c'est **deviner** cette
 * adresse à sa place.
 */
export function resoudreDestinataireRelance(
  entree: EntreeRelance,
  emailForce?: string | null,
): DestinataireRelance {
  const force = emailForce?.trim();
  const forcee = force != null && force !== "" ? force : null;

  const base = resoudreSansForcage(entree);
  if (forcee === null) return base;

  // Adresse saisie : elle lève l'empêchement, mais la PRÉCISION reste — l'admin
  // doit continuer de voir qu'il écrit à un financeur et non à son client.
  return { ...base, email: forcee, empechement: null };
}

function resoudreSansForcage(entree: EntreeRelance): DestinataireRelance {
  const { destinataire, dossier, client } = entree;

  if (destinataire === "opco" || destinataire === "france_travail") {
    const nom = nomFinanceur(entree);
    const contactEmail = dossier?.financeurContactEmail?.trim();
    // 🔴 Aucun `?? client?.contactEmail` ici, JAMAIS. Vu rouge le 16/08 : le
    // rétablir fait tomber 4 tests de ce module — c'est le repli qui produisait
    // la mise en demeure au mauvais débiteur.
    const email = contactEmail != null && contactEmail !== "" ? contactEmail : null;
    const contactNom = dossier?.financeurContactNom?.trim();

    const numero = dossier?.numeroDossierExterne?.trim();
    const precision =
      dossier == null
        ? `Facture libellée à ${nom} — aucun dossier de financement n'y est rattaché.`
        : dossier.subrogation
          ? `Facture subrogée à ${nom}${numero != null && numero !== "" ? ` — dossier n° ${numero}` : ""}.`
          : `Facture libellée à ${nom}${numero != null && numero !== "" ? ` — dossier n° ${numero}` : ""}.`;

    return {
      qualite: "financeur",
      email,
      nom: contactNom != null && contactNom !== "" ? contactNom : nom,
      empechement:
        email === null
          ? // 🔴 Le message nomme le client EXPRÈS, pour couper court à la
            // tentation de lui écrire : c'est le réflexe que ce module existe
            // pour empêcher.
            `Cette facture est due par ${nom}, pas par ${client?.raisonSociale ?? "le client"}. ` +
            "Renseignez l'e-mail du gestionnaire sur le dossier de financement, ou saisissez-le " +
            "ci-dessus. Relancer le client sur une facture qu'il ne doit pas serait une mise en " +
            "demeure au mauvais débiteur."
          : null,
      precision,
    };
  }

  if (destinataire === "stagiaire") {
    // Reste à charge du bénéficiaire. Son adresse vit sur l'inscription, que ce
    // module ne reçoit pas — et l'entreprise n'en est PAS un substitut : elle
    // n'a pas à connaître la dette personnelle de son salarié (et, pour un
    // particulier, il n'y a pas d'entreprise du tout).
    return {
      qualite: "beneficiaire",
      email: null,
      nom: entree.destinataireNom,
      empechement:
        "Cette facture est un reste à charge dû par le bénéficiaire. Saisissez son e-mail " +
        "ci-dessus : celui de l'entreprise ne peut pas en tenir lieu.",
      precision: "Reste à charge — facture libellée au bénéficiaire.",
    };
  }

  // entreprise
  const email = client?.contactEmail?.trim();
  const raisonSociale = client?.raisonSociale?.trim();
  const contactNom = client?.contactNom?.trim();
  return {
    qualite: "entreprise",
    email: email != null && email !== "" ? email : null,
    nom:
      contactNom != null && contactNom !== ""
        ? contactNom
        : raisonSociale != null && raisonSociale !== ""
          ? raisonSociale
          : entree.destinataireNom,
    empechement:
      email == null || email === ""
        ? "Aucun e-mail de contact sur ce client : saisissez un destinataire ci-dessus."
        : null,
    precision: null,
  };
}
