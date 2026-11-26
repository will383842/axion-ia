/** `/memo-isere` — le fil d'Ariane remonte au hub des apporteurs d'affaires. */
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
vi.mock("@/components/nav/Breadcrumbs", () => ({
  Breadcrumbs: ({ items }: { items: { href: string; label: string }[] }) => (
    <nav data-ariane>
      {items.map((i) => (
        <a key={i.href} href={i.href}>
          {i.label}
        </a>
      ))}
    </nav>
  ),
}));

import Page from "../page";

describe("memo-isere — fil d'Ariane", () => {
  it("place le hub parent avant la page, dans cet ordre", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale: "fr" }) }));
    const ariane = html.match(/<nav data-ariane[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";
    const hrefs = [...ariane.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["/devenir-commercial-ia", "/memo-isere"]);
  });
});
