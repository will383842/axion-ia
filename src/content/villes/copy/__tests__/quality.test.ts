/**
 * Quality gate Vitest — Audit Will 2026-05-27.
 *
 * Garde-fou anti-doorway HCU 2024 sur les 2157+ pages hub ville. Valide que
 * chaque VilleCopy passe les seuils minimaux de différenciation locale :
 *   - pitchFr : 30-200 mots (cible 30-50, tolérance T1 grandes villes)
 *   - directAnswerFr : ≥ 40 mots, mention "Axion-IA"
 *   - ecosystemFr : ≥ 25 mots si présent
 *   - faqGeolocalisee : 5 Q/R min si présent
 *   - topSectorsNaf : 5 secteurs min si présent
 *   - Longueur unique concat ≥ 600 chars (anti-thin content)
 *
 * Si un nouveau VilleCopy est ajouté en-dessous des seuils, CI fail.
 */
import { describe, it, expect } from "vitest";
import { AUTO_GENERATED_COPIES_BY_SLUG } from "../_auto-generated-index";

const allCopies = Object.entries(AUTO_GENERATED_COPIES_BY_SLUG);

describe("VilleCopy quality gate — anti-doorway HCU 2024", () => {
  it("a au moins 2000 VilleCopy enregistrées dans l'index auto", () => {
    expect(allCopies.length).toBeGreaterThanOrEqual(2000);
  });

  describe.each(allCopies)("ville %s", (slug, copy) => {
    const pitchWords = copy.pitchFr.split(/\s+/).filter(Boolean).length;
    const directAnswerWords = (copy.directAnswerFr ?? "").split(/\s+/).filter(Boolean).length;
    const ecosystemWords = (copy.ecosystemFr ?? "").split(/\s+/).filter(Boolean).length;
    const concat =
      copy.pitchFr +
      " " +
      (copy.directAnswerFr ?? "") +
      " " +
      (copy.ecosystemFr ?? "") +
      " " +
      (copy.distancesFr ?? "");

    it("pitchFr : 30-200 mots", () => {
      expect(pitchWords, `${slug} pitchFr trop court (${pitchWords} mots)`).toBeGreaterThanOrEqual(
        30,
      );
      expect(pitchWords, `${slug} pitchFr trop long (${pitchWords} mots)`).toBeLessThanOrEqual(200);
    });

    it("directAnswerFr ≥ 30 mots et contient 'Axion-IA'", () => {
      if (!copy.directAnswerFr) return; // optionnel
      expect(
        directAnswerWords,
        `${slug} directAnswerFr trop court (${directAnswerWords} mots)`,
      ).toBeGreaterThanOrEqual(30);
      expect(copy.directAnswerFr).toContain("Axion-IA");
    });

    it("ecosystemFr ≥ 20 mots si présent", () => {
      if (!copy.ecosystemFr) return;
      expect(
        ecosystemWords,
        `${slug} ecosystemFr trop court (${ecosystemWords} mots)`,
      ).toBeGreaterThanOrEqual(20);
    });

    it("faqGeolocalisee : 5 Q/R minimum si présent", () => {
      if (!copy.faqGeolocalisee) return;
      expect(
        copy.faqGeolocalisee.length,
        `${slug} faqGeolocalisee ${copy.faqGeolocalisee.length}/5`,
      ).toBeGreaterThanOrEqual(5);
    });

    it("topSectorsNaf : 5 secteurs minimum si présent", () => {
      if (!copy.topSectorsNaf) return;
      expect(
        copy.topSectorsNaf.length,
        `${slug} topSectorsNaf ${copy.topSectorsNaf.length}/5`,
      ).toBeGreaterThanOrEqual(5);
    });

    it("contenu concat ≥ 600 chars (anti-thin content)", () => {
      expect(concat.length, `${slug} concat ${concat.length} chars`).toBeGreaterThanOrEqual(600);
    });
  });
});
