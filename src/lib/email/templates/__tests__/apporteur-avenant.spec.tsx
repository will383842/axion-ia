// Lot S4 de l'issue #2512 — gabarits de l'avenant 2.8 (livrés au worker avant leur émetteur).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { formulesInterdites } from "@/features/apporteurs-reseau/challenge-textes-interdits";
import { CATALOGUE } from "@/server/email/apercu/catalogue";
import { SITE_URL as SITE_URL_BRUT } from "@/lib/site-url";
import { EMAIL_TEMPLATE_NAMES, estGabaritConnu, renderEmailTemplate } from "../index";
import { GABARIT_REPLI_AVENANT } from "../apporteur-avenant";

const SITE_URL = `https://${new URL(SITE_URL_BRUT).host}`;
const NOMS = [
  "apporteur-avenant-propose",
  "apporteur-avenant-relance",
  "apporteur-avenant-enregistre",
] as const;
const LIEN = `${SITE_URL}/apporteur/dossier/D1/JETON-FICTIF/avenant`;
const CHARGE = {
  prenom: "Camille",
  versionSignee: "2.6",
  lienAvenant: LIEN,
  dateEffet: "15 décembre 2026",
};
const norm = (s: string) => s.replace(/\s+/g, " ");
const rendre = async (nom: string, extra: Record<string, unknown> = {}) => {
  const r = await renderEmailTemplate(nom as never, "fr", { ...CHARGE, ...extra });
  return { ...r, t: norm(r.text) };
};

describe("gabarits de l'avenant 2.8", () => {
  it.each(NOMS)("%s : connu du registre et du catalogue d'aperçu", (nom) => {
    expect(estGabaritConnu(nom)).toBe(true);
    expect(EMAIL_TEMPLATE_NAMES).toContain(nom);
    expect(Object.keys(CATALOGUE)).toContain(nom);
  });

  it("avenant proposé : prénom, versions, lien personnel, rien d'autre à faire, garder sans conséquence", async () => {
    const r = await rendre("apporteur-avenant-propose");
    expect(r.t).toContain("Bonjour Camille");
    expect(r.t).toContain("vous avez signé la version 2.6");
    expect(r.t).toContain("la version 2.8");
    expect(r.t).toContain("Il n'y a rien d'autre à faire.");
    expect(r.t).toContain("garder votre version actuelle");
    expect(r.t).toContain("aucune conséquence");
    expect(r.html).toContain(LIEN);
  });

  it("relance : même contenu, signalée comme un rappel", async () => {
    const r = await rendre("apporteur-avenant-relance");
    expect(r.subject).toContain("Rappel");
    expect(r.t).toContain("simple rappel");
    expect(r.t).toContain("vous avez signé la version 2.6");
    expect(r.t).toContain("aucune conséquence");
    expect(r.html).toContain(LIEN);
  });

  it("acceptation enregistrée : date d'effet, trois documents, « Mes documents »", async () => {
    const r = await rendre("apporteur-avenant-enregistre");
    expect(r.t).toContain("à partir du 15 décembre 2026");
    expect(r.t).toContain("l'avenant, le contrat 2.8 et la preuve");
    expect(r.t).toContain("« Mes documents »");
  });

  it("un lien hors liste blanche n'est pas rendu ; un champ inattendu non plus", async () => {
    const r = await rendre("apporteur-avenant-propose", {
      lienAvenant: "https://example.org/apporteur/dossier/D1/J/avenant",
      secret: "VALEUR-INATTENDUE",
    });
    expect(r.html).not.toContain("example.org");
    expect(r.t).not.toContain("VALEUR-INATTENDUE");
  });

  it("charge vide : le rendu ne plante pas", async () => {
    for (const nom of NOMS) {
      const r = await renderEmailTemplate(nom as never, "fr", {});
      expect(r.text.length).toBeGreaterThan(20);
    }
  });

  it.each(NOMS)("%s : aucun prix, aucune formule de pression", async (nom) => {
    const r = await rendre(nom);
    expect(r.t).not.toMatch(/€|euro|\d\s?%/i);
    expect(formulesInterdites(r.subject)).toEqual([]);
    expect(formulesInterdites(r.t).filter((f) => f !== "« Grenoble »")).toEqual([]);
  });
});

describe("repli sûr", () => {
  it("le repli est un gabarit déjà connu du worker, qui rend sans parler de l'avenant", async () => {
    expect(estGabaritConnu(GABARIT_REPLI_AVENANT)).toBe(true);
    const r = await renderEmailTemplate(GABARIT_REPLI_AVENANT as never, "fr", {
      prenom: "Camille",
      origine: "console",
      lien: `${SITE_URL}/apporteur/dossier/D1/JETON-FICTIF`,
    });
    const t = norm(r.text).toLowerCase();
    expect(t).toContain("lien de votre espace");
    expect(t).not.toContain("avenant");
  });

  it("un nom inconnu n'est pas un gabarit connu (le worker reporte puis se replie)", () => {
    expect(estGabaritConnu("apporteur-avenant-inconnu")).toBe(false);
  });
});

// Garde de périmètre : le texte de l'avenant ne dit rien de la règle du rendez-vous ni de la
// bascule des présentations (S5 s'en charge, en silence). Échoue si un gabarit dont le nom ou le
// texte en parle existe.
const INTERDIT = /bascule|rendez-vous|rendez vous|présentation/i;

describe("aucun gabarit sur la bascule des présentations ni sur la règle du rendez-vous", () => {
  it("aucun nom de gabarit ne la désigne", () => {
    const fautifs = EMAIL_TEMPLATE_NAMES.filter(
      (n) => /bascule/i.test(n) || (/avenant/i.test(n) && INTERDIT.test(n)),
    );
    expect(fautifs).toEqual([]);
  });

  it("le texte des gabarits de l'avenant n'en parle pas", async () => {
    for (const nom of NOMS) {
      const r = await rendre(nom);
      // Le pied de page commun n'est pas le texte propre : on teste l'objet et le corps du gabarit.
      expect(`${r.subject} ${r.t}`).not.toMatch(/bascule|rendez-vous|rendez vous/i);
      expect(r.t).not.toMatch(/présentations? d'entreprise|présentations? non confirmée/i);
    }
  });

  it("le fichier source n'en parle pas non plus (ni noms, ni copie)", () => {
    const src = readFileSync(join(__dirname, "..", "apporteur-avenant.tsx"), "utf8")
      // les commentaires d'en-tête nomment l'interdit pour l'expliquer
      .replace(/^\/\/.*$/gm, "");
    expect(src).not.toMatch(/bascule|rendez-vous|présentation/i);
  });

  it("aucun fichier de gabarit d'apporteur nommé « bascule »", () => {
    const dir = join(__dirname, "..");
    expect(readdirSync(dir).filter((f) => /bascule/i.test(f))).toEqual([]);
  });
});
