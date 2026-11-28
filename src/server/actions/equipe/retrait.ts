"use server";

/**
 * Retrait par lien personnel (page publique). Toute la logique et les protections sont dans
 * `@/server/equipe/retrait/retrait` ; ici, seulement la lecture du formulaire.
 */
import { getClientIp } from "@/lib/client-ip";
import { MESSAGE_NEUTRE_RETRAIT, retirerParLien } from "@/server/equipe/retrait/retrait";

export type EtatRetrait =
  | { etat: "initial" }
  | { etat: "fait"; portee: "total" | "photo" | "linkedin" }
  | { etat: "neutre"; message: string }
  | { etat: "erreur"; message: string };

export async function retirerParLienAction(
  _prev: EtatRetrait,
  formData: FormData,
): Promise<EtatRetrait> {
  const lire = (cle: string) => {
    const v = formData.get(cle);
    return typeof v === "string" ? v.trim() : "";
  };
  const r = await retirerParLien({
    jeton: lire("jeton"),
    portee: lire("portee"),
    turnstile: lire("cf-turnstile-response") || null,
    ip: await getClientIp(),
  });
  if (r.ok) return { etat: "fait", portee: r.portee };
  if (r.motif === "neutre") return { etat: "neutre", message: MESSAGE_NEUTRE_RETRAIT };
  if (r.motif === "limite") {
    return { etat: "erreur", message: "Trop de tentatives. Réessayez dans une heure." };
  }
  if (r.motif === "turnstile") {
    return { etat: "erreur", message: "La vérification anti-robot a échoué. Réessayez." };
  }
  return { etat: "erreur", message: "Cette demande n'a pas pu être traitée." };
}
