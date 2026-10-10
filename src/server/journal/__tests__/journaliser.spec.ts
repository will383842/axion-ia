/**
 * Lot FAC-8 — journal unique.
 *
 * `journaliser(tx, entree, options?)` écrit l'entrée de journal DANS la
 * transaction que l'appelant lui passe, après filtrage des `changes:` à toute
 * profondeur. `exiger: true` lève si l'écriture échoue (activation, argent) ;
 * sans l'option, la tolérance de `logQualiopiActivity` est conservée.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { globalCreate } = vi.hoisted(() => ({ globalCreate: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { activityLog: { create: globalCreate } },
}));

import { filtrerChangesJournal, journaliser } from "@/server/journal/journaliser";

const SESSION = { userId: "admin-uuid-1", role: "admin" as const };
const NDA = "11755555555";
const PIECE = "X4RTBPFW4";
const TRAINER_ID = "0b6f1c3e-2d4a-4f8b-9c1d-5e6f7a8b9c0d";
const IBAN = "FR7630006000011234567890189";
const IBAN_ESPACES = "FR76 3000 6000 0112 3456 7890 189";
const EMAIL = "x@exemple.invalid";
const TEL = "+33 6 00 00 00 00";

function txFactice() {
  const create = vi.fn().mockResolvedValue({});
  return { tx: { activityLog: { create } }, create };
}

beforeEach(() => {
  vi.clearAllMocks();
  globalCreate.mockResolvedValue({});
});

describe("filtre du journal — à toute profondeur", () => {
  it("🔴 numéro de pièce et numéro de déclaration d'activité deviennent `{ modifie: true }`", () => {
    const sortie = filtrerChangesJournal({
      numeroPiece: PIECE,
      numeroDeclarationActivite: NDA,
      nda: NDA,
      avant: { formateur: { numeroPieceIdentite: PIECE, ndaNumero: NDA } },
      lignes: [[{ passeport: PIECE }], { declarationActivite: { numero: NDA } }],
    }) as Record<string, unknown>;
    expect(sortie["numeroPiece"]).toEqual({ modifie: true });
    expect(sortie["numeroDeclarationActivite"]).toEqual({ modifie: true });
    expect(sortie["nda"]).toEqual({ modifie: true });
    expect(sortie["avant"]).toEqual({
      formateur: { numeroPieceIdentite: { modifie: true }, ndaNumero: { modifie: true } },
    });
    expect(sortie["lignes"]).toEqual([
      [{ passeport: { modifie: true } }],
      { declarationActivite: { modifie: true } },
    ]);
    const texte = JSON.stringify(sortie);
    expect(texte).not.toContain(NDA);
    expect(texte).not.toContain(PIECE);
  });

  it("IBAN, BIC, RIB, e-mail, téléphone et adresse restent masqués dans les tableaux imbriqués", () => {
    const sortie = filtrerChangesJournal({
      lots: [{ contacts: [{ email: "x@exemple.invalid", tel: "0600000000" }] }],
      paiement: [{ coordonnees: { iban: "FR7630006000011234567890189", bic: "AGRIFRPP882" } }],
      envoi: { adresseLivraison: "1 rue de l'Exemple", rib: "rib.pdf" },
    });
    const texte = JSON.stringify(sortie);
    for (const clair of [
      "x@exemple.invalid",
      "0600000000",
      "30006000011234567890",
      "AGRIFRPP",
      "rue de",
      "rib.pdf",
    ]) {
      expect(texte).not.toContain(clair);
    }
  });

  it("les clés voisines qui ne sont pas sensibles restent lisibles", () => {
    const entree = {
      numero: "LM-2026-0001",
      pieceId: "p-1",
      pieces: ["convention"],
      agenda: "mardi",
      declarationEnvoyee: true,
      numeroPieceVerifie: true,
    };
    expect(filtrerChangesJournal(entree)).toEqual(entree);
  });

  it("ne modifie jamais l'objet reçu", () => {
    const changes = { formateur: { nda: NDA } };
    filtrerChangesJournal(changes);
    expect(changes.formateur.nda).toBe(NDA);
  });
});

describe("filtre du journal — une valeur reconnaissable sous une clé d'empreinte", () => {
  it("🔴 un IBAN (avec ou sans espaces), un e-mail ou un téléphone sous une clé d'empreinte est masqué", () => {
    const sortie = filtrerChangesJournal({
      ibanMasque: IBAN,
      ibanFin4: IBAN_ESPACES,
      emailHash: EMAIL,
      telephoneEmpreinte: TEL,
      avant: { contactEmailSha256: [EMAIL] },
    });
    const texte = JSON.stringify(sortie);
    for (const clair of [IBAN, "3000 6000 0112", EMAIL, "6 00 00 00 00", "exemple.invalid"]) {
      expect(texte).not.toContain(clair);
    }
  });

  it("une vraie empreinte ou une valeur déjà masquée reste lisible", () => {
    const entree = {
      emailHash: "ab12cdef34567890ab12cdef34567890ab12cdef34567890ab12cdef34567890",
      ibanMasque: "FR76 **** **** **** **** **** 189",
      ibanFin4: "0189",
    };
    expect(filtrerChangesJournal(entree)).toEqual(entree);
  });
});

describe("filtre du journal — clés au pluriel", () => {
  it("🔴 e-mails, téléphones, adresses et coordonnées bancaires au pluriel sont masqués, tableaux compris", () => {
    const sortie = filtrerChangesJournal({
      emails: [EMAIL, "y@exemple.invalid"],
      telephones: ["0600000000"],
      adresses: [{ ligne: "1 rue de l'Exemple", ville: "Lyon" }],
      ibans: [IBAN_ESPACES.toLowerCase()],
      bics: ["AGRIFRPP882"],
      contacts: { mails: [EMAIL], portables: ["0700000000"] },
    });
    const texte = JSON.stringify(sortie);
    for (const clair of [
      "exemple.invalid",
      "0600000000",
      "rue de",
      "Lyon",
      "3000 6000",
      "AGRIFRPP",
      "0700000000",
    ]) {
      expect(texte).not.toContain(clair);
    }
  });

  it("🔴 numéros de pièce et de déclaration au pluriel deviennent `{ modifie: true }`", () => {
    const sortie = filtrerChangesJournal({
      numerosPiece: [PIECE],
      passeports: [PIECE],
      ndas: [NDA],
      declarationsActivite: [{ numero: NDA }],
    });
    expect(sortie).toEqual({
      numerosPiece: { modifie: true },
      passeports: { modifie: true },
      ndas: { modifie: true },
      declarationsActivite: { modifie: true },
    });
  });
});

describe("filtre du journal — numéro de déclaration", () => {
  it("🔴 `numero` + `declaration` suffit, sans le mot « activité »", () => {
    const sortie = filtrerChangesJournal({
      numeroDeclaration: NDA,
      declaration: { numero: NDA },
    });
    expect(sortie).toEqual({
      numeroDeclaration: { modifie: true },
      declaration: { numero: NDA },
    });
  });
});

describe("filtre du journal — forme reconnue sous une clé neutre", () => {
  it("🔴 un e-mail ou un IBAN dans un texte libre est masqué", () => {
    const sortie = filtrerChangesJournal({
      contact: `écrire à ${EMAIL}`,
      note: `virement sur ${IBAN_ESPACES}`,
    }) as Record<string, string>;
    expect(sortie["contact"]).not.toContain(EMAIL);
    expect(sortie["contact"]).toContain("écrire à");
    expect(sortie["note"]).not.toContain("3000 6000 0112");
  });
});

describe("journaliser — identifiant de cible", () => {
  it("🔴 un `targetId` qui n'est pas un UUID est refusé avant toute écriture", async () => {
    const { tx, create } = txFactice();
    await expect(
      journaliser(
        tx,
        { action: "qualiopi.test", targetId: "t-1", session: SESSION },
        { exiger: true },
      ),
    ).rejects.toThrow(/UUID/);
    expect(create).not.toHaveBeenCalled();
  });

  it("sans `exiger`, il est écarté sans écrire : rend `false`", async () => {
    const { tx, create } = txFactice();
    await expect(
      journaliser(tx, { action: "qualiopi.test", targetId: "t-1", session: SESSION }),
    ).resolves.toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("journaliser — écrit dans la transaction passée", () => {
  it("🔴 l'entrée est écrite par `tx`, jamais par le client global", async () => {
    const { tx, create } = txFactice();
    const ecrit = await journaliser(tx, {
      action: "qualiopi.trainer.activation",
      targetType: "Trainer",
      targetId: TRAINER_ID,
      changes: { nda: NDA },
      session: SESSION,
    });
    expect(ecrit).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(globalCreate).not.toHaveBeenCalled();
    const data = (create.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({
      adminUserId: "admin-uuid-1",
      action: "qualiopi.trainer.activation",
      targetType: "Trainer",
      targetId: TRAINER_ID,
      changes: { nda: { modifie: true } },
    });
  });

  it("sans session (acte du système), l'entrée est imputée à personne", async () => {
    const { tx, create } = txFactice();
    await journaliser(tx, { action: "qualiopi.systeme", session: null });
    expect(
      (create.mock.calls[0]![0] as { data: { adminUserId: unknown } }).data.adminUserId,
    ).toBeNull();
  });
});

describe("journaliser — contexte de requête fourni par l'appelant", () => {
  it("l'IP (déjà hachée) et le user-agent fournis sont écrits, bornés", async () => {
    const { tx, create } = txFactice();
    await journaliser(
      tx,
      { action: "qualiopi.test", session: SESSION },
      { contexte: () => ({ ipAddress: "h:" + "a".repeat(80), userAgent: "navigateur" }) },
    );
    const data = (create.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data["ipAddress"]).toBe(("h:" + "a".repeat(80)).slice(0, 64));
    expect(data["userAgent"]).toBe("navigateur");
  });

  it("sans contexte (acte du worker), IP et user-agent sont nuls", async () => {
    const { tx, create } = txFactice();
    await journaliser(tx, { action: "qualiopi.test", session: null });
    const data = (create.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data["ipAddress"]).toBeNull();
    expect(data["userAgent"]).toBeNull();
  });
});

describe("journaliser — option `exiger`", () => {
  it("🔴 `exiger: true` : un échec d'écriture est levé", async () => {
    const { tx, create } = txFactice();
    create.mockRejectedValueOnce(new Error("base indisponible"));
    await expect(
      journaliser(tx, { action: "qualiopi.test", session: SESSION }, { exiger: true }),
    ).rejects.toThrow("base indisponible");
  });

  it("`exiger: true` : un échec de lecture du contexte est levé aussi, rien n'est écrit", async () => {
    const { tx, create } = txFactice();
    const contexte = async () => {
      throw new Error("hors requête");
    };
    await expect(
      journaliser(tx, { action: "qualiopi.test", session: SESSION }, { exiger: true, contexte }),
    ).rejects.toThrow("hors requête");
    expect(create).not.toHaveBeenCalled();
  });

  it("sans l'option : un échec de lecture du contexte est toléré, rien n'est écrit", async () => {
    const { tx, create } = txFactice();
    const contexte = async () => {
      throw new Error("hors requête");
    };
    await expect(
      journaliser(tx, { action: "qualiopi.test", session: SESSION }, { contexte }),
    ).resolves.toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("sans l'option : l'échec est toléré, la fonction rend `false`", async () => {
    const { tx, create } = txFactice();
    create.mockRejectedValueOnce(new Error("base indisponible"));
    await expect(journaliser(tx, { action: "qualiopi.test", session: SESSION })).resolves.toBe(
      false,
    );
  });
});

describe("garde statique — le module de journal écrit dans `tx`, et tourne hors de Next", () => {
  const source = readFileSync(join(process.cwd(), "src/server/journal/journaliser.ts"), "utf-8");

  it("🔴 il n'importe pas le client global", () => {
    expect(source).not.toMatch(/from\s+["']@\/lib\/prisma["']/);
  });

  it("il n'importe ni `next/headers` ni `server-only` (le worker doit pouvoir l'utiliser)", () => {
    expect(source).not.toMatch(/["']next\/headers["']/);
    expect(source).not.toMatch(/["']server-only["']/);
  });
});
