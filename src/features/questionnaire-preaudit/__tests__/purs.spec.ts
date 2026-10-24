import { describe, expect, it } from "vitest";

import { mentionsRgpd, preauditActif, PURGE_PLANIFIEE, refusEnvoiReel } from "../config";
import { lignesDeLaCharge, validerCharge } from "../donnees";
import { pagePourClient, validerHtml } from "../html";

// Forme du questionnaire de Will (CONFIG, schéma 3) en miniature.
const HTML = `<!doctype html><html><head><title>Q</title></head><body>
<script>
"use strict";
const CONFIG = {
  marque: "Axion IA",
  client: "",
  endpoint: "",
  rgpd: { responsable: "Axion IA", contact: "", conservation: "" },
};
const payload = () => ({ schema: 3, mode: "main" });
</script></body></html>`;

describe("interrupteur et notice RGPD", () => {
  it("absent = éteint ; seul « true » allume", () => {
    expect(preauditActif({})).toBe(false);
    expect(preauditActif({ QUESTIONNAIRE_AVANT_AUDIT_ENABLED: "false" })).toBe(false);
    expect(preauditActif({ QUESTIONNAIRE_AVANT_AUDIT_ENABLED: "true" })).toBe(true);
  });
  it("le réel est refusé éteint, puis notice vide, puis purge non planifiée", () => {
    expect(refusEnvoiReel({}, true)).toBe("eteint");
    const allume = { QUESTIONNAIRE_AVANT_AUDIT_ENABLED: "true" };
    expect(refusEnvoiReel(allume, true)).toBe("notice_rgpd_vide");
    expect(refusEnvoiReel({ ...allume, QUESTIONNAIRE_PREAUDIT_RGPD_CONTACT: "a@b.fr" }, true)).toBe(
      "notice_rgpd_vide",
    );
    const complet = {
      ...allume,
      QUESTIONNAIRE_PREAUDIT_RGPD_CONTACT: "a@b.fr",
      QUESTIONNAIRE_PREAUDIT_RGPD_CONSERVATION: "3 ans",
    };
    expect(refusEnvoiReel(complet, false)).toBe("purge_non_planifiee");
    expect(refusEnvoiReel(complet, true)).toBeNull();
    // Livré tel quel : la purge n'est pas encore planifiée, donc le réel reste refusé.
    expect(PURGE_PLANIFIEE).toBe(false);
    expect(refusEnvoiReel(complet)).toBe("purge_non_planifiee");
    expect(mentionsRgpd(complet)).toEqual({ contact: "a@b.fr", conservation: "3 ans" });
  });
});

describe("le HTML de Will", () => {
  it("accepte la forme attendue, refuse le reste", () => {
    expect(validerHtml(HTML).ok).toBe(true);
    expect(validerHtml("<p>rien</p>").ok).toBe(false);
    expect(validerHtml(HTML.replace("schema: 3", "schema: 2")).ok).toBe(false);
    expect(validerHtml(HTML + "x".repeat(900_000)).ok).toBe(false);
  });
  it("injecte la configuration sans toucher au script de Will", () => {
    const page = pagePourClient(HTML, {
      endpoint: "/api/x",
      client: "Société </script>",
      contact: "a@b.fr",
      conservation: "3 ans",
      essai: false,
    });
    expect(page).toContain(HTML.slice(0, HTML.indexOf("const payload")));
    expect(page).toContain('"endpoint":"/api/x"');
    expect(page).toContain("u003c/script");
    expect(page).not.toContain("Société </script>");
    expect(page).toContain("\\u003c/script\\u003e");
    expect(page).toContain("a@b.fr");
    expect(page).not.toContain("ESSAI");
  });
  it("n'écrase pas le client posé par Will dans sa copie quand on n'en donne pas", () => {
    const page = pagePourClient(HTML, {
      endpoint: "/api/x",
      client: "",
      contact: "",
      conservation: "",
      essai: false,
    });
    expect(page).not.toContain('"client"');
    expect(page).not.toContain('"contact"');
  });
  it("le mode essai ajoute le bandeau", () => {
    const page = pagePourClient(HTML, {
      endpoint: "/api/x?essai=1",
      client: "",
      contact: "",
      conservation: "",
      essai: true,
    });
    expect(page).toContain("ESSAI");
    expect(page.indexOf("ESSAI")).toBeLessThan(page.indexOf("</body>"));
  });
});

describe("la charge schéma 3", () => {
  const ok = JSON.stringify({
    schema: 3,
    mode: "emp",
    membre: "m1",
    consentements: { version: "1", traitement: true },
    donnees: { ent_nom: "Dupont SARL", outils: ["Excel", "ERP"] },
  });
  it("accepte une réponse valide et la classe par personne", () => {
    const r = validerCharge(ok);
    expect(r.ok && r.charge.mode).toBe("emp");
    expect(r.ok && r.charge.membre).toBe("m1");
    expect(lignesDeLaCharge(ok)).toEqual([
      { cle: "ent_nom", valeur: "Dupont SARL" },
      { cle: "outils", valeur: "Excel, ERP" },
    ]);
  });
  it("refuse schéma, parcours, consentement et illisible", () => {
    expect(validerCharge(ok.replace('"schema":3', '"schema":2')).ok).toBe(false);
    expect(validerCharge(ok.replace('"emp"', '"zzz"')).ok).toBe(false);
    expect(validerCharge(ok.replace('"traitement":true', '"traitement":false')).ok).toBe(false);
    expect(validerCharge("pas du json").ok).toBe(false);
  });
});
