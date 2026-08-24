/**
 * Console éditoriale — le plan de production.
 *
 * Module PUR : reçoit des objets, rend du texte. Aucun accès base ni disque.
 *
 * ── Le besoin, tel qu'il a été posé ───────────────────────────────────────
 *
 * « Si je veux un jour préparer tous les montages, un autre jour tous les
 *   carrousels, un autre jour toutes les vidéos — est-ce facile d'exporter
 *   pour que je sache quoi faire pour chaque ? »
 *
 * Les exports existants ne savent pas répondre : ils sont centrés sur la
 * PUBLICATION — une ligne par post, un fichier par mois — et ne portent aucun
 * brief. Ce module est centré sur l'ASSET, groupé par type, et porte tout le
 * brief. C'est la différence entre « voilà ce qui part le 12 » et « voilà les
 * treize carrousels à fabriquer, avec leurs 114 slides ».
 *
 * ── Deux formats, deux usages ─────────────────────────────────────────────
 *
 * - **Markdown** : la feuille de route qu'on ouvre à côté de l'outil de
 *   fabrication. Elle se lit de haut en bas et se coche.
 * - **CSV** : une ligne par SEGMENT, pour un tableur de suivi. Une ligne par
 *   asset ne suffirait pas — c'est slide par slide qu'on avance.
 */

import { echapperCellule } from "./exports";

/** Un segment de brief, réduit à ce que le plan affiche. */
export interface SegmentPlan {
  ordre: number;
  role: string;
  titre: string | null;
  contenu: string | null;
  prompt: string | null;
  fait: boolean;
}

/** Un asset à produire, avec le contexte qui dit QUAND il doit être prêt. */
export interface AssetPlan {
  id: string;
  type: string;
  libelle: string;
  statut: string;
  /** La date du post qui l'attend — `null` si l'asset n'est lié à aucun. */
  datePost: string | null;
  heurePost: string | null;
  titrePost: string | null;
  segments: SegmentPlan[];
}

/** Les types d'assets, dans l'ordre où on les fabrique. */
export const TYPES_PLAN = ["video", "carrousel", "image", "photo", "audio", "document"] as const;
export type TypePlan = (typeof TYPES_PLAN)[number];

const LIBELLE_TYPE: Record<string, string> = {
  video: "Vidéos",
  carrousel: "Carrousels",
  image: "Images",
  photo: "Photos de Williams",
  audio: "Audio",
  document: "Documents",
};

const LIBELLE_ROLE: Record<string, string> = {
  script: "Script",
  prompt: "Prompt de génération",
  slide: "Slide",
  legende: "Légende du post",
  consigne: "Consigne",
};

/**
 * Trie les assets pour la production.
 *
 * Par type d'abord — c'est le geste de la journée —, puis par DATE du post.
 * L'ordre chronologique n'est pas cosmétique : produire dans le désordre fait
 * rater les échéances proches au profit de celles qui sont loin.
 *
 * Un asset sans date passe en dernier : il n'a pas d'échéance, il ne doit pas
 * s'intercaler entre deux qui en ont une.
 */
export function trierPourProduction(assets: readonly AssetPlan[]): AssetPlan[] {
  const rangType = new Map<string, number>(TYPES_PLAN.map((t, i) => [t, i]));
  return [...assets].sort((a, b) => {
    const ra = rangType.get(a.type) ?? 99;
    const rb = rangType.get(b.type) ?? 99;
    if (ra !== rb) return ra - rb;
    if (a.datePost === null && b.datePost === null) return a.libelle.localeCompare(b.libelle, "fr");
    if (a.datePost === null) return 1;
    if (b.datePost === null) return -1;
    if (a.datePost !== b.datePost) return a.datePost < b.datePost ? -1 : 1;
    return (a.heurePost ?? "").localeCompare(b.heurePost ?? "");
  });
}

/** `2026-09-05` → `05/09/2026`. Le format que lit un francophone. */
function dateFr(iso: string | null): string {
  if (!iso) return "sans date";
  const [a, m, j] = iso.split("-");
  return j && m && a ? `${j}/${m}/${a}` : iso;
}

/** Compte les segments faits — l'avancement, en clair. */
export function avancement(asset: AssetPlan): { faits: number; total: number } {
  return {
    faits: asset.segments.filter((s) => s.fait).length,
    total: asset.segments.length,
  };
}

/**
 * La feuille de route, en Markdown.
 *
 * ⚠️ Le prompt reste dans un bloc encadré, seul dans son bloc. Il se colle
 * tel quel dans un générateur : une espace avalée ou un retour à la ligne
 * perdu change l'image produite. Et il ne partage jamais son bloc avec le
 * texte de la slide — la règle du dossier est qu'un prompt ne contient AUCUN
 * texte à afficher, les générateurs déforment les lettres.
 */
export function construireMarkdown(
  assets: readonly AssetPlan[],
  contexte: { titre: string; periode: string },
): string {
  const tries = trierPourProduction(assets);
  const l: string[] = [];

  l.push(`# ${contexte.titre}`);
  l.push("");
  l.push(`> ${contexte.periode} · ${tries.length} asset(s) à produire.`);
  l.push("");

  if (tries.length === 0) {
    l.push("Rien à produire sur ce périmètre.");
    l.push("");
    return l.join("\n");
  }

  // Le sommaire : combien de quoi. C'est lui qui permet de décider « je fais
  // les carrousels aujourd'hui » AVANT d'avoir lu les cent pages qui suivent.
  l.push("| Type | Assets | Segments | Faits |");
  l.push("|---|---:|---:|---:|");
  for (const t of TYPES_PLAN) {
    const duType = tries.filter((a) => a.type === t);
    if (duType.length === 0) continue;
    const segments = duType.reduce((n, a) => n + a.segments.length, 0);
    const faits = duType.reduce((n, a) => n + avancement(a).faits, 0);
    l.push(`| ${LIBELLE_TYPE[t] ?? t} | ${duType.length} | ${segments} | ${faits} |`);
  }
  l.push("");

  let typeCourant = "";
  for (const a of tries) {
    if (a.type !== typeCourant) {
      typeCourant = a.type;
      l.push("---");
      l.push("");
      l.push(`# ${LIBELLE_TYPE[a.type] ?? a.type}`);
      l.push("");
    }

    const av = avancement(a);
    l.push(`## ${dateFr(a.datePost)}${a.heurePost ? ` ${a.heurePost}` : ""} — ${a.libelle}`);
    l.push("");
    if (a.titrePost) l.push(`*Post :* ${a.titrePost}`);
    l.push(`*Statut :* ${a.statut} · *Avancement :* ${av.faits} / ${av.total}`);
    l.push("");

    if (a.segments.length === 0) {
      l.push("> Aucun brief importé pour cet asset.");
      l.push("");
      continue;
    }

    for (const s of a.segments) {
      const coche = s.fait ? "[x]" : "[ ]";
      const role = LIBELLE_ROLE[s.role] ?? s.role;
      l.push(`### ${coche} ${role}${s.titre ? ` — ${s.titre}` : ""}`);
      l.push("");
      if (s.contenu) {
        l.push(s.contenu);
        l.push("");
      }
      if (s.prompt) {
        l.push(s.role === "slide" ? "**Graphisme :**" : "**Prompt — à coller tel quel :**");
        l.push("");
        l.push("```");
        l.push(s.prompt);
        l.push("```");
        l.push("");
      }
    }
  }

  return l.join("\n");
}

/**
 * Colonnes du CSV de production, dans l'ordre.
 *
 * 🔴 Une ligne par SEGMENT, pas par asset. Un carrousel de dix slides tient
 * sur dix lignes : c'est ce qui permet de cocher slide par slide dans un
 * tableur. Aplati sur une ligne, il n'y aurait rien à suivre.
 */
export const COLONNES_PLAN = [
  "date_post",
  "heure_post",
  "type",
  "asset",
  "statut_asset",
  "rang",
  "role",
  "titre",
  "contenu",
  "prompt",
  "fait",
  "titre_post",
] as const;

function cel(v: string | null | undefined): string {
  return echapperCellule(v ?? "");
}

export function construireCsvPlan(assets: readonly AssetPlan[]): string {
  const lignes: string[] = [COLONNES_PLAN.join(";")];

  for (const a of trierPourProduction(assets)) {
    // Un asset SANS brief produit tout de même sa ligne : sinon il
    // disparaîtrait du plan, et « rien à faire » se confondrait avec
    // « rien d'importé ». Ce sont deux situations opposées.
    const segments: SegmentPlan[] =
      a.segments.length > 0
        ? [...a.segments]
        : [{ ordre: 0, role: "", titre: null, contenu: null, prompt: null, fait: false }];

    for (const s of segments) {
      lignes.push(
        [
          cel(a.datePost),
          cel(a.heurePost),
          cel(a.type),
          cel(a.libelle),
          cel(a.statut),
          cel(String(s.ordre)),
          cel(s.role),
          cel(s.titre),
          cel(s.contenu),
          cel(s.prompt),
          cel(s.fait ? "oui" : "non"),
          cel(a.titrePost),
        ].join(";"),
      );
    }
  }

  // BOM + CRLF : c'est ce qui fait qu'Excel ouvre le fichier en UTF-8 sans
  // qu'on le lui demande. Même choix que l'export mensuel.
  return "﻿" + lignes.join("\r\n") + "\r\n";
}

/** Nom de fichier — lisible, triable, sans espace. */
export function nomFichierPlan(type: string, periode: string, extension: "md" | "csv"): string {
  const propre = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return `plan-production-${propre(type)}-${propre(periode)}.${extension}`;
}
