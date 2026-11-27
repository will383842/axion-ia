/**
 * Adaptateurs de l'équipe éditoriale sur la sortie du générateur (PR 12) : mailleur, éditeur SEO,
 * conformité et rédacteur en chef appliqués à un `GeneratorOutput`. Aucune dépendance base ni
 * Redis : le worker injecte ce qui touche l'infrastructure. Éteint, rien n'est appelé d'ici.
 */

import type { GeneratorOutput } from "../generators/types";
import { texteSansBalises } from "../quality/passages-citables";
import { controlerConformite, type ResultatConformite } from "./conformite";
import type { DependancesFideliteLlm } from "../fact-check/fidelite-llm";
import { editerSeo, type DependancesEditionSeo } from "./edition-seo";
import { filtrerLiensMaillage, type LienControle, type OptionsLienExterne } from "./maillage";
import { redacteurEnChef, type DependancesEnChef, type SortieEnChef } from "./redacteur-en-chef";
import { chiffresHorsDossier } from "./redaction";
import type { DossierPreuves } from "../fact-check/verificateur-deux-phases";
import type { Brief } from "./brief";
import type { DecisionGardien } from "./gardien";
import type { RapportRole } from "./orchestration";
import type { ContenuARelire } from "../quality/relecture-journee-ia";

const MOTIF_LIEN = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;

/** URLs (internes `/…` et externes `https://…`) des liens du corps. */
export function liensDuCorps(html: string): string[] {
  const urls = new Set<string>();
  for (const m of html.matchAll(MOTIF_LIEN)) {
    const u = (m[1] ?? m[2] ?? "").trim();
    if (u.startsWith("/") || u.startsWith("https://") || u.startsWith("http://")) urls.add(u);
  }
  return [...urls];
}

/** Retire la balise `<a>` des liens refusés, en gardant le texte. */
export function retirerLiens(html: string, refuses: ReadonlySet<string>): string {
  if (refuses.size === 0) return html;
  return html.replace(
    MOTIF_LIEN,
    (tout, d: string | undefined, s: string | undefined, t: string) =>
      refuses.has((d ?? s ?? "").trim()) ? t : tout,
  );
}

export async function mailler(
  o: GeneratorOutput,
  options: OptionsLienExterne = {},
): Promise<RapportRole<GeneratorOutput> & { readonly liens: ReadonlyArray<LienControle> }> {
  const liens = await filtrerLiensMaillage(
    liensDuCorps(o.bodyHtml).map((url) => ({ url })),
    options,
  );
  const refuses = new Set(liens.filter((l) => !l.verdict.ok).map((l) => l.url));
  if (refuses.size === 0) {
    return { output: o, decision: `${liens.length} lien(s) conforme(s)`, liens };
  }
  const bodyHtml = retirerLiens(o.bodyHtml, refuses);
  return {
    output: {
      ...o,
      bodyHtml,
      citations: o.citations.filter((c) => !refuses.has(c.url)),
    },
    decision: `${refuses.size} lien(s) retiré(s) sur ${liens.length}`,
    detail: [...refuses].slice(0, 5).join(" | "),
    // Les liens retirés ne comptent plus : le rapport décrit le texte rendu.
    liens: liens.map((l) => (refuses.has(l.url) ? { ...l, verdict: { ok: true } } : l)),
  };
}

export async function editerSeoSortie(
  jobId: string,
  o: GeneratorOutput,
  brief: Pick<Brief, "motCle" | "entites">,
  deps: DependancesEditionSeo = {},
): Promise<RapportRole<GeneratorOutput>> {
  const res = await editerSeo(
    {
      jobId,
      brief: { motCle: brief.motCle, entites: brief.entites },
      article: {
        metaTitre: o.metaTitle,
        metaDescription: o.metaDescription,
        h1: o.title,
        corpsHtml: o.bodyHtml,
        faq: o.faq.map((f) => ({ q: f.question, a: f.answer })),
      },
    },
    deps,
  );
  if (res.statut !== "corrige") {
    return {
      output: o,
      decision: res.statut,
      ...(res.statut === "echec" ? { detail: res.raison } : {}),
    };
  }
  const a = res.article;
  return {
    output: {
      ...o,
      metaTitle: a.metaTitre,
      metaDescription: a.metaDescription,
      title: a.h1,
      bodyHtml: a.corpsHtml,
      bodyText: texteSansBalises(a.corpsHtml),
    },
    decision: `corrige (${res.appliques.length} remplacement(s), ${res.refuses.length} refusé(s))`,
    coutUsd: res.coutUsd,
  };
}

export function conformiteSortie(
  jobId: string,
  contentType: string,
  o: GeneratorOutput,
  deps: DependancesFideliteLlm,
  options: { readonly financementPublicAutorise?: boolean } = {},
): Promise<ResultatConformite> {
  return controlerConformite(
    {
      jobId,
      contentType,
      output: o,
      kbEntryIds: o.kbEntryIds,
      ...(options.financementPublicAutorise !== undefined
        ? { financementPublicAutorise: options.financementPublicAutorise }
        : {}),
    },
    deps,
  );
}

export interface ContexteEnChefSortie {
  readonly jobId: string;
  readonly contentType: string;
  readonly brief: Pick<Brief, "motCle" | "entites" | "questions">;
  readonly dossier?: DossierPreuves | undefined;
  readonly gardien?: DecisionGardien | undefined;
  readonly liens: ReadonlyArray<LienControle>;
  readonly conformite: ResultatConformite;
  readonly renvoisFaits: number;
  readonly coutDepenseUsd: number;
  readonly journeeIA: ContenuARelire;
  readonly deps?: DependancesEnChef;
}

export function enChefSortie(o: GeneratorOutput, c: ContexteEnChefSortie): Promise<SortieEnChef> {
  return redacteurEnChef(
    {
      html: o.bodyHtml,
      h1: o.title,
      brief: c.brief,
      faq: o.faq.map((f) => ({ q: f.question, a: f.answer })),
      conformite: c.conformite,
      chiffresHorsDossier: chiffresHorsDossier(o.bodyHtml, c.dossier),
      gardien: c.gardien,
      liens: c.liens,
      kbEntryIds: o.kbEntryIds,
      contentType: c.contentType,
      article: {
        jobId: c.jobId,
        title: o.title,
        metaTitle: o.metaTitle,
        metaDescription: o.metaDescription,
        bodyHtml: o.bodyHtml,
        bodyText: o.bodyText,
        faq: o.faq.map((f) => ({ question: f.question, answer: f.answer })),
        primaryKeyword: c.brief.motCle,
        contentType: c.contentType,
      },
      renvoisFaits: c.renvoisFaits,
      coutDepenseUsd: c.coutDepenseUsd,
      journeeIA: c.journeeIA,
    },
    c.deps ?? {},
  );
}

/** Consigne de reprise envoyée au rédacteur lors d'un renvoi (passages exacts à corriger). */
export function consigneRenvoi(
  renvois: ReadonlyArray<{
    readonly role: string;
    readonly criteres: ReadonlyArray<string>;
    readonly passages: ReadonlyArray<string>;
    readonly chiffresASourcer?: ReadonlyArray<string> | undefined;
  }>,
): string {
  return renvois
    .map((r) =>
      [
        `Renvoi du rédacteur en chef (${r.role}) — critères ${r.criteres.join(", ")}.`,
        ...r.passages.slice(0, 10).map((p) => `- À corriger : « ${p.slice(0, 300)} »`),
        ...(r.chiffresASourcer ?? [])
          .slice(0, 10)
          .map(
            (p) => `- Chiffre à retirer ou à sourcer (dossier de preuves) : « ${p.slice(0, 300)} »`,
          ),
      ].join("\n"),
    )
    .join("\n");
}
