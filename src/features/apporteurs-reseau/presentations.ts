/**
 * Réseau d'apporteurs (démarrage manuel) — les ENTREPRISES PRÉSENTÉES.
 *
 * Williams enregistre chaque présentation à la réception de l'e-mail de l'apporteur
 * (`recueAt` fait foi, contrat v2 art. 3.5), puis choisit une réponse :
 *   · « Bien reçu »   → `reservee`, accusé à l'apporteur ET prise de contact de l'entreprise ;
 *   · « Déjà connue » → `deja_connue`, refus motivé « deja-connue » ;
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

import { lireEntrepriseParSiren } from "./annuaire";
import { apercu, envoyer, type EnvoiApporteur, type ResultatEnvoi } from "./envois";
import { ajouterMois, finDeProtection, sirenValide } from "./regles";

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
): Promise<Signalement[]> {
  const out: Signalement[] = [];
  const [presentations, clients] = await Promise.all([
    prisma.presentationEntreprise.findMany({
      where: {
        siren,
        statut: { in: ["reservee", "confirmee"] },
        ...(saufId ? { id: { not: saufId } } : {}),
      },
      select: {
        statut: true,
        protegeeJusquAt: true,
        apporteur: { select: { prenom: true, nom: true } },
      },
    }),
    prisma.client.findMany({ where: { siren }, select: { id: true } }),
  ]);
  for (const p of presentations) {
    if (!presentationOccupe(p, maintenant)) continue;
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
  siren: string;
  denomination: string;
  personneNom: string;
  personneFonction: string | null;
  personneEmail: string;
  personneTelephone: string | null;
  besoin: string | null;
  /** « AAAA-MM-JJ », facultatif. */
  dateEchange: string | null;
  recueAt: Date;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function creerPresentation(
  s: SaisiePresentation,
  maintenant: Date = new Date(),
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const siren = s.siren.replace(/\s+/g, "");
  if (!sirenValide(siren)) return { ok: false, message: "Numéro SIREN invalide." };
  if (!s.personneNom.trim())
    return { ok: false, message: "Indique le nom de la personne présentée." };
  if (!EMAIL.test(s.personneEmail.trim()))
    return { ok: false, message: "Adresse e-mail de la personne invalide." };
  if (
    Number.isNaN(s.recueAt.getTime()) ||
    s.recueAt.getTime() > maintenant.getTime() + 5 * 60_000
  ) {
    return { ok: false, message: "Date de réception de l'e-mail invalide (dans le futur ?)." };
  }
  const apporteur = await prisma.apporteurReseau.findUnique({
    where: { id: s.apporteurId },
    select: { statut: true },
  });
  if (!apporteur || apporteur.statut !== "signe") {
    return { ok: false, message: "Choisis un apporteur dont le contrat est signé." };
  }
  let denomination = s.denomination.trim();
  if (!denomination) {
    const r = await lireEntrepriseParSiren(siren);
    denomination = r.ok ? (r.entreprise.denomination ?? "") : "";
  }
  if (!denomination)
    return { ok: false, message: "Indique le nom de l'entreprise (registre muet)." };
  const dateEchange =
    s.dateEchange && /^\d{4}-\d{2}-\d{2}$/.test(s.dateEchange)
      ? new Date(`${s.dateEchange}T00:00:00Z`)
      : null;
  const cree = await prisma.presentationEntreprise.create({
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
      recueAt: s.recueAt,
    },
    select: { id: true },
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

export type ReponsePresentation = "bien_recu" | "deja_connue" | "hors_champ";
export const REPONSES: readonly ReponsePresentation[] = ["bien_recu", "deja_connue", "hors_champ"];

export type Civilite = "" | "Monsieur" | "Madame";

export interface OptionsReponse {
  /** Prise de contact de l'entreprise : « Bonjour Madame Durand » (vide → prénom). */
  civilite: Civilite;
  nomFamille: string;
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
        payload: {
          ...(o.civilite && o.nomFamille.trim()
            ? { civilite: o.civilite, nomFamille: o.nomFamille.trim() }
            : {}),
          contactName: d.presentation.personneNom,
          nomApporteur,
          entreprise: d.presentation.denomination,
        },
        ...commun,
        jobId: `entreprise-contact-apporteur-${d.presentation.id}`,
      },
      {
        gabarit: "apporteur-presentation-recue",
        payload: {
          contactName: nomApporteur,
          entreprise: d.presentation.denomination,
          datePresentation,
          personnePresentee: d.presentation.personneNom,
        },
        ...versApporteur,
        jobId: `apporteur-presentation-recue-${d.presentation.id}`,
      },
    ];
  }
  return [
    {
      gabarit: "apporteur-presentation-refusee",
      payload: {
        contactName: nomApporteur,
        entreprise: d.presentation.denomination,
        datePresentation,
        motif: reponse === "deja_connue" ? "deja-connue" : "hors-champ",
      },
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
): Promise<
  | { ok: true; emails: Array<{ sujet: string; html: string; destinataire: string }> }
  | { ok: false; message: string }
> {
  const d = await chargerDonneesEnvoi(id);
  if (!d) return { ok: false, message: "Présentation introuvable." };
  if (!estATraiter(d)) return { ok: false, message: "Cette présentation a déjà reçu une réponse." };
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
  const prise = await prisma.presentationEntreprise.updateMany({
    where: { id, statut: "reservee", contactEnvoyeAt: null },
    data:
      reponse === "bien_recu"
        ? { contactEnvoyeAt: maintenant }
        : { statut: reponse === "deja_connue" ? "deja_connue" : "hors_champ" },
  });
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
        message: `Le message à l'entreprise n'est pas parti (${r1}). Réessaie plus tard.`,
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

/** « L'entreprise a répondu » : protection de 6 mois à compter de la date saisie. */
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
      protegeeJusquAt: finDeProtection(confirmeeAt),
    },
  });
  return r.count === 1
    ? { ok: true }
    : { ok: false, message: "Seule une présentation en attente peut être confirmée." };
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
