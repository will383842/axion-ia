// I2-0 : le jeton d'opposition est posé AU DÉPART par le worker, pas au rendu.
// Tests 1 à 5 du plan : module pur + rendu réel des deux gabarits de réponse.
import { describe, it, expect, beforeEach } from "vitest";
import {
  REPERE_JETON_OPPOSITION,
  urlRepereOpposition,
  poserJetonOpposition,
} from "../opposition-differee";
import { jetonOpposition, urlOpposition } from "../opposition-jeton";
import { renderEmailTemplate } from "@/lib/email/templates";

beforeEach(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  delete process.env["OPPOSITION_JETON_V2"];
});

const corpsAvecRepere = () => ({
  html: `<p><a href="${urlRepereOpposition()}">Se désinscrire</a></p>`,
  text: `Se désinscrire : ${urlRepereOpposition()}`,
});

describe("poserJetonOpposition", () => {
  it("1 : remplace le repère dans le HTML et dans le texte", () => {
    const jeton = jetonOpposition("nadia@exemple.fr");
    const r = poserJetonOpposition(corpsAvecRepere(), jeton);
    expect(r.poses).toBeGreaterThanOrEqual(2);
    expect(r.html).not.toContain(REPERE_JETON_OPPOSITION);
    expect(r.text).not.toContain(REPERE_JETON_OPPOSITION);
    expect(r.html).toContain(`token=${encodeURIComponent(jeton)}`);
    expect(r.text).toContain(`token=${encodeURIComponent(jeton)}`);
  });

  it("2 : corps sans repère (ligne ancienne) : identique, poses = 0", () => {
    const c = { html: "<p>x</p>", text: "x" };
    expect(poserJetonOpposition(c, "op1.a.b")).toEqual({ ...c, poses: 0 });
  });

  it("3 : idempotente, et la base d'URL reste alignée sur urlOpposition", () => {
    const jeton = jetonOpposition("nadia@exemple.fr");
    const une = poserJetonOpposition(corpsAvecRepere(), jeton);
    const deux = poserJetonOpposition({ html: une.html, text: une.text }, jeton);
    expect({ html: deux.html, text: deux.text }).toEqual({ html: une.html, text: une.text });
    expect(
      urlRepereOpposition().split(REPERE_JETON_OPPOSITION).join(encodeURIComponent(jeton)),
    ).toBe(urlOpposition("nadia@exemple.fr"));
  });

  it("4 : un jeton contenant $&, $1, $$ est recopié littéralement", () => {
    const factice = "a$&b$1c$$d";
    const r = poserJetonOpposition(corpsAvecRepere(), factice);
    expect(r.html).toContain(`token=${encodeURIComponent(factice)}`);
    expect(r.text).toContain(`token=${encodeURIComponent(factice)}`);
    expect(r.html).not.toContain(REPERE_JETON_OPPOSITION);
  });
});

describe.each(["submission-reply", "candidature-reponse"] as const)(
  "5 : rendu réel de %s avec oppositionDifferee",
  (nom) => {
    it("porte le repère, jamais l'adresse ni op1/op2", async () => {
      const adresse = "nadia@exemple.fr";
      const payload = { subject: "Re : votre demande", bodyMarkdown: "Bonjour,\n\nMerci." };
      const r = await renderEmailTemplate(nom, "fr", payload, { oppositionDifferee: true });
      for (const corps of [r.html, r.text]) {
        expect(corps).toContain(`token=${REPERE_JETON_OPPOSITION}`);
        expect(corps).not.toContain("op1.");
        expect(corps).not.toContain("op2.");
        expect(corps).not.toContain(Buffer.from(adresse).toString("base64url"));
        expect(corps).not.toContain(adresse);
      }
    });
  },
);
