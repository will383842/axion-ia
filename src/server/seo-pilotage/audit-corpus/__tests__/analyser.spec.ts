/**
 * C2b — audit du corpus déjà publié (lecture seule).
 * Preuve : l'outil SIGNALE (pour un humain) ; il ne contient aucune écriture, aucun noindex,
 * aucune fusion, et `null` (donnée absente) n'est jamais traité comme 0.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyserCorpus, type PageCorpus } from "../analyser";
import { formaterRapport } from "../rapport";

const MAINTENANT = new Date("2026-11-27T00:00:00Z");
const ANCIEN = new Date("2026-06-01T00:00:00Z");
const RECENT = new Date("2026-11-20T00:00:00Z");

function page(p: Partial<PageCorpus> & { url: string }): PageCorpus {
  return {
    type: "article",
    titre: p.url,
    mots: 1200,
    impressions: 50,
    publieLe: ANCIEN,
    plan: [],
    texte: null,
    villeNom: null,
    ...p,
  };
}

describe("faible valeur", () => {
  it("article très court signalé, article long non", () => {
    const r = analyserCorpus(
      [page({ url: "/fr/blog/court", mots: 180 }), page({ url: "/fr/blog/long", mots: 1500 })],
      MAINTENANT,
    );
    const codes = r.signalements.filter((s) => s.code === "faible_valeur").map((s) => s.url);
    expect(codes).toEqual(["/fr/blog/court"]);
  });
  it("nombre de mots inconnu : pas de signalement, compté indisponible", () => {
    const r = analyserCorpus([page({ url: "/fr/blog/x", mots: null })], MAINTENANT);
    expect(r.signalements.some((s) => s.code === "faible_valeur")).toBe(false);
    expect(r.donneesIndisponibles.mots).toBe(1);
  });
});

describe("sans impression", () => {
  it("0 impression sur une page ancienne : signalée", () => {
    const r = analyserCorpus([page({ url: "/fr/blog/a", impressions: 0 })], MAINTENANT);
    expect(r.signalements.map((s) => s.code)).toContain("sans_impression");
  });
  it("0 impression mais page récente : laissée au temps", () => {
    const r = analyserCorpus(
      [page({ url: "/fr/blog/a", impressions: 0, publieLe: RECENT })],
      MAINTENANT,
    );
    expect(r.signalements.some((s) => s.code === "sans_impression")).toBe(false);
  });
  it("null ≠ 0 : source absente, aucun signalement, comptée indisponible", () => {
    const r = analyserCorpus([page({ url: "/fr/blog/a", impressions: null })], MAINTENANT);
    expect(r.signalements.some((s) => s.code === "sans_impression")).toBe(false);
    expect(r.donneesIndisponibles.impressions).toBe(1);
  });
});

describe("doublon de plan", () => {
  const plan = [
    "Qu'est-ce que l'IA",
    "Les avantages",
    "Les risques",
    "Comment démarrer",
    "Conclusion",
  ];
  it("deux articles au même plan (accents/casse/chiffres ignorés) : signalés l'un vers l'autre", () => {
    const r = analyserCorpus(
      [
        page({ url: "/fr/blog/a", plan }),
        page({ url: "/fr/blog/b", plan: plan.map((t) => t.toUpperCase() + " 2026") }),
        page({ url: "/fr/blog/c", plan: ["Autre", "Sujet", "Tout", "Différent", "Ici"] }),
      ],
      MAINTENANT,
    );
    const d = r.signalements.filter((s) => s.code === "doublon_plan");
    expect(d.map((s) => s.url).sort()).toEqual(["/fr/blog/a", "/fr/blog/b"]);
    expect(d.find((s) => s.url === "/fr/blog/a")?.liees).toEqual(["/fr/blog/b"]);
  });
  it("intertitres génériques (Conclusion, FAQ…) ne comptent pas : 2 titres propres + 3 génériques ≠ doublon", () => {
    const gen = ["Introduction", "Conclusion", "FAQ"];
    const r = analyserCorpus(
      [
        page({ url: "/fr/blog/a", plan: ["Alpha un", "Beta deux", ...gen] }),
        page({ url: "/fr/blog/b", plan: ["Alpha un", "Gamma trois", ...gen] }),
      ],
      MAINTENANT,
    );
    expect(r.signalements.some((s) => s.code === "doublon_plan")).toBe(false);
  });
  it("plan trop court pour juger : ignoré", () => {
    const r = analyserCorpus(
      [
        page({ url: "/fr/blog/a", plan: ["A", "B"] }),
        page({ url: "/fr/blog/b", plan: ["A", "B"] }),
      ],
      MAINTENANT,
    );
    expect(r.signalements.some((s) => s.code === "doublon_plan")).toBe(false);
  });
});

describe("pages villes quasi identiques", () => {
  const corps = (v: string) =>
    `Axion IA accompagne les entreprises de ${v} dans leur adoption de l'intelligence artificielle. ` +
    "Nos formations et audits couvrent la conformité, la sécurité des données, les cas d'usage métier, " +
    "la conduite du changement et la mesure du retour sur investissement pour les dirigeants et leurs équipes locales.";
  it("même texte au nom de ville près : signalées", () => {
    const r = analyserCorpus(
      [
        page({ url: "/fr/ville/lyon", type: "ville", villeNom: "Lyon", texte: corps("Lyon") }),
        page({
          url: "/fr/ville/nantes",
          type: "ville",
          villeNom: "Nantes",
          texte: corps("Nantes"),
        }),
        page({
          url: "/fr/ville/lille",
          type: "ville",
          villeNom: "Lille",
          texte:
            "Un texte local réellement différent sur les ports, les chantiers navals, l'université et un tissu de PME textiles reconverties.",
        }),
      ],
      MAINTENANT,
    );
    const v = r.signalements.filter((s) => s.code === "ville_quasi_identique");
    expect(v.map((s) => s.url).sort()).toEqual(["/fr/ville/lyon", "/fr/ville/nantes"]);
  });
});

describe("rapport et lecture seule", () => {
  it("le rapport dit qu'aucune URL n'est modifiée et reste vide sans signalement", () => {
    const md = formaterRapport(
      analyserCorpus([page({ url: "/fr/blog/ok" })], MAINTENANT),
      MAINTENANT,
    );
    expect(md).toContain("Lecture seule");
    expect(md).toContain("aucune URL");
    expect(md).toContain("Aucun signalement");
  });
  it("les fichiers de l'outil ne contiennent aucune écriture ni action sur les URL", () => {
    const fichiers = [
      join(process.cwd(), "src/server/seo-pilotage/audit-corpus/analyser.ts"),
      join(process.cwd(), "src/server/seo-pilotage/audit-corpus/rapport.ts"),
      join(process.cwd(), "scripts/audit-corpus-publie.ts"),
    ];
    for (const f of fichiers) {
      const src = readFileSync(f, "utf-8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^[ \t]*\/\/.*$/gm, "");
      expect(src).not.toMatch(/\.(create|update|updateMany|upsert|delete|deleteMany|createMany)\(/);
      expect(src).not.toMatch(/\$executeRaw|\$queryRawUnsafe|redirect\(|indexationTier\s*:/);
    }
  });
});
