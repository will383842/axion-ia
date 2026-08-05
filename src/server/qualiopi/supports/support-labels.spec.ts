/**
 * Tests de PARITÉ — libellés des types de supports (convergence 2026-08-05).
 *
 * Trois tables de libellés divergeaient pour le même objet : TYPE_LABELS_RAW
 * (supports/page.tsx), titreSupport (support-builder.ts) et typeLabelFr
 * (template PDF). La convergence tient ainsi :
 *   - supports/page.tsx et l'écran « Tout pour animer » IMPORTENT le SSOT
 *     SUPPORT_TYPE_LABELS (parité structurelle — une page ne peut plus
 *     diverger sans changer le SSOT) ;
 *   - le badge PDF garde sa propre table (style MAJUSCULES) : c'est ELLE que ce
 *     spec compare au SSOT, mot pour mot. Si l'une des deux bouge seule, ce
 *     test rougit.
 */

import { describe, it, expect } from "vitest";
import { SUPPORT_TYPE_LABELS, titreSupport } from "./support-builder";
import { typeLabelFr } from "./templates/support-pdf";
import type { SupportType } from "../../../../prisma/generated/client";

const TYPES = Object.keys(SUPPORT_TYPE_LABELS) as SupportType[];

describe("parité des libellés de supports", () => {
  it("le badge PDF = SSOT en MAJUSCULES, pour chaque type", () => {
    for (const type of TYPES) {
      expect(typeLabelFr(type), `divergence PDF/SSOT sur ${type}`).toBe(
        SUPPORT_TYPE_LABELS[type].toLocaleUpperCase("fr-FR"),
      );
    }
  });

  it("titreSupport commence par le libellé SSOT, pour chaque type", () => {
    for (const type of TYPES) {
      expect(titreSupport(type, "Ma formation")).toBe(
        `${SUPPORT_TYPE_LABELS[type]} — Ma formation`,
      );
    }
  });

  it("libellés cibles de la convergence (décision 2026-08-05)", () => {
    // « Livret de projection » et non « Diaporama » : le diaporama est le slot
    // .pptx du kit documentaire — un objet DIFFÉRENT du PDF généré.
    expect(SUPPORT_TYPE_LABELS.slides_formateur).toBe("Livret de projection (formateur)");
    expect(SUPPORT_TYPE_LABELS.slides_stagiaire).toBe("Support de cours (stagiaire)");
  });

  it("les libellés restent distincts deux à deux", () => {
    const valeurs = TYPES.map((t) => SUPPORT_TYPE_LABELS[t]);
    expect(new Set(valeurs).size).toBe(valeurs.length);
  });
});
