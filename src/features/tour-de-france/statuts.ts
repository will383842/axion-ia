// Tour France IA : les boutons de la page « Demandes » de la console (PR-2a).
//
// Server Actions simples, appelées par un `<form action>` de la page (aucun composant client).
// Garde : une session de console ET un rôle admis sur les appels réservés (`peutVoirLesAppels`,
// la liste unique de `admin-calendly/acces.ts`) — ces pages montrent des coordonnées de prospects.
//
// AUCUN bouton de suppression : un geste change un statut (`gestes.ts`), complète une fiche
// proche ou crée une fiche prospect par la porte unique (`fiche.ts`). Chaque action rend la main
// par une redirection vers la page avec `?ok=<code>` ou `?erreur=<code>` : le CODE d'un message
// d'une liste fermée (`messages.ts`), jamais un texte libre, sans état à porter dans le navigateur.
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
import {
  completerFicheDepuisDemande,
  creerFicheDepuisDemande,
  type RaisonRefusCompletion,
  type ResultatCompletion,
  type ResultatCreationFiche,
} from "./fiche";
import { changerStatutDemande, type IssueGeste, type StatutGeste } from "./gestes";
import {
  LONGUEUR_MAX_MOTIF,
  MESSAGE_DEMANDE_ECARTEE,
  MESSAGE_DEMANDE_EFFACEE,
  MESSAGE_DEMANDE_INTROUVABLE,
  type CodeErreur,
  type CodeOk,
} from "./messages";

const PAGE = (): string => adminPath("fr", "tunnels/tour/demandes");

const FORME_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Le code d'erreur de chaque refus d'une complétion de fiche. */
const ERREUR_DU_REFUS: Readonly<Record<RaisonRefusCompletion, CodeErreur>> = {
  introuvable: "demande_inconnue",
  efface: "demande_effacee",
  ecartee: "demande_ecartee",
  fiche_non_proche: "fiche_non_proche",
  fiche_disparue: "fiche_disparue",
};

function reussi(code: CodeOk): never {
  redirect(`${PAGE()}?ok=${encodeURIComponent(code)}`);
}

function echoue(code: CodeErreur): never {
  redirect(`${PAGE()}?erreur=${encodeURIComponent(code)}`);
}

async function sessionEquipe(): Promise<{ readonly id: string }> {
  const session = await auth();
  if (!session?.user?.id) redirect(adminPath("fr", "login"));
  const role = (session.user as { role?: string }).role;
  if (!peutVoirLesAppels(role)) echoue("role");
  return { id: session.user.id };
}

function champ(f: FormData, nom: string): string {
  const v = f.get(nom);
  return typeof v === "string" ? v.trim() : "";
}

async function geste(formData: FormData, vers: StatutGeste, code: CodeOk): Promise<void> {
  const { id: acteur } = await sessionEquipe();
  const id = champ(formData, "id");
  if (!FORME_ID.test(id)) echoue("demande_inconnue");
  let issue: IssueGeste;
  try {
    issue = await changerStatutDemande(id, vers, acteur);
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "tour-demande-statut" } });
    echoue("statut_echec");
  }
  if (issue === "introuvable") echoue("demande_inconnue");
  if (issue === "efface") echoue("demande_effacee");
  revalidatePath(PAGE());
  reussi(code);
}

/** « J'ai relancé » : la personne a été relancée à la main (aucune relance automatique n'existe). */
export async function marquerRelancee(formData: FormData): Promise<void> {
  await geste(formData, "relancee_main", "relancee");
}

/** « Écarter » : la demande ne compte plus (essai, doublon évident, message sans suite). */
export async function ecarter(formData: FormData): Promise<void> {
  await geste(formData, "ecartee", "ecartee");
}

/** « Remettre en attente » : la demande redevient une demande reçue. */
export async function remettreRecue(formData: FormData): Promise<void> {
  await geste(formData, "recue", "remise");
}

/** « Créer la fiche prospect » : par la porte unique, avec la raison sociale tapée par l'équipe. */
export async function creerFicheProspect(formData: FormData): Promise<void> {
  const { id: acteur } = await sessionEquipe();
  const id = champ(formData, "id");
  if (!FORME_ID.test(id)) echoue("demande_inconnue");
  const raisonSociale = champ(formData, "raisonSociale");
  if (raisonSociale === "") echoue("nom_fiche");
  const type = champ(formData, "type") === "particulier" ? "particulier" : "entreprise";
  const motif = champ(formData, "motif");
  if (motif.length > LONGUEUR_MAX_MOTIF) echoue("motif_long");

  let resultat: ResultatCreationFiche;
  try {
    resultat = await creerFicheDepuisDemande(
      id,
      { raisonSociale, type, motif: motif === "" ? null : motif },
      acteur,
    );
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "tour-demande-creer-fiche" } });
    echoue("fiche_echec");
  }
  if (resultat.statut === "refuse") {
    if (resultat.message === MESSAGE_DEMANDE_EFFACEE) echoue("demande_effacee");
    if (resultat.message === MESSAGE_DEMANDE_ECARTEE) echoue("demande_ecartee");
    if (resultat.message === MESSAGE_DEMANDE_INTROUVABLE) echoue("demande_inconnue");
    echoue("fiche_refusee");
  }
  if (resultat.statut === "deja_rattachee") echoue("deja_fiche");
  revalidatePath(PAGE());
  reussi("fiche_creee");
}

/**
 * « Compléter la fiche » : à la demande d'un humain seulement, sur une fiche proche de la demande.
 * Remplit ce qui est vide (la ville du référentiel, la personne) ; n'écrase jamais rien.
 */
export async function completerFiche(formData: FormData): Promise<void> {
  const { id: acteur } = await sessionEquipe();
  const id = champ(formData, "id");
  if (!FORME_ID.test(id)) echoue("demande_inconnue");
  const ficheId = champ(formData, "ficheId");
  if (!FORME_ID.test(ficheId)) echoue("fiche_non_proche");

  let resultat: ResultatCompletion;
  try {
    resultat = await completerFicheDepuisDemande(id, ficheId, acteur);
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "tour-demande-completer-fiche" } });
    echoue("completer_echec");
  }
  if (resultat.statut === "refuse") echoue(ERREUR_DU_REFUS[resultat.raison]);
  if (resultat.statut === "deja_rattachee") echoue("deja_fiche");
  revalidatePath(PAGE());
  reussi("fiche_completee");
}
