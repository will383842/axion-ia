// Messages reçus d'un apporteur, tracés sur sa fiche (2026-11-27). Base EN MÉMOIRE, client Zoho
// DOUBLÉ, données fictives. On vérifie : rattachement par adresse (insensible à la casse), adresse
// inconnue ignorée, idempotence, état du dossier indifférent, demande d'aide enregistrée, lecture
// (récents d'abord, 50 au plus), table absente.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;
const db = vi.hoisted(() => ({
  apporteurs: [] as Ligne[],
  messages: [] as Ligne[],
  tableAbsente: false,
}));

function absente(): never {
  throw Object.assign(new Error("table inexistante"), { code: "P2021" });
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: {
      findMany: async (a: { where: { emailHash: { in: string[] } } }) =>
        db.apporteurs.filter((l) => a.where.emailHash.in.includes(l["emailHash"] as string)),
    },
    apporteurMessageRecu: {
      findMany: async (a: {
        where: { zohoMessageId?: { in: string[] }; apporteurId?: string };
        orderBy?: unknown;
        take?: number;
      }) => {
        if (db.tableAbsente) absente();
        let r = db.messages.filter((l) =>
          a.where.zohoMessageId
            ? a.where.zohoMessageId.in.includes(l["zohoMessageId"] as string)
            : l["apporteurId"] === a.where.apporteurId,
        );
        r = r.sort(
          (x, y) => (y["receivedAt"] as Date).getTime() - (x["receivedAt"] as Date).getTime(),
        );
        return a.take ? r.slice(0, a.take) : r;
      },
      create: async (a: { data: Ligne }) => {
        if (db.tableAbsente) absente();
        if (
          a.data["zohoMessageId"] &&
          db.messages.some((l) => l["zohoMessageId"] === a.data["zohoMessageId"])
        )
          throw Object.assign(new Error("Unique"), { code: "P2002" });
        const ligne = { id: `m-${db.messages.length}`, auto: false, ...a.data };
        db.messages.push(ligne);
        return ligne;
      },
    },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string | null) => (v ? `enc:${v}` : v),
  decryptPii: (v: string | null) => (v && v.startsWith("enc:") ? v.slice(4) : v),
  PII_DECRYPT_PLACEHOLDER: "[encrypted — key missing]",
}));

import { hashEmailForLookup } from "@/lib/security/email-hash";
import {
  enregistrerDemandeAide,
  enregistrerMessagesApporteurs,
  lireMessagesRecus,
  MESSAGES_MAX,
} from "../messages-recus";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const msg = (messageId: string, fromAddress: string, jour = 1) => ({
  messageId,
  folderId: "dossier-1",
  fromAddress,
  subject: `Question ${messageId}`,
  summary: "Bonjour, une question sur mes commissions.",
  receivedAt: new Date(Date.UTC(2026, 10, jour, 9, 30)),
});
const client = { lireEntetes: vi.fn(async () => ({ "message-id": ["<abc@exemple.fr>"] })) };

beforeEach(() => {
  db.apporteurs = [
    // Dossier « refuse » : l'état du dossier ne change rien.
    { id: ID_A, emailHash: hashEmailForLookup("claire.martin@exemple.fr"), statut: "refuse" },
    { id: ID_B, emailHash: hashEmailForLookup("paul.durand@exemple.fr"), statut: "signe" },
  ];
  db.messages = [];
  db.tableAbsente = false;
  client.lireEntetes.mockClear();
});

describe("relevé des e-mails d'un apporteur", () => {
  it("rattache par adresse, sans tenir compte de la casse ni du nom affiché", async () => {
    const r = await enregistrerMessagesApporteurs(
      [
        msg("z1", "Claire.Martin@Exemple.FR"),
        msg("z2", "Claire Martin <claire.martin@exemple.fr>"),
      ],
      client,
    );
    expect(r).toMatchObject({ enregistres: 2, erreurs: 0, tableAbsente: false });
    expect(db.messages.map((m) => m["apporteurId"])).toEqual([ID_A, ID_A]);
    expect(db.messages[0]).toMatchObject({
      source: "email",
      subject: "Question z1",
      excerpt: "enc:Bonjour, une question sur mes commissions.",
      zohoMessageId: "z1",
      internetMessageId: "<abc@exemple.fr>",
      auto: false,
    });
  });

  it("ignore une adresse inconnue", async () => {
    const r = await enregistrerMessagesApporteurs([msg("z1", "inconnu@exemple.fr")], client);
    expect(r.enregistres).toBe(0);
    expect(db.messages).toHaveLength(0);
    expect(client.lireEntetes).not.toHaveBeenCalled();
  });

  it("est idempotent : un second passage sur les mêmes messages n'enregistre rien", async () => {
    const lot = [msg("z1", "claire.martin@exemple.fr"), msg("z2", "paul.durand@exemple.fr")];
    expect((await enregistrerMessagesApporteurs(lot, client)).enregistres).toBe(2);
    const second = await enregistrerMessagesApporteurs(lot, client);
    expect(second).toMatchObject({ enregistres: 0, dejaConnus: 2 });
    expect(db.messages).toHaveLength(2);
  });

  it("marque une réponse automatique", async () => {
    client.lireEntetes.mockResolvedValueOnce({ "auto-submitted": ["auto-replied"] } as never);
    await enregistrerMessagesApporteurs([msg("z1", "claire.martin@exemple.fr")], client);
    expect(db.messages[0]?.["auto"]).toBe(true);
  });

  it("table absente : signalé (le curseur ne doit pas avancer), sans lever", async () => {
    db.tableAbsente = true;
    const r = await enregistrerMessagesApporteurs([msg("z1", "claire.martin@exemple.fr")], client);
    expect(r.tableAbsente).toBe(true);
  });
});

describe("demande d'aide", () => {
  it("est enregistrée et reliée à l'apporteur", async () => {
    const ok = await enregistrerDemandeAide({
      apporteurId: ID_B,
      sujet: "Mon contrat",
      message: "Je ne retrouve pas mon contrat.",
      maintenant: new Date("2026-11-20T10:00:00Z"),
    });
    expect(ok).toBe(true);
    expect(db.messages[0]).toMatchObject({
      apporteurId: ID_B,
      source: "demande_aide",
      subject: "Demande d'aide : Mon contrat",
      excerpt: "enc:Je ne retrouve pas mon contrat.",
    });
    expect(db.messages[0]?.["zohoMessageId"]).toBeUndefined();
  });

  it("ne lève pas si la base refuse", async () => {
    db.tableAbsente = true;
    expect(await enregistrerDemandeAide({ apporteurId: ID_B, sujet: "x", message: "y" })).toBe(
      false,
    );
  });
});

describe("lecture pour la fiche", () => {
  it("rend e-mails et demandes d'aide, les plus récents d'abord, 50 au plus", async () => {
    for (let i = 1; i <= 28; i++) {
      await enregistrerMessagesApporteurs([msg(`z${i}`, "claire.martin@exemple.fr", i)], client);
    }
    for (let i = 1; i <= 28; i++) {
      await enregistrerDemandeAide({
        apporteurId: ID_A,
        sujet: "Autre",
        message: `demande ${i}`,
        maintenant: new Date(Date.UTC(2026, 11, i, 8)),
      });
    }
    await enregistrerMessagesApporteurs([msg("autre", "paul.durand@exemple.fr", 5)], client);
    const l = await lireMessagesRecus(ID_A);
    expect(l).toHaveLength(MESSAGES_MAX);
    expect(l[0]).toMatchObject({ source: "demande_aide", extrait: "demande 28" });
    const dates = l.map((m) => m.recuLe.getTime());
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
    expect(l.every((m) => m.objet !== "Question autre")).toBe(true);
  });

  it("table absente : liste vide", async () => {
    db.tableAbsente = true;
    expect(await lireMessagesRecus(ID_A)).toEqual([]);
  });
});
