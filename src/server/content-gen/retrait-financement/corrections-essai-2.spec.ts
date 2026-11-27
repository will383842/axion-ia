/**
 * Correctifs B1 et B2 de `geo/relectures/AUDIT-DRY-RUN-V2.md` (essai à blanc n° 2, 20/11/2026).
 * Les phrases sont TIRÉES du vrai rapport `geo/retrait/dry-run-2026-11-20-v2/rapport.md` (axion-plans-prive) :
 * extraits mot pour mot, sans texte inventé. Chaque test rougit si la correction qu'il vise est retirée.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type CasAmbigu, genererOverrides, lireRapport } from "./familles";
import { INTERDITS_PUBLICS as depuisPlan, normaliserPourPorte2 as normDepuisPlan } from "./plan";
import { INTERDITS_PUBLICS, normaliserPourPorte2 } from "./porte2";
import { proposerArticle, proposerTraduction, type LigneTraduction } from "./plan";
import { classer, reecrireHtml, reecrireTexte } from "./regles";

// ───────────────────────────── B1 : le moteur ne laisse plus une phrase de financement ─────────────────────────────

/** `article:720266b0…` (Ajaccio), `directAnswer` : contexte avant/après du rapport (l. 53 et 14230+). */
const DIRECT_ANSWER_AJACCIO =
  "Choisissez un format adapté (1 à 3 jours), mobilisez les financements disponibles (OPCO, CPF), puis pilotez l'adoption avec des indicateurs concrets sur 90 jours.";

describe("B1 — conditionnelsRestants : le reste de la phrase passe la porte 2", () => {
  it("directAnswer d'Ajaccio : « mobilisez les financements disponibles » reste → AMBIGU, pas « à réécrire »", () => {
    const r = reecrireTexte(DIRECT_ANSWER_AJACCIO, "fr");
    expect(classer(r)).toBe("ambigu");
    expect(r.modifie).toBe(false);
    expect(r.ambigus[0]).toMatch(/^mention restante/);
    expect(r.ambigus[0]).toContain("mobilisez les financements disponibles");
  });

  it("M1 (HTML) : « financements via les Opérateurs de Compétences » reste après « (OPCO) » → ambigu", () => {
    const r = reecrireHtml(
      "<p>Les entreprises peuvent bénéficier de financements via les Opérateurs de Compétences (OPCO) dès lors que le prestataire est référencé.</p>",
      "fr",
    );
    expect(classer(r)).toBe("ambigu");
    expect(r.ambigus[0]).toMatch(/^mention restante/);
  });

  it("M2 (HTML) : « ouvre des droits à financement » reste après « (OPCO) » → ambigu", () => {
    const r = reecrireHtml(
      "<p>Cela garantit un niveau de qualité minimal et ouvre des droits à financement (OPCO) pour les entreprises qui y recourent.</p>",
      "fr",
    );
    expect(classer(r)).toBe("ambigu");
    expect(r.ambigus[0]).toMatch(/^mention restante/);
  });

  it("une phrase PURE de financement (encore visée après le fragment) garde le traitement d'avant : retirée, sans ambigu de porte 2", () => {
    const r = reecrireHtml("<p>Intro.</p><p>Dossier AIF (CPF).</p><p>Suite.</p>", "fr");
    expect(classer(r)).toBe("a-reecrire");
    expect(r.ambigus).toEqual([]);
  });
});

describe("B1 — plan : la valeur FINALE de chaque champ passe la porte 2, modifié ou non", () => {
  const ligne = (body: string): LigneTraduction => ({
    id: "00000000-0000-4000-8000-0000000000aa",
    locale: "fr",
    title: "Formation IA",
    excerpt: null,
    body,
    bodyJson: null,
    bodyText: null,
    metaTitle: null,
    metaDescription: null,
    ogImageAlt: null,
  });

  it.each([
    // phrases du constat 4 de l'audit (champ NON touché par le moteur) — rapport v2
    "Un organisme non certifié peut proposer une formation de qualité, mais le financement public sera impossible.",
    "Présence dans les Hauts-de-France, parcours souvent cofinancés.",
    "Un socle pour obtenir des financements",
  ])(
    "champ non touché : « %s » → ambigu « mention restante (porte 2) » qui cite la phrase",
    (phrase) => {
      const p = proposerTraduction(ligne(`<p>Introduction sans rapport.</p><p>${phrase}</p>`));
      expect(p).not.toBeNull();
      expect(p!.apres).toEqual({});
      const a = p!.ambigus.find((x) => x.startsWith("article_translation:") && x.includes(".body"));
      expect(a).toMatch(/mention restante \(porte 2/);
      expect(a).toContain(phrase);
    },
  );

  it("champ court non touché (directAnswer) : la phrase est signalée", () => {
    const p = proposerArticle({
      id: "00000000-0000-4000-8000-0000000000bb",
      directAnswer: "Présence dans les Hauts-de-France, parcours souvent cofinancés.",
      faqJson: null,
      keyTakeaway: null,
      expertQuoteText: null,
      featuredImageAltFr: null,
      featuredImageAltEn: null,
    });
    expect(p?.ambigus[0]).toMatch(/directAnswer : mention restante \(porte 2/);
  });

  it("champ modifié par le moteur : la valeur FINALE est contrôlée (directAnswer d'Ajaccio)", () => {
    const p = proposerArticle({
      id: "720266b0-c47c-4da6-a1aa-822ccb50591e",
      directAnswer: DIRECT_ANSWER_AJACCIO,
      faqJson: null,
      keyTakeaway: null,
      expertQuoteText: null,
      featuredImageAltFr: null,
      featuredImageAltEn: null,
    });
    expect(p?.apres.directAnswer).toBeUndefined();
    // une seule fois : la phrase citée par le moteur n'est pas répétée par le contrôle de la porte 2
    expect(p?.ambigus).toHaveLength(1);
    expect(p?.ambigus[0]).toContain("directAnswer : mention restante");
  });

  it("FAQ déjà ambiguë : bloquée en bloc, la porte 2 ne la découpe pas en phrases", () => {
    const p = proposerArticle({
      id: "00000000-0000-4000-8000-0000000000cc",
      directAnswer: null,
      faqJson: [
        {
          question: "Comment financer une formation IA ?",
          answer:
            "Les formations peuvent être financées par les OPCO. Axion-IA vous propose un audit gratuit.",
        },
      ],
      keyTakeaway: null,
      expertQuoteText: null,
      featuredImageAltFr: null,
      featuredImageAltEn: null,
    });
    expect(p?.ambigus.length).toBeGreaterThan(0);
    expect(p?.ambigus.every((x) => !x.includes("(porte 2"))).toBe(true);
  });

  it("champ réécrit proprement : c'est la valeur FINALE qui est contrôlée, pas l'origine", () => {
    const p = proposerTraduction(ligne("<p>Intro.</p><p>Dossier AIF (CPF).</p><p>Suite.</p>"));
    expect(p?.ambigus).toEqual([]);
    expect(p?.apres.body).toBeDefined();
  });

  it("emplois admis : « finance » comme secteur reste propre, aucune proposition", () => {
    const p = proposerTraduction(
      ligne(
        "<p>Nous formons les équipes de la finance et les directeurs financiers à l'usage de l'IA.</p><p>Le secteur financier évolue vite.</p>",
      ),
    );
    expect(p).toBeNull();
  });

  it("un contenu sans mention reste sans proposition", () => {
    expect(
      proposerTraduction(ligne("<p>Une formation IA pour vos équipes commerciales.</p>")),
    ).toBeNull();
  });
});

describe("B1 — la porte 2 est un module sans import circulaire, exporté aussi par plan.ts", () => {
  it("le workflow copie porte2.ts dans le worker (regles.ts et plan.ts l'importent)", () => {
    const wf = readFileSync(
      join(process.cwd(), ".github/workflows/retrait-mentions-financement.yml"),
      "utf8",
    );
    expect(wf).toMatch(/for f in regles\.ts plan\.ts porte2\.ts; do/);
    expect(wf).toContain(
      "rules/porte2.ts '$WORKER':/app/src/server/content-gen/retrait-financement/porte2.ts",
    );
    for (const f of ["regles.ts", "plan.ts"])
      expect(readFileSync(join(__dirname, f), "utf8")).toContain('from "./porte2"');
  });

  it("mêmes objets", () => {
    expect(depuisPlan).toBe(INTERDITS_PUBLICS);
    expect(normDepuisPlan).toBe(normaliserPourPorte2);
  });
});

// ───────────────────────────── B2 : « mention restante » suit le chemin « forme non prouvée » ─────────────────────────────

interface Bloc {
  cle: string;
  champ: string;
  message: string;
  lignes: string[];
}
const bloc = (b: Bloc): string =>
  `- identifiant \`${b.cle}\` · champ \`${b.champ}\` : ${b.message}\n  - texte complet du passage :\n` +
  b.lignes.map((l) => `    > ${l}`).join("\n") +
  "\n";
const rapportDe = (blocs: Bloc[]): CasAmbigu[] =>
  lireRapport(
    "# Retrait — dry-run\n\n## Cas ambigus (à trancher)\n\n" +
      blocs.map(bloc).join("\n") +
      "\n## « prise en charge » conservées (hors financement)\n",
  );

const MSG = "mention restante après retrait d'un fragment (France Travail, CPF…) : ";
// Rapport v2, l. 1750-1757 : la phrase est ENTIÈRE dans la section F4 du même article.
const DANS_ZONE: Bloc[] = [
  {
    cle: "article_translation:b5efbe69-5863-40f7-b447-144c026e4253",
    champ: "body",
    message:
      "section « La formation IA est-elle éligible à des financements ? » : financement mêlé à un autre sujet, à relire",
    lignes: [
      "La formation IA est-elle éligible à des financements ?",
      "Oui, elle peut être financée par les OPCO, France Travail (AIF) et le plan de développement des compétences de l'entreprise.",
    ],
  },
  {
    cle: "article_translation:b5efbe69-5863-40f7-b447-144c026e4253",
    champ: "body",
    message: `${MSG}« Oui, elle peut être financée par les OPCO, France Travail (AIF) et le plan de développement des compétences de l'entreprise. »`,
    lignes: [
      "Oui, elle peut être financée par les OPCO, France Travail (AIF) et le plan de développement des compétences de l'entreprise.",
    ],
  },
];
// Rapport v2, l. 2096 : hors de toute zone automatique de son article.
const HORS_ZONE: Bloc = {
  cle: "article_translation:f5470d30-4143-4eb4-a5c6-0a36a14928d0",
  champ: "body",
  message: `${MSG}« Consultez les options de financement disponibles via les OPCO et France Travail (AIF) pour alléger le coût de la formation. »`,
  lignes: [
    "Consultez les options de financement disponibles via les OPCO et France Travail (AIF) pour alléger le coût de la formation.",
  ],
};

describe("B2 — « mention restante » : plus de cas « à la main » à tort", () => {
  it("phrase hors zone : va à l'agent (F6), pas à la main", () => {
    const s = genererOverrides(rapportDe([HORS_ZONE]));
    expect(s.aLaMain).toHaveLength(0);
    expect(s.agent.map((c) => c.famille)).toEqual(["F6"]);
  });

  it("phrase DANS une zone F4 automatique : aucun doublon ni à la main ni à l'agent", () => {
    const s = genererOverrides(rapportDe(DANS_ZONE));
    expect(s.auto.some((e) => e.famille === "F4")).toBe(true);
    expect(s.aLaMain).toHaveLength(0);
    expect(s.agent.filter((c) => c.cas.message.startsWith("mention restante"))).toHaveLength(0);
  });

  it("message de la porte 2 (B1) : même chemin que « mention restante » (F6)", () => {
    const s = genererOverrides(
      rapportDe([
        {
          ...HORS_ZONE,
          message:
            "mention restante après retrait d'un fragment (porte 2 : financement) : « Présence dans les Hauts-de-France, parcours souvent cofinancés. »",
          lignes: ["Présence dans les Hauts-de-France, parcours souvent cofinancés."],
        },
      ]),
    );
    expect(s.aLaMain).toHaveLength(0);
    expect(s.agent).toHaveLength(1);
  });

  it("un cas F7 qui cite une phrase déjà dans une zone F4 automatique est retiré (filtre étendu)", () => {
    const cas = rapportDe([
      DANS_ZONE[0]!,
      {
        ...DANS_ZONE[1]!,
        message:
          "verrou : mots non financiers perdus « Oui, elle peut être financée par les OPCO, France Travail (AIF) et le plan de développement des compétences de l'entreprise. »",
      },
    ]);
    const s = genererOverrides(cas);
    expect(s.aLaMain).toHaveLength(0);
  });

  const v2 =
    process.env.RAPPORT_RETRAIT_V2 ??
    join(
      process.cwd(),
      "..",
      "axion-plans-prive",
      "geo",
      "retrait",
      "dry-run-2026-11-20-v2",
      "rapport.md",
    );
  it.skipIf(!existsSync(v2))(
    "rapport v2 complet : aucun cas « mention restante » à la main, aucun F7 dans une zone F4",
    () => {
      const cas = lireRapport(readFileSync(v2, "utf8"));
      const s = genererOverrides(cas);
      expect(s.aLaMain.filter((c) => c.cas.message.startsWith("mention restante"))).toHaveLength(0);
      // aucune phrase « mention restante » ne disparaît : zone automatique, passage de l'agent ou cas à la main
      const sorties = [
        ...s.auto.map((e) => `${e.contenu}|${e.champ}|${e.origine}`),
        ...s.agent.map((c) => `${c.cas.cle}|${c.cas.champ}|${c.cas.passage}`),
        ...s.aLaMain.map((c) => `${c.cas.cle}|${c.cas.champ}|${c.cas.passage}`),
      ].map((x) =>
        x
          .replace(/\s*\([^)]*\)/g, "")
          .replace(/\s+/g, " ")
          .toLowerCase(),
      );
      for (const c of cas.filter((x) => x.message.startsWith("mention restante"))) {
        const m = /« (.*) »\s*$/.exec(c.message);
        const p = m![1]!
          .replace(/\s*\([^)]*\)/g, "")
          .replace(/\s+/g, " ")
          .toLowerCase()
          .slice(0, 60);
        expect(sorties.some((x) => x.startsWith(`${c.cle}|${c.champ}|`) && x.includes(p))).toBe(
          true,
        );
      }
      const reduit = (x: string): string =>
        x
          .replace(/\s*\([^)]*\)/g, "")
          .replace(/\s+/g, " ")
          .replace(/^…\s*|\s*…$/g, "")
          .trim()
          .toLowerCase();
      const zones = s.auto.filter((e) => e.famille === "F4");
      for (const c of s.aLaMain) {
        const m = /« (.*) »\s*$/.exec(c.cas.message);
        if (!m) continue;
        const p = reduit(m[1]!);
        if (p.length < 15) continue;
        for (const z of zones.filter((z) => z.contenu === c.cas.cle && z.champ === c.cas.champ))
          expect(reduit(z.origine).includes(p.slice(0, 80))).toBe(false);
      }
    },
  );
});
