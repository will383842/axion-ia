/**
 * C2 / C2c — « Arrêter la publication faible » (CONCEPTION-CHAINE-EDITORIALE-IA.md § 12).
 *
 * Preuve : un contenu généré n'est plus publié sans relecture humaine, par défaut,
 * y compris quand une ancienne configuration enregistrée dit encore « auto-publier ».
 */
import { describe, expect, it } from "vitest";
import { resolveJudgeOutcome } from "../judge-outcome";
import {
  autoPublicationBlogActive,
  autoPublicationNewsActive,
  plafondGenerationEffectif,
  relectureObligatoire,
  tierNaissancePublication,
  statutPageVilleApresGeneration,
} from "../relecture-obligatoire";
import { ARTICLES_MAX_JOUR_DEFAUT } from "../../scheduler/anti-burst";

const verdictPublier = {
  verdict: "publish" as const,
  judgeRan: true,
  reachedCap: false,
  doctrineCheckPassed: true,
};

describe("relecture obligatoire par défaut", () => {
  it("aucune politique : rien n'est auto-publié (blog et actualités)", () => {
    expect(autoPublicationBlogActive(undefined)).toBe(false);
    expect(autoPublicationBlogActive({})).toBe(false);
    expect(autoPublicationNewsActive({})).toBe(false);
    expect(relectureObligatoire({})).toBe(true);
  });

  it("ancienne config enregistrée (« true » partout) : reste en relecture sans l'autorisation explicite", () => {
    const ancienne = { factoryAutoPublishAllBlogTypes: true, newsAutoPublish: true };
    expect(autoPublicationBlogActive(ancienne)).toBe(false);
    expect(autoPublicationNewsActive(ancienne)).toBe(false);
  });

  it("retour arrière : autorisation explicite + interrupteur du type", () => {
    const retour = {
      publicationSansRelectureAutorisee: true,
      factoryAutoPublishAllBlogTypes: true,
      newsAutoPublish: true,
    };
    expect(autoPublicationBlogActive(retour)).toBe(true);
    expect(autoPublicationNewsActive(retour)).toBe(true);
    expect(autoPublicationNewsActive({ ...retour, newsAutoPublish: false })).toBe(false);
  });
});

describe("verdict du juge : un contenu validé par la machine va en relecture", () => {
  it("blog : « publish » sans politique → needs_review (avant : approved)", () => {
    expect(resolveJudgeOutcome({ ...verdictPublier, isRss: false, policies: {} })).toBe(
      "needs_review",
    );
  });
  it("actualité : « publish » sans politique → needs_review", () => {
    expect(resolveJudgeOutcome({ ...verdictPublier, isRss: true, policies: {} })).toBe(
      "needs_review",
    );
  });
  it("ancienne config « true » → needs_review", () => {
    expect(
      resolveJudgeOutcome({
        ...verdictPublier,
        isRss: false,
        policies: { factoryAutoPublishAllBlogTypes: true, newsAutoPublish: true },
      }),
    ).toBe("needs_review");
  });
  it("retour arrière explicite → approved", () => {
    expect(
      resolveJudgeOutcome({
        ...verdictPublier,
        isRss: false,
        policies: {
          publicationSansRelectureAutorisee: true,
          factoryAutoPublishAllBlogTypes: true,
        },
      }),
    ).toBe("approved");
  });
});

describe("tier de naissance", () => {
  it("relu par un humain → indexable", () => {
    expect(tierNaissancePublication({ reviewedBy: "user_1" })).toBe("tier_1_indexable");
  });
  it("jamais relu → plus de tier_1 forcé", () => {
    expect(tierNaissancePublication({ reviewedBy: null })).toBe("tier_2_noindex_follow");
    expect(tierNaissancePublication({ reviewedBy: "" })).toBe("tier_2_noindex_follow");
    expect(tierNaissancePublication({ reviewedBy: "   " })).toBe("tier_2_noindex_follow");
  });
});

describe("plafond de génération", () => {
  it("relecture obligatoire : plafonné à ARTICLES_MAX_JOUR_DEFAUT (3), même si la clé stockée dit 15", () => {
    expect(ARTICLES_MAX_JOUR_DEFAUT).toBe(3);
    expect(plafondGenerationEffectif({ maxPerDay: 15 }, {})).toBe(3);
    expect(plafondGenerationEffectif(null, {})).toBe(3);
  });
  it("jamais relevé : un plafond stocké plus bas reste", () => {
    expect(plafondGenerationEffectif({ maxPerDay: 1 }, {})).toBe(1);
  });
  it("retour arrière : plafond d'avant", () => {
    expect(
      plafondGenerationEffectif({ maxPerDay: 15 }, { publicationSansRelectureAutorisee: true }),
    ).toBe(15);
    expect(plafondGenerationEffectif(null, { publicationSansRelectureAutorisee: true })).toBe(20);
  });
});

describe("C2c — pages villes gabaritées", () => {
  it("note haute : reste « generated » (file de validation humaine), jamais « approved »", () => {
    expect(statutPageVilleApresGeneration({ qualityScore: 95, seuil: 70, env: {} })).toBe(
      "generated",
    );
  });
  it("retour arrière par variable d'environnement", () => {
    expect(
      statutPageVilleApresGeneration({
        qualityScore: 95,
        seuil: 70,
        env: { VILLES_AUTO_APPROBATION_ACTIVE: "true" },
      }),
    ).toBe("approved");
    expect(
      statutPageVilleApresGeneration({
        qualityScore: 60,
        seuil: 70,
        env: { VILLES_AUTO_APPROBATION_ACTIVE: "true" },
      }),
    ).toBe("generated");
  });
  it("valeur autre que « true » : relecture", () => {
    expect(
      statutPageVilleApresGeneration({
        qualityScore: 95,
        seuil: 70,
        env: { VILLES_AUTO_APPROBATION_ACTIVE: "1" },
      }),
    ).toBe("generated");
  });
});
