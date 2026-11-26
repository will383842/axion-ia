/**
 * CGV : l'acompte est facultatif. L'article 6.5 et l'article 12.1 ne doivent plus supposer un premier
 * versement, puisque le devis a un acompte à 0 % par défaut.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const SIX_CINQ =
  "6.5 Acompte (acompte : valeur fixée au devis ; à défaut : aucun). Lorsqu'un acompte est prévu au devis, aucun travail ne commence avant sa réception, sauf les règles du Titre IX ; si cet acompte n'est pas reçu dans les (délai : valeur fixée au devis ; à défaut : 30 jours) suivant la signature, Axion-IA peut constater par écrit l'abandon de la commande, sans frais de part ni d'autre. Acompte acquis. Dès qu'il a été versé, l'acompte prévu au devis reste acquis à Axion-IA, à concurrence des sommes effectivement versées (la part non versée n'est due que selon le barème), si le Client annule la commande, quel que soit le délai : il n'est pas remboursé. Il est conservé à titre de dédit et d'indemnité (article 1231-5 du Code civil, qui laisse au juge la faculté de modérer une pénalité manifestement excessive). S'il est inférieur à la somme due en cas d'annulation (articles 42.1, 46.2 et 49.5), il s'impute sur cette somme et le Client ne paie que la différence ; la somme due n'est jamais inférieure au montant hors taxes de l'acompte versé. L'acompte n'est pas acquis lorsque l'annulation résulte d'un manquement d'Axion-IA (article 43), d'un report à l'initiative d'Axion-IA (article 46.4), d'un événement extérieur de l'article 47.6, d'une sortie sans frais de l'article 41.3, d'un retard d'Axion-IA ouvrant résiliation (article 12.5), d'un cas de force majeure (article 39), d'un intervenant ou d'un coach remplacé ou empêché (articles 17.4 et 50.2), ni en cas d'exercice d'un droit de rétractation légal ; pour le Client qui bénéficie d'un tel droit (article 53.2), l'acompte n'est acquis qu'à l'expiration du délai de rétractation. Cette règle vise les Clients professionnels et la personne morale non professionnelle de l'article 53.3, qui bénéficie en outre de la réciprocité de cet article ; elle ne s'applique pas à la personne physique de l'article 49.2, pour laquelle l'acompte est remboursé en totalité en cas d'annulation avant le début. Le montant de l'acompte est celui du devis. En cas de report (articles 46.3 et 46.4), l'acompte est reporté sur la nouvelle date, ou porté sur le bon d'achat de l'article 46.4, et reste imputé sur le prix de la prestation reportée. L'acompte et les sommes conservées sont facturés avec la TVA applicable, sans exonération. Lorsque le devis ne prévoit pas d'acompte, les travaux commencent à la date convenue entre les parties après la formation du contrat (article 6.2), et le prix est payé selon l'échéancier du devis (article 9).";

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
});
