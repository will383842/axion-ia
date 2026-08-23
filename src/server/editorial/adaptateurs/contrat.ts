/**
 * Console éditoriale — le contrat des adaptateurs de publication (§10, lot 5).
 *
 * Module PUR : le contrat, le registre des portes, et l'adaptateur `Manuel`.
 * Aucun appel réseau — les adaptateurs qui en feront un arriveront lot par
 * lot, quand leur porte s'ouvrira.
 *
 * ── 🔴 Ce que « lot 5 » veut dire, et pourquoi il ne se code pas d'un bloc ─
 *
 * Le plan est explicite : « critères à écrire au moment du lot : ils dépendent
 * des PORTES OUVERTES à cette date ». Une porte, ici, n'est pas une ligne de
 * code : c'est un accès délivré par une plateforme, après demande, revue, ou
 * audit. Aucune ne s'ouvre en écrivant du TypeScript.
 *
 * | Plateforme        | Porte                                          | Lot |
 * | ----------------- | ---------------------------------------------- | --- |
 * | LinkedIn profil   | `w_member_social`, self-serve                  | 5a  |
 * | Meta              | aucune revue sur ses propres comptes           | 5b  |
 * | YouTube           | 10 000 unités/jour ≈ 100 envois                | 5c  |
 * | LinkedIn page     | revue partenaire                               | 5d  |
 * | TikTok            | 🔴 AUDIT — sans lui, publications forcées EN PRIVÉ | 5e |
 *
 * Ce fichier livre donc : le contrat complet, l'adaptateur `Manuel` — le seul
 * que le §10 attribue au lot 1, et celui que Will utilise réellement — et un
 * registre qui DIT, pour chaque plateforme, pourquoi elle n'est pas encore
 * ouverte. Une porte fermée qui se taît est une porte qu'on croit ouverte.
 */

/** Les plateformes, telles que les porte `EdPlateforme`. */
export type Plateforme =
  "linkedin" | "youtube" | "facebook" | "instagram" | "tiktok" | "email" | "site";

export interface CompteCible {
  id: string;
  plateforme: Plateforme;
  identite: "perso" | "pro";
  libelle: string;
}

export interface PublicationAPublier {
  id: string;
  corps: string | null;
  premierCommentaire: string | null;
  lienUrl: string | null;
  tags: string[];
}

export interface AssetAPublier {
  id: string;
  type: string;
  cheminObjet: string | null;
  dureeSec: number | null;
}

export interface Disponibilite {
  ok: boolean;
  /** Pourquoi ce n'est pas disponible. Toujours renseigné si `ok` est faux. */
  raison?: string;
  /** Le lot où cette porte est censée s'ouvrir. */
  lot?: string;
}

export interface ResultatValidation {
  valide: boolean;
  erreurs: string[];
  avertissements: string[];
}

export interface ResultatPublication {
  refExterne: string;
  url: string;
  /** Vrai quand l'appel a été court-circuité parce que déjà publié. */
  dejaPublie: boolean;
}

/**
 * Le contrat du §10, à la lettre.
 *
 * ⚠️ `publier` est **idempotent** : « rejouer ne publie JAMAIS deux fois ».
 * C'est la clause la plus importante du contrat, et la plus facile à trahir —
 * un utilisateur qui clique deux fois, un rejeu après timeout, une reprise de
 * file. Chaque implémentation doit s'appuyer sur `refExterne` déjà présent
 * plutôt que sur la bonne volonté de l'appelant.
 */
export interface AdaptateurPublication {
  readonly code: string;
  readonly plateforme: Plateforme;
  estDisponible(compte: CompteCible): Promise<Disponibilite>;
  valider(
    publication: PublicationAPublier,
    assets: readonly AssetAPublier[],
  ): Promise<ResultatValidation>;
  publier(
    publication: PublicationAPublier,
    assets: readonly AssetAPublier[],
    refExterneExistant: string | null,
  ): Promise<ResultatPublication>;
  commenter?(refExterne: string, texte: string): Promise<void>;
}

// ── L'adaptateur Manuel — le seul du lot 1 ────────────────────────────────

/**
 * Publication MANUELLE : l'outil prépare, l'humain colle.
 *
 * Ce n'est pas un bouche-trou en attendant les API — c'est le mode de
 * fonctionnement réel décrit au §2 bis C, celui du kit de publication et de
 * son test des deux clics. Il restera utile même quand les portes s'ouvriront :
 * une plateforme en panne, un compte suspendu, un post qu'on veut relire une
 * dernière fois.
 *
 * `publier` n'envoie donc rien : il ENREGISTRE que l'humain l'a fait, avec
 * l'URL réelle. L'idempotence est immédiate — un `refExterne` déjà présent
 * signifie que c'est déjà noté.
 */
export const adaptateurManuel: AdaptateurPublication = {
  code: "manuel",
  // La plateforme n'a pas de sens ici : le manuel vaut pour toutes. On
  // déclare `site` pour satisfaire le type, et le registre ne s'en sert pas
  // pour choisir — `manuel` est le repli universel.
  plateforme: "site",

  async estDisponible(): Promise<Disponibilite> {
    // Toujours disponible : il ne dépend d'aucune porte.
    return { ok: true };
  },

  async valider(publication, assets): Promise<ResultatValidation> {
    const erreurs: string[] = [];
    const avertissements: string[] = [];

    if (!publication.corps || publication.corps.trim().length === 0) {
      erreurs.push("Le corps est vide : il n'y a rien à coller.");
    }
    if (assets.some((a) => !a.cheminObjet)) {
      avertissements.push(
        "Un asset lié n'a pas de fichier déposé : il ne sera pas dans l'archive.",
      );
    }
    return { valide: erreurs.length === 0, erreurs, avertissements };
  },

  async publier(publication, _assets, refExterneExistant): Promise<ResultatPublication> {
    if (refExterneExistant) {
      // 🔴 L'idempotence du §10 : rejouer ne publie jamais deux fois.
      return { refExterne: refExterneExistant, url: refExterneExistant, dejaPublie: true };
    }
    throw new Error(
      "L'adaptateur manuel ne publie pas tout seul : collez le contenu depuis le kit, " +
        "puis marquez la publication comme publiée en renseignant son URL réelle.",
    );
  },
};

// ── Le registre des portes ────────────────────────────────────────────────

export interface Porte {
  plateforme: Plateforme;
  /** Le lot où cette porte est censée s'ouvrir. */
  lot: string;
  /** Ce qu'il faut obtenir, en clair. */
  exigence: string;
  /** Ouverte ? Aucune ne l'est à ce jour. */
  ouverte: boolean;
  /**
   * Ce qui se passe si on publie SANS la porte. Vide quand il ne se passe
   * rien de particulier — mais TikTok mérite qu'on le dise.
   */
  sansLaPorte?: string;
}

/**
 * L'état des portes, au 21 août 2026.
 *
 * 🔴 Aucune n'est ouverte. Ce registre n'est donc pas une liste de
 * fonctionnalités à venir : c'est la raison pour laquelle le lot 5 ne se code
 * pas aujourd'hui, écrite noir sur blanc pour que personne n'aille croire que
 * la publication automatique est « presque prête ».
 */
export const PORTES: readonly Porte[] = [
  {
    plateforme: "linkedin",
    lot: "5a",
    exigence:
      "Portée `w_member_social` sur une application LinkedIn — self-serve, " +
      "mais elle ne couvre QUE le profil personnel.",
    ouverte: false,
  },
  {
    plateforme: "facebook",
    lot: "5b",
    exigence:
      "Application Meta et jeton de page. Aucune revue tant qu'on ne publie " +
      "que sur SES PROPRES comptes.",
    ouverte: false,
  },
  {
    plateforme: "instagram",
    lot: "5b",
    exigence: "Compte professionnel rattaché à une page Facebook, via l'API Meta.",
    ouverte: false,
  },
  {
    plateforme: "youtube",
    lot: "5c",
    exigence:
      "API YouTube Data v3. Quota de 10 000 unités par jour, soit environ " +
      "100 envois — largement suffisant, mais à surveiller.",
    ouverte: false,
  },
  {
    plateforme: "tiktok",
    lot: "5e",
    exigence: "AUDIT de l'application par TikTok.",
    ouverte: false,
    // 🔴 Le piège qui vaut d'être écrit deux fois.
    sansLaPorte:
      "Sans l'audit, TikTok force TOUTES les publications de l'application EN PRIVÉ. " +
      "Un adaptateur qui publierait quand même aurait l'air de fonctionner — statut " +
      "« publié », référence externe rendue, aucune erreur — et personne ne verrait " +
      "jamais les vidéos. C'est le pire mode d'échec possible : silencieux et durable.",
  },
];

/** La porte d'une plateforme, s'il y en a une. */
export function porteDe(plateforme: Plateforme): Porte | null {
  return PORTES.find((p) => p.plateforme === plateforme) ?? null;
}

/**
 * Choisit l'adaptateur d'un compte.
 *
 * Tant qu'aucune porte n'est ouverte, tout retombe sur `manuel` — et c'est
 * volontaire : mieux vaut un mode manuel qui marche qu'un mode automatique
 * qui prétend marcher.
 */
export function adaptateurPour(plateforme: Plateforme): AdaptateurPublication {
  const porte = porteDe(plateforme);
  if (!porte || !porte.ouverte) return adaptateurManuel;
  // Aucun adaptateur automatique n'existe encore ; quand il y en aura, ils
  // se déclareront ici. Le repli reste `manuel` par sécurité.
  return adaptateurManuel;
}

/**
 * Peut-on publier automatiquement sur cette plateforme ?
 *
 * Le refus CITE la porte manquante et ce qu'il faudrait obtenir. « Non
 * disponible » sans explication laisse croire à une panne.
 */
export function disponibiliteAutomatique(plateforme: Plateforme): Disponibilite {
  const porte = porteDe(plateforme);
  if (!porte) {
    return {
      ok: false,
      raison:
        `Aucune publication automatique n'est prévue pour « ${plateforme} ». ` +
        `Le kit de publication reste le chemin.`,
    };
  }
  if (porte.ouverte) return { ok: true };
  return {
    ok: false,
    lot: porte.lot,
    raison:
      `Porte fermée (lot ${porte.lot}) : ${porte.exigence}` +
      (porte.sansLaPorte ? ` ${porte.sansLaPorte}` : ""),
  };
}
