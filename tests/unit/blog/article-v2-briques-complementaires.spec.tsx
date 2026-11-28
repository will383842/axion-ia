/** PR S2 — briques complémentaires du socle : rendu serveur, rien quand la donnée manque. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", async () => {
  const { readFileSync } = await import("node:fs");
  const commun = JSON.parse(readFileSync("src/messages/gabarits/commun.fr.json", "utf8"));
  const chercher = (ns: string, k: string): unknown => {
    if (!ns.startsWith("articleGabarits.commun")) return undefined;
    const chemin = `${ns}.${k}`.replace(/^articleGabarits\.commun\.?/, "");
    return chemin
      .split(".")
      .filter(Boolean)
      .reduce<unknown>((o, c) => (o as Record<string, unknown> | undefined)?.[c], commun);
  };
  const fabrique = (ns: string) =>
    Object.assign(
      (k: string, vars?: Record<string, unknown>) => {
        const v = chercher(ns, k);
        if (typeof v !== "string") return k;
        return v.replace(/\{(\w+)\}/g, (_, n) => String(vars?.[n] ?? ""));
      },
      {
        raw: (k: string) => chercher(ns, k),
        rich: (k: string, v: Record<string, unknown>) => {
          const balise = v.dateBalise as (m: string) => unknown;
          return [k, " ", balise(String(v.date))];
        },
      },
    );
  return { useTranslations: (ns: string) => fabrique(ns ?? "") };
});

import { ChiffreCle } from "@/components/article-v2/ChiffreCle";
import { RangeeChiffres } from "@/components/article-v2/RangeeChiffres";
import { CitationMiseEnAvant } from "@/components/article-v2/CitationMiseEnAvant";
import { Cartes } from "@/components/article-v2/Cartes";
import { Frise } from "@/components/article-v2/Frise";
import { Checklist } from "@/components/article-v2/Checklist";
import { Relance } from "@/components/article-v2/Relance";
import { ResumeFin } from "@/components/article-v2/ResumeFin";
import { NumeroSection } from "@/components/article-v2/NumeroSection";
import { Relecteur } from "@/components/article-v2/Relecteur";
import { HistoriqueMaj } from "@/components/article-v2/HistoriqueMaj";

const rendre = (n: React.ReactElement) => renderToStaticMarkup(n);

describe("briques complémentaires du socle", () => {
  it("rangée de chiffres : valeurs et source seulement si fournie", () => {
    const avec = rendre(
      <RangeeChiffres id="c" titre="Titre" source="Source réelle">
        <ChiffreCle valeur="45 %" libelle="du temps" />
      </RangeeChiffres>,
    );
    expect(avec).toContain("chiffres__valeur");
    expect(avec).toContain("Source réelle");
    const sans = rendre(
      <RangeeChiffres id="c" titre="Titre">
        <ChiffreCle valeur="1" libelle="x" />
      </RangeeChiffres>,
    );
    expect(sans).not.toContain('class="source"');
  });

  it("citation : jamais sans auteur", () => {
    expect(rendre(<CitationMiseEnAvant texte="Une phrase" auteur={null} />)).toBe("");
    const html = rendre(
      <CitationMiseEnAvant texte="Une phrase" auteur="Alex" fonction="Directeur" />,
    );
    expect(html).toContain("<blockquote>");
    expect(html).toContain("Alex, Directeur");
  });

  it("cartes, frise, liste de contrôle : rien si vides", () => {
    expect(rendre(<Cartes items={[]} />)).toBe("");
    expect(rendre(<Frise etapes={[]} />)).toBe("");
    expect(rendre(<Checklist items={[]} />)).toBe("");
    expect(rendre(<Cartes items={[{ titre: "T", texte: "x" }]} />)).toContain('class="carte"');
    expect(rendre(<Frise etapes={[{ titre: "T", texte: "x", duree: "1 j" }]} />)).toContain("<ol");
    expect(rendre(<Checklist items={["a"]} />)).toContain("<ul");
  });

  it("relance, résumé et numéro : textes depuis les messages, numéro masqué", () => {
    expect(rendre(<Relance>lien</Relance>)).toContain("Pour aller plus loin");
    const resume = rendre(<ResumeFin points={["a", "b"]} />);
    expect(resume).toContain("Ce qu’il faut retenir");
    expect(rendre(<ResumeFin points={[]} />)).toBe("");
    expect(rendre(<NumeroSection numero={3} />)).toContain('aria-hidden="true">03<');
  });

  it("relecteur et historique : rendus seulement avec une donnée réelle", () => {
    expect(rendre(<Relecteur nom={null} />)).toBe("");
    expect(rendre(<Relecteur nom="Alex" fonction="Formateur" />)).toContain("Relu et validé par");
    expect(rendre(<HistoriqueMaj entrees={[]} />)).toBe("");
    const h = rendre(
      <HistoriqueMaj
        entrees={[{ dateIso: "2026-11-01", dateLisible: "1 novembre", resume: "m" }]}
      />,
    );
    expect(h).toContain("<details");
    expect(h).toMatch(/datetime="2026-11-01"/i);
  });
});
