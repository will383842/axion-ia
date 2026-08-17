/**
 * Content-Disposition — une pièce s'OUVRE, ou s'enregistre. Module PUR.
 *
 * ## Le défaut que ce module ferme
 *
 * 🔴 Constaté à l'audit blanc Qualiopi : **« aucune pièce du critère 1 n'a pu
 * être ouverte »**. Toutes les routes qui servent une pièce écrivaient
 * `attachment` en dur — jusque dans `r2-storage.ts`, dont l'unique option de
 * nom de fichier s'appelait `downloadFilename` et **imposait l'enregistrement
 * sans le dire**.
 *
 * Chaque clic de l'auditrice déposait un PDF de plus dans son dossier de
 * téléchargements au lieu de l'afficher. Il fallait sortir du navigateur pour
 * lire quoi que ce soit — et une preuve qu'on ne peut pas lire à l'écran n'est
 * pas une preuve consultable.
 *
 * ⚠️ Le nom de l'option MENTAIT sur son effet : on croyait ne choisir qu'un nom
 * de fichier, on imposait aussi un comportement. Personne ne relit une option
 * dont le nom paraît anodin. C'est le même défaut qu'une fonction nommée
 * `stripExifPreserveOrientation` qui ne strippe rien : **un nom qui ment est
 * pire qu'une ligne fausse, parce qu'on l'appelle en confiance.**
 *
 * ## La règle
 *
 * Une pièce se **consulte** d'abord ; l'enregistrer est un second geste,
 * explicite. Le défaut est donc `inline`, et `?dl=1` demande l'enregistrement.
 * La convention n'est pas inventée ici : elle existe déjà dans
 * `documents-interventions/fichiers/[id]/route.ts`.
 *
 * ## Pourquoi un module, et pas un ternaire recopié
 *
 * Il y a plusieurs routes de service de pièces et **deux façons de livrer** :
 * un tampon en mémoire (en-tête de réponse) et une redirection vers une URL R2
 * pré-signée (paramètre signé dans l'URL). C'est la même grammaire, et les deux
 * doivent dire la même chose — c'est précisément parce qu'elles étaient écrites
 * séparément que l'une a pu figer `attachment` sans que l'autre le sache.
 *
 * Le dépôt a déjà payé cette leçon : la clé R2 avait été **recopiée à la main
 * dans sept fichiers** avant d'avoir une source unique.
 *
 * ## Ce que ce module ne promet PAS
 *
 * ⚠️ `inline` est une **demande**, pas une garantie : un navigateur dont le
 * lecteur PDF intégré est désactivé téléchargera quand même, et c'est son
 * droit. La contrepartie est qu'un `attachment` écrit en dur, lui, ne laisse
 * **aucune** chance d'ouvrir — c'est la différence entre « souvent » et
 * « jamais ».
 *
 * ⚠️ Il ne renomme rien. La mise en forme du nom d'une pièce appartient à
 * `server/qualiopi/documents/nom-fichier.ts`.
 */

/** Ce que le navigateur doit faire de la pièce. Jamais implicite. */
export type DispositionFichier = "inline" | "attachment";

/**
 * Le paramètre de requête qui demande l'enregistrement.
 *
 * Repris tel quel de `documents-interventions/fichiers/[id]` : une seule
 * convention dans le dépôt, pas deux à retenir selon le module où l'on est.
 */
export const PARAM_TELECHARGEMENT = "dl";

/**
 * Disposition demandée par l'URL.
 *
 * 🔴 `?dl=1` et RIEN D'AUTRE force l'enregistrement : `?dl=0`, `?dl=` et
 * `?dl=true` retombent sur `inline`. Traiter « le paramètre est présent »
 * comme « télécharger » ferait de `?dl=0` un téléchargement — le genre
 * d'inversion qui se relit sans qu'on la voie et ne se constate qu'en
 * production.
 */
export function dispositionDemandee(url: string | URL): DispositionFichier {
  const params = (url instanceof URL ? url : new URL(url)).searchParams;
  return params.get(PARAM_TELECHARGEMENT) === "1" ? "attachment" : "inline";
}

/** Ajoute `?dl=1` à un lien, pour offrir l'enregistrement à côté de la lecture. */
export function lienTelechargement(href: string): string {
  return href.includes("?")
    ? `${href}&${PARAM_TELECHARGEMENT}=1`
    : `${href}?${PARAM_TELECHARGEMENT}=1`;
}

/**
 * Nom de fichier sûr pour un en-tête HTTP.
 *
 * 🔴 Ni guillemet ni antislash : ils termineraient ou échapperaient la valeur
 * entre guillemets. Un nom issu de la donnée — la raison sociale d'un client —
 * pourrait sinon injecter ses propres paramètres d'en-tête.
 */
export function nomFichierSurEnTete(nom: string): string {
  return nom.replace(/["\\]/g, "");
}

/**
 * Valeur complète d'un en-tête `Content-Disposition`.
 *
 * Sert à la fois à l'en-tête d'une réponse à tampon ET au paramètre
 * `ResponseContentDisposition` d'une URL R2 pré-signée : même grammaire, une
 * seule implémentation.
 */
export function enTeteContentDisposition(
  disposition: DispositionFichier,
  nomFichier: string,
): string {
  return `${disposition}; filename="${nomFichierSurEnTete(nomFichier)}"`;
}
