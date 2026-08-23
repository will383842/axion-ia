/**
 * Console éditoriale — l'arbre de dérivation et les recettes (lot 2).
 *
 * Module PUR : aucun import `next`/prisma. Il reçoit des assets déjà chargés
 * et rend des arbres, des chemins, des verdicts.
 *
 * ── Ce que le lot 2 demande, et pourquoi c'est délicat ────────────────────
 *
 * > « L'arbre d'un épisode affiche extraits, shorts et variantes sur TROIS
 * >   NIVEAUX. »
 * > « Depuis un short, on remonte à l'épisode ET À LA SECONDE d'origine. »
 *
 * Un épisode de 58 minutes produit ~32 shorts, eux-mêmes déclinés en variantes
 * par plateforme. L'arbre est donc large et profond, et deux pièges le guettent :
 *
 * 1. **Un CYCLE** — un asset dont un ancêtre est aussi son descendant. Le
 *    modèle ne l'interdit pas (`parentId` est une clé étrangère ordinaire vers
 *    la même table), et un parcours naïf boucle jusqu'à épuiser la pile. Le
 *    protocole l'exige explicitement : « l'arbre de dérivation — profondeur 3,
 *    et CYCLE REFUSÉ ». Un cycle « bloque l'application entière ».
 *
 * 2. **L'offset CUMULÉ** — un short découpé à 12 min 30 d'un extrait qui
 *    commençait lui-même à 40 min de l'épisode se situe à **52 min 30** de
 *    l'épisode, pas à 12 min 30. Remonter « à la seconde d'origine » suppose
 *    donc d'ADDITIONNER les offsets le long du chemin, pas de lire le dernier.
 */

/** Un asset, réduit à ce que la dérivation manipule. */
export interface AssetDerivable {
  id: string;
  libelle: string;
  type: string;
  nature: string;
  statut: string;
  parentId: string | null;
  /** Position dans le PARENT direct, en secondes. */
  offsetSourceSec: number | null;
  familleId: string | null;
  dureeSec: number | null;
}

export interface NoeudArbre {
  asset: AssetDerivable;
  /** 0 pour la racine. */
  profondeur: number;
  enfants: NoeudArbre[];
}

// ── Les cycles ────────────────────────────────────────────────────────────

export interface Cycle {
  /** Les identifiants formant la boucle, dans l'ordre. */
  chaine: string[];
  message: string;
}

/**
 * Cherche un cycle dans les liens de parenté.
 *
 * Parcours en profondeur avec trois couleurs (blanc/gris/noir) : un arc vers
 * un nœud GRIS — encore sur la pile — est un cycle. Le simple « déjà visité »
 * ne suffit pas : un asset atteint par deux chemins distincts est normal
 * (deux extraits du même épisode), ce n'est pas une boucle.
 */
export function detecterCycle(assets: readonly AssetDerivable[]): Cycle | null {
  const parents = new Map(assets.map((a) => [a.id, a.parentId]));
  const etat = new Map<string, "gris" | "noir">();

  for (const depart of assets) {
    if (etat.get(depart.id)) continue;

    const pile: string[] = [];
    let courant: string | null = depart.id;

    while (courant) {
      const couleur = etat.get(courant);
      if (couleur === "noir") break;
      if (couleur === "gris") {
        // On retombe sur un nœud de la pile courante : c'est la boucle.
        const debut = pile.indexOf(courant);
        const chaine = pile.slice(debut >= 0 ? debut : 0).concat(courant);
        return {
          chaine,
          message:
            `Cycle de dérivation détecté : ${chaine.join(" → ")}. ` +
            `Un asset ne peut pas descendre de lui-même.`,
        };
      }
      etat.set(courant, "gris");
      pile.push(courant);
      const suivant: string | null = parents.get(courant) ?? null;
      // Un parent hors du lot chargé n'est pas un cycle : on s'arrête là.
      courant = suivant !== null && parents.has(suivant) ? suivant : null;
    }

    for (const id of pile) etat.set(id, "noir");
  }

  return null;
}

/**
 * Le lien `enfant → parent` créerait-il un cycle ?
 *
 * Contrôle à poser AVANT d'écrire : refuser après coup demanderait de défaire
 * une écriture déjà faite.
 */
export function creeraitUnCycle(
  assets: readonly AssetDerivable[],
  enfantId: string,
  parentPropose: string,
): boolean {
  if (enfantId === parentPropose) return true;
  const parents = new Map(assets.map((a) => [a.id, a.parentId]));

  // Si l'enfant est un ANCÊTRE du parent proposé, le lien boucle.
  let courant: string | null = parentPropose;
  const vus = new Set<string>();
  while (courant && !vus.has(courant)) {
    if (courant === enfantId) return true;
    vus.add(courant);
    courant = parents.get(courant) ?? null;
  }
  return false;
}

// ── L'arbre ───────────────────────────────────────────────────────────────

/**
 * Construit l'arbre à partir d'une racine.
 *
 * ⚠️ `profondeurMax` n'est pas une commodité : sans elle, un cycle non détecté
 * ferait déborder la pile. On DÉTECTE le cycle d'abord — mais la borne reste,
 * parce qu'une garde qui dépend d'une autre garde n'est pas une garde.
 */
export function construireArbre(
  assets: readonly AssetDerivable[],
  racineId: string,
  profondeurMax = 10,
): NoeudArbre | null {
  const parId = new Map(assets.map((a) => [a.id, a]));
  const racine = parId.get(racineId);
  if (!racine) return null;

  const enfantsDe = new Map<string, AssetDerivable[]>();
  for (const a of assets) {
    if (!a.parentId) continue;
    const liste = enfantsDe.get(a.parentId);
    if (liste) liste.push(a);
    else enfantsDe.set(a.parentId, [a]);
  }

  function descendre(asset: AssetDerivable, profondeur: number): NoeudArbre {
    if (profondeur >= profondeurMax) {
      return { asset, profondeur, enfants: [] };
    }
    const enfants = (enfantsDe.get(asset.id) ?? [])
      // Ordre stable : par nature puis libellé. Un arbre qui se réordonne à
      // chaque rendu est illisible.
      .sort((a, b) => a.nature.localeCompare(b.nature) || a.libelle.localeCompare(b.libelle))
      .map((e) => descendre(e, profondeur + 1));
    return { asset, profondeur, enfants };
  }

  return descendre(racine, 0);
}

/** Profondeur maximale réellement atteinte — le critère en demande trois. */
export function profondeurDe(noeud: NoeudArbre): number {
  if (noeud.enfants.length === 0) return noeud.profondeur;
  return Math.max(...noeud.enfants.map(profondeurDe));
}

/** Aplatit l'arbre pour l'affichage, en gardant l'ordre de parcours. */
export function aplatir(noeud: NoeudArbre): NoeudArbre[] {
  return [noeud, ...noeud.enfants.flatMap(aplatir)];
}

// ── Remonter à la source ──────────────────────────────────────────────────

export interface CheminVersSource {
  /** De l'asset donné jusqu'à la racine, racine EN DERNIER. */
  chaine: AssetDerivable[];
  racine: AssetDerivable;
  /**
   * Seconde d'origine DANS LA RACINE — la somme des offsets du chemin.
   * `null` si un maillon ne porte pas d'offset : mieux vaut ne rien dire que
   * donner une position fausse.
   */
  secondeDansLaRacine: number | null;
}

/**
 * Remonte d'un asset jusqu'à sa racine — le critère « depuis un short, on
 * remonte à l'épisode ET à la seconde d'origine ».
 *
 * 🔴 Les offsets s'ADDITIONNENT. Un short à 12 min 30 d'un extrait qui
 * commençait à 40 min de l'épisode est à 52 min 30 de l'épisode. Lire le
 * dernier offset donnerait 12 min 30, et enverrait le monteur au mauvais
 * endroit d'un fichier de 58 minutes.
 */
export function remonterALaSource(
  assets: readonly AssetDerivable[],
  assetId: string,
): CheminVersSource | null {
  const parId = new Map(assets.map((a) => [a.id, a]));
  const depart = parId.get(assetId);
  if (!depart) return null;

  const chaine: AssetDerivable[] = [depart];
  let cumul: number | null = 0;
  let courant = depart;
  const vus = new Set<string>([depart.id]);

  while (courant.parentId) {
    const parent = parId.get(courant.parentId);
    if (!parent || vus.has(parent.id)) break; // parent hors lot, ou cycle
    // L'offset de `courant` est sa position DANS `parent` : on l'ajoute en
    // montant.
    if (cumul !== null) {
      cumul = courant.offsetSourceSec === null ? null : cumul + courant.offsetSourceSec;
    }
    chaine.push(parent);
    vus.add(parent.id);
    courant = parent;
  }

  return {
    chaine,
    racine: chaine[chaine.length - 1] as AssetDerivable,
    secondeDansLaRacine: chaine.length > 1 ? cumul : null,
  };
}

/** `3750` → `1 h 02 min 30 s`. Pour un monteur, pas pour une machine. */
export function formaterSeconde(secondes: number): string {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = Math.floor(secondes % 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min ${String(s).padStart(2, "0")} s`;
  return `${m} min ${String(s).padStart(2, "0")} s`;
}

// ── Les recettes ──────────────────────────────────────────────────────────

export interface LigneRecette {
  familleId: string;
  familleNom: string;
  quantite: number;
  compteId: string | null;
  note: string | null;
}

export interface DeriveAProduire {
  libelle: string;
  familleId: string;
  compteId: string | null;
  nature: "derive";
  statut: "a_produire";
  /** Rang dans la quantité demandée, pour numéroter les libellés. */
  rang: number;
}

/**
 * Ce qu'une recette doit produire depuis un asset source — critère 1 du lot 2.
 *
 * > « Un asset enregistré avec une recette crée automatiquement ses dérivés
 * >   en `a_produire`. »
 *
 * `a_produire` et non `pret` : la recette dit ce qu'il FAUDRA faire, pas ce
 * qui est fait. Les créer « prêts » ferait disparaître le travail à faire des
 * files et des alertes — exactement l'inverse du but.
 */
export function derivesDeRecette(
  libelleSource: string,
  lignes: readonly LigneRecette[],
): DeriveAProduire[] {
  const sortie: DeriveAProduire[] = [];
  for (const ligne of lignes) {
    // Une quantité absurde viderait la médiathèque de sens : on borne, et le
    // plafond est assez haut pour les 32 shorts d'un épisode.
    const quantite = Math.max(0, Math.min(ligne.quantite, 100));
    for (let i = 0; i < quantite; i += 1) {
      sortie.push({
        libelle:
          quantite > 1
            ? `${libelleSource} — ${ligne.familleNom} ${i + 1}/${quantite}`
            : `${libelleSource} — ${ligne.familleNom}`,
        familleId: ligne.familleId,
        compteId: ligne.compteId,
        nature: "derive",
        statut: "a_produire",
        rang: i,
      });
    }
  }
  return sortie;
}

// ── Les deux gardes du lot 2 ──────────────────────────────────────────────

export interface Verdict {
  autorise: boolean;
  /** Message citant la règle. Vide si autorisé. */
  message: string;
}

/**
 * Une publication peut-elle passer à `programme` ? — critère 4 du lot 2.
 *
 * > « Un épisode dont l'autorisation n'est pas `signee` NE PEUT PAS passer
 * >   une publication à `programme`. »
 *
 * C'est une règle de DROIT, pas d'agenda : diffuser l'image d'un invité sans
 * autorisation signée est une faute. Une autorisation « envoyée » ne vaut pas
 * consentement — c'est même le cas le plus dangereux, parce qu'il ressemble à
 * un accord.
 *
 * ⚠️ Une autorisation EXPIRÉE bloque aussi. La cession de droits a une fin
 * (`valableJusquA`), et une publication programmée après cette date diffuse
 * sans droit.
 */
export function peutProgrammer(
  autorisations: readonly {
    inviteNom: string;
    statut: string;
    valableJusquA: Date | null;
  }[],
  dateDiffusion: Date,
): Verdict {
  for (const a of autorisations) {
    if (a.statut !== "signee") {
      return {
        autorise: false,
        message:
          `Programmation refusée : l'autorisation de ${a.inviteNom} est au statut ` +
          `« ${a.statut} », et non « signee ». Diffuser l'image d'un invité sans ` +
          `autorisation signée est une faute de droit — une autorisation envoyée ` +
          `ne vaut pas consentement.`,
      };
    }
    if (a.valableJusquA && dateDiffusion > a.valableJusquA) {
      return {
        autorise: false,
        message:
          `Programmation refusée : la cession de droits de ${a.inviteNom} expire le ` +
          `${a.valableJusquA.toISOString().slice(0, 10)}, avant la date de diffusion. ` +
          `Faites renouveler l'autorisation.`,
      };
    }
  }
  return { autorise: true, message: "" };
}

/**
 * Un asset peut-il passer à `pret` ? — critère 5 du lot 2.
 *
 * > « Un asset dont la durée dépasse la spec de sa plateforme ne passe pas à
 * >   `pret`. »
 *
 * Le §7 du lot 2 précise même « dépasse de DEUX SECONDES » dans la passe
 * adversariale : la borne est stricte, pas indicative.
 *
 * ⚠️ Une durée INCONNUE ne bloque pas — mais elle ne vaut pas conformité non
 * plus, et le verdict le dit. Sans `ffprobe`, une vidéo déposée n'a pas de
 * durée : bloquer tous les assets vidéo rendrait la fonction inutilisable,
 * et les déclarer conformes serait mentir.
 */
export function peutPasserPret(
  asset: { libelle: string; dureeSec: number | null },
  spec: { dureeMinSec: number | null; dureeMaxSec: number | null; plateforme: string } | null,
): Verdict & { indetermine?: boolean } {
  if (!spec) return { autorise: true, message: "" };

  if (asset.dureeSec === null) {
    return {
      autorise: true,
      indetermine: true,
      message:
        `Durée inconnue pour « ${asset.libelle} » : la spec ${spec.plateforme} n'a pas pu ` +
        `être vérifiée. Renseignez la durée pour que le contrôle s'applique.`,
    };
  }

  if (spec.dureeMaxSec !== null && asset.dureeSec > spec.dureeMaxSec) {
    return {
      autorise: false,
      message:
        `« ${asset.libelle} » dure ${formaterSeconde(asset.dureeSec)} pour un maximum de ` +
        `${formaterSeconde(spec.dureeMaxSec)} sur ${spec.plateforme}. ` +
        `Recoupez avant de le passer à « prêt » : hors spec, il sera recadré ou refusé à l'envoi.`,
    };
  }

  if (spec.dureeMinSec !== null && asset.dureeSec < spec.dureeMinSec) {
    return {
      autorise: false,
      message:
        `« ${asset.libelle} » dure ${formaterSeconde(asset.dureeSec)} pour un minimum de ` +
        `${formaterSeconde(spec.dureeMinSec)} sur ${spec.plateforme}.`,
    };
  }

  return { autorise: true, message: "" };
}
