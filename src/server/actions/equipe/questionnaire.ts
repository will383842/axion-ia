"use server";

/**
 * Envoi du questionnaire public d'une fiche collaborateur (lien personnel). Toute la logique et toutes les
 * protections sont dans `@/server/equipe/questionnaire/questionnaire` ; ici, seulement la lecture du
 * formulaire (le FormData est celui du DOM, leurre compris) et le dépôt de la photo en mémoire.
 */
import { getClientIp, getClientUserAgent } from "@/lib/client-ip";
import { signalerHoneypot } from "@/lib/security/honeypot-observable";
import {
  MESSAGE_NEUTRE,
  PHOTO_QUESTIONNAIRE_MAX_OCTETS,
  soumettreQuestionnaire,
} from "@/server/equipe/questionnaire/questionnaire";

export type EtatQuestionnaire =
  | { etat: "initial" }
  | { etat: "recu"; photo: "aucune" | "deposee" | "non-appliquee" | "echec" }
  | { etat: "neutre" }
  | { etat: "erreur"; message: string };

function texte(fd: FormData, cle: string): string {
  const v = fd.get(cle);
  return typeof v === "string" ? v.trim() : "";
}

export async function envoyerQuestionnaireAction(
  _prev: EtatQuestionnaire,
  formData: FormData,
): Promise<EtatQuestionnaire> {
  const leurre = formData.get("website");
  if (leurre) {
    await signalerHoneypot("equipe-questionnaire", leurre);
    return { etat: "recu", photo: "aucune" };
  }

  const categorie: Record<string, string> = {};
  for (const [cle, valeur] of formData.entries()) {
    if (cle.startsWith("cat_") && typeof valeur === "string" && valeur.trim() !== "") {
      categorie[cle.slice(4)] = valeur.trim();
    }
  }
  const linkedin = texte(formData, "linkedin");
  const fichier = formData.get("photo");
  let photo: Buffer | null = null;
  if (fichier instanceof File && fichier.size > 0) {
    if (fichier.size > PHOTO_QUESTIONNAIRE_MAX_OCTETS) {
      return { etat: "erreur", message: "La photo dépasse 5 Mo." };
    }
    photo = Buffer.from(await fichier.arrayBuffer());
  }
  const coche = (cle: string) => formData.get(cle) === "on";

  const r = await soumettreQuestionnaire({
    jeton: texte(formData, "jeton"),
    reponse: {
      commun: {
        prenom: texte(formData, "prenom"),
        lieu: texte(formData, "lieu"),
        intitule: texte(formData, "intitule"),
        presentation: texte(formData, "presentation"),
        apport: texte(formData, "apport"),
        langues: texte(formData, "langues")
          .split(",")
          .map((l) => l.trim())
          .filter((l) => l !== ""),
        ...(linkedin !== "" ? { linkedin } : {}),
        souhaitCarte: coche("souhaitCarte"),
      },
      categorie,
      consentements: {
        publication: coche("consent_publication"),
        photo: coche("consent_photo"),
        linkedin: coche("consent_linkedin"),
      },
    },
    attestation: coche("attestation"),
    photo,
    turnstile: texte(formData, "cf-turnstile-response") || null,
    ip: await getClientIp(),
    userAgent: await getClientUserAgent(),
  });
  if (r.ok) return { etat: "recu", photo: r.photo };
  if (r.motif === "neutre") return { etat: "neutre" };
  return { etat: "erreur", message: r.message === MESSAGE_NEUTRE ? "Réessayez." : r.message };
}
