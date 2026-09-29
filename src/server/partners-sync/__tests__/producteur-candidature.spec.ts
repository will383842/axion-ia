// @vitest-environment node
// @req REQ-INT-032
// @req REQ-CPL-015
// @req REQ-DM-035
// @req REQ-QA-035
/**
 * INT-T22 — `candidature.recue`, émis au clic console « prêt à signer » (ADR 0051 §c), jamais à
 * la réception du dossier. Sur un faux client de transaction en mémoire :
 *
 *   · le producteur : charge conforme au contrat publié, AUCUNE coordonnée, `event_id` dérivé de
 *     la clé des fixtures, sujet `submission:<id>` (celui que la route de coordonnées cherche),
 *     refus d'une non-apporteur et d'une fiche sans suite, inertie canal fermé ;
 *   · la transition `marquerPretASigner` : marque, journal et événement dans UNE transaction ;
 *     deux clics, un seul événement et une seule marque ; un refus n'écrit rien.
 *
 * Ce qu'un faux ne prouve pas — qu'un retour arrière Postgres efface la ligne — l'est contre un
 * vrai Postgres par `tests/integration/partners-sync/outbox-transactionnelle.spec.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { identifiantEvenement } from "@/server/partners/enveloppe";
import { fautes, resoudre } from "@/server/partners/__tests__/contrat-schema";
import type { PayloadCandidatureRecue } from "@/server/partners/payloads";

import type { Prisma } from "../../../../prisma/generated/client";
import {
  CANDIDATURE_RECUE,
  CandidatureNonTransmissible,
  emettreCandidatureRecue,
  motifDeRefusPretASigner,
} from "../producteurs/candidature";

// ── Le faux client, partagé avec le `@/lib/prisma` simulé de la transition ──────────────────
type Enregistrement = Record<string, unknown>;
type LigneOutbox = { eventId: string; eventType: string; subjectRef: string; corps: string };

const etat: {
  submissions: Enregistrement[];
  outbox: Map<string, LigneOutbox>;
  journal: Enregistrement[];
  transactions: number;
} = { submissions: [], outbox: new Map(), journal: [], transactions: 0 };

function fauxTx() {
  return {
    submission: {
      // Rend la LIGNE ENTIÈRE, colonnes chiffrées comprises, quel que soit le `select` : le pire
      // cas. Ce que la charge porte ne doit dépendre que de ce que le producteur en fait.
      findUnique: async ({ where }: { where: { id: string } }) => {
        const l = etat.submissions.find((s) => s["id"] === where.id);
        return l ? { ...l } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Enregistrement }) => {
        const l = etat.submissions.find((s) => s["id"] === where.id);
        if (!l) throw new Error("update d'une ligne absente");
        Object.assign(l, data);
        return { ...l };
      },
    },
    activityLog: {
      create: async ({ data }: { data: Enregistrement }) => {
        etat.journal.push(data);
        return data;
      },
    },
    partnersSyncOutbox: {
      createMany: async ({ data }: { data: LigneOutbox[]; skipDuplicates: boolean }) => {
        let count = 0;
        for (const l of data) {
          if (etat.outbox.has(l.eventId)) continue;
          etat.outbox.set(l.eventId, l);
          count += 1;
        }
        return { count };
      },
    },
  };
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    // Une transaction qui annule : l'état est restauré si le travail lève.
    $transaction: async (travail: (tx: unknown) => Promise<unknown>) => {
      etat.transactions += 1;
      const sauvegarde = {
        submissions: etat.submissions.map((s) => ({ ...s })),
        outbox: new Map(etat.outbox),
        journal: [...etat.journal],
      };
      try {
        return await travail(fauxTx());
      } catch (e) {
        Object.assign(etat, sauvegarde);
        throw e;
      }
    },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@/features/admin-inbox/cache-tags", () => ({ INBOX_COUNTS_TAG: "tag" }));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: vi.fn(),
}));

import { marquerPretASigner } from "@/features/admin-submissions/transitions";

const SCHEMA_CHARGE = resoudre("#/$defs/payload_candidature_recue");
const ID = "5a000000-0000-4000-8000-000000000022";
const SOUMIS_LE = new Date("2026-09-20T08:30:00.000Z");

/** Des coordonnées reconnaissables : aucune ne doit apparaître dans le corps émis. */
const COORDONNEES = {
  contactName: "Léa Témoin-Coordonnée",
  contactEmail: "lea.temoin@exemple.invalid",
  contactPhone: "+33 6 00 00 00 22",
};

function candidature(details: Enregistrement = {}): Enregistrement {
  return {
    id: ID,
    type: "contact",
    submittedAt: SOUMIS_LE,
    deletedAt: null,
    ...COORDONNEES,
    details: {
      unifiedType: "recrutement",
      subType: "candidature-commerciale",
      score: 72,
      scoreParts: { carnet: 25, b2bAnnees: 25, statut: 12, typesClients: 10 },
      source: "/devenir-commercial-ia/candidature",
      funnel: { utm: { utm_source: "linkedin" } },
      candidature: {
        version: 1,
        ville: "Grenoble",
        b2b: { dejaVendu: true, annees: 8 },
        statut: "auto_entrepreneur",
        pitch: "Joignable au 06 00 00 00 22, lea.temoin@exemple.invalid",
      },
      ...details,
    },
  };
}

const tx = () => fauxTx() as unknown as Prisma.TransactionClient;
const lignes = () => [...etat.outbox.values()];
const charge = (l: LigneOutbox) =>
  (JSON.parse(l.corps) as { payload: PayloadCandidatureRecue }).payload;

const ENV = { ...process.env };
beforeEach(() => {
  process.env.PARTNERS_SYNC_ENABLED = "true";
  process.env.DATABASE_URL = "postgresql://t22@localhost:5432/t22";
  etat.submissions = [];
  etat.outbox = new Map();
  etat.journal = [];
  etat.transactions = 0;
});
afterEach(() => {
  process.env = { ...ENV };
});

describe("REQ-INT-032 — le producteur de candidature.recue", () => {
  it("REQ-INT-032 : la charge d'une fiche prête à signer est conforme au contrat publié", async () => {
    etat.submissions.push(candidature({ pretASignerAt: "2026-09-29T10:00:00.000Z" }));
    const eventId = await emettreCandidatureRecue(tx(), ID);

    expect(eventId).not.toBeNull();
    const [ligne] = lignes();
    if (!ligne) throw new Error("aucune ligne dans la file");
    expect(fautes(SCHEMA_CHARGE, charge(ligne))).toEqual([]);
    expect(Object.keys(charge(ligne)).sort()).toEqual(
      [
        "candidatureId",
        "reponsesJson",
        "scoreInitial",
        "scorePartsJson",
        "scoreBaremeVersion",
        "sourceCanal",
        "utm",
        "campagneId",
        "parrainCodeCapture",
      ].sort(),
    );
    expect(charge(ligne)).toMatchObject({
      candidatureId: ID,
      scoreInitial: 72,
      sourceCanal: "/devenir-commercial-ia/candidature",
      utm: { utm_source: "linkedin" },
    });
  });

  it("REQ-DM-035 : AUCUNE coordonnée ni prose libre dans le corps émis", async () => {
    etat.submissions.push(candidature({ pretASignerAt: "2026-09-29T10:00:00.000Z" }));
    await emettreCandidatureRecue(tx(), ID);

    const corps = lignes()[0]?.corps ?? "";
    expect(corps).not.toBe("");
    for (const valeur of [...Object.values(COORDONNEES), "Grenoble", "06 00 00 00 22"]) {
      expect(corps).not.toContain(valeur);
    }
    expect(corps).not.toMatch(/contact(Name|Email|Phone)|pitch|ville/);
  });

  it("REQ-INT-032 : event_id = identifiantEvenement(type, candidature.recue:<id>), sujet submission:<id>", async () => {
    etat.submissions.push(candidature({ pretASignerAt: "2026-09-29T10:00:00.000Z" }));
    const eventId = await emettreCandidatureRecue(tx(), ID);

    expect(eventId).toBe(identifiantEvenement(CANDIDATURE_RECUE, `candidature.recue:${ID}`));
    const [ligne] = lignes();
    expect(ligne).toMatchObject({
      eventId,
      eventType: "candidature.recue",
      // La clé EXACTE que `coordonnees.ts` cherche pour ouvrir la lecture des coordonnées.
      subjectRef: `submission:${ID}`,
    });
    const env = JSON.parse(ligne?.corps ?? "{}") as Record<string, unknown>;
    expect(env["subject_ref"]).toEqual({ submission_id: ID });
    expect(env["occurred_at"]).toBe(SOUMIS_LE.toISOString());
  });

  it("REQ-INT-032 : deux émissions du même fait → un seul event_id, une seule ligne", async () => {
    etat.submissions.push(candidature({ pretASignerAt: "2026-09-29T10:00:00.000Z" }));
    const a = await emettreCandidatureRecue(tx(), ID);
    const b = await emettreCandidatureRecue(tx(), ID);
    expect(b).toBe(a);
    expect(lignes()).toHaveLength(1);
  });

  it("REQ-DM-035 : une fiche NON marquée prête à signer n'émet rien (jamais à la réception)", async () => {
    etat.submissions.push(candidature());
    expect(await emettreCandidatureRecue(tx(), ID)).toBeNull();
    expect(lignes()).toHaveLength(0);
  });

  it("REQ-QA-035 : une Submission qui n'est pas un apporteur est refusée, même marquée", async () => {
    etat.submissions.push(
      candidature({ unifiedType: "recrutement", subType: "contact", pretASignerAt: "x" }),
    );
    await expect(emettreCandidatureRecue(tx(), ID)).rejects.toBeInstanceOf(
      CandidatureNonTransmissible,
    );
    expect(lignes()).toHaveLength(0);
  });

  it("REQ-QA-035 : une fiche sans suite est refusée, même marquée", async () => {
    etat.submissions.push(
      candidature({ sansSuiteAt: "2026-09-28T09:00:00.000Z", pretASignerAt: "x" }),
    );
    await expect(emettreCandidatureRecue(tx(), ID)).rejects.toMatchObject({
      motif: "sans_suite",
    });
    expect(lignes()).toHaveLength(0);
  });

  it("REQ-QA-035 : la règle de refus, dans son ordre — corbeille, non-apporteur, sans suite", () => {
    const apporteur = { unifiedType: "recrutement", subType: "candidature-commerciale" };
    expect(motifDeRefusPretASigner({ details: apporteur, deletedAt: null })).toBeNull();
    expect(motifDeRefusPretASigner({ details: apporteur, deletedAt: new Date() })).toBe("effacee");
    expect(
      motifDeRefusPretASigner({ details: { unifiedType: "recrutement" }, deletedAt: null }),
    ).toBe("non_apporteur");
    expect(motifDeRefusPretASigner({ details: null, deletedAt: null })).toBe("non_apporteur");
    expect(
      motifDeRefusPretASigner({ details: { ...apporteur, sansSuiteAt: "x" }, deletedAt: null }),
    ).toBe("sans_suite");
  });

  it("REQ-INT-032 : canal fermé, rien n'est lu ni écrit", async () => {
    process.env.PARTNERS_SYNC_ENABLED = "false";
    const lecture = vi.fn();
    const ferme = { submission: { findUnique: lecture } } as unknown as Prisma.TransactionClient;
    expect(await emettreCandidatureRecue(ferme, ID)).toBeNull();
    expect(lecture).not.toHaveBeenCalled();
  });
});

describe("REQ-INT-032 — la transition console « prêt à signer »", () => {
  it("REQ-INT-032 : marque, journal et événement, dans UNE transaction", async () => {
    etat.submissions.push(candidature());
    const res = await marquerPretASigner(ID, "admin-1");

    expect(res).toEqual({ ok: true, dejaMarquee: false });
    expect(etat.transactions).toBe(1);
    const details = etat.submissions[0]?.["details"] as Enregistrement;
    expect(typeof details["pretASignerAt"]).toBe("string");
    // Rien d'autre du dossier n'est perdu en posant la marque.
    expect(details["score"]).toBe(72);
    expect(etat.journal).toEqual([
      {
        adminUserId: "admin-1",
        action: "submission.pret_a_signer",
        targetType: "submission",
        targetId: ID,
        changes: { transition: "pret-a-signer" },
      },
    ]);
    expect(lignes().map((l) => l.eventType)).toEqual(["candidature.recue"]);
  });

  it("REQ-INT-032 : un second clic ne réémet pas, ne réécrit pas la marque, ne journalise pas", async () => {
    etat.submissions.push(candidature());
    await marquerPretASigner(ID, "admin-1");
    const premiere = (etat.submissions[0]?.["details"] as Enregistrement)["pretASignerAt"];

    const res = await marquerPretASigner(ID, "admin-2");
    expect(res).toEqual({ ok: true, dejaMarquee: true });
    expect((etat.submissions[0]?.["details"] as Enregistrement)["pretASignerAt"]).toBe(premiere);
    expect(lignes()).toHaveLength(1);
    expect(etat.journal).toHaveLength(1);
  });

  it("REQ-QA-035 : une non-apporteur est refusée PAR LE SERVEUR, rien n'est écrit", async () => {
    etat.submissions.push(candidature({ subType: "contact" }));
    const res = await marquerPretASigner(ID, "admin-1");
    expect(res).toEqual({ ok: false, erreur: "non_apporteur" });
    expect((etat.submissions[0]?.["details"] as Enregistrement)["pretASignerAt"]).toBeUndefined();
    expect(etat.journal).toHaveLength(0);
    expect(lignes()).toHaveLength(0);
  });

  it("REQ-QA-035 : une fiche sans suite est refusée, rien n'est écrit", async () => {
    etat.submissions.push(candidature({ sansSuiteAt: "2026-09-28T09:00:00.000Z" }));
    const res = await marquerPretASigner(ID, "admin-1");
    expect(res).toEqual({ ok: false, erreur: "sans_suite" });
    expect((etat.submissions[0]?.["details"] as Enregistrement)["pretASignerAt"]).toBeUndefined();
    expect(lignes()).toHaveLength(0);
  });

  it("REQ-CPL-015 : un dossier illisible (score absent) annule TOUT, marque comprise", async () => {
    etat.submissions.push(candidature({ score: undefined }));
    const res = await marquerPretASigner(ID, "admin-1");
    expect(res).toEqual({ ok: false, erreur: "charge_illisible" });
    expect((etat.submissions[0]?.["details"] as Enregistrement)["pretASignerAt"]).toBeUndefined();
    expect(etat.journal).toHaveLength(0);
    expect(lignes()).toHaveLength(0);
  });

  it("REQ-INT-032 : canal fermé, la marque est posée et journalisée, aucun événement", async () => {
    process.env.PARTNERS_SYNC_ENABLED = "false";
    etat.submissions.push(candidature());
    const res = await marquerPretASigner(ID, "admin-1");
    expect(res.ok).toBe(true);
    expect(typeof (etat.submissions[0]?.["details"] as Enregistrement)["pretASignerAt"]).toBe(
      "string",
    );
    expect(lignes()).toHaveLength(0);
  });

  it("REQ-QA-035 : une fiche introuvable est refusée", async () => {
    expect(await marquerPretASigner(ID, "admin-1")).toEqual({ ok: false, erreur: "introuvable" });
  });
});
