/**
 * `scripts/regulariser-contact-en-double.ts` — mode à blanc et refus.
 * Le script n'est jamais exécuté par la PR ; ce test prouve que, sans
 * `--executer`, aucune transaction n'est ouverte, et que les mauvaises
 * entrées sont refusées. L'écriture réelle (`--executer`) est exercée plus bas sur la base en mémoire.
 */

import { describe, expect, it, vi } from "vitest";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { baseEnMemoire, ficheClient } from "./_base-en-memoire";
import {
  ErreurRegularisation,
  regulariserContactEnDouble,
  type BaseRegularisation,
} from "../../../../../scripts/qualiopi/regulariser-contact-en-double";

vi.mock("@/lib/chiffrer-parole", () => ({ chiffrerParole: (t: string) => `enc:${t}` }));

const FICHE = "f-1";
function base(autreFiche = false) {
  const transaction = vi.fn();
  const db = {
    client: {
      findUnique: async () => ({
        id: FICHE,
        contactEmail: "anne@fictive.example",
        contactTelephone: "01 02 03 04 05",
      }),
    },
    clientContact: {
      findUnique: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        clientId: where.id === "doublon" && autreFiche ? "f-2" : FICHE,
        nom: where.id === "doublon" ? "Anne Dupont" : "DUPONT Anne",
        fonction: "Gérante",
        adresses: where.id === "garder" ? [{ email: "anne@fictive.example" }] : [],
      }),
    },
    $transaction: transaction,
  } as unknown as BaseRegularisation;
  return { db, transaction };
}
const ARGS = { client: "AXI-CLI-030", garder: "garder", doublon: "doublon" };

describe("régulariser un contact en double", () => {
  it("à blanc : affiche, n'ouvre aucune transaction, ne sort ni nom ni adresse", async () => {
    const { db, transaction } = base();
    const lignes: string[] = [];
    const bilan = await regulariserContactEnDouble(db, ARGS, {
      executer: false,
      journal: (l) => lignes.push(l),
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(bilan).toMatchObject({ executee: false, gardeeId: "garder", doublonId: "doublon" });
    const sortie = lignes.join("\n");
    expect(sortie).not.toMatch(/dupont|anne|fictive/i);
  });

  it("refuse deux personnes de fiches différentes", async () => {
    const { db } = base(true);
    await expect(regulariserContactEnDouble(db, ARGS, { executer: false })).rejects.toThrow(
      ErreurRegularisation,
    );
  });

  it("refuse la même personne deux fois", async () => {
    const { db } = base();
    await expect(
      regulariserContactEnDouble(db, { ...ARGS, doublon: "garder" }, { executer: false }),
    ).rejects.toThrow(/même personne/);
  });
});

/** Adaptateur : la base en mémoire, vue comme le script la lit (numéro, `select`, notes). */
function baseReelle(fonctionDoublon: string | null) {
  const fiche = ficheClient({
    numero: "AXI-CLI-030",
    raisonSociale: "Fictive SA",
    contactNom: "DUPONT Anne",
    contactEmail: "anne@fictive.example",
    contactTelephone: "01 02 03 04 05",
    contactFonction: "Gérante",
  });
  const h = hashEmailForLookup("anne@fictive.example") ?? "";
  const mem = baseEnMemoire({
    clients: [fiche],
    contacts: [
      {
        id: "garder",
        clientId: fiche.id,
        nom: "DUPONT Anne",
        fonction: "Gérante",
        telephone: "01 02 03 04 05",
        origine: "saisie",
        estContactFacturation: false,
        creeParId: null,
      },
      {
        id: "doublon",
        clientId: fiche.id,
        nom: "Anne Dupont",
        fonction: fonctionDoublon,
        telephone: null,
        origine: "saisie",
        estContactFacturation: true,
        creeParId: null,
      },
    ],
    adresses: [
      { id: "a1", contactId: "garder", email: "anne@fictive.example", emailHash: h, nature: "pro" },
    ],
  });
  const notes: unknown[] = [];
  const db = {
    client: {
      findUnique: async () => ({
        id: fiche.id,
        contactEmail: fiche.contactEmail,
        contactTelephone: fiche.contactTelephone,
      }),
    },
    clientContact: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const p = mem.etat.contacts.find((c) => c.id === where.id);
        if (!p) return null;
        return {
          id: p.id,
          clientId: p.clientId,
          nom: p.nom,
          fonction: p.fonction,
          adresses: mem.etat.adresses
            .filter((a) => a.contactId === p.id)
            .map((a) => ({ email: a.email })),
        };
      },
    },
    $transaction: <T>(fn: (tx: never) => Promise<T>) =>
      mem.$transaction((tx) =>
        fn({
          ...tx,
          clientNote: {
            create: async (a: unknown) => {
              notes.push(a);
              return a;
            },
          },
        } as never),
      ),
  } as unknown as BaseRegularisation;
  return { db, mem, notes, fiche };
}

describe("régulariser — écriture réelle (--executer), base en mémoire", () => {
  it("fonction du doublon vide : la fonction réelle de la personne gardée reste", async () => {
    for (const vide of [null, ""]) {
      const { db, mem, notes } = baseReelle(vide);
      const bilan = await regulariserContactEnDouble(db, ARGS, { executer: true });
      expect(bilan.executee).toBe(true);
      const gardee = mem.etat.contacts.find((c) => c.id === "garder");
      expect(gardee?.fonction, `fonction du doublon = ${JSON.stringify(vide)}`).toBe("Gérante");
      expect(gardee?.telephone).toBe("01 02 03 04 05");
      expect(gardee?.estContactFacturation).toBe(true);
      expect(gardee?.nom).toBe("Anne Dupont");
      expect(mem.etat.contacts.find((c) => c.id === "doublon")).toBeDefined();
      expect(notes).toHaveLength(1);
      expect(mem.etat.journal.at(-1)).toMatchObject({
        action: "dossier_client.contact_regularise",
      });
    }
  });

  it("fonction du doublon renseignée : elle est reportée sur la personne gardée", async () => {
    const { db, mem } = baseReelle("Directrice");
    await regulariserContactEnDouble(db, ARGS, { executer: true });
    expect(mem.etat.contacts.find((c) => c.id === "garder")?.fonction).toBe("Directrice");
  });
});
