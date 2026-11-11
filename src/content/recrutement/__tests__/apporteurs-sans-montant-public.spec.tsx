/**
 * R7 — « apporteurs : sans prix ni promesse » (ordre de Williams du 08/11/2026).
 *
 * Au public, la seule somme affichée est la Journée IA (1 490 € HT). Les pages de
 * recrutement d'apporteurs (tunnel Facebook, Indeed, Le Bon Coin, VSL, page
 * « apporteur d'affaires indépendant », hub /devenir-commercial-ia, sa candidature,
 * /memo-isere) affichaient la commission en euros (« 500 € par journée vendue »),
 * son taux (« 30 % de la facture ») et le prix de vente des audits qui sert à la
 * calculer (« le plus petit audit démarre à 1 190 € HT »).
 *
 * La garde REND chaque page (composant serveur réel, puis HTML statique) et ses
 * métadonnées, et rougit sur tout montant en euros autre que 1 490, et sur tout taux
 * de commission. Les constantes `COMMISSION_*` de `pricing.ts` restent : elles servent
 * au contrat et aux e-mails privés (barème envoyé à l'apporteur retenu).
 */
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { NextIntlClientProvider } from "next-intl";
import messagesFr from "@/messages/fr.json";

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const messages = (await import("@/messages/fr.json")).default;
  return {
    setRequestLocale: () => undefined,
    getLocale: async () => "fr",
    getMessages: async () => messages,
    getTranslations: async (o?: string | { namespace?: string }) =>
      createTranslator({
        locale: "fr",
        messages,
        namespace: (typeof o === "string" ? o : o?.namespace) as never,
      }),
  };
});
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: () => undefined }),
  usePathname: () => "/",
  Link: ({ href, children, ...rest }: { href: unknown; children?: ReactNode }) => (
    <a href={String(href)} {...(rest as object)}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: unknown; alt: string }) => <img src={String(src)} alt={alt} />,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/server/reviews/queries", () => ({
  getPublishedReviews: async () => ({ items: [], total: 0 }),
}));
vi.mock("@/features/commercial-application/lead-vsl-actions", () => ({
  capturerLeadVsl: async () => ({ ok: false, error: "unknown" }),
  completerLeadVsl: async () => ({ ok: false, error: "unknown" }),
}));
vi.mock("@/features/commercial-application/lead-apporteur-actions", () => ({
  capturerLeadApporteur: async () => ({ ok: false, error: "unknown" }),
}));

import { COMMISSION_FORMATION_PAR_JOURNEE_EUR } from "@/content/pricing";
import * as Facebook from "@/app/[locale]/apporteur-affaires/page";
import * as Indeed from "@/app/[locale]/indeed/page";
import * as Leboncoin from "@/app/[locale]/leboncoin/page";
import * as Video from "@/app/[locale]/apporteur-affaires/video/page";
import * as Independant from "@/app/[locale]/apporteur-affaires-independant-formation-ia-entreprise/page";
import * as Hub from "@/app/[locale]/devenir-commercial-ia/page";
import * as Candidature from "@/app/[locale]/devenir-commercial-ia/candidature/page";
import * as MemoIsere from "@/app/[locale]/memo-isere/page";

type PageModule = {
  default: (p: { params: Promise<{ locale: string }> }) => Promise<ReactNode> | ReactNode;
  generateMetadata?: (p: { params: Promise<{ locale: string }> }) => Promise<unknown>;
};

const PAGES: Readonly<Record<string, PageModule>> = {
  "/apporteur-affaires (tunnel Facebook)": Facebook as unknown as PageModule,
  "/indeed": Indeed as unknown as PageModule,
  "/leboncoin": Leboncoin as unknown as PageModule,
  "/apporteur-affaires/video (VSL)": Video as unknown as PageModule,
  "/apporteur-affaires-independant-formation-ia-entreprise": Independant as unknown as PageModule,
  "/devenir-commercial-ia": Hub as unknown as PageModule,
  "/devenir-commercial-ia/candidature": Candidature as unknown as PageModule,
  "/memo-isere": MemoIsere as unknown as PageModule,
};

/** Texte visible + attributs (title, alt, content, JSON-LD), espaces normalisés. */
function texte(h: string): string {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;|&#160;| | /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/** Montants en euros (« 500 € », « €500 », « 1 190 € HT »), sauf la Journée IA. */
export function montantsInterdits(t: string): string[] {
  const norme = t.replace(/ | /g, " ");
  const trouves = [
    ...norme.matchAll(/\d[\d ]*(?:[.,]\d+)?\s*(?:€|euros?\b|EUR\b)/g),
    ...norme.matchAll(/€\s*\d[\d ,.]*/g),
  ].map((m) => m[0].trim());
  // 2026-11-11 (Williams) : la commission de la Journée IA s'affiche (« 500 € HT, à titre indicatif »).
  const permis = String(COMMISSION_FORMATION_PAR_JOURNEE_EUR);
  const ok = (m: string) =>
    new RegExp(`^(?:1 ?490|${permis})\\b`).test(m) ||
    new RegExp(`€\\s*(?:1 ?490|${permis})\\b`).test(m);
  return trouves.filter((m) => !ok(m));
}

/** Taux de commission (« 30 % de la facture », « 15 % sur l'automatisation »,
 *  « commission de 30 % », « 30 % … par journée vendue »). « 100 % à la commission » (mode de
 *  rémunération, exception nommée de `jur:remuneration-indicative`) n'est pas un taux. */
function tauxInterdits(t: string): string[] {
  return [
    ...t.matchAll(
      /(?<![\w%])(?!100\s?%)\d+\s?%(?![0-9A-Fa-f]{2})[^.;!?]{0,40}?(?:commission|facture|journée vendue)/gi,
    ),
    ...t.matchAll(
      /(?:commission|facture|journée vendue)[^.;!?]{0,40}?(?<![\w%])(?!100\s?%)\d+\s?%(?![0-9A-Fa-f]{2})/gi,
    ),
    ...t.matchAll(
      /\d+\s*%\s*(?:de la facture|sur (?:un |les |l')?(?:audit|automatisation|intégration))/gi,
    ),
    ...t.matchAll(/(?:audits?|intégrations?)\s*\(\d+\s*%\)/gi),
  ].map((m) => m[0]);
}

// Un composant client de /memo-isere lit `matchMedia` au rendu ; jsdom ne l'a pas.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/** Rend un arbre serveur, composants `async` compris (Fizz attend leurs promesses). */
async function rendre(noeud: ReactNode): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    <NextIntlClientProvider locale="fr" messages={messagesFr} timeZone="Europe/Paris">
      {noeud}
    </NextIntlClientProvider>,
  );
  const morceaux: Buffer[] = [];
  for await (const m of prelude) morceaux.push(Buffer.from(m as Uint8Array));
  return Buffer.concat(morceaux).toString("utf8");
}

describe("témoins de la garde (elle sait voir un montant)", () => {
  it("rougit sur la commission, laisse passer la Journée IA", () => {
    expect(montantsInterdits(`${COMMISSION_FORMATION_PAR_JOURNEE_EUR} € HT par journée`)).toEqual(
      [],
    );
    expect(montantsInterdits("jusqu'à 700 € par journée")).toHaveLength(1);
    expect(montantsInterdits("€900 per day")).toHaveLength(1);
    expect(montantsInterdits("Le plus petit audit démarre à 1 190 € HT")).toHaveLength(1);
    expect(montantsInterdits("La Journée IA : 1 490 € HT")).toEqual([]);
    expect(tauxInterdits("jusqu'à 30 % de la facture")).not.toEqual([]);
    expect(tauxInterdits("100 % des stagiaires")).toEqual([]);
    expect(tauxInterdits("une commission de 30 % sur l'audit")).not.toEqual([]);
    expect(tauxInterdits("Versée quand l'entreprise a payé à 100 %")).toEqual([]);
  });
});

describe("pages de recrutement d'apporteurs : aucun montant, aucun taux", () => {
  for (const [nom, mod] of Object.entries(PAGES)) {
    it(`${nom} — page rendue`, async () => {
      const h = await rendre(await mod.default({ params: Promise.resolve({ locale: "fr" }) }));
      const t = texte(h);
      expect(t.length, "la page a bien été rendue").toBeGreaterThan(500);
      expect(montantsInterdits(t)).toEqual([]);
      expect(tauxInterdits(t)).toEqual([]);
    });

    if (mod.generateMetadata) {
      it(`${nom} — métadonnées (fr, en)`, async () => {
        for (const locale of ["fr", "en"]) {
          const m = await mod.generateMetadata!({ params: Promise.resolve({ locale }) });
          const s = JSON.stringify(m ?? {});
          expect(montantsInterdits(s), locale).toEqual([]);
          expect(tauxInterdits(s), locale).toEqual([]);
        }
      });
    }
  }
});
