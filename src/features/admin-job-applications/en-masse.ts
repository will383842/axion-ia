/**
 * CE QUE LE GESTE GROUPÉ EXPOSE — hors du module `"use server"`.
 *
 * ⚠️ **Un module `"use server"` ne peut exporter QUE des fonctions
 *    asynchrones.** Chaque export y devient un point d'entrée réseau ; une
 *    constante exportée depuis `actions-en-masse.ts` ferait rougir la garde
 *    `un-fichier-use-server-n-exporte-que-des-fonctions`. Le plafond et l'état
 *    de retour vivent donc ici — d'où le formulaire les lit aussi, sans
 *    recopier le nombre dans son texte d'aide.
 *
 * 🔑 Ce fichier est PUR : ni Prisma, ni session, ni `server-only`. C'est ce qui
 *    lui permet d'être importé par un composant client sans rien tirer du
 *    serveur dans le bundle.
 */

/**
 * Plafond de dossiers par geste groupé.
 *
 * Il n'existe pas pour protéger la base — cinquante `update` ne sont rien. Il
 * existe pour protéger le recruteur : au-delà, on ne sait plus ce qu'on vient
 * de faire, et le journal de cinquante dossiers ne se relit pas. Cocher « tout
 * sélectionner » sur deux cents lignes et changer leur statut d'un clic est un
 * geste dont on ne revient pas — le journal est en ajout seul.
 */
export const PLAFOND_EN_MASSE = 50;

export type EtatEnMasse =
  | {
      ok: true;
      /** Dossiers réellement modifiés. */
      traitees: number;
      /**
       * Dossiers DÉJÀ dans l'état visé, donc ni réécrits ni consignés.
       *
       * 🔑 Comptés à part, jamais fondus dans `traitees` : le total gonflé
       * ferait croire à un geste qui n'a pas eu lieu, et c'est justement ce
       * qu'on vérifie quand on doute d'un clic.
       */
      inchangees: number;
    }
  | { ok: false; error: string };
