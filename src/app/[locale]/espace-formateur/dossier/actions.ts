/**
 * Espace formateur — « Mon dossier » : dépôt d'une pièce à renouveler (lot E, M13).
 *
 * 🔑 La fiche est celle de la SESSION de l'espace (`getFormateurSession`), jamais un
 * identifiant venu du navigateur. Le dépôt passe par `deposerPieceFormateur` (antivirus,
 * chiffrement au repos, pièce en attente de vérification). L'issue revient par un code
 * fermé dans l'adresse : aucun JavaScript client, aucun texte libre réaffiché.
 *
 * Journaux : le nom de l'erreur seul, jamais un nom de fichier ni un contenu.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import { redirect } from "next/navigation";

import { getFormateurSession } from "@/server/formateur/guard";
import { FORMATEUR_BASE_PATH, FORMATEUR_CONNEXION_PATH } from "@/server/formateur/routes";
import {
  demanderChangementAdresse,
  demanderChangementIban,
} from "@/server/qualiopi/formateurs-independants/changements-coordonnees";
import { deposerDepuisMonDossier } from "@/server/qualiopi/formateurs-independants/mon-dossier";
import { transmettreNumeroDeclaration } from "@/server/qualiopi/formateurs-independants/numero-declaration-espace";

import { codeDuMessage } from "./messages";

const CHEMIN = `${FORMATEUR_BASE_PATH}/dossier`;

/** « 2026-10-05 » → minuit UTC de ce jour, ou `null`. */
function dateDuJour(v: unknown): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : d;
}

export async function deposerMaPieceAction(fd: FormData): Promise<void> {
  const session = await getFormateurSession();
  if (!session) redirect(FORMATEUR_CONNEXION_PATH);

  const type = String(fd.get("type") ?? "").slice(0, 40);
  const fichier = fd.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    redirect(`${CHEMIN}?issue=fichier`);
  }

  let code: string;
  try {
    const r = await deposerDepuisMonDossier(session.trainerId, {
      type,
      nomFichier: fichier.name || "piece",
      octets: new Uint8Array(await fichier.arrayBuffer()),
      dateEmission: dateDuJour(fd.get("dateEmission")),
    });
    code = r.ok ? "recu" : codeDuMessage(r.message);
  } catch (e) {
    console.error("[espace-formateur] dépôt de pièce :", e instanceof Error ? e.name : "erreur");
    code = "erreur";
  }
  redirect(`${CHEMIN}?issue=${code}`);
}

/**
 * Lot E (M12) — demande de changement d'IBAN. L'IBAN saisi ne revient JAMAIS dans
 * l'adresse ni dans un journal ; la fiche n'est pas touchée avant la validation.
 */
export async function demanderChangementIbanAction(fd: FormData): Promise<void> {
  const session = await getFormateurSession();
  if (!session) redirect(FORMATEUR_CONNEXION_PATH);
  let code: string;
  try {
    const r = await demanderChangementIban(
      session.trainerId,
      String(fd.get("iban") ?? "").slice(0, 50),
      new Date(),
    );
    code = r.ok ? "demande" : codeDuMessage(r.message, "changement_erreur");
  } catch (e) {
    console.error("[espace-formateur] changement d'IBAN :", e instanceof Error ? e.name : "erreur");
    code = "changement_erreur";
  }
  redirect(`${CHEMIN}?issue=${code}`);
}

/** Lot E (M12) — demande de changement d'adresse professionnelle. */
export async function demanderChangementAdresseAction(fd: FormData): Promise<void> {
  const session = await getFormateurSession();
  if (!session) redirect(FORMATEUR_CONNEXION_PATH);
  let code: string;
  try {
    const r = await demanderChangementAdresse(
      session.trainerId,
      String(fd.get("adresse") ?? "").slice(0, 600),
    );
    code = r.ok ? "demande" : codeDuMessage(r.message, "changement_erreur");
  } catch (e) {
    console.error(
      "[espace-formateur] changement d'adresse :",
      e instanceof Error ? e.name : "erreur",
    );
    code = "changement_erreur";
  }
  redirect(`${CHEMIN}?issue=${code}`);
}

/**
 * V1-A-10 — le numéro de déclaration d'activité, transmis par la personne qui a signé
 * « en cours » (F21 l'y renvoie). Le numéro ne revient jamais dans l'adresse ni au journal.
 */
export async function transmettreMonNumeroAction(fd: FormData): Promise<void> {
  const session = await getFormateurSession();
  if (!session) redirect(FORMATEUR_CONNEXION_PATH);
  let code: string;
  try {
    code = await transmettreNumeroDeclaration(session.trainerId, String(fd.get("nda") ?? ""));
  } catch (e) {
    console.error(
      "[espace-formateur] numéro de déclaration :",
      e instanceof Error ? e.name : "erreur",
    );
    code = "nda_erreur";
  }
  redirect(`${CHEMIN}?issue=${code}`);
}
