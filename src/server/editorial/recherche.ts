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
import { Prisma } from "../../../prisma/generated/client";

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
  const requete = Prisma.sql`plainto_tsquery('fr_unaccent', ${terme})`;

  const [publications, idees, assets, invites] = await Promise.all([
    prisma.$queryRaw<LigneBrute[]>`
      SELECT id::text AS id, titre_interne AS titre,
             coalesce(accroche, left(corps, 200)) AS extrait,
             ts_rank(search_vector, ${requete}) AS rang
      FROM ed_publications
      WHERE search_vector @@ ${requete} AND archivee_a IS NULL
      ORDER BY rang DESC LIMIT ${limite}
    `,
    prisma.$queryRaw<LigneBrute[]>`
      SELECT id::text AS id, titre, detail AS extrait,
             ts_rank(search_vector, ${requete}) AS rang
      FROM ed_idees
      WHERE search_vector @@ ${requete} AND statut <> 'archivee'
      ORDER BY rang DESC LIMIT ${limite}
    `,
    prisma.$queryRaw<LigneBrute[]>`
      SELECT id::text AS id, libelle AS titre,
             left(transcription, 200) AS extrait,
             ts_rank(search_vector, ${requete}) AS rang
      FROM ed_assets
      WHERE search_vector @@ ${requete}
      ORDER BY rang DESC LIMIT ${limite}
    `,
    prisma.$queryRaw<LigneBrute[]>`
      SELECT id::text AS id, nom AS titre, entreprise AS extrait,
             ts_rank(search_vector, ${requete}) AS rang
      FROM ed_invites
      WHERE search_vector @@ ${requete}
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
    } catch {
      // L'index existe mais la requête a échoué (configuration `fr_unaccent`
      // absente, par exemple) : on retombe plutôt que de rendre une erreur.
      indexDisponible = false;
    }
  }

  return {
    mode: "repli-contains",
    resultats: await chercherParContains(propre, limite),
    complete: true,
  };
}
