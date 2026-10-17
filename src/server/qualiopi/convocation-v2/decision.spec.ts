/**
 * Chantier QNC, L05 — la décision d'envoi de la convocation v2 (module pur).
 */
import { describe, expect, it } from "vitest";
import {
  LIBELLE_EFFECTIF,
  phraseEffectifEtModalite,
  LIBELLE_MOTIF_BLOCAGE,
  MENTION_LIEN_ENVOYE_AVANT,
  decisionEnvoiConvocation,
  libellesMotifs,
  memesMotifs,
  modaliteVisio,
  numeroAcces,
  outilVisio,
} from "./decision";

describe("decisionEnvoiConvocation", () => {
  it("convention signée et aucune adaptation en attente : l'envoi est autorisé", () => {
    expect(
      decisionEnvoiConvocation({ conventionSignee: true, adaptationNonTraitee: false }),
    ).toEqual({ autorisee: true, motifs: [] });
  });

  it("bloqué tant que la convention n'est pas entièrement signée", () => {
    const d = decisionEnvoiConvocation({ conventionSignee: false, adaptationNonTraitee: false });
    expect(d.autorisee).toBe(false);
    expect(d.motifs).toEqual(["convention_non_signee"]);
  });

  it("bloqué tant qu'un besoin d'adaptation n'est pas traité", () => {
    const d = decisionEnvoiConvocation({ conventionSignee: true, adaptationNonTraitee: true });
    expect(d.autorisee).toBe(false);
    expect(d.motifs).toEqual(["adaptation_non_traitee"]);
  });

  it("les deux motifs se cumulent, dans l'ordre où le référent les lève", () => {
    const d = decisionEnvoiConvocation({ conventionSignee: false, adaptationNonTraitee: true });
    expect(d.motifs).toEqual(["convention_non_signee", "adaptation_non_traitee"]);
    expect(libellesMotifs(d.motifs)).toEqual([
      LIBELLE_MOTIF_BLOCAGE.convention_non_signee,
      LIBELLE_MOTIF_BLOCAGE.adaptation_non_traitee,
    ]);
  });

  it("les libellés de la console sont des phrases en français, sans code technique", () => {
    for (const l of Object.values(LIBELLE_MOTIF_BLOCAGE)) {
      expect(l).toMatch(/^[A-ZÉ].+\.$/);
      expect(l).not.toMatch(/_/);
    }
  });
});

describe("memesMotifs", () => {
  it("compare l'ensemble ordonné ; l'absence de référence n'est jamais « identique »", () => {
    expect(memesMotifs(["a", "b"], ["a", "b"])).toBe(true);
    expect(memesMotifs(["a"], ["a", "b"])).toBe(false);
    expect(memesMotifs(null, ["a"])).toBe(false);
  });
});

describe("visioconférence", () => {
  it("champ vide : Zoom (ADR 0048) et la mention « lien envoyé avant la formation »", () => {
    for (const vide of [null, "", "   "]) {
      expect(modaliteVisio(vide)).toEqual({
        outil: "Zoom",
        lien: null,
        mentionLien: MENTION_LIEN_ENVOYE_AVANT,
      });
    }
    expect(MENTION_LIEN_ENVOYE_AVANT).toBe("Lien envoyé avant la formation");
  });

  it("lien renseigné : remis tel quel, sans mention de repli", () => {
    expect(modaliteVisio(" https://us02web.zoom.us/j/123 ")).toEqual({
      outil: "Zoom",
      lien: "https://us02web.zoom.us/j/123",
      mentionLien: null,
    });
  });

  it("un client qui impose son outil reste servi : Teams et Meet sont reconnus", () => {
    expect(outilVisio("https://teams.microsoft.com/l/meetup-join/abc")).toBe("Microsoft Teams");
    expect(outilVisio("https://meet.google.com/abc-defg")).toBe("Google Meet");
    expect(outilVisio("https://visio.exemple.fr/salle")).toBe("visioconférence");
    expect(outilVisio("pas une url")).toBe("Zoom");
  });
});

describe("numéro d'accès", () => {
  it("dérivé de l'identifiant, lisible à voix haute", () => {
    expect(numeroAcces("1a2b3c4d-1111-4222-8333-444455556666")).toBe("ACC-1A2B3C4D");
  });
});

describe("effectif", () => {
  it("2 à 15 participants", () => {
    expect(LIBELLE_EFFECTIF).toBe("2 à 15 participants");
  });
  it("le séminaire : jusqu'à 50, présentiel seul — « 2 à 15 » n'est que pour les formations", () => {
    expect(phraseEffectifEtModalite(true)).toBe(
      "Ce séminaire se déroule en présentiel, en groupe jusqu'à 50 participants.",
    );
    expect(phraseEffectifEtModalite(true)).not.toContain("2 à 15");
    expect(phraseEffectifEtModalite(false)).toContain("2 à 15 participants");
    expect(phraseEffectifEtModalite(undefined)).toContain("2 à 15 participants");
  });
});
