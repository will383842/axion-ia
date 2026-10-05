// Reconnaître une personne par son NOM quand son adresse diffère (2026-10-05).
//
// Un candidat venu d'Indeed porte sur sa fiche une adresse RELAIS
// (`marienoelmafogangocxep_uuo@indeedemail.com`) et réserve Calendly avec sa
// vraie adresse : l'empreinte ne correspond pas. Prénom et nom se lisent
// pourtant dans l'adresse relais. Module PUR (aucun import serveur) : il sert au
// sélecteur de la console ET au rattachement automatique, qui tourne dans le
// worker.

/** Minuscules, sans accents ni ponctuation : « Marie-Noëlle » → « marie noelle ». */
function normaliser(v: string): string {
  return v
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Les mots du nom de l'invité qui comptent (3 lettres au moins). Il en faut
 * DEUX pour chercher : un prénom seul ressemble à trop de monde.
 */
export function motsDuNom(nom: string | null | undefined): string[] {
  if (!nom) return [];
  const mots = normaliser(nom)
    .split(" ")
    .filter((m) => m.length >= 3);
  return mots.length >= 2 ? [...new Set(mots)] : [];
}

/**
 * Vrai si la fiche porte tous les mots du nom — dans son nom, ou dans la partie
 * locale de son adresse (une adresse relais Indeed contient prénom + nom).
 */
export function nomCorrespond(
  mots: string[],
  nomFiche: string | null,
  emailFiche: string | null,
): boolean {
  if (mots.length === 0) return false;
  const local = emailFiche ? (emailFiche.split("@")[0] ?? "") : "";
  const bloc = normaliser(`${nomFiche ?? ""} ${local}`).replace(/ /g, "");
  return mots.every((m) => bloc.includes(m));
}
