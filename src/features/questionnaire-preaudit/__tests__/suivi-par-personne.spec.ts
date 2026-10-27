// @vitest-environment node
/**
 * Le lecteur du suivi par personne, sur une base factice : le contenu n'est jamais rendu, une
 * réponse mise à l'écart n'est pas déchiffrée, la panne des ouvertures se dit, le squelette est
 * mis en cache pour un questionnaire déjà envoyé.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/visio/questionnaire-en-ligne/jeton", () => ({
  codeDirigeantPreauditValide: (_id: string, m: unknown) => m === "CODEDIRIGEANT00000000",
}));
vi.mock("@/lib/chiffrer-parole", async (importOriginal) => {
  const o = await importOriginal<typeof import("@/lib/chiffrer-parole")>();
  return { ...o, dechiffrerParole: vi.fn(o.dechiffrerParole) };
});

import { chiffrerParole, dechiffrerParole } from "@/lib/chiffrer-parole";

import { lireSuiviParPersonne, viderLeCacheDuSquelette } from "../suivi-par-personne";
import { HTML_SYNTHETIQUE } from "./squelette.fixture";

process.env["PII_ENCRYPTION_KEY"] = "d".repeat(64);
const SECRET = "TEXTE-SECRET-XYZ";
const QID = "00000000-0000-4000-8000-000000000001";

type Ligne = Record<string, unknown>;

function fabrique(opts: { ouverturesErreur?: unknown; envoye?: boolean } = {}) {
  const compteurs = { html: 0 };
  const equipe = [
    { id: "aaaaaaaaaaa1", prenom: "Alice", nom: "Martin", role: "R", journee: "Oui" },
  ];
  const envois: Ligne[] = [
    {
      id: "e1",
      questionnaireId: QID,
      mode: "main",
      membre: null,
      recuLe: new Date("2026-10-26T10:00:00Z"),
      ecarteLe: null,
      donnees: chiffrerParole(
        JSON.stringify({
          mode: "main",
          membre: "CODEDIRIGEANT00000000",
          donnees: { equipe, a_nom: SECRET },
        }),
      ),
    },
    {
      id: "e2",
      questionnaireId: QID,
      mode: "emp",
      membre: "aaaaaaaaaaa1",
      recuLe: new Date("2026-10-26T11:00:00Z"),
      ecarteLe: new Date("2026-10-27T08:00:00Z"),
      donnees: chiffrerParole(JSON.stringify({ donnees: { b_1: SECRET } })),
    },
  ];
  const brouillons: Ligne[] = [
    {
      id: "b1",
      questionnaireId: QID,
      mode: "it",
      membre: "it-abcdef123456",
      majLe: new Date("2026-10-27T09:00:00Z"),
      donnees: "pas-chiffre-du-tout",
    },
  ];
  const base = {
    questionnaireAvantAudit: {
      findMany: async ({ select }: { select: Ligne }) => {
        if (select["html"] === true) {
          compteurs.html++;
          return [{ id: QID, html: HTML_SYNTHETIQUE, envoyeLe: opts.envoye === false ? null : new Date() }];
        }
        return [
          {
            id: QID,
            luLe: null,
            expireLe: new Date("2026-12-01T00:00:00Z"),
            envoyeLe: opts.envoye === false ? null : new Date("2026-10-25T09:00:00Z"),
          },
        ];
      },
    },
    questionnaireAvantAuditEnvoi: { findMany: async () => envois },
    questionnaireAvantAuditBrouillon: { findMany: async () => brouillons },
    questionnaireAvantAuditOuverture: {
      findMany: async () => {
        if (opts.ouverturesErreur !== undefined) throw opts.ouverturesErreur;
        return [];
      },
    },
  };
  return { base: base as never, compteurs };
}

beforeEach(() => {
  viderLeCacheDuSquelette();
  vi.mocked(dechiffrerParole).mockClear();
  delete process.env["QUESTIONNAIRE_SUIVI_ENABLED"];
});

describe("lireSuiviParPersonne", () => {
  it("rend des états et des comptes, jamais le contenu", async () => {
    const { base } = fabrique();
    const r = (await lireSuiviParPersonne([QID], base)).get(QID)!;
    const sortie = JSON.stringify(r);
    expect(sortie).not.toContain(SECRET);
    expect(sortie).not.toContain("CODEDIRIGEANT00000000");
    expect(r.suivi.dirigeant.etat).toBe("recu");
    expect(r.suivi.collaborateurs[0]?.etat).toBe("ecartee");
    expect(r.controle).toEqual({ reponses: 2, ecartees: 1, illisibles: 0, brouillons: 1 });
  });

  it("un brouillon illisible garde sa ligne (état « en cours ») et ne casse rien", async () => {
    const { base } = fabrique();
    const r = (await lireSuiviParPersonne([QID], base)).get(QID)!;
    expect(r.suivi.referents[0]?.etat).toBe("en_cours");
    expect(r.suivi.referents[0]?.taux).toBeNull();
  });

  it("une réponse mise à l'écart n'est pas déchiffrée", async () => {
    const { base } = fabrique();
    await lireSuiviParPersonne([QID], base);
    // 1 réponse du dirigeant + 1 brouillon : la réponse écartée n'a pas été déchiffrée.
    expect(vi.mocked(dechiffrerParole)).toHaveBeenCalledTimes(2);
  });

  it("ouvertures : table absente (P2021) => ouvertures indisponibles, le reste est rendu", async () => {
    process.env["QUESTIONNAIRE_SUIVI_ENABLED"] = "true";
    const { base } = fabrique({ ouverturesErreur: { code: "P2021" } });
    const r = (await lireSuiviParPersonne([QID], base)).get(QID)!;
    expect(r.suivi.ouverturesIndisponibles).toBe(true);
    expect(r.suivi.dirigeant.etat).toBe("recu");
  });

  it("une autre erreur sur les ouvertures est remontée", async () => {
    process.env["QUESTIONNAIRE_SUIVI_ENABLED"] = "true";
    const { base } = fabrique({ ouverturesErreur: new Error("boum") });
    await expect(lireSuiviParPersonne([QID], base)).rejects.toThrow("boum");
  });

  it("interrupteur éteint : les ouvertures ne sont pas lues", async () => {
    const { base } = fabrique({ ouverturesErreur: new Error("ne doit pas être appelé") });
    const r = (await lireSuiviParPersonne([QID], base)).get(QID)!;
    expect(r.suivi.ouverturesIndisponibles).toBe(true);
  });

  it("le cache évite de relire le HTML d'un questionnaire déjà envoyé", async () => {
    const { base, compteurs } = fabrique();
    await lireSuiviParPersonne([QID], base);
    await lireSuiviParPersonne([QID], base);
    expect(compteurs.html).toBe(1);
  });

  it("un questionnaire non envoyé n'est jamais mis en cache", async () => {
    const { base, compteurs } = fabrique({ envoye: false });
    await lireSuiviParPersonne([QID], base);
    await lireSuiviParPersonne([QID], base);
    expect(compteurs.html).toBe(2);
  });
});
