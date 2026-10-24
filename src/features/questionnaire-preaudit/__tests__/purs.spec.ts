import { describe, expect, it } from "vitest";

import {
  conservationEchue,
  CONTACT_RGPD_DEFAUT,
  echeanceConservation,
  mentionsRgpd,
  preauditActif,
  refusEnvoiReel,
  RETENTION_ANS,
  TEXTE_CONSERVATION,
} from "../config";
import { CHARGE_MAX_OCTETS, LIBELLE_PREFILL, lignesDeLaCharge, validerCharge } from "../donnees";
import { pagePourClient, validerHtml } from "../html";
import { CHARGES_SCHEMA_4 } from "./charges-schema-4.fixture";

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
  it("le réel est refusé éteint ; allumé, il est permis", () => {
    expect(refusEnvoiReel({})).toBe("eteint");
    const allume = { QUESTIONNAIRE_AVANT_AUDIT_ENABLED: "true" };
    expect(refusEnvoiReel({ QUESTIONNAIRE_AVANT_AUDIT_ENABLED: "1" })).toBe("eteint");
    // Décision de Will (25/10) : l'interrupteur SEUL autorise le réel (plus de verrou de purge).
    expect(refusEnvoiReel(allume)).toBeNull();
    expect(mentionsRgpd(allume)).toEqual({
      contact: CONTACT_RGPD_DEFAUT,
      conservation: TEXTE_CONSERVATION,
    });
    expect(mentionsRgpd({ ...allume, QUESTIONNAIRE_PREAUDIT_RGPD_CONTACT: " a@b.fr " })).toEqual({
      contact: "a@b.fr",
      conservation: TEXTE_CONSERVATION,
    });
  });

  it("conservation : 5 ans, jamais « 30 jours », échéance = reçu + 5 ans, rappel sans suppression", () => {
    expect(RETENTION_ANS).toBe(5);
    expect(TEXTE_CONSERVATION).toMatch(/^5 ans,/);
    expect(TEXTE_CONSERVATION).toBe(
      "5 ans, puis supprimées par notre équipe ; vous pouvez demander leur suppression à tout moment",
    );
    expect(TEXTE_CONSERVATION).not.toMatch(/30 jours/);
    const recu = new Date("2026-10-25T09:00:00Z");
    expect(echeanceConservation(recu).toISOString()).toBe("2031-10-25T09:00:00.000Z");
    expect(conservationEchue(recu, new Date("2031-10-25T08:59:59Z"))).toBe(false);
    expect(conservationEchue(recu, new Date("2031-10-25T09:00:00Z"))).toBe(true);
  });
});

describe("le HTML de Will", () => {
  it("accepte la forme attendue, refuse le reste", () => {
    expect(validerHtml(HTML).ok).toBe(true);
    expect(validerHtml("<p>rien</p>").ok).toBe(false);
    expect(validerHtml(HTML.replace("schema: 3", "schema: 2")).ok).toBe(false);
    expect(validerHtml(HTML.replace("schema: 3", "schema: 4")).ok).toBe(true);
    expect(validerHtml(HTML.replace("schema: 3", "schema: 5")).ok).toBe(false);
    expect(validerHtml(HTML.replace("schema: 3", "schema: 34")).ok).toBe(false);
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
  it("fonctionne même si CONFIG.rgpd est absent de la copie de Will", () => {
    const sansRgpd = HTML.replace(/rgpd: {[^}]*},/, "");
    const page = pagePourClient(sansRgpd, {
      endpoint: "/api/x",
      client: "",
      contact: "a@b.fr",
      conservation: "3 ans",
      essai: false,
    });
    expect(page).toContain("CONFIG.rgpd = Object.assign(CONFIG.rgpd || {}");
  });
  it("le bandeau d'essai va avant le DERNIER </body>, pas dans le script", () => {
    const piege = HTML.replace("const payload", 'const t = "</body>"; const payload');
    const page = pagePourClient(piege, {
      endpoint: "/api/x",
      client: "",
      contact: "",
      conservation: "",
      essai: true,
    });
    expect(page.indexOf("ESSAI")).toBeGreaterThan(page.indexOf('const t = "</body>"'));
    expect(page.indexOf("ESSAI")).toBe(page.lastIndexOf("ESSAI"));
    expect(page.indexOf("ESSAI")).toBeLessThan(page.lastIndexOf("</body>"));
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

describe("la charge schéma 4", () => {
  it("les trois parcours réels sont acceptés, le texte gardé tel quel", () => {
    for (const mode of ["main", "emp", "it"] as const) {
      const texte = JSON.stringify(CHARGES_SCHEMA_4[mode]);
      const r = validerCharge(texte);
      expect(r.ok).toBe(true);
      expect(r.ok && r.charge.mode).toBe(mode);
      expect(r.ok && r.charge.json).toBe(texte);
    }
  });
  it("schéma 5 (ou chaîne « 4 ») refusé", () => {
    const t = JSON.stringify(CHARGES_SCHEMA_4.main);
    expect(validerCharge(t.replace('"schema":4', '"schema":5')).ok).toBe(false);
    expect(validerCharge(t.replace('"schema":4', '"schema":"4"')).ok).toBe(false);
  });
  it("plafond : 1 000 000 octets (toutes cases remplies : 452 à 467 Ko ; brouillon : ~605 Ko)", () => {
    expect(CHARGE_MAX_OCTETS).toBe(1_000_000);
  });
  it("l'état du pré-remplissage accompagne chaque ligne pré-remplie", () => {
    const lignes = lignesDeLaCharge(JSON.stringify(CHARGES_SCHEMA_4.main));
    const etat = (cle: string) => lignes.find((l) => l.cle === cle)?.prefill;
    expect(etat("ent_nom")).toBe("confirme");
    expect(etat("ent_ville")).toBe("modifie");
    expect(etat("contact_email")).toBe("non_verifie");
    expect(etat("ent_site")).toBe("vide");
    expect(lignes.find((l) => l.cle === "ent_site")?.valeur).toBe("(vidée par la personne)");
    // Une réponse jamais pré-remplie ne porte pas d'état.
    const libre = lignes.find((l) => !("prefill" in l));
    expect(libre).toBeDefined();
    expect(LIBELLE_PREFILL.vide).toBe("pré-rempli, vidé");
  });
  it("un bloc prefill mal formé n'empêche pas la lecture", () => {
    const c = { ...CHARGES_SCHEMA_4.main, prefill: { confirmes: "pas une liste", vides: [3] } };
    const lignes = lignesDeLaCharge(JSON.stringify(c));
    expect(lignes.length).toBeGreaterThan(0);
    expect(lignes.every((l) => l.prefill === undefined)).toBe(true);
  });
});
