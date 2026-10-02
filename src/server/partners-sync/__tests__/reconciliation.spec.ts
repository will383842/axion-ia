/**
 * INT-T08-A — `rejouerEvenement` appelable : `POST /api/partners/reconciliation` (REQ-INT-013).
 *
 * Partners, quand sa réconciliation trouve des `event_id` manquants, demande leur REJEU. axionia
 * réarme les lignes de sa file de sortie : `pending`, tentatives à zéro, dues maintenant — le corps
 * et la séquence NE CHANGENT PAS, l'octet exact repart, et Partners déduplique par `event_id`.
 *
 * CE QU'IL PROUVE :
 *   — inertie : canal fermé ou secret absent, 404, rien n'est écrit ;
 *   — la requête est signée par Partners sur le CHEMIN ET LE CORPS : une signature fausse, ou valable
 *     pour un autre corps, rend 401 sans écriture ;
 *   — le corps est borné : une liste de 1 à `REJEU_MAX_PAR_APPEL` identifiants uuid, sinon 400 ;
 *   — chaque ligne est réarmée par une écriture qui ne touche ni le corps ni la séquence ;
 *   — la réponse liste les réarmés et les introuvables, signée comme un envoi du relais.
 */
import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { signerCorps } from "@/server/partners/enveloppe";
import {
  CLE_DEBIT_REJEU,
  DEBIT_REJEU,
  REJEU_MAX_PAR_APPEL,
  repondreReconciliation,
  rejouerEvenement,
  type EcrivainRejeu,
} from "@/server/partners-sync/reconciliation";
import { signerCibleRelecture } from "@/server/partners-sync/relecture";

const SECRET_RELECTURE = "r".repeat(40);
const SECRET_EMISSION = "e".repeat(40);
const MAINTENANT_MS = Date.UTC(2026, 9, 2, 12, 0, 0);
const T = String(Math.floor(MAINTENANT_MS / 1000));
const CHEMIN = "/api/partners/reconciliation";

const A = "0a1b2c3d-0001-4000-8000-000000000001";
const B = "0a1b2c3d-0002-4000-8000-000000000002";
const INCONNU = "0a1b2c3d-0003-4000-8000-000000000003";

type Ecriture = { where: { eventId: string }; data: Record<string, unknown> };

/** Une file de sortie simulée : elle connaît A et B, et compte les écritures. */
function file(connus: string[] = [A, B]) {
  const ecritures: Ecriture[] = [];
  const prisma: EcrivainRejeu = {
    partnersSyncOutbox: {
      updateMany: async (args) => {
        ecritures.push(args as Ecriture);
        return { count: connus.includes(args.where.eventId) ? 1 : 0 };
      },
    },
  };
  return { prisma, ecritures };
}

function requete(corps: string, signature?: string, cheminSigne = CHEMIN, corpsSigne = corps) {
  const s = signature ?? signerCibleRelecture(SECRET_RELECTURE, T, `${cheminSigne}\n${corpsSigne}`);
  return new Request(`https://axion-ia.com${CHEMIN}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-partners-timestamp": T,
      "x-partners-signature": s,
    },
    body: corps,
  });
}

const corpsDe = (eventIds: unknown) => JSON.stringify({ eventIds });

const ENV_AVANT = { ...process.env };
beforeEach(() => {
  process.env.PARTNERS_SYNC_ENABLED = "true";
  process.env.PARTNERS_SYNC_SECRET = SECRET_EMISSION;
  process.env.PARTNERS_RELECTURE_SECRET = SECRET_RELECTURE;
  process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
});
afterEach(() => {
  process.env = { ...ENV_AVANT };
});

describe("REQ-INT-013 — rejouerEvenement réarme une ligne sans toucher son corps", () => {
  it("TÉMOIN — pending, tentatives à zéro, due maintenant, erreur effacée ; ni corps ni séquence", async () => {
    const { prisma, ecritures } = file();
    expect(await rejouerEvenement(A, prisma, new Date(MAINTENANT_MS))).toBe(true);
    expect(ecritures).toEqual([
      {
        where: { eventId: A },
        data: {
          status: "pending",
          attempts: 0,
          nextAttemptAt: new Date(MAINTENANT_MS),
          lastError: null,
        },
      },
    ]);
  });

  it("une ligne inconnue n'est pas réarmée, et le dit", async () => {
    const { prisma } = file();
    expect(await rejouerEvenement(INCONNU, prisma, new Date(MAINTENANT_MS))).toBe(false);
  });
});

describe("REQ-INT-013 — POST /api/partners/reconciliation", () => {
  const lignesDeJournal: string[] = [];
  const appelsDuLimiteur: unknown[][] = [];
  let admis = true;
  const d = (prisma: EcrivainRejeu) => ({
    prisma,
    maintenantMs: MAINTENANT_MS,
    limiter: async (...a: unknown[]) => {
      appelsDuLimiteur.push(a);
      return { allowed: admis };
    },
    journal: (l: string) => lignesDeJournal.push(l),
  });
  beforeEach(() => {
    lignesDeJournal.length = 0;
    appelsDuLimiteur.length = 0;
    admis = true;
  });

  it("TÉMOIN — canal fermé : 404, rien n'est écrit", async () => {
    process.env.PARTNERS_SYNC_ENABLED = "false";
    const { prisma, ecritures } = file();
    const r = await repondreReconciliation(requete(corpsDe([A])), d(prisma));
    expect(r.status).toBe(404);
    expect(ecritures).toEqual([]);
  });

  it("secret de relecture absent : 404, rien n'est écrit", async () => {
    delete process.env.PARTNERS_RELECTURE_SECRET;
    const { prisma, ecritures } = file();
    expect((await repondreReconciliation(requete(corpsDe([A])), d(prisma))).status).toBe(404);
    expect(ecritures).toEqual([]);
  });

  it("TÉMOIN — une signature fausse, ou valable pour UN AUTRE CORPS, rend 401 sans écriture", async () => {
    const { prisma, ecritures } = file();
    expect(
      (await repondreReconciliation(requete(corpsDe([A]), "0".repeat(64)), d(prisma))).status,
    ).toBe(401);
    // Signée pour [B], envoyée avec [A] : le corps est sous la signature.
    const r = await repondreReconciliation(
      requete(corpsDe([A]), undefined, CHEMIN, corpsDe([B])),
      d(prisma),
    );
    expect(r.status).toBe(401);
    expect(ecritures).toEqual([]);
  });

  it.each([
    ["un corps illisible", "pas du json"],
    ["une liste vide", corpsDe([])],
    ["un identifiant qui n'est pas un uuid", corpsDe(["x"])],
    ["un champ en trop", JSON.stringify({ eventIds: [A], tout: true })],
    ["pas de liste", JSON.stringify({ eventIds: A })],
    [
      `plus de ${REJEU_MAX_PAR_APPEL} identifiants`,
      corpsDe(
        Array.from(
          { length: REJEU_MAX_PAR_APPEL + 1 },
          (_, i) => `0a1b2c3d-0001-4000-8000-${String(i).padStart(12, "0")}`,
        ),
      ),
    ],
  ])("TÉMOIN — %s : 400, rien n'est écrit", async (_quoi, corps) => {
    const { prisma, ecritures } = file();
    expect((await repondreReconciliation(requete(corps), d(prisma))).status).toBe(400);
    expect(ecritures).toEqual([]);
  });

  it("la borne est nommée : cent identifiants par appel", () => {
    expect(REJEU_MAX_PAR_APPEL).toBe(100);
  });

  it("le débit est nommé : dix appels par heure, refusé si le compteur est aveugle", () => {
    expect(DEBIT_REJEU).toEqual({ limit: 10, windowSec: 3600, surPanne: "refuser" });
    expect(CLE_DEBIT_REJEU).toBe("partners:reconciliation");
  });

  it("TÉMOIN — débit dépassé : 429, rien n'est écrit ; le limiteur reçoit la clé et la borne exactes", async () => {
    admis = false;
    const { prisma, ecritures } = file();
    const r = await repondreReconciliation(requete(corpsDe([A])), d(prisma));
    expect(r.status).toBe(429);
    expect(await r.text()).toBe("debit_depasse");
    expect(ecritures).toEqual([]);
    expect(appelsDuLimiteur).toEqual([[CLE_DEBIT_REJEU, DEBIT_REJEU]]);
  });

  it("TÉMOIN — un appel NON AUTHENTIFIÉ ne consomme pas le débit et n'écrit rien", async () => {
    const { prisma, ecritures } = file();
    const r = await repondreReconciliation(
      new Request(`https://axion-ia.com${CHEMIN}`, { method: "POST", body: corpsDe([A]) }),
      d(prisma),
    );
    expect(r.status).toBe(401);
    expect(appelsDuLimiteur).toEqual([]);
    expect(ecritures).toEqual([]);
  });

  it("TÉMOIN — réarme les connus, nomme les introuvables, une écriture par identifiant (doublons fondus) ; réponse signée", async () => {
    const { prisma, ecritures } = file();
    const r = await repondreReconciliation(requete(corpsDe([A, INCONNU, B, A])), d(prisma));
    expect(r.status).toBe(200);
    const corps = await r.text();
    expect(JSON.parse(corps)).toEqual({ rearmes: [A, B], introuvables: [INCONNU] });
    expect(ecritures.map((e) => e.where.eventId)).toEqual([A, INCONNU, B]);
    const t = r.headers.get("x-axionia-timestamp")!;
    expect(r.headers.get("x-axionia-signature")).toBe(signerCorps(SECRET_EMISSION, t, corps));
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("TÉMOIN — le journal ne porte que des COMPTES : ni identifiant d'événement, ni corps", async () => {
    const { prisma } = file();
    await repondreReconciliation(requete(corpsDe([A, INCONNU])), d(prisma));
    expect(lignesDeJournal).toEqual(["[partners-sync] rejeu : 1 réarmé(s), 1 introuvable(s)"]);
    for (const l of lignesDeJournal) {
      expect(l).not.toContain(A);
      expect(l).not.toContain(INCONNU);
    }
  });

  it("la signature de la requête porte le chemin ET le corps, séparés par un saut de ligne", () => {
    const corps = corpsDe([A]);
    const attendue = createHmac("sha256", SECRET_RELECTURE)
      .update(`${T}.${CHEMIN}\n${corps}`)
      .digest("hex");
    expect(signerCibleRelecture(SECRET_RELECTURE, T, `${CHEMIN}\n${corps}`)).toBe(attendue);
  });
});
