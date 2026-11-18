/**
 * Fiche I0b-4 — l'en-tête du lecteur est complet sur les écrans serveur.
 *
 * Page des gabarits (test 1, 3) et détail d'un envoi (tests 2 à 5). On passe par
 * les vraies pages / vrai composant ; seules la session et la base sont doublées.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

const d = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("@/auth", () => ({ auth: () => Promise.resolve(d.session) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import Page from "../page";
import { VueDetailEmail } from "../../../../emails-envoyes/_components/VueDetailEmail";
import { enveloppeExpedition } from "@/lib/email/enveloppe";
import { extrairePreEntete } from "@/lib/email/apercu-lecteur";
import type { DetailEmail } from "@/features/admin-emails/detail";

const NOM = "contact-confirmed";

async function rendreGabarit(
  search: Record<string, string | undefined> = {},
  nom: string = NOM,
): Promise<string> {
  d.session = { user: { id: "u-1", role: "admin" } };
  const el = (await Page({
    params: Promise.resolve({ adminPrefix: "p", nom }),
    searchParams: Promise.resolve(search),
  })) as ReactElement;
  return renderToStaticMarkup(el);
}

const ID = "3f2a9c1e-8b7d-4e6f-a5c4-1b2d3e4f5a6b";
const HTML_AVEC_PRE =
  '<html><body><div data-skip-in-text="true">Votre convention est prête‌ ‌</div><p>Bonjour</p></body></html>';

function email(copie: DetailEmail["copie"]): DetailEmail {
  return {
    id: ID,
    template: "convention-envoi",
    recipient: "camille.dupont@example.invalid",
    locale: "fr",
    marketing: false,
    status: "sent",
    attempts: 1,
    error: null,
    bounceType: null,
    bounceReason: null,
    bouncedAt: null,
    sentAt: new Date("2026-09-28T09:00:00Z"),
    failedAt: null,
    dueAt: null,
    createdAt: new Date("2026-09-28T08:59:00Z"),
    entityType: null,
    entityId: null,
    providerMessageId: null,
    copie,
  };
}

const COPIE = {
  subject: "Votre convention à signer",
  html: HTML_AVEC_PRE,
  text: "Bonjour",
  attachmentNames: [],
  secretsMasques: 0,
  createdAt: new Date("2026-09-28T09:00:01Z"),
};

function rendreDetail(e: DetailEmail, vue: "html" | "texte", apercu = null): string {
  return renderToStaticMarkup(
    <VueDetailEmail
      email={e}
      vue={vue}
      raison={null}
      apercu={apercu}
      base="/fr/p/emails-envoyes"
      adminPrefix="p"
    />,
  );
}

beforeEach(() => {
  d.session = null;
});

describe("fiche I0b-4", () => {
  it("1) gabarit : « De », « Répondre à » et « Pré-en-tête » sont affichés, sans objet en double", async () => {
    const html = await rendreGabarit();
    const env = enveloppeExpedition({ marketing: false });
    expect(html).toContain("<dt>De</dt>");
    expect(html).toContain(env.fromAddress);
    expect(html).toContain("<dt>Répondre à</dt>");
    expect(html).toContain("<dt>Pré-en-tête</dt>");
    // L'objet n'apparaît qu'une fois : dans l'en-tête du lecteur.
    expect(html.match(/<dt>Objet<\/dt>/g)?.length ?? 0).toBe(1);
    expect(html).not.toMatch(/uppercase">\s*Objet/);
  });

  it("2) détail : ?vue=texte coche « Texte brut », plus aucun lien « Version texte »", () => {
    const html = rendreDetail(email(COPIE), "texte");
    expect(html).not.toContain("Version texte");
    expect(html).not.toContain("Rendu HTML");
    expect(html).toMatch(/<input[^>]*checked=""[^>]*value="texte"/);
    expect(html).not.toMatch(/<input[^>]*checked=""[^>]*value="html"/);
    // Un seul cadre : pas de double enveloppe.
    expect(html.match(/<iframe/g)?.length).toBe(1);
  });

  it("3) lien plein écran : envoyé et gabarit (variante en paramètre)", async () => {
    const detail = rendreDetail(email(COPIE), "html");
    expect(detail).toContain(`href="/fr/p/emails/lecture/envoye/${ID}"`);
    const gab = await rendreGabarit();
    expect(gab).toContain(`href="/fr/p/emails/lecture/gabarit/${NOM}"`);
  });

  it("3b) lien plein écran : une variante connue est reportée en paramètre", async () => {
    const gab = await rendreGabarit({ variante: "honoraires" }, "formateur-mission-proposee");
    expect(gab).toContain(
      'href="/fr/p/emails/lecture/gabarit/formateur-mission-proposee?variante=honoraires"',
    );
  });

  it("3c) lien plein écran : une variante inconnue est ignorée", async () => {
    const gab = await rendreGabarit({ variante: "inconnue" }, "formateur-mission-proposee");
    expect(gab).toContain('href="/fr/p/emails/lecture/gabarit/formateur-mission-proposee"');
    expect(gab).not.toContain("?variante=inconnue");
  });

  it("4) aperçu reconstitué : bandeau présent, aucun lien plein écran", () => {
    const html = rendreDetail(email(null), "html", {
      ok: true,
      subject: "Objet reconstitué",
      html: "<p>x</p>",
      text: "x",
      regles: { signature: false, incertain: false },
      hypotheses: [],
    } as never);
    expect(html).toContain('data-testid="bandeau-reconstitue"');
    expect(html).toContain("<dt>De</dt>");
    expect(html).toContain("<dt>Répondre à</dt>");
    expect(html).not.toContain("/emails/lecture/");
    expect(html).not.toContain("Ouvrir en plein écran");
  });

  it("5) le pré-en-tête de la copie est extrait de copie.html", () => {
    const attendu = extrairePreEntete(HTML_AVEC_PRE);
    expect(attendu).toBe("Votre convention est prête");
    const html = rendreDetail(email(COPIE), "html");
    expect(html).toContain("<dt>Pré-en-tête</dt>");
    expect(html).toContain(`<dd>${attendu}</dd>`);
    expect(html).toContain("<dt>De</dt>");
    expect(html).toContain("<dt>Répondre à</dt>");
  });
});

describe("fiche I0b-4 — pré-en-tête masqué à l'affichage", () => {
  it("6) une copie dont le pré-en-tête contient un lien à jeton n'affiche pas le jeton", () => {
    const jeton = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6";
    const html = renderToStaticMarkup(
      <VueDetailEmail
        email={email({
          ...COPIE,
          html: `<html><body><div data-skip-in-text="true">Signez ici https://example.invalid/signer/${jeton}</div><p>Bonjour</p></body></html>`,
        })}
        vue="html"
        raison={null}
        apercu={null}
        base="/fr/p/emails-envoyes"
        adminPrefix="p"
      />,
    );
    // Le pré-en-tête (hors cadre isolé) ne montre pas le jeton.
    const preEntete = html.match(/<dt>Pré-en-tête<\/dt><dd>(.*?)<\/dd>/)?.[1] ?? "";
    expect(preEntete).toContain("[masqué]");
    expect(preEntete).not.toContain(jeton);
  });
});
