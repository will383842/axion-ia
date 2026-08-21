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
import {
  creerPublicationAction,
  validerPublicationAction,
  marquerPublieeAction,
  modifierPublicationAction,
} from "@/server/actions/editorial/publications";
import {
  capturerIdeeAction,
  promouvoirIdeeAction,
  archiverIdeeAction,
} from "@/server/actions/editorial/idees";
import {
  appliquerRecetteAction,
  passerAssetPretAction,
  programmerPublicationAction,
  rattacherAssetAction,
} from "@/server/actions/editorial/recettes";
import {
  soumettreAssetRevueAction,
  changerRoleMembreAction,
  assignerAssetAction,
} from "@/server/actions/editorial/equipe";
import { detacherAssetAction } from "@/server/actions/editorial/assets";

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

// ── Les gestes du cycle de vie ────────────────────────────────────────────
//
// 🔴 Manque trouvé par la passe 5 du protocole (vérificateur à l'aveugle).
//
// Ces neuf actions étaient écrites, testées, et appelées par AUCUN écran. Le
// §7 s'ouvre pourtant sur « en gestes observables. Pas "ça marche" » : un
// geste qu'aucun écran ne permet n'est pas observable, et le critère qui en
// dépend n'est pas tenu — quelle que soit la qualité du code dessous.
//
// C'était le constat dominant de la passe, et il était juste : j'avais livré
// la logique et sauté les formulaires qui l'appellent.

/** Ajoute un drapeau de succès à l'URL de retour. */
function avecSucces(base: string, cle: string, valeur = "1"): string {
  const separateur = base.includes("?") ? "&" : "?";
  return `${base}${separateur}${cle}=${valeur}`;
}

/**
 * Valide une publication — critère 7 du lot 1.
 *
 * Le refus de conformité remonte tel quel dans la querystring : il cite déjà
 * la règle, le motif et l'extrait fautif. Le réécrire ici le dégraderait.
 */
export async function validerPublicationFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const id = champ(donnees, "id");
  if (!id) redirect(avecErreur(retour, "Publication introuvable."));

  const resultat = await validerPublicationAction({ id });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "valide"));
}

/** Programme une publication — le contrôle des assets se fait dans l'action. */
export async function programmerPublicationFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const id = champ(donnees, "id");
  if (!id) redirect(avecErreur(retour, "Publication introuvable."));

  const outil = champ(donnees, "outil");
  const refExterne = champ(donnees, "refExterne");
  const resultat = await programmerPublicationAction({
    id,
    ...(outil ? { outil } : {}),
    ...(refExterne ? { refExterne } : {}),
  });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "programme"));
}

/**
 * Marque une publication publiée, avec son URL réelle.
 *
 * ⚠️ L'action est idempotente depuis la passe 4 : rejouer ne republie pas et
 * ne repousse pas `derniereParutionA`, qui arme l'alerte « canal muet ».
 */
export async function marquerPublieeFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const id = champ(donnees, "id");
  const urlPubliee = champ(donnees, "urlPubliee");
  if (!id) redirect(avecErreur(retour, "Publication introuvable."));
  if (!urlPubliee) {
    redirect(avecErreur(retour, "L'URL réelle de la publication est requise."));
  }

  const resultat = await marquerPublieeAction({ id, urlPubliee });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "publie"));
}

/**
 * Modifie le contenu d'une publication — critère 8 du lot 1.
 *
 * 🔴 `versionAttendue` est transmise depuis le formulaire, et ce n'est pas
 * une formalité : c'est la moitié de la garde anti-écrasement posée par la
 * passe 4. Sans elle, deux personnes sur la même fiche se marchent dessus en
 * silence, et le texte perdu n'existe nulle part.
 */
export async function modifierPublicationFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const id = champ(donnees, "id");
  if (!id) redirect(avecErreur(retour, "Publication introuvable."));

  const versionBrute = champ(donnees, "versionAttendue");
  const versionAttendue = versionBrute ? Number(versionBrute) : undefined;

  // Un champ vidé volontairement doit pouvoir EFFACER la valeur : on
  // distingue donc « absent du formulaire » (undefined) de « présent et vide »
  // (null). `champ()` rend `undefined` dans les deux cas, d'où la lecture
  // brute ici — sans quoi on ne pourrait jamais retirer une accroche.
  const texte = (nom: string): string | null | undefined => {
    const v = donnees.get(nom);
    if (typeof v !== "string") return undefined;
    const propre = v.trim();
    return propre.length > 0 ? propre : null;
  };

  const accroche = texte("accroche");
  const corps = texte("corps");
  const premierCommentaire = texte("premierCommentaire");
  const lienUrl = texte("lienUrl");
  const tagsBruts = champ(donnees, "tags");
  const motif = champ(donnees, "motif");

  const resultat = await modifierPublicationAction({
    id,
    ...(accroche !== undefined ? { accroche } : {}),
    ...(corps !== undefined ? { corps } : {}),
    ...(premierCommentaire !== undefined ? { premierCommentaire } : {}),
    ...(lienUrl !== undefined ? { lienUrl } : {}),
    ...(tagsBruts !== undefined
      ? { tags: tagsBruts.split(/[\s,]+/).filter((t) => t.length > 0) }
      : {}),
    ...(motif ? { motif } : {}),
    ...(versionAttendue !== undefined && Number.isFinite(versionAttendue)
      ? { versionAttendue }
      : {}),
  });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(
    resultat.data.versionCreee
      ? avecSucces(retour, "version", String(resultat.data.version))
      : avecSucces(retour, "enregistre"),
  );
}

/** Soumet un asset à la revue — le geste que le rôle `montage` A le droit de faire. */
export async function soumettreAssetRevueFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const assetId = champ(donnees, "assetId");
  if (!assetId) redirect(avecErreur(retour, "Asset introuvable."));

  const resultat = await soumettreAssetRevueAction({ assetId });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "soumis"));
}

/**
 * Passe un asset à `pret` — critère 5 du lot 2.
 *
 * 🔴 C'est LA porte de validation, et elle exige `asset.valider`, que le rôle
 * `montage` n'a pas. La passe 5 avait trouvé qu'on pouvait la contourner par
 * le téléversement ; ce chemin est fermé depuis, et celui-ci est le seul.
 *
 * L'avertissement (durée indéterminée) remonte à l'écran : passer sans
 * pouvoir vérifier la spec n'est pas la même chose que passer en la
 * vérifiant, et l'écran doit le dire.
 */
export async function passerAssetPretFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const assetId = champ(donnees, "assetId");
  if (!assetId) redirect(avecErreur(retour, "Asset introuvable."));

  const resultat = await passerAssetPretAction({ assetId });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  const base = avecSucces(retour, "pret");
  redirect(
    resultat.data.avertissement
      ? `${base}&avertissement=${encodeURIComponent(resultat.data.avertissement)}`
      : base,
  );
}

/** Applique une recette de dérivation — critère 1 du lot 2. */
export async function appliquerRecetteFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const assetId = champ(donnees, "assetId");
  const recetteId = champ(donnees, "recetteId");
  if (!assetId || !recetteId) {
    redirect(avecErreur(retour, "Choisissez une recette à appliquer."));
  }

  const resultat = await appliquerRecetteAction({ assetId, recetteId });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "derives", String(resultat.data.crees)));
}

/**
 * Change le rôle d'un membre — critère 2 du lot 4.
 *
 * L'auto-rétrogradation d'un admin est refusée par l'action, avec son
 * explication : se retirer soi-même le dernier droit d'administration ferme
 * la porte de l'intérieur.
 */
export async function changerRoleMembreFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const membreId = champ(donnees, "membreId");
  const role = champ(donnees, "role");
  if (!membreId || !role) redirect(avecErreur(retour, "Membre ou rôle manquant."));

  const resultat = await changerRoleMembreAction({
    membreId,
    role: role as Parameters<typeof changerRoleMembreAction>[0]["role"],
  });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "role"));
}

/** Écarte une idée — en DISANT pourquoi, le motif est obligatoire. */
export async function archiverIdeeFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const id = champ(donnees, "id");
  const motif = champ(donnees, "motif");
  if (!id) redirect(avecErreur(retour, "Idée introuvable."));
  if (!motif) {
    // Le critère l'exige : écarter sans motif, c'est perdre la raison six
    // mois plus tard, quand l'idée revient et qu'on ne sait plus.
    redirect(avecErreur(retour, "Dire POURQUOI on écarte une idée."));
  }

  const resultat = await archiverIdeeAction({ id, motif });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "archivee"));
}

/**
 * Rattache un asset à un parent — critère 2 du lot 2.
 *
 * 🔴 Ce geste porte la garde anti-cycle corrigée par la passe 4. Tant
 * qu'aucun écran ne l'appelait, la garde n'était pas vérifiable : le §1 du
 * protocole demande qu'une garde rougisse « sur l'objet qui casse », et un
 * objet qu'on ne peut pas soumettre ne casse jamais rien.
 *
 * Un parent vide DÉTACHE — l'asset redevient `autonome`. C'est le même
 * geste, dans l'autre sens, et un second bouton l'aurait dédoublé.
 */
export async function rattacherAssetFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const assetId = champ(donnees, "assetId");
  if (!assetId) redirect(avecErreur(retour, "Asset introuvable."));

  const parentId = champ(donnees, "parentId") ?? null;
  const offsetBrut = champ(donnees, "offsetSourceSec");
  const offset = offsetBrut ? Number(offsetBrut) : undefined;

  const resultat = await rattacherAssetAction({
    assetId,
    parentId,
    ...(offset !== undefined && Number.isFinite(offset) ? { offsetSourceSec: offset } : {}),
  });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, parentId ? "rattache" : "detache"));
}

/**
 * Détache un asset d'une publication — le lien, pas l'asset.
 *
 * ⚠️ Le §4 réserve « supprimer quoi que ce soit » à l'admin, et l'action
 * n'exige aujourd'hui que `asset.ecrire`, que le rôle `montage` possède. La
 * passe 4 a signalé l'écart sans trancher, et il reste ouvert : « modifier un
 * asset » et « supprimer un lien » sont défendables l'un comme l'autre. Le
 * geste est donc branché tel quel, et la question posée à Will — pas résolue
 * en douce par un choix d'écran.
 */
export async function detacherAssetFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const assetId = champ(donnees, "assetId");
  const publicationId = champ(donnees, "publicationId");
  if (!assetId || !publicationId) redirect(avecErreur(retour, "Lien introuvable."));

  const resultat = await detacherAssetAction({ assetId, publicationId });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "detacheLien"));
}

/** Assigne un asset à un membre — critère 1 du lot 4, « qui fait quoi ». */
export async function assignerAssetFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const assetId = champ(donnees, "assetId");
  if (!assetId) redirect(avecErreur(retour, "Asset introuvable."));

  // Un responsable vide DÉSASSIGNE : reprendre un asset à quelqu'un est un
  // geste aussi légitime que le lui confier.
  const membreId = champ(donnees, "membreId") ?? null;

  const resultat = await assignerAssetAction({ assetId, membreId });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "assigne"));
}
