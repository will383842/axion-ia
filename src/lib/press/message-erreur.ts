/**
 * Les erreurs de la salle de presse, dites en français à qui les lit.
 *
 * ## 🔴 Le défaut mesuré (2026-08-25, cahier D7-3)
 *
 * Les écrans presse rendaient `` `Erreur : ${state.error}` `` et les actions
 * serveur renvoient des identifiants machine. Un rédacteur voyait donc, en
 * toutes lettres :
 *
 * > **« Erreur : file_required »** · **« Erreur : unsupported_mime »** ·
 * > **« Erreur : not_found »**
 *
 * Un code machine affiché à l'utilisateur n'est pas un message d'erreur : c'est
 * un aveu que personne n'a prévu ce qu'il devait lire. Il ne dit ni ce qui s'est
 * passé, ni quoi faire.
 *
 * ## Pourquoi la traduction vit ICI, à la frontière d'affichage
 *
 * Les codes sont produits par **trois** fichiers d'actions (`releases.ts`,
 * `media.ts`, `media-coverage.actions.ts`) et rendus par **deux** écrans. Les
 * traduire dans chaque action disperserait la formulation ; les traduire dans
 * chaque écran la dupliquerait. Une seule table, au point de rendu.
 *
 * 🔑 Et les codes RESTENT côté serveur : ce sont eux qu'on lit dans un journal
 * ou une trace Sentry. On ne remplace pas le code, on l'habille au dernier
 * moment.
 *
 * ## La règle de reconnaissance, et pourquoi elle est sûre
 *
 * Un code machine est `snake_case` : minuscules, chiffres, tirets bas, **aucun
 * espace**. Tout le reste — les messages Zod, déjà rédigés en français, et les
 * `err.message` remontés d'une exception — **passe tel quel**.
 *
 * C'est ce qui rend cette fonction sûre à poser partout : elle ne peut pas
 * abîmer un message déjà lisible.
 */

/**
 * Les codes littéraux renvoyés par `src/server/actions/press/**`.
 *
 * ⚠️ Un cliquet dérive cette liste **du code réel** et rougit si un code y
 * apparaît sans traduction : `src/lib/press/__tests__/aucun-code-machine-a-l-ecran.spec.ts`.
 * Ne pas l'entretenir à la main en espérant que ça tienne.
 */
export const MESSAGES_ERREUR_PRESSE: Readonly<Record<string, string>> = {
  file_required: "Aucun fichier n'a été joint. Sélectionnez le PDF à publier.",
  file_too_large:
    "Le fichier dépasse la taille autorisée. Compressez-le ou réduisez sa définition.",
  unsupported_extension:
    "Ce type de fichier n'est pas accepté. Seuls les PDF peuvent être publiés.",
  unsupported_mime:
    "Le contenu du fichier ne correspond pas à un PDF, quelle que soit son extension.",
  invalid_status: "Ce changement de statut n'est pas possible depuis l'état actuel du communiqué.",
  invalid_tag: "Ce mot-clé n'existe pas dans la taxonomie de la salle de presse.",
  not_found:
    "Cet élément n'existe plus. Il a peut-être été supprimé depuis l'ouverture de l'écran.",
};

/** Un identifiant machine : `snake_case`, sans espace ni ponctuation. */
const CODE_MACHINE = /^[a-z0-9_]+$/;

/**
 * Rend lisible ce qu'une action presse a renvoyé.
 *
 * - un message déjà rédigé (Zod, exception) est rendu **tel quel** ;
 * - un code connu devient sa phrase française ;
 * - un code **inconnu** rend une phrase générique **suivie du code entre
 *   parenthèses** — jamais le code seul, jamais rien.
 *
 * ⚠️ Le repli garde le code visible **à dessein** : c'est ce que l'utilisateur
 * transmettra pour qu'on retrouve la cause. Le masquer complètement rendrait
 * l'incident irracontable.
 */
export function messageErreurPresse(brut: string): string {
  const code = brut.trim();
  if (code === "") return "Une erreur est survenue.";
  if (!CODE_MACHINE.test(code)) return code;

  const connu = MESSAGES_ERREUR_PRESSE[code];
  if (connu !== undefined) return connu;

  return `Une erreur est survenue et l'écran ne sait pas encore la nommer (code : ${code}).`;
}
