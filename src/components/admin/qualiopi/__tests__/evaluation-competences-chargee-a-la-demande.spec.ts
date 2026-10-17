// @vitest-environment node

/**
 * Qualiopi ind. 21 — les panneaux conditionnels de la fiche formateur restent CHARGÉS
 * À LA DEMANDE.
 *
 * Importé tel quel par la fiche (composant serveur), le panneau d'évaluation entrait dans
 * le chunk de la page : la somme des page chunks de la console passait à 563,13 kB pour
 * un cliquet à 560 KB, que `main` dépassait déjà (560,36 kB). Le cliquet est l'affaire de
 * Will (ADR 0068 : 600 KB, « on continue d'alléger la console par chargement différé ») ;
 * ce test ne le fixe pas. Les panneaux passent donc par des enrobages CLIENT avec
 * `React.lazy` (depuis un composant serveur, un import dynamique ne découpe pas le code ;
 * `next/dynamic` tire son runtime dans le chunk de la page).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const FICHE = "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/formateurs/[id]/page.tsx";
const ENROBAGE = "src/components/admin/qualiopi/PanneauxDifferesFicheFormateur.tsx";
const PANNEAUX = [
  "EvaluationCompetencesPanel",
  "PresentationMethodePanel",
  "FinCollaborationPanel",
] as const;

describe("panneaux de la fiche formateur chargés à la demande", () => {
  it.each(PANNEAUX)("la fiche n'importe jamais %s directement", (panneau) => {
    expect(lire(FICHE)).not.toContain(`from "@/components/admin/qualiopi/${panneau}"`);
  });

  it("la fiche passe par les enrobages différés", () => {
    expect(lire(FICHE)).toContain(
      'from "@/components/admin/qualiopi/PanneauxDifferesFicheFormateur"',
    );
  });

  it.each(PANNEAUX)("l'enrobage charge %s par `lazy(import())`, jamais par valeur", (panneau) => {
    const e = lire(ENROBAGE);
    expect(e.trimStart().startsWith('"use client";')).toBe(true);
    expect(e).toContain(`lazy(() =>\n  import("./${panneau}")`);
    expect(e).not.toMatch(new RegExp(`^import \\{[^}]*\\} from "\\./${panneau}";`, "m"));
    expect(e).not.toMatch(/from "next\/dynamic"/);
  });
});
