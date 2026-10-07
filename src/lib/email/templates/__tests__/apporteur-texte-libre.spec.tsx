// Les e-mails du réseau d'apporteurs envoyés à la main : Will peut RÉÉCRIRE le texte
// principal. Le texte libre remplace le corps par défaut, mais le bouton d'action, les
// pièces à retransmettre, l'information RGPD et la signature restent ; il est échappé.

import { describe, expect, it } from "vitest";

import { texteParDefaut } from "../apporteur-demarrage";
import { renderEmailTemplate } from "../index";
import { paragraphesLibres, TEXTE_LIBRE_MAX, validerTexteLibre } from "../texte-libre-reseau";

const URL_DOSSIER = "https://axion-ia.com/apporteur/dossier/x/y";

const CAS: Array<[string, Record<string, unknown>]> = [
  ["apporteur-dossier-lien", { contactName: "Claire Martin", dossierUrl: URL_DOSSIER }],
  [
    "apporteur-dossier-a-completer",
    {
      contactName: "Claire Martin",
      dossierUrl: URL_DOSSIER,
      piecesARetransmettre: ["RIB : illisible"],
    },
  ],
  ["apporteur-dossier-refuse", { contactName: "Claire Martin" }],
  ["apporteur-contrat-signe", { contactName: "Claire Martin" }],
  [
    "apporteur-presentation-recue",
    { contactName: "Claire Martin", entreprise: "Acme", personnePresentee: "Paul Durand" },
  ],
  [
    "apporteur-presentation-refusee",
    { contactName: "Claire Martin", entreprise: "Acme", motif: "deja-connue" },
  ],
  [
    "entreprise-prise-de-contact-apporteur",
    { contactName: "Paul Durand", nomApporteur: "Claire Martin", entreprise: "Acme" },
  ],
];

const LIBRE = "Un mot rien que pour vous.\n\nA très vite.";

const echappe = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");

describe("texte libre : le texte de Will remplace le corps, le châssis reste", () => {
  it.each(CAS)("%s : le texte libre est rendu, avec Bonjour et signature", async (g, payload) => {
    const r = await renderEmailTemplate(g as never, "fr", { ...payload, texteLibre: LIBRE });
    expect(r.html).toContain("Un mot rien que pour vous.");
    expect(r.html).toContain("A très vite.");
    expect(r.html).toMatch(/Bonjour (Claire|Paul)/);
    expect(r.html).toContain("Williams Jullin");
  });

  it.each(CAS)("%s : le corps par défaut disparaît", async (g, payload) => {
    const defaut = texteParDefaut(g, payload)!;
    const premier = defaut.split("\n\n")[0]!.split("\n")[0]!;
    const sans = await renderEmailTemplate(g as never, "fr", payload);
    const avec = await renderEmailTemplate(g as never, "fr", { ...payload, texteLibre: LIBRE });
    // Le premier paragraphe par défaut est dans le rendu par défaut (apostrophes échappées)…
    expect(sans.html.includes(premier) || sans.html.includes(echappe(premier))).toBe(true);
    // …et plus dans le rendu réécrit.
    expect(avec.html.includes(premier) || avec.html.includes(echappe(premier))).toBe(false);
  });

  it("garde le bouton d'action et son lien secret (lien du dossier, à compléter)", async () => {
    for (const g of ["apporteur-dossier-lien", "apporteur-dossier-a-completer"]) {
      const payload = CAS.find(([n]) => n === g)![1];
      const r = await renderEmailTemplate(g as never, "fr", { ...payload, texteLibre: LIBRE });
      expect(r.html).toContain("apporteur/dossier/x/y");
    }
  });

  it("garde le bouton « Prendre rendez-vous » et l'information RGPD de l'entreprise", async () => {
    const payload = CAS.find(([n]) => n === "entreprise-prise-de-contact-apporteur")![1];
    const r = await renderEmailTemplate("entreprise-prise-de-contact-apporteur", "fr", {
      ...payload,
      texteLibre: LIBRE,
    });
    expect(r.html).toContain("Prendre rendez-vous");
    expect(r.html).toContain("politique de confidentialité");
    expect(r.html).not.toMatch(/vérif/i);
  });

  it("garde la liste des pièces à retransmettre de « à compléter »", async () => {
    const payload = CAS.find(([n]) => n === "apporteur-dossier-a-completer")![1];
    const r = await renderEmailTemplate("apporteur-dossier-a-completer", "fr", {
      ...payload,
      texteLibre: LIBRE,
    });
    expect(r.html).toContain("RIB : illisible");
  });

  it("le texte libre prime sur le rappel J+3 / J+7", async () => {
    const r = await renderEmailTemplate("apporteur-dossier-lien", "fr", {
      ...CAS[0]![1],
      rappel: 1,
      texteLibre: LIBRE,
    });
    expect(r.html).not.toContain("Petit rappel");
    expect(r.html).toContain("Un mot rien que pour vous.");
  });

  it("sans texte libre (ou vide), le rendu est identique à celui d'avant", async () => {
    for (const [g, payload] of CAS) {
      const base = await renderEmailTemplate(g as never, "fr", payload);
      const vide = await renderEmailTemplate(g as never, "fr", { ...payload, texteLibre: "  \n " });
      expect(vide.html, g).toBe(base.html);
      expect(vide.subject, g).toBe(base.subject);
    }
  });

  it("le sujet ne change pas avec le texte libre", async () => {
    for (const [g, payload] of CAS) {
      const base = await renderEmailTemplate(g as never, "fr", payload);
      const libre = await renderEmailTemplate(g as never, "fr", { ...payload, texteLibre: LIBRE });
      expect(libre.subject, g).toBe(base.subject);
    }
  });

  it("échappe le HTML : jamais de balise brute, jamais de lien injecté", async () => {
    const r = await renderEmailTemplate("apporteur-dossier-refuse", "fr", {
      contactName: "Claire",
      texteLibre:
        'Voyez <script>alert(1)</script> et <a href="https://evil.example">ici</a> https://evil.example/x',
    });
    expect(r.html).not.toContain("<script>alert");
    expect(r.html).not.toMatch(/<a [^>]*href="https:\/\/evil\.example/);
    expect(r.html).toContain("&lt;script&gt;");
  });
});

describe("texteParDefaut : le texte brut pré-rempli", () => {
  it.each(CAS)("%s : un texte non vide, sans Bonjour ni HTML", (g, payload) => {
    const t = texteParDefaut(g, payload);
    expect(t).toBeTruthy();
    expect(t).not.toMatch(/^Bonjour/);
    expect(t).not.toMatch(/<[a-z/]/i);
  });

  it("rend null pour un gabarit non modifiable", () => {
    expect(texteParDefaut("apporteur-releve", {})).toBeNull();
  });

  it("reprend le mot personnel et le rappel", () => {
    const t = texteParDefaut("apporteur-dossier-lien", {
      rappel: 2,
      motPersonnel: "Merci pour notre échange.",
    })!;
    expect(t.startsWith("Merci pour notre échange.")).toBe(true);
    expect(t).toContain("Dernier rappel");
  });

  it("rejouer le texte par défaut comme texte libre garde le même fond", async () => {
    const payload = CAS.find(([n]) => n === "apporteur-presentation-refusee")![1];
    const defaut = texteParDefaut("apporteur-presentation-refusee", payload)!;
    const r = await renderEmailTemplate("apporteur-presentation-refusee", "fr", {
      ...payload,
      texteLibre: defaut,
    });
    expect(r.html).toContain("Merci pour votre présentation de Acme");
  });
});

describe("validation du texte libre", () => {
  it("absent : pas de réécriture", () => {
    expect(validerTexteLibre(undefined)).toEqual({ ok: true, texte: undefined });
    expect(validerTexteLibre(null)).toEqual({ ok: true, texte: undefined });
  });
  it("vide ou blanc : refusé", () => {
    expect(validerTexteLibre("").ok).toBe(false);
    expect(validerTexteLibre(" \n\t ").ok).toBe(false);
  });
  it("trop long : refusé ; à la limite : accepté", () => {
    expect(validerTexteLibre("a".repeat(TEXTE_LIBRE_MAX + 1)).ok).toBe(false);
    expect(validerTexteLibre("a".repeat(TEXTE_LIBRE_MAX)).ok).toBe(true);
  });
  it("pas une chaîne : refusé", () => {
    expect(validerTexteLibre(42).ok).toBe(false);
  });
  it("normalise les fins de ligne et retire les caractères de contrôle", () => {
    expect(validerTexteLibre("a\r\nb\u0008c")).toEqual({ ok: true, texte: "a\nbc" });
  });
  it("sépare les paragraphes sur une ligne vide", () => {
    expect(paragraphesLibres("a\nb\n\n\nc")).toEqual(["a\nb", "c"]);
    expect(paragraphesLibres("   ")).toBeNull();
  });
});
