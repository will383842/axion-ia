/**
 * Contre-audit v5 de la PR #2194 (`geo/relectures/AUDIT-PR-RETRAIT-CORRECTIFS-v5.md`, dépôt
 * axion-plans-prive), points 1 à 3. Les phrases sont TIRÉES du vrai rapport
 * `geo/retrait/dry-run-2026-11-20/rapport.md` (numéros de ligne en commentaire).
 */
import { describe, expect, it } from "vitest";
import { INTERDITS_PUBLICS, appliquerOverrides, empreinte, type Proposition } from "./plan";

const refuse = (s: string) => INTERDITS_PUBLICS.test(s);

describe("v5 point 1 — « dispositif(s) » repris au sens financement : famille fermée", () => {
  it.each([
    "Ce dispositif : mobilisable par chaque salarié pour les formations certifiantes référencées sur France Compétences.", // l. 549, 19236
    "Ce dispositif s'applique sans condition de taille d'entreprise et couvre les formations en IA dès lors qu'elles sont réalisées par un prestataire déclaré.", // l. 7975
    "Ce dispositif est particulièrement pertinent pour les dirigeants de TPE à Gif-sur-Yvette.", // l. 18330
    "Ce dispositif est particulièrement pertinent dans le cadre d'une reconversion.", // l. 6312
    "La mobilisation de ces dispositifs dépend du statut du prestataire de formation et de la nature du contenu.", // l. 22794
    "Les entreprises de Champigny-sur-Marne peuvent mobiliser :", // l. 1514
    "Les dispositifs de France Num et de BPI France pour la numérisation des TPE/PME.", // l. 1517
    "France Compétences régule ce dispositif et publie la liste des organismes certifiés.", // l. 23738
    "Ces dispositifs permettent de rendre l'accès à la formation plus accessible.", // l. 2962
    "Nous vous orientons vers le dispositif adapté lors de notre audit flash initial.", // l. 554
    "Axion-IA vous aide à identifier le dispositif le plus adapté.", // l. 23002
    "La CCI peut vous orienter vers les dispositifs adaptés à votre taille et votre convention collective.", // l. 22586
    "Les dispositifs disponibles", // l. 16639
    "Explorer les dispositifs complémentaires", // l. 21200
    "…en complémentarité de ces dispositifs publics.", // l. 1781
    "Bpifrance propose également des accompagnements spécifiques : renseignez-vous sur les appels à projets en cours.", // l. 21201
    "Cadre réglementaire sécurisé (certification qualité via France Compétences).", // l. 269
    "Les collectivités proposent des dispositifs d'accompagnement à la numérisation.",
  ])("refuse : %s", (s) => expect(refuse(s)).toBe(true));

  it.each([
    "Ce dispositif de suivi permet d'objectiver les progrès.",
    "Une formation IA est un dispositif pédagogique.",
    "L'entrée dans notre dispositif commence par un audit.",
    "…en complémentarité de ces dispositifs consulaires.",
    "Ce suivi permet d'ajuster le dispositif.",
    "…sans mobiliser un budget formation complet.",
  ])("accepte (sens non financier) : %s", (s) => expect(refuse(s)).toBe(false));
});

describe("v5 point 2 — `valeurSale` normalise bien avant la porte 2 (via appliquerOverrides)", () => {
  const rejette = (valeur: string) => {
    const original = "Texte original sans mention.";
    const proposition: Proposition = {
      cle: "article_translation:x",
      table: "article_translation",
      id: "x",
      avant: { excerpt: original },
      apres: {},
      ambigus: ["article_translation:x.excerpt : ambigu"],
      conserves: [],
    };
    const r = appliquerOverrides(
      proposition,
      { excerpt: original },
      { "article_translation:x": { excerpt: { origine: empreinte(original), valeur } } },
    );
    expect(r.proposition.apres.excerpt).toBeUndefined();
    expect(r.ignores.join("\n")).toMatch(/interdit public/);
  };

  it("tiret U+2010 : « prise‐en‐charge totale » est refusée", () =>
    rejette("Une prise‐en‐charge totale."));
  it("espace insécable : « France Travail » est refusée", () =>
    rejette("Contactez France Travail."));
});
