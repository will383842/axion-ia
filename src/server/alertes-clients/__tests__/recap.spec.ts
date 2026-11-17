/**
 * Le récap quotidien des demandes de clients — ce qu'il DOIT faire :
 *  · lire la VEILLE de Paris (bornes passées à la base), hors corbeille, hors demandes qui ne sont
 *    pas celles d'un client (presse…) ;
 *  · déchiffrer nom et entreprise, sans jamais laisser passer le chiffré ;
 *  · ranger les annulations Calendly (date approximative) et les échanges hors clients à part ;
 *  · partir MÊME sans demande, une seule fois par jour (jobId) ;
 *  · ne jamais mettre une donnée de visiteur dans un lien.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  submissions: vi.fn(),
  escalades: vi.fn(),
  rdvs: vi.fn(),
  incident: vi.fn(async () => {}),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findMany: (...a: unknown[]) => d.submissions(...a) },
    chatEscalation: { findMany: (...a: unknown[]) => d.escalades(...a) },
    calendlyEvent: { findMany: (...a: unknown[]) => d.rdvs(...a) },
  },
}));
vi.mock("@/server/notifications/channels/sentry", () => ({
  signalerIncident: (...a: unknown[]) => d.incident(...(a as [])),
}));

import { encryptPii } from "@/lib/pii-crypto";
import { lienConsole } from "@/server/notifications/personne";
import {
  __reinitialiserPourTests as reinitialiserEnfileur,
  poserChargeurEnfileurEmail,
} from "@/server/notifications/enfileur-email";
import { collecterDemandesVeille, envoyerRecapVeille, joursOuvresEcoules } from "../recap";

const CLE_DE_TEST = "ab".repeat(32);
// 14/11/2026, 7 h 30 à Paris (hiver, UTC+1) : la veille est le 13/11.
const MAINTENANT = new Date("2026-11-14T06:30:00Z");
const DANS_LA_VEILLE = new Date("2026-11-13T10:15:00Z");

function submission(sur: Record<string, unknown> = {}) {
  return {
    id: "sub_42",
    type: "audit",
    locale: "fr",
    companyName: encryptPii("Atelier Fictif SARL"),
    contactName: encryptPii("Camille Exemple"),
    contactEmail: encryptPii("camille@exemple.fr"),
    contactPhone: encryptPii("+33 6 39 98 12 35"),
    sector: null,
    employeesCount: null,
    submittedAt: DANS_LA_VEILLE,
    details: { unifiedType: "audit", message: "Bonjour, nous voulons un audit.", ville: "Lyon" },
    ...sur,
  };
}

function rdv(sur: Record<string, unknown> = {}) {
  return {
    id: "cal_1",
    eventTypeName: "Diagnostic IA (30 min)",
    typeRendezVous: "diagnostic",
    status: "scheduled",
    startTime: new Date("2026-11-20T09:00:00Z"),
    inviteeName: "Alex Exemple",
    inviteeEmail: "alex@exemple.fr",
    inviteePhone: "+33 6 39 98 00 01",
    location: null,
    cancelUrl: null,
    pageUrl: null,
    utmSource: null,
    utmCampaign: null,
    utmMedium: null,
    capturedAt: DANS_LA_VEILLE,
    updatedAt: DANS_LA_VEILLE,
    ...sur,
  };
}

beforeEach(() => {
  vi.stubEnv("PII_ENCRYPTION_KEY", CLE_DE_TEST);
  d.submissions.mockResolvedValue([]);
  d.escalades.mockResolvedValue([]);
  d.rdvs.mockResolvedValue([]);
  d.incident.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  reinitialiserEnfileur();
});

describe("collecterDemandesVeille", () => {
  it("lit la veille de Paris, hors corbeille", async () => {
    await collecterDemandesVeille(MAINTENANT);
    const where = (d.submissions.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    expect(where["deletedAt"]).toBeNull();
    expect(where["submittedAt"]).toEqual({
      gte: new Date("2026-11-12T23:00:00.000Z"),
      lt: new Date("2026-11-13T23:00:00.000Z"),
    });
    const whereEsc = (d.escalades.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    expect(whereEsc["createdAt"]).toEqual(where["submittedAt"]);
  });

  it("avec demandes : détail complet déchiffré, presse écartée, lien de la fiche", async () => {
    d.submissions.mockResolvedValue([
      submission(),
      submission({ id: "sub_presse", details: { unifiedType: "presse", message: "Interview ?" } }),
    ]);
    d.escalades.mockResolvedValue([
      {
        id: "esc_1",
        question: "Faites-vous des formations en anglais ?",
        contexte: null,
        contactEmail: "visiteur@exemple.fr",
        createdAt: new Date("2026-11-13T15:00:00Z"),
      },
    ]);
    d.rdvs.mockResolvedValue([rdv()]);

    const r = await collecterDemandesVeille(MAINTENANT);

    expect(r.jour).toBe("2026-11-13");
    expect(r.jourCourt).toBe("13/11");
    expect(r.demandes).toHaveLength(2); // l'audit + l'escalade ; la presse n'est pas un client
    expect(r.rendezVous).toHaveLength(1);
    expect(r.total).toBe(3);

    const audit = r.demandes[0]!;
    expect(audit.nom).toBe("Camille Exemple — Atelier Fictif SARL");
    const texte = audit.lignes.join("\n");
    expect(texte).toContain("camille@exemple.fr");
    expect(texte).toContain("+33 6 39 98 12 35");
    expect(texte).toContain("Bonjour, nous voulons un audit.");
    expect(audit.consoleUrl).toBe(lienConsole("contacts/messages/sub_42"));
    // Le lien voyage dans `consoleUrl`, pas dans les lignes.
    expect(texte).not.toContain("Fiche :");

    expect(r.rendezVous[0]!.consoleUrl).toBe(lienConsole("contacts/appels/cal_1"));
    expect(JSON.stringify(r)).not.toContain("Interview");
  });

  it("🔴 données chiffrées : aucune valeur « enc: » ne sort, une ligne illisible est comptée", async () => {
    d.submissions.mockResolvedValue([
      submission(),
      submission({ id: "sub_cassee", contactName: "enc:v1:aaaa:bbbb:cccc" }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    expect(JSON.stringify(r)).not.toContain("enc:v1");
    expect(r.demandes).toHaveLength(1);
    expect(r.illisibles).toBe(1);
    expect(r.total).toBe(2); // la demande illisible compte : elle n'est pas perdue en silence
  });

  it("le simulateur de gains (simulateur_roi) est une demande de client : il apparaît", async () => {
    d.submissions.mockResolvedValue([
      submission({
        id: "sub_roi",
        details: { unifiedType: "simulateur_roi", message: "Simulation" },
      }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    expect(r.demandes).toHaveLength(1);
    expect(r.demandes[0]!.type).toBe("Simulateur de gains");
  });

  it("un type de formulaire inconnu est traité comme une demande de client", async () => {
    d.submissions.mockResolvedValue([
      submission({ id: "sub_inconnu", details: { unifiedType: "type_futur", message: "Salut" } }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    expect(r.demandes).toHaveLength(1);
    expect(r.total).toBe(1);
  });

  it("un prospect du chatbot garde son besoin (message) et son libellé", async () => {
    d.submissions.mockResolvedValue([
      submission({
        id: "sub_bot",
        details: { besoin: "Automatiser mes devis pour mon cabinet", canal: "chatbot" },
      }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    expect(r.demandes).toHaveLength(1);
    expect(r.demandes[0]!.type).toBe("Lead chatbot");
    expect(r.demandes[0]!.lignes.join("\n")).toContain("Automatiser mes devis pour mon cabinet");
  });

  it("🔴 details.source = « chatbot » (champ libre) ne fait pas entrer une demande presse dans le récap", async () => {
    d.submissions.mockResolvedValue([
      submission({
        id: "sub_presse_source",
        details: { unifiedType: "presse", source: "chatbot", message: "Interview ?" },
      }),
      submission({
        id: "sub_recrut_source",
        details: { unifiedType: "recrutement", source: "chatbot", message: "CV" },
      }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    expect(r.demandes).toHaveLength(0);
    expect(r.total).toBe(0);
  });

  it("un prospect du chatbot avec seulement details.source = chatbot : demande ordinaire, besoin gardé", async () => {
    d.submissions.mockResolvedValue([
      submission({ id: "sub_src", details: { besoin: "X", source: "chatbot" } }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    expect(r.demandes).toHaveLength(1);
    expect(r.demandes[0]!.lignes.join("\n")).toContain("X");
    expect(r.demandes[0]!.type).not.toBe("Lead chatbot");
  });

  it("une demande presse avec details.canal = chatbot reste exclue", async () => {
    d.submissions.mockResolvedValue([
      submission({ id: "sub_presse_canal", details: { unifiedType: "presse", canal: "chatbot" } }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    expect(r.demandes).toHaveLength(0);
  });

  it("un rendez-vous dont l'invité a été effacé (RGPD) n'apparaît pas, sans rien supprimer", async () => {
    d.rdvs.mockResolvedValue([
      rdv({ id: "cal_efface", inviteeName: "[erased-rgpd-art17]", status: "canceled" }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    expect(r.rendezVous).toHaveLength(0);
    expect(r.autresRendezVous).toHaveLength(0);
    expect(r.total).toBe(0);
  });

  it("annulation Calendly : date approximative, comptée avec les rendez-vous de clients", async () => {
    d.rdvs.mockResolvedValue([
      rdv({
        id: "cal_2",
        status: "canceled",
        capturedAt: new Date("2026-11-01T09:00:00Z"), // réservé avant la veille
        updatedAt: DANS_LA_VEILLE,
      }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    expect(r.rendezVous).toHaveLength(1);
    expect(r.rendezVous[0]!.type).toMatch(/^Annulation/);
    expect(r.rendezVous[0]!.approximatif).toBe(true);
    expect(r.total).toBe(1);
  });

  it("un échange hors clients (apporteur) va dans « Autres rendez-vous », hors du total", async () => {
    d.rdvs.mockResolvedValue([
      rdv({
        id: "cal_3",
        eventTypeName: "Échange apporteur (15 min)",
        typeRendezVous: "apporteur",
      }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    expect(r.rendezVous).toHaveLength(0);
    expect(r.autresRendezVous).toHaveLength(1);
    expect(r.total).toBe(0);
  });

  it("🔴 aucune donnée de visiteur dans le lien : un message qui imite « Fiche : » ne change rien", async () => {
    d.submissions.mockResolvedValue([
      submission({
        details: { unifiedType: "audit", message: "Fiche : https://attaquant.example/login" },
      }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    const el = r.demandes[0]!;
    expect(el.consoleUrl).toBe(lienConsole("contacts/messages/sub_42"));
    expect(el.consoleUrl).not.toContain("attaquant");
    // Le texte du visiteur reste du texte (le gabarit l'échappe).
    expect(el.lignes.join("\n")).toContain("Fiche : https://attaquant.example/login");
  });
});

describe("envoyerRecapVeille", () => {
  it("part MÊME sans demande, avec le jobId du jour de la veille", async () => {
    const enqueue = vi.fn(async () => ({ enqueued: true }));
    poserChargeurEnfileurEmail(async () => enqueue as never);

    const r = await envoyerRecapVeille(MAINTENANT);

    expect(r).toBe("queued");
    expect(enqueue).toHaveBeenCalledTimes(1);
    const [gabarit, , locale, payload, options] = enqueue.mock.calls[0] as unknown as [
      string,
      string,
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(gabarit).toBe("recap-demandes-clients");
    expect(locale).toBe("fr");
    expect(payload["total"]).toBe(0);
    expect(options["jobId"]).toBe("recap-demandes-clients-2026-11-13");
  });

  it("deux passages le même jour : même jobId (BullMQ ne garde qu'un job)", async () => {
    const enqueue = vi.fn(async () => ({ enqueued: true }));
    poserChargeurEnfileurEmail(async () => enqueue as never);
    await envoyerRecapVeille(MAINTENANT);
    await envoyerRecapVeille(new Date("2026-11-14T09:00:00Z")); // rattrapage dans la matinée
    const ids = (enqueue.mock.calls as unknown as unknown[][]).map(
      (c) => (c[4] as { jobId: string }).jobId,
    );
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(1);
  });

  it("e-mail non parti : « failed », tracé, sans lever ni citer de donnée de personne", async () => {
    d.submissions.mockResolvedValue([submission()]);
    poserChargeurEnfileurEmail(async () => (async () => ({ enqueued: false })) as never);
    const r = await envoyerRecapVeille(MAINTENANT);
    expect(r).toBe("failed");
    const messages = d.incident.mock.calls.map((c) => String((c as unknown[])[0])).join("\n");
    expect(messages).toContain("Récap quotidien des demandes de clients :");
    expect(messages).not.toContain("Doublon");
    expect(messages).not.toContain("camille");
  });

  it("base injoignable : « failed », sans lever", async () => {
    d.submissions.mockRejectedValue(new Error("db down"));
    poserChargeurEnfileurEmail(async () => (async () => ({ enqueued: true })) as never);
    await expect(envoyerRecapVeille(MAINTENANT)).resolves.toBe("failed");
  });

  it("aucun enfileur posé : « failed »", async () => {
    await expect(envoyerRecapVeille(MAINTENANT)).resolves.toBe("failed");
  });
});

describe("🔴 le lien d'annulation du client ne part pas par e-mail (L2b)", () => {
  const TEMOIN = "https://calendly.com/cancellations/TEMOIN";

  it("réservation : absent de `lignes` et de tout le récap ; le visiteur qui l'écrit reste lu", async () => {
    d.rdvs.mockResolvedValue([rdv({ cancelUrl: TEMOIN })]);
    d.submissions.mockResolvedValue([
      submission({
        details: { unifiedType: "audit", message: `Annuler / déplacer : ${TEMOIN}` },
      }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    expect(r.rendezVous).toHaveLength(1);
    expect(r.rendezVous[0]!.lignes.join("\n")).not.toContain("TEMOIN");
    // La ligne du visiteur, qui contient le même texte, n'est pas retirée.
    expect(r.demandes[0]!.lignes.join("\n")).toContain(`Annuler / déplacer : ${TEMOIN}`);
    expect(JSON.stringify(r.rendezVous)).not.toContain("TEMOIN");
  });
});

// ── L5a : « En attente de votre réponse » ─────────────────────────────────────
// MAINTENANT = samedi 14/11/2026. Reçue lundi 09/11 : mar, mer, jeu, ven = 4 jours ouvrés.
describe("L5a — demandes en attente de réponse", () => {
  const LUNDI = new Date("2026-11-09T10:00:00Z");
  const JEUDI_APRES_MIDI = new Date("2026-11-12T14:00:00Z");
  const VENDREDI = new Date("2026-11-13T10:15:00Z");
  /** La requête « en attente » est celle qui filtre sur le statut ; la requête de la veille ne le fait pas. */
  const enAttenteDe = (liste: unknown[]) =>
    d.submissions.mockImplementation(async (arg: { where: Record<string, unknown> }) =>
      arg.where["status"] === "new" ? liste : [],
    );

  it("compte les jours ouvrés (lundi à vendredi, fériés non exclus)", () => {
    expect(joursOuvresEcoules("2026-11-09", "2026-11-14")).toBe(4);
    expect(joursOuvresEcoules("2026-11-12", "2026-11-14")).toBe(1);
    expect(joursOuvresEcoules("2026-11-13", "2026-11-16")).toBe(1);
    expect(joursOuvresEcoules("2026-11-13", "2026-11-17")).toBe(2);
  });

  it("une demande de 3 jours ouvrés est listée, celle d'un jour non", async () => {
    // Ven 13 reçue / lun 16, mar 17, mer 18 : 3 jours ouvrés à la date du 18/11.
    enAttenteDe([
      submission({ id: "sub_vieille", submittedAt: LUNDI }),
      submission({ id: "sub_jeune", submittedAt: JEUDI_APRES_MIDI }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    expect(r.enAttente?.map((e) => e.consoleUrl)).toEqual([
      `${lienConsole("")}/contacts/messages/sub_vieille`,
    ]);
    expect(r.enAttente?.[0]?.lignes).toEqual(["En attente depuis 4 jours ouvrés"]);
  });

  it("exactement 2 jours ouvrés : pas encore listée ; 3 : listée", async () => {
    // Reçue jeudi 12, vu de lundi 16 : ven, lun = 2 (non) ; vu de mardi 17 : 3 (oui).
    enAttenteDe([submission({ id: "sub_j", submittedAt: JEUDI_APRES_MIDI })]);
    const lundi = await collecterDemandesVeille(new Date("2026-11-16T06:30:00Z"));
    expect(lundi.enAttente).toBeUndefined();
    const mardi = await collecterDemandesVeille(new Date("2026-11-17T06:30:00Z"));
    expect(mardi.enAttente).toHaveLength(1);
  });

  it("la requête : statut « new », hors corbeille, entre 2 et 30 jours, bornée, lecture seule", async () => {
    await collecterDemandesVeille(MAINTENANT);
    const arg = d.submissions.mock.calls
      .map((c) => c[0] as { where: Record<string, unknown>; take?: number })
      .find((a) => a.where["status"] === "new")!;
    expect(arg.where["deletedAt"]).toBeNull();
    expect(arg.where["submittedAt"]).toEqual({
      gte: new Date("2026-10-15T06:30:00Z"),
      lte: new Date("2026-11-12T06:30:00Z"),
    });
    expect(arg.take).toBe(50);
  });

  it("plafond de 10, du plus ancien au plus récent", async () => {
    enAttenteDe(
      Array.from({ length: 14 }, (_, i) => submission({ id: `sub_${i}`, submittedAt: LUNDI })),
    );
    const r = await collecterDemandesVeille(MAINTENANT);
    expect(r.enAttente).toHaveLength(10);
  });

  it("une demande presse n'est pas listée ; une demande traitée ne revient pas de la base", async () => {
    enAttenteDe([
      submission({ id: "sub_presse", submittedAt: LUNDI, details: { unifiedType: "presse" } }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    expect(r.enAttente).toBeUndefined();
    // La base ne rend que le statut « new » : la requête le demande explicitement (test ci-dessus).
  });

  it("🔴 aucun texte du visiteur dans la section : ni message, ni e-mail, ni téléphone", async () => {
    enAttenteDe([
      submission({
        submittedAt: LUNDI,
        details: { unifiedType: "audit", message: "SECRET-MESSAGE", ville: "SECRET-VILLE" },
      }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    const json = JSON.stringify(r.enAttente);
    for (const interdit of ["SECRET-MESSAGE", "SECRET-VILLE", "camille@exemple.fr", "+33 6"]) {
      expect(json).not.toContain(interdit);
    }
    expect(r.enAttente?.[0]?.nom).toBe("Camille Exemple");
  });

  it("aucune demande en attente : la clé est absente, le récap est celui d'avant", async () => {
    const r = await collecterDemandesVeille(MAINTENANT);
    expect("enAttente" in r).toBe(false);
    expect(r.total).toBe(0);
  });

  it("la section ne change ni le total annoncé ni l'objet", async () => {
    enAttenteDe([submission({ submittedAt: LUNDI })]);
    expect((await collecterDemandesVeille(MAINTENANT)).total).toBe(0);
  });

  it("une panne de la requête « en attente » ne fait pas perdre le récap de la veille", async () => {
    d.submissions.mockImplementation(async (arg: { where: Record<string, unknown> }) => {
      if (arg.where["status"] === "new") throw new Error("boom");
      return [submission({ submittedAt: VENDREDI })];
    });
    const r = await collecterDemandesVeille(MAINTENANT);
    expect(r.demandes).toHaveLength(1);
    expect(r.enAttente).toBeUndefined();
  });

  it("zéro envoi externe : seul l'enfileur interne est appelé, vers le destinataire interne", async () => {
    enAttenteDe([submission({ submittedAt: LUNDI })]);
    const enqueue = vi.fn(async () => ({ enqueued: true }));
    poserChargeurEnfileurEmail(async () => enqueue as never);
    await envoyerRecapVeille(MAINTENANT);
    expect(enqueue).toHaveBeenCalledTimes(1);
    const [gabarit, destinataire, , payload] = enqueue.mock.calls[0] as unknown as [
      string,
      string,
      string,
      Record<string, unknown>,
    ];
    expect(gabarit).toBe("recap-demandes-clients");
    expect(destinataire).not.toContain("exemple.fr");
    expect((payload["enAttente"] as unknown[]).length).toBe(1);
  });
});
