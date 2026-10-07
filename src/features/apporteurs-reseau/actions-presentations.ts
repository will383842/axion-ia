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

import { lireEntrepriseParSiren } from "./annuaire";
import { constaterManquement } from "./manquement";
import type { ApercuRendu, GabaritApporteur } from "./envois";
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
import { sirenValide } from "./regles";

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
  const siren = brut.replace(/\s+/g, "");
  if (!sirenValide(siren))
    return { etat: "erreur", message: "Numéro SIREN invalide (9 chiffres)." };
  const [registre, signalements] = await Promise.all([
    lireEntrepriseParSiren(siren),
    lireSignalements(siren, new Date()),
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
  const recueAt = fromParisLocalInput(texte(fd, "recueAt"));
  if (!recueAt)
    return { etat: "erreur", message: "Indiquez la date et l'heure de réception de l'e-mail." };
  try {
    const r = await creerPresentation({
      apporteurId,
      siren: texte(fd, "siren"),
      denomination: texte(fd, "denomination"),
      personneNom: texte(fd, "personneNom"),
      personneFonction: texte(fd, "personneFonction") || null,
      personneEmail: texte(fd, "personneEmail"),
      personneTelephone: texte(fd, "personneTelephone") || null,
      besoin: texte(fd, "besoin") || null,
      dateEchange: texte(fd, "dateEchange") || null,
      recueAt,
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
