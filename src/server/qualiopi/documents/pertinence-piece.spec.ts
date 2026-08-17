/**
 * Lot 1ter §2 + §5 — le bruit du bloc Documents.
 *
 * Constat vécu : sur ~20 boutons, **cinq** concernaient une session en
 * financement direct entreprise. Le bruit n'est pas neutre — il produit des
 * pièces à annuler. Sur le premier dossier réel, une « Lettre de mission
 * formateur » a dû être annulée au registre parce que le dirigeant-formateur ne
 * peut pas se confier une mission à lui-même, et l'écran la proposait.
 */

import { describe, expect, it } from "vitest";
import {
  motifRepli,
  pertinencePiece,
  pieceMiseEnAvant,
  type ContexteSession,
} from "./pertinence-piece";

const ctx = (patch: Partial<ContexteSession> = {}): ContexteSession => ({
  financement: "direct",
  typeClient: "entreprise",
  statut: "planifiee",
  ...patch,
});

describe("🔴 le cas vécu : direct entreprise — les kits financeurs disparaissent", () => {
  it.each(["kit_opco", "kit_cpf", "kit_france_travail", "convention_tripartite"])(
    "%s est SANS OBJET en financement direct",
    (type) => {
      expect(pertinencePiece(type, ctx())).toBe("sans_objet");
      expect(pieceMiseEnAvant(type, ctx())).toBe(false);
    },
  );

  it("le socle reste, lui : programme, émargement, règlement…", () => {
    for (const type of [
      "programme",
      "organisation_action",
      "reglement_interieur",
      "livret_accueil",
      "convocation",
      "emargement",
      "positionnement",
    ]) {
      expect(pieceMiseEnAvant(type, ctx()), `« ${type} » a disparu du premier plan`).toBe(true);
    }
  });

  it("un financement OPCO fait REVENIR ses kits", () => {
    // Le repli est contextuel, pas définitif : le même écran sur un autre
    // dossier propose autre chose.
    expect(pieceMiseEnAvant("kit_opco", ctx({ financement: "opco" }))).toBe(true);
    expect(pieceMiseEnAvant("convention_tripartite", ctx({ financement: "opco" }))).toBe(true);
  });

  it("un financement MIXTE ouvre tous les circuits concernés", () => {
    const m = ctx({ financement: "mixte" });
    expect(pieceMiseEnAvant("kit_opco", m)).toBe(true);
    expect(pieceMiseEnAvant("kit_cpf", m)).toBe(true);
    expect(pieceMiseEnAvant("kit_france_travail", m)).toBe(true);
  });
});

describe("🔴 PARTICULIER ≠ PROFESSIONNEL — ce n'est pas de l'ergonomie", () => {
  it("un particulier ne se voit JAMAIS proposer une convention", () => {
    // 🔴 Pour une personne physique se formant à titre individuel et à ses
    // frais, la pièce est un CONTRAT L.6353-3, pas une convention L.6353-1.
    // Proposer la convention, c'est proposer la mauvaise pièce — pas un
    // libellé maladroit.
    const p = ctx({ typeClient: "particulier" });
    expect(pertinencePiece("convention", p)).toBe("sans_objet");
    expect(pieceMiseEnAvant("contrat", p)).toBe(true);
  });

  it("une entreprise ne se voit pas proposer un contrat individuel", () => {
    expect(pertinencePiece("contrat", ctx())).toBe("sans_objet");
    expect(pieceMiseEnAvant("convention", ctx())).toBe(true);
  });

  it("les deux motifs de repli NOMMENT l'article applicable", () => {
    // Un admin doit pouvoir comprendre le repli sans ouvrir le code du travail.
    expect(motifRepli("convention", ctx({ typeClient: "particulier" }))).toContain("L.6353-3");
    expect(motifRepli("contrat", ctx())).toContain("L.6353-1");
  });
});

describe("🔴 la lettre de mission que le dossier n°1 a dû ANNULER", () => {
  it("le dirigeant-formateur ne se confie pas de mission à lui-même", () => {
    // Cas réel : la pièce a été annulée au registre pour ce motif exact, et
    // l'écran continuait de la proposer.
    expect(pertinencePiece("lettre_mission", ctx({ formateurEstLeDirigeant: true }))).toBe(
      "sans_objet",
    );
    expect(motifRepli("lettre_mission", ctx({ formateurEstLeDirigeant: true }))).toContain(
      "deux personnes",
    );
  });

  it("avec un formateur tiers, elle reste disponible", () => {
    expect(pertinencePiece("lettre_mission", ctx({ formateurEstLeDirigeant: false }))).toBe(
      "possible",
    );
  });

  it("sans information sur le formateur, on ne l'interdit pas", () => {
    // Le drapeau absent ⇒ on ne SAIT pas. Interdire « faute de savoir »
    // bloquerait un geste légitime sur un dossier atypique.
    expect(pertinencePiece("lettre_mission", ctx())).toBe("possible");
  });
});

describe("🔴 les pièces d'après-séance suivent le statut", () => {
  it("session planifiée : attestation repliée, pas interdite", () => {
    // Elle reste ACCESSIBLE : un dossier atypique existe, et un bouton
    // introuvable enverrait quelqu'un contourner l'outil.
    expect(pertinencePiece("attestation", ctx())).toBe("possible");
  });

  it("session réalisée : elle passe au premier plan", () => {
    expect(pieceMiseEnAvant("attestation", ctx({ statut: "realisee" }))).toBe(true);
    expect(pieceMiseEnAvant("certificat_realisation", ctx({ statut: "realisee" }))).toBe(true);
  });
});

describe("🔴 le défaut est « possible », pas « sans objet »", () => {
  it("un type inconnu reste proposé, simplement replié", () => {
    // ⚠️ C'est l'INVERSE du choix de `piece-remise.ts` (défaut « jamais »), et
    // c'est délibéré. Là-bas le risque est de MONTRER au stagiaire ce qu'il ne
    // fallait pas ; ici le risque est d'EMPÊCHER un geste légitime de l'admin.
    // Le défaut protège du pire des deux, et ils ne sont pas du même côté.
    expect(pertinencePiece("un_type_inedit", ctx())).toBe("possible");
    expect(pieceMiseEnAvant("un_type_inedit", ctx())).toBe(false);
  });

  it("une pièce mise en avant n'a AUCUN motif de repli", () => {
    // Sinon l'écran afficherait une explication de repli sous un bouton
    // parfaitement pertinent — une contradiction visible.
    expect(motifRepli("programme", ctx())).toBeNull();
  });

  it("toute pièce repliée a un motif — jamais un silence", () => {
    // 🔴 Une pièce reléguée sans explication ressemble à une pièce oubliée.
    for (const type of ["kit_opco", "kit_cpf", "convention", "attestation", "un_type_inedit"]) {
      const c = type === "convention" ? ctx({ typeClient: "particulier" }) : ctx();
      if (pieceMiseEnAvant(type, c)) continue;
      // ⚠️ Pas `/\S{10,}/` : ce motif exige dix caractères NON-ESPACE
      // consécutifs, ce qu'une phrase française n'a presque jamais. Mesurer la
      // longueur dit ce qu'on veut dire ; le motif disait autre chose.
      expect(
        (motifRepli(type, c) ?? "").length,
        `« ${type} » est replié sans dire pourquoi`,
      ).toBeGreaterThan(20);
    }
  });
});

describe("le financement non renseigné", () => {
  it("ne fait pas disparaître le socle", () => {
    const inconnu = ctx({ financement: null, typeClient: null });
    expect(pieceMiseEnAvant("programme", inconnu)).toBe(true);
    expect(pieceMiseEnAvant("emargement", inconnu)).toBe(true);
  });

  it("et le motif de repli d'un kit le DIT au lieu d'inventer", () => {
    expect(motifRepli("kit_opco", ctx({ financement: null }))).toContain("non renseigné");
  });
});
