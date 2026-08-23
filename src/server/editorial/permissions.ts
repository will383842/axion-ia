/**
 * Console éditoriale — la matrice rôles → permissions (§4 du plan).
 *
 * Module PUR : aucun import `next`/prisma. La matrice est une DONNÉE, et
 * c'est ce qui permet de la tester cellule par cellule — le protocole exige
 * « un test par cellule refusée », parce qu'« une permission non testée est
 * une permission absente ».
 *
 * ⚠️ Ne pas confondre deux notions de rôle qui coexistent dans ce dépôt :
 *
 * - `AdminUser.role` — `super_admin` / `admin` / `editor` / `reader` : l'accès
 *   à la console d'administration dans son ensemble ;
 * - `EdMembre.role` — `admin` / `stratege` / `production` / `montage` /
 *   `lecture` : ce que l'on peut faire **dans la console éditoriale**.
 *
 * Le second est porté par `ed_membres`, rattaché au premier par `userId`.
 */

/** Les cinq rôles du §4, tels que les porte `EdRole`. */
export type RoleEditorial = "admin" | "stratege" | "production" | "montage" | "lecture";

export const ROLES_EDITORIAUX: readonly RoleEditorial[] = [
  "admin",
  "stratege",
  "production",
  "montage",
  "lecture",
] as const;

/**
 * Les actions du §4. Un nom par LIGNE du tableau — pas un par écran : une
 * permission décrit ce qu'on a le droit de faire, pas où on clique.
 */
export type ActionEditoriale =
  | "voir"
  | "publication.ecrire"
  | "publication.valider"
  | "publication.marquerPublie"
  | "asset.ecrire"
  | "asset.valider"
  | "idee.capturer"
  | "idee.promouvoir"
  | "invite.gerer"
  | "metrique.saisir"
  | "reglages.gerer"
  | "equipe.gerer"
  | "supprimer";

/**
 * La matrice, transcrite du §4 **sans interprétation**.
 *
 * Se lit comme le tableau du plan : une action, les rôles qui l'ont.
 */
const MATRICE: Record<ActionEditoriale, readonly RoleEditorial[]> = {
  // Voir calendrier, publications, analyse — tout le monde.
  voir: ["admin", "stratege", "production", "montage", "lecture"],
  // Créer / modifier une publication.
  "publication.ecrire": ["admin", "stratege", "production"],
  // Valider une publication (passage à `valide`) — décision éditoriale.
  "publication.valider": ["admin", "stratege"],
  // Marquer « publié », saisir l'URL.
  "publication.marquerPublie": ["admin", "stratege", "production"],
  // Créer / modifier un asset — le montage en fait partie.
  "asset.ecrire": ["admin", "stratege", "production", "montage"],
  // Valider un asset (passage à `pret`) — PAS le montage : on ne valide pas
  // son propre travail, c'est le principe même du protocole.
  "asset.valider": ["admin", "stratege", "production"],
  // Capturer une idée — tout le monde, y compris `lecture` : une idée se note
  // en dix secondes, et la brider serait perdre la matière.
  "idee.capturer": ["admin", "stratege", "production", "montage", "lecture"],
  // Promouvoir une idée en publication.
  "idee.promouvoir": ["admin", "stratege", "production"],
  "invite.gerer": ["admin", "stratege", "production"],
  "metrique.saisir": ["admin", "stratege", "production"],
  // Réglages, règles, seuils, objectifs — l'admin seul.
  "reglages.gerer": ["admin"],
  "equipe.gerer": ["admin"],
  // Supprimer quoi que ce soit — l'admin seul.
  supprimer: ["admin"],
};

export const ACTIONS_EDITORIALES = Object.keys(MATRICE) as ActionEditoriale[];

/** Le rôle `role` a-t-il le droit de faire `action` ? */
export function peut(role: RoleEditorial, action: ActionEditoriale): boolean {
  return MATRICE[action].includes(role);
}

/** Toutes les actions permises à un rôle — pratique pour l'interface. */
export function actionsDe(role: RoleEditorial): ActionEditoriale[] {
  return ACTIONS_EDITORIALES.filter((a) => peut(role, a));
}

/**
 * Message de refus. Il **cite la règle** : « un refus silencieux est un
 * échec » (passe 4 du protocole).
 */
export function messageRefus(role: RoleEditorial, action: ActionEditoriale): string {
  const autorises = MATRICE[action];
  return (
    `Action « ${action} » refusée : le rôle « ${role} » ne l'a pas. ` +
    `Rôles autorisés par le §4 : ${autorises.join(", ")}.`
  );
}

/**
 * Le monteur ne voit que SA file.
 *
 * Le §4 le dit en note, et c'est une règle d'affichage, pas de permission :
 * `montage` a le droit de `voir`, mais le filtre par défaut de son écran est
 * `responsable = moi`. Sans cela, il ouvre le dossier entier et s'y perd.
 */
export function filtreParDefaut(role: RoleEditorial): { responsableMoi: boolean } {
  return { responsableMoi: role === "montage" };
}

/**
 * Rôle éditorial déduit d'un `AdminUser` qui n'a pas encore de `EdMembre`.
 *
 * Le §1 ter prévoit « un seul utilisateur au départ » : l'écran d'équipe
 * n'existe pas au lot 1, donc `ed_membres` peut être vide alors que Will est
 * connecté. Plutôt que de le bloquer hors de sa propre console, on déduit :
 *
 * - `super_admin` / `admin`  → `admin` éditorial ;
 * - tout le reste            → `lecture`.
 *
 * ⚠️ C'est une déduction d'AMORÇAGE, pas une porte dérobée : dès qu'un
 * `EdMembre` existe pour cet utilisateur, c'est LUI qui fait foi. Un `editor`
 * ou un `reader` n'obtient jamais mieux que `lecture` par cette voie.
 */
export function roleDeduitDepuisAdmin(roleAdmin: string | null | undefined): RoleEditorial {
  return roleAdmin === "super_admin" || roleAdmin === "admin" ? "admin" : "lecture";
}
