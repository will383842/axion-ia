/**
 * 🔴 ADR 0060 × L3 — sur un dossier CLOS, le fil conducteur ne propose JAMAIS
 * un geste verrouillé.
 *
 * La fiche (lot L2) masque chaque écriture `verrou` d'un dossier clos ; la
 * checklist (lot L3) continuait de dire « Aller à : … » et « bouton « Générer
 * … » » pour une étape restée due. Ce fichier verrouille :
 *  1. chaque action citée par une étape existe au REGISTRE du verrou — la
 *     décision se lit là-bas, jamais recopiée ;
 *  2. les gestes DIRECTS de la checklist sont tous non verrouillés ;
 *  3. la liste exacte des étapes encore possibles sur un dossier clos ;
 *  4. le rendu : dossier clos → ni « Aller à », ni geste, ni bouton direct pour
 *     une étape bloquée ; TÉMOIN dossier ouvert → tout est proposé ;
 *  5. l'interrupteur `QUALIOPI_VERROU_DOSSIER=off` rend tout (rien n'est figé) ;
 *  6. la fiche et « À traiter » branchent bien la règle.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/features/admin-qualiopi/session-hub/GesteEtape", () => ({
  GesteEtape: ({ geste }: { geste: { type: string } }) => (
    <span data-geste-direct={geste.type}>GESTE-DIRECT</span>
  ),
}));

import { ChecklistSession } from "@/features/admin-qualiopi/session-hub/ChecklistSession";
import {
  ACTION_DU_GESTE_DIRECT,
  ACTIONS_DU_GESTE,
  etapeBloqueeParLeVerrou,
  etapePossibleSurDossierClos,
  MENTION_GESTE_VERROUILLE,
} from "@/server/qualiopi/parcours/etape-dossier-clos";
import type { EtapeCle, EtapeParcours } from "@/server/qualiopi/parcours/session-parcours";
import { ECRITURES_SESSION } from "@/server/qualiopi/sessions/verrou-dossier-registre";
import { dossierFige, type EtatVerrouDossier } from "@/server/qualiopi/sessions/verrou-dossier-pur";

const CLOS: EtatVerrouDossier = { etat: "clos", depuis: new Date("2026-09-20T10:00:00.000Z") };

function etape(patch: Partial<EtapeParcours> & Pick<EtapeParcours, "cle">): EtapeParcours {
  return {
    libelle: `Libellé ${patch.cle}`,
    etat: "rattrapable",
    mention: "rattrapable",
    geste: `GESTE-TEXTE ${patch.cle}`,
    phase: "apres",
    cible: { sousPage: "evaluations", fragment: "evaluations", libelle: "Évaluations" },
    ...patch,
  };
}

const EVALUATION = etape({ cle: "evaluation_finale" });
const FROID = etape({
  cle: "satisfaction_froid",
  etat: "a_faire",
  cible: { fragment: "questionnaires", libelle: "Questionnaires" },
  gesteDirect: {
    type: "relancer_questionnaire",
    cibles: [{ questionnaireId: "q1", destinataire: "Alice Martin" }],
  },
});

function rendre(fige: boolean): string {
  return renderToStaticMarkup(
    <ChecklistSession
      etapes={[EVALUATION, FROID]}
      fait={0}
      total={2}
      sessionId="s1"
      prefixeSessions="/fr/admin/qualiopi/sessions"
      fige={fige}
    />,
  );
}

/** Le fragment HTML de la ligne d'une étape (le `<li>` qui porte son libellé). */
function ligne(html: string, cle: EtapeCle): string {
  const items = html.split("<li").slice(1);
  const trouve = items.find((i) => i.includes(`Libellé ${cle}`));
  if (trouve === undefined) throw new Error(`ligne ${cle} absente`);
  return trouve;
}

afterEach(() => {
  delete process.env["QUALIOPI_VERROU_DOSSIER"];
});

describe("la décision vient du registre du verrou", () => {
  const connues = new Set(ECRITURES_SESSION.map((e) => e.action));

  it("chaque action citée par une étape figure au registre", () => {
    const inconnues = Object.values(ACTIONS_DU_GESTE)
      .flat()
      .filter((a) => !connues.has(a));
    expect(inconnues).toEqual([]);
  });

  it("chaque étape cite au moins une action", () => {
    for (const [cle, actions] of Object.entries(ACTIONS_DU_GESTE)) {
      expect(actions.length, cle).toBeGreaterThan(0);
    }
  });

  it("les gestes DIRECTS de la checklist sont tous non verrouillés", () => {
    for (const [type, action] of Object.entries(ACTION_DU_GESTE_DIRECT)) {
      const e = ECRITURES_SESSION.find((x) => x.action === action);
      expect(e, type).toBeDefined();
      expect(e!.decision, type).not.toBe("verrou");
    }
  });

  it("sur un dossier clos, seules ces étapes restent possibles", () => {
    const possibles = (Object.keys(ACTIONS_DU_GESTE) as EtapeCle[])
      .filter(etapePossibleSurDossierClos)
      .sort();
    expect(possibles).toEqual(
      [
        "acces_portail",
        "contresignature_formateur",
        "convention_contresignee",
        "convention_signee",
        "positionnement_repondu",
        "satisfaction_chaud",
        "satisfaction_froid",
      ].sort(),
    );
  });

  it("une étape faite ou sans objet n'est jamais « bloquée », ni rien hors dossier figé", () => {
    expect(etapeBloqueeParLeVerrou({ cle: "attestation", etat: "fait" }, true)).toBe(false);
    expect(etapeBloqueeParLeVerrou({ cle: "attestation", etat: "sans_objet" }, true)).toBe(false);
    expect(etapeBloqueeParLeVerrou({ cle: "attestation", etat: "rattrapable" }, false)).toBe(false);
    expect(etapeBloqueeParLeVerrou({ cle: "attestation", etat: "rattrapable" }, true)).toBe(true);
  });
});

describe("la checklist sur un dossier clos", () => {
  it("n'offre ni « Aller à », ni le geste, pour une étape verrouillée — seulement « Voir »", () => {
    const l = ligne(rendre(true), "evaluation_finale");
    expect(l).not.toContain("Aller à");
    expect(l).not.toContain("GESTE-TEXTE");
    expect(l).toContain(MENTION_GESTE_VERROUILLE.replace(/'/g, "&#x27;"));
    expect(l).toContain(">Voir</a>");
  });

  it("garde « Aller à » et le geste direct d'une étape encore possible (relance à froid)", () => {
    const l = ligne(rendre(true), "satisfaction_froid");
    expect(l).toContain("Aller à : Questionnaires");
    expect(l).toContain("GESTE-DIRECT");
    expect(l).toContain("GESTE-TEXTE satisfaction_froid");
  });

  it("TÉMOIN — dossier ouvert : l'étape verrouillable est proposée comme avant", () => {
    const l = ligne(rendre(false), "evaluation_finale");
    expect(l).toContain("Aller à : Évaluations");
    expect(l).toContain("GESTE-TEXTE evaluation_finale");
    expect(l).not.toContain("Dossier clos");
  });

  it("interrupteur QUALIOPI_VERROU_DOSSIER=off : rien n'est figé, tout est proposé", () => {
    process.env["QUALIOPI_VERROU_DOSSIER"] = "off";
    const fige = dossierFige(CLOS);
    expect(fige).toBe(false);
    expect(ligne(rendre(fige), "evaluation_finale")).toContain("Aller à : Évaluations");
  });
});

describe("la fiche et « À traiter » branchent la règle", () => {
  const racine = resolve(__dirname, "../../../../..");
  const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");
  const admin = "src/app/[locale]/(admin)/[adminPrefix]/qualiopi";

  it("la fiche passe `fige` (dossierFige) à la checklist", () => {
    const src = lire(`${admin}/sessions/[id]/page.tsx`);
    expect(src).toMatch(/const fige = dossierFige\(verrou\.etat\)/);
    expect(src).toContain("fige={fige}");
  });

  it("« Encore possible » filtre les étapes verrouillées, et c'est le layout qui la rend", () => {
    const pur = lire("src/server/qualiopi/parcours/encore-possible.ts");
    expect(pur).toMatch(/!etapeBloqueeParLeVerrou\(e, true\)/);
    const layout = lire(`${admin}/sessions/[id]/layout.tsx`);
    expect(layout).toContain("gestesEncorePossibles(");
    expect(layout).toContain("encorePossible={encorePossible}");
  });

  it("🔴 relecture L3 — la fiche ne double rien de ce que porte le bandeau", () => {
    // Deux listes « Encore possible », deux fois le texte du verrou, deux fois
    // le ZIP et le registre : trois doublons, dont deux pouvaient se
    // contredire. Un seul exemplaire de chaque.
    const src = lire(`${admin}/sessions/[id]/page.tsx`)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    expect(src).not.toContain("Encore possible");
    expect(src).not.toContain("texteEtatVerrou(");
    expect(src.match(/<DossierSessionButton\b/g) ?? []).toHaveLength(1);
    expect(src.match(/mode-auditeur\/signatures\?session=/g) ?? []).toHaveLength(1);
  });

  it("« À traiter » ne décrit pas le geste d'une étape bloquée", () => {
    const src = lire(`${admin}/a-traiter/page.tsx`);
    expect(src).toContain("etapeBloqueeParLeVerrou(e.etape, figeSession(e.sessionId))");
    expect(src).toContain("MENTION_GESTE_VERROUILLE");
  });
});
