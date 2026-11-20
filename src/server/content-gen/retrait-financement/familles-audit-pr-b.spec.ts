/**
 * PR B — correctifs de l'audit `geo/relectures/AUDIT-RETRAIT-PR-B.md` (R1 à R5).
 * Les fixtures de `BLOCS_REELS` sont tirées VERBATIM du vrai rapport du 20/11/2026.
 * Chaque test est écrit pour ROUGIR si la garde qu'il vise est retirée (mutation vérifiée à la main).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type CasAmbigu,
  classerAmbigus,
  genererOverrides,
  lireRapport,
  rendreALaMain,
  rendreLotAgent,
  rendreOverridesAuto,
} from "./familles";
import { BLOCS_REELS, type BlocReel } from "./familles.fixtures-reelles";

function bloc(b: BlocReel): string {
  return (
    `- identifiant \`${b.cle}\` · champ \`${b.champ}\` : ${b.message}\n  - texte complet du passage :\n` +
    b.lignes.map((l) => `    > ${l}`).join("\n") +
    "\n"
  );
}
const rapportDe = (blocs: BlocReel[]): CasAmbigu[] =>
  lireRapport(
    "# Retrait — dry-run\n\n## Cas ambigus (à trancher)\n\n" +
      blocs.map(bloc).join("\n") +
      "\n## « prise en charge » conservées (hors financement)\n",
  );
const reel = (id: string): BlocReel[] => BLOCS_REELS.filter((b) => b.cle.includes(id));
const FIN = "FAQ à relire (question de financement, réponse mêlée à un autre sujet)";
const faq = (cle: string, champ: string, q: string, lignes: string[]): BlocReel => ({
  cle,
  champ,
  message: `${FIN} : « ${q} »`,
  lignes,
});
describe("R1 — F5 détecté sur le format réel, plus de doublon avec une zone automatique", () => {
  const maurepas = reel("4a2b2b50");
  it("la phrase dont le cas n'imprime que le paragraphe (sans titre) est F5, pas F6", () => {
    const c = classerAmbigus(rapportDe(maurepas)).find(
      (x) =>
        x.cas.lignes.length === 1 && x.cas.message.includes("Nous vous recommandons de contacter"),
    );
    expect(c?.cas.message.startsWith("phrase mixte")).toBe(true);
    expect(c?.famille).toBe("F5");
  });
  it("« forme non prouvée (hors « A, B et X. »…) » : la phrase est lue après le préfixe, donc F5", () => {
    const np = classerAmbigus(rapportDe(maurepas)).filter((c) =>
      c.cas.message.startsWith("forme non prouvée"),
    );
    expect(np.length).toBeGreaterThan(0);
    expect(np.some((c) => c.famille === "F5")).toBe(true);
  });
  it("aucune phrase du lot agent n'est contenue dans une zone F4 remplacée automatiquement", () => {
    const s = genererOverrides(rapportDe(BLOCS_REELS));
    const zones = s.auto.filter((e) => e.famille === "F4");
    expect(zones.length).toBeGreaterThan(0);
    for (const c of s.agent) {
      const phrase = /« (.*) »\s*$/.exec(
        c.cas.message.replace(/^forme non prouvée \([^)]*\) : /, ""),
      )?.[1];
      if (!phrase) continue;
      for (const z of zones.filter((e) => e.contenu === c.cas.cle && e.champ === c.cas.champ))
        expect(z.origine.replace(/\s+/g, " ")).not.toContain(
          phrase.replace(/\s+/g, " ").slice(0, 60),
        );
    }
  });
  it("la phrase de la zone « Les OPCO : des interlocuteurs sectoriels » n'est pas dans le lot agent", () => {
    const s = genererOverrides(rapportDe(maurepas));
    expect(s.auto.map((e) => e.origine.split("\n")[0])).toContain(
      "Les OPCO : des interlocuteurs sectoriels",
    );
    const phrases = rendreLotAgent(s)
      .trim()
      .split("\n")
      .map((l) => (JSON.parse(l) as { phrase: string | null }).phrase ?? "");
    expect(phrases.some((p) => p.startsWith("Nous vous recommandons de contacter"))).toBe(false);
  });
});

describe("R2 — jamais de remplacement automatique au milieu d'une liste numérotée", () => {
  it.each(["7b27bdf6", "a597865b"])("article %s : « Étape 4 — … » va à la main", (id) => {
    const cas = rapportDe(reel(id));
    const s = genererOverrides(cas);
    const etape = cas.find((c) => c.message.startsWith("section « Étape 4"));
    expect(etape).toBeDefined();
    expect(s.auto.some((e) => e.origine.startsWith("Étape 4"))).toBe(false);
    expect(s.agent.some((c) => c.cas.message.startsWith("section « Étape 4"))).toBe(false);
    expect(s.aLaMain.some((c) => c.cas.message.startsWith("section « Étape 4"))).toBe(true);
    expect(rendreALaMain(s)).toContain("Étape 4");
  });
  it.each(["Étape 4 — X", "Step 2: X", "Phase 3 - X", "3. X", "2) X", "Partie 1 : X"])(
    "titre numéroté « %s » : F7",
    (t) => {
      const c = classerAmbigus(
        rapportDe([
          {
            cle: "article_translation:n",
            champ: "body",
            message: `section « ${t} » : financement mêlé à un autre sujet, à relire`,
            lignes: ["Un titre", t, "Les OPCO financent la formation."],
          },
        ]),
      );
      expect(c[0]!.famille).toBe("F7");
    },
  );
  it("un titre sans numéro reste F4", () => {
    const [c] = classerAmbigus(
      rapportDe([
        {
          cle: "article_translation:n",
          champ: "body",
          message:
            "section « Les financements OPCO » : financement mêlé à un autre sujet, à relire",
          lignes: ["Les financements OPCO", "Les OPCO financent la formation."],
        },
      ]),
    );
    expect(c!.famille).toBe("F4");
  });
});

describe("R3 — réponse d'origine d'un faqJson : jamais choisie entre deux réponses différentes", () => {
  const Q = "Comment financer ma formation en prompt engineering ?";
  const A1 =
    "Vous pouvez utiliser votre Compte Personnel de Formation (CPF) ou bénéficier de l'Aide Individuelle à la Formation (AIF) de France Travail.";
  const A2 =
    "Les entreprises peuvent explorer des financements via les OPCO, France Travail (AIF) et le plan de développement des compétences de l'entreprise.";
  const parent = faq("article:40fde4bb-2aed-4955-8085-6640c5cfdb13", "faqJson", Q, [Q]);
  const fille1 = faq("faq:4787d956-5967-4111-a7e7-c3b5057cab8a", "answerFr", Q, [A1]);
  const fille2 = faq("faq:65119f21-4d83-4c28-a352-cac2cb0fa73b", "answerFr", Q, [A2]);
  it("deux réponses différentes pour la même question : l'élément faqJson n'est pas automatique", () => {
    const s = genererOverrides(rapportDe([parent, fille1, fille2]));
    expect(s.auto.some((e) => e.champ === "faqJson")).toBe(false);
    expect(s.agent.some((c) => c.cas.champ === "faqJson" && c.famille === "F2")).toBe(true);
  });
  it("invariance à l'ordre d'entrée (mêmes octets)", () => {
    const f = (b: BlocReel[]) => {
      const s = genererOverrides(rapportDe(b));
      return rendreOverridesAuto(s) + rendreLotAgent(s) + rendreALaMain(s);
    };
    expect(f([parent, fille1, fille2])).toBe(f([fille2, fille1, parent]));
  });
  it("une seule réponse (ou des réponses identiques) : l'élément reste F1 avec la bonne réponse", () => {
    const s = genererOverrides(rapportDe([parent, fille1]));
    const e = s.auto.find((x) => x.champ === "faqJson");
    expect(e?.reponseOrigine).toBe(A1);
  });
});

describe("R4 — une garde, un test qui rougit sans elle", () => {
  afterEach(() => {
    vi.doUnmock("./phrases-standard");
    vi.resetModules();
  });
  const sectionFr = (titre: string, corps: string[]): BlocReel => ({
    cle: "article_translation:t",
    champ: "body",
    message: `section « ${titre} » : financement mêlé à un autre sujet, à relire`,
    lignes: ["Titre de l'article", titre, ...corps, "Comment démarrer ?", "Un Diagnostic IA."],
  });
  const VISEE =
    "Elle peut être financée par les OPCO, France Travail (AIF) et le plan de développement des compétences.";
  it("porte appelée à l'émission : une phrase standard contenant « OPCO » fait lever genererOverrides", async () => {
    vi.resetModules();
    vi.doMock("./phrases-standard", () => ({
      PHRASE_FR: "Tarifs : voir votre OPCO.",
      PHRASE_EN: "Pricing: a fixed quote.",
      QUESTION_FR: "Comment obtenir un devis ?",
      QUESTION_EN: "How do I get a quote?",
    }));
    const f = await import("./familles");
    const cas = f.lireRapport(
      "## Cas ambigus\n\n" + bloc(sectionFr("Les financements OPCO", [VISEE])) + "\n## Fin\n",
    );
    expect(() => f.genererOverrides(cas)).toThrow(/porte des interdits/);
  });
  it("F4 « 100 % » à la granularité de la ligne : une ligne non visée envoie la section à l'agent", () => {
    const s = genererOverrides(
      rapportDe([
        sectionFr("Les financements OPCO", [
          VISEE,
          "Notre équipe de formateurs anime des ateliers pratiques.",
        ]),
      ]),
    );
    expect(s.auto).toHaveLength(0);
    expect(s.agent.map((c) => c.famille)).toContain("F4");
  });
  it("la même section 100 % visée est automatique (contre-épreuve)", () => {
    const s = genererOverrides(rapportDe([sectionFr("Les financements OPCO", [VISEE])]));
    expect(s.auto.map((e) => e.famille)).toEqual(["F4"]);
  });
  it("lot agent : ensemble EXACT de clés, aucune proposition", () => {
    const s = genererOverrides(rapportDe(BLOCS_REELS));
    const lignes = rendreLotAgent(s).trim().split("\n");
    expect(lignes.length).toBeGreaterThan(0);
    for (const l of lignes)
      expect(Object.keys(JSON.parse(l) as object).sort()).toEqual(
        ["champ", "cle", "famille", "message", "passage", "phrase"].sort(),
      );
  });
  it("tri : ordre d'entrée inversé ⇒ mêmes octets pour les trois sorties", () => {
    const f = (b: BlocReel[]) => {
      const s = genererOverrides(rapportDe(b));
      return [rendreOverridesAuto(s), rendreLotAgent(s), rendreALaMain(s)];
    };
    expect(f([...BLOCS_REELS].reverse())).toEqual(f(BLOCS_REELS));
  });
  it("estFrancais : une section en anglais va à l'agent, jamais en automatique", () => {
    const s = genererOverrides(
      rapportDe([
        sectionFr("Funding options", [
          "The training can be funded through OPCO, France Travail (AIF) and the skills development plan of the company.",
        ]),
      ]),
    );
    expect(s.auto).toHaveLength(0);
  });
  it("limite de 6 blocs : une section de 7 blocs 100 % visés va à l'agent", () => {
    const sept = sectionFr(
      "Les financements OPCO",
      Array.from({ length: 7 }, () => VISEE),
    );
    const six = sectionFr(
      "Les financements OPCO",
      Array.from({ length: 6 }, () => VISEE),
    );
    expect(genererOverrides(rapportDe([sept])).auto).toHaveLength(0);
    expect(genererOverrides(rapportDe([six])).auto).toHaveLength(1);
  });
});

describe("R5 — bornes de la zone F4 : « jusqu'au titre de même niveau » écrit noir sur blanc", () => {
  it("la zone est EXACTEMENT `origine`, refus si la section HTML est plus longue", () => {
    const cas = rapportDe([
      {
        cle: "article_translation:t",
        champ: "body",
        message: "section « Les financements OPCO » : financement mêlé à un autre sujet, à relire",
        lignes: [
          "Titre de l'article",
          "Les financements OPCO",
          "Elle peut être financée par les OPCO, France Travail (AIF) et le plan de développement des compétences.",
          "Comment démarrer ?",
        ],
      },
    ]);
    const e = genererOverrides(cas).auto[0]!;
    expect(e.zoneEstimee).toBe(true);
    const texte = e.consignes.join("\n");
    expect(texte).toMatch(/EXACTEMENT `origine`/);
    expect(texte).toMatch(/jusqu'au titre de même niveau[^]*REFUSER/);
    expect(texte).not.toMatch(/\(jusqu'au titre de même niveau\) deviennent/);
  });
});
