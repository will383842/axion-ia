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
import { jourParis } from "./autofacture-donnees";
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
import { MESSAGES_ERREUR, type CodeErreur } from "./challenge-messages";
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

type Session = { ok: true; adminId: string } | { ok: false; code: CodeErreur; message: string };

async function sessionArgent(): Promise<Session> {
  if (!challengesConsoleActifs())
    return { ok: false, code: "eteint", message: MESSAGES_ERREUR.eteint };
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "session", message: MESSAGES_ERREUR.session };
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, "facturer"))
    return { ok: false, code: "role", message: MESSAGES_ERREUR.role };
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
  redirect(`${liste()}/${cible}?retour=brouillon`);
}

/** Publication : trois cases obligatoires, vérifiées ICI (jamais seulement par le navigateur). */
export async function publierChallengeAction(fd: FormData): Promise<void> {
  const id = texte(fd, "id");
  const retourne = (code: CodeErreur): never =>
    redirect(`${liste()}/${UUID.test(id) ? id : ""}?erreur=${code}`);
  const s = await sessionArgent();
  if (!s.ok) return retourne(s.code);
  if (!UUID.test(id)) return redirect(`${liste()}?erreur=inconnu`);
  if (!["case1", "case2", "case3"].every((k) => texte(fd, k) === "oui")) return retourne("cases");
  // Le `redirect` lève une exception : il reste HORS du `try`, sinon le `catch` l'avalerait.
  let code: CodeErreur | null = null;
  try {
    const r = await publierChallenge(id, s.adminId, texte(fd, "version"), {
      aujourdhui: jourParis(new Date()),
      confirmeDejaCommence: texte(fd, "case4") === "oui",
    });
    if (r.ok) await tracer("challenge_apporteur.publie", id, s.adminId, {});
    else code = r.code;
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-challenge-publier" } });
    code = "publication";
  }
  if (code) return retourne(code);
  revalidatePath(liste());
  redirect(`${liste()}/${id}?retour=publie`);
}

export async function archiverChallengeAction(fd: FormData): Promise<void> {
  const id = texte(fd, "id");
  const vers = (cle: "erreur" | "retour", code: string, avecId = false): never =>
    redirect(`${liste()}${avecId ? `/${id}` : ""}?${cle}=${code}`);
  const s = await sessionArgent();
  if (!s.ok) return vers("erreur", s.code);
  if (!UUID.test(id) || texte(fd, "confirmer") !== "oui")
    return vers("erreur", "confirmer_archivage");
  let code: CodeErreur | null = null;
  try {
    const r = await archiverChallenge(id);
    if (r.ok) await tracer("challenge_apporteur.archive", id, s.adminId, {});
    else code = r.code;
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteurs-challenge-archiver" } });
    code = "archivage";
  }
  if (code) return vers("erreur", code, true);
  revalidatePath(liste());
  return vers("retour", "archive");
}
