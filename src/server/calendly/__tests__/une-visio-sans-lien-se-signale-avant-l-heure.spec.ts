// @vitest-environment node

/**
 * Verrou — un rendez-vous en visioconférence qui approche sans lien de
 * connexion se signale une heure avant, et pas au moment de se connecter.
 *
 * ## Le trou que ce témoin ferme
 *
 * Calendly crée la conférence de façon **asynchrone**, et le lien peut ne jamais
 * arriver : connexion Google Agenda expirée, quota, panne de leur côté. Dans ce
 * cas, jusqu'au 2026-09-01, il ne se passait strictement rien. Le rendez-vous
 * existait, les trois e-mails partaient, et le vide se découvrait **à l'heure du
 * rendez-vous, des deux côtés en même temps** — le prospect qui cherche où
 * cliquer, l'hôte qui attend dans une réunion vide.
 *
 * Un `grep` sur tout le dépôt le confirmait : personne ne lisait l'état de
 * création du lien.
 *
 * ## Pourquoi à H-1, et pas plus tôt
 *
 * Deux raisons, et elles vont dans le même sens :
 *
 * - c'est le **dernier moment où l'on peut encore agir** — envoyer un lien à la
 *   main, ou basculer sur un appel ;
 * - c'est celui où l'absence devient **certaine plutôt que probable** :
 *   `refreshUpcomingCalendlyEvents` a eu des dizaines de passages pour poser le
 *   lien depuis la réservation. Alerter à J-1 se tromperait souvent.
 *
 * ## Ce que l'alerte NE fait pas
 *
 * Elle n'empêche pas l'e-mail de partir. Le rappel renvoie vers l'invitation
 * d'agenda, qui portera le lien s'il finit par exister — **alerter n'est pas
 * retenir**. Un rappel supprimé serait une seconde panne ajoutée à la première.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const update = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { calendlyEvent: { findMany, update } },
}));

const enqueueEmail = vi.fn();
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));

const notify = vi.fn();
vi.mock("@/server/notifications", () => ({ notify: (...a: unknown[]) => notify(...a) }));

const { executerPassage, PASSAGES } = await import("../rappels-appel");

function passageDe(moment: "confirmation" | "j1" | "h1") {
  const p = PASSAGES.find((x) => x.moment === moment);
  if (!p) throw new Error(`passage ${moment} introuvable`);
  return p;
}

/** Un rendez-vous dans une heure. */
function rdv(over: Record<string, unknown> = {}) {
  const debut = new Date(Date.now() + 65 * 60_000);
  return {
    id: "evt_visio",
    inviteeName: "Camille Prospect",
    inviteeEmail: "camille@exemple.test",
    startTime: debut,
    endTime: new Date(debut.getTime() + 45 * 60_000),
    location: null,
    rawPayload: { event: { location: { type: "google_conference", status: "processing" } } },
    cancelUrl: null,
    rescheduleUrl: null,
    ...over,
  };
}

/** Les alertes « visio sans lien » réellement émises. */
function alertes(): Array<Record<string, unknown>> {
  return notify.mock.calls
    .map((c) => c[0] as Record<string, unknown>)
    .filter((e) => {
      const p = e["payload"] as Record<string, unknown> | undefined;
      return p?.["kind"] === "visio_sans_lien";
    });
}

beforeEach(() => {
  vi.clearAllMocks();
  enqueueEmail.mockResolvedValue({ enqueued: true });
  update.mockResolvedValue({});
  notify.mockResolvedValue({ ok: true, channels: {} });
});

describe("une visio sans lien se signale avant l'heure", () => {
  it("🔴 à H-1, une visio dont le lien manque déclenche une alerte", async () => {
    findMany.mockResolvedValue([rdv()]);
    await executerPassage(passageDe("h1"));

    const a = alertes();
    expect(a.length, "aucune alerte : le vide se découvrira au moment de se connecter").toBe(1);
    expect(a[0]?.["severity"]).toBe("critical");
  });

  it("🔑 le rappel part QUAND MÊME — alerter n'est pas retenir", async () => {
    // Supprimer l'e-mail ajouterait une seconde panne à la première : le
    // prospect n'aurait ni lien, ni rappel. Il est renvoyé vers l'invitation
    // d'agenda, qui portera le lien s'il finit par exister.
    findMany.mockResolvedValue([rdv()]);
    await executerPassage(passageDe("h1"));
    expect(enqueueEmail).toHaveBeenCalledOnce();
  });

  it("🔑 CONTRE-TÉMOIN : une visio AVEC son lien n'alerte pas", async () => {
    // Sans ce cas, l'alerte pourrait se déclencher sur tous les rendez-vous en
    // visio et deviendrait du bruit — donc ignorée, donc inutile.
    findMany.mockResolvedValue([
      rdv({
        location: "https://meet.google.com/dsy-azza-wwv",
        rawPayload: {
          event: { location: { type: "google_conference", status: "pushed" } },
        },
      }),
    ]);
    await executerPassage(passageDe("h1"));
    expect(alertes(), "une visio normale ne doit rien déclencher").toEqual([]);
  });

  it("🔑 CONTRE-TÉMOIN : un appel téléphonique n'alerte jamais", async () => {
    // Un appel n'a pas de lien, et c'est normal. Confondre les deux rendrait
    // l'alerte quotidienne — vos 19 réservations sont toutes téléphoniques.
    findMany.mockResolvedValue([
      rdv({
        location: "+33 6 11 22 33 44",
        rawPayload: { event: { location: { type: "outbound_call" } } },
      }),
    ]);
    await executerPassage(passageDe("h1"));
    expect(alertes()).toEqual([]);
  });

  it("🔴 à J-1, on n'alerte PAS — le lien a encore le temps d'arriver", async () => {
    // `refresh` repasse toutes les 10 minutes. Alerter vingt-quatre heures
    // avant se tromperait la plupart du temps, et une alerte qui se trompe
    // souvent finit par ne plus être lue.
    const debut = new Date(Date.now() + 24 * 60 * 60_000 + 5 * 60_000);
    findMany.mockResolvedValue([
      rdv({ startTime: debut, endTime: new Date(debut.getTime() + 45 * 60_000) }),
    ]);
    await executerPassage(passageDe("j1"));
    expect(alertes()).toEqual([]);
  });

  it("🔑 CONTRE-TÉMOIN : le harnais exerce bien le passage", async () => {
    // Si `executerPassage` cessait d'appeler la mise en file — filtre de
    // sélection changé, garde ajoutée — tous les tests ci-dessus passeraient
    // en ne mesurant plus rien.
    findMany.mockResolvedValue([rdv()]);
    await executerPassage(passageDe("h1"));
    expect(findMany, "le passage doit lire la base").toHaveBeenCalled();
    expect(enqueueEmail, "le passage doit mettre un e-mail en file").toHaveBeenCalled();
  });
});
