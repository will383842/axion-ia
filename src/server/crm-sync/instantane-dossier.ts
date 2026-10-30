/**
 * La PHOTO du dossier d'un client que la console envoie AUTOMATIQUEMENT au CRM
 * Pro (synchro console → CRM, décision de Will du 25/10/2026). Module PUR :
 * aucune lecture en base, aucune écriture, aucun réseau. Les appelants lui
 * passent des valeurs déjà lues ; il rend un message `dossier_client_synchro`.
 *
 * ── Miroir du contrat du CRM ────────────────────────────────────────────────
 * `backend/app/Crm/Ingest/DossierClient.php` (axion-crm-pro). Sa liste de clés
 * est FERMÉE : une clé de trop ⇒ 422 et la ligne d'outbox passe `gave_up`. Ce
 * fichier ne construit donc le message que par une LISTE BLANCHE écrite
 * explicitement, jamais en recopiant un objet : un champ ajouté un jour à la
 * fiche ne part pas tout seul. Un test fige cette liste.
 *
 * ── Ce qui ne part JAMAIS ───────────────────────────────────────────────────
 * Le texte des réponses (dirigeant ou collaborateurs), le texte libre (notes,
 * contexte IA, besoins), les outils, les montants (devis, factures, CA), les
 * numéros de pièce. Le questionnaire ne traverse que son ÉTAT : dates et
 * nombre de réponses d'équipe. Le CRM refuse de toute façon ces clés
 * (`forbidden_field`) ; ici elles ne sont même pas lues.
 *
 * ── Aucune suppression ──────────────────────────────────────────────────────
 * Une valeur vide est OMISE du message (jamais `null`), et un contact parti
 * ou sans nom n'est pas envoyé : le CRM lit « absent » comme « ne change
 * rien », et ne supprime rien en retour.
 *
 * ── Qui ne part pas ─────────────────────────────────────────────────────────
 * · un PARTICULIER (sa « raison sociale » est son nom : donnée personnelle) ;
 * · un contact d'origine `mention` (cité sans être présent : jamais informé) ;
 * · un contact dont l'adresse est exclue (`estExclueDuCrm`, l'opposition gagne) ;
 * · une adresse qui n'est pas PRO (jamais une adresse personnelle).
 * Ces règles sont ICI, dans le passage obligé, pas chez l'appelant.
 * `url_console` n'est jamais émise : elle porte le préfixe secret de la console.
 * Un numéro trop long pour le CRM est OMIS, jamais tronqué (un numéro faux
 * partirait sinon).
 *
 * ── Idempotence ─────────────────────────────────────────────────────────────
 * `event_id` = UUID v5 de `dossier_client_synchro:<client>:<version>:<empreinte>`.
 * L'empreinte y figure pour que deux écrivains qui calculent la même version
 * avec des contenus différents ne s'écartent pas l'un l'autre comme doublon ;
 * rejouer le MÊME contenu ne crée rien de plus (côté site : clé unique de
 * l'outbox ; côté CRM : `noop_idempotent`). `empreinteDossier` sert aussi à ne
 * pas émettre une nouvelle version quand rien n'a changé.
 */

import { createHash } from "node:crypto";

import { eventIdDeterministe } from "./event-id";
import { estExclueDuCrm } from "./exclusions";
import { CRM_SYNC_SCHEMA_VERSION, type CrmSyncEvent } from "./types";

/** Clés de `payload.dossier` — miroir de `DossierClient::CLES_DOSSIER`. */
export const CLES_DOSSIER_CRM = [
  "version",
  "statut",
  "facture_emise",
  "rue",
  "telephone",
  "axi_cli",
  "effectif_tranche",
  "url_console",
  "questionnaire",
  "contacts",
  // Fiche complète (lot C1) : facultatives, omises quand vides.
  "etape",
  "cloture_prevue",
  "prochaine_action",
  "taches_ouvertes",
  "nb_emails_console",
  "nb_notes_console",
  "sante",
] as const;

/** Clés d'un contact — miroir de `DossierClient::CLES_CONTACT`. */
export const CLES_CONTACT_CRM = [
  "ref",
  "prenom",
  "nom",
  "email",
  "telephone",
  "fonction",
  "person_key",
  "role_decision",
] as const;

/** Clés de `questionnaire` — miroir de `DossierClient::CLES_QUESTIONNAIRE`. */
export const CLES_QUESTIONNAIRE_CRM = [
  "envoye_le",
  "recu_le",
  "nb_reponses_equipe",
  "attendus",
  "date_limite",
] as const;

/** Valeurs permises par le CRM (`DossierClient::ETAPES`, `SANTES`, `ACTIONS`, `ROLES_DECISION`). */
export type EtapeCrm = "prospect" | "devis_envoye" | "client" | "archive";
export type SanteCrm = "bonne" | "a_surveiller";
export type RoleDecisionCrm =
  "decideur" | "financeur" | "referent" | "utilisateur" | "influenceur" | "bloqueur" | "autre";

/**
 * La fiche complète : seulement des ÉTATS, des dates et des nombres. Chaque
 * champ est facultatif ET `null` = « non lu / vide » : il est alors OMIS du
 * message (le CRM lit « absent » comme « ne change rien »). Jamais d'intitulé
 * de tâche, de texte de note, de montant, d'étiquette ni de responsable.
 */
export interface FicheCompletePourCrm {
  readonly etape?: EtapeCrm | null;
  /** Jour (colonne DATE) de clôture prévue la plus proche des prestations en cours. */
  readonly cloturePrevue?: Date | null;
  readonly sante?: SanteCrm | null;
  /** Plus proche tâche ouverte : son ORIGINE et son jour, jamais son intitulé. */
  readonly prochaineTache?: { readonly origine: string; readonly echeanceLe: Date } | null;
  readonly nbTachesOuvertes?: number | null;
  readonly nbEmailsConsole?: number | null;
  readonly nbNotesConsole?: number | null;
  readonly questionnaireAttendus?: number | null;
  readonly questionnaireDateLimite?: Date | null;
}

/** Clés de `company` que le CRM accepte pour un dossier. */
export const CLES_ENTREPRISE_CRM = ["siren", "name", "postcode", "city"] as const;

/** Plafond du CRM (`DossierClient::MAX_CONTACTS`). */
export const MAX_CONTACTS_CRM = 50;

export interface ContactPourCrm {
  readonly id: string;
  readonly nom: string;
  readonly fonction: string | null;
  readonly telephone: string | null;
  /** Adresse du contact ; `null` si aucune. Ne part que si `emailType` vaut « pro ». */
  readonly email: string | null;
  readonly emailType: "pro" | "perso" | null;
  /** Origine du contact dans la console : `mention` = cité sans être présent. */
  readonly origine: string | null;
  /** `hashEmailForLookup(email)` — la clé qui traverse les deux systèmes. */
  readonly emailHash: string | null;
  /**
   * Opposée à la prospection (`email_oppositions`, via `adressesOpposees()` chez
   * l'appelant, sur TOUTES ses adresses). OBLIGATOIRE : l'oublier ne compile pas.
   */
  readonly oppose: boolean;
  /** Parti de l'entreprise : jamais envoyé (rien ne se supprime, rien ne se réactive). */
  readonly parti: boolean;
  /** Rôle de décision (le plus décisif de ses prestations) ; `null` ou absent : omis. */
  readonly roleDecision?: RoleDecisionCrm | null;
}

export interface EntreeInstantaneCrm {
  readonly clientId: string;
  /** `AXI-CLI-<chiffres>`. */
  readonly numero: string;
  /** `particulier` : jamais envoyé (la raison sociale est un nom de personne). */
  readonly type: "entreprise" | "particulier";
  readonly raisonSociale: string;
  /** SIREN déjà contrôlé (9 chiffres) ou `null` : sans lui, le CRM arbitre. */
  readonly siren: string | null;
  readonly adresseRue: string | null;
  readonly adresseCodePostal: string | null;
  readonly adresseVille: string | null;
  /** Standard de l'entreprise, s'il existe : jamais le téléphone d'un interlocuteur. */
  readonly telephone: string | null;
  /** Effectif au niveau SIREN ; seule la TRANCHE traverse. */
  readonly effectif: number | null;
  /** Au moins une facture ÉMISE (ni brouillon ni annulée) dans la console. */
  readonly factureEmise: boolean;
  /**
   * Case « Facture établie hors console » (table `client_factures_hors_console`) :
   * un prospect devient client dès la première facture, où qu'elle ait été faite.
   */
  readonly factureHorsConsole: boolean;
  readonly questionnaire: {
    readonly envoyeLe: Date | null;
    readonly recuLe: Date | null;
    readonly nbReponsesEquipe: number | null;
  } | null;
  readonly contacts: readonly ContactPourCrm[];
  /** Fiche complète (lot C1) ; absente ⇒ aucune des clés nouvelles ne part. */
  readonly fiche?: FicheCompletePourCrm;
}

/** Le dossier tel qu'il voyage, SANS `version` (qui n'entre pas dans l'empreinte). */
export type DossierPourCrm = {
  statut: "prospect" | "client";
  facture_emise: boolean;
  rue?: string;
  telephone?: string;
  axi_cli?: string;
  effectif_tranche?: string;
  etape?: EtapeCrm;
  cloture_prevue?: string;
  sante?: SanteCrm;
  prochaine_action?: { type: "relance" | "rendez_vous" | "autre"; date: string };
  taches_ouvertes?: { nb: number; prochaine_le?: string };
  nb_emails_console?: number;
  nb_notes_console?: number;
  questionnaire?: {
    envoye_le?: string;
    recu_le?: string;
    nb_reponses_equipe?: number;
    attendus?: number;
    date_limite?: string;
  };
  contacts?: Array<{
    ref: string;
    prenom?: string;
    nom?: string;
    email?: string;
    telephone?: string;
    fonction?: string;
    person_key?: string;
    role_decision?: RoleDecisionCrm;
  }>;
};

/** Tranche d'effectif (texte ≤ 32). `null` : inconnu, jamais « 0 par défaut ». */
export function trancheEffectif(effectif: number | null): string | null {
  if (effectif === null || !Number.isInteger(effectif) || effectif < 0) return null;
  if (effectif < 10) return "0-9";
  if (effectif < 20) return "10-19";
  if (effectif < 50) return "20-49";
  if (effectif < 100) return "50-99";
  if (effectif < 250) return "100-249";
  if (effectif < 500) return "250-499";
  return "500+";
}

function propre(valeur: string | null | undefined, max: number): string | undefined {
  if (valeur === null || valeur === undefined) return undefined;
  const v = valeur.replace(/\s+/g, " ").trim();
  return v === "" ? undefined : v.slice(0, max);
}

/** Valeur qui DÉPASSE le plafond du CRM : omise, jamais tronquée. */
function propreSansCouper(valeur: string | null | undefined, max: number): string | undefined {
  const v = propre(valeur, Number.MAX_SAFE_INTEGER);
  return v === undefined || v.length > max ? undefined : v;
}

/** Vrai si le dossier peut traverser vers le CRM (pas un particulier). */
export function estEligibleAuCrm(entree: Pick<EntreeInstantaneCrm, "type">): boolean {
  return entree.type === "entreprise";
}

/**
 * La console garde « Prénom Nom » dans UN champ. Le premier mot est le prénom
 * quand il y en a plusieurs ; un mot seul est un NOM. Le CRM rapproche par
 * `ref` puis par e-mail : cette coupe ne sert qu'à l'affichage.
 */
export function separerNom(complet: string): { prenom?: string; nom?: string } {
  const mots = complet.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (mots.length === 0) return {};
  if (mots.length === 1) return { nom: mots[0]!.slice(0, 120) };
  return { prenom: mots[0]!.slice(0, 120), nom: mots.slice(1).join(" ").slice(0, 120) };
}

function dateIso(d: Date | null | undefined): string | undefined {
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined;
}

/** Jour AAAA-MM-JJ d'une colonne DATE (minuit UTC) ; `undefined` si invalide. */
function jourIso(d: Date | null | undefined): string | undefined {
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : undefined;
}

/** Jour civil de Paris (AAAA-MM-JJ) d'un horodatage complet ; `undefined` si invalide. */
export function jourParis(d: Date | null | undefined): string | undefined {
  return d instanceof Date && !Number.isNaN(d.getTime())
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d)
    : undefined;
}

/** Entier ≥ 0 ou `undefined` : un nombre invalide est omis, jamais corrigé. */
function nombre(n: number | null | undefined): number | undefined {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : undefined;
}

/** Type d'action côté CRM, déduit de l'ORIGINE de la tâche. */
function typeAction(origine: string): "relance" | "rendez_vous" | "autre" {
  if (origine === "relance") return "relance";
  return origine === "rencontre" ? "rendez_vous" : "autre";
}

/** Les clés facultatives de la fiche complète, posées seulement si la valeur existe. */
function completerFiche(dossier: DossierPourCrm, fiche: FicheCompletePourCrm): void {
  if (fiche.etape) dossier.etape = fiche.etape;
  const cloture = jourIso(fiche.cloturePrevue);
  if (cloture !== undefined) dossier.cloture_prevue = cloture;
  if (fiche.sante) dossier.sante = fiche.sante;
  const jourAction = jourIso(fiche.prochaineTache?.echeanceLe);
  if (fiche.prochaineTache && jourAction !== undefined) {
    // Le type vient de l'ORIGINE de la tâche, jamais de son intitulé.
    dossier.prochaine_action = {
      type: typeAction(fiche.prochaineTache.origine),
      date: jourAction,
    };
  }
  const nbTaches = nombre(fiche.nbTachesOuvertes);
  if (nbTaches !== undefined) {
    dossier.taches_ouvertes = { nb: nbTaches };
    if (jourAction !== undefined) dossier.taches_ouvertes.prochaine_le = jourAction;
  }
  const nbEmails = nombre(fiche.nbEmailsConsole);
  if (nbEmails !== undefined) dossier.nb_emails_console = nbEmails;
  const nbNotes = nombre(fiche.nbNotesConsole);
  if (nbNotes !== undefined) dossier.nb_notes_console = nbNotes;
}

/** Le dossier à envoyer, construit clé par clé (liste blanche). Pur. */
export function dossierPourCrm(entree: EntreeInstantaneCrm): DossierPourCrm {
  // Le CRM exige : statut « client » SI ET SEULEMENT SI facture_emise = true.
  const factureEtablie = entree.factureEmise || entree.factureHorsConsole;
  const dossier: DossierPourCrm = {
    statut: factureEtablie ? "client" : "prospect",
    facture_emise: factureEtablie,
  };

  if (entree.fiche !== undefined) completerFiche(dossier, entree.fiche);

  const rue = propre(entree.adresseRue, 255);
  if (rue !== undefined) dossier.rue = rue;
  const tel = propreSansCouper(entree.telephone, 32);
  if (tel !== undefined) dossier.telephone = tel;
  if (/^AXI-CLI-\d{1,10}$/.test(entree.numero)) dossier.axi_cli = entree.numero;
  const tranche = trancheEffectif(entree.effectif);
  if (tranche !== null) dossier.effectif_tranche = tranche;

  if (entree.questionnaire !== null) {
    const q: NonNullable<DossierPourCrm["questionnaire"]> = {};
    const envoye = dateIso(entree.questionnaire.envoyeLe);
    const recu = dateIso(entree.questionnaire.recuLe);
    if (envoye !== undefined) q.envoye_le = envoye;
    if (recu !== undefined) q.recu_le = recu;
    const nb = entree.questionnaire.nbReponsesEquipe;
    if (nb !== null && Number.isInteger(nb) && nb >= 0) q.nb_reponses_equipe = nb;
    if (Object.keys(q).length > 0) dossier.questionnaire = q;
  }
  // Les deux clés nouvelles du questionnaire vivent dans la fiche complète : un
  // questionnaire sans état (aucun envoi) peut quand même avoir une date limite.
  const attendus = nombre(entree.fiche?.questionnaireAttendus);
  // Horodatage complet (`expireLe`) : le jour se lit à Paris, pas en UTC.
  const dateLimite = jourParis(entree.fiche?.questionnaireDateLimite);
  if (attendus !== undefined || dateLimite !== undefined) {
    const q = dossier.questionnaire ?? {};
    if (attendus !== undefined) q.attendus = attendus;
    if (dateLimite !== undefined) q.date_limite = dateLimite;
    dossier.questionnaire = q;
  }

  const contacts: NonNullable<DossierPourCrm["contacts"]> = [];
  const vus = new Set<string>();
  // Ordre fixé ICI : deux lectures dans un ordre différent ne font pas deux versions.
  const ordonnes = [...entree.contacts].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const c of ordonnes) {
    if (c.parti || c.origine === "mention" || vus.has(c.id)) continue;
    if (contacts.length >= MAX_CONTACTS_CRM) break;
    // L'opposition gagne : la personne n'est pas envoyée du tout. `oppose` vient du
    // registre `email_oppositions` ; `estExclueDuCrm` (adresses de la maison) s'y ajoute.
    if (c.oppose) continue;
    if (c.email !== null && estExclueDuCrm(c.email)) continue;
    const { prenom, nom } = separerNom(c.nom);
    if (prenom === undefined && nom === undefined) continue;
    vus.add(c.id);
    const envoye: NonNullable<DossierPourCrm["contacts"]>[number] = { ref: c.id.slice(0, 64) };
    if (prenom !== undefined) envoye.prenom = prenom;
    if (nom !== undefined) envoye.nom = nom;
    const email = c.emailType === "pro" ? propreSansCouper(c.email, 255)?.toLowerCase() : undefined;
    if (email !== undefined) envoye.email = email;
    const t = propreSansCouper(c.telephone, 32);
    if (t !== undefined) envoye.telephone = t;
    const f = propre(c.fonction, 120);
    if (f !== undefined) envoye.fonction = f;
    if (email !== undefined && c.emailHash !== null && /^[0-9a-f]{64}$/.test(c.emailHash)) {
      envoye.person_key = c.emailHash;
    }
    if (c.roleDecision) envoye.role_decision = c.roleDecision;
    contacts.push(envoye);
  }
  if (contacts.length > 0) dossier.contacts = contacts;

  return dossier;
}

/** `company` du message — quatre clés, rien d'autre. */
export function entreprisePourCrm(
  entree: EntreeInstantaneCrm,
): NonNullable<CrmSyncEvent["company"]> {
  const company: NonNullable<CrmSyncEvent["company"]> = {};
  if (entree.siren !== null && /^\d{9}$/.test(entree.siren)) company.siren = entree.siren;
  const name = propre(entree.raisonSociale, 255);
  if (name !== undefined) company.name = name;
  const postcode = propre(entree.adresseCodePostal, 10);
  if (postcode !== undefined) company.postcode = postcode;
  const city = propre(entree.adresseVille, 255);
  if (city !== undefined) company.city = city;
  return company;
}

/** Sérialisation à clés triées : deux dossiers égaux donnent le même texte. */
function canonique(valeur: unknown): string {
  if (Array.isArray(valeur)) return `[${valeur.map(canonique).join(",")}]`;
  if (typeof valeur === "object" && valeur !== null) {
    const o = valeur as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonique(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(valeur) ?? "null";
}

/**
 * Empreinte de ce qui voyage (entreprise + dossier hors version). Égale à la
 * dernière envoyée ⇒ rien à émettre.
 */
export function empreinteDossier(
  entreprise: NonNullable<CrmSyncEvent["company"]>,
  dossier: DossierPourCrm,
): string {
  return createHash("sha256").update(canonique({ entreprise, dossier })).digest("hex");
}

/** `event_id` d'une version du dossier d'un client, pour un CONTENU donné. */
export function eventIdDossierClient(clientId: string, version: number, empreinte: string): string {
  return eventIdDeterministe(`dossier_client_synchro:${clientId}:${version}:${empreinte}`);
}

/**
 * Le message complet pour le CRM. `version` croît par client (appelant) ;
 * `occurredAt` est l'instant du changement côté console — c'est lui qui fait
 * gagner « le plus récent » côté CRM.
 */
export function evenementDossierClient(
  entree: EntreeInstantaneCrm,
  version: number,
  occurredAt: Date,
): CrmSyncEvent | null {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("La version d'un dossier est un entier ≥ 1.");
  }
  if (!estEligibleAuCrm(entree)) return null;
  const entreprise = entreprisePourCrm(entree);
  const dossier = dossierPourCrm(entree);
  // `person` est requis par le type commun mais ABSENT pour ce message : le CRM
  // le refuse. D'où le passage par `unknown`, assumé ici et nulle part ailleurs.
  const message = {
    schema_version: CRM_SYNC_SCHEMA_VERSION,
    event_id: eventIdDossierClient(entree.clientId, version, empreinteDossier(entreprise, dossier)),
    event_type: "dossier_client_synchro",
    occurred_at: occurredAt.toISOString(),
    subject_ref: `site:client:${entree.clientId}`,
    company: entreprise,
    payload: { dossier: { version, ...dossier } },
  };
  return message as unknown as CrmSyncEvent;
}
