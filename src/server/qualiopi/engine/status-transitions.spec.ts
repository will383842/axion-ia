/**
 * 🔴 `D2-1-02` — approuver un assemblage rendait la formation VENDABLE.
 *
 * `resolveNextStatutAfterApproval("assemblage", …)` rendait `"publie"`, et le
 * commentaire qui l'accompagnait affirmait le contraire :
 *
 * > « la publication finale reste gatée par publishFormationAction (T3) qui
 * > requiert validatedBy. Ici on marque seulement l'avancement. »
 *
 * C'était faux, et c'est ce qui rendait le défaut invisible.
 * `statutGeneration = "publie"` **est** la publication : c'est le prédicat exact
 * que lisent le créateur de sessions et le tunnel de vente,
 * `{ statut: "actif", statutGeneration: "publie" }`.
 *
 * Approuver un assemblage — sous `requireAdminWrite`, donc accessible au rôle
 * `editor` — contournait donc TROIS gardes d'un coup : la validation humaine de
 * l'AI Act art. 50 (`validatedBy`), le plancher de ratio pratique Qualiopi, et
 * `requireAdminPublish`.
 *
 * ## Pourquoi ce fichier n'existait pas
 *
 * Cette table décide si une formation devient publiquement vendable, et elle
 * n'avait **aucun test** — pas plus que `approveFileValidationAction` qui
 * l'appelle. 🔑 Le module le plus court d'un domaine est souvent le plus
 * décisif ; sa brièveté le fait passer pour évident.
 */

import { describe, it, expect } from "vitest";
import {
  resolveNextStatutAfterApproval,
  resolveRevertStatutAfterRejection,
} from "./status-transitions";

describe("🔴 resolveNextStatutAfterApproval — l'approbation d'un assemblage", () => {
  it("🔴 NE PUBLIE PAS : elle assemble", () => {
    // LE constat. `publie` rend la formation sélectionnable en création de
    // session ET dans le tunnel de vente.
    expect(resolveNextStatutAfterApproval("assemblage", "contenu_valide")).toBe("assemble");
  });

  it("🔴 aucune étape, quelle qu'elle soit, ne mène à `publie`", () => {
    // Témoin de PORTÉE, pas de cas : publier est un acte séparé et gardé
    // (`publishFormationAction` : requireAdminPublish + validatedBy + ratio).
    // Aucune approbation de pipeline ne doit y conduire, aujourd'hui ni après
    // l'ajout d'une étape.
    const etapes = ["structure", "contenu", "assemblage", "inconnue", ""];
    const statuts = [
      "intention",
      "structure_generee",
      "structure_validee",
      "contenu_evalue",
      "contenu_genere",
      "contenu_valide",
      "assemble",
      "publie",
    ] as const;

    const fautifs: string[] = [];
    for (const e of etapes) {
      for (const s of statuts) {
        if (resolveNextStatutAfterApproval(e, s) === "publie") fautifs.push(`${e} ← ${s}`);
      }
    }
    expect(
      fautifs,
      "une approbation de pipeline publie la formation : elle devient vendable sans " +
        "validation humaine (AI Act art. 50), sans plancher de ratio pratique, et " +
        "sous un rôle `editor`.",
    ).toEqual([]);
  });

  it("le contenu approuvé fait avancer vers `contenu_valide`", () => {
    // Témoin de non-vacuité : sans lui, une fonction qui rendrait toujours
    // `null` ferait passer le cas ci-dessus sans rien garder du pipeline.
    expect(resolveNextStatutAfterApproval("contenu", "contenu_genere")).toBe("contenu_valide");
  });

  it("la structure n'avance que depuis `structure_generee`", () => {
    expect(resolveNextStatutAfterApproval("structure", "structure_generee")).toBe("contenu_evalue");
    expect(resolveNextStatutAfterApproval("structure", "contenu_valide")).toBeNull();
  });

  it("une étape inconnue ne fait rien plutôt que de deviner", () => {
    expect(resolveNextStatutAfterApproval("etape-inventee", "intention")).toBeNull();
  });
});

describe("resolveRevertStatutAfterRejection — le retour arrière", () => {
  it("un assemblage rejeté revient à `contenu_valide`, jamais à un cul-de-sac", () => {
    // `contenu_genere` serait un cul-de-sac : ni relançable, ni resetable, no-op
    // côté worker — le « corriger puis relancer » promis serait impossible.
    expect(resolveRevertStatutAfterRejection("assemblage")).toBe("contenu_valide");
  });

  it("un contenu rejeté repart de la structure", () => {
    expect(resolveRevertStatutAfterRejection("contenu")).toBe("structure_generee");
  });
});
