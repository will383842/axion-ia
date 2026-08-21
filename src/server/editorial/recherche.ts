/**
 * Console éditoriale — la recherche qui traverse tout (§2 bis B, critère 6).
 *
 * > « Un seul champ, qui traverse tout : publications, idées, assets,
 * >   invités. »
 *
 * ── 🔴 Le point qui décide de la robustesse de cette fonction ──────────────
 *
 * L'index `tsvector` vit dans `prisma/migrations_fts/editorial_fts.sql`, qui
 * s'applique **à la main** (`psql -f`) — c'est la convention du dépôt, et
 * `prisma migrate` ne le pose pas. Une recherche qui EXIGERAIT cet index
 * tomberait donc en panne sur toute base où le geste manuel a été oublié :
 * une machine de développement fraîche, un environnement de test, une
 * restauration.
 *
 * Cette recherche **détecte** la présence de l'index et retombe sinon sur un
 * `contains` insensible à la casse. Le repli est plus lent et moins pertinent
 * — ni pondération, ni insensibilité aux accents — mais il RÉPOND. Le mode
 * réellement utilisé est rendu à l'appelant, pour que l'écran puisse le dire
 * plutôt que de laisser croire à une recherche complète.
 */

import "server-only";
import { prisma } from "@/lib/prisma";

export type ModeRecherche = "plein-texte" | "repli-contains";

export interface ResultatRecherche {
  type: "publication" | "idee" | "asset" | "invite";
  id: string;
  titre: string;
  extrait: string | null;
  /** Pertinence, quand le mode plein texte la fournit. */
  rang: number | null;
}

export interface Recherche {
  mode: ModeRecherche;
  resultats: ResultatRecherche[];
  /** Vrai quand l'index existe mais que la requête n'a rien donné. */
  complete: boolean;
}

/**
 * Les colonnes `search_vector` existent-elles ?
 *
 * Mémorisé pour la durée du processus : la réponse ne change qu'au moment où
 * quelqu'un applique la migration, et interroger le catalogue à chaque frappe
 * coûterait un aller-retour pour rien.
 *
 * ⚠️ `null` = pas encore vérifié. Un `false` mémorisé après un échec resterait
 * faux jusqu'au redémarrage, ce qui est le comportement voulu : on ne veut
 * pas re-sonder le catalogue à chaque recherche d'une base sans index.
 */
let indexDisponible: boolean | null = null;

/**
 * La dernière requête plein texte a échoué, alors que l'index EXISTE.
 *
 * 🔴 Défaut trouvé par la passe 2 du protocole, et il était pire que la
 * panne qu'il masquait.
 *
 * Le `catch` du repli écrivait `indexDisponible = false` — c'est-à-dire
 * qu'il rangeait « la requête a échoué » sous « l'index n'est pas posé ».
 * L'écran affichait alors, sur une base qui a pourtant ses quatre colonnes
 * `search_vector` :
 *
 *   « l'index plein texte n'est pas posé sur cette base — appliquez
 *     prisma/migrations_fts/editorial_fts.sql »
 *
 * Un diagnostic FAUX envoie chercher pendant une heure du côté d'une
 * migration déjà appliquée. C'est exactement le §1 du protocole : « une
 * gate qui mesurait un fichier de configuration pendant que le conteneur
 * tournait avec une autre valeur ». Le repli, lui, était bon — c'est ce
 * qu'il RACONTAIT qui ne l'était pas.
 */
let echecRequete: string | null = null;

export async function indexPleinTexteDisponible(): Promise<boolean> {
  if (indexDisponible !== null) return indexDisponible;
  try {
    const lignes = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name = 'search_vector'
        AND table_name IN ('ed_publications', 'ed_idees', 'ed_assets', 'ed_invites')
    `;
    // Les quatre tables, ou rien : un index partiel donnerait des résultats
    // silencieusement incomplets, ce qui est pire qu'un repli assumé.
    indexDisponible = Number(lignes[0]?.n ?? 0) === 4;
  } catch {
    indexDisponible = false;
  }
  return indexDisponible;
}

/** Remet le cache à zéro — pour les tests, et après application de la migration. */
export function oublierEtatIndex(): void {
  indexDisponible = null;
  echecRequete = null;
}

/**
 * Pourquoi la recherche est retombée en mode simplifié, si elle l'a fait.
 *
 * `null` quand l'index est simplement absent — c'est un cas différent, et
 * l'écran ne doit pas les confondre.
 */
export function raisonDuRepli(): string | null {
  return echecRequete;
}

/** Coupe un texte pour l'affichage, sans couper un mot en deux. */
function extraitDe(texte: string | null, longueur = 160): string | null {
  if (!texte) return null;
  const propre = texte.replace(/\s+/g, " ").trim();
  if (propre.length <= longueur) return propre;
  const coupe = propre.slice(0, longueur);
  const dernierEspace = coupe.lastIndexOf(" ");
  return `${coupe.slice(0, dernierEspace > 40 ? dernierEspace : longueur)}…`;
}

// ── Le mode plein texte ───────────────────────────────────────────────────

interface LigneBrute {
  id: string;
  titre: string;
  extrait: string | null;
  rang: number;
}

async function chercherPleinTexte(terme: string, limite: number): Promise<ResultatRecherche[]> {
  // `plainto_tsquery` plutôt que `to_tsquery` : il accepte une saisie humaine
  // (« processus client ») sans exiger d'opérateurs, et ne lève jamais sur une
  // ponctuation malheureuse. `to_tsquery` aurait planté sur un « & » tapé.
  //
  // 🔴 L'appel est ÉCRIT DANS CHAQUE GABARIT, et surtout pas extrait dans un
  // fragment `Prisma.sql` réutilisé.
  //
  // Défaut trouvé par la passe 2 du protocole. Le fragment marchait hors
  // bundle — je l'ai revérifié : 44 résultats — et échouait sous Turbopack,
  // où l'instance `Sql` traverse une frontière de module et perd son
  // identité de classe. Le sérialiseur ne la reconnaissait plus comme du
  // SQL et la passait en PARAMÈTRE jsonb :
  //
  //     ERROR: function ts_rank(tsvector, jsonb) does not exist
  //
  // Le mode pondéré et désaccentué promis au §2 bis B n'a donc jamais
  // tourné en développement — sans que rien ne le dise, puisque le repli
  // rendait des résultats plausibles. Le terme reste un paramètre lié : on
  // duplique trois lignes de SQL, pas une faille d'injection.

  const [publications, idees, assets, invites] = await Promise.all([
    prisma.$queryRaw<LigneBrute[]>`
      SELECT id::text AS id, titre_interne AS titre,
             coalesce(accroche, left(corps, 200)) AS extrait,
             ts_rank(search_vector, plainto_tsquery('fr_unaccent', ${terme})) AS rang
      FROM ed_publications
      WHERE search_vector @@ plainto_tsquery('fr_unaccent', ${terme}) AND archivee_a IS NULL
      ORDER BY rang DESC LIMIT ${limite}
    `,
    prisma.$queryRaw<LigneBrute[]>`
      SELECT id::text AS id, titre, detail AS extrait,
             ts_rank(search_vector, plainto_tsquery('fr_unaccent', ${terme})) AS rang
      FROM ed_idees
      WHERE search_vector @@ plainto_tsquery('fr_unaccent', ${terme}) AND statut <> 'archivee'
      ORDER BY rang DESC LIMIT ${limite}
    `,
    prisma.$queryRaw<LigneBrute[]>`
      SELECT id::text AS id, libelle AS titre,
             left(transcription, 200) AS extrait,
             ts_rank(search_vector, plainto_tsquery('fr_unaccent', ${terme})) AS rang
      FROM ed_assets
      WHERE search_vector @@ plainto_tsquery('fr_unaccent', ${terme})
      ORDER BY rang DESC LIMIT ${limite}
    `,
    prisma.$queryRaw<LigneBrute[]>`
      SELECT id::text AS id, nom AS titre, entreprise AS extrait,
             ts_rank(search_vector, plainto_tsquery('fr_unaccent', ${terme})) AS rang
      FROM ed_invites
      WHERE search_vector @@ plainto_tsquery('fr_unaccent', ${terme})
      ORDER BY rang DESC LIMIT ${limite}
    `,
  ]);

  const assembler = (lignes: LigneBrute[], type: ResultatRecherche["type"]): ResultatRecherche[] =>
    lignes.map((l) => ({
      type,
      id: l.id,
      titre: l.titre,
      extrait: extraitDe(l.extrait),
      rang: Number(l.rang),
    }));

  return [
    ...assembler(publications, "publication"),
    ...assembler(idees, "idee"),
    ...assembler(assets, "asset"),
    ...assembler(invites, "invite"),
  ].sort((a, b) => (b.rang ?? 0) - (a.rang ?? 0));
}

// ── Le repli ──────────────────────────────────────────────────────────────

async function chercherParContains(terme: string, limite: number): Promise<ResultatRecherche[]> {
  const contient = { contains: terme, mode: "insensitive" as const };

  const [publications, idees, assets, invites] = await Promise.all([
    prisma.edPublication.findMany({
      where: {
        archiveeA: null,
        OR: [{ titreInterne: contient }, { accroche: contient }, { corps: contient }],
      },
      select: { id: true, titreInterne: true, accroche: true, corps: true },
      take: limite,
    }),
    prisma.edIdee.findMany({
      where: { statut: { not: "archivee" }, OR: [{ titre: contient }, { detail: contient }] },
      select: { id: true, titre: true, detail: true },
      take: limite,
    }),
    prisma.edAsset.findMany({
      where: { OR: [{ libelle: contient }, { transcription: contient }] },
      select: { id: true, libelle: true, transcription: true },
      take: limite,
    }),
    prisma.edInvite.findMany({
      where: { OR: [{ nom: contient }, { entreprise: contient }, { note: contient }] },
      select: { id: true, nom: true, entreprise: true },
      take: limite,
    }),
  ]);

  return [
    ...publications.map((p) => ({
      type: "publication" as const,
      id: p.id,
      titre: p.titreInterne,
      extrait: extraitDe(p.accroche ?? p.corps),
      rang: null,
    })),
    ...idees.map((i) => ({
      type: "idee" as const,
      id: i.id,
      titre: i.titre,
      extrait: extraitDe(i.detail),
      rang: null,
    })),
    ...assets.map((a) => ({
      type: "asset" as const,
      id: a.id,
      titre: a.libelle,
      extrait: extraitDe(a.transcription),
      rang: null,
    })),
    ...invites.map((i) => ({
      type: "invite" as const,
      id: i.id,
      titre: i.nom,
      extrait: extraitDe(i.entreprise),
      rang: null,
    })),
  ];
}

/**
 * Cherche partout.
 *
 * Rend le MODE réellement utilisé : l'écran doit pouvoir dire « recherche
 * simplifiée » plutôt que laisser croire à une recherche pondérée et
 * insensible aux accents qui n'a pas eu lieu.
 */
export async function chercher(terme: string, limite = 25): Promise<Recherche> {
  const propre = terme.trim();
  if (propre.length < 2) {
    // Une lettre seule rendrait la moitié du dossier : ce n'est pas une
    // recherche, c'est un listing déguisé.
    return { mode: "repli-contains", resultats: [], complete: true };
  }

  if (await indexPleinTexteDisponible()) {
    try {
      return {
        mode: "plein-texte",
        resultats: await chercherPleinTexte(propre, limite),
        complete: true,
      };
    } catch (e) {
      // L'index existe mais la requête a échoué. On retombe — mais on garde
      // `indexDisponible` à `true` : le confondre avec « index absent »
      // faisait afficher un diagnostic faux. Voir `echecRequete`.
      echecRequete =
        e instanceof Error ? (e.message.split("\n")[0] ?? "erreur inconnue") : "erreur inconnue";
    }
  }

  return {
    mode: "repli-contains",
    resultats: await chercherParContains(propre, limite),
    complete: true,
  };
}
