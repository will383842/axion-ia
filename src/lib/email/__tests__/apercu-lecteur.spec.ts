import { describe, expect, it, vi } from "vitest";
import {
  compterImagesBloquees,
  cspCorpsEmail,
  extrairePreEntete,
  rendreLiensInertes,
} from "@/lib/email/apercu-lecteur";
import { renderEmailTemplate } from "@/lib/email/templates";

// Base factice : le rendu lit des statistiques d'avis (le proxy « stub.invalid » répond vide).
vi.hoisted(() => {
  process.env.DATABASE_URL = "postgresql://stub:stub@stub.invalid:5432/stub";
});

const JETON = "Zk3Jf9Qw2LmN8pXr5TvB7yHc";

describe("rendreLiensInertes", () => {
  it("un lien d'opposition avec un jeton n'a plus ni href ni jeton ; le texte reste", () => {
    const html = `<p><a href="https://axion-ia.com/opposition?t=${JETON}" style="x">Me désinscrire</a></p>`;
    expect(html).toContain(JETON); // témoin : le marqueur est présent avant
    const sortie = rendreLiensInertes(html);
    expect(sortie).not.toContain(JETON);
    expect(sortie).not.toMatch(/\shref\s*=/i);
    expect(sortie).toContain(">Me désinscrire</a>");
    expect(sortie).toContain('title="https://axion-ia.com/opposition');
  });

  it("neutralise <area href> et <form action> / formaction", () => {
    const html =
      `<map><area href="https://x.example/p/${JETON}" shape="rect"></map>` +
      `<form action="https://x.example/f"><button formaction="https://x.example/g">ok</button></form>`;
    expect(html).toContain("href=");
    const sortie = rendreLiensInertes(html);
    expect(sortie).not.toMatch(/\shref\s*=/i);
    expect(sortie).not.toMatch(/\saction\s*=/i);
    expect(sortie).not.toMatch(/\sformaction\s*=/i);
    expect(sortie).not.toContain(JETON);
    expect(sortie).toContain("<button");
  });
});

describe("extrairePreEntete", () => {
  it("lit le pré-en-tête d'un vrai rendu, sans caractères de remplissage", async () => {
    const rendu = await renderEmailTemplate(
      "submission-reply" as never,
      "fr" as never,
      {
        subject: "Sujet",
        bodyMarkdown: "Bonjour, voici la réponse détaillée à votre demande.",
      } as never,
      { destinataire: "client@example.com" },
    );
    expect(rendu.html).toContain("‌"); // témoin : le remplissage est bien dans le HTML
    const pre = extrairePreEntete(rendu.html);
    expect(pre.length).toBeGreaterThan(0);
    expect(pre).toContain("voici la réponse");
    expect(pre).not.toContain("‌");
    expect(pre).not.toContain(" ");
  });
});

describe("compterImagesBloquees", () => {
  it("compte les images d'ailleurs, pas celles du site ni data:", () => {
    expect(
      compterImagesBloquees(
        '<img src="https://ailleurs.example/a.png"><img src="https://axion-ia.com/l.png"><img src="data:image/png;base64,AA">',
      ),
    ).toBe(1);
    expect(cspCorpsEmail()).toContain("https://axion-ia.com");
  });
});
