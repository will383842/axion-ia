// @vitest-environment node
/**
 * DÉCISION DE WILLIAMS DU 11/11/2026 — une demande d'effacement ne supprime plus rien.
 *
 * La personne est MISE À L'ÉCART : plus aucun envoi, plus aucune réinscription par un nouvel
 * accord. Ses données sont GARDÉES. Williams reçoit une alerte dans la cloche (niveau `info` :
 * jamais d'e-mail groupé, jamais de Telegram) avec la demande à traiter à la main.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

const suppressions = vi.fn();
const opposition = vi.fn();
const marque = vi.fn();
const lireOpposition = vi.fn();
const creerOpposition = vi.fn();
const abonnes = vi.fn();
const journal = vi.fn();
const contacts = vi.fn();
const rapports = vi.fn();
const crm = vi.fn();
const alerte = vi.fn();
const telegram = vi.fn();

const interdit = (...a: unknown[]): never => {
  suppressions(...a);
  throw new Error("suppression interdite");
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOpposition: {
      updateMany: (...a: unknown[]) => marque(...a),
      findUnique: (...a: unknown[]) => lireOpposition(...a),
      create: (...a: unknown[]) => creerOpposition(...a),
      delete: (...a: unknown[]) => interdit(...a),
      deleteMany: (...a: unknown[]) => interdit(...a),
    },
    newsletterSubscriber: {
      updateMany: (...a: unknown[]) => abonnes(...a),
      delete: (...a: unknown[]) => interdit(...a),
      deleteMany: (...a: unknown[]) => interdit(...a),
    },
    guideRequest: {
      delete: (...a: unknown[]) => interdit(...a),
      deleteMany: (...a: unknown[]) => interdit(...a),
      update: (...a: unknown[]) => interdit(...a),
      updateMany: (...a: unknown[]) => interdit(...a),
    },
    emailOutbox: {
      delete: (...a: unknown[]) => interdit(...a),
      deleteMany: (...a: unknown[]) => interdit(...a),
    },
    crmSyncOutbox: {
      delete: (...a: unknown[]) => interdit(...a),
      deleteMany: (...a: unknown[]) => interdit(...a),
    },
    activityLog: { create: (...a: unknown[]) => journal(...a) },
  },
}));
vi.mock("@/server/email/opposition", () => ({
  enregistrerOppositionPourAdresse: (...a: unknown[]) => opposition(...a),
}));
vi.mock("@/server/guides-reseau/mise-a-l-ecart", () => ({
  mettreContactsAEcart: (...a: unknown[]) => contacts(...a),
}));
vi.mock("@/lib/rgpd-erase", () => ({
  ecarterRapportsAvantAuditPourEmail: (...a: unknown[]) => rapports(...a),
}));
vi.mock("@/server/crm-sync/gdpr", () => ({
  propagateGdprToCrm: (...a: unknown[]) => crm(...a),
}));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: (...a: unknown[]) => alerte(...a),
}));
vi.mock("@/lib/telegram", () => ({ alertIncident: (...a: unknown[]) => telegram(...a) }));

import {
  ACTION_DEMANDE_EFFACEMENT,
  CODE_ALERTE_EFFACEMENT,
  ecarterPourDemandeEffacement,
} from "../ecarter-au-lieu-d-effacer";
import { hashEmailForLookup } from "@/lib/security/email-hash";

const ADRESSE = "nadia@exemple.fr";

beforeEach(() => {
  for (const f of [
    suppressions,
    opposition,
    marque,
    lireOpposition,
    creerOpposition,
    abonnes,
    journal,
    contacts,
    rapports,
    crm,
    alerte,
    telegram,
  ]) {
    f.mockReset();
  }
  opposition.mockResolvedValue({ ok: true, email: ADRESSE, dejaOpposee: false, crmAverti: true });
  marque.mockResolvedValue({ count: 1 });
  lireOpposition.mockResolvedValue({ id: "op-1" });
  abonnes.mockResolvedValue({ count: 1 });
  journal.mockResolvedValue({ id: "log-1" });
  contacts.mockResolvedValue({ ecartes: 2 });
  rapports.mockResolvedValue({ ecartes: 0, annules: 0 });
  crm.mockResolvedValue({ status: "deferred", detail: "fermé" });
  alerte.mockResolvedValue({ id: "al-1" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Écarter au lieu d'effacer (décision du 11/11/2026)", () => {
  it("🔴 ne supprime RIEN : ni abonné, ni demande du guide, ni corbeille, ni file CRM", async () => {
    await ecarterPourDemandeEffacement({ email: ADRESSE, origine: "libre-service" });
    expect(suppressions).not.toHaveBeenCalled();
  });

  it("pose l'opposition, puis la marque « effacement demandé » sur sa ligne", async () => {
    const r = await ecarterPourDemandeEffacement({ email: ADRESSE, origine: "libre-service" });
    expect(opposition).toHaveBeenCalledWith(ADRESSE, { origine: "effacement-libre-service" });
    const appel = marque.mock.calls[0]?.[0] as {
      where: { emailHash: string; effacementDemandeLe: null };
      data: { effacementDemandeLe: Date };
    };
    expect(appel.where.emailHash).toBe(hashEmailForLookup(ADRESSE));
    // Posée une fois, jamais réécrite : la date de la PREMIÈRE demande reste.
    expect(appel.where.effacementDemandeLe).toBeNull();
    expect(appel.data.effacementDemandeLe).toBeInstanceOf(Date);
    expect(r.opposition).toBe("ok");
  });

  it("si l'opposition a échoué et qu'aucune ligne n'existe, la marque crée la ligne", async () => {
    opposition.mockResolvedValue({ ok: false, error: "internal" });
    marque.mockResolvedValue({ count: 0 });
    lireOpposition.mockResolvedValue(null);
    creerOpposition.mockResolvedValue({ id: "op-2" });
    const r = await ecarterPourDemandeEffacement({ email: ADRESSE, origine: "libre-service" });
    const data = (creerOpposition.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data["emailHash"]).toBe(hashEmailForLookup(ADRESSE));
    expect(data["effacementDemandeLe"]).toBeInstanceOf(Date);
    expect(r.opposition).toBe("echec");
    expect(r.marque).toBe("ok");
  });

  it("l'abonné passe « désabonné » par une MISE À JOUR, jeton de réinscription retiré", async () => {
    await ecarterPourDemandeEffacement({ email: ADRESSE, origine: "libre-service" });
    const appel = abonnes.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(appel.where["email"]).toBe(ADRESSE);
    expect(appel.data["status"]).toBe("unsubscribed");
    expect(appel.data["confirmToken"]).toBeNull();
  });

  it("contacts de la page guide et rapports avant audit : mis à l'écart", async () => {
    await ecarterPourDemandeEffacement({ email: ADRESSE, origine: "libre-service" });
    expect(contacts).toHaveBeenCalledWith(ADRESSE);
    expect(rapports).toHaveBeenCalledWith(ADRESSE, expect.any(Date));
  });

  it("le site n'envoie PAS de demande d'effacement au CRM (l'opposition le prévient)", async () => {
    await ecarterPourDemandeEffacement({ email: ADRESSE, origine: "libre-service" });
    expect(crm).not.toHaveBeenCalled();
  });

  it("🔒 le module et ses imports directs n'effacent rien (erase, deleteMany, DELETE)", () => {
    const racine = process.cwd();
    const lire = (f: string) => readFileSync(join(racine, f), "utf8");
    const module = lire("src/server/rgpd/ecarter-au-lieu-d-effacer.ts");
    const imports = [...module.matchAll(/from\s+"@\/([^"]+)"/g)]
      .map((m) => m[1] as string)
      .filter((c) => !c.startsWith("lib/prisma") && c !== "lib/rgpd-erase")
      .map((c) => `src/${c}.ts`)
      .filter((f) => existsSync(join(racine, f)));
    // `rgpd-erase` garde ses effaceurs (outil du geste humain) : seule la fonction d'écart passe.
    const deRgpdErase = module.match(/import\s*\{([^}]*)\}\s*from\s*"@\/lib\/rgpd-erase"/);
    expect(module).not.toMatch(/import\s*\*\s*as\s+\w+\s+from\s*"@\/lib\/rgpd-erase"/);
    expect(
      (deRgpdErase?.[1] ?? "")
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean),
    ).toEqual(["ecarterRapportsAvantAuditPourEmail"]);
    for (const f of ["src/server/rgpd/ecarter-au-lieu-d-effacer.ts", ...imports]) {
      const code = lire(f)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      if (f.endsWith("ecarter-au-lieu-d-effacer.ts")) {
        expect(code, f).not.toMatch(/action\s*:\s*["']erase["']/);
        expect(code, f).not.toMatch(/\.(delete|deleteMany)\s*\(/);
        expect(code, f).not.toMatch(/\$executeRaw[\s\S]{0,200}DELETE/i);
        expect(code, f).not.toMatch(/propagateGdprToCrm/);
      } else {
        expect(code, f).not.toMatch(/action\s*:\s*["']erase["']/);
        expect(code, f).not.toMatch(/\.deleteMany\s*\(/);
        expect(code, f).not.toMatch(/\$executeRaw(Unsafe)?[\s\S]{0,200}DELETE\s+FROM/i);
      }
    }
  });

  it("🔑 la preuve de la demande est gardée, sans adresse en clair", async () => {
    await ecarterPourDemandeEffacement({
      email: ADRESSE,
      origine: "libre-service",
      jti: "jti-1",
      ip: "198.51.100.23",
    });
    const data = (journal.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data["action"]).toBe(ACTION_DEMANDE_EFFACEMENT);
    expect(ACTION_DEMANDE_EFFACEMENT.startsWith("gdpr.")).toBe(true);
    expect(data["ipAddress"]).toBe("198.51.100.23");
    expect(JSON.stringify(data)).not.toContain(ADRESSE);
    const changes = data["changes"] as Record<string, unknown>;
    expect(changes["emailHash"]).toBe(hashEmailForLookup(ADRESSE));
    expect(changes["emailSha256"]).toMatch(/^[0-9a-f]{64}$/);
    expect(changes["rienSupprime"]).toBe(true);
  });

  it("🔔 alerte dans la cloche seulement : niveau info, dédoublonnée par personne, jamais Telegram", async () => {
    await ecarterPourDemandeEffacement({
      email: ADRESSE,
      origine: "console-lettre",
      motif: "tél.",
    });
    expect(telegram).not.toHaveBeenCalled();
    const a = alerte.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(a["code"]).toBe(CODE_ALERTE_EFFACEMENT);
    expect(a["niveau"]).toBe("info");
    expect(a["cibleId"]).toBe(hashEmailForLookup(ADRESSE));
    // L'adresse est dans l'alerte : sans elle, la demande ne peut pas être traitée à la main.
    expect(String(a["message"])).toContain(ADRESSE);
    expect(String(a["message"])).toMatch(/Rien n'a été supprimé/);
  });

  it("une étape en panne n'empêche ni la preuve ni l'alerte", async () => {
    contacts.mockRejectedValue(new Error("base"));
    abonnes.mockRejectedValue(new Error("base"));
    const r = await ecarterPourDemandeEffacement({ email: ADRESSE, origine: "libre-service" });
    expect(journal).toHaveBeenCalled();
    expect(alerte).toHaveBeenCalled();
    expect(r.etapesEnEchec).toEqual(expect.arrayContaining(["lettre", "contacts-guide"]));
  });
});
