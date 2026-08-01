"use client";
// use-client: recherche temps réel + filtres par thème sur ~88 FAQ (interactivité).

// FaqHubExplorer — explorateur FAQ du hub /faq (perfection hub 2026-05-31).
// Rendu en SSR (la liste complète est dans le HTML initial → SEO/AEO préservés),
// puis hydraté pour le filtrage. Coût JS minimal : on ne charge côté client que
// {id, question, category, snippet} (pas les réponses complètes) → payload léger,
// conforme au budget Web Vitals.

import { Fragment, useId, useMemo, useState, type ReactNode } from "react";
import { Search, ArrowUpRight, X } from "lucide-react";
import { Container } from "@/components/layout/Container";

export interface FaqHubItem {
  readonly id: string;
  readonly question: string;
  /** Extrait court de la réponse (~110 car.) pour l'aperçu. */
  readonly snippet: string;
  readonly category: string;
}

export interface FaqHubCategory {
  readonly slug: string;
  readonly label: string;
}

interface Props {
  readonly items: ReadonlyArray<FaqHubItem>;
  readonly categories: ReadonlyArray<FaqHubCategory>;
  readonly locale: string;
  readonly isFr: boolean;
}

/** Normalise pour la recherche (minuscules, sans accents). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Surligne les occurrences de `query` (recherche brute, sensible aux accents)
 * dans `text`. Purement visuel : si le terme contient des accents absents du
 * texte (ou inversement), aucun <mark> n'est posé — le filtrage, lui, reste
 * accent-insensible via `norm()`. Coût négligeable (split sur chaîne courte).
 */
function highlight(text: string, query: string): ReactNode {
  const q = query.trim();
  if (q === "") return text;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  const parts = text.split(re);
  if (parts.length === 1) return text;
  // Avec un groupe capturant, les correspondances sont aux index impairs.
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="text-terracotta-deep bg-terracotta-soft/70 rounded px-0.5">
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/**
 * Compteur d'une puce de filtre — la classe dépend de l'état, parce que le fond
 * change.
 *
 * 🔴 Constaté par le job « A11y axe-core WCAG 2.2 AA vs prod » du 2026-08-01
 * (et des deux nuits précédentes) : le compteur portait `text-fg-muted` en dur,
 * y compris sur la puce active dont le fond passe en terracotta. Résultat
 * mesuré : le brun 5a4f44 sur le terracotta b23f16, soit **1,37:1** pour un
 * minimum AA de 4,5:1 sur
 * du 15 px. Le chiffre n'était pas « discret », il était invisible.
 *
 * Le blanc à 90 % sur terracotta donne 5,0:1 : conforme, tout en restant en
 * retrait du libellé qui, lui, est en blanc plein.
 */
const countOnCls = "text-white/90 tabular-nums";
const countOffCls = "text-fg-muted tabular-nums";

export function FaqHubExplorer({ items, categories, locale, isFr }: Props) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const searchId = useId();

  const nq = norm(query.trim());

  const filtered = useMemo(() => {
    return items.filter(
      (it) =>
        (!activeCat || it.category === activeCat) &&
        (nq === "" || norm(it.question).includes(nq) || norm(it.snippet).includes(nq)),
    );
  }, [items, activeCat, nq]);

  // Regroupement par catégorie, dans l'ordre des `categories`.
  const grouped = useMemo(() => {
    const byCat = new Map<string, FaqHubItem[]>();
    for (const it of filtered) {
      const arr = byCat.get(it.category);
      if (arr) arr.push(it);
      else byCat.set(it.category, [it]);
    }
    return categories
      .map((c) => ({ cat: c, list: byCat.get(c.slug) ?? [] }))
      .filter((g) => g.list.length > 0);
  }, [filtered, categories]);

  const countByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.category, (m.get(it.category) ?? 0) + 1);
    return m;
  }, [items]);

  return (
    <section
      aria-label={isFr ? "Explorer les questions" : "Explore questions"}
      className="py-12 sm:py-16"
    >
      <Container>
        {/* Barre de recherche + filtres — sticky « flottante » (CSS pur).
            top-20 dégage le header ; z-20 passe au-dessus des résultats.
            Centrée (max-w-3xl) ; les résultats en dessous prennent la pleine
            largeur (grille 3 colonnes) pour une lecture aérée (refonte 2026-07-06). */}
        <div className="border-border bg-paper/95 shadow-subtle sticky top-20 z-20 mx-auto max-w-3xl rounded-2xl border p-4 backdrop-blur-sm">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="text-fg-muted pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2"
              strokeWidth={2}
            />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isFr ? "Rechercher une question…" : "Search a question…"}
              aria-label={isFr ? "Rechercher dans la FAQ" : "Search the FAQ"}
              className="border-border bg-bg text-fg placeholder:text-fg-muted focus:border-terracotta focus:ring-terracotta/30 w-full rounded-xl border py-3.5 pr-11 pl-12 text-base transition outline-none focus:ring-2"
            />
            {query !== "" ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={isFr ? "Effacer" : "Clear"}
                className="text-fg-muted hover:text-fg absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 transition"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {/* Filtres par thème */}
          <div className="mt-3 flex flex-wrap gap-2">
            {/* Le compteur suit l'état de sa puce : sur fond terracotta il doit
                virer au blanc, sinon il tombe sous le seuil AA (cf. plus bas). */}
            <button
              type="button"
              onClick={() => setActiveCat(null)}
              aria-pressed={activeCat === null}
              className={
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition " +
                (activeCat === null
                  ? "border-terracotta bg-terracotta text-white"
                  : "border-border bg-bg text-fg-soft hover:border-terracotta/60")
              }
            >
              {isFr ? "Tout" : "All"}{" "}
              {/* Compteur : voir countOnCls / countOffCls — sur la puce active le
                  fond passe en terracotta, le brun d'origine y tombait à 1,37:1. */}
              <span className={activeCat === null ? countOnCls : countOffCls}>{items.length}</span>
            </button>
            {categories.map((c) => {
              const n = countByCat.get(c.slug) ?? 0;
              if (n === 0) return null;
              const on = activeCat === c.slug;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => setActiveCat(on ? null : c.slug)}
                  aria-pressed={on}
                  className={
                    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition " +
                    (on
                      ? "border-terracotta bg-terracotta text-white"
                      : "border-border bg-bg text-fg-soft hover:border-terracotta/60")
                  }
                >
                  {c.label} <span className={on ? countOnCls : countOffCls}>{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Compteur résultats */}
        <p
          className="text-fg-muted mx-auto mt-5 max-w-3xl text-sm"
          role="status"
          aria-live="polite"
        >
          {filtered.length}{" "}
          {isFr
            ? filtered.length > 1
              ? "questions"
              : "question"
            : filtered.length > 1
              ? "questions"
              : "question"}
          {nq !== "" || activeCat ? (isFr ? " trouvée(s)" : " found") : ""}
        </p>

        {/* Résultats groupés par thème */}
        {grouped.length === 0 ? (
          <div className="border-border mx-auto mt-6 max-w-3xl rounded-xl border border-dashed py-12 text-center">
            <p className="text-fg-soft">
              {isFr
                ? "Aucune question ne correspond. Essayez un autre mot-clé."
                : "No question matches. Try another keyword."}
            </p>
            <a
              href={`/${locale}/contact`}
              className="text-terracotta mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            >
              {isFr ? "Poser votre question" : "Ask your question"}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        ) : (
          <div className="mt-8 space-y-12">
            {grouped.map(({ cat, list }) => (
              <div key={cat.slug}>
                <div className="border-border mb-4 flex items-baseline justify-between gap-4 border-b pb-2">
                  <h2 className="text-fg flex items-center gap-2.5 text-lg font-semibold tracking-tight">
                    <span
                      aria-hidden="true"
                      className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
                    />
                    {cat.label}
                    <span className="text-fg-muted text-sm font-normal tabular-nums">
                      {list.length}
                    </span>
                  </h2>
                  <a
                    href={`/${locale}/faq/par-thematique/${cat.slug}`}
                    className="text-terracotta hover:text-terracotta-deep shrink-0 text-sm font-medium hover:underline"
                  >
                    {isFr ? "Voir le thème →" : "View topic →"}
                  </a>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((it) => (
                    <li key={it.id}>
                      <a
                        href={`/${locale}/faq/${it.id}`}
                        className="border-border bg-paper hover:border-terracotta/60 hover:shadow-subtle group flex h-full flex-col rounded-xl border p-4 transition"
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="text-fg group-hover:text-terracotta-deep min-w-0 text-base font-medium transition">
                            {highlight(it.question, query)}
                          </span>
                          <ArrowUpRight
                            className="text-fg-muted group-hover:text-terracotta mt-0.5 h-4 w-4 shrink-0 transition"
                            aria-hidden="true"
                          />
                        </span>
                        <span className="text-fg-soft mt-1.5 line-clamp-2 block text-sm leading-snug">
                          {highlight(it.snippet, query)}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
