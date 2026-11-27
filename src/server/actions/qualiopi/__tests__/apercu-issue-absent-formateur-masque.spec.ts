/**
 * Fiche I2-4-S1 (B2, B3) — l'issue « absent » d'un échange formateur porte deux liens
 * personnels : le lien de nouveau créneau (`?depuis=fa-…&j=…`) et le lien d'opposition
 * (`/api/unsubscribe?token=…`). L'aperçu envoyé au navigateur n'en montre aucun ; l'envoi
 * réel met en file la charge avec le vrai lien `j=` en clair.
 *
 * Ici ni le rendu (`renderEmailTemplate`) ni le masque (`masquerSecretsEmail`) ne sont
 * simulés : seuls l'authentification, la base, la préparation et l'enfilage le sont.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  auth: vi.fn(),
  enqueue: vi.fn(),
  preparerIssue: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: () => d.auth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminUser: { findUnique: vi.fn(async () => ({ name: "Admin" })) },
    emailLog: { findFirst: vi.fn(async () => null) },
    rendezVousSuivi: { upsert: vi.fn(async () => ({})) },
    activityLog: { create: vi.fn(async () => ({})) },
    jobApplication: { update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({})) },
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => d.enqueue(...a),
  emailsQueue: null,
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: async () => true,
}));
vi.mock("@/server/qualiopi/formateurs-independants/etats-entree", () => ({
  lireEtatsEntree: async () => ({ suivi_echange: true }),
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs", () => ({
  lireDrapeauEnvoi: () => true,
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-etat", () => ({
  lireEtatsInterrupteurs: async () => ({}),
}));
vi.mock("@/server/email/textes-valides-lecture", () => ({ lireTextesValides: async () => ({}) }));
vi.mock("@/server/email/textes-valides", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/email/textes-valides")>()),
  estTexteValide: () => true,
}));
vi.mock("@/features/admin-rendezvous/issue-formateur-envoi", () => ({
  preparerIssueFormateur: (...a: unknown[]) => d.preparerIssue(...a),
}));
vi.mock("@/features/admin-job-applications/fiche-formateur-actions", () => ({
  creerFicheFormateurDepuisCandidatureAction: vi.fn(),
}));
vi.mock("@/server/qualiopi/formateurs-independants/ouverture-dossier", () => ({
  ouvrirDossierRetenu: vi.fn(),
}));

import { apercuBrutServeurSeulement } from "@/server/qualiopi/formateurs-independants/envois";
import {
  apercuIssueFormateurAction,
  enregistrerIssueFormateurAction,
} from "@/features/admin-rendezvous/issue-formateur-actions";

const ADRESSE = "camille@example.com";
// Construits à l'exécution : aucun littéral qui ressemble à un secret dans le dépôt.
const UUID_FA = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const UUID_J = "7a1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4c";
const SIGNATURE = "A".repeat(43);
const JETON_J = `${UUID_J}.1790000000.${SIGNATURE}`;
const LIEN = `https://axion-ia.com/fr/appel/formateur-independant?depuis=fa-${UUID_FA}&j=${JETON_J}`;

beforeEach(() => {
  vi.clearAllMocks();
  d.auth.mockResolvedValue({ user: { id: "u1", role: "admin", email: "a@b.c" } });
  d.enqueue.mockResolvedValue({ enqueued: true });
  d.preparerIssue.mockResolvedValue({
    ok: true,
    calendlyEventId: "evt",
    candidatureId: "cand",
    lignes: ["cand"],
    absencesAnterieures: 0,
    envoi: {
      gabarit: "formateur-issue-absent",
      destinataire: ADRESSE,
      payload: { prenom: "Camille", lien: LIEN },
      jobId: "j",
    },
    sansEmail: null,
  });
});

function formulaire(): FormData {
  const f = new FormData();
  f.set("calendlyEventId", "evt");
  f.set("issue", "absent");
  f.set("confirmer", "oui");
  return f;
}

describe("issue « absent » d'un échange formateur", () => {
  it("témoin : le rendu BRUT porte bien les deux liens personnels", async () => {
    const brut = await apercuBrutServeurSeulement({
      gabarit: "formateur-issue-absent",
      destinataire: ADRESSE,
      payload: { prenom: "Camille", lien: LIEN },
    });
    expect(brut.html).toContain(`&amp;j=${JETON_J}`);
    expect(brut.html).toMatch(/api\/unsubscribe\?token=op\d?\.[A-Za-z0-9_-]{8}/);
  });

  it("B2 : l'aperçu ne montre ni le lien de nouveau créneau ni le lien d'opposition", async () => {
    const r = await apercuIssueFormateurAction({ calendlyEventId: "evt", issue: "absent" });
    expect(r.etat).toBe("apercu");
    if (r.etat !== "apercu" || !r.email) throw new Error("aperçu attendu");
    const tout = JSON.stringify(r.email);
    expect(tout).not.toContain(JETON_J);
    expect(tout).not.toContain(UUID_J);
    expect(tout).not.toContain(SIGNATURE);
    expect(tout).not.toMatch(/api\/unsubscribe\?token=op\d?\.[A-Za-z0-9_-]{8}/);
    expect(r.email.html).not.toMatch(/\shref\s*=/i);
  });

  it("B3 : l'aperçu masque, l'enregistrement met en file le vrai lien `j=` en clair", async () => {
    const r = await apercuIssueFormateurAction({ calendlyEventId: "evt", issue: "absent" });
    if (r.etat !== "apercu" || !r.email) throw new Error("aperçu attendu");
    // Témoin : le lien est bien dans la charge préparée, donc le masque avait quelque chose à cacher.
    expect(d.preparerIssue).toHaveBeenCalled();
    expect(JSON.stringify(r.email)).not.toContain(`j=${JETON_J}`);

    await enregistrerIssueFormateurAction({ etat: "initial" }, formulaire());
    expect(d.enqueue).toHaveBeenCalledTimes(1);
    const [gabarit, destinataire, , payload] = d.enqueue.mock.calls[0]! as [
      string,
      string,
      string,
      { lien?: string },
    ];
    expect(gabarit).toBe("formateur-issue-absent");
    expect(destinataire).toBe(ADRESSE);
    expect(payload.lien).toContain(`j=${JETON_J}`);
  });
});
