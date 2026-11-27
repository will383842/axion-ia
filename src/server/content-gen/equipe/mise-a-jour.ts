/**
 * Mode « mise à jour » de l'équipe éditoriale (PR 16), derrière `CONTENT_EQUIPE_EDITORIALE`.
 *
 * Pour un article ancien désigné par les règles du suivi après publication (PR 14) :
 *  1. même URL (slug inchangé) et même mot-clé principal, sinon REFUS ;
 *  2. quota `equipe_maj_max_jour` (1 par jour à défaut) ;
 *  3. le gardien confirme qu'il s'agit bien de cet article ;
 *  4. le vérificateur refait la phase B sur tout le texte ;
 *  5. le rédacteur ne réécrit que les sections concernées ;
 *  6. la conformité est rejouée sur le texte FINAL ;
 *  7. le rédacteur en chef tranche.
 *
 * `dateModifiee` n'est transmise à `enregistrer` que si le HTML a réellement changé
 * (comparaison hors espaces) : jamais de date seule. Interrupteur éteint : aucun appel.
 * Toutes les dépendances sont injectées : aucun accès base, réseau ni Redis ici.
 */

import {
  equipeEditorialeActive,
  type EnvEquipeEditoriale,
} from "../fact-check/equipe-editoriale-drapeau";
import { decisionRythmeEquipe, type RythmeEquipe } from "../scheduler/anti-burst";
import { normaliserRequete, normaliserUrl } from "../strategie/carte-requetes";
import type { Brief } from "./brief";
import type { DecisionGardien } from "./gardien";
import { PLAFOND_COUT_ARTICLE_USD, type DecisionEnChef } from "./redacteur-en-chef";

export interface ArticleExistant {
  readonly id: string;
  readonly slug: string;
  readonly motCle: string;
  readonly html: string;
}

export interface DemandeMiseAJour {
  readonly article: ArticleExistant;
  /** Slug que la demande voudrait publier ; absent = inchangé. */
  readonly slugDemande?: string | undefined;
  /** Brief de type « mise-a-jour » : `motCle` et `urlCible` sont ceux de l'article. */
  readonly brief: Brief;
  readonly raisons: ReadonlyArray<string>;
}

export interface SectionAReecrire {
  readonly indice: number;
  readonly html: string;
}

export interface DependancesMiseAJour {
  readonly env?: EnvEquipeEditoriale;
  readonly maintenant: Date;
  readonly rythme?: RythmeEquipe | null | undefined;
  /** Mises à jour déjà faites aujourd'hui. */
  readonly majAujourdhui: () => Promise<number>;
  /** Compte une mise à jour (appelée une fois les contrôles gratuits passés). */
  readonly consommerQuota: () => Promise<void>;
  readonly gardien: (brief: Brief) => Promise<DecisionGardien>;
  /** Phase B sur tout le texte : phrases à retirer. */
  readonly verifier: (
    html: string,
    motCle: string,
  ) => Promise<{ readonly aRetirer: ReadonlyArray<string>; readonly coutUsd: number }>;
  /** Rend une version de chaque section demandée, dans le même ordre. */
  readonly reecrire: (a: {
    readonly sections: ReadonlyArray<SectionAReecrire>;
    readonly aRetirer: ReadonlyArray<string>;
    readonly raisons: ReadonlyArray<string>;
  }) => Promise<{ readonly sections: ReadonlyArray<string>; readonly coutUsd: number }>;
  /** Conformité rejouée sur le texte final. */
  readonly conformite: (html: string) => Promise<{
    readonly decision: string;
    readonly constats?: ReadonlyArray<{ libelle: string }>;
  }>;
  readonly enChef: (
    html: string,
    coutDepenseUsd: number,
  ) => Promise<{ readonly decision: DecisionEnChef; readonly coutUsd: number }>;
  /** Écrit le corps ET `dateModifiee`. Jamais appelée si le contenu est identique. */
  readonly enregistrer: (a: {
    readonly articleId: string;
    readonly html: string;
    readonly dateModifiee: Date;
  }) => Promise<void>;
}

export type StatutMiseAJour =
  "desactive" | "refuse" | "quota" | "inchange" | "relecture-humaine" | "mis-a-jour";

export interface ResultatMiseAJour {
  readonly statut: StatutMiseAJour;
  readonly slug: string;
  readonly raison?: string;
  readonly coutUsd: number;
}

/** Vrai si les deux HTML ne diffèrent que par les espaces (y compris insécables). */
export function htmlIdentique(a: string, b: string): boolean {
  const n = (h: string) => h.replace(/[\s  ]+/g, "");
  return n(a) === n(b);
}

/** Introduction (avant le premier h2), puis un morceau par h2. Leur concaténation = le HTML. */
export function decouperSections(html: string): string[] {
  const morceaux = html.split(/(?=<h2[\s>])/i);
  return morceaux.filter((m) => m !== "");
}

const sansBalises = (h: string) =>
  h
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const titreH2 = (section: string): string | null => {
  const m = /^<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(section.trimStart());
  return m ? sansBalises(m[1] ?? "").toLowerCase() : null;
};

const fin = (
  statut: StatutMiseAJour,
  slug: string,
  coutUsd: number,
  raison?: string,
): ResultatMiseAJour => ({ statut, slug, coutUsd, ...(raison ? { raison } : {}) });

export async function executerMiseAJour(
  d: DemandeMiseAJour,
  deps: DependancesMiseAJour,
): Promise<ResultatMiseAJour> {
  const { article } = d;
  const slug = article.slug;
  if (!equipeEditorialeActive(deps.env ?? process.env)) {
    return fin("desactive", slug, 0, "Équipe éditoriale éteinte.");
  }

  // 1. Même URL, même mot-clé principal : vérifié en code avant tout appel.
  if (d.slugDemande !== undefined && d.slugDemande !== slug) {
    return fin("refuse", slug, 0, "Le slug ne doit pas changer lors d'une mise à jour.");
  }
  if (normaliserRequete(d.brief.motCle) !== normaliserRequete(article.motCle)) {
    return fin("refuse", slug, 0, "Le mot-clé principal ne doit pas changer.");
  }
  if (!normaliserUrl(d.brief.urlCible).endsWith(`/${slug}`)) {
    return fin("refuse", slug, 0, "L'URL cible du brief n'est pas celle de l'article.");
  }

  // 2. Quota du jour.
  let deja: number;
  try {
    deja = await deps.majAujourdhui();
  } catch {
    return fin("relecture-humaine", slug, 0, "Compteur du jour illisible.");
  }
  const rythme = decisionRythmeEquipe({
    nature: "maj",
    creesAujourdhui: deja,
    rythme: deps.rythme,
    ...(deps.env ? { env: deps.env } : {}),
  });
  if (!rythme.autorise) return fin("quota", slug, 0, rythme.raison ?? "Quota du jour atteint.");

  // 3. Gardien : il doit s'agir de cet article, pas d'un doublon ni d'un autre propriétaire.
  try {
    const g = await deps.gardien(d.brief);
    const memeUrl =
      g.decision === "mettre_a_jour" &&
      g.article.url !== undefined &&
      normaliserUrl(g.article.url) === normaliserUrl(d.brief.urlCible);
    if (g.decision !== "feu_vert" && g.decision !== "reorienter" && !memeUrl) {
      return fin("refuse", slug, 0, `Gardien : ${g.decision} — ${g.raison}`);
    }
  } catch (e) {
    return fin("relecture-humaine", slug, 0, `Gardien en erreur : ${(e as Error).message}`);
  }

  await deps.consommerQuota();
  let cout = 0;
  const plafond = (): boolean => cout >= PLAFOND_COUT_ARTICLE_USD;

  try {
    // 4. Phase B sur tout le texte.
    const v = await deps.verifier(article.html, article.motCle);
    cout += v.coutUsd;
    if (v.aRetirer.length === 0) return fin("inchange", slug, cout, "Rien à corriger.");
    if (plafond()) return fin("relecture-humaine", slug, cout, "Plafond de coût atteint.");

    // 5. Le rédacteur ne reçoit que les sections concernées.
    const sections = decouperSections(article.html);
    const cibles = new Set<number>();
    for (const phrase of v.aRetirer) {
      const p = sansBalises(phrase);
      if (!p) continue;
      sections.forEach((s, i) => {
        if (sansBalises(s).includes(p)) cibles.add(i);
      });
    }
    if (cibles.size === 0) {
      return fin("relecture-humaine", slug, cout, "Phrases à retirer introuvables dans le texte.");
    }
    const indices = [...cibles].sort((a, b) => a - b);
    const r = await deps.reecrire({
      sections: indices.map((i) => ({ indice: i, html: sections[i]! })),
      aRetirer: v.aRetirer,
      raisons: d.raisons,
    });
    cout += r.coutUsd;
    if (r.sections.length !== indices.length) {
      return fin("relecture-humaine", slug, cout, "Réécriture incomplète.");
    }
    const finales = [...sections];
    for (const [k, i] of indices.entries()) {
      const neuve = r.sections[k]!;
      if (titreH2(neuve) !== titreH2(sections[i]!)) {
        return fin("relecture-humaine", slug, cout, "Le titre d'une section a changé.");
      }
      finales[i] = neuve;
    }
    const final = finales.join("");

    // Aucun changement réel : ni écriture ni date.
    if (htmlIdentique(final, article.html))
      return fin("inchange", slug, cout, "Contenu identique.");

    // 6. Conformité sur le texte final.
    const c = await deps.conformite(final);
    if (c.decision !== "publier") {
      return fin(
        "relecture-humaine",
        slug,
        cout,
        `Conformité : ${(c.constats ?? []).map((x) => x.libelle).join(" | ") || c.decision}`,
      );
    }

    // 7. Le rédacteur en chef tranche.
    const chef = await deps.enChef(final, cout);
    cout += chef.coutUsd;
    if (chef.decision.type !== "publier") {
      return fin("relecture-humaine", slug, cout, `Rédacteur en chef : ${chef.decision.type}`);
    }

    await deps.enregistrer({ articleId: article.id, html: final, dateModifiee: deps.maintenant });
    return fin("mis-a-jour", slug, cout);
  } catch (e) {
    return fin("relecture-humaine", slug, cout, `Erreur : ${(e as Error).message}`);
  }
}
