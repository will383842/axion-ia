/**
 * Tests — journal des envois, pose et clôture (audit du 2026-08-16).
 *
 * Ce module porte l'invariant sur lequel repose toute la surveillance neuve :
 * **une ligne restée `pending` signale une chaîne rompue.** Cet invariant n'a de
 * valeur que si les deux versants tiennent, et chacun casse d'une façon
 * différente :
 *
 *   - si la pose manque, on retombe dans le défaut d'origine — un worker mort
 *     ne laisse aucune trace, et « 0 échec » redevient indistinguable de
 *     « rien à envoyer » ;
 *   - si la clôture manque, la surveillance crie sur son propre bruit, et une
 *     alerte critique qui se déclenche pour rien est désarmée en trois jours.
 *
 * S'y ajoute une propriété non négociable : **journaliser ne doit jamais
 * empêcher d'envoyer.** Une base indisponible dégrade la traçabilité, elle ne
 * doit pas retenir une convocation ni, pire, faire rejouer un envoi déjà parti.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirstMock = vi.fn();
const createMock = vi.fn();
const updateManyMock = vi.fn();
const verrouMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/prisma", () => {
  const prisma = {
    emailLog: {
      findFirst: (...a: unknown[]) => findFirstMock(...a),
      create: (...a: unknown[]) => createMock(...a),
      updateMany: (...a: unknown[]) => updateManyMock(...a),
    },
    $executeRaw: (...a: unknown[]) => verrouMock(...a),
    // La transaction passe le même client : l'ordre des appels se lit sur les doublures.
    $transaction: (f: (tx: unknown) => unknown) => {
      transactionMock();
      return f(prisma);
    },
  };
  return { prisma };
});

import {
  journaliserEnAttente,
  cloturerJournal,
  noterTentativeEchouee,
  marquerAnnule,
  marquerEchecMiseEnFile,
} from "./email-log";
import { EmailLogStatus } from "../../../prisma/generated/client";

const BASE = {
  template: "qualiopi-convocation",
  recipient: "stagiaire@exemple.fr",
  locale: "fr" as const,
  marketing: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["DATABASE_URL"];
  findFirstMock.mockResolvedValue(null);
  createMock.mockResolvedValue({ id: "log-1" });
  verrouMock.mockResolvedValue(1);
  updateManyMock.mockResolvedValue({ count: 1 });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("journaliserEnAttente — la trace posée à l'enfilage", () => {
  it("écrit une ligne `pending` à 0 tentative", async () => {
    await journaliserEnAttente({ ...BASE, jobId: "job-1", cleAppelant: true });
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        template: BASE.template,
        recipient: BASE.recipient,
        status: EmailLogStatus.pending,
        attempts: 0,
        jobId: "job-1",
      }),
      select: { id: true },
    });
  });

  // 🔴 Le piège de l'idempotence Qualiopi : `enqueueEmail` passe un jobId stable
  // (`qualiopi-convocation-{id}-{date}`) et BullMQ IGNORE un `add()` portant un
  // jobId déjà connu. Sans cette garde, chaque passage horaire du cron
  // déposerait une ligne `pending` fantôme pour un job jamais réenfilé — et la
  // surveillance alerterait sur un envoi parti depuis longtemps.
  it("ne repose pas de ligne quand le jobId est déjà connu", async () => {
    findFirstMock.mockResolvedValue({ id: "log-existant" });
    await journaliserEnAttente({
      ...BASE,
      jobId: "qualiopi-convocation-42-2026-08-16",
      cleAppelant: true,
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  // Vérification n° 2 (V2P4) — file injoignable puis rétablie : la relance formateur
  // réenfilée sous sa clé reprend SA ligne « échec », remise « en attente ».
  it("V2P4 : relance formateur réenfilée après un échec de mise en file : la ligne redevient en attente", async () => {
    findFirstMock.mockResolvedValue({ id: "log-echec", status: EmailLogStatus.failed });
    expect(
      await journaliserEnAttente({
        ...BASE,
        jobId: "fi-contrat-relance-t-o-j3",
        cleAppelant: true,
      }),
    ).toBe("log-echec");
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: "log-echec", status: EmailLogStatus.failed },
      data: expect.objectContaining({ status: EmailLogStatus.pending, attempts: 0, error: null }),
    });
    expect(createMock).not.toHaveBeenCalled();
  });
  it("V2P4 : hors relance formateur, ou ligne non en échec : rien n'est reposé (règle d'avant)", async () => {
    findFirstMock.mockResolvedValue({ id: "log-echec", status: EmailLogStatus.failed });
    expect(
      await journaliserEnAttente({ ...BASE, jobId: "relance-invitation-42-j2", cleAppelant: true }),
    ).toBe(null);
    findFirstMock.mockResolvedValue({ id: "log-parti", status: EmailLogStatus.sent });
    expect(
      await journaliserEnAttente({
        ...BASE,
        jobId: "fi-contrat-relance-t-o-j3",
        cleAppelant: true,
      }),
    ).toBe(null);
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  // V1-C-11 — la ligne est désormais posée AVANT la mise en file, et deux enfilages
  // concurrents du même jobId (deux passages qui se chevauchent) ne doivent pas en poser
  // deux : la lecture et l'écriture se font sous un verrou propre à ce jobId.
  it("V1-C-11 : lit puis écrit sous un verrou transactionnel propre au jobId", async () => {
    const ordre: string[] = [];
    verrouMock.mockImplementation(async () => ordre.push("verrou"));
    findFirstMock.mockImplementation(async () => (ordre.push("lecture"), null));
    createMock.mockImplementation(async () => (ordre.push("ecriture"), { id: "log-1" }));
    expect(await journaliserEnAttente({ ...BASE, jobId: "job-1", cleAppelant: true })).toBe(
      "log-1",
    );
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(ordre).toEqual(["verrou", "lecture", "ecriture"]);
    const [gabarit, ...valeurs] = verrouMock.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(gabarit.join("?")).toContain("pg_advisory_xact_lock");
    expect(valeurs).toEqual(["email_log:job-1"]);
  });

  it("V1-C-11 : rend l'id de la ligne posée (null si elle existait, ou base muette)", async () => {
    findFirstMock.mockResolvedValue({ id: "log-existant" });
    expect(await journaliserEnAttente({ ...BASE, jobId: "job-1", cleAppelant: true })).toBe(null);
    findFirstMock.mockResolvedValue(null);
    expect(await journaliserEnAttente({ ...BASE, jobId: "job-1", cleAppelant: true })).toBe(
      "log-1",
    );
    createMock.mockRejectedValue(new Error("connexion perdue"));
    expect(await journaliserEnAttente({ ...BASE, jobId: "job-1", cleAppelant: true })).toBe(null);
  });

  // Relecture #1537, point 3 — un identifiant fabriqué (`email-<uuid>`) ne peut entrer en
  // concurrence avec personne : ni transaction, ni verrou, ni lecture.
  it("identifiant fabriqué (pas de clé de l'appelant) : création directe, sans verrou", async () => {
    expect(await journaliserEnAttente({ ...BASE, jobId: "email-abc" })).toBe("log-1");
    expect(transactionMock).not.toHaveBeenCalled();
    expect(verrouMock).not.toHaveBeenCalled();
    expect(findFirstMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ jobId: "email-abc", status: EmailLogStatus.pending }),
      select: { id: true },
    });
  });

  it("ne cherche pas de doublon en l'absence de jobId", async () => {
    await journaliserEnAttente({ ...BASE });
    expect(findFirstMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("reste muette au build (base stub)", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    await journaliserEnAttente({ ...BASE, jobId: "job-1" });
    expect(findFirstMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  // Fail-soft : une base indisponible dégrade la traçabilité, elle ne doit pas
  // retenir l'envoi. `enqueueEmail` attend cette promesse — si elle levait, la
  // convocation ne partirait pas parce que son journal n'a pas pu s'écrire.
  it("n'échoue pas quand la base refuse l'écriture", async () => {
    createMock.mockRejectedValue(new Error("connexion perdue"));
    await expect(
      journaliserEnAttente({ ...BASE, jobId: "job-1", cleAppelant: true }),
    ).resolves.toBe(null);
    await expect(journaliserEnAttente({ ...BASE, jobId: "email-abc" })).resolves.toBe(null);
  });
});

describe("cloturerJournal — la ligne que le worker referme", () => {
  it("clôt la ligne en attente au lieu d'en créer une seconde", async () => {
    await cloturerJournal({
      ...BASE,
      jobId: "job-1",
      attempts: 1,
      status: EmailLogStatus.sent,
      providerMessageId: "<abc@zoho>",
      sentAt: new Date("2026-08-16T09:00:00.000Z"),
    });

    expect(updateManyMock).toHaveBeenCalledWith({
      where: { jobId: "job-1", status: { not: EmailLogStatus.sent } },
      data: expect.objectContaining({ status: EmailLogStatus.sent, attempts: 1 }),
    });
    // Le point entier du chantier : une ligne par envoi, close — pas deux, dont
    // une éternellement `pending` qui ferait crier la surveillance.
    expect(createMock).not.toHaveBeenCalled();
  });

  it("clôt aussi un échec, avec son motif et sa date", async () => {
    await cloturerJournal({
      ...BASE,
      jobId: "job-1",
      attempts: 2,
      status: EmailLogStatus.failed,
      error: "535 authentification refusée",
      failedAt: new Date("2026-08-16T09:00:00.000Z"),
    });
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { jobId: "job-1", status: { not: EmailLogStatus.sent } },
      data: expect.objectContaining({
        status: EmailLogStatus.failed,
        error: "535 authentification refusée",
      }),
    });
  });

  // Une tentative n° 2 ne trouve plus de ligne en attente : celle de la
  // tentative n° 1 est déjà close en `failed`. On crée donc une ligne — c'est le
  // comportement historique, une ligne par tentative, et il est voulu.
  it("crée une ligne quand aucune ligne en attente ne correspond", async () => {
    updateManyMock.mockResolvedValue({ count: 0 });
    await cloturerJournal({
      ...BASE,
      jobId: "job-1",
      attempts: 2,
      status: EmailLogStatus.sent,
      sentAt: new Date(),
    });
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: EmailLogStatus.sent, attempts: 2, jobId: "job-1" }),
    });
  });

  it("crée une ligne en l'absence de jobId, sans tenter de clôture", async () => {
    await cloturerJournal({
      ...BASE,
      attempts: 1,
      status: EmailLogStatus.sent,
      sentAt: new Date(),
    });
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("reste muette au build (base stub)", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    await cloturerJournal({
      ...BASE,
      jobId: "job-1",
      attempts: 1,
      status: EmailLogStatus.sent,
      sentAt: new Date(),
    });
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  // 🔴 Le fail-soft le plus coûteux à perdre. Le worker `await` cette fonction
  // APRÈS un envoi réussi : si elle levait, BullMQ compterait le job en échec et
  // le rejouerait — le stagiaire recevrait sa convocation en double parce que le
  // journal n'a pas pu s'écrire.
  it("n'échoue jamais après un envoi réussi, même base morte", async () => {
    updateManyMock.mockRejectedValue(new Error("connexion perdue"));
    createMock.mockRejectedValue(new Error("connexion perdue"));
    await expect(
      cloturerJournal({
        ...BASE,
        jobId: "job-1",
        attempts: 1,
        status: EmailLogStatus.sent,
        sentAt: new Date(),
      }),
    ).resolves.toBeUndefined();
  });
});

describe("lot 2 — une ligne par job", () => {
  it("🔴 clôt la ligne du job même après une tentative ratée (statut ≠ envoyé), sans en créer une seconde", async () => {
    updateManyMock.mockResolvedValue({ count: 1 });
    await cloturerJournal({
      ...BASE,
      jobId: "job-1",
      attempts: 2,
      status: EmailLogStatus.sent,
      sentAt: new Date(),
    });
    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobId: "job-1", status: { not: EmailLogStatus.sent } },
      }),
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it("une tentative ratée non définitive note la tentative et le motif, la ligne reste « en attente »", async () => {
    await noterTentativeEchouee({ ...BASE, jobId: "job-1", attempts: 1, error: "SMTP 421" });
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { jobId: "job-1", status: EmailLogStatus.pending },
      data: { attempts: 1, error: "SMTP 421" },
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("sans jobId, une tentative ratée ne touche à rien", async () => {
    await noterTentativeEchouee({ ...BASE, attempts: 1, error: "x" });
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("n'échoue jamais le worker quand la base refuse la note", async () => {
    updateManyMock.mockRejectedValue(new Error("base morte"));
    await expect(
      noterTentativeEchouee({ ...BASE, jobId: "job-1", attempts: 1, error: "x" }),
    ).resolves.toBeUndefined();
  });
});

/**
 * 🔴 Le troisième versant de l'invariant, découvert le 2026-09-09.
 *
 * Une ligne `pending` signale une chaîne rompue — sauf quand le job a été
 * ANNULÉ. Le worker clôt à l'exécution ; un job annulé n'est jamais exécuté, et
 * sa ligne restait ouverte POUR TOUJOURS. C'est le seul cas où la pose est
 * juste, la clôture légitime, et pourtant personne ne referme.
 */
// Relecture #1537, point bloquant 1 — file injoignable : la ligne posée par l'enfilage est
// close en ÉCHEC (retentable), jamais « annulé » (compté comme déjà tenté), et visée par
// son `id`, jamais par le seul `jobId`.
describe("marquerEchecMiseEnFile", () => {
  it("clôt en `failed`, par son id, et seulement si elle est encore « en attente »", async () => {
    await expect(marquerEchecMiseEnFile("log-7", "Mise en file impossible")).resolves.toBe(1);
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: "log-7", status: EmailLogStatus.pending },
      data: {
        status: EmailLogStatus.failed,
        error: "Mise en file impossible",
        failedAt: expect.any(Date),
      },
    });
  });

  it("n'échoue pas quand la base refuse, et reste muette au build", async () => {
    updateManyMock.mockRejectedValue(new Error("connexion perdue"));
    await expect(marquerEchecMiseEnFile("log-7", "motif")).resolves.toBe(0);
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    updateManyMock.mockClear();
    await expect(marquerEchecMiseEnFile("log-7", "motif")).resolves.toBe(0);
    expect(updateManyMock).not.toHaveBeenCalled();
  });
});

describe("marquerAnnule", () => {
  beforeEach(() => {
    updateManyMock.mockReset();
    updateManyMock.mockResolvedValue({ count: 1 });
    delete process.env["DATABASE_URL"];
  });

  it("NE TOUCHE QUE les lignes encore en attente — un envoi parti n'est jamais réécrit", async () => {
    // 🔑 La garde décisive. `remove()` rend 0 aussi bien pour « job déjà
    // retiré » que pour « job déjà PARTI ». Sans la borne `status: pending`, on
    // réécrirait en « annulé » un e-mail réellement envoyé : on détruirait la
    // preuve d'un envoi, sur un journal qui sert d'abord à ça.
    await marquerAnnule("job-42", "motif");
    const where = updateManyMock.mock.calls[0]?.[0]?.where;
    expect(where).toEqual({ jobId: "job-42", status: EmailLogStatus.pending });
  });

  it("écrit l'état « annulé » ET le motif — une ligne close sans raison n'apprend rien", async () => {
    await marquerAnnule("job-42", "Relance annulée : le dossier complet est arrivé.");
    const data = updateManyMock.mock.calls[0]?.[0]?.data;
    expect(data?.status).toBe(EmailLogStatus.cancelled);
    expect(data?.error).toMatch(/dossier complet/i);
  });

  it("rend le nombre de lignes refermées", async () => {
    updateManyMock.mockResolvedValue({ count: 0 });
    await expect(marquerAnnule("job-deja-clos", "motif")).resolves.toBe(0);
  });

  it("ne LÈVE JAMAIS : une panne du journal ne doit pas faire échouer l'annulation", async () => {
    // Même contrat que le reste du module. L'annulation protège une personne
    // d'une relance inutile ; elle ne doit pas dépendre de la base.
    updateManyMock.mockRejectedValue(new Error("postgres indisponible"));
    await expect(marquerAnnule("job-42", "motif")).resolves.toBe(0);
  });

  it("ne touche à rien quand la base est le stub de build", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    await expect(marquerAnnule("job-42", "motif")).resolves.toBe(0);
    expect(updateManyMock).not.toHaveBeenCalled();
  });
});
