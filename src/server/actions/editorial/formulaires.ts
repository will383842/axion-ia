/**
 * Console éditoriale — adaptateurs de formulaire (lot 1).
 *
 * Ces actions existent pour une raison de BUDGET, pas de style.
 *
 * Les actions de `publications.ts` et `idees.ts` rendent un
 * `{ data } | { error }` — parfait pour du code appelant, inutilisable par un
 * `<form action={…}>` HTML nu, qui ne sait pas lire une valeur de retour.
 * Consommer ce retour demanderait `useActionState`, donc un composant CLIENT,
 * donc du JavaScript sur chaque écran de saisie.
 *
 * Ces adaptateurs prennent un `FormData` et **redirigent** — le seul protocole
 * qu'un formulaire HTML comprend nativement. Résultat : les écrans de capture
 * et de création restent des Server Components, et la console garde son
 * unique composant client (le bouton copier).
 *
 * ⚠️ L'erreur revient par la querystring (`?erreur=…`), et l'écran l'affiche.
 * C'est fruste, mais c'est visible — et un formulaire qui échoue en silence
 * est pire qu'un formulaire laid.
 */

"use server";

import { redirect } from "next/navigation";
import { creerPublicationAction } from "@/server/actions/editorial/publications";
import { capturerIdeeAction, promouvoirIdeeAction } from "@/server/actions/editorial/idees";

/** Lit un champ de formulaire en chaîne propre, ou `undefined` s'il est vide. */
function champ(donnees: FormData, nom: string): string | undefined {
  const v = donnees.get(nom);
  if (typeof v !== "string") return undefined;
  const propre = v.trim();
  return propre.length > 0 ? propre : undefined;
}

/** Ajoute un message d'erreur à une URL de retour. */
function avecErreur(base: string, message: string): string {
  const separateur = base.includes("?") ? "&" : "?";
  return `${base}${separateur}erreur=${encodeURIComponent(message)}`;
}

/**
 * Capture une idée — critère 16 : **un seul champ**.
 *
 * Le formulaire n'en porte qu'un, et cette action n'en exige qu'un. Le §1 ter
 * fixe la barre à « 10 secondes, 1 champ » : tout ajout ici doit être combattu.
 */
export async function capturerIdeeFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const titre = champ(donnees, "titre");

  if (!titre) {
    redirect(avecErreur(retour, "Une idée, même en trois mots."));
  }

  const detail = champ(donnees, "detail");
  const resultat = await capturerIdeeAction({
    titre,
    ...(detail ? { detail } : {}),
  });

  if ("error" in resultat) {
    redirect(avecErreur(retour, resultat.error));
  }
  redirect(`${retour}${retour.includes("?") ? "&" : "?"}capturee=1`);
}

/**
 * Crée une publication — critère 12 : **cinq champs, moins de 30 secondes**.
 *
 * Compte, date, heure, titre, corps. Rien d'autre n'est demandé, et rien
 * d'autre ne doit l'être : « un outil qui demande douze champs pour noter une
 * idée ne sera pas ouvert deux fois ».
 */
export async function creerPublicationFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const compteId = champ(donnees, "compteId");
  const datePrevue = champ(donnees, "datePrevue");
  const heurePrevue = champ(donnees, "heurePrevue");
  const titreInterne = champ(donnees, "titreInterne");
  const corps = champ(donnees, "corps");

  if (!compteId || !datePrevue || !heurePrevue || !titreInterne) {
    redirect(avecErreur(retour, "Compte, date, heure et titre sont requis."));
  }

  const resultat = await creerPublicationAction({
    compteId,
    datePrevue,
    heurePrevue,
    titreInterne,
    ...(corps ? { corps } : {}),
  });

  if ("error" in resultat) {
    redirect(avecErreur(retour, resultat.error));
  }
  // On atterrit sur la fiche créée : le geste suivant est d'y écrire.
  redirect(`${champ(donnees, "basePublications") ?? retour}/${resultat.data.id}`);
}

/**
 * Promeut une idée en publication — critère 17.
 *
 * L'idée n'est pas consommée : elle garde le lien vers ce qu'elle a produit.
 */
export async function promouvoirIdeeFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const id = champ(donnees, "id");
  const compteId = champ(donnees, "compteId");
  const datePrevue = champ(donnees, "datePrevue");

  if (!id || !compteId || !datePrevue) {
    redirect(avecErreur(retour, "Idée, compte et date sont requis pour promouvoir."));
  }

  const heurePrevue = champ(donnees, "heurePrevue");
  const resultat = await promouvoirIdeeAction({
    id,
    compteId,
    datePrevue,
    ...(heurePrevue ? { heurePrevue } : {}),
  });

  if ("error" in resultat) {
    redirect(avecErreur(retour, resultat.error));
  }
  redirect(`${champ(donnees, "basePublications") ?? retour}/${resultat.data.publicationId}`);
}
