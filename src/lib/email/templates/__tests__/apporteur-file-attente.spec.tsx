// PR E #2464 — gabarit « file d'attente, premier rang » (livré au worker avant son émetteur).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { formulesInterdites } from "@/features/apporteurs-reseau/challenge-textes-interdits";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
import { EMAIL_TEMPLATE_NAMES, renderEmailTemplate } from "../index";
import { apporteurFileAttenteSubject } from "../apporteur-file-attente";

const NOM = "apporteur-file-attente-premier-rang";
const norm = (s: string) => s.replace(/\s+/g, " ");
const CHARGE = { prenom: "Camille", entreprise: "Société Exemple", jusquAu: "12 décembre 2026" };
const rendre = async (extra: Record<string, unknown> = {}) =>
  renderEmailTemplate(NOM as never, "fr", { ...CHARGE, ...extra });

describe("e-mail apporteur-file-attente-premier-rang", () => {
  it("est inscrit au registre des gabarits", () => {
    expect(EMAIL_TEMPLATE_NAMES).toContain(NOM);
  });

  it("corps : prénom, entreprise, date limite, article 3.5, rien d'obligatoire", async () => {
    const t = norm((await rendre()).text);
    expect(t).toContain("Bonjour Camille");
    expect(t).toContain("Société Exemple");
    expect(t).toContain("jusqu'au 12 décembre 2026 inclus");
    expect(t).toContain("article 3.5 de votre contrat");
    expect(t).toContain("sans nouvelle déclaration, rien ne change pour vous");
  });

  it("objet sobre, sans pression", () => {
    const o = apporteurFileAttenteSubject("fr", CHARGE);
    expect(o.length).toBeGreaterThan(5);
    expect(formulesInterdites(o)).toEqual([]);
  });

  it("aucune formule de pression (formulesInterdites)", async () => {
    const r = await rendre();
    // « Grenoble » vient du pied de page commun à tous les gabarits, pas du texte propre.
    expect(formulesInterdites(norm(r.text)).filter((f) => f !== "« Grenoble »")).toEqual([]);
  });

  it("aucun des mots « objectif », « classement », « mission », « manager »", async () => {
    const t = norm((await rendre()).text).toLowerCase();
    for (const mot of ["objectif", "classement", "mission", "manager"])
      expect(t).not.toContain(mot);
  });

  it("aucun nom d'occupant : un champ inattendu de la charge n'est jamais rendu", async () => {
    const t = norm(
      (await rendre({ occupant: "AUTRE-APPORTEUR", autreApporteur: "AUTRE-NOM" })).text,
    );
    expect(t).not.toContain("AUTRE-APPORTEUR");
    expect(t).not.toContain("AUTRE-NOM");
    const src = readFileSync(join(__dirname, "..", "apporteur-file-attente.tsx"), "utf8");
    expect(src).not.toMatch(/occupant|autreApporteur/);
  });

  it("l'aperçu a un exemple complet", () => {
    expect(PAYLOAD_EXEMPLE).toMatchObject({ prenom: expect.any(String) });
    expect(typeof (PAYLOAD_EXEMPLE as Record<string, unknown>)["jusquAu"]).toBe("string");
    expect(typeof (PAYLOAD_EXEMPLE as Record<string, unknown>)["entreprise"]).toBe("string");
  });
});
