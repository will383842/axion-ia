/**
 * Hub apporteurs (`/devenir-commercial-ia`) — visibilité : JSON-LD WebPage (speakable sur le
 * bloc « En bref » hors mention de mise à jour) et bouton mobile présent avec un lien non vide.
 * La cible du bouton n'est volontairement PAS figée : une autre PR la déplace.
 */
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next-intl/server", () => ({
  setRequestLocale: () => undefined,
  getLocale: async () => "fr",
  getTranslations: async () => (k: string) => k,
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: () => undefined }),
  Link: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/nav/Breadcrumbs", () => ({
  Breadcrumbs: ({ items }: { items: { href: string; label: string }[] }) => (
    <nav>
      {items.map((i) => (
        <a key={i.href} href={i.href}>
          {i.label}
        </a>
      ))}
    </nav>
  ),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import Page from "../page";

async function rendre(): Promise<string> {
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ locale: "fr" }) }));
}

/** Tous les blocs JSON-LD du HTML, aplatis (`@graph` déroulé). */
function blocsJsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    const brut = (m[1] ?? "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
    const obj = JSON.parse(brut) as Record<string, unknown>;
    const graphe = obj["@graph"];
    if (Array.isArray(graphe)) out.push(...(graphe as Record<string, unknown>[]));
    else out.push(obj);
  }
  return out;
}

describe("hub apporteurs — JSON-LD WebPage", () => {
  it("speakable : le bloc En bref hors mention de mise à jour, et le titre", async () => {
    const wp = blocsJsonLd(await rendre()).find((b) => String(b["@type"]).includes("WebPage"));
    expect(wp, "JSON-LD WebPage absent").toBeDefined();
    const spec = wp?.["speakable"] as { cssSelector?: string[] };
    expect(spec.cssSelector).toEqual([".en-bref p:not(.maj)", "h1"]);
  });
});

describe("hub apporteurs — bouton mobile", () => {
  it("existe, avec un libellé et un lien non vide", async () => {
    const html = await rendre();
    const m = html.match(/<a[^>]*data-cta="commercial-sticky-apply"[^>]*>/);
    expect(m, "bouton mobile absent").not.toBeNull();
    const href = m?.[0].match(/href="([^"]*)"/)?.[1] ?? "";
    expect(href.trim().length).toBeGreaterThan(0);
    expect(href.startsWith("/")).toBe(true);
  });
});
