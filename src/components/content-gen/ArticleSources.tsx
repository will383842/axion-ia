import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import type { Locale } from "@/i18n/routing";
import {
  computeTrustTier,
  extractDomain,
  relAttrForExternalLink,
} from "@/server/content-gen/links/trust-tier";

export interface ArticleSourceItem {
  readonly name: string;
  readonly url: string;
}

interface ArticleSourcesProps {
  readonly items: ReadonlyArray<ArticleSourceItem>;
  readonly locale: Locale;
  /**
   * Date à laquelle les LIENS ci-dessous ont été réellement re-vérifiés.
   *
   * 🔴 GEO-071 (audit GEO/AEO 2026-08-14) — NE PAS y passer la date de
   * modification de l'article. C'est ce qui se faisait : les trois pages
   * appelantes transmettaient `updatedAt`, et le composant l'affichait sous
   * l'étiquette « Dernière vérification ». On affirmait donc au lecteur ET aux
   * moteurs que les sources avaient été contrôlées ce jour-là, alors que
   * personne ne les avait ouvertes. Une affirmation E-E-A-T fabriquée est pire
   * qu'une absence : elle se donne pour une preuve.
   *
   * Tant qu'aucun processus ne produit cette date (le moniteur de fraîcheur des
   * liens écrit dans un système de fichiers éphémère — GEO-070, non corrigé), la
   * prop reste VIDE et la ligne ne s'affiche pas. La date de l'article, elle,
   * est déjà rendue ailleurs sur la page.
   */
  readonly lastVerified?: string | null;
}

/**
 * Caractères qui ne peuvent pas apparaître dans une URL qu'on sert : backtick
 * (séquelle de génération LLM), espaces, guillemets, chevrons. `new URL()` les
 * tolère pour certains ; nous non.
 */
const CARACTERES_INTERDITS = /[`\s"'<>]/;

/** Une URL est servable si elle est analysable, en http(s), et sans caractère interdit. */
export function estUrlServable(url: string | null | undefined): boolean {
  const brut = url?.trim() ?? "";
  if (brut.length === 0 || CARACTERES_INTERDITS.test(brut)) return false;
  try {
    const u = new URL(brut);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Brique partagée — Sources & méthodologie (chantier templates 2026-06-21).
 *
 * Rend la liste des sources citées (déjà chargées via ContentCitation /
 * `view.citations`, mais émises uniquement dans le JSON-LD jusqu'ici → invisibles
 * pour l'utilisateur et pour l'extraction LLM par bloc). Liens en `nofollow`
 * (E-E-A-T : on cite sans transmettre d'autorité) + date « dernière vérification ».
 *
 * Composant serveur, 0 JS, hauteur réservée (CLS = 0).
 */
export function ArticleSources({ items, locale, lastVerified }: ArticleSourcesProps) {
  if (!items || items.length === 0) return null;
  // Refonte AEO 2026-06-22 — ne garder que les sources avec une URL http(s)
  // valide ET un libellé non vide. Évite un bloc « Sources » contenant des
  // entrées cassées (lien mort / titre absent). 0 item valide → pas de bloc.
  //
  // 🔴 DURCI 2026-08-16 (audit GEO/AEO, GEO-010) — le test d'origine ne portait
  // que sur le PRÉFIXE : `/^https?:\/\//` accepte n'importe quoi derrière, y
  // compris une URL terminée par une backtick (séquelle de génération) ou
  // contenant une espace. Ces URLs franchissaient le filtre et étaient servies
  // telles quelles dans le HTML **et** dans le `CreativeWork` du JSON-LD : on
  // publiait une citation qui ne mène nulle part, sous une étiquette de source.
  //
  // Deux barrières désormais : le constructeur `URL` (qui refuse ce qui n'est
  // pas analysable) et un rejet explicite des caractères qui n'ont rien à faire
  // dans une URL servie. `URL` seul ne suffit pas — il tolère la backtick.
  const validItems = items.filter((s) => estUrlServable(s.url) && (s.name?.trim().length ?? 0) > 0);
  if (validItems.length === 0) return null;
  const isFr = locale === "fr";

  return (
    <Section>
      <Container className="max-w-[52rem]">
        <h2 className="text-fg inline-flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
          <span aria-hidden="true" className="bg-terracotta h-5 w-1 rounded-full" />
          {isFr ? "Sources & méthodologie" : "Sources & methodology"}
        </h2>
        {/* Liens externes en blocs : nom + domaine + icône (hover). Numéro en
            pastille terracotta. rel dérivé du trust-tier (dofollow autorités). */}
        <ol className="mt-6 grid gap-3 md:grid-cols-2">
          {validItems.map((source, i) => {
            const domain = extractDomain(source.url);
            const rel = relAttrForExternalLink(domain ? computeTrustTier(domain) : "standard");
            return (
              <li key={i}>
                <a
                  href={source.url}
                  target="_blank"
                  rel={rel}
                  className="group border-border bg-paper hover:border-border-strong hover:shadow-subtle flex h-full items-start gap-3 rounded-xl border p-3.5 transition"
                >
                  <span
                    aria-hidden="true"
                    className="bg-terracotta-soft text-terracotta-deep inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-fg group-hover:text-terracotta-deep block text-sm leading-snug font-medium break-words transition-colors">
                      {source.name.trim().length > 0 ? source.name : source.url}
                    </span>
                    {domain ? (
                      <span className="text-fg-muted mt-0.5 block truncate text-xs">{domain}</span>
                    ) : null}
                  </span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-fg-muted group-hover:text-terracotta-deep mt-0.5 h-4 w-4 shrink-0 transition-colors"
                  >
                    <path d="M7 17 17 7M9 7h8v8" />
                  </svg>
                </a>
              </li>
            );
          })}
        </ol>
        {lastVerified ? (
          <p className="text-fg-muted mt-4 text-sm">
            {isFr ? "Dernière vérification : " : "Last verified: "}
            <time dateTime={lastVerified} className="tabular-nums">
              {lastVerified}
            </time>
          </p>
        ) : null}
      </Container>
    </Section>
  );
}
