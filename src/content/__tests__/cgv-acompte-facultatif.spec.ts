/**
 * CGV : l'acompte est facultatif. L'article 6.5 et l'article 12.1 ne doivent plus supposer un premier
 * versement, puisque le devis a un acompte à 0 % par défaut.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const SIX_CINQ =
  "6.5 Acompte (acompte : valeur fixée au devis ; à défaut : aucun). Lorsqu'un acompte est prévu au devis, aucun travail ne commence avant sa réception, sauf les règles du Titre IX ; si cet acompte n'est pas reçu dans les (délai : valeur fixée au devis ; à défaut : 30 jours) suivant la signature, Axion-IA peut constater par écrit l'abandon de la commande, sans frais de part ni d'autre. Lorsque le devis ne prévoit pas d'acompte, les travaux commencent à la date convenue entre les parties après la formation du contrat (article 6.2), et le prix est payé selon l'échéancier du devis (article 9).";

const DOUZE_UN =
  "12.1 Les délais du devis sont estimatifs. Ils courent à compter de la plus tardive de ces dates : la formation du contrat (article 6.2), la réception de l'acompte lorsque le devis en prévoit un, et la fourniture par le Client des éléments listés au devis (accès, informations, contenus, données, interlocuteur).";

const MOTS_INTERDITS =
  /\bfinancements?\b|prise en charge|qualiopi|\bOPCO\b|\bCPF\b|certification|grenoble/i;

type Page = {
  title: string;
  titleEm?: string;
  intro: string;
  sections: ReadonlyArray<{ title: string; body: string }>;
};

const texteComplet = (p: Page) =>
  [p.title, p.titleEm ?? "", p.intro, ...p.sections.flatMap((s) => [s.title, s.body])].join("\n");

async function chargerFr(): Promise<Page> {
  vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "");
  vi.resetModules();
  const { getLegal } = await import("@/content/legal");
  return getLegal("conditions-generales").fr as Page;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("CGV : acompte facultatif", () => {
  it("l'article 6 contient le texte de 6.5 sans acompte obligatoire", async () => {
    const fr = await chargerFr();
    const art = fr.sections.find((s) => /Article 6\. /.test(s.title))!;
    expect(art.body).toContain(SIX_CINQ);
  });

  it("l'article 12 contient le texte de 12.1 sans premier versement", async () => {
    const fr = await chargerFr();
    const art = fr.sections.find((s) => /Article 12\. /.test(s.title))!;
    expect(art.body).toContain(DOUZE_UN);
  });

  it("les anciennes formulations ont disparu du texte FR", async () => {
    const t = texteComplet(await chargerFr());
    expect(t).not.toContain("Aucun travail ne commence avant la réception du premier versement");
    expect(t).not.toContain("Ils courent quand le premier versement est reçu");
  });

  it("« premier versement » n'apparaît plus qu'une fois, à l'article 49", async () => {
    const fr = await chargerFr();
    const t = texteComplet(fr);
    expect(t.split("premier versement")).toHaveLength(2);
    const art49 = fr.sections.find((s) => /Article 49\. /.test(s.title))!;
    expect(art49.body).toContain("premier versement");
  });

  it("les articles 6 et 12 n'introduisent aucun mot interdit", async () => {
    const fr = await chargerFr();
    for (const n of [6, 12]) {
      const art = fr.sections.find((s) => new RegExp(`Article ${n}\\. `).test(s.title))!;
      expect(art.body).not.toMatch(MOTS_INTERDITS);
    }
  });

  it("le texte « délais » du devis ne parle plus de premier versement", async () => {
    const { TEXTE_DELAIS } = await import("@/server/qualiopi/devis/assistant/textes-rubriques");
    expect(TEXTE_DELAIS).not.toContain("premier versement");
    expect(TEXTE_DELAIS).toContain("si le devis prévoit un acompte, cet acompte");
  });
});
