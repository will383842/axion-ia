"use client";
// use-client: configurateur interactif (state des options, aperçu iframe live,
// copie presse-papier). Page outil non indexée — hors budget First Load des 15
// pages stratégiques.

import { useId, useState } from "react";
import type { OffersWidgetTheme, OffersWidgetVariant } from "./OffersWidget";

interface WidgetBuilderProps {
  locale: string;
  /** Origine absolue du site (ex. https://axion-ia.com) pour les snippets. */
  baseUrl: string;
  /** Villes sélectionnables (canoniques). Vide = sélecteur masqué. */
  cities: ReadonlyArray<string>;
}

type CopyKey = "iframe" | "script" | null;

const VARIANTS: { value: OffersWidgetVariant; fr: string; en: string }[] = [
  { value: "large", fr: "Cartes (large)", en: "Cards (large)" },
  { value: "compact", fr: "Liste (compact)", en: "List (compact)" },
];

const THEMES: { value: OffersWidgetTheme; fr: string; en: string }[] = [
  { value: "light", fr: "Clair", en: "Light" },
  { value: "dark", fr: "Sombre", en: "Dark" },
];

export function WidgetBuilder({ locale, baseUrl, cities }: WidgetBuilderProps) {
  const isFr = locale !== "en";
  const countId = useId();
  const cityId = useId();
  const [variant, setVariant] = useState<OffersWidgetVariant>("large");
  const [theme, setTheme] = useState<OffersWidgetTheme>("light");
  const [count, setCount] = useState(5);
  const [city, setCity] = useState(""); // "" = toutes les villes (France entière)
  const [copied, setCopied] = useState<CopyKey>(null);

  // `city` ajouté au query-string uniquement s'il est défini.
  const cityQs = city ? `&city=${encodeURIComponent(city)}` : "";
  const qs = `variant=${variant}&count=${count}&theme=${theme}${cityQs}`;
  // Aperçu : URL RELATIVE → fonctionne quelle que soit l'origine (dev/prod).
  const previewSrc = `/${locale}/carrieres/widget?${qs}`;
  // Snippets : URL ABSOLUE de production.
  const embedAbsolute = `${baseUrl}/${locale}/carrieres/widget?${qs}`;

  // Lien d'attribution dofollow (ancre de marque, posé dans le HTML hôte HORS
  // iframe) → vrai backlink. Ancre volontairement « de marque » (pas de mots-clés
  // sur-optimisés) pour rester conforme aux consignes Google sur les liens de widgets.
  const creditAnchor = isFr ? "Offres d'emploi par Axion-IA" : "Job openings by Axion-IA";
  const creditHref = `${baseUrl}/${locale}/carrieres`;

  // Le format iframe est statique (pas d'auto-resize) → on dimensionne la hauteur
  // selon variant + nombre d'offres pour éviter que les cartes soient coupées.
  // Estimation généreuse ; si ça déborde, le navigateur permet le défilement.
  const chrome = 150; // en-tête + pied + crédit + paddings
  const estHeight =
    variant === "compact" ? chrome + count * 62 : chrome + Math.ceil(count / 2) * 268; // 2 colonnes en « cartes »

  const iframeSnippet = `<div style="max-width:520px;margin:0 auto">
  <iframe
    src="${embedAbsolute}"
    title="${isFr ? "Offres d'emploi Axion-IA" : "Axion-IA job openings"}"
    width="100%"
    height="${estHeight}"
    loading="lazy"
    style="border:0;width:100%"
  ></iframe>
  <p style="font:13px/1.5 system-ui,-apple-system,sans-serif;text-align:center;margin:8px 0 0">
    <a href="${creditHref}" target="_blank" rel="noopener">${creditAnchor}</a>
  </p>
</div>`;

  const scriptSnippet = `<script async
  src="${baseUrl}/widget/offres-emploi.js"
  data-variant="${variant}"
  data-count="${count}"
  data-theme="${theme}"${city ? `\n  data-city="${city}"` : ""}
  data-locale="${locale}"></script>`;

  const copy = async (key: Exclude<CopyKey, null>, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      /* presse-papier indisponible (http non sécurisé) — l'utilisateur copie à la main */
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[20rem_1fr] lg:items-start">
      {/* ───────── Configurateur ───────── */}
      <div className="border-border bg-paper shadow-subtle rounded-2xl border p-5">
        <h2 className="font-serif text-lg font-semibold">{isFr ? "Personnaliser" : "Customize"}</h2>

        {/* Variant */}
        <fieldset className="mt-5">
          <legend className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
            {isFr ? "Affichage" : "Layout"}
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {VARIANTS.map((v) => (
              <button
                key={v.value}
                type="button"
                aria-pressed={variant === v.value}
                onClick={() => setVariant(v.value)}
                className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
                  variant === v.value
                    ? "border-terracotta bg-terracotta/10 font-medium"
                    : "border-border hover:border-terracotta"
                }`}
              >
                {isFr ? v.fr : v.en}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Theme */}
        <fieldset className="mt-5">
          <legend className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
            {isFr ? "Thème" : "Theme"}
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {THEMES.map((th) => (
              <button
                key={th.value}
                type="button"
                aria-pressed={theme === th.value}
                onClick={() => setTheme(th.value)}
                className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
                  theme === th.value
                    ? "border-terracotta bg-terracotta/10 font-medium"
                    : "border-border hover:border-terracotta"
                }`}
              >
                {isFr ? th.fr : th.en}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Ville */}
        {cities.length > 0 ? (
          <fieldset className="mt-5">
            <legend className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
              {isFr ? "Ville" : "City"}
            </legend>
            <select
              id={cityId}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="border-border focus:border-terracotta mt-2 w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
              aria-label={isFr ? "Filtrer par ville" : "Filter by city"}
            >
              <option value="">
                {isFr ? "Toutes les villes (France entière)" : "All cities (nationwide)"}
              </option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <p className="text-fg-muted mt-2 text-xs">
              {isFr
                ? "Affiche les offres de cette ville + les postes en télétravail (jamais de widget vide)."
                : "Shows roles in this city + remote positions (never an empty widget)."}
            </p>
          </fieldset>
        ) : null}

        {/* Count */}
        <fieldset className="mt-5">
          {/* 🔴 a11y 2026-08-21 — axe rendait `label` (CRITICAL) sur ce curseur.
              Un `<legend>` nomme le GROUPE, pas la commande : le champ n'avait donc
              aucun nom accessible, et un lecteur d'écran annonçait « curseur, 5 » sans
              dire de quoi. On référence le légende par `aria-labelledby` plutôt que de
              recopier le libellé dans un `aria-label` — une seule écriture, donc pas de
              divergence possible entre les deux. */}
          <legend
            id={`${countId}-legende`}
            className="text-fg-muted text-xs font-semibold tracking-wide uppercase"
          >
            {isFr ? "Nombre d'offres" : "Number of roles"}
          </legend>
          <div className="mt-2 flex items-center gap-3">
            <input
              id={countId}
              aria-labelledby={`${countId}-legende`}
              type="range"
              min={1}
              max={12}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="accent-terracotta w-full"
            />
            <span className="border-border w-8 shrink-0 rounded-md border text-center text-sm font-semibold">
              {count}
            </span>
          </div>
        </fieldset>

        <p className="text-fg-muted mt-5 text-xs">
          {isFr
            ? "Les offres se mettent à jour automatiquement : ce que vous publiez côté console apparaît dans le widget."
            : "Roles update automatically: what you publish in the console shows up in the widget."}
        </p>
        <p className="border-border text-fg-muted mt-4 rounded-xl border border-dashed p-3 text-xs">
          {isFr
            ? "Le code inclut un petit lien « Offres d'emploi par Axion-IA ». Merci de le conserver — c'est gratuit en échange de ça 🙏."
            : "The code includes a small “Job openings by Axion-IA” link. Please keep it — that's the only thing we ask in return 🙏."}
        </p>
      </div>

      {/* ───────── Formats + aperçus ───────── */}
      <div className="space-y-8">
        <FormatCard
          label={isFr ? "Format 1 — iframe (le plus simple)" : "Format 1 — iframe (simplest)"}
          help={
            isFr
              ? "Collez ce code là où vous voulez afficher les offres. Hauteur fixe."
              : "Paste this code where you want the roles to appear. Fixed height."
          }
          code={iframeSnippet}
          copied={copied === "iframe"}
          onCopy={() => copy("iframe", iframeSnippet)}
          previewSrc={previewSrc}
          isFr={isFr}
        />
        <FormatCard
          label={
            isFr ? "Format 2 — script (auto-redimensionné)" : "Format 2 — script (auto-resizing)"
          }
          help={
            isFr
              ? "Recommandé : le widget ajuste sa hauteur tout seul, sans barre de défilement."
              : "Recommended: the widget auto-fits its height, no scrollbar."
          }
          code={scriptSnippet}
          copied={copied === "script"}
          onCopy={() => copy("script", scriptSnippet)}
          previewSrc={previewSrc}
          isFr={isFr}
        />
      </div>
    </div>
  );
}

interface FormatCardProps {
  label: string;
  help: string;
  code: string;
  copied: boolean;
  onCopy: () => void;
  previewSrc: string;
  isFr: boolean;
}

function FormatCard({ label, help, code, copied, onCopy, previewSrc, isFr }: FormatCardProps) {
  return (
    <section className="border-border bg-bg shadow-subtle rounded-2xl border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-base font-semibold">{label}</h3>
      </div>
      <p className="text-fg-muted mt-1 text-sm">{help}</p>

      <div className="mt-4 grid gap-5 lg:grid-cols-2 lg:items-start">
        {/* Code à copier */}
        <div className="relative">
          <button
            type="button"
            onClick={onCopy}
            className="bg-terracotta hover:bg-terracotta/90 absolute top-2 right-2 z-10 rounded-md px-3 py-1 text-xs font-semibold text-white transition-colors"
          >
            {copied ? (isFr ? "Copié ✓" : "Copied ✓") : isFr ? "Copier" : "Copy"}
          </button>
          {/* 🔴 a11y 2026-08-21 — `scrollable-region-focusable` (serious). Ce bloc
              défile (`max-h-72 overflow-auto`) mais n'était pas atteignable au clavier :
              impossible d'en lire la fin sans souris. `tabIndex={0}` le rend focusable,
              et il lui faut alors un nom et un rôle — sinon on gagne un arrêt de
              tabulation muet, ce qui n'est pas un progrès. */}
          <pre
            tabIndex={0}
            role="region"
            aria-label={isFr ? "Code d'intégration du widget" : "Widget embed code"}
            className="bg-mocha-rich text-mocha-fg focus-visible:ring-terracotta max-h-72 overflow-auto rounded-xl p-4 text-xs leading-relaxed focus-visible:ring-2 focus-visible:outline-none"
          >
            <code style={{ fontFamily: "var(--font-mono, var(--font-inconsolata))" }}>{code}</code>
          </pre>
        </div>

        {/* Aperçu visuel live */}
        <div>
          <p className="text-fg-muted mb-2 text-xs font-semibold tracking-wide uppercase">
            {isFr ? "Aperçu en direct" : "Live preview"}
          </p>
          <div className="border-border bg-canvas overflow-hidden rounded-xl border">
            <iframe
              src={previewSrc}
              title={isFr ? "Aperçu du widget offres" : "Offers widget preview"}
              loading="lazy"
              scrolling="no"
              className="block h-[440px] w-full"
              style={{ border: 0 }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
