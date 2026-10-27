// Tour France IA : les boutons de la page « Demandes » de la console (PR-2a).
//
// Server Actions simples, appelées par un `<form action>` de la page (aucun composant client).
// Garde : une session de console ET un rôle admis sur les appels réservés (`peutVoirLesAppels`,
// la liste unique de `admin-calendly/acces.ts`) — ces pages montrent des coordonnées de prospects.
//
// AUCUN bouton de suppression : un geste change un statut (`gestes.ts`) ou crée une fiche
// prospect par la porte unique (`fiche.ts`). Chaque action rend la main par une redirection vers
// la page avec `?ok=` ou `?erreur=` (le message), sans état à porter dans le navigateur.
//
// ⚠️ Ce fichier est un module `"use server"` : il n'exporte QUE des fonctions asynchrones, chacune
// est un point d'entrée HTTP (garde `un-fichier-use-server-n-exporte-que-des-fonctions`).

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { peutVoirLesAppels } from "@/features/admin-calendly/acces";
import { adminPath } from "@/lib/admin-path";
import { creerFicheDepuisDemande, type ResultatCreationFiche } from "./fiche";
import { changerStatutDemande, type IssueGeste, type StatutGeste } from "./gestes";

const PAGE = (): string => adminPath("fr", "tunnels/tour/demandes");

const FORME_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function retour(cle: "ok" | "erreur", message: string): never {
  redirect(`${PAGE()}?${cle}=${encodeURIComponent(message)}`);
}

async function sessionEquipe(): Promise<{ readonly id: string }> {
  const session = await auth();
  if (!session?.user?.id) redirect(adminPath("fr", "login"));
  const role = (session.user as { role?: string }).role;
  if (!peutVoirLesAppels(role)) {
    retour("erreur", "Votre rôle ne permet pas ce geste sur les demandes du Tour.");
  }
  return { id: session.user.id };
}

function champ(f: FormData, nom: string): string {
  const v = f.get(nom);
  return typeof v === "string" ? v.trim() : "";
}

async function geste(formData: FormData, vers: StatutGeste, message: string): Promise<void> {
  const { id: acteur } = await sessionEquipe();
  const id = champ(formData, "id");
  if (!FORME_ID.test(id)) retour("erreur", "Demande inconnue.");
  let issue: IssueGeste;
  try {
    issue = await changerStatutDemande(id, vers, acteur);
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "tour-demande-statut" } });
    retour("erreur", "Le changement n'a pas pu être enregistré, réessayez.");
  }
  if (issue === "introuvable") retour("erreur", "Demande inconnue.");
  if (issue === "efface") {
    retour("erreur", "Cette demande a été effacée à la demande de la personne : rien à changer.");
  }
  revalidatePath(PAGE());
  retour("ok", message);
}

/** « J'ai relancé » : la personne a été relancée à la main (aucune relance automatique n'existe). */
export async function marquerRelancee(formData: FormData): Promise<void> {
  await geste(formData, "relancee_main", "Demande marquée comme relancée.");
}

/** « Écarter » : la demande ne compte plus (essai, doublon évident, message sans suite). */
export async function ecarter(formData: FormData): Promise<void> {
  await geste(formData, "ecartee", "Demande écartée.");
}

/** « Remettre en attente » : la demande redevient une demande reçue. */
export async function remettreRecue(formData: FormData): Promise<void> {
  await geste(formData, "recue", "Demande remise en attente.");
}

/** « Créer la fiche prospect » : par la porte unique, avec la raison sociale tapée par l'équipe. */
export async function creerFicheProspect(formData: FormData): Promise<void> {
  const { id: acteur } = await sessionEquipe();
  const id = champ(formData, "id");
  if (!FORME_ID.test(id)) retour("erreur", "Demande inconnue.");
  const raisonSociale = champ(formData, "raisonSociale");
  if (raisonSociale === "") retour("erreur", "Donnez un nom à la fiche.");
  const type = champ(formData, "type") === "particulier" ? "particulier" : "entreprise";
  const motif = champ(formData, "motif");

  let resultat: ResultatCreationFiche;
  try {
    resultat = await creerFicheDepuisDemande(
      id,
      { raisonSociale, type, motif: motif === "" ? null : motif },
      acteur,
    );
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "tour-demande-creer-fiche" } });
    retour("erreur", "La fiche n'a pas pu être créée, réessayez.");
  }
  if (resultat.statut === "refuse") retour("erreur", resultat.message);
  if (resultat.statut === "deja_rattachee") {
    retour("erreur", "Cette demande a déjà une fiche.");
  }
  revalidatePath(PAGE());
  retour("ok", `Fiche ${resultat.numero} créée.`);
}
