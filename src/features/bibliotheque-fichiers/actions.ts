/**
 * Actions serveur de la BIBLIOTHÈQUE DE FICHIERS (Candidatures unifiées L4, ADR 0065).
 *
 * 🔴 Chaque action appelle `gardeBibliotheque()` en PREMIÈRE instruction : une
 *    action serveur s'appelle directement, sans la page (refus de `editor` et
 *    `reader` testé sur l'ACTION). Chaque geste réussi est tracé (`ActivityLog`).
 *
 * Deux familles :
 *   - appelées par le déposeur (composant client) : elles RENDENT un résultat
 *     `{ ok, valeur | erreur }`, jamais d'exception vers le navigateur ;
 *   - appelées par un formulaire de la page (archiver, réafficher) : elles
 *     revalident puis renvoient vers la page avec un code de retour FIXE (aucun
 *     texte libre ni titre dans l'URL).
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { adminPath } from "@/lib/admin-path";
import {
  abandonnerDepot,
  ajouterLienExterne,
  archiverFichier,
  commencerDepot,
  reafficherFichier,
  reprendreDepot,
  signerMorceaux,
  terminerDepot,
  type DepotCommence,
  type EtatReprise,
  type MorceauSigne,
  type Resultat,
} from "@/server/partages/depot";

import { gardeBibliotheque, tracerGeste } from "./garde";

const CHEMIN = "contacts/candidatures/bibliotheque";

const idSchema = z.string().uuid();
const demandeSchema = z.object({
  nom: z.string().max(1000),
  taille: z.number().int().positive(),
  typeMime: z.string().max(300).nullable().optional(),
  categorie: z.string().max(40),
  titre: z.string().max(1000).nullable().optional(),
});
const lienSchema = z.object({
  url: z.string().max(5000),
  titre: z.string().max(1000),
  categorie: z.string().max(40),
});

const INVALIDE = { ok: false, erreur: "Demande invalide." } as const;

export async function commencerDepotAction(demande: unknown): Promise<Resultat<DepotCommence>> {
  const g = await gardeBibliotheque();
  if (!g.ok) return g;
  const d = demandeSchema.safeParse(demande);
  if (!d.success) return INVALIDE;
  const r = await commencerDepot({ ...d.data, dansBibliotheque: true }, g.auteur);
  if (r.ok) await tracerGeste("depot_commence", r.valeur.fichierId, g.auteur.id);
  return r;
}

export async function signerMorceauxAction(
  fichierId: unknown,
  numeros: unknown,
): Promise<Resultat<MorceauSigne[]>> {
  const g = await gardeBibliotheque();
  if (!g.ok) return g;
  const id = idSchema.safeParse(fichierId);
  const n = z.array(z.number().int()).max(100).safeParse(numeros);
  if (!id.success || !n.success) return INVALIDE;
  return signerMorceaux(id.data, n.data);
}

export async function reprendreDepotAction(fichierId: unknown): Promise<Resultat<EtatReprise>> {
  const g = await gardeBibliotheque();
  if (!g.ok) return g;
  const id = idSchema.safeParse(fichierId);
  if (!id.success) return INVALIDE;
  const r = await reprendreDepot(id.data);
  if (r.ok) await tracerGeste("depot_repris", id.data, g.auteur.id);
  return r;
}

export async function terminerDepotAction(
  fichierId: unknown,
): Promise<Resultat<{ fichierId: string }>> {
  const g = await gardeBibliotheque();
  if (!g.ok) return g;
  const id = idSchema.safeParse(fichierId);
  if (!id.success) return INVALIDE;
  const r = await terminerDepot(id.data);
  if (r.ok) {
    await tracerGeste("depot_termine", id.data, g.auteur.id);
    revalidatePath(adminPath("fr", CHEMIN));
  }
  return r;
}

export async function abandonnerDepotAction(
  fichierId: unknown,
): Promise<Resultat<{ fichierId: string }>> {
  const g = await gardeBibliotheque();
  if (!g.ok) return g;
  const id = idSchema.safeParse(fichierId);
  if (!id.success) return INVALIDE;
  const r = await abandonnerDepot(id.data);
  if (r.ok) await tracerGeste("depot_abandonne", id.data, g.auteur.id);
  return r;
}

export async function ajouterLienAction(
  demande: unknown,
): Promise<Resultat<{ fichierId: string }>> {
  const g = await gardeBibliotheque();
  if (!g.ok) return g;
  const d = lienSchema.safeParse(demande);
  if (!d.success) return INVALIDE;
  const r = await ajouterLienExterne({ ...d.data, dansBibliotheque: true }, g.auteur);
  if (r.ok) {
    await tracerGeste("lien_ajoute", r.valeur.fichierId, g.auteur.id);
    revalidatePath(adminPath("fr", CHEMIN));
  }
  return r;
}

/** Formulaire « Archiver » de la page. Jamais de suppression. */
export async function archiverFichierAction(formData: FormData): Promise<void> {
  const g = await gardeBibliotheque();
  if (!g.ok) redirect(`${adminPath("fr", CHEMIN)}?retour=refus`);
  const id = idSchema.safeParse(formData.get("fichierId"));
  if (!id.success) redirect(`${adminPath("fr", CHEMIN)}?retour=introuvable`);
  const r = await archiverFichier(id.data, g.auteur);
  if (r.ok) await tracerGeste("archive", id.data, g.auteur.id);
  revalidatePath(adminPath("fr", CHEMIN));
  redirect(`${adminPath("fr", CHEMIN)}?retour=${r.ok ? "archive" : "erreur"}`);
}

/** Formulaire « Réafficher » de la page des archives. */
export async function reafficherFichierAction(formData: FormData): Promise<void> {
  const g = await gardeBibliotheque();
  if (!g.ok) redirect(`${adminPath("fr", CHEMIN)}?retour=refus`);
  const id = idSchema.safeParse(formData.get("fichierId"));
  if (!id.success) redirect(`${adminPath("fr", CHEMIN)}?retour=introuvable`);
  const r = await reafficherFichier(id.data);
  if (r.ok) await tracerGeste("reaffiche", id.data, g.auteur.id);
  revalidatePath(adminPath("fr", CHEMIN));
  const code = r.ok ? "reaffiche" : r.erreur.includes("antivirus") ? "infecte" : "erreur";
  redirect(`${adminPath("fr", CHEMIN)}?${r.ok ? "" : "archives=1&"}retour=${code}`);
}
