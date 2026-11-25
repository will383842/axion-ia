/** `/a-propos` — un lien vers le hub des apporteurs d'affaires, avec son ancre. */
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
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("@/components/nav/Breadcrumbs", () => ({ Breadcrumbs: () => null }));

import Page from "../page";

describe("a-propos — lien vers les apporteurs", () => {
  it("le rendu contient le href du hub et l'ancre « Devenir apporteur d'affaires indépendant »", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale: "fr" }) }));
    const lien = html.match(/<a[^>]*href="\/devenir-commercial-ia"[^>]*>([\s\S]*?)<\/a>/);
    expect(lien, "lien vers le hub absent").not.toBeNull();
    expect((lien?.[1] ?? "").replace(/&#x27;|&#39;/g, "'")).toBe(
      "Devenir apporteur d'affaires indépendant",
    );
  });
});
