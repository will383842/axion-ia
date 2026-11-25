/**
 * Cliquet de version des CGV (T9).
 *
 * `CGV_VERSION` est ENREGISTRÉE et scellée dans la preuve de signature d'un devis.
 * Si le texte des CGV change sans que la version bouge, la preuve affirmerait que le
 * client a accepté un texte qu'il n'a pas lu. Ce test lie donc l'empreinte du texte
 * français à la version : modifier l'un oblige à toucher l'autre, ici, en revue.
 */
import { afterEach, describe, it, expect, vi } from "vitest";
import { empreinteTexteCgv } from "@/content/cgv-empreinte";
import { getLegal } from "@/content/legal";
import { CGV_VERSION, CGV_VERSION_LIBELLE, CGV_VERSION_LIBELLE_EN } from "@/content/cgv-version";

/**
 * Empreinte du texte FR pour la version courante. À mettre à jour AVEC CGV_VERSION.
 * Deux variantes existent (`cgv-passages-financement.ts`) : chacune a sa paire figée.
 */
const EMPREINTE_TEXTE_FR = "94ded664850b60bdf239199b0270b4383d77ad87c48588127cf960e484415b16";
const VERSION_DE_L_EMPREINTE = "2026-11-26";
/** Variante « certifiée » (QUALIOPI_CERTIFICATION_OBTENUE=true) : version suffixée « -f ». */
const EMPREINTE_TEXTE_FR_CERTIFIEE =
  "23b3a756d0a3f2c83f128c7141b5dc513b2cf846ba85093d4ba24e1b8d979ccd";
const VERSION_DE_L_EMPREINTE_CERTIFIEE = "2026-11-26-f";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("cgv-version : source unique de la version des CGV", () => {
  it("la version est une date ISO, le libellé la reflète", () => {
    expect(CGV_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}(-f)?$/);
    expect(CGV_VERSION.length).toBeLessThanOrEqual(40);
    expect(CGV_VERSION_LIBELLE.length).toBeGreaterThan(0);
    expect(CGV_VERSION_LIBELLE_EN.length).toBeGreaterThan(0);
  });

  it("cliquet : le texte FR des CGV n'a pas changé sans changement de version", () => {
    // Même fonction que la signature du devis : une seule définition du calcul.
    const empreinte = empreinteTexteCgv();
    // Si ce test casse : le texte a changé. Mettre à jour CGV_VERSION (+ libellés),
    // puis EMPREINTE_TEXTE_FR et VERSION_DE_L_EMPREINTE ensemble. Jamais l'empreinte seule.
    expect(CGV_VERSION).toBe(VERSION_DE_L_EMPREINTE);
    expect(empreinte).toBe(EMPREINTE_TEXTE_FR);
  });

  it("cliquet, variante certifiée : le texte et la version « -f » bougent ensemble", async () => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "true");
    vi.resetModules();
    const { empreinteTexteCgv: empreinteCertifiee } = await import("@/content/cgv-empreinte");
    const { CGV_VERSION: versionCertifiee } = await import("@/content/cgv-version");
    expect(versionCertifiee).toBe(VERSION_DE_L_EMPREINTE_CERTIFIEE);
    expect(empreinteCertifiee()).toBe(EMPREINTE_TEXTE_FR_CERTIFIEE);
    expect(EMPREINTE_TEXTE_FR_CERTIFIEE).not.toBe(EMPREINTE_TEXTE_FR);
  });

  it("l'article 6.3 (v3) ne promet les garanties du code qu'au devis à formules ; l'EN renvoie au texte français", () => {
    const legal = getLegal("conditions-generales");
    const art63 = legal.fr.sections.find((s) => /Article 6\. /.test(s.title))?.body ?? "";
    expect(art63).toMatch(
      /6\.3 Le devis à formules est signé en ligne[\s\S]*Pour tout autre devis/,
    );
    const en = legal.en.sections.map((s) => s.title + s.body).join(" ");
    expect(en).toMatch(/French text only/);
    expect(en).toMatch(/that French text alone governs the contract/);
  });
});
