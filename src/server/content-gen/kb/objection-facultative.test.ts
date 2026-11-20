// @vitest-environment node
/**
 * Lot 3 du retrait des promesses de suivi : la paire `objection` / `objectionReply` est
 * facultative. Quand elle manque, les pages secteurs n'affichent ni le bloc « Votre
 * objection, notre réponse » ni l'entrée FAQ correspondante (pas de titre vide, pas de
 * question sans réponse, pas de FAQPage vide).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SECTOR_PAIN_MATRIX,
  getObjectionFaq,
  getSectorPainContext,
  serializePainContextForPrompt,
  type SectorPainContext,
} from "./sector-pain-matrix";

describe("objection facultative — comptabilite_finance / interventions-formations", () => {
  const pain = getSectorPainContext("comptabilite_finance", "interventions_formations");

  it("l'entrée existe toujours (la page reste indexable)", () => {
    expect(pain).toBeDefined();
    expect(pain!.painStatement.length).toBeGreaterThan(20);
  });

  it("elle ne porte plus de paire objection/réponse", () => {
    expect(pain!.objection).toBeUndefined();
    expect(pain!.objectionReply).toBeUndefined();
    expect(getObjectionFaq(pain!)).toBeNull();
  });

  it("aucune entrée n'a une moitié de paire", () => {
    for (const e of SECTOR_PAIN_MATRIX) {
      expect(Boolean(e.objection), `${e.secteur}/${e.verticale}`).toBe(Boolean(e.objectionReply));
    }
  });

  it("toute entrée avec paire complète produit un item FAQ non vide", () => {
    for (const e of SECTOR_PAIN_MATRIX.filter((x) => x.objection && x.objectionReply)) {
      const item = getObjectionFaq(e);
      expect(item?.question.length).toBeGreaterThan(0);
      expect(item?.answer.length).toBeGreaterThan(0);
    }
  });
});

describe("pages secteurs — lecture gardée de la paire", () => {
  const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const activite = lire("src/app/[locale]/secteurs/[secteur]/[activite]/page.tsx");
  const hub = lire("src/app/[locale]/secteurs/[secteur]/page.tsx");

  it("la page activité n'affiche le bloc objection que si la paire existe", () => {
    expect(activite).toMatch(/\{objectionFaq \? \(\s*<Section/);
    expect(activite).toMatch(/const faqJsonLd = objectionFaq \? buildFaqJsonLd/);
    expect(activite).not.toMatch(/\{pain\.objection(Reply)?\}/);
  });

  it("le hub filtre les entrées sans paire et masque la section FAQ vide", () => {
    expect(hub).not.toMatch(/a\.pain!\.objection\b/);
    expect(hub).toMatch(/\{faqItems\.length > 0 \? \(\s*<Section/);
    expect(hub).toMatch(/const faqJsonLd = faqItems\.length > 0 \? buildFaqJsonLd/);
    expect(hub).toMatch(/\{faqJsonLd \? <JsonLd data=\{faqJsonLd\} scriptId="jsonld-secteur-faq"/);
  });
});

describe("prompt de génération — la paire absente ne laisse aucune trace", () => {
  /** Sortie de `serializePainContextForPrompt` telle qu'elle était avant la garde (copie de `main`). */
  const sortieDeMain = (ctx: SectorPainContext): string =>
    `
=== CONTEXTE MÉTIER OBLIGATOIRE — À UTILISER, PAS À PARAPHRASER ===

SECTEUR CLIENT : ${ctx.secteur.replace(/_/g, " ")}
OFFRE AXION-IA : ${ctx.verticale.replace(/_/g, " ")}

DOULEUR RÉELLE DU CLIENT :
"${ctx.painStatement}"

BÉNÉFICE CHIFFRÉ À METTRE EN AVANT :
"${ctx.benefitMeasured}"

SCÉNARIO AVANT (vie d'avant — à rendre concret dans le contenu) :
"${ctx.beforeScenario}"

SCÉNARIO APRÈS (vie d'après — à rendre concret dans le contenu) :
"${ctx.afterScenario}"

VOCABULAIRE MÉTIER À UTILISER (jamais le jargon tech) :
${ctx.sectorLexicon.join(", ")}

OBJECTION PRINCIPALE ET RÉPONSE :
Objection : "${ctx.objection}"
Réponse : "${ctx.objectionReply}"

KPI QUI PARLE À CE CLIENT : ${ctx.kpiLabel}

=== RÈGLES RÉDACTIONNELLES ABSOLUES ===
1. Chaque paragraphe doit utiliser au moins 1 mot du vocabulaire métier ci-dessus
2. Mentionner le bénéfice chiffré dans les 150 premiers mots
3. Inclure le scénario avant/après sous forme narrative (pas de liste)
4. Traiter l'objection principale dans le corps du texte
5. JAMAIS : "innovant", "révolutionnaire", "puissant", "solution IA", "intelligence artificielle de pointe"
6. TOUJOURS : nommer la tâche concrète, puis le gain, puis la preuve ou le chiffre
`.trim();

  it("aucun prompt ne reçoit « undefined » ni de bloc objection vide", () => {
    for (const e of SECTOR_PAIN_MATRIX) {
      const s = serializePainContextForPrompt(e);
      expect(s, `${e.secteur}/${e.verticale}`).not.toContain("undefined");
      expect(s.includes("OBJECTION PRINCIPALE"), `${e.secteur}/${e.verticale}`).toBe(
        getObjectionFaq(e) !== null,
      );
    }
  });

  it("comptabilite_finance / interventions-formations : ni bloc, ni consigne sur l'objection", () => {
    const s = serializePainContextForPrompt(
      getSectorPainContext("comptabilite_finance", "interventions_formations")!,
    );
    expect(s).not.toContain("undefined");
    expect(s).not.toContain("OBJECTION PRINCIPALE");
    expect(s).not.toContain("Traiter l'objection principale");
    expect(s).toContain("\n4. JAMAIS :");
    expect(s).toContain("\n5. TOUJOURS :");
    expect(s).not.toMatch(/^6\. /m);
  });

  it("une entrée qui a la paire rend le prompt de main, octet pour octet", () => {
    const avecPaire = SECTOR_PAIN_MATRIX.filter((e) => getObjectionFaq(e) !== null);
    expect(avecPaire.length).toBeGreaterThan(40);
    for (const e of avecPaire) {
      expect(serializePainContextForPrompt(e), `${e.secteur}/${e.verticale}`).toBe(sortieDeMain(e));
    }
  });
});
