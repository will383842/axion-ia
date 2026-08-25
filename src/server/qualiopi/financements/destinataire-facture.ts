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
  /**
   * `entreprise` | `particulier` — décide si les mentions du Code de commerce
   * ENTRE PROFESSIONNELS sont dues sur la pièce. Optionnel à dessein : un
   * appelant qui ne le sélectionne pas retombe sur le comportement
   * professionnel, qui est le refus PRUDENT (cf. `destinataireEstPersonnePhysique`).
   */
  type?: string | null;
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
  // 🔴 2026-08-25 — `type` manquait, et c'est tout ce qui manquait : les
  // gabarits devis/facture ne pouvaient pas savoir qu'ils parlaient a une
  // personne physique. Cf. `destinataireEstPersonnePhysique` plus bas.
  type: true,
  raisonSociale: true,
  siret: true,
  adresse: true,
  adresseRue: true,
  adresseCodePostal: true,
  adresseVille: true,
  tvaIntracom: true,
  opcoIdentifie: true,
} as const;

/**
 * ── LE DESTINATAIRE DE CETTE PIÈCE EST-IL UNE PERSONNE PHYSIQUE ? ───────────
 *
 * ## 🔴 Le défaut que ce prédicat ferme (mesuré le 2026-08-25, cahier D4-3)
 *
 * La distinction `entreprise` / `particulier` est profonde et correctement
 * câblée PARTOUT AILLEURS : un particulier reçoit un contrat de formation
 * L.6353-3 et jamais une convention, son droit de rétractation de dix jours
 * (L.6353-5) est opposé au serveur avant toute facturation, les CGV portent six
 * sections dédiées.
 *
 * **Deux gabarits n'avaient jamais reçu le type du client.** La facture
 * imprimait sans condition trois mentions du Code de commerce **entre
 * PROFESSIONNELS** — pénalités L.441-10, indemnité forfaitaire de 40 €
 * D.441-5, absence d'escompte L.441-9 — et le devis opposait à un particulier
 * une clause sur « toutes conditions d'achat du client », qu'il n'a pas.
 *
 * 🔑 `legal/legal-mentions.ts` nommait déjà ce défaut : « ce bloc est imprimé
 * sans condition […] **y compris quand le destinataire est un stagiaire
 * particulier** — un renvoi explicite aggraverait ce défaut ». Et le type était
 * déjà sélectionné côté serveur. **Ce n'était pas une donnée manquante :
 * c'était un branchement absent.**
 *
 * ## Pourquoi la règle dérive du DESTINATAIRE, pas du seul client
 *
 * Une facture adressée à un OPCO ou à France Travail part bien à une **personne
 * morale**, et ses mentions entre professionnels sont dues — même si le client
 * de la session est un particulier. Le cas « personne physique » couvre donc
 * exactement DEUX chemins :
 *
 *   1. `stagiaire` — le reste à charge facturé au bénéficiaire lui-même ;
 *   2. `entreprise` quand le client est de type `particulier`.
 *
 * ⚠️ **Refus par défaut dans le sens PRUDENT.** Sans information sur le client,
 * on garde les mentions professionnelles : les retirer à tort à une entreprise
 * ferait perdre à l'organisme un droit (pénalités, indemnité de recouvrement),
 * alors que les conserver à tort sur une facture de particulier est le défaut
 * que l'on corrige — moins grave que de renoncer à une créance.
 */
export function destinataireEstPersonnePhysique(
  destinataire: FactureFormationDestinataire,
  // Volontairement PLUS ETROIT que `ClientFacturable` : ce predicat ne lit que
  // `type`. Un appelant qui n'a selectionne que cette colonne — le chemin de
  // REGENERATION du PDF est dans ce cas — doit pouvoir l'appeler sans cast.
  client: { type?: string | null } | null | undefined,
): boolean {
  if (destinataire === "stagiaire") return true;
  if (destinataire !== "entreprise") return false;
  return client?.type === "particulier";
}
