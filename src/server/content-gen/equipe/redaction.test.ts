import { describe, it, expect } from "vitest";
import {
  chiffresHorsDossier,
  consigneRedactionEquipe,
  controlerRedaction,
  type ContexteRedaction,
} from "./redaction";
import type { DossierPreuves, Preuve } from "../fact-check/verificateur-deux-phases";
import type { Plan } from "./plan";
import { JETON_PRIX_JOURNEE_IA } from "../brand/consigne-prix";

const ACTIF = { CONTENT_EQUIPE_EDITORIALE: "true" };
const preuve = (p: Partial<Preuve>): Preuve => ({
  affirmation: "Les PME qui automatisent gagnent du temps",
  chiffre: "37 %",
  url: "https://exemple.fr/etude",
  titreSource: "Étude",
  extrait: "Selon l'étude, 37 % des PME interrogées ont gagné du temps en 2025.",
  consulteLe: "2026-11-01",
  expireLe: "2027-01-30",
  ...p,
});
const dossier = (preuves: Preuve[] = [preuve({})]): DossierPreuves => ({
  preuves,
  refusees: 0,
  recherches: 1,
  coutUsd: 0,
  sources: [],
});
const plan: Plan = {
  h1: "Que faut-il savoir ?",
  reponseDirecte: "Réponse.",
  sections: [
    { h2: "Premier point", questionCouverte: "Q1" },
    { h2: "Second point", questionCouverte: "Q2", preuve: "37 %" },
  ],
  faq: [],
};

describe("chiffresHorsDossier", () => {
  it("détecte un chiffre absent du dossier", () => {
    const r = chiffresHorsDossier("<p>Le gain atteint 52 % chez les PME.</p>", dossier());
    expect(r).toHaveLength(1);
    expect(r[0]).toContain("52 %");
  });

  it("accepte un chiffre présent dans le dossier (formats variés)", () => {
    expect(chiffresHorsDossier("<p>Un gain de 37 % mesuré.</p>", dossier())).toEqual([]);
    expect(chiffresHorsDossier("<p>Un gain de 37&nbsp;% mesuré.</p>", dossier())).toEqual([]);
    expect(chiffresHorsDossier("<p>Étude de 2025 sur les PME.</p>", dossier())).toEqual([]);
  });

  it("ignore le jeton de prix et la numérotation des titres", () => {
    const html = `<h2>1. Le cadrage</h2><h3>2) La suite</h3><p>La Journée IA coûte ${JETON_PRIX_JOURNEE_IA}.</p>`;
    expect(chiffresHorsDossier(html, dossier([]))).toEqual([]);
  });

  it("signale un prix en dur, une année et un effectif hors dossier", () => {
    const r = chiffresHorsDossier(
      "<p>Comptez 1 490 € par jour. En 2031, 250 salariés seront concernés.</p>",
      dossier(),
    );
    expect(r.length).toBeGreaterThanOrEqual(2);
  });

  it("ignore l'année de la date de publication", () => {
    const r = chiffresHorsDossier("<p>Mis à jour en 2026.</p>", dossier([]), {
      datePublication: new Date("2026-11-26T00:00:00Z"),
    });
    expect(r).toEqual([]);
  });

  it("sans dossier, tout chiffre est fautif", () => {
    expect(chiffresHorsDossier("<p>Soit 12 %.</p>", undefined)).toHaveLength(1);
  });
});

describe("consigneRedactionEquipe", () => {
  it("éteint : chaîne vide (consigne de rédaction inchangée)", () => {
    expect(consigneRedactionEquipe({ plan, dossier: dossier() }, {})).toBe("");
    expect(
      consigneRedactionEquipe({ plan, dossier: dossier() }, { CONTENT_EQUIPE_EDITORIALE: "1" }),
    ).toBe("");
  });

  it("allumé : instantané de la consigne", () => {
    expect(consigneRedactionEquipe({ plan, dossier: dossier() }, ACTIF)).toMatchInlineSnapshot(`
      "
      ## Règle d'écriture — pas de chiffre sans preuve (obligatoire)
      - N'écris AUCUN chiffre (pourcentage, montant, année, effectif, délai chiffré) qui ne figure pas dans le dossier de preuves ci-dessous.
      - S'il manque une preuve pour une affirmation, écris la phrase SANS chiffre.
      - Le prix s'écrit uniquement par le jeton \`{{price:journee-ia|flat}}\`, jamais en chiffres.
      - Vouvoie le lecteur ; phrases de 20 mots en moyenne au plus ; respecte les <h2> du plan, dans l'ordre.

      ### Plan validé
      1. Premier point
      2. Second point (preuve : 37 %)

      ### Dossier de preuves
      - Les PME qui automatisent gagnent du temps — chiffre : 37 % (https://exemple.fr/etude)
      "
    `);
  });

  it("allumé sans preuve : écrire sans chiffre", () => {
    const c = consigneRedactionEquipe({ plan, dossier: dossier([]) }, ACTIF);
    expect(c).toContain("aucune preuve");
    expect(c).toContain(JETON_PRIX_JOURNEE_IA);
  });
});

describe("controlerRedaction", () => {
  const phrases = (n: number) =>
    Array.from({ length: n }, () => "Une phrase courte ici.").join(" ");
  const corps = (h2: string[], extra = "") =>
    h2.map((t) => `<h2>${t}</h2><p>${phrases(120)}</p>`).join("") + extra;
  const ctx: ContexteRedaction = { plan, dossier: dossier() };

  it("éteint : aucun contrôle", () => {
    expect(controlerRedaction("<p>52 %</p>", ctx, {})).toEqual({ issues: [] });
  });

  it("rend les codes attendus", () => {
    const r = controlerRedaction(
      "<h2>Premier point</h2><p>Tu vois 52 % et tu sais. Tu es là.</p>",
      ctx,
      ACTIF,
    );
    const codes = r.issues.map((i) => i.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "chiffre-hors-dossier",
        "h2-hors-plan",
        "mots-insuffisants",
        "tutoiement",
      ]),
    );
  });

  it("accepte un texte conforme", () => {
    const r = controlerRedaction(corps(["Premier point", "Second point"]), ctx, ACTIF);
    expect(r.issues).toEqual([]);
  });

  it("signale des phrases trop longues", () => {
    const longue = `${Array.from({ length: 45 }, () => "mot").join(" ")}.`;
    const html = corps(
      ["Premier point", "Second point"],
      `<p>${longue} ${longue} ${longue}</p>`.repeat(100),
    );
    const r = controlerRedaction(html, ctx, ACTIF);
    expect(r.issues.map((i) => i.code)).toContain("phrases-trop-longues");
  });
});
