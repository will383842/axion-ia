/**
 * Réseau d'apporteurs (démarrage manuel) — les ENTREPRISES PRÉSENTÉES.
 *
 * Williams enregistre chaque présentation à la réception de l'e-mail de l'apporteur
 * (`recueAt` fait foi, contrat v2 art. 3.5), puis choisit une réponse :
 *   · « Bien reçu »   → `reservee`, accusé à l'apporteur ET prise de contact de l'entreprise ;
 *   · « Déjà connue » → `deja_connue`, refus motivé « deja-connue » ;
 *   · « Pas disponible » → `deja_connue`, refus motivé « pas-disponible » (entreprise déjà
 *     attribuée à un autre apporteur : aucune seconde prise de contact) ;
 *   · « Hors champ »  → `hors_champ`, refus motivé « hors-champ ».
 *
 * 🔑 Une présentation « à traiter » est une `reservee` sans `contactEnvoyeAt` : le schéma
 * n'a pas d'état « reçue, pas encore répondue » (voir le rapport). Les signalements
 * (déjà présentée, déjà cliente) ne sont qu'une INDICATION : Williams tranche.
 *
 * ⚠️ Jamais d'e-mail qui dise à un apporteur QUI occupe une entreprise, jamais d'e-mail
 * qui dise à une entreprise qu'on « vérifie » : les gabarits le garantissent, ce module
 * ne leur passe que ce qu'ils doivent dire.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { decryptPii, encryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import type { StatutPresentation } from "../../../prisma/generated/client";

import { lireEtablissementParSiret } from "./annuaire";
import {
  enregistrerEtablissement,
  lireEtablissements,
  memePerimetre,
  signeAvant26,
  siretValide,
  type Etablissement,
} from "./etablissement-presentation";
import {
  apercu,
  avecTexteLibre,
  envoyer,
  type ApercuRendu,
  type EnvoiApporteur,
  type GabaritApporteur,
  type ResultatEnvoi,
} from "./envois";
import { idsPriseDeContactRebondie } from "./rebonds";
import { ajouterMois, finDeProtection } from "./regles";
import { annoncerAttribution } from "./attribution-annonce";

// ── Signalements avant de répondre ───────────────────────────────────────

export type Signalement =
  | {
      type: "deja_presentee";
      apporteur: string;
      statut: "reservee" | "confirmee";
      jusquAu: Date | null;
    }
  | { type: "facture_recente"; nombre: number }
  | { type: "devis_recent"; nombre: number }
  | { type: "devis_signe_non_facture"; nombre: number };

/** Un devis signé est-il entièrement facturé ? (factures hors avoirs, brouillons et annulées) */
export function devisSigneNonFacture(d: {
  montantTotalHtCents: number;
  facturesHtCents: readonly number[];
}): boolean {
  const facture = d.facturesHtCents.reduce((s, x) => s + x, 0);
  return facture < d.montantTotalHtCents;
}

/** Une présentation occupe-t-elle encore le SIREN à cette date ? */
export function presentationOccupe(
  p: { statut: StatutPresentation; protegeeJusquAt: Date | null },
  maintenant: Date,
): boolean {
  if (p.statut === "reservee") return true;
  if (p.statut === "confirmee")
    return !p.protegeeJusquAt || p.protegeeJusquAt.getTime() >= maintenant.getTime();
  return false;
}

const STATUTS_FACTURE_EMISE = ["emise", "partiellement_payee", "en_retard", "payee"] as const;

/** Ce que la console signale avant que Williams réponde. `saufId` : la présentation elle-même. */
export async function lireSignalements(
  siren: string,
  maintenant: Date,
  saufId?: string,
  /** Contrat 2.6 : l'établissement visé ; absent = toute l'entreprise (comportement d'avant). */
  etablissement: Etablissement = { siret: null, entreprise: false, exclus: [] },
): Promise<Signalement[]> {
  const out: Signalement[] = [];
  const [presentations, tousClients] = await Promise.all([
    prisma.presentationEntreprise.findMany({
      where: {
        siren,
        statut: { in: ["reservee", "confirmee"] },
        ...(saufId ? { id: { not: saufId } } : {}),
      },
      select: {
        id: true,
        statut: true,
        protegeeJusquAt: true,
        apporteur: { select: { prenom: true, nom: true } },
      },
    }),
    prisma.client.findMany({ where: { siren }, select: { id: true, siret: true } }),
  ]);
  const etabs = await lireEtablissements(presentations.map((p) => p.id));
  // Art. 3.3 (2.6) : l'antériorité se juge par établissement. Une fiche client SANS SIRET compte
  // (on ne sait pas quel établissement elle désigne) : l'indication reste prudente.
  const clients =
    etablissement.siret && !etablissement.entreprise
      ? tousClients.filter((c) => !c.siret || c.siret.replace(/\s+/g, "") === etablissement.siret)
      : tousClients;
  for (const p of presentations) {
    if (!presentationOccupe(p, maintenant)) continue;
    if (!memePerimetre(etablissement, etabs.get(p.id)!)) continue;
    out.push({
      type: "deja_presentee",
      apporteur: nomComplet(p.apporteur.prenom, p.apporteur.nom),
      statut: p.statut as "reservee" | "confirmee",
      jusquAu: p.protegeeJusquAt,
    });
  }
  const clientId = { in: clients.map((c) => c.id) };
  if (clients.length === 0) return out;
  const [factures, devisRecents, devisSignes] = await Promise.all([
    prisma.factureFormation.count({
      where: {
        clientId,
        avoirDeId: null,
        statut: { in: [...STATUTS_FACTURE_EMISE] },
        emiseAt: { gte: ajouterMois(maintenant, -24) },
      },
    }),
    prisma.devis.count({
      where: {
        clientId,
        statut: { not: "brouillon" },
        OR: [
          { sentAt: { gte: ajouterMois(maintenant, -6) } },
          { sentAt: null, createdAt: { gte: ajouterMois(maintenant, -6) } },
        ],
      },
    }),
    prisma.devis.findMany({
      where: { clientId, acceptedAt: { not: null } },
      select: {
        montantTotalHtCents: true,
        facturesFormation: {
          where: { avoirDeId: null, statut: { notIn: ["brouillon", "annulee"] } },
          select: { montantHtCents: true },
        },
      },
    }),
  ]);
  if (factures > 0) out.push({ type: "facture_recente", nombre: factures });
  if (devisRecents > 0) out.push({ type: "devis_recent", nombre: devisRecents });
  const nonFactures = devisSignes.filter((d) =>
    devisSigneNonFacture({
      montantTotalHtCents: d.montantTotalHtCents,
      facturesHtCents: d.facturesFormation.map((f) => f.montantHtCents),
    }),
  ).length;
  if (nonFactures > 0) out.push({ type: "devis_signe_non_facture", nombre: nonFactures });
  return out;
}

export function libelleSignalement(s: Signalement): string {
  switch (s.type) {
    case "deja_presentee":
      return s.statut === "reservee"
        ? `Déjà présentée par ${s.apporteur} (en attente de réponse)`
        : `Déjà présentée par ${s.apporteur}, protégée${s.jusquAu ? ` jusqu'au ${dateCourte(s.jusquAu)}` : ""}`;
    case "facture_recente":
      return `Déjà cliente : ${s.nombre} facture(s) ces 24 derniers mois`;
    case "devis_recent":
      return `${s.nombre} devis émis ces 6 derniers mois`;
    case "devis_signe_non_facture":
      return `${s.nombre} devis signé(s) pas encore entièrement facturé(s)`;
  }
}

// ── Formats ──────────────────────────────────────────────────────────────

export function nomComplet(prenomChiffre: string, nomChiffre: string): string {
  return [decryptPii(prenomChiffre), decryptPii(nomChiffre)].filter(Boolean).join(" ").trim();
}

export function dateCourte(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

/** « lundi 5 octobre », en heure de Paris (format attendu par les gabarits). */
export function dateGabarit(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  });
}

/** Le nom de famille deviné dans « Claire Durand » : tout sauf le premier mot. */
export function nomFamilleDe(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  return mots.length > 1 ? mots.slice(1).join(" ") : (mots[0] ?? "");
}

// ── Création ─────────────────────────────────────────────────────────────

export interface SaisiePresentation {
  apporteurId: string;
  /** Contrat 2.6 : le SIRET de l'établissement visité (14 chiffres) ; le SIREN en est déduit. */
  siret: string;
  denomination: string;
  personneNom: string;
  personneFonction: string | null;
  personneEmail: string;
  personneTelephone: string | null;
  besoin: string | null;
  /** « AAAA-MM-JJ », facultatif. */
  dateEchange: string | null;
  /** IGNORÉ depuis le 2026-10-07 : la déclaration est horodatée par le serveur (art. 3.4). */
  recueAt?: Date;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function creerPresentation(
  s: SaisiePresentation,
  maintenant: Date = new Date(),
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const siret = s.siret.replace(/\s+/g, "");
  if (!siretValide(siret))
    return { ok: false, message: "Numéro SIRET invalide : vérifiez les 14 chiffres." };
  const siren = siret.slice(0, 9);
  if (!s.personneNom.trim())
    return { ok: false, message: "Indiquez le nom de la personne présentée." };
  if (!EMAIL.test(s.personneEmail.trim()))
    return { ok: false, message: "Adresse e-mail de la personne invalide." };
  // Contrat 2.3, art. 3.2 et 3.4 (2026-10-07) : une déclaration ne vaut que par le formulaire,
  // et sa durée court de l'HORODATAGE PAR LE SERVEUR. La saisie console n'est qu'un rattrapage :
  // elle est horodatée maintenant, jamais à une date tapée (pas d'antidatage).
  const recueAt = maintenant;
  const apporteur = await prisma.apporteurReseau.findUnique({
    where: { id: s.apporteurId },
    select: { statut: true, signatureApporteur: true },
  });
  if (!apporteur || apporteur.statut !== "signe") {
    return { ok: false, message: "Choisissez un apporteur dont le contrat est signé." };
  }
  // Doublon (relecture de a1, 2026-10-08) : même contrôle que le formulaire de l'apporteur
  // (`declarerEntreprise`). Une entreprise que CET apporteur a déjà présentée et qui occupe encore
  // son SIREN (réservée, ou protégée et non échue) n'est pas enregistrée une seconde fois — la
  // saisie console ne doit pas ouvrir une seconde réservation de 30 jours.
  const siennes = await prisma.presentationEntreprise.findMany({
    where: { apporteurId: s.apporteurId, siren, statut: { in: ["reservee", "confirmee"] } },
    select: { id: true, statut: true, protegeeJusquAt: true },
  });
  // Contrat 2.6 : par établissement — un AUTRE établissement de la même entreprise se déclare.
  const etabs = await lireEtablissements(siennes.map((p) => p.id));
  // Relecture de a1 (art. 13) : un apporteur au contrat signé AVANT la 2.6 garde l'entreprise
  // entière — la règle d'établissement ne lui est pas opposable sans avenant.
  const entiere = signeAvant26(apporteur.signatureApporteur);
  const moi: Etablissement = { siret, entreprise: entiere, exclus: [] };
  if (
    siennes.some((p) => presentationOccupe(p, maintenant) && memePerimetre(moi, etabs.get(p.id)!))
  ) {
    return {
      ok: false,
      message: "Cet apporteur a déjà présenté cette entreprise : elle est encore en cours.",
    };
  }
  let denomination = s.denomination.trim();
  if (!denomination) {
    const r = await lireEtablissementParSiret(siret);
    denomination = r.ok ? (r.entreprise.denomination ?? "") : "";
  }
  if (!denomination)
    return { ok: false, message: "Indiquez le nom de l'entreprise (registre muet)." };
  const dateEchange =
    s.dateEchange && /^\d{4}-\d{2}-\d{2}$/.test(s.dateEchange)
      ? new Date(`${s.dateEchange}T00:00:00Z`)
      : null;
  const cree = await prisma.$transaction(async (tx) => {
    const c = await tx.presentationEntreprise.create({
      data: {
        apporteurId: s.apporteurId,
        siren,
        denomination: denomination.slice(0, 250),
        personneNom: encryptPii(s.personneNom.trim()),
        personneFonction: s.personneFonction?.trim().slice(0, 150) || null,
        personneEmail: encryptPii(s.personneEmail.trim()),
        // Empreinte de recherche : export et effacement RGPD de la personne présentée.
        personneEmailHash: hashEmailForLookup(s.personneEmail.trim()) || null,
        personneTelephone: s.personneTelephone?.trim()
          ? encryptPii(s.personneTelephone.trim())
          : null,
        besoin: s.besoin?.trim() || null,
        dateEchange,
        recueAt,
      },
      select: { id: true },
    });
    await enregistrerEtablissement(c.id, siret, entiere, tx);
    return c;
  });
  return { ok: true, id: cree.id };
}

// ── Lecture pour la console ──────────────────────────────────────────────

export type OngletPresentations = "a-traiter" | "protegees" | "toutes";

export interface PresentationVue {
  id: string;
  apporteurId: string;
  apporteur: string;
  siren: string;
  denomination: string;
  personneNom: string;
  personneFonction: string | null;
  personneEmail: string;
  personneTelephone: string | null;
  besoin: string | null;
  dateEchange: Date | null;
  recueAt: Date;
  statut: StatutPresentation;
  contactEnvoyeAt: Date | null;
  confirmeeAt: Date | null;
  confirmationTacite: boolean;
  protegeeJusquAt: Date | null;
  prolongeeAt: Date | null;
  motifProlongation: string | null;
  note: string | null;
  aTraiter: boolean;
  /** La prise de contact est revenue en erreur définitive : adresse à corriger, le délai ne court pas. */
  adresseACorriger: boolean;
  /** Contrat 2.6 : l'établissement déclaré, et son extension éventuelle à toute l'entreprise. */
  etablissement: Etablissement;
}

export function estATraiter(p: {
  statut: StatutPresentation;
  contactEnvoyeAt: Date | null;
}): boolean {
  return p.statut === "reservee" && p.contactEnvoyeAt === null;
}

function filtreOnglet(onglet: OngletPresentations) {
  switch (onglet) {
    case "a-traiter":
      return { statut: "reservee" as const, contactEnvoyeAt: null };
    case "protegees":
      return {
        OR: [
          { statut: "reservee" as const, contactEnvoyeAt: { not: null } },
          { statut: "confirmee" as const },
        ],
      };
    default:
      return {};
  }
}

export async function lirePresentations(onglet: OngletPresentations): Promise<PresentationVue[]> {
  const lignes = await prisma.presentationEntreprise.findMany({
    where: filtreOnglet(onglet),
    orderBy: { recueAt: onglet === "a-traiter" ? "asc" : "desc" },
    take: 300,
    include: { apporteur: { select: { prenom: true, nom: true } } },
  });
  const rebonds = await idsPriseDeContactRebondie(
    lignes.filter((p) => p.statut === "reservee" && p.contactEnvoyeAt).map((p) => p.id),
  );
  const etabs = await lireEtablissements(lignes.map((p) => p.id));
  return lignes.map((p) => ({
    id: p.id,
    apporteurId: p.apporteurId,
    apporteur: nomComplet(p.apporteur.prenom, p.apporteur.nom),
    siren: p.siren,
    denomination: p.denomination,
    personneNom: decryptPii(p.personneNom) ?? "",
    personneFonction: p.personneFonction,
    personneEmail: decryptPii(p.personneEmail) ?? "",
    personneTelephone: decryptPii(p.personneTelephone),
    besoin: p.besoin,
    dateEchange: p.dateEchange,
    recueAt: p.recueAt,
    statut: p.statut,
    contactEnvoyeAt: p.contactEnvoyeAt,
    confirmeeAt: p.confirmeeAt,
    confirmationTacite: p.confirmationTacite,
    protegeeJusquAt: p.protegeeJusquAt,
    prolongeeAt: p.prolongeeAt,
    motifProlongation: p.motifProlongation,
    note: p.note,
    aTraiter: estATraiter(p),
    adresseACorriger: rebonds.has(p.id),
    etablissement: etabs.get(p.id) ?? { siret: null, entreprise: false, exclus: [] },
  }));
}

export async function compterParOnglet(): Promise<Record<OngletPresentations, number>> {
  const [a, p, t] = await Promise.all([
    prisma.presentationEntreprise.count({ where: filtreOnglet("a-traiter") }),
    prisma.presentationEntreprise.count({ where: filtreOnglet("protegees") }),
    prisma.presentationEntreprise.count(),
  ]);
  return { "a-traiter": a, protegees: p, toutes: t };
}

/** Les apporteurs au contrat signé, pour la liste du formulaire. */
export async function lireApporteursSignes(): Promise<Array<{ id: string; nom: string }>> {
  const l = await prisma.apporteurReseau.findMany({
    where: { statut: "signe" },
    select: { id: true, prenom: true, nom: true },
  });
  return l
    .map((a) => ({ id: a.id, nom: nomComplet(a.prenom, a.nom) }))
    .sort((x, y) => x.nom.localeCompare(y.nom, "fr"));
}

// ── Les trois réponses ───────────────────────────────────────────────────

export type ReponsePresentation = "bien_recu" | "deja_connue" | "pas_disponible" | "hors_champ";
export const REPONSES: readonly ReponsePresentation[] = [
  "bien_recu",
  "deja_connue",
  "pas_disponible",
  "hors_champ",
];

export const MESSAGE_DEJA_ATTRIBUEE =
  "Cette entreprise est déjà attribuée à un autre apporteur : aucune seconde prise de contact ne part. Répondez « Pas disponible » à cet apporteur.";

/**
 * Cette entreprise est-elle déjà attribuée à UN AUTRE apporteur ? Oui si, pour le même SIREN,
 * une autre présentation a déjà reçu « Bien reçu » (prise de contact partie) et court encore
 * (réservée ou confirmée). Une seconde prise de contact nommerait un autre apporteur.
 */
export function dejaAttribueeAUnAutre(
  autres: ReadonlyArray<{
    apporteurId: string;
    statut: StatutPresentation;
    contactEnvoyeAt: Date | null;
  }>,
  apporteurId: string,
): boolean {
  return autres.some(
    (a) =>
      a.apporteurId !== apporteurId &&
      a.contactEnvoyeAt !== null &&
      (a.statut === "reservee" || a.statut === "confirmee"),
  );
}

export const MESSAGE_DECLARATION_PLUS_ANCIENNE =
  "Une déclaration plus ancienne existe encore pour ce SIREN, déposée par un autre apporteur : elle passe en premier (contrat art. 3.5). Traitez d'abord la plus ancienne ; cette entreprise ne peut pas être contactée sur celle-ci tant que l'autre court.";

/**
 * Une déclaration PLUS ANCIENNE (`recueAt`) du même SIREN, d'un autre apporteur, occupe-t-elle
 * encore le SIREN ? Si oui, « Bien reçu » sur la plus récente est refusé (art. 3.5 : la
 * déclaration la plus ancienne est prioritaire). Pur.
 */
export function existeDeclarationPlusAncienne(
  autres: ReadonlyArray<{
    apporteurId: string;
    statut: StatutPresentation;
    protegeeJusquAt?: Date | null;
    recueAt?: Date | null;
  }>,
  moi: { apporteurId: string; recueAt: Date },
  maintenant: Date,
): boolean {
  return autres.some(
    (a) =>
      a.apporteurId !== moi.apporteurId &&
      !!a.recueAt &&
      a.recueAt.getTime() < moi.recueAt.getTime() &&
      presentationOccupe(
        { statut: a.statut, protegeeJusquAt: a.protegeeJusquAt ?? null },
        maintenant,
      ),
  );
}

/**
 * Le refus éventuel de « Bien reçu » (message), ou `null`. Lu dans `db` : appelé DANS la
 * transaction qui prend la ligne, pour que deux clics simultanés (sur deux apporteurs du même
 * SIREN) ne passent pas tous les deux.
 */
async function refusBienRecu(
  db: Pick<typeof prisma, "presentationEntreprise">,
  presentationId: string,
  maintenant: Date,
): Promise<string | null> {
  const p = await db.presentationEntreprise.findUnique({
    where: { id: presentationId },
    select: { siren: true, apporteurId: true, recueAt: true },
  });
  if (!p) return null;
  const tous = await db.presentationEntreprise.findMany({
    where: {
      siren: p.siren,
      id: { not: presentationId },
      apporteurId: { not: p.apporteurId },
      statut: { in: ["reservee", "confirmee"] },
    },
    select: {
      id: true,
      apporteurId: true,
      statut: true,
      contactEnvoyeAt: true,
      recueAt: true,
      protegeeJusquAt: true,
    },
    take: 20,
  });
  // Contrat 2.6 : seuls comptent ceux qui visent le même périmètre (même établissement, ou
  // toute l'entreprise) ; un autre établissement de la même entreprise ne bloque rien.
  const etabs = await lireEtablissements([presentationId, ...tous.map((a) => a.id)]);
  const autres = tous.filter((a) => memePerimetre(etabs.get(presentationId)!, etabs.get(a.id)!));
  if (dejaAttribueeAUnAutre(autres, p.apporteurId)) return MESSAGE_DEJA_ATTRIBUEE;
  if (
    existeDeclarationPlusAncienne(
      autres,
      { apporteurId: p.apporteurId, recueAt: p.recueAt },
      maintenant,
    )
  )
    return MESSAGE_DECLARATION_PLUS_ANCIENNE;
  return null;
}

export type Civilite = "" | "Monsieur" | "Madame";

export interface OptionsReponse {
  /** Prise de contact de l'entreprise : « Bonjour Madame Durand » (vide → prénom). */
  civilite: Civilite;
  nomFamille: string;
  /** Textes réécrits par Will, par gabarit (déjà validés). Absent = texte par défaut. */
  textes?: Partial<Record<GabaritApporteur, string>>;
}

interface DonneesEnvoi {
  presentation: {
    id: string;
    denomination: string;
    recueAt: Date;
    personneNom: string;
    personneEmail: string;
  };
  apporteur: { id: string; prenom: string; nom: string; email: string };
}

const MOTIF_PAR_REPONSE = {
  deja_connue: "deja-connue",
  pas_disponible: "pas-disponible",
  hors_champ: "hors-champ",
} as const;

/** Les e-mails d'une réponse, dans l'ordre d'envoi. Pur. */
export function construireEnvoisReponse(
  d: DonneesEnvoi,
  reponse: ReponsePresentation,
  o: OptionsReponse,
): EnvoiApporteur[] {
  const nomApporteur = `${d.apporteur.prenom} ${d.apporteur.nom}`.trim();
  const commun = {
    entityType: "PresentationEntreprise" as const,
    entityId: d.presentation.id,
  };
  const versApporteur = {
    destinataire: d.apporteur.email,
    ...commun,
  };
  const datePresentation = dateGabarit(d.presentation.recueAt);
  if (reponse === "bien_recu") {
    return [
      {
        gabarit: "entreprise-prise-de-contact-apporteur",
        destinataire: d.presentation.personneEmail,
        payload: avecTexteLibre(
          {
            ...(o.civilite && o.nomFamille.trim()
              ? { civilite: o.civilite, nomFamille: o.nomFamille.trim() }
              : {}),
            contactName: d.presentation.personneNom,
            nomApporteur,
            entreprise: d.presentation.denomination,
          },
          o.textes?.["entreprise-prise-de-contact-apporteur"],
        ),
        ...commun,
        jobId: `entreprise-contact-apporteur-${d.presentation.id}`,
      },
      {
        gabarit: "apporteur-presentation-recue",
        payload: avecTexteLibre(
          {
            contactName: nomApporteur,
            entreprise: d.presentation.denomination,
            datePresentation,
            personnePresentee: d.presentation.personneNom,
          },
          o.textes?.["apporteur-presentation-recue"],
        ),
        ...versApporteur,
        jobId: `apporteur-presentation-recue-${d.presentation.id}`,
      },
    ];
  }
  return [
    {
      gabarit: "apporteur-presentation-refusee",
      payload: avecTexteLibre(
        {
          contactName: nomApporteur,
          entreprise: d.presentation.denomination,
          datePresentation,
          motif: MOTIF_PAR_REPONSE[reponse],
        },
        o.textes?.["apporteur-presentation-refusee"],
      ),
      ...versApporteur,
      jobId: `apporteur-presentation-refusee-${d.presentation.id}`,
    },
  ];
}

async function chargerDonneesEnvoi(
  id: string,
): Promise<(DonneesEnvoi & { statut: StatutPresentation; contactEnvoyeAt: Date | null }) | null> {
  const p = await prisma.presentationEntreprise.findUnique({
    where: { id },
    include: { apporteur: { select: { id: true, prenom: true, nom: true, email: true } } },
  });
  if (!p) return null;
  return {
    statut: p.statut,
    contactEnvoyeAt: p.contactEnvoyeAt,
    presentation: {
      id: p.id,
      denomination: p.denomination,
      recueAt: p.recueAt,
      personneNom: decryptPii(p.personneNom) ?? "",
      personneEmail: decryptPii(p.personneEmail) ?? "",
    },
    apporteur: {
      id: p.apporteur.id,
      prenom: decryptPii(p.apporteur.prenom) ?? "",
      nom: decryptPii(p.apporteur.nom) ?? "",
      email: decryptPii(p.apporteur.email) ?? "",
    },
  };
}

export async function apercuReponse(
  id: string,
  reponse: ReponsePresentation,
  o: OptionsReponse,
): Promise<{ ok: true; emails: ApercuRendu[] } | { ok: false; message: string }> {
  const d = await chargerDonneesEnvoi(id);
  if (!d) return { ok: false, message: "Présentation introuvable." };
  if (!estATraiter(d)) return { ok: false, message: "Cette présentation a déjà reçu une réponse." };
  if (reponse === "bien_recu") {
    const refus = await refusBienRecu(prisma, id, new Date());
    if (refus) return { ok: false, message: refus };
  }
  const emails = await Promise.all(construireEnvoisReponse(d, reponse, o).map((e) => apercu(e)));
  return { ok: true, emails };
}

const PARTI: ReadonlySet<ResultatEnvoi> = new Set(["envoye", "en-validation"]);

export async function appliquerReponse(
  id: string,
  reponse: ReponsePresentation,
  o: OptionsReponse,
  maintenant: Date = new Date(),
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const d = await chargerDonneesEnvoi(id);
  if (!d) return { ok: false, message: "Présentation introuvable." };
  if (!d.presentation.personneEmail && reponse === "bien_recu") {
    return { ok: false, message: "La personne présentée n'a pas d'adresse e-mail lisible." };
  }
  const envois = construireEnvoisReponse(d, reponse, o);
  // 🔑 La ligne est « prise » AVANT tout envoi, par une écriture conditionnelle :
  // deux clics (ou deux onglets) ne répondent jamais deux fois.
  const prendre = (db: Pick<typeof prisma, "presentationEntreprise">) =>
    db.presentationEntreprise.updateMany({
      where: { id, statut: "reservee", contactEnvoyeAt: null },
      data:
        reponse === "bien_recu"
          ? { contactEnvoyeAt: maintenant }
          : {
              // « Pas disponible » : la présentation est refusée (déjà attribuée ou connue).
              statut: reponse === "hors_champ" ? "hors_champ" : "deja_connue",
            },
    });
  let prise: { count: number };
  if (reponse === "bien_recu") {
    // Vérification (déjà attribuée / déclaration plus ancienne) ET prise de la ligne dans une
    // même transaction sérialisable : deux « Bien reçu » simultanés sur un même SIREN ne passent
    // pas tous les deux (l'un échoue et rend la main).
    try {
      const r = await prisma.$transaction(
        async (tx) => {
          const refus = await refusBienRecu(tx, id, maintenant);
          if (refus) return { refus } as const;
          return { prise: await prendre(tx) } as const;
        },
        { isolationLevel: "Serializable", timeout: 15_000 },
      );
      if ("refus" in r) return { ok: false, message: r.refus };
      prise = r.prise;
    } catch (err) {
      if ((err as { code?: unknown } | null)?.code === "P2034")
        return {
          ok: false,
          message: "Une autre réponse est en cours sur ce SIREN : réessayez dans un instant.",
        };
      throw err;
    }
  } else {
    prise = await prendre(prisma);
  }
  if (prise.count !== 1)
    return { ok: false, message: "Cette présentation a déjà reçu une réponse." };

  if (reponse === "bien_recu") {
    const [versEntreprise, versApporteur] = envois as [EnvoiApporteur, EnvoiApporteur];
    const r1 = await envoyer(versEntreprise);
    if (!PARTI.has(r1)) {
      // Sans prise de contact, le délai de 30 jours ne court pas : on rend la main.
      await prisma.presentationEntreprise.update({
        where: { id },
        data: { contactEnvoyeAt: null },
      });
      return {
        ok: false,
        message: `Le message à l'entreprise n'est pas parti (${r1}). Réessayez plus tard.`,
      };
    }
    const r2 = await envoyer(versApporteur);
    return {
      ok: true,
      message: PARTI.has(r2)
        ? "Entreprise contactée, apporteur prévenu."
        : `Entreprise contactée, mais l'accusé à l'apporteur n'est pas parti (${r2}).`,
    };
  }
  const r = await envoyer(envois[0]!);
  return {
    ok: true,
    message: PARTI.has(r)
      ? "Réponse envoyée à l'apporteur."
      : `Statut enregistré, mais l'e-mail n'est pas parti (${r}).`,
  };
}

// ── Actions manuelles ────────────────────────────────────────────────────

/** « L'entreprise a répondu » : confirmée à la date saisie ; protection de 6 mois depuis la DÉCLARATION (2.2). */
export async function confirmerPresentation(
  id: string,
  confirmeeAt: Date,
  maintenant: Date = new Date(),
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (
    Number.isNaN(confirmeeAt.getTime()) ||
    confirmeeAt.getTime() > maintenant.getTime() + 60_000
  ) {
    return { ok: false, message: "Date de réponse invalide." };
  }
  const p = await prisma.presentationEntreprise.findUnique({
    where: { id },
    select: { recueAt: true },
  });
  if (!p) return { ok: false, message: "Présentation introuvable." };
  if (confirmeeAt.getTime() < p.recueAt.getTime() - 86_400_000) {
    return { ok: false, message: "La réponse ne peut pas précéder la présentation." };
  }
  // Une réponse saisie au jour de la présentation (midi) ne la précède jamais.
  if (confirmeeAt.getTime() < p.recueAt.getTime()) confirmeeAt = p.recueAt;
  const r = await prisma.presentationEntreprise.updateMany({
    where: { id, statut: "reservee" },
    data: {
      statut: "confirmee",
      confirmeeAt,
      confirmationTacite: false,
      // Contrat 2.2 (art. 3.4) : six mois depuis la déclaration, pas depuis la confirmation.
      protegeeJusquAt: finDeProtection(p.recueAt),
    },
  });
  if (r.count !== 1)
    return { ok: false, message: "Seule une présentation en attente peut être confirmée." };
  // Art. 3.2 : l'attribution devient définitive « dès que la Société la confirme par écrit à
  // l'Apporteur » — cet e-mail EST cette confirmation écrite (relecture de a1, 08/10). Un échec
  // d'envoi ne défait pas la confirmation : il est signalé.
  await annoncerAttribution(id, "confirmee");
  return { ok: true };
}

/** « L'entreprise dit ne pas connaître l'apporteur » (art. 3.7). */
export async function dementirPresentation(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const r = await prisma.presentationEntreprise.updateMany({
    where: { id, statut: { in: ["reservee", "confirmee"] } },
    data: { statut: "dementie" },
  });
  return r.count === 1
    ? { ok: true }
    : { ok: false, message: "Cette présentation n'est plus en cours." };
}

export async function noterPresentation(id: string, note: string): Promise<void> {
  await prisma.presentationEntreprise.update({
    where: { id },
    data: { note: note.trim().slice(0, 4000) || null },
  });
}
