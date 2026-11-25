// Challenges d'apporteurs (invitation libre) — actions de la console.
//
// Écrire un challenge engage de l'argent (une prime) : même garde que la facturation
// (`peutEngager(role, "facturer")`, super-admin et admin). Écran éteint (interrupteur) = refus.
// Chaque geste est tracé au journal d'audit (qui, quand, quoi), sans jamais bloquer le geste.
// Aucun e-mail, aucun message à un apporteur ne part d'ici.

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { peutEngager } from "@/server/auth/habilitations";

import {
  archiverChallenge,
  creerBrouillon,
  modifierBrouillon,
  publierChallenge,
} from "./challenge-donnees";
import { validerSaisie } from "./challenge-regles";
import { challengesConsoleActifs } from "./interrupteur-challenges-console";

export type EtatFormulaireChallenge =
  { etat: "initial" } | { etat: "erreur"; message: string; valeurs: Record<string, string> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHAMPS_CHALLENGE = [
  "titre",
  "debutLe",
  "finLe",
  "paiementJusquAu",
  "produit",
  "critere",
  "seuil",
  "primeHt",
  "reglement",
] as const;

type Session = { ok: true; adminId: string } | { ok: false; message: string };

async function sessionArgent(): Promise<Session> {
  if (!challengesConsoleActifs()) return { ok: false, message: "Les challenges sont éteints." };
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Session expirée : reconnectez-vous." };
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, "facturer"))
    return { ok: false, message: "Seul un administrateur peut gérer les challenges." };
  return { ok: true, adminId: session.user.id };
}

function texte(fd: FormData, cle: string): string {
  const v = fd.get(cle);
  return typeof v === "string" ? v : "";
}

function valeursDe(fd: FormData): Record<string, string> {
  return Object.fromEntries(CHAMPS_CHALLENGE.map((k) => [k, texte(fd, k)]));
}

async function tracer(
  action: string,
  id: string,
  adminId: string,
  changes: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: adminId,
        action,
        targetType: "challenge_apporteur",
        targetId: id,
        changes: changes as object,
      },
    });
  } catch {
    // La trace ne doit jamais faire échouer le geste.
  }
}

const liste = () => adminPath("fr", "apporteurs/challenges");

/** Création (sans `id`) ou modification d'un brouillon (avec `id`). Rien n'est publié ici. */
export async function enregistrerBrouillonAction(
  _prev: EtatFormulaireChallenge,
  fd: FormData,
): Promise<EtatFormulaireChallenge> {
  const valeurs = valeursDe(fd);
  const s = await sessionArgent();
  if (!s.ok) return { etat: "erreur", message: s.message, valeurs };
  const id = texte(fd, "id");
  if (id && !UUID.test(id)) return { etat: "erreur", message: "Challenge inconnu.", valeurs };
  const saisie = validerSaisie(valeurs);
  if (!saisie.ok) return { etat: "erreur", message: saisie.erreurs.join(" "), valeurs };
  let cible: string;
  try {
    if (id) {
      const r = await modifierBrouillon(id, saisie.valeur);
      if (!r.ok) return { etat: "erreur", message: r.message, valeurs };
      cible = id;
      await tracer("challenge_apporteur.modifie", id, s.adminId, { titre: saisie.valeur.titre });
    } else {
      cible = await creerBrouillon(saisie.valeur, s.adminId);
      await tracer("challenge_apporteur.cree", cible, s.adminId, { titre: saisie.valeur.titre });
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-challenge-enregistrer" } });
    return { etat: "erreur", message: "Enregistrement impossible. Réessayez.", valeurs };
  }
  revalidatePath(liste());
  redirect(
    `${liste()}/${cible}?retour=${encodeURIComponent("Brouillon enregistré. Rien n'est visible des apporteurs.")}`,
  );
}

/** Publication : trois cases obligatoires, vérifiées ICI (jamais seulement par le navigateur). */
export async function publierChallengeAction(fd: FormData): Promise<void> {
  const id = texte(fd, "id");
  const retourne = (m: string): never =>
    redirect(`${liste()}/${UUID.test(id) ? id : ""}?erreur=${encodeURIComponent(m)}`);
  const s = await sessionArgent();
  if (!s.ok) return retourne(s.message);
  if (!UUID.test(id))
    return redirect(`${liste()}?erreur=${encodeURIComponent("Challenge inconnu.")}`);
  if (!["case1", "case2", "case3"].every((k) => texte(fd, k) === "oui"))
    return retourne("Cochez les trois cases pour publier.");
  try {
    const r = await publierChallenge(id, s.adminId);
    if (!r.ok) return retourne(r.message);
    await tracer("challenge_apporteur.publie", id, s.adminId, {});
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-challenge-publier" } });
    return retourne("Publication impossible. Réessayez.");
  }
  revalidatePath(liste());
  redirect(
    `${liste()}/${id}?retour=${encodeURIComponent("Challenge publié. Son règlement ne peut plus être modifié.")}`,
  );
}

export async function archiverChallengeAction(fd: FormData): Promise<void> {
  const id = texte(fd, "id");
  const s = await sessionArgent();
  if (!s.ok) return redirect(`${liste()}?erreur=${encodeURIComponent(s.message)}`);
  if (!UUID.test(id) || texte(fd, "confirmer") !== "oui")
    return redirect(`${liste()}?erreur=${encodeURIComponent("Confirmez d'abord l'archivage.")}`);
  try {
    const r = await archiverChallenge(id);
    if (!r.ok) return redirect(`${liste()}/${id}?erreur=${encodeURIComponent(r.message)}`);
    await tracer("challenge_apporteur.archive", id, s.adminId, {});
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-challenge-archiver" } });
    return redirect(
      `${liste()}/${id}?erreur=${encodeURIComponent("Archivage impossible. Réessayez.")}`,
    );
  }
  revalidatePath(liste());
  redirect(`${liste()}?retour=${encodeURIComponent("Challenge archivé.")}`);
}
