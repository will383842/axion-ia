/**
 * Retour automatique du CRM vers le dossier client (25/10/2026) : contrat,
 * « le plus récent gagne », aucune suppression, pas d'écho, drapeau fermé.
 * Données FICTIVES, base simulée.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CLIENT = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";

const base = vi.hoisted(() => {
  const fiche = {
    type: "entreprise",
    nafCode: "8559A",
    adresseRue: "1 rue des Tests",
    adresseCodePostal: "75001",
    adresseVille: "Paris",
    updatedAt: new Date("2026-10-25T10:00:00Z"),
  };
  const maj: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const synchro = { empreinte: "x" as string | null };
  const synchroMaj: Array<Record<string, unknown>> = [];
  const tx = {
    client: {
      findUnique: vi.fn(async (_a?: unknown) => base.etat.fiche as unknown),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => {
        maj.push(a.data);
      }),
    },
    activityLog: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        audits.push(a.data);
      }),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    crmDossierSynchro: {
      findUnique: vi.fn(async (_a?: unknown) => base.etat.synchro as unknown),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => {
        synchroMaj.push(a.data);
      }),
    },
  };
  const etat = { fiche: fiche as unknown, synchro: synchro as unknown };
  const base = { fiche, maj, audits, synchro, synchroMaj, tx, prisma, etat };
  return base;
});

vi.mock("@/lib/prisma", () => ({ prisma: base.prisma }));
vi.mock("@/server/partners-sync/producteurs/client", () => ({
  chargeClientAvant: vi.fn(async () => null),
  emettreFaitClient: vi.fn(async () => undefined),
}));
vi.mock("@/server/crm-sync/lire-dossier", () => ({
  lireEntreeDossier: vi.fn(async () => ({
    entree: {
      clientId: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
      numero: "AXI-CLI-004",
      raisonSociale: "Pharmacie Fictive",
      siren: null,
      adresseRue: null,
      adresseCodePostal: null,
      adresseVille: null,
      telephone: null,
      effectif: null,
      factureEmise: false,
      urlConsole: null,
      questionnaire: null,
      contacts: [],
    },
    dernierChangement: new Date(),
  })),
}));

import {
  appliquerRetourDossier,
  colonnesAAppliquer,
  parseRetourDossier,
  type RetourDossier,
} from "@/server/crm-sync/retour-dossier";
// Test de la route elle-même : l'import descendant est voulu.
// eslint-disable-next-line no-restricted-imports
import { POST } from "@/app/api/internal/crm-dossier-webhook/route";
import { signInboundBody } from "@/server/crm-sync/inbound";

function corps(surcharge: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event_id: "evt-12345678",
    event_type: "company_dossier_changed",
    origin: "crm",
    occurred_at: "2026-10-25T11:00:00Z",
    subject_ref: `site:client:${CLIENT}`,
    fields: { naf_code: "62.01Z", adresse_ville: "Lyon" },
    ...surcharge,
  };
}
function message(surcharge: Record<string, unknown> = {}): RetourDossier {
  const m = parseRetourDossier(corps(surcharge));
  if (m === null) throw new Error("message de test invalide");
  return m;
}

beforeEach(() => {
  base.etat.fiche = base.fiche;
  base.etat.synchro = base.synchro;
});
afterEach(() => {
  vi.unstubAllEnvs();
  base.maj.length = 0;
  base.audits.length = 0;
  base.synchroMaj.length = 0;
  vi.clearAllMocks();
});

describe("contrat du retour", () => {
  it("accepte le message nominal et normalise le NAF", () => {
    expect(message().fields).toEqual({ naf_code: "6201Z", adresse_ville: "Lyon" });
  });
  it("refuse une clé inconnue, une origine autre que crm, une référence mal formée", () => {
    expect(parseRetourDossier(corps({ extra: 1 }))).toBeNull();
    expect(parseRetourDossier(corps({ origin: "site" }))).toBeNull();
    expect(parseRetourDossier(corps({ subject_ref: "site:client:pas-un-uuid" }))).toBeNull();
    expect(parseRetourDossier(corps({ event_type: "autre" }))).toBeNull();
  });
  it("refuse un champ hors de la liste fermée (score, étiquette, personne…)", () => {
    for (const cle of ["score", "tags", "lifecycle_stage", "email", "contacts", "montant"]) {
      expect(parseRetourDossier(corps({ fields: { [cle]: "x" } }))).toBeNull();
    }
  });
  it("une valeur vide ou invalide n'écrit rien (jamais de suppression)", () => {
    const m = message({
      fields: { naf_code: "pas un naf", adresse_ville: "  ", adresse_rue: null },
    });
    expect(m.fields).toEqual({});
  });
});

describe("le plus récent gagne, sans suppression", () => {
  it("applique seulement les valeurs différentes, si le CRM est plus récent", () => {
    const data = colonnesAAppliquer(
      base.fiche,
      { naf_code: "6201Z", adresse_ville: "Paris" },
      new Date("2026-10-25T11:00:00Z"),
    );
    expect(data).toEqual({ nafCode: "6201Z" });
  });
  it("la console plus récente garde sa valeur", () => {
    expect(
      colonnesAAppliquer(base.fiche, { naf_code: "6201Z" }, new Date("2026-10-25T09:00:00Z")),
    ).toEqual({});
    // Égalité : la console garde (pas d'écrasement sur ex æquo).
    expect(colonnesAAppliquer(base.fiche, { naf_code: "6201Z" }, base.fiche.updatedAt)).toEqual({});
  });
});

describe("application", () => {
  it("écrit, laisse une trace d'audit sans valeur libre, pose l'anti-écho", async () => {
    base.synchro.empreinte = null; // différente de l'empreinte calculée ⇒ des changements en attente
    expect(await appliquerRetourDossier(message())).toBe("applique");
    expect(base.maj).toEqual([{ nafCode: "6201Z", adresseVille: "Lyon" }]);
    expect(base.audits[0]).toMatchObject({
      adminUserId: null,
      action: "client.mis_a_jour_depuis_crm",
      changes: { origine: "crm", champs: ["nafCode", "adresseVille"] },
    });
    // Changement console en attente : seul `crmVuLe` et `crmEmpreinte` bougent, pas `empreinte`.
    expect(base.synchroMaj[0]).toHaveProperty("crmVuLe");
    expect(base.synchroMaj[0]).not.toHaveProperty("empreinte");
  });
  it("rien en attente côté console : l'empreinte suit, le dossier ne repart pas", async () => {
    const { lireEntreeDossier } = await import("@/server/crm-sync/lire-dossier");
    const { dossierPourCrm, empreinteDossier, entreprisePourCrm } =
      await import("@/server/crm-sync/instantane-dossier");
    const lu = (await lireEntreeDossier(CLIENT, new Date()))!;
    base.synchro.empreinte = empreinteDossier(
      entreprisePourCrm(lu.entree),
      dossierPourCrm(lu.entree),
    );
    expect(await appliquerRetourDossier(message())).toBe("applique");
    expect(base.synchroMaj[0]).toHaveProperty("empreinte");
  });
  it("valeurs déjà identiques : inchangé, aucune écriture", async () => {
    expect(await appliquerRetourDossier(message({ fields: { naf_code: "8559A" } }))).toBe(
      "inchange",
    );
    expect(base.maj).toHaveLength(0);
  });
  it("fiche absente ou particulier : ignoré", async () => {
    base.etat.fiche = null;
    expect(await appliquerRetourDossier(message())).toBe("ignore");
    base.etat.fiche = { ...base.fiche, type: "particulier" };
    expect(await appliquerRetourDossier(message())).toBe("ignore");
    expect(base.maj).toHaveLength(0);
  });
});

describe("route", () => {
  const SECRET = "a".repeat(64);
  function requete(texte: string, signee = true): Request {
    const t = String(Math.floor(Date.now() / 1000));
    return new Request("http://x/api/internal/crm-dossier-webhook", {
      method: "POST",
      body: texte,
      headers: {
        "x-crm-timestamp": t,
        "x-crm-signature": signee ? signInboundBody(SECRET, t, texte) : "0".repeat(64),
      },
    });
  }
  beforeEach(() => vi.stubEnv("SITE_SYNC_HMAC_SECRET", SECRET));

  it("signature fausse : 401, même drapeau ouvert", async () => {
    vi.stubEnv("CRM_INBOUND_DOSSIER_ENABLED", "true");
    expect((await POST(requete(JSON.stringify(corps()), false))).status).toBe(401);
  });
  it("drapeau fermé : 503 et rien d'écrit", async () => {
    expect((await POST(requete(JSON.stringify(corps())))).status).toBe(503);
    expect(base.maj).toHaveLength(0);
  });
  it("drapeau ouvert : contrat violé 422, message valide 200", async () => {
    vi.stubEnv("CRM_INBOUND_DOSSIER_ENABLED", "true");
    expect((await POST(requete(JSON.stringify(corps({ origin: "site" }))))).status).toBe(422);
    const r = await POST(requete(JSON.stringify(corps())));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, outcome: "applique" });
  });
});
