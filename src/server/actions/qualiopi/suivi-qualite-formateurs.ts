/**
 * Qualiopi ind. 21 — les gestes de la console sur le suivi de la qualité pédagogique d'un
 * intervenant externe : saisir une grille (observation, après mission, réévaluation) ou
 * une décision motivée (entretien, reprise des missions après suspension).
 *
 * Acte `habiliter_formateur` (direction, responsable qualité). L'auteur est l'utilisateur
 * de la session, jamais un champ du formulaire. Les refus (éteint, IDOR, grille vierge…)
 * sont rendus par le service ; ici, la lecture du formulaire et le retour à l'écran.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireHabilitation } from "@/server/actions/qualiopi/_guards";
import { jourParis } from "@/server/qualiopi/formateurs-independants/argent/dates";
import {
  GRILLES_SUIVI_QUALITE,
  REGLAGES_SUIVI_QUALITE,
  type TypeGrilleSuivi,
} from "@/server/qualiopi/formateurs-independants/suivi-qualite/reglages";
import {
  MOTIF_MAX_CARACTERES,
  enregistrerDecision,
  enregistrerGrille,
  type IssueSuivi,
} from "@/server/qualiopi/formateurs-independants/suivi-qualite/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LIBELLES: Record<Extract<IssueSuivi, { ok: false }>["erreur"], string> = {
  eteint: "Le suivi qualité des intervenants n'est pas ouvert (interrupteur éteint).",
  non_concerne:
    "Aucune grille ici : formateur non externe (salarié ou dirigeant), ou session annulée ou reportée.",
  introuvable: "Cette session n'est pas une mission de ce formateur.",
  trop_tot:
    "Trop tôt : l'observation se saisit à partir du premier jour, la grille après mission à partir du dernier.",
  auteur_inconnu: "Votre compte n'a pas de nom affichable : la grille ne peut pas être signée.",
  motif_invalide: `Écrivez le motif (${REGLAGES_SUIVI_QUALITE.texteMinCaracteres} à ${MOTIF_MAX_CARACTERES} caractères) : il reste au dossier.`,
  sans_objet: "Aucune décision attendue sur cette mission (satisfaction au-dessus du seuil).",
  vierge: "Grille vierge : rien n'est enregistré.",
  critere_manquant: "Notez chaque critère de 1 à 5.",
  note_invalide: "Chaque note est un entier de 1 à 5.",
  observateur_manquant: "Indiquez qui a observé.",
  conclusion_trop_courte: `Écrivez la conclusion (${REGLAGES_SUIVI_QUALITE.texteMinCaracteres} caractères au moins).`,
  date_invalide: "La date est absente, illisible ou dans le futur.",
  satisfaction_invalide: "La satisfaction saisie est un entier de 1 à 5.",
};

const TYPES = new Set<TypeGrilleSuivi>(["observation", "evaluation_mission", "reevaluation"]);

function champ(fd: FormData, nom: string): string | undefined {
  const v = fd.get(nom);
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

/** Retour : l'écran « Suivi qualité » d'un formateur, et rien d'autre. */
function retourSur(fd: FormData, trainerId: string): string {
  const v = champ(fd, "retour") ?? "";
  const m =
    /^\/(fr|en)\/([A-Za-z0-9_-]+)\/qualiopi\/formateurs\/([0-9a-f-]{36})\/suivi-qualite$/i.exec(v);
  return m !== null && m[3]!.toLowerCase() === trainerId.toLowerCase() ? v : "/";
}

function entier(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  return /^\d+$/.test(v.trim()) ? Number(v.trim()) : Number.NaN;
}

/** « AAAA-MM-JJ » → midi UTC du jour (le jour de Paris est le même en toute saison). */
function jour(v: string | undefined): Date {
  if (v === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(Number.NaN);
  return new Date(`${v}T12:00:00Z`);
}

export async function enregistrerGrilleSuiviFormAction(formData: FormData): Promise<void> {
  const session = await requireHabilitation("habiliter_formateur");
  const trainerId = champ(formData, "trainerId") ?? "";
  if (!UUID.test(trainerId)) redirect("/");
  const base = retourSur(formData, trainerId);
  const vers = (cle: "ok" | "erreur", m: string): never =>
    redirect(`${base}?${cle}=${encodeURIComponent(m)}#grilles`);

  const type = champ(formData, "type") as TypeGrilleSuivi | undefined;
  if (type === undefined || !TYPES.has(type)) vers("erreur", "Type de grille inconnu.");
  const sessionBrut = champ(formData, "sessionId");
  if (sessionBrut !== undefined && !UUID.test(sessionBrut)) vers("erreur", LIBELLES.introuvable);

  const notes: Record<string, number | undefined> = {};
  for (const c of GRILLES_SUIVI_QUALITE[type!].criteres) {
    notes[c.code] = entier(champ(formData, `note_${c.code}`));
  }
  const satisfaction = entier(champ(formData, "satisfaction"));
  const maintenant = new Date();
  const dateSaisie = jour(champ(formData, "date"));
  // Le jour même (heure de Paris) : midi UTC ne doit pas passer pour « dans le futur ».
  const date =
    !Number.isNaN(dateSaisie.getTime()) &&
    dateSaisie.getTime() > maintenant.getTime() &&
    champ(formData, "date") === jourParis(maintenant)
      ? maintenant
      : dateSaisie;

  const issue = await enregistrerGrille({
    type: type!,
    trainerId,
    sessionId: sessionBrut ?? null,
    notes,
    conclusion: (champ(formData, "conclusion") ?? "").slice(0, 5000),
    date,
    observateur: champ(formData, "observateur") ?? "",
    satisfaction: satisfaction ?? null,
    auteur: { userId: session.userId },
    maintenant,
  });
  revalidatePath(base);
  if (!issue.ok) vers("erreur", LIBELLES[issue.erreur]);
  vers("ok", "Grille enregistrée et signée. Elle est rangée au dossier du formateur.");
}

export async function enregistrerDecisionSuiviFormAction(formData: FormData): Promise<void> {
  const session = await requireHabilitation("habiliter_formateur");
  const trainerId = champ(formData, "trainerId") ?? "";
  if (!UUID.test(trainerId)) redirect("/");
  const base = retourSur(formData, trainerId);
  const vers = (cle: "ok" | "erreur", m: string): never =>
    redirect(`${base}?${cle}=${encodeURIComponent(m)}#missions`);
  const sessionId = champ(formData, "sessionId") ?? "";
  const type = champ(formData, "type");
  if (!UUID.test(sessionId)) vers("erreur", LIBELLES.introuvable);
  if (type !== "entretien" && type !== "levee_suspension") vers("erreur", "Décision inconnue.");
  if (type === "levee_suspension" && champ(formData, "confirmer") !== "oui") {
    vers(
      "erreur",
      "Cochez la confirmation : ce formateur pourra de nouveau recevoir des missions.",
    );
  }
  const issue = await enregistrerDecision({
    trainerId,
    sessionId,
    type: type as "entretien" | "levee_suspension",
    motif: champ(formData, "motif") ?? "",
    auteur: { userId: session.userId },
    maintenant: new Date(),
  });
  revalidatePath(base);
  if (!issue.ok) vers("erreur", LIBELLES[issue.erreur]);
  vers("ok", "Décision enregistrée, signée et tracée au journal.");
}
