// Le verdict d'envoi, extrait dans un module PUR — 2026-09-19.
//
// Ce qui est gardé ici :
//   - la table de vérité de `estSollicitationSoumiseAOpposition` : les deux
//     gabarits de sollicitation, et le kit du dossier commencé (même gabarit que
//     l'accusé, distingué par sa variante) ;
//   - la constante locale de variante reste ÉGALE à celle du kit, sans que le
//     module l'importe (le kit tire des chemins de page que le worker n'a pas à
//     charger) ;
//   - le module ne tire QUE la base et l'empreinte : c'est ce qui permet au
//     worker d'e-mails de l'importer sans charger `next-auth` ni `next/headers`.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirst = vi.fn();
const oppositionFindUnique = vi.fn();
const oppositionFindFirst = vi.fn();
const abonneFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: { findFirst: (...a: unknown[]) => findFirst(...a) },
    newsletterSubscriber: { findUnique: (...a: unknown[]) => abonneFindUnique(...a) },
    emailOpposition: {
      findUnique: (...a: unknown[]) => oppositionFindUnique(...a),
      findFirst: (...a: unknown[]) => oppositionFindFirst(...a),
    },
  },
}));

import { VARIANTE_DOSSIER_COMMENCE } from "@/lib/commercial-application/kit-apporteur";
import { VARIANTE_VSL_ABANDON } from "@/lib/commercial-application/vsl-apporteur";
import {
  estSollicitationSoumiseAOpposition,
  verdictAvantEnvoi,
  VARIANTE_KIT_DIFFERE,
  VARIANTE_VSL_ABANDON_DIFFEREE,
  GABARITS_SOLLICITATION_SOUMIS_A_OPPOSITION,
  MODELES_REPONSE_A_UN_DROIT,
} from "./verdict-envoi";

beforeEach(() => {
  findFirst.mockReset().mockResolvedValue(null);
  oppositionFindUnique.mockReset().mockResolvedValue(null);
  oppositionFindFirst.mockReset().mockResolvedValue(null);
  abonneFindUnique.mockReset().mockResolvedValue(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("estSollicitationSoumiseAOpposition — table de vérité", () => {
  it.each<[string, Record<string, unknown> | null | undefined, boolean]>([
    ["lead-apporteur-relance", {}, true],
    ["lead-apporteur-relance", undefined, true],
    ["apporteur-invitation-appel", { calendlyUrl: "https://calendly.com/x/y" }, true],
    [
      "apporteur-invitation-relance",
      { calendlyUrl: "https://calendly.com/x/y", etape: "j3" },
      true,
    ],
    ["lead-apporteur-recu", { variante: "dossier-commence" }, true],
    // 2026-10-10 — A1 du tunnel vidéo, 30 minutes après l'étape 1 : une sollicitation.
    ["lead-apporteur-recu", { variante: "vsl-abandon" }, true],
    // B1 répond à l'étape 2 que la personne vient de valider : pas une sollicitation.
    ["lead-apporteur-recu", { variante: "vsl-etape2" }, false],
    // L'accusé immédiat d'une démarche n'est PAS une sollicitation.
    ["lead-apporteur-recu", {}, false],
    ["lead-apporteur-recu", { variante: "autre-chose" }, false],
    ["lead-apporteur-recu", null, false],
    ["lead-apporteur-recu", undefined, false],
    // La variante ne vaut que pour CE gabarit.
    ["candidature-commercial-confirmee", { variante: "dossier-commence" }, false],
    ["qualiopi-convocation", {}, false],
    // Guide demandé par message privé d'un réseau : l'opposition le retient, à l'enfilage
    // comme au départ. Le guide du formulaire du site, lui, répond à une demande directe.
    ["guide-ia-envoi", { reseau: true }, true],
    ["guide-ia-envoi", { downloadToken: "x" }, false],
    ["guide-ia-envoi", undefined, false],
  ])("%s %j → %s", (gabarit, payload, attendu) => {
    expect(estSollicitationSoumiseAOpposition(gabarit, payload)).toBe(attendu);
  });

  it("la variante locale est celle du kit — sans que le module importe le kit", () => {
    expect(VARIANTE_KIT_DIFFERE).toBe(VARIANTE_DOSSIER_COMMENCE);
    expect(VARIANTE_VSL_ABANDON_DIFFEREE).toBe(VARIANTE_VSL_ABANDON);
  });

  it("l'ensemble des sollicitations n'a pas bougé", () => {
    expect([...GABARITS_SOLLICITATION_SOUMIS_A_OPPOSITION].sort()).toEqual([
      "apporteur-invitation-appel",
      "apporteur-invitation-relance",
      // 2026-09-28 — « on t'a attendu, on reprend un créneau ? » ; retenu et
      // non retenu répondent à l'échange réservé, ils n'y sont pas.
      "apporteur-issue-absent",
      "lead-apporteur-relance",
      // 2026-10-26 — les relances du questionnaire avant audit (l'invitation et la
      // confirmation restent des messages de service).
      "questionnaire-avant-audit-relance",
    ]);
  });
});

describe("verdictAvantEnvoi — drapeau `sollicitation` explicite", () => {
  it("🔴 un gabarit hors ensemble, marqué sollicitation, honore l'opposition", async () => {
    oppositionFindUnique.mockResolvedValue({ id: "opp-1" });
    const v = await verdictAvantEnvoi("oppose@exemple.fr", {
      template: "lead-apporteur-recu",
      marketing: false,
      sollicitation: true,
    });
    expect(v).toEqual({ retenu: true, motif: "oppose", depuis: null });
  });

  it("sans le drapeau, l'accusé d'une démarche n'est pas retenu par l'opposition", async () => {
    oppositionFindUnique.mockResolvedValue({ id: "opp-1" });
    const v = await verdictAvantEnvoi("oppose@exemple.fr", {
      template: "lead-apporteur-recu",
      marketing: false,
    });
    expect(v).toEqual({ retenu: false });
    expect(oppositionFindUnique).not.toHaveBeenCalled();
  });

  it("`sollicitation: false` explicite l'emporte sur l'ensemble", async () => {
    oppositionFindUnique.mockResolvedValue({ id: "opp-1" });
    const v = await verdictAvantEnvoi("oppose@exemple.fr", {
      template: "lead-apporteur-relance",
      marketing: false,
      sollicitation: false,
    });
    expect(v).toEqual({ retenu: false });
  });

  it("en l'absence du drapeau, l'ensemble décide (appelants existants inchangés)", async () => {
    oppositionFindUnique.mockResolvedValue({ id: "opp-1" });
    const v = await verdictAvantEnvoi("oppose@exemple.fr", {
      template: "lead-apporteur-relance",
      marketing: false,
    });
    expect(v).toEqual({ retenu: true, motif: "oppose", depuis: null });
  });
});

describe("verdictAvantEnvoi — personne écartée après une demande d'effacement (11/11/2026)", () => {
  const LE = new Date("2026-11-11T10:00:00Z");

  it.each([
    ["qualiopi-convocation", false],
    ["guide-ia-envoi", false],
    ["lead-apporteur-recu", false],
    ["campagne-x", true],
  ])(
    "🔴 « %s » (marketing : %s) est RETENU, quel que soit le gabarit",
    async (template, marketing) => {
      oppositionFindFirst.mockResolvedValue({ effacementDemandeLe: LE });
      const v = await verdictAvantEnvoi("ecartee@exemple.fr", { template, marketing });
      expect(v).toEqual({ retenu: true, motif: "ecarte_effacement", depuis: LE });
    },
  );

  it("🔴 `gdpr-export-link` (réponse à la demande d'accès de la personne) PASSE pour une adresse écartée", async () => {
    oppositionFindFirst.mockResolvedValue({ effacementDemandeLe: LE });
    const v = await verdictAvantEnvoi("ecartee@exemple.fr", {
      template: "gdpr-export-link",
      marketing: false,
    });
    expect(v).toEqual({ retenu: false });
  });

  it("un modèle commercial reste BLOQUÉ pour la même adresse écartée", async () => {
    oppositionFindFirst.mockResolvedValue({ effacementDemandeLe: LE });
    const v = await verdictAvantEnvoi("ecartee@exemple.fr", {
      template: "campagne-x",
      marketing: true,
    });
    expect(v).toEqual({ retenu: true, motif: "ecarte_effacement", depuis: LE });
  });

  it("`rgpd-effacement-confirme` (dormant) reste BLOQUÉ pour une adresse écartée", async () => {
    oppositionFindFirst.mockResolvedValue({ effacementDemandeLe: LE });
    const v = await verdictAvantEnvoi("ecartee@exemple.fr", {
      template: "rgpd-effacement-confirme",
      marketing: false,
    });
    expect(v).toEqual({ retenu: true, motif: "ecarte_effacement", depuis: LE });
  });

  it("l'ensemble des réponses à un droit est fermé : `gdpr-export-link` seul", () => {
    expect([...MODELES_REPONSE_A_UN_DROIT]).toEqual(["gdpr-export-link"]);
  });

  it("lu par empreinte, jamais par adresse", async () => {
    oppositionFindFirst.mockResolvedValue({ effacementDemandeLe: LE });
    await verdictAvantEnvoi("ecartee@exemple.fr", {
      template: "qualiopi-convocation",
      marketing: false,
    });
    const lu = oppositionFindFirst.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(lu.where).not.toHaveProperty("email");
    expect(String(lu.where["emailHash"])).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sans marque, un envoi transactionnel part (une simple opposition ne le retient pas)", async () => {
    oppositionFindUnique.mockResolvedValue({ id: "opp-1" });
    const v = await verdictAvantEnvoi("oppose@exemple.fr", {
      template: "qualiopi-convocation",
      marketing: false,
    });
    expect(v).toEqual({ retenu: false });
  });

  it("lecture en panne (colonne pas encore migrée) : repli ouvert, les autres contrôles tiennent", async () => {
    oppositionFindFirst.mockRejectedValue(new Error("column does not exist"));
    oppositionFindUnique.mockResolvedValue({ id: "opp-1" });
    const v = await verdictAvantEnvoi("oppose@exemple.fr", {
      template: "campagne-x",
      marketing: true,
    });
    expect(v).toEqual({ retenu: true, motif: "oppose", depuis: null });
  });
});

describe("module pur — seuls la base et l'empreinte", () => {
  it("n'importe que `@/lib/prisma` et `@/lib/security/email-hash`", () => {
    const source = readFileSync(join(__dirname, "verdict-envoi.ts"), "utf8");
    const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const specs = [
      ...sansCommentaires.matchAll(/\bfrom\s+["']([^"']+)["']/g),
      ...sansCommentaires.matchAll(/\bimport\s+["']([^"']+)["']/g),
      ...sansCommentaires.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
    ].map((m) => m[1]);
    expect([...new Set(specs)].sort()).toEqual(["@/lib/prisma", "@/lib/security/email-hash"]);
  });
});
