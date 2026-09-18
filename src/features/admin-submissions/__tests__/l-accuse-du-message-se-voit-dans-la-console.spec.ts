import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * **L'ACCUSÉ DE RÉCEPTION AUTOMATIQUE D'UN MESSAGE SE VOIT DANS LA CONSOLE.**
 *
 * ═══ LE DÉFAUT, RELEVÉ PAR WILL EN PRODUCTION LE 2026-09-18 ═══
 *
 * L'écran « Messages » affichait « SANS RÉPONSE » sur les 18 lignes, et rien
 * d'autre. Mesuré le même jour sur toute la boîte (211 éléments) : 196 accusés
 * automatiques partis, 6 absents, 5 absences voulues, 4 invérifiables (antérieurs
 * au journal) — aucun ne se lisait dans la console.
 *
 * ═══ CE QUE CE FICHIER VERROUILLE ═══
 *
 *  1. chaque message reçoit SON accusé : lien exact d'abord, sinon adresse et
 *     heure — jamais l'accusé d'une autre personne envoyé la même minute ;
 *  2. l'adresse est comparée DÉCHIFFRÉE et sans casse (l'empreinte stockée est
 *     vide sur 7 dossiers apporteur sur 10 : on ne s'y fie pas) ;
 *  3. l'absence VOULUE (capture à l'écran 1 du dossier) se dit comme telle ;
 *  4. UNE requête par page de liste, jamais une par ligne ;
 *  5. les formulaires lient désormais l'accusé à leur message dès l'envoi.
 */

const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: { findMany: (...a: unknown[]) => findManyMock(...a) },
  },
}));

import {
  lireAccusesMessages,
  type AccuseMessage,
  type MessagePourAccuse,
} from "../accuse-reception";
import type { LigneAvecDestinataire } from "@/server/email/accuse-noyau";
import { PII_DECRYPT_PLACEHOLDER } from "@/lib/pii-crypto";
import { GABARITS_ACCUSE_MESSAGE } from "@/lib/contact/accuse-attendu";

const DEPOT = new Date("2026-09-16T06:16:00Z");

function message(p: Partial<MessagePourAccuse> & { id: string }): MessagePourAccuse {
  return { contactEmail: "alice@exemple.fr", submittedAt: DEPOT, origine: null, ...p };
}

/**
 * Passe par la VRAIE `lireAccusesMessages` — celle de la page — avec un journal
 * simulé. Aucune recomposition dans le test : une copie de la composition
 * resterait verte si la page cessait de transmettre l'origine du dépôt.
 */
async function attribuerAccuses(
  messages: ReadonlyArray<MessagePourAccuse>,
  lignes: ReadonlyArray<LigneAvecDestinataire>,
): Promise<Map<string, AccuseMessage>> {
  findManyMock.mockReset();
  findManyMock.mockResolvedValue(lignes);
  return lireAccusesMessages(messages);
}

function ligne(p: Partial<LigneAvecDestinataire> & { id: string }): LigneAvecDestinataire {
  return {
    template: "candidature-commercial-confirmee",
    recipient: "alice@exemple.fr",
    status: "sent",
    entityType: null,
    entityId: null,
    attempts: 1,
    error: null,
    sentAt: new Date(DEPOT.getTime() + 4_000),
    failedAt: null,
    bouncedAt: null,
    bounceReason: null,
    bounceType: null,
    createdAt: new Date(DEPOT.getTime() + 2_000),
    ...p,
  };
}

describe("lireAccusesMessages — chaque message reçoit SON accusé", () => {
  it("le lien exact prime, même si un autre envoi est plus proche de l'heure", async () => {
    const r = await attribuerAccuses(
      [message({ id: "m1" })],
      [
        ligne({ id: "proche", createdAt: new Date(DEPOT.getTime() + 1_000) }),
        ligne({
          id: "exact",
          entityType: "Submission",
          entityId: "m1",
          createdAt: new Date(DEPOT.getTime() + 30_000),
          sentAt: new Date(DEPOT.getTime() + 31_000),
        }),
      ],
    );
    expect(r.get("m1")).toMatchObject({ etat: "envoye", rattachement: "exact" });
  });

  it("sans lien, rattache par adresse et heure — la casse de l'adresse n'y fait rien", async () => {
    const r = await attribuerAccuses(
      [message({ id: "m1", contactEmail: "Alice@Exemple.FR " })],
      [ligne({ id: "a" })],
    );
    expect(r.get("m1")).toMatchObject({ etat: "envoye", rattachement: "adresse_et_date" });
  });

  it("n'attribue JAMAIS l'accusé d'une autre personne envoyé la même minute", async () => {
    const r = await attribuerAccuses(
      [message({ id: "m1" })],
      [ligne({ id: "autre", recipient: "bob@exemple.fr" })],
    );
    expect(r.get("m1")).toMatchObject({ etat: "absent", absenceVoulue: null });
  });

  it("même personne, deux messages à deux minutes : chacun garde le sien", async () => {
    const deux = new Date(DEPOT.getTime() + 120_000);
    const r = await attribuerAccuses(
      [message({ id: "m1" }), message({ id: "m2", submittedAt: deux })],
      [
        ligne({ id: "l1", entityType: "Submission", entityId: "m1" }),
        ligne({
          id: "l2",
          entityType: "Submission",
          entityId: "m2",
          status: "failed",
          error: "Invalid login: 535 Authentication Failed\nstack…",
          failedAt: deux,
          createdAt: deux,
        }),
      ],
    );
    expect(r.get("m1")).toMatchObject({ etat: "envoye" });
    expect(r.get("m2")).toMatchObject({
      etat: "echec",
      motif: "Invalid login: 535 Authentication Failed",
    });
  });

  it("lit la NATURE du rebond : un rebond temporaire n'est pas un rebond définitif", async () => {
    const r = await attribuerAccuses(
      [message({ id: "m1" }), message({ id: "m2", contactEmail: "bob@exemple.fr" })],
      [
        ligne({ id: "s", status: "bounced", bounceType: "soft", bounceReason: "Mailbox full" }),
        ligne({ id: "h", recipient: "bob@exemple.fr", status: "bounced", bounceType: "hard" }),
      ],
    );
    expect(r.get("m1")).toMatchObject({ etat: "rebond", rebond: "soft", motif: "Mailbox full" });
    expect(r.get("m2")).toMatchObject({ etat: "rebond", rebond: "hard" });
  });

  it("un envoi hors de la fenêtre (le lendemain) n'est pas l'accusé de ce message", async () => {
    const r = await attribuerAccuses(
      [message({ id: "m1" })],
      [ligne({ id: "tard", createdAt: new Date(DEPOT.getTime() + 24 * 3_600_000) })],
    );
    expect(r.get("m1")?.etat).toBe("absent");
  });

  it("l'absence VOULUE se dit comme telle ; l'absence ordinaire, jamais", async () => {
    const r = await attribuerAccuses(
      [
        message({ id: "capture", origine: "ecran-1-du-dossier" }),
        message({ id: "ordinaire", contactEmail: "carole@exemple.fr" }),
      ],
      [],
    );
    expect(r.get("capture")?.absenceVoulue).toMatch(/voulu/);
    expect(r.get("ordinaire")).toMatchObject({ etat: "absent", absenceVoulue: null });
  });

  it("un accusé PARTI n'est jamais présenté comme une absence voulue", async () => {
    const r = await attribuerAccuses(
      [message({ id: "m1", origine: "ecran-1-du-dossier" })],
      [ligne({ id: "a" })],
    );
    expect(r.get("m1")).toMatchObject({ etat: "envoye", absenceVoulue: null });
  });
});

describe("lireAccusesMessages — une requête par page, jamais une par ligne", () => {
  beforeEach(() => findManyMock.mockReset());

  it("25 messages → UN seul appel, qui porte les liens exacts ET les adresses", async () => {
    findManyMock.mockResolvedValue([]);
    const messages = Array.from({ length: 25 }, (_, i) =>
      message({ id: `m${i}`, contactEmail: `p${i}@exemple.fr` }),
    );
    const r = await lireAccusesMessages(messages);

    expect(findManyMock).toHaveBeenCalledTimes(1);
    const where = (findManyMock.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    expect(where.template).toEqual({ in: [...GABARITS_ACCUSE_MESSAGE] });
    const ou = where.OR as Array<Record<string, unknown>>;
    expect(ou[0]).toMatchObject({ entityType: "Submission" });
    expect((ou[0]?.entityId as { in: string[] }).in).toHaveLength(25);
    expect((ou[1]?.recipient as { in: string[] }).in).toHaveLength(25);
    expect(r.size).toBe(25);
  });

  it("une page vide ne lit rien", async () => {
    const r = await lireAccusesMessages([]);
    expect(findManyMock).not.toHaveBeenCalled();
    expect(r.size).toBe(0);
  });

  it("clé de déchiffrement absente : le libellé de remplacement n'est jamais cherché comme adresse", async () => {
    findManyMock.mockResolvedValue([]);
    await lireAccusesMessages([message({ id: "m1", contactEmail: PII_DECRYPT_PLACEHOLDER })]);
    const where = (findManyMock.mock.calls[0]?.[0] as { where: { OR: unknown[] } }).where;
    expect(where.OR).toHaveLength(1);
  });

  it("le plafond garde les envois les PLUS RÉCENTS", async () => {
    findManyMock.mockResolvedValue([]);
    await lireAccusesMessages([message({ id: "m1" })]);
    const arg = findManyMock.mock.calls[0]?.[0] as { orderBy: unknown };
    expect(arg.orderBy).toEqual({ createdAt: "desc" });
  });

  it("une adresse illisible (déchiffrement raté) ne cherche que le lien exact", async () => {
    findManyMock.mockResolvedValue([]);
    await lireAccusesMessages([message({ id: "m1", contactEmail: "" })]);
    const where = (findManyMock.mock.calls[0]?.[0] as { where: { OR: unknown[] } }).where;
    expect(where.OR).toHaveLength(1);
  });
});

describe("une seule table des accusés, lue par les formulaires ET par la console", () => {
  const lire = (p: string): string => readFileSync(p, "utf8");

  it("chaque gabarit cherché par la console est un gabarit qui existe", () => {
    const types = lire("src/server/queue/types.ts");
    for (const g of GABARITS_ACCUSE_MESSAGE) expect(types).toContain(`"${g}"`);
  });

  it("chaque gabarit que le formulaire /contact peut envoyer est cherché par la console", () => {
    const source = lire("src/features/unified-contact/actions.ts");
    const debut = source.indexOf("function emailTemplateFor(");
    const corps = source.slice(debut, source.indexOf("\n}\n", debut));
    const renvoyes = [...corps.matchAll(/return "([a-z-]+)";/g)].map((m) => m[1]);
    // Le témoin qui distingue « tout est couvert » de « je n'ai rien lu ».
    expect(renvoyes.length).toBeGreaterThanOrEqual(4);
    for (const g of renvoyes) expect(GABARITS_ACCUSE_MESSAGE as readonly string[]).toContain(g);
  });

  it("chaque accusé envoyé par un autre formulaire de message est cherché aussi", () => {
    for (const [f, g] of [
      ["src/features/commercial-application/actions.ts", "candidature-commercial-confirmee"],
      ["src/features/commercial-application/lead-actions.ts", "lead-apporteur-recu"],
      ["src/features/roi-report/actions.ts", "roi-report"],
    ] as const) {
      expect(lire(f), f).toContain(`"${g}"`);
      expect(GABARITS_ACCUSE_MESSAGE as readonly string[]).toContain(g);
    }
  });

  it("chaque formulaire qui accuse réception LIE l'accusé à son message dès l'envoi", () => {
    for (const f of [
      "src/features/unified-contact/actions.ts",
      "src/features/commercial-application/actions.ts",
      "src/features/commercial-application/lead-actions.ts",
      "src/features/roi-report/actions.ts",
    ]) {
      expect(lire(f), f).toMatch(/\{ entityType: ENTITE_MESSAGE, entityId: submission\.id \}/);
    }
  });

  it("la liste des messages lit les accusés et les affiche", () => {
    const liste = lire("src/app/[locale]/(admin)/[adminPrefix]/submissions/_v2/SubmissionsV2.tsx");
    expect(liste).toContain("lireAccusesMessages(");
    expect(liste).toContain("<MentionAccuse accuse={accuse} />");
    expect(liste).toContain("@/components/admin/accuse/AccuseReceptionAuto");
    const fiche = lire(
      "src/app/[locale]/(admin)/[adminPrefix]/submissions/_v2/SubmissionDetailContent.tsx",
    );
    expect(fiche).toContain("<BlocAccuse accuse={accuse} />");
  });

  it("la liste et la fiche ne tombent pas si le journal des e-mails ne répond pas", () => {
    for (const f of [
      "src/app/[locale]/(admin)/[adminPrefix]/submissions/_v2/SubmissionsV2.tsx",
      "src/app/[locale]/(admin)/[adminPrefix]/submissions/_v2/SubmissionDetailContent.tsx",
    ]) {
      expect(lire(f), f).toMatch(/try \{\s+accuses? = await lireAccuses?Messages?\(/);
    }
  });

  it("la fiche d'une candidature et celle d'un message partagent le MÊME rendu", () => {
    const frise = lire(
      "src/app/[locale]/(admin)/[adminPrefix]/contacts/candidatures/[id]/FriseCandidature.tsx",
    );
    expect(frise).toContain("<LigneAccuse accuse={accuse} />");
    expect(frise).not.toMatch(/function phraseAccuse/);
  });
});
