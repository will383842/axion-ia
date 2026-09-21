// Le dossier complet du tunnel apporteur ne part plus au CRM.
//
// ── La décision, et ce qu'elle corrige ────────────────────────────────────
// Ordre de Will du 04/09 : « rien ne part au CRM sans ma validation ». Le dossier
// complet appelait pourtant `syncCandidateToCrm`, et des fiches d'apporteurs y sont
// effectivement arrivées (mesure R8 du 19/09 ; le détail est tenu hors de ce dépôt,
// qui est PUBLIC). La décision
// B2 du 19/09 coupe cet envoi ; la case « vivier 2 ans », qui n'existait que
// pour le CRM, disparaît avec lui.
//
// C'est le premier harnais de `submitCommercialApplicationAction` : jusqu'ici
// aucun test ne la montait. Il simule en-têtes, cookies, compteurs et base, et
// laisse tourner le vrai schéma — un payload refusé par Zod rendrait tous les
// « n'est pas appelé » ci-dessous vrais pour une mauvaise raison. D'où le
// contre-témoin systématique : la candidature est BIEN écrite.
//
// ⚠️ Il vit hors de `src/features/commercial-application/` exprès : le contrôle
// de l'unité P2 exige qu'un `git grep syncCandidateToCrm` sur ce dossier soit
// vide, tests compris.

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  creer,
  compter,
  emettreCandidatVersCrm,
  emettreFormulaireVersCrm,
  consentement,
  notifier,
  enfiler,
  annulerRelances,
} = vi.hoisted(() => ({
  creer: vi.fn(async (_a: unknown) => ({
    id: "33333333-3333-4333-8333-333333333333",
    submittedAt: new Date("2026-09-19T10:00:00Z"),
  })),
  compter: vi.fn(async (_a: unknown) => 1),
  emettreCandidatVersCrm: vi.fn(async (_a: unknown) => undefined),
  emettreFormulaireVersCrm: vi.fn(async (_a: unknown) => undefined),
  consentement: vi.fn(async (_a: unknown) => true),
  notifier: vi.fn(async (_a: unknown) => ({ ok: true })),
  enfiler: vi.fn(async (..._a: unknown[]) => ({ enqueued: true })),
  annulerRelances: vi.fn(async (_a: unknown) => undefined),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: true, panne: false }),
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.19" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { create: (a: unknown) => creer(a), count: (a: unknown) => compter(a) },
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "vitest" }),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));
vi.mock("@/server/notifications", () => ({ notify: (a: unknown) => notifier(a) }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enfiler(...a),
}));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: (a: unknown) => annulerRelances(a),
}));
// Espion sur la porte de SORTIE vers le CRM. Si l'envoi revenait, sous l'une ou
// l'autre des deux fonctions d'émission, il passerait forcément par ici.
vi.mock("@/server/crm-sync", () => ({
  syncCandidateToCrm: (a: unknown) => emettreCandidatVersCrm(a),
  syncFormSubmissionToCrm: (a: unknown) => emettreFormulaireVersCrm(a),
}));
vi.mock("@/lib/consents", () => ({
  CONSENT_FORM_REFS: {
    commercialApplication: "commercial-tunnel",
    commercialApplicationVivier: "commercial-tunnel-vivier",
  },
  recordConsentEvent: (a: unknown) => consentement(a),
}));
vi.mock("@/lib/pii-crypto", () => ({ encryptPii: (v: string) => `chiffre(${v})` }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash-ip" }));
vi.mock("@/lib/admin-path", () => ({ adminPath: () => "/admin" }));

const { submitCommercialApplicationAction } =
  await import("@/features/commercial-application/actions");

/** Un dossier complet et valide, tel que le wizard l'envoie. */
function dossier(extra: Record<string, unknown> = {}) {
  return {
    prenom: "Camille",
    nom: "Durand",
    email: "camille.durand@example.com",
    telephone: "0612345678",
    ville: "Grenoble",
    codePostal: "38000",
    b2bDejaVendu: true,
    b2bAnnees: "5-10",
    experiences: [
      {
        entreprise: "Exemple SAS",
        ville: "Grenoble",
        poste: "Chargée d'affaires",
        debut: "2019-03",
        posteActuel: true,
      },
    ],
    iaUtilise: false,
    informatiqueUtilise: false,
    zoneMobile: true,
    deplacement: "oui",
    pitch: "Je connais bien le tissu des PME de l'Isère et je sais les écouter. ".repeat(3),
    disponibilite: "2026-10",
    permisVehicule: true,
    consent: true,
    ...extra,
  };
}

function envoi(payload: Record<string, unknown>): FormData {
  const fd = new FormData();
  fd.set("payload", JSON.stringify(payload));
  fd.set("locale", "fr");
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("le dossier complet apporteur ne part plus au CRM (B2, 19/09)", () => {
  it("la candidature est écrite — contre-témoin de tout ce qui suit", async () => {
    const r = await submitCommercialApplicationAction({ ok: false, error: "" }, envoi(dossier()));
    expect(r, "un payload refusé rendrait les tests suivants vrais pour rien").toEqual({
      ok: true,
      submissionId: "33333333-3333-4333-8333-333333333333",
    });
    expect(creer).toHaveBeenCalledTimes(1);
  });

  it("n'appelle AUCUNE fonction d'émission vers le CRM", async () => {
    await submitCommercialApplicationAction({ ok: false, error: "" }, envoi(dossier()));
    expect(creer).toHaveBeenCalledTimes(1);
    expect(emettreCandidatVersCrm, "l'envoi coupé le 19/09 est revenu").not.toHaveBeenCalled();
    expect(emettreFormulaireVersCrm).not.toHaveBeenCalled();
  });

  it("un ANCIEN onglet qui envoie encore l'accord vivier n'écrit pas details.vivierConsentAt", async () => {
    // Un navigateur resté ouvert avant le 19/09 sert l'ancien JS : il envoie la
    // clé. Le schéma la tolère (sinon la candidature serait refusée), mais elle
    // ne doit plus rien produire : ni horodatage en base, ni preuve vivier.
    await submitCommercialApplicationAction(
      { ok: false, error: "" },
      envoi(dossier({ consentVivier: true })),
    );
    expect(creer).toHaveBeenCalledTimes(1);
    const args = creer.mock.calls[0]?.[0] as { data: { details: Record<string, unknown> } };
    expect(Object.keys(args.data.details)).not.toContain("vivierConsentAt");
    expect(emettreCandidatVersCrm).not.toHaveBeenCalled();
  });

  it("consigne UN seul consentement, celui de l'étude de la candidature, en v3", async () => {
    await submitCommercialApplicationAction(
      { ok: false, error: "" },
      envoi(dossier({ consentVivier: true })),
    );
    const formulaires = consentement.mock.calls.map(
      (c) => (c[0] as { formRef: string; consentVersion: string }).formRef,
    );
    expect(formulaires, "la preuve « vivier » ne doit plus être consignée").toEqual([
      "commercial-tunnel",
    ]);
    const unique = consentement.mock.calls[0]?.[0] as { consentVersion: string };
    expect(unique.consentVersion).toBe("memo-v3-2026-09-19");

    const args = creer.mock.calls[0]?.[0] as { data: { details: Record<string, unknown> } };
    expect(args.data.details["consentVersion"]).toBe("memo-v3-2026-09-19");
  });
});
