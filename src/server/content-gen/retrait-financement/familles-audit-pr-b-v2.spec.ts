/**
 * PR B — correctifs de `geo/relectures/AUDIT-RETRAIT-PR-B-v2.md` (R1 sur le vrai rapport, gardes R2/R3/R5,
 * phrase « Tarifs » unique, constantes de `phrases-standard.ts`). Fixtures VERBATIM du vrai rapport
 * (`familles.fixtures-reelles-v2.ts`) ; si le rapport complet est présent (`RAPPORT_RETRAIT` ou
 * `../axion-plans-prive`), les mêmes propriétés sont aussi vérifiées sur ses 856 cas.
 * Chaque test rougit si la garde qu'il vise est retirée (mutation vérifiée à la main).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type CasAmbigu,
  classerAmbigus,
  genererOverrides,
  lireRapport,
  rendreLotAgent,
} from "./familles";
import { BLOCS_REELS_V2 } from "./familles.fixtures-reelles-v2";
import { PHRASE_EN, PHRASE_FR, QUESTION_EN, QUESTION_FR } from "./phrases-standard";

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
const reduit = (s: string): string =>
  s
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/^…\s*|\s*…$/g, "")
    .trim()
    .toLowerCase();
const phraseDe = (m: string): string | null => {
  const x = /« (.*) »\s*$/.exec(m.replace(/^forme non prouvée \([^)]*\) : /, ""));
  return x ? reduit(x[1]!) : null;
};
const cleChamp = (c: { cle: string; champ: string }): string => `${c.cle}|${c.champ}`;

/** Propriétés R1 : vérifiées sur un jeu de cas (fixtures ou vrai rapport complet). */
function verifierR1(cas: CasAmbigu[]): void {
  const s = genererOverrides(cas);
  const zones = s.auto.filter((e) => e.famille === "F4");
  // 1. aucune phrase du lot de l'agent n'est dans une zone automatique du même (contenu, champ)
  for (const c of s.agent) {
    const p = phraseDe(c.cas.message);
    if (p === null) continue;
    for (const e of zones.filter(
      (z) => cleChamp({ cle: z.contenu, champ: z.champ }) === cleChamp(c.cas),
    ))
      expect(reduit(e.origine).includes(p.slice(0, 80)), `doublon ${c.cas.cle} : ${p}`).toBe(false);
  }
  // 2. toute phrase F5 se retrouve dans une zone automatique, un passage du lot ou un cas à la main
  const lot = rendreLotAgent(s)
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { cle: string; champ: string; passage: string });
  for (const c of classerAmbigus(cas).filter((x) => x.famille === "F5")) {
    const p = phraseDe(c.cas.message);
    if (p === null) continue;
    const k = p.slice(0, 80);
    const k2 = cleChamp(c.cas);
    const ok =
      zones.some(
        (e) => cleChamp({ cle: e.contenu, champ: e.champ }) === k2 && reduit(e.origine).includes(k),
      ) ||
      lot.some((l) => cleChamp(l) === k2 && reduit(l.passage).includes(k)) ||
      s.aLaMain.some((m) => cleChamp(m.cas) === k2 && reduit(m.cas.passage).includes(k));
    expect(ok, `phrase F5 orpheline ${c.cas.cle} : ${p}`).toBe(true);
  }
}

describe("R1 — vrai rapport : pas de doublon F6/zone, pas de phrase F5 orpheline", () => {
  it("fixtures réelles (Romainville, audit-v2, Draveil, article à deux zones)", () =>
    verifierR1(rapportDe(BLOCS_REELS_V2)));

  it("la phrase citée SANS sa parenthèse « (AIF) » est reconnue dans la zone automatique", () => {
    const s = genererOverrides(rapportDe(BLOCS_REELS_V2));
    const zone = s.auto.find((e) => e.contenu.endsWith("1b177a821b4c"));
    expect(zone?.origine).toContain("(AIF)");
    expect(s.agent.some((c) => c.cas.cle.endsWith("1b177a821b4c"))).toBe(false);
  });

  it("Romainville : la phrase F5 dont la section part à l'agent reste dans le passage de l'agent", () => {
    const s = genererOverrides(rapportDe(BLOCS_REELS_V2));
    const lot = rendreLotAgent(s)
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { cle: string; passage: string; phrase: string | null });
    const rom = lot.filter((l) => l.cle.endsWith("2a4698c54d23"));
    expect(rom.length).toBeGreaterThan(0);
    expect(rom.some((l) => reduit(l.passage).includes("aide individuelle à la formatio"))).toBe(
      true,
    );
  });

  const chemin =
    process.env.RAPPORT_RETRAIT ??
    join(
      process.cwd(),
      "..",
      "axion-plans-prive",
      "geo",
      "retrait",
      "dry-run-2026-11-20",
      "rapport.md",
    );
  it.skipIf(!existsSync(chemin))("rapport complet (856 cas) : mêmes propriétés", () =>
    verifierR1(lireRapport(readFileSync(chemin, "utf8"))),
  );
});

describe("R2 — gardes de zone automatique : chacune a son test", () => {
  const T = "Financement et prise en charge";
  const zone = (corps: string[]): CasAmbigu[] =>
    rapportDe([
      {
        cle: "article_translation:00000000-0000-4000-8000-000000000001",
        champ: "body",
        message: `section « ${T} » : financement mêlé à un autre sujet, à relire`,
        lignes: ["Un titre précédent", T, ...corps, "Un titre suivant"],
      },
    ]);
  const autoDe = (cas: CasAmbigu[]) => genererOverrides(cas).auto.filter((e) => e.famille === "F4");

  it("référence : une zone 100 % financement, sans chiffre ni nom propre, part en automatique", () => {
    expect(
      autoDe(zone(["Les OPCO peuvent assurer une prise en charge de la formation."])),
    ).toHaveLength(1);
  });
  it("nom propre perdu (Draveil, section « Exemple de financement ») : à l'agent, jamais en automatique", () => {
    const s = genererOverrides(rapportDe(BLOCS_REELS_V2));
    expect(s.auto.some((e) => e.origine.startsWith("Exemple de financement"))).toBe(false);
    expect(
      s.agent.some(
        (c) => c.famille === "F4" && c.cas.message.includes("« Exemple de financement »"),
      ),
    ).toBe(true);
  });
  it("nom propre perdu (synthétique) : une ville dans la zone empêche l'automatique", () => {
    expect(
      autoDe(zone(["Les OPCO peuvent assurer une prise en charge pour une PME de Draveil."])),
    ).toHaveLength(0);
  });
  it("chiffre perdu : une zone qui contient « 3 jours » va à l'agent", () => {
    expect(
      autoDe(zone(["Les OPCO peuvent assurer une prise en charge de la formation de 3 jours."])),
    ).toHaveLength(0);
  });
  it("libellé d'encadré (« À noter ») : n'est pas un titre, la zone va jusqu'au vrai titre suivant", () => {
    // « À noter » n'est pas visée : sans la liste des encadrés elle couperait la section avant et la zone partirait en automatique.
    expect(
      autoDe(
        zone([
          "Les OPCO peuvent assurer une prise en charge de la formation.",
          "À noter",
          "Les délais varient selon la branche.",
        ]),
      ),
    ).toHaveLength(0);
  });
  it("phrase F6 contenue dans une zone automatique (titre répété plus haut dans le passage) : écartée du lot", () => {
    const cle = "article_translation:00000000-0000-4000-8000-000000000002";
    const T = "Financement et prise en charge";
    const C1 = "Les OPCO peuvent assurer une prise en charge de la formation.";
    const s = genererOverrides(
      rapportDe([
        {
          cle,
          champ: "body",
          message: `section « ${T} » : financement mêlé à un autre sujet, à relire`,
          lignes: ["Un titre précédent", T, C1],
        },
        {
          cle,
          champ: "body",
          message: `phrase mixte sans coupure propre : « ${C1} »`,
          lignes: [T, "Texte sans rapport.", "Autre titre", T, C1],
        },
      ]),
    );
    expect(s.auto.filter((e) => e.famille === "F4")).toHaveLength(1);
    expect(s.agent.some((c) => c.famille === "F6")).toBe(false);
  });
  it("le filtre « zone automatique » : aucun cas F4 de l'agent n'a le titre d'une zone automatique du même champ", () => {
    const s = genererOverrides(rapportDe(BLOCS_REELS_V2));
    const zones = s.auto.filter((e) => e.famille === "F4");
    expect(zones.length).toBeGreaterThan(0);
    for (const c of s.agent.filter((x) => x.famille === "F4"))
      for (const z of zones.filter(
        (e) => cleChamp({ cle: e.contenu, champ: e.champ }) === cleChamp(c.cas),
      ))
        expect(c.cas.message).not.toContain(`« ${z.origine.split("\n")[0]} »`);
  });
  it("tri du lot et de la liste « à la main » : l'ordre d'entrée ne change pas un octet", () => {
    const a = genererOverrides(rapportDe(BLOCS_REELS_V2));
    const b = genererOverrides(rapportDe([...BLOCS_REELS_V2].reverse()));
    expect(a.agent.length).toBeGreaterThanOrEqual(3);
    expect(new Set(a.agent.map((c) => c.cas.cle)).size).toBeGreaterThanOrEqual(2);
    expect(rendreLotAgent(b)).toBe(rendreLotAgent(a));
    expect(b.aLaMain.map((c) => cleChamp(c.cas))).toEqual(a.aLaMain.map((c) => cleChamp(c.cas)));
  });
});

describe("R1/R2 — une seule phrase « Tarifs » par article", () => {
  it("deux zones automatiques du même (contenu, champ) : une seule porte la phrase, l'autre est supprimée", () => {
    const zones = genererOverrides(rapportDe(BLOCS_REELS_V2)).auto.filter(
      (e) => e.famille === "F4" && e.contenu.endsWith("70ea0e1e9193"),
    );
    expect(zones).toHaveLength(2);
    expect(zones.filter((z) => z.remplacement === PHRASE_FR)).toHaveLength(1);
    const supprimee = zones.find((z) => z.remplacement === "")!;
    expect(supprimee.consignes.join(" ")).toContain("remplacement vide");
    expect(supprimee.raison).toContain("supprimée");
  });
  it("une zone seule garde la phrase standard", () => {
    const zones = genererOverrides(rapportDe(BLOCS_REELS_V2)).auto.filter(
      (e) => e.famille === "F4" && e.contenu.endsWith("82fb5da1845a"),
    );
    expect(zones.map((z) => z.remplacement)).toEqual([PHRASE_FR]);
  });
});

describe("R3 — consigne sur la réponse réelle d'un élément faqJson", () => {
  it("la consigne exige la réponse d'origine à l'espace près, sinon refus", () => {
    const Q = "Comment financer ma formation en prompt engineering ?";
    const R =
      "Vous pouvez utiliser votre Compte Personnel de Formation (CPF) ou bénéficier de l'Aide Individuelle à la Formation (AIF) de France Travail.";
    const FIN = "FAQ à relire (question de financement, réponse mêlée à un autre sujet)";
    const cas = rapportDe([
      {
        cle: "article:40fde4bb-2aed-4955-8085-6640c5cfdb13",
        champ: "faqJson",
        message: `${FIN} : « ${Q} »`,
        lignes: [Q],
      },
      {
        cle: "faq:4787d956-5967-4111-a7e7-c3b5057cab8a",
        champ: "answerFr",
        message: `${FIN} : « ${Q} »`,
        lignes: [R],
      },
    ]);
    const e = genererOverrides(cas).auto.find((x) => x.portee === "element-faqJson");
    expect(e?.consignes.join(" ")).toMatch(/REFUSER[^.]*à la main/);
    expect(e?.consignes.join(" ")).toContain("reponseOrigine");
  });
});

describe("Point 4 — les quatre constantes de phrases-standard.ts sont acceptées et figées", () => {
  it("PHRASE_FR (validée le 20/11), PHRASE_EN, QUESTION_FR (validée le 20/11) et QUESTION_EN", () => {
    expect(PHRASE_FR).toBe(
      "Tarifs : sur devis, établi après un Diagnostic IA gratuit de 45 minutes.",
    );
    expect(PHRASE_EN).toBe(
      "Pricing: a fixed quote, set after a free 45-minute AI Diagnostic call.",
    );
    expect(QUESTION_FR).toBe("Comment obtenir un devis ?");
    expect(QUESTION_EN).toBe("How do I get a quote?");
  });
});
