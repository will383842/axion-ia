// @vitest-environment node
//
// Rattrapage horaire du guide (lot L2, modèle ADR 0050). Les cas qui comptent
// sont ceux où il ne doit RIEN faire : un guide reçu deux fois vaut moins que
// zéro, et un rattrapage qui tourne pendant une rafale de rebonds l'aggrave.

import { describe, it, expect, vi, beforeEach } from "vitest";

const guideFindMany = vi.fn();
const guideFindUnique = vi.fn();
const guideUpdateMany = vi.fn();
const guideCount = vi.fn();
const emailLogFindMany = vi.fn();
const outboxCount = vi.fn();
const abonneFindUnique = vi.fn();
const abonneFindMany = vi.fn();
const abonneUpdate = vi.fn();
const abonneUpdateMany = vi.fn();
const mettreEnFileGuide = vi.fn();
const envoisDeLaDerniereHeure = vi.fn();
const coupeCircuitDeclenche = vi.fn();
const verdictAvantEnvoi = vi.fn();
const enqueueEmail = vi.fn();
const estOpposee = vi.fn();
const contactFindMany = vi.fn();
const marqueFindFirst = vi.fn();

vi.mock("@/server/email/opposition-jeton", () => ({
  jetonOpposition: (email: string) => `opp.jeton-opaque.${email.length}`,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    contactGuideReseau: { findMany: (...a: unknown[]) => contactFindMany(...a) },
    oppositionConvRef: { findFirst: (...a: unknown[]) => marqueFindFirst(...a) },
    guideRequest: {
      findMany: (...a: unknown[]) => guideFindMany(...a),
      findUnique: (...a: unknown[]) => guideFindUnique(...a),
      updateMany: (...a: unknown[]) => guideUpdateMany(...a),
      count: (...a: unknown[]) => guideCount(...a),
    },
    emailLog: { findMany: (...a: unknown[]) => emailLogFindMany(...a) },
    emailOutbox: { count: (...a: unknown[]) => outboxCount(...a) },
    newsletterSubscriber: {
      findUnique: (...a: unknown[]) => abonneFindUnique(...a),
      findMany: (...a: unknown[]) => abonneFindMany(...a),
      update: (...a: unknown[]) => abonneUpdate(...a),
      updateMany: (...a: unknown[]) => abonneUpdateMany(...a),
    },
  },
}));
vi.mock("../envoi", () => ({
  mettreEnFileGuide: (...a: unknown[]) => mettreEnFileGuide(...a),
  envoisDeLaDerniereHeure: (...a: unknown[]) => envoisDeLaDerniereHeure(...a),
}));
vi.mock("../coupe-circuit", () => ({
  coupeCircuitDeclenche: (...a: unknown[]) => coupeCircuitDeclenche(...a),
}));
vi.mock("@/server/email/verdict-envoi", () => ({
  verdictAvantEnvoi: (...a: unknown[]) => verdictAvantEnvoi(...a),
}));
vi.mock("@/server/email/opposition", () => ({
  estOpposee: (...a: unknown[]) => estOpposee(...a),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));

import * as rattrapage from "../rattrapage";
import { rattraperGuides } from "../rattrapage";
import { PLAFOND_HORAIRE_GUIDE } from "../config";

const MAINTENANT = new Date("2026-09-24T12:00:00Z");
const CANDIDATE = {
  id: "demande-1",
  email: "jeanne@example.invalid",
  locale: "fr",
  downloadToken: "a".repeat(64),
  sendCount: 0,
};

beforeEach(() => {
  guideFindMany.mockReset().mockResolvedValue([CANDIDATE]);
  guideFindUnique.mockReset().mockResolvedValue({ sentAt: null, sendCount: 0 });
  guideUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  guideCount.mockReset().mockResolvedValue(0);
  emailLogFindMany.mockReset().mockResolvedValue([]);
  outboxCount.mockReset().mockResolvedValue(0);
  abonneFindUnique.mockReset().mockResolvedValue(null);
  abonneFindMany.mockReset().mockResolvedValue([]);
  abonneUpdate.mockReset().mockResolvedValue({});
  abonneUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  mettreEnFileGuide.mockReset().mockResolvedValue("en-file");
  envoisDeLaDerniereHeure.mockReset().mockResolvedValue(0);
  coupeCircuitDeclenche.mockReset().mockResolvedValue(false);
  verdictAvantEnvoi.mockReset().mockResolvedValue({ retenu: false });
  enqueueEmail.mockReset().mockResolvedValue({ enqueued: true });
  estOpposee.mockReset().mockResolvedValue(false);
  contactFindMany.mockReset().mockResolvedValue([]);
  marqueFindFirst.mockReset().mockResolvedValue(null);
});

describe("rattraperGuides — adresse opposée (toutes origines)", () => {
  it("🔴 origine message_prive + adresse opposée : rien n'est mis en file, rien n'est supprimé", async () => {
    guideFindMany.mockResolvedValue([{ ...CANDIDATE, origine: "message_prive" }]);
    estOpposee.mockResolvedValue(true);
    const r = await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
    expect(r.relancees).toBe(0);
    expect(r.ecartees).toBe(1);
    expect(estOpposee).toHaveBeenCalledWith(CANDIDATE.email);
  });

  it("témoin : message_prive non opposée est bien reprise", async () => {
    guideFindMany.mockResolvedValue([{ ...CANDIDATE, origine: "message_prive" }]);
    const r = await rattraperGuides(MAINTENANT);
    expect(r.relancees).toBe(1);
  });

  it("origine formulaire + adresse opposée : écartée, rien mis en file, rien modifié", async () => {
    guideFindMany.mockResolvedValue([{ ...CANDIDATE, origine: "formulaire" }]);
    estOpposee.mockResolvedValue(true);
    const r = await rattraperGuides(MAINTENANT);
    expect(r.relancees).toBe(0);
    expect(r.ecartees).toBe(1);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
    expect(abonneFindUnique).not.toHaveBeenCalled();
    expect(guideUpdateMany).not.toHaveBeenCalled();
    expect(estOpposee).toHaveBeenCalledWith(CANDIDATE.email);
    // Ordre exigé : réparation → opposition → verdict → lettre. Le verdict n'est jamais consulté.
    expect(verdictAvantEnvoi).not.toHaveBeenCalled();
  });

  it("ligne sans origine + adresse opposée : écartée", async () => {
    guideFindMany.mockResolvedValue([{ ...CANDIDATE }]);
    estOpposee.mockResolvedValue(true);
    const r = await rattraperGuides(MAINTENANT);
    expect(r.relancees).toBe(0);
    expect(r.ecartees).toBe(1);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
  });

  it("estOpposee rejette : rattraperGuides rejette et rien n'est mis en file (échec fermé)", async () => {
    guideFindMany.mockResolvedValue([{ ...CANDIDATE, origine: "formulaire" }]);
    estOpposee.mockRejectedValue(new Error("base indisponible"));
    await expect(rattraperGuides(MAINTENANT)).rejects.toThrow("base indisponible");
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
  });

  it("témoin : formulaire non opposée est bien reprise", async () => {
    guideFindMany.mockResolvedValue([{ ...CANDIDATE, origine: "formulaire" }]);
    const r = await rattraperGuides(MAINTENANT);
    expect(r.relancees).toBe(1);
  });

  it("ligne déjà envoyée (journal sent) + adresse opposée : trace réparée, aucun envoi", async () => {
    guideFindMany.mockResolvedValue([{ ...CANDIDATE, origine: "formulaire" }]);
    emailLogFindMany.mockResolvedValue([
      { status: "sent", sentAt: new Date("2026-09-24T10:00:00Z") },
    ]);
    estOpposee.mockResolvedValue(true);
    const r = await rattraperGuides(MAINTENANT);
    expect(r.reparees).toBe(1);
    expect(r.relancees).toBe(0);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
  });
});

describe("rattraperGuides — ce qui est repris", () => {
  it("témoin positif : une demande restée sans envoi est remise en file", async () => {
    const r = await rattraperGuides(MAINTENANT);
    expect(r.relancees).toBe(1);
    expect(mettreEnFileGuide).toHaveBeenCalledTimes(1);
  });

  it("🔴 la requête : personne (hors admin), non partie, âge compté depuis queued_at", async () => {
    await rattraperGuides(MAINTENANT);
    const arg = guideFindMany.mock.calls[0]?.[0] as {
      where: {
        origine: string;
        sentAt: null;
        OR: Array<{ queuedAt: null | { lt: Date } }>;
      };
    };
    // Une ligne `origine = admin` est un geste humain : jamais rejouée.
    // PV-1 : « tout sauf admin » (formulaire ET message privé), sans citer la valeur
    // nouvelle — le worker peut atterrir avant la migration de l'énumération.
    expect(arg.where.origine).toEqual({ not: "admin" });
    expect(arg.where.sentAt).toBeNull();
    expect(arg.where.OR).toEqual([
      { queuedAt: null },
      { queuedAt: { lt: new Date("2026-09-24T11:00:00Z") } },
    ]);
  });

  it("abonnée : l'e-mail repris porte le lien de désinscription (One-Click)", async () => {
    abonneFindUnique.mockResolvedValue({
      status: "confirmed",
      unsubscribeToken: "u".repeat(64),
      confirmToken: null,
    });
    await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide.mock.calls[0]?.[1]).toMatchObject({
      unsubscribeToken: "u".repeat(64),
      confirmToken: null,
    });
    expect(abonneUpdateMany).not.toHaveBeenCalled();
  });

  it("désabonnée avec une réinscription proposée : le bouton voyage, confirm_sent_at suit", async () => {
    abonneFindUnique.mockResolvedValue({
      status: "unsubscribed",
      unsubscribeToken: "u".repeat(64),
      confirmToken: "c".repeat(64),
    });
    const r = await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide.mock.calls[0]?.[1]).toMatchObject({ confirmToken: "c".repeat(64) });
    expect(abonneUpdateMany).toHaveBeenCalledWith({
      where: { email: CANDIDATE.email, confirmToken: "c".repeat(64) },
      data: { confirmSentAt: MAINTENANT },
    });
    expect(r.confirmationsRelancees).toBe(1);
  });
});

describe("rattraperGuides — ce qui ne doit JAMAIS être renvoyé", () => {
  it("🔴 en file depuis 2 h mais DÉJÀ envoyée (journal `sent`) : trace réparée, AUCUN renvoi", async () => {
    const envoyeLe = new Date("2026-09-24T10:01:00Z");
    emailLogFindMany.mockResolvedValue([{ status: "sent", sentAt: envoyeLe }]);
    const r = await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
    expect(r.reparees).toBe(1);
    expect(guideUpdateMany).toHaveBeenCalledWith({
      where: { id: CANDIDATE.id, sentAt: null },
      data: { sentAt: envoyeLe },
    });
  });

  it("🔴 `send_count` relu juste avant : > 0 ⇒ pas de renvoi", async () => {
    guideFindUnique.mockResolvedValue({ sentAt: null, sendCount: 1 });
    await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
  });

  it("partie entre la requête et la relecture : écartée", async () => {
    guideFindUnique.mockResolvedValue({ sentAt: new Date(), sendCount: 1 });
    const r = await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
    expect(r.ecartees).toBe(1);
  });

  it("encore EN FILE (journal `pending`) : on n'en ajoute pas une seconde", async () => {
    emailLogFindMany.mockResolvedValue([{ status: "pending", sentAt: null }]);
    await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
  });

  it("garée en corbeille de validation : on ne la gare pas une seconde fois", async () => {
    outboxCount.mockResolvedValue(1);
    await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
  });

  it("adresse en rebond dur : pas de nouvelle tentative toutes les heures", async () => {
    verdictAvantEnvoi.mockResolvedValue({ retenu: true, motif: "rebond_dur", depuis: null });
    await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
  });
});

describe("rattraperGuides — les freins", () => {
  it("🔴 coupe-circuit déclenché : le rattrapage est SUSPENDU, il ne lit même pas la file", async () => {
    coupeCircuitDeclenche.mockResolvedValue(true);
    const r = await rattraperGuides(MAINTENANT);
    expect(r.suspendu).toBe(true);
    expect(guideFindMany).not.toHaveBeenCalled();
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("🔴 ne relâche que la PLACE restante sous le plafond horaire", async () => {
    envoisDeLaDerniereHeure.mockResolvedValue(PLAFOND_HORAIRE_GUIDE - 2);
    guideFindMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ ...CANDIDATE, id: `d-${i}` })),
    );
    const r = await rattraperGuides(MAINTENANT);
    expect(r.relancees).toBe(2);
    expect(mettreEnFileGuide).toHaveBeenCalledTimes(2);
  });

  it("table absente (le worker précède la migration) : rien à faire, en silence", async () => {
    guideFindMany.mockRejectedValue(Object.assign(new Error("no table"), { code: "P2021" }));
    const r = await rattraperGuides(MAINTENANT);
    expect(r.candidates).toBe(0);
  });
});

describe("🔴 plus de rattrapage des confirmations (relecture du 24/09)", () => {
  it("le module n'exporte plus rattraperConfirmations, et n'envoie jamais l'ancien gabarit", async () => {
    // Il échappait à la limite de 3 e-mails par destinataire : en redemandant
    // le guide toutes les heures avec l'adresse d'un tiers, on lui faisait
    // envoyer jusqu'à 24 e-mails par jour.
    expect("rattraperConfirmations" in rattrapage).toBe(false);
    abonneFindMany.mockResolvedValue([
      { id: "abonne-1", email: "paul@example.invalid", locale: "fr", confirmToken: "c" },
    ]);
    guideFindMany.mockResolvedValue([]);
    await rattraperGuides(MAINTENANT);
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(abonneFindMany).not.toHaveBeenCalled();
  });
});

const LIEN_PAGE = { convRef: "r".repeat(64), merciStatut: "a_envoyer" };

describe("🔴 rattrapage d'une demande venue de la page « Recevoir le guide » — lien de désinscription", () => {
  const DEMANDE_PAGE = { ...CANDIDATE, origine: "message_prive" };

  it("demande issue de la page : pageGuide + jeton d'opposition, comme au premier envoi", async () => {
    guideFindMany.mockResolvedValue([DEMANDE_PAGE]);
    contactFindMany.mockResolvedValue([LIEN_PAGE]);
    const r = await rattraperGuides(MAINTENANT);
    expect(r.relancees).toBe(1);
    expect(contactFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { guideRequestId: CANDIDATE.id } }),
    );
    expect(mettreEnFileGuide.mock.calls[0]?.[1]).toMatchObject({
      reseau: true,
      pageGuide: { oppositionToken: `opp.jeton-opaque.${CANDIDATE.email.length}` },
    });
  });

  it("le jeton transmis ne contient jamais l'adresse", async () => {
    guideFindMany.mockResolvedValue([DEMANDE_PAGE]);
    contactFindMany.mockResolvedValue([LIEN_PAGE]);
    await rattraperGuides(MAINTENANT);
    const options = mettreEnFileGuide.mock.calls[0]?.[1] as {
      pageGuide: { oppositionToken: string };
    };
    expect(options.pageGuide.oppositionToken).not.toContain(CANDIDATE.email);
  });

  it("demande SANS page (aucune ligne liée) : comportement inchangé, pas de pageGuide", async () => {
    guideFindMany.mockResolvedValue([DEMANDE_PAGE]);
    contactFindMany.mockResolvedValue([]);
    await rattraperGuides(MAINTENANT);
    const options = mettreEnFileGuide.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(options).not.toHaveProperty("pageGuide");
    expect(options["reseau"]).toBe(true);
  });

  it("demande formulaire sans page : inchangée (lettre, pas de pageGuide)", async () => {
    guideFindMany.mockResolvedValue([{ ...CANDIDATE, origine: "formulaire" }]);
    await rattraperGuides(MAINTENANT);
    const options = mettreEnFileGuide.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(options).not.toHaveProperty("pageGuide");
    expect(options["reseau"]).toBe(false);
  });

  it("table des contacts absente (P2021, fenêtre worker/app) : rattrapage inchangé", async () => {
    guideFindMany.mockResolvedValue([DEMANDE_PAGE]);
    contactFindMany.mockRejectedValue(Object.assign(new Error("absente"), { code: "P2021" }));
    const r = await rattraperGuides(MAINTENANT);
    expect(r.relancees).toBe(1);
    expect(mettreEnFileGuide.mock.calls[0]?.[1]).not.toHaveProperty("pageGuide");
  });

  it("opposition => aucun envoi, et la ligne liée n'est même pas lue", async () => {
    guideFindMany.mockResolvedValue([DEMANDE_PAGE]);
    contactFindMany.mockResolvedValue([LIEN_PAGE]);
    estOpposee.mockResolvedValue(true);
    await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
  });

  it.each([
    ["plafond", "plafond"],
    ["non-parti", "non-parti"],
  ])(
    "résultat « %s » de la mise en file : pas de relance comptée, pageGuide transmis",
    async (_n, res) => {
      guideFindMany.mockResolvedValue([DEMANDE_PAGE]);
      contactFindMany.mockResolvedValue([LIEN_PAGE]);
      mettreEnFileGuide.mockResolvedValue(res);
      const r = await rattraperGuides(MAINTENANT);
      expect(r.relancees).toBe(0);
      expect(mettreEnFileGuide.mock.calls[0]?.[1]).toHaveProperty("pageGuide");
    },
  );

  it("corbeille de validation : rien n'est mis en file", async () => {
    guideFindMany.mockResolvedValue([DEMANDE_PAGE]);
    contactFindMany.mockResolvedValue([LIEN_PAGE]);
    outboxCount.mockResolvedValue(1);
    const r = await rattraperGuides(MAINTENANT);
    expect(r.ecartees).toBe(1);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
  });
});

describe("🔴 MG-STOP01 — un STOP gagné pendant l'enregistrement de la page n'est jamais rattrapé", () => {
  const DEMANDE_PAGE = { ...CANDIDATE, origine: "message_prive" };

  it("course gagnée par le STOP, contact écarté : rien ne part (guide ni merci)", async () => {
    guideFindMany.mockResolvedValue([DEMANDE_PAGE]);
    contactFindMany.mockResolvedValue([{ ...LIEN_PAGE, merciStatut: "ecarte" }]);
    const r = await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
    expect(r.relancees).toBe(0);
    expect(r.ecartees).toBe(1);
    expect(verdictAvantEnvoi).not.toHaveBeenCalled();
    expect(guideUpdateMany).not.toHaveBeenCalled();
  });

  it("ancienne graphie « ecartee » : lue comme écartée", async () => {
    guideFindMany.mockResolvedValue([DEMANDE_PAGE]);
    contactFindMany.mockResolvedValue([{ ...LIEN_PAGE, merciStatut: "ecartee" }]);
    await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
  });

  it("2de lecture en erreur puis écriture d'écart perdue : contact resté a_envoyer MAIS conv_ref marqué => rien ne part", async () => {
    guideFindMany.mockResolvedValue([DEMANDE_PAGE]);
    contactFindMany.mockResolvedValue([LIEN_PAGE]);
    marqueFindFirst.mockResolvedValue({ id: "m1" });
    const r = await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
    expect(r.ecartees).toBe(1);
    expect(marqueFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { convRef: { in: [LIEN_PAGE.convRef] } } }),
    );
  });

  it.each([
    ["table illisible", new Error("base indisponible")],
    ["table absente (P2021)", Object.assign(new Error("absente"), { code: "P2021" })],
  ])(
    "🔴 %s (marques) : l'envoi est BLOQUÉ (fermé), rien ne part, aucune adresse journalisée",
    async (_n, erreur) => {
      guideFindMany.mockResolvedValue([DEMANDE_PAGE]);
      contactFindMany.mockResolvedValue([LIEN_PAGE]);
      marqueFindFirst.mockRejectedValue(erreur);
      const espion = vi.spyOn(console, "error").mockImplementation(() => undefined);
      try {
        const r = await rattraperGuides(MAINTENANT);
        expect(mettreEnFileGuide).not.toHaveBeenCalled();
        expect(r.relancees).toBe(0);
        expect(r.ecartees).toBe(1);
        expect(JSON.stringify(espion.mock.calls)).not.toContain(CANDIDATE.email);
      } finally {
        espion.mockRestore();
      }
    },
  );

  it("témoin : cas normal (page, pas de STOP) part toujours", async () => {
    guideFindMany.mockResolvedValue([DEMANDE_PAGE]);
    contactFindMany.mockResolvedValue([LIEN_PAGE]);
    const r = await rattraperGuides(MAINTENANT);
    expect(r.relancees).toBe(1);
    expect(mettreEnFileGuide).toHaveBeenCalledTimes(1);
  });
});

// STOP-T1 — quand le contrôle du départ lève 5 fois, le worker CLÔT désormais le journal en
// « échec » (motif sans adresse) : le rattrapage reprend la demande et relit l'opposition.
describe("rattraperGuides — job dont les 5 essais sont épuisés (contrôle illisible au départ)", () => {
  const ANCIENNE_MISE_EN_FILE = new Date(MAINTENANT.getTime() - 3 * 3_600_000);

  it("journal clos en « échec » pour cette raison : la demande EST reprise (l'opposition sera relue)", async () => {
    guideFindMany.mockResolvedValue([
      { ...CANDIDATE, origine: "formulaire", queuedAt: ANCIENNE_MISE_EN_FILE },
    ]);
    emailLogFindMany.mockResolvedValue([]); // ligne « failed » : `etatJournal` ne lit que « sent » et « pending »
    const r = await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide).toHaveBeenCalledTimes(1);
    expect(r.relancees).toBe(1);
  });

  it("journal clos en « échec » mais opposition toujours illisible : l'erreur remonte, rien n'est mis en file", async () => {
    guideFindMany.mockResolvedValue([
      { ...CANDIDATE, origine: "formulaire", queuedAt: ANCIENNE_MISE_EN_FILE },
    ]);
    emailLogFindMany.mockResolvedValue([]);
    estOpposee.mockRejectedValue(new Error("ECONNREFUSED"));
    await rattraperGuides(MAINTENANT).catch(() => undefined);
    expect(estOpposee).toHaveBeenCalled();
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
  });
});
