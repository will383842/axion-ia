/**
 * 🔴 UN SEUL MAPPING ligne Prisma → parcours.
 *
 * Il vivait en clair dans `prochainesEcheances`. Le hub d'une session a besoin
 * du MÊME parcours, et le recopier aurait fabriqué deux vérités : le jour où
 * une quinzième étape arrive, l'une des deux copies l'ignore, et l'écran qui
 * compte « 12/14 » n'est plus celui qui compte « 13/15 ».
 *
 * Ce fichier garde les deux moitiés du contrat : la traduction elle-même, et
 * le fait qu'aucun écran ne la refasse dans son coin.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { entreeParcours, type LigneSessionParcours } from "./echeances-service";

const MAINTENANT = new Date("2026-08-17T10:00:00Z");

const ligne = (patch: Partial<LigneSessionParcours> = {}): LigneSessionParcours => ({
  statut: "planifiee",
  dateDebut: new Date("2026-09-01T09:00:00Z"),
  dateFin: new Date("2026-09-02T17:00:00Z"),
  formateurPrincipalId: "f1",
  financementType: null,
  documents: [],
  enrollments: [],
  ...patch,
});

const inscription = (patch: Record<string, unknown> = {}) =>
  ({
    id: "e1",
    statut: "confirme",
    emargementSigneAt: null,
    convocationEnvoyeeAt: null,
    questionnaires: [],
    evaluations: [],
    emargementTokens: [],
    presences: [],
    trainee: { portailAcces: [] },
    ...patch,
  }) as LigneSessionParcours["enrollments"][number];

describe("entreeParcours — la traduction", () => {
  it("reporte la session telle quelle", () => {
    const e = entreeParcours(ligne(), new Map(), MAINTENANT);
    expect(e.session.statut).toBe("planifiee");
    expect(e.session.formateurPrincipalId).toBe("f1");
    expect(e.maintenant).toBe(MAINTENANT);
  });

  it("l'évaluation finale est la PREMIÈRE de la liste, ou null", () => {
    // La requête trie par date croissante et n'en prend qu'une. Traduire
    // `evaluations[0]` en `undefined` plutôt qu'en `null` ferait diverger le
    // type de l'entrée et l'étape se calculerait sur une valeur absente.
    const d = new Date("2026-09-03T00:00:00Z");
    const avec = entreeParcours(
      ligne({ enrollments: [inscription({ evaluations: [{ dateEvaluation: d }] })] }),
      new Map(),
      MAINTENANT,
    );
    expect(avec.inscriptions[0]?.evaluationFinaleAt).toBe(d);

    const sans = entreeParcours(ligne({ enrollments: [inscription()] }), new Map(), MAINTENANT);
    expect(sans.inscriptions[0]?.evaluationFinaleAt).toBeNull();
  });

  it("l'accès portail est un BOOLÉEN dérivé, pas un compte", () => {
    const e = entreeParcours(
      ligne({ enrollments: [inscription({ trainee: { portailAcces: [{ id: "a" }] } })] }),
      new Map(),
      MAINTENANT,
    );
    expect(e.inscriptions[0]?.aUnAccesPortail).toBe(true);
  });

  it("🔴 les créneaux et les liens se SOMMENT sur les inscriptions", () => {
    // Ils sont portés par l'INSCRIPTION, pas par la session. Les compter sur la
    // session donnerait zéro en silence — l'étape « émargement » se dirait
    // alors jamais commencée sur une session entièrement émargée.
    const e = entreeParcours(
      ligne({
        enrollments: [
          inscription({ id: "a", emargementTokens: [{ id: "t1" }], presences: [{ id: "p1" }] }),
          inscription({
            id: "b",
            emargementTokens: [{ id: "t2" }, { id: "t3" }],
            presences: [{ id: "p2" }, { id: "p3" }],
          }),
        ],
      }),
      new Map(),
      MAINTENANT,
    );
    expect(e.liensEmargementActifs).toBe(3); // 1 + 2
    expect(e.creneauxEmargement).toBe(3); // 1 + 2
  });

  it("sans inscription, les sommes valent zéro — pas undefined", () => {
    const e = entreeParcours(ligne(), new Map(), MAINTENANT);
    expect(e.liensEmargementActifs).toBe(0);
    expect(e.creneauxEmargement).toBe(0);
    expect(e.inscriptions).toEqual([]);
  });

  it("la table des signatures est passée SANS être recopiée", () => {
    // Une copie par session, c'est le patron de requêtes que T3a a retiré à ce
    // domaine : la table est chargée en une passe et partagée.
    const table = new Map([["d1", [{ partie: "client" }]]]);
    expect(entreeParcours(ligne(), table, MAINTENANT).signaturesParPiece).toBe(table);
  });
});

describe("🔴 aucun écran ne refait la traduction dans son coin", () => {
  const HUB = join(
    process.cwd(),
    "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/page.tsx",
  );
  // Les commentaires sont dépouillés : ce fichier-ci et le hub CITENT
  // `SessionParcoursInput` en prose pour expliquer pourquoi on ne le construit
  // pas — un test qui lirait la prose trouverait sa propre explication.
  const hub = readFileSync(HUB, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

  it("le dépouillement retire bien quelque chose", () => {
    expect(hub.length).toBeLessThan(readFileSync(HUB, "utf8").length);
  });

  it("le hub APPELLE le service partagé", () => {
    expect(hub).toMatch(/prochainesEcheances\s*\(/);
  });

  it("le hub ne construit PAS son propre SessionParcoursInput", () => {
    // La duplication que les relecteurs avaient signalée avant même qu'elle
    // existe. Elle ne redeviendra pas invisible.
    expect(hub).not.toContain("SessionParcoursInput");
    expect(hub).not.toContain("construireParcours");
  });
});
