/**
 * L7c — le parcours du code de signature, DE BOUT EN BOUT, sur les vrais modules :
 *   demande (page publique) → envoi S6b → e-mail F17 mis en file → rendu par le worker
 *   (le code est bien DANS l'e-mail) → saisie → vérification → signature.
 *
 * Seuls sont doublés : la base (table des codes en mémoire, avec la sémantique des
 * écritures conditionnelles), la file, le jeton du lien et l'écriture de la preuve.
 * Les relectures précédentes l'ont montré : un test qui double l'envoi laisse passer
 * un code jamais envoyé.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface LigneCode {
  id: string;
  documentGenereId: string;
  partie: string;
  codeHash: string;
  expiresAt: Date;
  essais: number;
  utiliseAt: Date | null;
  invalideAt: Date | null;
  createdAt: Date;
}

const h = vi.hoisted(() => ({
  codes: [] as LigneCode[],
  file: [] as Array<{ template: string; to: string; payload: Record<string, unknown> }>,
  interrupteurAllume: true,
  textesValides: new Set<string>(["formateur-code-signature"]),
  signatures: [] as unknown[],
}));

type Filtre = Record<string, unknown>;
function correspond(l: LigneCode, w: Filtre): boolean {
  return Object.entries(w).every(([k, v]) => {
    const val = (l as unknown as Record<string, unknown>)[k];
    if (v !== null && typeof v === "object" && !(v instanceof Date)) {
      const o = v as { lt?: number; gte?: number; gt?: Date; in?: unknown[] };
      if (o.in !== undefined) return o.in.includes(val);
      if (o.lt !== undefined) return (val as number) < o.lt;
      if (o.gte !== undefined) return (val as number) >= o.gte;
      if (o.gt !== undefined) return (val as Date).getTime() > o.gt.getTime();
    }
    return val === v;
  });
}
const parDate = (a: LigneCode, b: LigneCode) => b.createdAt.getTime() - a.createdAt.getTime();

const { DOC, TRAINER } = vi.hoisted(() => ({
  DOC: "11111111-1111-4111-8111-111111111111",
  TRAINER: "22222222-2222-4222-8222-222222222222",
}));

vi.mock("@/lib/prisma", () => {
  let horloge = 0;
  const documentSignatureCode = {
    create: async ({
      data,
    }: {
      data: Omit<LigneCode, "essais" | "utiliseAt" | "invalideAt" | "createdAt">;
    }) => {
      const l: LigneCode = {
        ...data,
        essais: 0,
        utiliseAt: null,
        invalideAt: null,
        createdAt: new Date(Date.now() + horloge++),
      };
      h.codes.push(l);
      return l;
    },
    updateMany: async ({ where, data }: { where: Filtre; data: Record<string, unknown> }) => {
      let count = 0;
      for (const l of h.codes) {
        if (!correspond(l, where)) continue;
        count++;
        const r = l as unknown as Record<string, unknown>;
        for (const [k, v] of Object.entries(data)) {
          r[k] =
            typeof v === "object" && v !== null && "increment" in v
              ? (r[k] as number) + (v as { increment: number }).increment
              : v;
        }
      }
      return { count };
    },
    findFirst: async ({ where }: { where: Filtre }) =>
      [...h.codes].sort(parDate).find((l) => correspond(l, where)) ?? null,
    findMany: async ({ where }: { where: Filtre }) =>
      [...h.codes].sort(parDate).filter((l) => correspond(l, where)),
    count: async ({ where }: { where: Filtre }) =>
      h.codes.filter((l) => correspond(l, where)).length,
  };
  const piece = {
    type: "contrat_sous_traitance",
    numero: "AXI-DOC-2026-990",
    metadata: { renderData: { gabaritVersion: 3 } },
    sousTraitantId: null,
    trainerId: TRAINER,
    trainer: { email: "alex@exemple.invalid", prenom: "Alex" },
  };
  return {
    prisma: {
      documentGenere: {
        findUnique: async () => piece,
        findMany: async () => [{ id: DOC }],
      },
      trainer: {
        findUnique: async () => ({
          statut: "sous_traitant",
          prenom: "Alex",
          email: "alex@exemple.invalid",
          finCollaborationAt: null,
        }),
      },
      documentSignatureCode,
      documentSignature: { count: async () => 0, findMany: async () => [] },
      $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    },
  };
});
vi.mock("@/server/queue/queues", () => ({
  emailsQueue: null,
  enqueueEmail: async (
    template: string,
    to: string,
    _locale: string,
    payload: Record<string, unknown>,
    options?: { bypassValidation?: boolean },
  ) => {
    // Sans `bypassValidation`, le code serait garé en corbeille et expirerait.
    if (options?.bypassValidation !== true) return { enqueued: false, garePourValidation: true };
    h.file.push({ template, to, payload });
    return { enqueued: true };
  },
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-etat", () => ({
  lireEtatsInterrupteurs: async () => ({}),
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/formateurs-independants/interrupteurs")>()),
  lireDrapeauEnvoi: () => h.interrupteurAllume,
}));
vi.mock("@/server/email/textes-valides-lecture", () => ({ lireTextesValides: async () => ({}) }));
vi.mock("@/server/email/textes-valides", async (orig) => ({
  ...(await orig<typeof import("@/server/email/textes-valides")>()),
  estTexteValide: (_r: unknown, g: string) => h.textesValides.has(g),
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  verifierTokenDocument: async () => ({
    ok: true,
    tokenId: "tok-1",
    documentGenereId: DOC,
    partie: "sous_traitant",
    signataireNom: "Alex Durand",
    signataireEmail: "alex@exemple.invalid",
    signataireQualite: null,
  }),
}));
vi.mock("@/server/qualiopi/documents/signature/document-signature-service", () => ({
  // La preuve et l'instantané figé. Le double accepte TOUT appel : c'est le code, et lui
  // seul, qui doit empêcher une seconde signature.
  signerDocument: async (input: unknown) => {
    h.signatures.push(input);
    return { ok: true, signatureId: "sig-1", selfHash: "a", statutSignature: "partielle" };
  },
}));
vi.mock("@/server/qualiopi/documents/signature/apres-signature", () => ({
  apresSignature: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/contrat-cadre-signature", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/documents/signature/contrat-cadre-signature")>()),
  objectionContratCadre: async () => null,
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (_: string): string | null => null }),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("../_guards", () => ({ requireAdminWrite: vi.fn(), logQualiopiActivity: vi.fn() }));

import { renderEmailTemplate } from "@/lib/email/templates";
import { payloadPourRendu } from "@/server/email/code-en-file";
import { demanderCodeSignatureAction, signerPieceParJetonAction } from "../piece-signature";

beforeEach(() => {
  h.codes.length = 0;
  h.file.length = 0;
  h.signatures.length = 0;
  h.interrupteurAllume = true;
  h.textesValides = new Set(["formateur-code-signature"]);
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  process.env["PII_ENCRYPTION_KEY"] = "c3".repeat(32);
});

/** Ce que le formateur lit dans l'e-mail F17, rendu comme le fait le worker. */
async function codeLuDansLEmail(): Promise<string> {
  expect(h.file).toHaveLength(1);
  const job = h.file[0]!;
  expect(job.template).toBe("formateur-code-signature");
  expect(job.to).toBe("alex@exemple.invalid");
  const rendu = await renderEmailTemplate(
    job.template as never,
    "fr",
    payloadPourRendu(job.template, job.payload),
    { destinataire: job.to },
  );
  const m = /Votre code de signature : (\d{6})\./.exec(rendu.text);
  expect(m).not.toBeNull();
  expect(rendu.subject).toContain(m![1]!);
  return m![1]!;
}

const signer = (code: string) =>
  signerPieceParJetonAction({ token: "jeton", methode: "confirmation_accessible", code });

describe("contrat-cadre v3 : demande → e-mail F17 → saisie → signature", () => {
  it("🔴 le bon code, lu dans l'e-mail, signe — une seule fois, avec le consentement « code »", async () => {
    const d = await demanderCodeSignatureAction({ token: "jeton" });
    expect(d).toEqual({ ok: true, destinataireMasque: "a***@e***.invalid" });
    // Le code n'est ni rendu à l'appelant, ni en clair dans la file.
    const code = await codeLuDansLEmail();
    expect(JSON.stringify(d)).not.toContain(code);
    expect(JSON.stringify(h.file)).not.toContain(code);

    const r = await signer(code);
    expect(r).toMatchObject({ ok: true, signatureId: "sig-1" });
    expect(h.signatures).toHaveLength(1);
    expect(h.signatures[0]).toMatchObject({
      documentGenereId: DOC,
      porteur: { type: "signataire_jeton", tokenId: "tok-1", partie: "sous_traitant" },
      consentementVersion: "doc-consent-code-v1",
    });
  });

  it("🔴 mauvais code : rien n'est signé", async () => {
    await demanderCodeSignatureAction({ token: "jeton" });
    const code = await codeLuDansLEmail();
    const faux = code === "000000" ? "000001" : "000000";
    expect(await signer(faux)).toMatchObject({ ok: false, raison: "code_refuse" });
    expect(h.signatures).toHaveLength(0);
  });

  it("🔴 code expiré : rien n'est signé", async () => {
    await demanderCodeSignatureAction({ token: "jeton" });
    const code = await codeLuDansLEmail();
    for (const l of h.codes) l.expiresAt = new Date(Date.now() - 1000);
    expect(await signer(code)).toMatchObject({ ok: false, raison: "code_refuse" });
    expect(h.signatures).toHaveLength(0);
  });

  it("🔴 double clic : une seule signature", async () => {
    await demanderCodeSignatureAction({ token: "jeton" });
    const code = await codeLuDansLEmail();
    const [a, b] = await Promise.all([signer(code), signer(code)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect([a, b].find((r) => !r.ok)).toMatchObject({ raison: "code_refuse" });
    expect(h.signatures).toHaveLength(1);
    expect(h.codes.filter((l) => l.utiliseAt !== null)).toHaveLength(1);
  });

  it("🔴 rejeu après une signature réussie : refusé", async () => {
    await demanderCodeSignatureAction({ token: "jeton" });
    const code = await codeLuDansLEmail();
    expect((await signer(code)).ok).toBe(true);
    expect(await signer(code)).toMatchObject({ ok: false, raison: "code_refuse" });
    expect(h.signatures).toHaveLength(1);
  });

  it("🔑 éteint : texte F17 non validé → aucun code émis, aucun e-mail", async () => {
    h.textesValides = new Set();
    const d = await demanderCodeSignatureAction({ token: "jeton" });
    expect(d).toMatchObject({ ok: false, raison: "code_indisponible" });
    expect(h.codes).toHaveLength(0);
    expect(h.file).toHaveLength(0);
  });

  it("🔑 éteint : interrupteur des textes absent → aucun code émis, aucun e-mail", async () => {
    h.interrupteurAllume = false;
    const d = await demanderCodeSignatureAction({ token: "jeton" });
    expect(d).toMatchObject({ ok: false, raison: "code_indisponible" });
    expect(h.codes).toHaveLength(0);
    expect(h.file).toHaveLength(0);
  });
});
