/**
 * Signature du `FAQPage` — qui l'HTML dit avoir répondu.
 *
 * `buildFaqJsonLd` crédite Manon par défaut, la persona éditoriale IA. C'est
 * le bon crédit pour une FAQ produite par le content-gen (AI Act art. 50), et
 * le mauvais partout où la page est rédigée à la main : une page d'autorité
 * qui attribue ses réponses à une persona générée détruit le signal E-E-A-T
 * qu'elle existe pour poser.
 *
 * Deux gardes, parce qu'une seule ne rougirait pas sur la vraie panne :
 *  1. le prop `faqAuthorId` traverse bien `FaqBlock` → `FaqAccordion` →
 *     JSON-LD (sinon on passe un prop qui ne va nulle part) ;
 *  2. la page « À propos » le passe pour de bon (sinon la mécanique marche et
 *     personne ne s'en sert — c'était exactement l'état de la prod).
 */
import fs from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { FOUNDER_PERSON_ID } from "@/lib/brand";

const ITEMS = [{ id: "q1", question: "Où est le siège ?", answer: "À Grenoble." }] as const;

function faqPageFrom(container: HTMLElement): Record<string, unknown> {
  const script = container.querySelector<HTMLScriptElement>('script[type="application/ld+json"]');
  expect(script, "aucun FAQPage JSON-LD émis").toBeTruthy();
  return JSON.parse(script!.textContent ?? "{}") as Record<string, unknown>;
}

describe("FaqBlock — auteur du FAQPage", () => {
  it("crédite l'`@id` passé en `faqAuthorId`", () => {
    const { container } = render(<FaqBlock items={ITEMS} faqAuthorId={FOUNDER_PERSON_ID} />);
    const faq = faqPageFrom(container);

    expect(faq["@type"]).toBe("FAQPage");
    expect(faq.author).toEqual({ "@id": FOUNDER_PERSON_ID });
  });

  // Témoin négatif : sans le prop, le défaut Manon DOIT rester en place. Sinon
  // le test ci-dessus passerait même si `faqAuthorId` n'était jamais lu.
  it("retombe sur la persona éditoriale IA quand aucun auteur n'est fourni", () => {
    const { container } = render(<FaqBlock items={ITEMS} />);
    const faq = faqPageFrom(container);

    expect(String((faq.author as { "@id": string })["@id"])).toContain("/equipe/manon#person");
  });
});

describe("Page « À propos » — appel réel", () => {
  it("passe `faqAuthorId` à son `FaqBlock`", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/app/[locale]/a-propos/page.tsx"),
      "utf8",
    );
    // On lit la BALISE, pas le fichier entier : un commentaire qui cite
    // `faqAuthorId` ne doit pas suffire à faire passer le test.
    const opening = source.match(/<FaqBlock[\s\S]*?\/?>/);

    expect(opening, "plus aucun <FaqBlock> sur /a-propos").toBeTruthy();
    expect(opening![0]).toContain("faqAuthorId={FOUNDER_PERSON_ID}");
  });
});
