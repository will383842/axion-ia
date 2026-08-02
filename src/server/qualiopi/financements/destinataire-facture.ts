/**
 * Qualiopi — Résolution du destinataire facturé (identité de l'acheteur).
 *
 * Une facture doit porter le NOM et l'ADRESSE de l'acheteur (art. L.441-9 C. com.
 * et 242 nonies A CGI). Six émetteurs de `FactureFormation` coexistent
 * (`facturation-service`, l'action `financements`, `facture-libre`,
 * `plan-recurrent`, `factures-inter`, `facturation-1to1`) et chacun reconstruisait
 * cette identité pour son compte.
 *
 * 🔴 Ce qu'a coûté la duplication, constaté sur la PREMIÈRE facture réelle
 * (`AXI-FACT-2026-001`, INVEST SUN, 2026-08-01) : l'action `financements`
 * enregistrait `destinataireNom = trainingSession.titreSession` — le TITRE DE LA
 * SESSION — et ne posait ni SIRET ni adresse. Le bloc « Client » du PDF lisait
 * donc « IA pour l'immobilier — INVEST SUN (Saint-Étienne) », sans adresse ni
 * SIRET : facture irrégulière, impassable en charge par le client. L'action
 * chargeait pourtant déjà `client: { select: { raisonSociale: true } }` — et ne
 * s'en servait jamais.
 *
 * D'où ce module : UN SEUL endroit qui répond à « qui paie, et sous quelle
 * identité ». Les appelants n'ont plus à connaître les règles de subrogation.
 */

import type { FactureFormationDestinataire } from "../../../../prisma/generated/client";
import { opcoLabel } from "./opco-referentiel";

/**
 * Le sous-ensemble de `Client` nécessaire pour identifier l'acheteur.
 * Volontairement structurel (pas le type Prisma complet) : les appelants
 * sélectionnent des colonnes différentes, et un `select` partiel doit rester
 * accepté sans cast.
 */
export interface ClientFacturable {
  raisonSociale: string | null;
  siret?: string | null;
  adresse?: string | null;
  adresseRue?: string | null;
  adresseCodePostal?: string | null;
  adresseVille?: string | null;
  tvaIntracom?: string | null;
  opcoIdentifie?: string | null;
}

export interface DestinataireFacture {
  nom: string;
  siret: string | null;
  adresse: string | null;
  tvaIntracom: string | null;
}

/** Recompose l'adresse structurée (EN 16931 BG-8) quand le champ libre est vide. */
function adressePostale(client: ClientFacturable): string | null {
  if (client.adresse != null && client.adresse.trim() !== "") return client.adresse;
  const ligne2 = [client.adresseCodePostal, client.adresseVille]
    .filter((v): v is string => v != null && v.trim() !== "")
    .join(" ");
  const parts = [client.adresseRue, ligne2].filter(
    (v): v is string => v != null && v.trim() !== "",
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Identité de l'acheteur à porter sur la facture.
 *
 * `destinataire` est le destinataire EFFECTIF, subrogation déjà arbitrée par
 * l'appelant (une subrogation OPCO force « opco » : c'est le financeur qui paie).
 *
 * SIRET et adresse ne sont renseignés que pour l'entreprise cliente : ceux d'un
 * OPCO ou de France Travail relèvent d'un référentiel externe et ne sont JAMAIS
 * inventés ici. Un champ absent est `null` — le gabarit omet alors la ligne,
 * plutôt que d'imprimer un libellé vide qui se lirait comme une donnée perdue.
 */
export function resoudreDestinataireFacture(
  destinataire: FactureFormationDestinataire,
  client: ClientFacturable | null | undefined,
): DestinataireFacture {
  const vide = { siret: null, adresse: null, tvaIntracom: null } as const;

  if (destinataire === "opco") {
    const opcoId = client?.opcoIdentifie ?? null;
    // Nom LISIBLE de l'OPCO (« Atlas » plutôt que le slug « atlas »).
    return { nom: opcoId ? opcoLabel(opcoId) : "OPCO (à préciser)", ...vide };
  }

  if (destinataire === "france_travail") {
    return { nom: "France Travail", ...vide };
  }

  if (destinataire === "stagiaire") {
    // Reste à charge facturé au bénéficiaire : l'identité précise dépend de
    // l'inscription, pas du client. Placeholder explicite plutôt que l'entreprise.
    return { nom: "Bénéficiaire (reste à charge)", ...vide };
  }

  // entreprise
  const raisonSociale = client?.raisonSociale ?? null;
  if (client == null || raisonSociale == null || raisonSociale.trim() === "") {
    // Aucune identité disponible : on le DIT. Retomber sur l'intitulé de la
    // prestation produirait une facture d'apparence complète et pourtant nulle.
    return { nom: "À compléter", ...vide };
  }

  return {
    nom: raisonSociale,
    siret: client.siret ?? null,
    adresse: adressePostale(client),
    tvaIntracom: client.tvaIntracom ?? null,
  };
}

/** Colonnes `Client` à sélectionner pour alimenter `resoudreDestinataireFacture`. */
export const CLIENT_FACTURABLE_SELECT = {
  raisonSociale: true,
  siret: true,
  adresse: true,
  adresseRue: true,
  adresseCodePostal: true,
  adresseVille: true,
  tvaIntracom: true,
  opcoIdentifie: true,
} as const;
