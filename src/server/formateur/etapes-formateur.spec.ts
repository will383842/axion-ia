/**
 * Tests — etapes-formateur.ts (module PUR, aucune base).
 *
 * Deux enjeux, et le second est le vrai :
 *
 * 1. **Exhaustivité** — chaque clé de `EtapeCle` a une décision. Le compilateur
 *    l'exige déjà, mais un `Record` peut être élargi par un `as` malheureux ; ce
 *    test le vérifie à l'exécution, contre la liste littérale des clés.
 *
 * 2. 🔴 **Le filtre filtre-t-il ?** — un filtre qui laisse tout passer a
 *    exactement la même signature, les mêmes types et les mêmes tests de forme
 *    qu'un filtre qui trie. La seule chose qui les distingue, c'est une
 *    assertion qui NOMME les étapes qui doivent être exclues. Sans elle, on
 *    aurait « une garde qui ne garde rien ».
 */

import { describe, it, expect } from "vitest";

import {
  ETAPES_DU_FORMATEUR,
  GESTE_FORMATEUR,
  concerneLeFormateur,
  filtrerEtapesFormateur,
  sessionsDansLePerimetre,
} from "./etapes-formateur";
import type { EtapeCle } from "@/server/qualiopi/parcours/session-parcours";

/**
 * La liste littérale des clés, recopiée à la main depuis `EtapeCle`.
 *
 * ⚠️ La recopie est VOLONTAIRE : dériver cette liste de `ETAPES_DU_FORMATEUR`
 * ferait un test qui se vérifie lui-même — il resterait vert quelle que soit la
 * table. Le jour où `EtapeCle` gagne une clé, c'est le compilateur (via le
 * `satisfies` ci-dessous) qui refuse ce fichier.
 */
const TOUTES_LES_CLES = [
  "formateur_assigne",
  "convention_generee",
  "convention_signee",
  "convention_contresignee",
  "positionnement_envoye",
  "positionnement_repondu",
  "convocation_envoyee",
  "creneaux_emargement",
  "liens_signature_emis",
  "emargement_signe",
  "evaluation_finale",
  "attestation",
  "acces_portail",
  "satisfaction_chaud",
  "satisfaction_froid",
] as const satisfies ReadonlyArray<EtapeCle>;

describe("ETAPES_DU_FORMATEUR — la table de décision", () => {
  it("porte une décision pour CHAQUE clé d'étape, et pour aucune autre", () => {
    const cles = Object.keys(ETAPES_DU_FORMATEUR).sort();
    expect(cles).toEqual([...TOUTES_LES_CLES].sort());
  });

  it("ne contient que des booléens (pas d'undefined qui vaudrait « exclu » par accident)", () => {
    for (const cle of TOUTES_LES_CLES) {
      expect(typeof ETAPES_DU_FORMATEUR[cle]).toBe("boolean");
    }
  });

  it("🔴 EXCLUT les gestes que le formateur ne peut pas poser", () => {
    // Le contre-test. Si cette liste passe un jour à `true`, l'accueil du
    // formateur se remet à lui réclamer une convention, une attestation ou une
    // relance de questionnaire — des gestes gardés par `requireAdminWrite`.
    const exclues: ReadonlyArray<EtapeCle> = [
      "formateur_assigne",
      "convention_generee",
      "convention_signee",
      "convention_contresignee",
      "positionnement_envoye",
      "positionnement_repondu",
      "convocation_envoyee",
      "liens_signature_emis",
      "evaluation_finale",
      "attestation",
      "acces_portail",
      "satisfaction_chaud",
      "satisfaction_froid",
    ];
    for (const cle of exclues) {
      expect(concerneLeFormateur(cle)).toBe(false);
    }
  });

  it("🔴 le filtre FILTRE : au moins une étape est exclue, et une majorité l'est", () => {
    const retenues = TOUTES_LES_CLES.filter((c) => concerneLeFormateur(c));
    // Un filtre « tout vrai » a la même signature et les mêmes types qu'un
    // filtre qui trie. C'est cette assertion, et elle seule, qui les sépare.
    expect(retenues.length).toBeLessThan(TOUTES_LES_CLES.length);
    expect(retenues.length).toBeGreaterThan(0);
    expect(retenues).toEqual(["creneaux_emargement", "emargement_signe"]);
  });

  it("réécrit le geste de CHAQUE étape retenue (le geste de la console nomme des boutons absents)", () => {
    for (const cle of TOUTES_LES_CLES) {
      if (concerneLeFormateur(cle)) {
        expect(GESTE_FORMATEUR[cle], `geste formateur manquant pour ${cle}`).toBeTruthy();
      }
    }
  });

  it("ne réécrit AUCUN geste d'étape exclue (une phrase jamais rendue est une phrase qui ment un jour)", () => {
    for (const cle of Object.keys(GESTE_FORMATEUR) as EtapeCle[]) {
      expect(concerneLeFormateur(cle), `${cle} a un geste mais est exclue`).toBe(true);
    }
  });
});

describe("filtrerEtapesFormateur", () => {
  const ligne = (cle: EtapeCle) => ({ etape: { cle }, sessionId: "s1" });

  it("retire les étapes qui ne concernent pas le formateur", () => {
    const entree = [
      ligne("convention_signee"),
      ligne("emargement_signe"),
      ligne("attestation"),
      ligne("creneaux_emargement"),
    ];
    expect(filtrerEtapesFormateur(entree).map((e) => e.etape.cle)).toEqual([
      "emargement_signe",
      "creneaux_emargement",
    ]);
  });

  it("préserve l'ordre d'entrée — l'urgence est déjà triée par le service", () => {
    const entree = [ligne("creneaux_emargement"), ligne("emargement_signe")];
    expect(filtrerEtapesFormateur(entree).map((e) => e.etape.cle)).toEqual([
      "creneaux_emargement",
      "emargement_signe",
    ]);
  });

  it("rend une liste vide quand rien ne concerne le formateur", () => {
    expect(filtrerEtapesFormateur([ligne("attestation"), ligne("satisfaction_froid")])).toEqual([]);
  });
});

describe("sessionsDansLePerimetre", () => {
  const MAINTENANT = new Date("2026-08-17T10:00:00Z");
  const j = (n: number) => new Date(MAINTENANT.getTime() + n * 24 * 60 * 60 * 1000);

  it("retient les sessions planifiées et en cours", () => {
    const ids = sessionsDansLePerimetre(
      [
        { id: "a", statut: "planifiee", dateFin: j(30) },
        { id: "b", statut: "en_cours", dateFin: j(1) },
      ],
      MAINTENANT,
    );
    expect(ids).toEqual(["a", "b"]);
  });

  it("retient une session réalisée dans la fenêtre de 45 jours", () => {
    expect(
      sessionsDansLePerimetre([{ id: "a", statut: "realisee", dateFin: j(-44) }], MAINTENANT),
    ).toEqual(["a"]);
  });

  it("🔴 écarte une session réalisée AU-DELÀ de la fenêtre", () => {
    // Sans cette borne, `prochainesEcheances({ sessionIds })` — qui n'applique
    // aucun filtre de date sur un balayage ciblé — construirait le parcours de
    // sessions vieilles de deux ans, dont les étapes resteraient `hors_delai`
    // pour l'éternité : un accueil définitivement rouge, que plus personne ne
    // regarde.
    expect(
      sessionsDansLePerimetre([{ id: "a", statut: "realisee", dateFin: j(-46) }], MAINTENANT),
    ).toEqual([]);
  });

  it("écarte les sessions annulées et reportées (leur parcours est replié : zéro étape)", () => {
    expect(
      sessionsDansLePerimetre(
        [
          { id: "a", statut: "annulee", dateFin: j(5) },
          { id: "b", statut: "reportee", dateFin: j(5) },
        ],
        MAINTENANT,
      ),
    ).toEqual([]);
  });
});
