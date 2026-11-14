// @vitest-environment node
/**
 * DÉCISION DE WILLIAMS DU 11/11/2026 — une demande d'effacement ne supprime plus rien.
 *
 * La personne est MISE À L'ÉCART : plus aucun envoi, plus aucune réinscription par un nouvel
 * accord. Ses données sont GARDÉES. Williams reçoit une alerte dans la cloche (niveau `info` :
 * jamais d'e-mail groupé, jamais de Telegram) avec la demande à traiter à la main.
 */
import { cibleIdAlerteDepuisEmpreinte } from "@/server/rgpd/constantes";
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
const alerteTrouvee = vi.fn();
const alerteMiseAJour = vi.fn();

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
    alerteSysteme: {
      findFirst: (...a: unknown[]) => alerteTrouvee(...a),
      update: (...a: unknown[]) => alerteMiseAJour(...a),
    },
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
  echeanceUnMois,
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
    alerteTrouvee,
    alerteMiseAJour,
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

describe("échéance : un mois calendaire, jour de Paris", () => {
  it.each([
    ["2027-02-01T10:00:00Z", "2027-03-01"],
    ["2027-01-31T10:00:00Z", "2027-02-28"],
    ["2026-11-14T10:00:00Z", "2026-12-14"],
    ["2026-12-31T23:30:00Z", "2027-02-01"], // 00 h 30 le 1er janvier à Paris
  ])("reçue %s → %s", (recu, attendu) => {
    expect(echeanceUnMois(new Date(recu))).toBe(attendu);
  });
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

  it("🔴 message privé (adresse non prouvée) : ni lettre ni rapports avant audit, seulement les contacts", async () => {
    await ecarterPourDemandeEffacement({ email: ADRESSE, origine: "message-prive" });
    expect(abonnes).not.toHaveBeenCalled();
    expect(rapports).not.toHaveBeenCalled();
    expect(contacts).toHaveBeenCalledWith(ADRESSE);
  });

  it("console (après vérification) : lettre et rapports avant audit sont mis à l'écart", async () => {
    await ecarterPourDemandeEffacement({ email: ADRESSE, origine: "console" });
    expect(abonnes).toHaveBeenCalledTimes(1);
    expect(rapports).toHaveBeenCalledWith(ADRESSE, expect.any(Date));
  });

  it("le site n'envoie PAS de demande d'effacement au CRM (l'opposition le prévient)", async () => {
    await ecarterPourDemandeEffacement({ email: ADRESSE, origine: "libre-service" });
    expect(crm).not.toHaveBeenCalled();
  });

  it("🔒 le module et ses imports directs n'effacent rien (erase, deleteMany, DELETE)", () => {
    const racine = process.cwd();
    const lire = (f: string) => readFileSync(join(racine, f), "utf8");
    const sourceModule = lire("src/server/rgpd/ecarter-au-lieu-d-effacer.ts");
    const imports = [...sourceModule.matchAll(/from\s+"@\/([^"]+)"/g)]
      .map((m) => m[1] as string)
      .filter((c) => !c.startsWith("lib/prisma") && c !== "lib/rgpd-erase")
      .map((c) => `src/${c}.ts`)
      .filter((f) => existsSync(join(racine, f)));
    // `rgpd-erase` garde ses effaceurs (outil du geste humain) : seule la fonction d'écart passe.
    const deRgpdErase = sourceModule.match(/import\s*\{([^}]*)\}\s*from\s*"@\/lib\/rgpd-erase"/);
    expect(sourceModule).not.toMatch(/import\s*\*\s*as\s+\w+\s+from\s*"@\/lib\/rgpd-erase"/);
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

  it("🔔 alerte « à traiter » : niveau critique, dédoublonnée par personne, jamais Telegram", async () => {
    await ecarterPourDemandeEffacement({
      email: ADRESSE,
      origine: "console-lettre",
      motif: "tél.",
    });
    expect(telegram).not.toHaveBeenCalled();
    const a = alerte.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(a["code"]).toBe(CODE_ALERTE_EFFACEMENT);
    expect(a["niveau"]).toBe("critique");
    expect(a["cibleId"]).toBe(cibleIdAlerteDepuisEmpreinte(hashEmailForLookup(ADRESSE)!));
    // 🔴 `critique` part par e-mail : ni l'adresse ni le motif libre dans le texte.
    expect(JSON.stringify(a)).not.toContain(ADRESSE);
    expect(JSON.stringify(a)).not.toContain("tél.");
    expect(String(a["message"])).toMatch(/AVANT LE \d{4}-\d{2}-\d{2}/);
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

  it("🔑 2e demande dédoublonnée : son journalId est ajouté à l'alerte existante (elle se ferme avec elle)", async () => {
    alerte.mockResolvedValue(null); // creerOuDedup : alerte déjà ouverte, rien de créé
    alerteTrouvee.mockResolvedValue({ id: "al-1", metadata: { journalId: "j0", origine: "x" } });
    alerteMiseAJour.mockResolvedValue({});
    journal.mockResolvedValue({ id: "j2" });
    await ecarterPourDemandeEffacement({ email: ADRESSE, origine: "console-lettre" });
    const lu = alerteTrouvee.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(lu.where["code"]).toBe(CODE_ALERTE_EFFACEMENT);
    expect(lu.where["cibleId"]).toBe(cibleIdAlerteDepuisEmpreinte(hashEmailForLookup(ADRESSE)!));
    const maj = alerteMiseAJour.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { metadata: Record<string, unknown> };
    };
    expect(maj.where.id).toBe("al-1");
    expect(maj.data.metadata["journalId"]).toBe("j0");
    expect(maj.data.metadata["journalIds"]).toEqual(["j2"]);
  });

  it("deux clics console le même jour : les deux traces finissent sur la même alerte", async () => {
    alerte.mockResolvedValue(null);
    alerteTrouvee.mockResolvedValue({
      id: "al-1",
      metadata: { journalId: "j0", journalIds: ["j2"] },
    });
    alerteMiseAJour.mockResolvedValue({});
    journal.mockResolvedValue({ id: "j3" });
    await ecarterPourDemandeEffacement({ email: ADRESSE, origine: "console-lettre" });
    const maj = alerteMiseAJour.mock.calls[0]?.[0] as {
      data: { metadata: Record<string, unknown> };
    };
    expect(maj.data.metadata["journalIds"]).toEqual(["j2", "j3"]);
  });

  it("alerte créée normalement : aucune mise à jour", async () => {
    await ecarterPourDemandeEffacement({ email: ADRESSE, origine: "libre-service" });
    expect(alerteMiseAJour).not.toHaveBeenCalled();
  });

  it("🔴 message privé : opposition, trace et alerte posées, marque NON posée (adresse non prouvée)", async () => {
    const r = await ecarterPourDemandeEffacement({ email: ADRESSE, origine: "message-prive" });
    expect(opposition).toHaveBeenCalled();
    expect(marque).not.toHaveBeenCalled();
    expect(creerOpposition).not.toHaveBeenCalled();
    expect(r.marque).toBe("non_posee");
    const data = (journal.mock.calls[0]?.[0] as { data: { changes: Record<string, unknown> } })
      .data;
    expect(data.changes["marque"]).toBe("non_posee");
    const a = alerte.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(String(a["message"])).toMatch(/Mettre une adresse à l'écart/);
  });

  it("console (adresse vérifiée par Williams) : la marque est posée, comme pour le site", async () => {
    const r = await ecarterPourDemandeEffacement({
      email: ADRESSE,
      origine: "console",
      motif: "demande reçue par e-mail",
    });
    expect(marque).toHaveBeenCalled();
    expect(r.marque).toBe("ok");
    expect(opposition).toHaveBeenCalledWith(ADRESSE, { origine: "effacement-console" });
  });

  it("🔑 la référence est TOUJOURS dans changes.reference, même au format UUID", async () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    await ecarterPourDemandeEffacement({
      email: ADRESSE,
      origine: "message-prive",
      cible: { type: "message_prive", id: uuid },
    });
    const data = (
      journal.mock.calls[0]?.[0] as {
        data: { targetId: string | null; changes: Record<string, unknown> };
      }
    ).data;
    expect(data.changes["reference"]).toBe(uuid);
    expect(data.targetId).toBe(uuid);
  });

  it("🔑 une alerte déjà RÉSOLUE n'absorbe jamais une nouvelle demande : la recherche ne vise que les alertes ouvertes", async () => {
    alerte.mockResolvedValue(null);
    alerteTrouvee.mockResolvedValue(null);
    await ecarterPourDemandeEffacement({ email: ADRESSE, origine: "console-lettre" });
    const lu = alerteTrouvee.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(lu.where["resolue"]).toBe(false);
    expect(lu.where["OR"]).toBeUndefined();
    expect(alerteMiseAJour).not.toHaveBeenCalled();
  });

  it("le message d'alerte porte la référence de la trace : deux demandes du même jour ne sont jamais identiques", async () => {
    journal.mockResolvedValueOnce({ id: "j-A" }).mockResolvedValueOnce({ id: "j-B" });
    await ecarterPourDemandeEffacement({ email: ADRESSE, origine: "console-lettre", motif: "m" });
    await ecarterPourDemandeEffacement({ email: ADRESSE, origine: "console-lettre", motif: "m" });
    const [m1, m2] = alerte.mock.calls.map((c) => String((c[0] as { message: string }).message));
    expect(m1).toContain("Réf. j-A");
    expect(m2).toContain("Réf. j-B");
    expect(m1).not.toBe(m2);
  });
});
