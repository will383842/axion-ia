// Réseau d'apporteurs (démarrage manuel) — actions de la console sur les ENTREPRISES PRÉSENTÉES.
//
// 🔑 RIEN NE PART SUR UN SEUL CLIC. Une réponse qui envoie un e-mail exige `confirmer`,
// que seul le bouton « Envoyer » de l'aperçu pose ; le serveur le revérifie.
//
// Garde : session + rôle, comme l'issue de l'échange apporteur
// (`features/admin-rendezvous/issue-apporteur-actions.ts`, `peutVoirLesAppels`).

"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { fromParisLocalInput } from "@/lib/calendar-grid";
import { validerTexteLibre } from "@/lib/email/templates/texte-libre-reseau";
import { peutVoirLesAppels } from "@/features/admin-calendly/acces";
import { peutEngager } from "@/server/auth/habilitations";

import { prisma } from "@/lib/prisma";

import { lireEtablissementParSiret } from "./annuaire";
import { siretValide } from "./etablissement-presentation";
import { constaterManquement } from "./manquement";
import type { ApercuRendu } from "./apercu-envoi";
import type { GabaritApporteur } from "./envois";
import {
  apercuReponse,
  appliquerReponse,
  confirmerPresentation,
  creerPresentation,
  dementirPresentation,
  libelleSignalement,
  lireSignalements,
  noterPresentation,
  REPONSES,
  type Civilite,
  type ReponsePresentation,
} from "./presentations";
import {
  ecarterProposition,
  MESSAGE_INTERRUPTEUR_ETEINT,
  validerParRendezVous,
  type SourceValidation,
} from "./validation-rendez-vous";
import { validationParRendezVousActive } from "./interrupteur-rendez-vous";

export type EtatAction =
  { etat: "initial" } | { etat: "ok"; message: string } | { etat: "erreur"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sessionEcriture(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return "Session expirée : reconnectez-vous.";
  const role = (session.user as { role?: string }).role;
  if (!peutVoirLesAppels(role)) return "Votre rôle ne permet pas de gérer les apporteurs.";
  return null;
}

function texte(fd: FormData, cle: string): string {
  const v = fd.get(cle);
  return typeof v === "string" ? v.trim() : "";
}

function rafraichir(): void {
  revalidatePath(adminPath("fr", "apporteurs/entreprises"));
}

// ── Vérifier un SIREN avant d'enregistrer ────────────────────────────────

export type VerificationSiren =
  | { etat: "erreur"; message: string }
  | { etat: "ok"; denomination: string | null; active: boolean | null; signalements: string[] };

export async function verifierSirenAction(brut: string): Promise<VerificationSiren> {
  const refus = await sessionEcriture();
  if (refus) return { etat: "erreur", message: refus };
  // Contrat 2.6 : le SIRET de l'établissement visité (le SIREN en est déduit).
  const siret = brut.replace(/\s+/g, "");
  if (!siretValide(siret))
    return { etat: "erreur", message: "Numéro SIRET invalide (14 chiffres)." };
  const siren = siret.slice(0, 9);
  const [registre, signalements] = await Promise.all([
    lireEtablissementParSiret(siret),
    lireSignalements(siren, new Date(), undefined, { siret, entreprise: false, exclus: [] }),
  ]);
  return {
    etat: "ok",
    denomination: registre.ok ? registre.entreprise.denomination : null,
    active: registre.ok ? registre.entreprise.active : null,
    signalements: signalements.map(libelleSignalement),
  };
}

// ── Nouvelle entreprise présentée ────────────────────────────────────────

export async function creerPresentationAction(
  _prev: EtatAction,
  fd: FormData,
): Promise<EtatAction> {
  const refus = await sessionEcriture();
  if (refus) return { etat: "erreur", message: refus };
  const apporteurId = texte(fd, "apporteurId");
  if (!UUID.test(apporteurId)) return { etat: "erreur", message: "Choisissez l'apporteur." };
  try {
    const r = await creerPresentation({
      apporteurId,
      siret: texte(fd, "siret"),
      denomination: texte(fd, "denomination"),
      personneNom: texte(fd, "personneNom"),
      personneFonction: texte(fd, "personneFonction") || null,
      personneEmail: texte(fd, "personneEmail"),
      personneTelephone: texte(fd, "personneTelephone") || null,
      besoin: texte(fd, "besoin") || null,
      dateEchange: texte(fd, "dateEchange") || null,
      // Pas de date de réception : la déclaration est horodatée par le serveur (art. 3.4).
    });
    if (!r.ok) return { etat: "erreur", message: r.message };
    rafraichir();
    return { etat: "ok", message: "Enregistrée : elle est dans « À traiter »." };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-presentation-creer" } });
    return { etat: "erreur", message: "Enregistrement impossible. Réessayez." };
  }
}

// ── Les trois réponses (aperçu, puis envoi) ──────────────────────────────

export interface SaisieReponse {
  id: string;
  reponse: string;
  civilite?: string;
  nomFamille?: string;
  /** Textes principaux réécrits, par gabarit (facultatif). Jamais journalisés. */
  textes?: Record<string, string>;
}

/** Les seuls gabarits dont la réponse à une présentation laisse réécrire le texte. */
const GABARITS_REPONSE: readonly GabaritApporteur[] = [
  "entreprise-prise-de-contact-apporteur",
  "apporteur-presentation-recue",
  "apporteur-presentation-refusee",
];

function lireSaisie(s: SaisieReponse):
  | {
      id: string;
      reponse: ReponsePresentation;
      civilite: Civilite;
      nomFamille: string;
      textes: Partial<Record<GabaritApporteur, string>>;
    }
  | string {
  if (!UUID.test(s.id)) return "Présentation inconnue.";
  if (!REPONSES.includes(s.reponse as ReponsePresentation)) return "Réponse inconnue.";
  const civilite: Civilite = s.civilite === "Monsieur" || s.civilite === "Madame" ? s.civilite : "";
  const textes: Partial<Record<GabaritApporteur, string>> = {};
  for (const [gabarit, brut] of Object.entries(s.textes ?? {})) {
    if (!GABARITS_REPONSE.includes(gabarit as GabaritApporteur)) continue;
    const v = validerTexteLibre(brut);
    if (!v.ok) return v.message;
    if (v.texte) textes[gabarit as GabaritApporteur] = v.texte;
  }
  return {
    id: s.id,
    reponse: s.reponse as ReponsePresentation,
    civilite,
    nomFamille: (s.nomFamille ?? "").trim().slice(0, 120),
    textes,
  };
}

export type ApercuReponse =
  { etat: "erreur"; message: string } | { etat: "apercu"; emails: ApercuRendu[] };

export async function apercuReponseAction(s: SaisieReponse): Promise<ApercuReponse> {
  const refus = await sessionEcriture();
  if (refus) return { etat: "erreur", message: refus };
  const l = lireSaisie(s);
  if (typeof l === "string") return { etat: "erreur", message: l };
  try {
    const r = await apercuReponse(l.id, l.reponse, l);
    return r.ok ? { etat: "apercu", emails: r.emails } : { etat: "erreur", message: r.message };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-presentation-apercu" } });
    return { etat: "erreur", message: "Aperçu impossible. Réessayez." };
  }
}

export async function repondreAction(
  s: SaisieReponse & { confirmer: boolean },
): Promise<EtatAction> {
  const refus = await sessionEcriture();
  if (refus) return { etat: "erreur", message: refus };
  if (s.confirmer !== true)
    return { etat: "erreur", message: "Regarde l'aperçu, puis confirme l'envoi." };
  const l = lireSaisie(s);
  if (typeof l === "string") return { etat: "erreur", message: l };
  try {
    const r = await appliquerReponse(l.id, l.reponse, l);
    rafraichir();
    return r.ok ? { etat: "ok", message: r.message } : { etat: "erreur", message: r.message };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-presentation-repondre" } });
    return { etat: "erreur", message: "Réponse impossible. Réessayez." };
  }
}

// ── Actions manuelles ────────────────────────────────────────────────────

export async function confirmerPresentationAction(
  _prev: EtatAction,
  fd: FormData,
): Promise<EtatAction> {
  const refus = await sessionEcriture();
  if (refus) return { etat: "erreur", message: refus };
  const id = texte(fd, "id");
  const jour = texte(fd, "confirmeeLe");
  if (!UUID.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(jour))
    return { etat: "erreur", message: "Indiquez la date de la réponse." };
  // Midi, heure de Paris : la date saisie est un jour, pas un instant.
  const date = fromParisLocalInput(`${jour}T12:00`);
  if (!date) return { etat: "erreur", message: "Date invalide." };
  const r = await confirmerPresentation(id, date);
  if (!r.ok) return { etat: "erreur", message: r.message };
  rafraichir();
  return { etat: "ok", message: "Confirmée : protection de 6 mois." };
}

export async function dementirPresentationAction(
  _prev: EtatAction,
  fd: FormData,
): Promise<EtatAction> {
  const refus = await sessionEcriture();
  if (refus) return { etat: "erreur", message: refus };
  const id = texte(fd, "id");
  if (!UUID.test(id)) return { etat: "erreur", message: "Présentation inconnue." };
  if (texte(fd, "confirmer") !== "oui") return { etat: "erreur", message: "Confirme d'abord." };
  const r = await dementirPresentation(id);
  if (!r.ok) return { etat: "erreur", message: r.message };
  rafraichir();
  return { etat: "ok", message: "Notée comme démentie." };
}

/** « Manquement ou fraude » (art. 4.5 bis) : touche à l'argent, donc réservé à un administrateur. */
export async function constaterManquementAction(
  _prev: EtatAction,
  fd: FormData,
): Promise<EtatAction> {
  const session = await auth();
  if (!session?.user?.id) return { etat: "erreur", message: "Session expirée : reconnectez-vous." };
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, "facturer"))
    return { etat: "erreur", message: "Seul un administrateur peut constater un manquement." };
  const id = texte(fd, "id");
  if (!UUID.test(id)) return { etat: "erreur", message: "Présentation inconnue." };
  if (texte(fd, "confirmer") !== "oui")
    return { etat: "erreur", message: "Cochez la confirmation avant d'enregistrer." };
  try {
    const r = await constaterManquement({
      presentationId: id,
      faits: texte(fd, "faits"),
      acteurId: session.user.id,
    });
    if (!r.ok) return { etat: "erreur", message: r.message };
    rafraichir();
    revalidatePath(adminPath("fr", "apporteurs/commissions"));
    return { etat: "ok", message: r.message };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-manquement" } });
    return { etat: "erreur", message: "Le manquement n'a pas pu être enregistré. Réessayez." };
  }
}

export async function noterPresentationAction(
  _prev: EtatAction,
  fd: FormData,
): Promise<EtatAction> {
  const refus = await sessionEcriture();
  if (refus) return { etat: "erreur", message: refus };
  const id = texte(fd, "id");
  if (!UUID.test(id)) return { etat: "erreur", message: "Présentation inconnue." };
  await noterPresentation(id, texte(fd, "note"));
  rafraichir();
  return { etat: "ok", message: "Note enregistrée." };
}

// ── Validation par rendez-vous (lot 6) : « il a eu lieu » ────────────────
//
// Réservé aux ADMINISTRATEURS, comme `confirmerAttributionMaintenantAction` et les actions de
// retrait. L'outil propose, le dirigeant valide : aucune de ces actions ne tourne seule, et
// aucune n'écrit à l'extérieur en dehors de l'annonce d'attribution existante.

const ROLES_ADMIN = new Set(["super_admin", "admin"]);

async function sessionAdministrateur(): Promise<{ id: string } | string> {
  const session = await auth();
  if (!session?.user?.id) return "Session expirée : reconnectez-vous.";
  const role = (session.user as { role?: string }).role ?? "";
  if (!ROLES_ADMIN.has(role)) return "Réservé aux administrateurs.";
  return { id: session.user.id };
}

function sourceDeLaCle(cle: string): SourceValidation {
  return cle.startsWith("calendly:") ? "calendly" : "rencontre";
}

const MESSAGE_CONFIRMER = "Confirmez d'abord.";

/** « 2026-11-24T14:30 » (heure de Paris) → instant ; `null` si illisible. Le futur est refusé plus loin, par la règle. */
function instantSaisi(brut: string): Date | null {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(brut) ? fromParisLocalInput(brut) : null;
}

function messageValidation(r: Awaited<ReturnType<typeof validerParRendezVous>>): EtatAction {
  if (!r.ok) return { etat: "erreur", message: r.message };
  const suite = r.avertissements.length ? ` ⚠️ ${r.avertissements.join(" ")}` : "";
  return { etat: "ok", message: `${r.message}${suite}` };
}

/** « Il a eu lieu » sur une proposition de l'outil. Les dates viennent de la base, jamais du client. */
export async function validerPropositionAction(
  _prev: EtatAction,
  fd: FormData,
): Promise<EtatAction> {
  const acteur = await sessionAdministrateur();
  if (typeof acteur === "string") return { etat: "erreur", message: acteur };
  if (!validationParRendezVousActive())
    return { etat: "erreur", message: MESSAGE_INTERRUPTEUR_ETEINT };
  const id = texte(fd, "id").toLowerCase();
  if (!UUID.test(id)) return { etat: "erreur", message: "Proposition inconnue." };
  // Confirmation en deux temps, vérifiée par le serveur : l'écran ne suffit pas.
  if (texte(fd, "confirmer") !== "oui") return { etat: "erreur", message: MESSAGE_CONFIRMER };
  try {
    const pr = await prisma.propositionRendezVousPresentation.findUnique({ where: { id } });
    if (!pr) return { etat: "erreur", message: "Proposition inconnue." };
    if (pr.ecarteeAt || pr.retenueAt)
      return { etat: "erreur", message: "Cette proposition a déjà été traitée." };
    // Date de tenue inconnue de l'outil (rendez-vous sans heure) : le dirigeant la renseigne.
    const tenuAt = pr.rendezVousAt ?? instantSaisi(texte(fd, "tenuLe"));
    if (!tenuAt)
      return {
        etat: "erreur",
        message: "Indiquez la date et l'heure où le rendez-vous a eu lieu.",
      };
    const r = await validerParRendezVous({
      presentationId: pr.presentationId,
      rendezVousCle: pr.rendezVousCle,
      tenuAt,
      source: sourceDeLaCle(pr.rendezVousCle),
      propositionId: pr.id,
      acteurId: acteur.id,
    });
    if (r.ok) rafraichir();
    return messageValidation(r);
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-validation-rdv" } });
    return { etat: "erreur", message: "La validation a échoué. Réessayez dans un instant." };
  }
}

/** « Ce n'est pas lui » : écarte la proposition (elle n'est jamais supprimée). */
export async function ecarterPropositionAction(
  _prev: EtatAction,
  fd: FormData,
): Promise<EtatAction> {
  const acteur = await sessionAdministrateur();
  if (typeof acteur === "string") return { etat: "erreur", message: acteur };
  if (!validationParRendezVousActive())
    return { etat: "erreur", message: MESSAGE_INTERRUPTEUR_ETEINT };
  const id = texte(fd, "id").toLowerCase();
  if (!UUID.test(id)) return { etat: "erreur", message: "Proposition inconnue." };
  // Écarter peut libérer l'entreprise pour un autre apporteur : confirmation vérifiée ici.
  if (texte(fd, "confirmer") !== "oui") return { etat: "erreur", message: MESSAGE_CONFIRMER };
  try {
    const r = await ecarterProposition(id, acteur.id);
    if (!r.ok) return { etat: "erreur", message: r.message };
    rafraichir();
    return { etat: "ok", message: "Proposition écartée (elle reste conservée)." };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-ecarter-proposition" } });
    return { etat: "erreur", message: "Impossible d'écarter. Réessayez." };
  }
}

/**
 * Saisie MANUELLE par le dirigeant d'un rendez-vous téléphonique, sur place, ou « Annulé par
 * Axion IA » (réputé tenu, au jour de l'annulation). Aucune réservation Calendly ne le porte.
 * La date de PRISE (« pris le ») est OBLIGATOIRE : jamais réputée prise le jour où il a eu lieu.
 * Un rendez-vous dans le futur est refusé par la règle. Confirmation en deux temps, vérifiée ici.
 */
export async function saisirRendezVousAction(_prev: EtatAction, fd: FormData): Promise<EtatAction> {
  const acteur = await sessionAdministrateur();
  if (typeof acteur === "string") return { etat: "erreur", message: acteur };
  if (!validationParRendezVousActive())
    return { etat: "erreur", message: MESSAGE_INTERRUPTEUR_ETEINT };
  const presentationId = texte(fd, "presentationId").toLowerCase();
  if (!UUID.test(presentationId)) return { etat: "erreur", message: "Choisissez l'entreprise." };
  const canal = texte(fd, "canal");
  if (canal !== "telephone" && canal !== "sur_place" && canal !== "annule_par_axion")
    return {
      etat: "erreur",
      message: "Indiquez le type de rendez-vous : appel, sur place ou annulé par Axion IA.",
    };
  const tenuAt = instantSaisi(texte(fd, "tenuLe"));
  if (!tenuAt) return { etat: "erreur", message: "Indiquez la date et l'heure du rendez-vous." };
  const prisBrut = texte(fd, "prisLe");
  if (!prisBrut)
    return { etat: "erreur", message: "Indiquez le jour où ce rendez-vous a été convenu." };
  const prisAt = instantSaisi(prisBrut);
  if (!prisAt) return { etat: "erreur", message: "Date de prise du rendez-vous illisible." };
  if (texte(fd, "confirmer") !== "oui") return { etat: "erreur", message: MESSAGE_CONFIRMER };
  try {
    const r = await validerParRendezVous({
      presentationId,
      rendezVousCle: null,
      prisAt,
      tenuAt,
      source: "saisie",
      canal,
      acteurId: acteur.id,
    });
    if (r.ok) rafraichir();
    return messageValidation(r);
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-saisie-rdv" } });
    return { etat: "erreur", message: "L'enregistrement a échoué. Réessayez dans un instant." };
  }
}
