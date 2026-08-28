// Le rappel H-1 part-il UNE fois, et seulement quand il le doit ?
//
// ## Ce que ce fichier verrouille
//
// Un rappel est un envoi automatique vers l'adresse d'un prospect. Trois façons
// de le rater, et chacune a son cas ci-dessous :
//
//   · il ne part PAS   → la personne oublie le rendez-vous ;
//   · il part TROIS FOIS → la fenêtre (15 min) vaut trois fois la cadence
//     (5 min), donc chaque rendez-vous est vu trois fois. Sans marqueur, trois
//     rappels ;
//   · il part À TORT → à un rendez-vous annulé, ou à une personne qui a demandé
//     l'effacement de ses données.
//
// ## Le cas qui compte le plus
//
// `enqueueEmail` NE LÈVE PAS : elle rend `{ enqueued: false }` quand la file
// refuse. Poser le marqueur d'envoi sur ce retour transformerait un rappel jamais
// parti en rappel réputé envoyé — et interdirait le rattrapage du passage
// suivant. C'est le défaut `D5-1-C1` de ce dépôt, et le cas « refus de mise en
// file » est celui qui l'empêche de revenir.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const update = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: {
      findMany: (...a: unknown[]) => findMany(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));

const enqueueEmail = vi.fn();
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));

import { executerPassage, PASSAGES } from "../rappels-appel";

/**
 * Le passage cherché par son MOMENT, jamais par son index.
 *
 * Un index (`PASSAGES[2]`) rendrait ce fichier vert en testant le mauvais
 * passage le jour où l'ordre du tableau change — et un test vert pour la
 * mauvaise raison est pire qu'un test absent.
 */
function passageDe(moment: "confirmation" | "j1" | "h1") {
  const p = PASSAGES.find((x) => x.moment === moment);
  if (!p) throw new Error(`passage « ${moment} » introuvable dans PASSAGES`);
  return p;
}

/** Les cas historiques portaient sur H-1 ; ils le testent toujours. */
const envoyerRappelsH1 = (now: number) => executerPassage(passageDe("h1"), now);
import { ERASED_PLACEHOLDER } from "@/lib/rgpd-erase";

/** 2026-08-28 10:00:00 UTC — l'horloge est injectée, jamais lue. */
const MAINTENANT = Date.UTC(2026, 7, 28, 10, 0, 0);

/** Un rendez-vous qui commence dans 65 minutes : au cœur de la fenêtre. */
function rdv(over: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    inviteeName: "Camille Dupont",
    inviteeEmail: "camille@example.invalid",
    startTime: new Date(MAINTENANT + 65 * 60_000),
    endTime: new Date(MAINTENANT + 65 * 60_000 + 45 * 60_000),
    location: "+33 7 00 00 00 00",
    cancelUrl: "https://calendly.com/cancellations/abc",
    rescheduleUrl: "https://calendly.com/reschedulings/abc",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([rdv()]);
  update.mockResolvedValue({});
  enqueueEmail.mockResolvedValue({ enqueued: true });
});

describe("envoi", () => {
  it("met le rappel en file et pose le marqueur", async () => {
    const res = await envoyerRappelsH1(MAINTENANT);

    expect(res.ok).toBe(true);
    expect(res.envoyes).toBe(1);
    expect(enqueueEmail).toHaveBeenCalledOnce();
    const [template, destinataire] = enqueueEmail.mock.calls[0] as [string, string];
    expect(template).toBe("appel-rappel");
    expect(destinataire).toBe("camille@example.invalid");
    expect(update).toHaveBeenCalledOnce();
  });

  it("DÉRIVE la durée des deux bornes, au lieu de l'écrire", async () => {
    // C'est exactement le défaut que la page portait : « 30 minutes » recopié
    // pendant que l'event-type en durait 45. Un rappel qui annoncerait une durée
    // écrite en dur referait la même faute, un message plus loin.
    await envoyerRappelsH1(MAINTENANT);
    const charge = (enqueueEmail.mock.calls[0] as unknown[])[3] as { dureeMinutes?: number };
    expect(charge.dureeMinutes).toBe(45);
  });

  it("n'invente pas de durée quand la fin est inconnue", async () => {
    findMany.mockResolvedValue([rdv({ endTime: null })]);
    await envoyerRappelsH1(MAINTENANT);
    const charge = (enqueueEmail.mock.calls[0] as unknown[])[3] as { dureeMinutes?: number };
    expect(charge.dureeMinutes).toBeUndefined();
  });

  it("ne salue pas dans le vide quand le nom manque", async () => {
    // « Bonjour , » a l'air cassé ; « Bonjour, » a l'air sobre.
    findMany.mockResolvedValue([rdv({ inviteeName: null })]);
    await envoyerRappelsH1(MAINTENANT);
    const charge = (enqueueEmail.mock.calls[0] as unknown[])[3] as { prenom?: string };
    expect(charge.prenom).toBe("");
  });
});

describe("idempotence — le cas qui empêche la boucle", () => {
  it("NE POSE PAS le marqueur quand la mise en file est REFUSÉE", async () => {
    // 🔴 LE CAS DÉCISIF. `enqueueEmail` ne lève pas — elle rend `enqueued: false`.
    // Poser le marqueur ici transformerait un rappel jamais parti en rappel
    // réputé envoyé, et le passage suivant ne réessaierait jamais.
    enqueueEmail.mockResolvedValue({ enqueued: false });

    const res = await envoyerRappelsH1(MAINTENANT);

    expect(res.envoyes).toBe(0);
    expect(res.echecs).toBe(1);
    expect(
      update,
      "le marqueur a été posé sur un envoi qui n'a pas eu lieu : le rattrapage est mort",
    ).not.toHaveBeenCalled();
  });

  it("ne pose pas le marqueur non plus quand la mise en file LÈVE", async () => {
    enqueueEmail.mockRejectedValue(new Error("redis down"));
    const res = await envoyerRappelsH1(MAINTENANT);
    expect(res.echecs).toBe(1);
    expect(update).not.toHaveBeenCalled();
  });

  it("ne demande QUE les rendez-vous non encore rappelés", async () => {
    // L'idempotence tient à deux bouts : le marqueur qu'on pose, et le filtre
    // qui l'exploite. Tester le premier sans le second laisserait la boucle
    // possible.
    await envoyerRappelsH1(MAINTENANT);
    const where = (findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    expect(where["rappelEnvoyeAt"]).toBeNull();
  });
});

describe("ce qu'on ne rappelle JAMAIS", () => {
  it("ne cible que les rendez-vous encore programmés", async () => {
    await envoyerRappelsH1(MAINTENANT);
    const where = (findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    // Un rendez-vous annulé, terminé ou marqué absent n'a rien à rappeler.
    expect(where["status"]).toBe("scheduled");
  });

  it("exclut les lignes ANONYMISÉES par une demande d'effacement", async () => {
    // Leur adresse est synthétique (`erased:…@erased.local`) : écrire ferait
    // rebondir un message vers un domaine inexistant, au nom d'une personne qui
    // a précisément demandé qu'on l'oublie.
    await envoyerRappelsH1(MAINTENANT);
    const where = (findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    expect(where["NOT"]).toEqual({ inviteeName: ERASED_PLACEHOLDER });
  });

  it("cherche une fenêtre TROIS FOIS plus large que la cadence du cron", async () => {
    // La passe tourne toutes les 5 min sur une fenêtre de 15 : un passage sauté
    // est rattrapé par les deux suivants. Une fenêtre égale à la cadence perdrait
    // le rappel au premier hoquet — et personne ne le verrait.
    await envoyerRappelsH1(MAINTENANT);
    const where = (findMany.mock.calls[0]?.[0] as { where: { startTime: { gte: Date; lt: Date } } })
      .where;
    const largeurMin = (where.startTime.lt.getTime() - where.startTime.gte.getTime()) / 60_000;
    expect(largeurMin).toBe(15);
    expect((where.startTime.gte.getTime() - MAINTENANT) / 60_000).toBe(60);
  });
});

describe("le plafond ne tronque jamais en silence", () => {
  it("signale quand il a mordu", async () => {
    // Il ne protège pas d'un volume réel — il n'y a jamais 50 appels dans le même
    // quart d'heure. Il protège d'un emballement : si le marqueur cessait d'être
    // posé, la passe rejouerait la même liste toutes les 5 minutes.
    findMany.mockResolvedValue(Array.from({ length: 51 }, (_, i) => rdv({ id: `evt_${i}` })));
    const res = await envoyerRappelsH1(MAINTENANT);
    expect(res.plafondAtteint).toBe(true);
    expect(res.candidats).toBe(50);
  });

  it("ne signale rien quand il ne mord pas", async () => {
    const res = await envoyerRappelsH1(MAINTENANT);
    expect(res.plafondAtteint).toBeUndefined();
  });
});

describe("un cron ne rougit pas parce que la base a hoqueté", () => {
  it("rend un échec nommé au lieu de lever", async () => {
    findMany.mockRejectedValue(new Error("connection reset"));
    const res = await envoyerRappelsH1(MAINTENANT);
    expect(res.ok).toBe(false);
    expect(res.raison).toContain("db_read_failed");
    expect(res.envoyes).toBe(0);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Les trois moments (2026-08-28)
// ─────────────────────────────────────────────────────────────────────────────

describe("les trois moments partagent un cœur, pas un marqueur", () => {
  it("chaque moment a son PROPRE nom de job et son PROPRE marqueur", () => {
    // 🔴 LE CAS QUI PROTÈGE LE PLUS. Un marqueur partagé ferait taire les deux
    // derniers moments : le premier envoi le poserait, et les passages suivants
    // ne verraient plus aucun candidat. Le défaut serait SILENCIEUX — aucune
    // erreur, simplement deux e-mails qui ne partent jamais.
    const jobs = PASSAGES.map((p) => p.job);
    const marqueurs = PASSAGES.map((p) => p.marqueur);
    expect(new Set(jobs).size, "deux moments partagent un nom de job").toBe(PASSAGES.length);
    expect(new Set(marqueurs).size, "deux moments partagent un marqueur").toBe(PASSAGES.length);
  });

  it("la confirmation part SANS fenêtre, mais jamais vers le passé", async () => {
    findMany.mockResolvedValue([rdv()]);
    await executerPassage(passageDe("confirmation"), MAINTENANT);

    const where = (findMany.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;
    // Pas de `gte`/`lt` : aucune fenêtre. Mais une borne basse stricte, sinon
    // l'ajout de la colonne à NULL écrirait à TOUT l'historique passé.
    expect(where.startTime).toEqual({ gt: new Date(MAINTENANT) });
    expect(where).toHaveProperty("confirmationEnvoyeeAt", null);
  });

  it("le rappel J-1 vise 24 h → 24 h 15, pas la même fenêtre que H-1", async () => {
    await executerPassage(passageDe("j1"), MAINTENANT);
    const where = (findMany.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;
    expect(where.startTime).toEqual({
      gte: new Date(MAINTENANT + 1440 * 60_000),
      lt: new Date(MAINTENANT + 1455 * 60_000),
    });
    expect(where).toHaveProperty("rappelJ1EnvoyeAt", null);
  });

  it("transmet le MOMENT au gabarit — sans lui, il rendrait le titre H-1", async () => {
    // Le gabarit a `moment = "h1"` par défaut (pour les jobs déjà en file avant
    // cette version). Une confirmation qui n'enverrait pas son moment porterait
    // donc « Votre appel a lieu dans une heure » — pour un rendez-vous dans
    // trois semaines.
    await executerPassage(passageDe("confirmation"), MAINTENANT);
    const charge = (enqueueEmail.mock.calls[0] as unknown[])[3] as { moment?: string };
    expect(charge.moment).toBe("confirmation");
  });

  it("la confirmation cite la DATE, les rappels ne la citent pas", async () => {
    await executerPassage(passageDe("confirmation"), MAINTENANT);
    const conf = (enqueueEmail.mock.calls[0] as unknown[])[3] as { date?: string };
    expect(conf.date, "une confirmation sans date oblige à ouvrir Calendly").toBeTruthy();

    vi.clearAllMocks();
    findMany.mockResolvedValue([rdv()]);
    enqueueEmail.mockResolvedValue({ enqueued: true });
    await executerPassage(passageDe("h1"), MAINTENANT);
    const h1 = (enqueueEmail.mock.calls[0] as unknown[])[3] as { date?: string };
    expect(h1.date, "répéter la date à une heure de l'appel est du bruit").toBeUndefined();
  });

  it("les trois portent les liens d'annulation et de report", async () => {
    // Un message qui ne permet pas de se décommander produit des absences
    // plutôt que des reports. Aux TROIS moments, pas seulement au dernier.
    for (const moment of ["confirmation", "j1", "h1"] as const) {
      vi.clearAllMocks();
      findMany.mockResolvedValue([rdv()]);
      enqueueEmail.mockResolvedValue({ enqueued: true });
      await executerPassage(passageDe(moment), MAINTENANT);
      const charge = (enqueueEmail.mock.calls[0] as unknown[])[3] as Record<string, unknown>;
      expect(charge.cancelUrl, `${moment} : pas de lien d'annulation`).toBeTruthy();
      expect(charge.rescheduleUrl, `${moment} : pas de lien de report`).toBeTruthy();
    }
  });
});
