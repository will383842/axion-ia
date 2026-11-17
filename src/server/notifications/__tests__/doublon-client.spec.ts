/**
 * Le DOUBLON d'une demande de client (14/11/2026, décision du fondateur) : conversation PRIVÉE
 * Telegram + e-mail instantané, en plus du salon « Clients ».
 *
 * Verrouille : sans `TELEGRAM_CHAT_ID_PRIVE`, pas de doublon Telegram mais l'e-mail part quand
 * même ; jamais de doublon pour une catégorie hors clients, un rejeu, ou un appelant qui force
 * ses canaux ; l'échec d'un doublon ne casse jamais l'alerte du salon.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const redisSetMock = vi.fn();
const redisDelMock = vi.fn();
vi.mock("@/lib/redis", () => ({
  redis: {
    set: (...a: unknown[]) => redisSetMock(...a),
    del: (...a: unknown[]) => redisDelMock(...a),
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
  },
}));

const enqueueEmailMock = vi.fn();
import { notify, flushPendingDispatches } from "../index";
import {
  __reinitialiserPourTests as reinitialiserEnfileur,
  poserChargeurEnfileurEmail,
} from "../enfileur-email";
import { entiteDeLAlerte, formatDoublonPrive, objetAlerteClient } from "../doublon-client";
import { resolveConversationPrivee } from "../routing";
import { lignesDetailClient, type EvenementClient } from "../format-clients";

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;
const saved = { ...process.env };

const DEMANDE = {
  submissionId: "sub_42",
  contactName: "Camille Exemple",
  contactEmail: "camille@exemple.fr",
  contactPhone: "+33 6 39 98 12 35",
  formType: "formation",
  companyName: "Atelier Fictif SARL",
  message: "Bonjour, nous voulons former 12 personnes.",
  submittedAt: "2026-10-15T12:30:00.000Z",
  locale: "fr" as const,
};

const RDV = {
  eventUri: "evt_7",
  inviteeEmail: "camille@exemple.fr",
  inviteeName: "Camille Exemple",
  inviteePhone: "+33 6 39 98 12 35",
  eventStartTime: "2026-10-20T08:00:00.000Z",
  eventName: "Diagnostic IA (30 min)",
  typeRendezVous: "diagnostic",
};

const ok = () => new Response('{"ok":true}', { status: 200 });

/** Les corps des appels Telegram visant un salon. */
function appelsVers(chatId: string): Array<Record<string, unknown>> {
  return fetchMock.mock.calls
    .map((c) => JSON.parse((c[1] as { body: string }).body) as Record<string, unknown>)
    .filter((b) => b["chat_id"] === chatId);
}

beforeEach(() => {
  // Jamais la vraie file : un faux chargeur d'enfileur (registre `enfileur-email.ts`).
  reinitialiserEnfileur();
  poserChargeurEnfileurEmail(async () => enqueueEmailMock as never);
  fetchMock.mockReset().mockImplementation(async () => ok());
  enqueueEmailMock.mockReset().mockResolvedValue({ enqueued: true });
  redisSetMock.mockReset().mockResolvedValue("OK");
  redisDelMock.mockReset().mockResolvedValue(1);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("TELEGRAM_") || k === "ALERTES_CLIENTS_EMAIL") delete process.env[k];
  }
  process.env.TELEGRAM_BOT_TOKEN = "bot-principal";
  process.env.TELEGRAM_CHAT_ID_CLIENTS = "-clients";
  process.env.TELEGRAM_CHAT_ID_PRIVE = "4242";
  process.env.REDIS_URL = "redis://localhost:6381";
});

afterEach(async () => {
  reinitialiserEnfileur();
  await flushPendingDispatches();
  globalThis.fetch = originalFetch;
  process.env = { ...saved };
});

describe("le doublon d'une demande de client", () => {
  it("🔴 le salon « Clients » ET la conversation privée reçoivent la demande, avec son", async () => {
    const r = await notify({
      category: "CONTACT_FORM_SUBMITTED",
      payload: DEMANDE,
      dedupKey: "sub_42",
      sync: true,
    });
    expect(r.doublons).toEqual({ prive: "sent", email: "queued" });
    expect(appelsVers("-clients").length).toBeGreaterThan(0);
    const prive = appelsVers("4242");
    expect(prive).toHaveLength(1);
    expect(prive[0]!["disable_notification"]).toBe(false);
    expect(prive[0]!["parse_mode"]).toBeUndefined();
    const texte = String(prive[0]!["text"]);
    expect(texte.split("\n")[0]).toBe("🚨 IMPORTANT — DEMANDE CLIENT · MESSAGE");
    for (const attendu of [
      "Camille Exemple — Atelier Fictif SARL",
      "📞 +33 6 39 98 12 35",
      "✉️ camille@exemple.fr",
    ]) {
      expect(texte).toContain(attendu);
    }
    expect(texte).toMatch(/Fiche : https?:\/\/\S+\/contacts\/messages\/sub_42/);
  });

  it("🔴 l'entityId de l'e-mail ne contient jamais la clé brute (URI d'invité Calendly)", async () => {
    const uri = "https://api.calendly.com/scheduled_events/AAAA1111/invitees/BBBB2222";
    const entityIdDe = async (dedupKey: string): Promise<string> => {
      enqueueEmailMock.mockClear();
      await notify({
        category: "CONTACT_FORM_SUBMITTED",
        payload: DEMANDE,
        dedupKey,
        sync: true,
      });
      return (enqueueEmailMock.mock.calls[0]![4] as { entityId: string }).entityId;
    };
    const a1 = await entityIdDe(`cal-created:${uri}`);
    expect(a1).not.toContain("BBBB2222");
    expect(a1).not.toContain("AAAA1111");
    expect(a1).not.toContain("calendly");
    expect(a1).toMatch(/^CONTACT_FORM_SUBMITTED:[0-9a-f]{16}$/);
    // Même clé : même identifiant (idempotence) ; clé différente : identifiant différent.
    expect(entiteDeLAlerte("CONTACT_FORM_SUBMITTED", `cal-created:${uri}`)).toBe(a1);
    expect(entiteDeLAlerte("CONTACT_FORM_SUBMITTED", `cal-created:${uri}2`)).not.toBe(a1);
    expect(entiteDeLAlerte("CONTACT_FORM_SUBMITTED", undefined)).toBe("CONTACT_FORM_SUBMITTED");
  });

  it("l'e-mail part à contact@axion-ia.com avec toutes les informations et un jobId stable", async () => {
    await notify({
      category: "CONTACT_FORM_SUBMITTED",
      payload: DEMANDE,
      dedupKey: "sub_42",
      sync: true,
    });
    expect(enqueueEmailMock).toHaveBeenCalledTimes(1);
    const [gabarit, dest, locale, payload, options] = enqueueEmailMock.mock.calls[0]!;
    expect(gabarit).toBe("alerte-demande-client");
    expect(dest).toBe("contact@axion-ia.com");
    expect(locale).toBe("fr");
    const p = payload as Record<string, unknown>;
    expect(p["canal"]).toBe("message");
    expect(p["nom"]).toBe("Camille Exemple");
    expect((p["lignes"] as string[]).join("\n")).toContain(DEMANDE.message);
    expect(String(p["consoleUrl"])).toContain("/contacts/messages/sub_42");
    const jobId = (options as { jobId: string }).jobId;
    expect(jobId).toMatch(/^alerte-client-[0-9a-f]{40}$/);

    enqueueEmailMock.mockClear();
    await notify({
      category: "CONTACT_FORM_SUBMITTED",
      payload: DEMANDE,
      dedupKey: "sub_42",
      sync: true,
    });
    expect((enqueueEmailMock.mock.calls[0]![4] as { jobId: string }).jobId).toBe(jobId);
  });

  it("ALERTES_CLIENTS_EMAIL remplace l'adresse par défaut", async () => {
    process.env.ALERTES_CLIENTS_EMAIL = "alertes@exemple.fr";
    await notify({
      category: "CONTACT_FORM_SUBMITTED",
      payload: DEMANDE,
      dedupKey: "k1",
      sync: true,
    });
    expect(enqueueEmailMock.mock.calls[0]![1]).toBe("alertes@exemple.fr");
  });

  it("🔴 sans TELEGRAM_CHAT_ID_PRIVE : pas de doublon Telegram, l'e-mail part quand même", async () => {
    delete process.env.TELEGRAM_CHAT_ID_PRIVE;
    expect(resolveConversationPrivee()).toBeUndefined();
    const r = await notify({
      category: "CONTACT_FORM_SUBMITTED",
      payload: DEMANDE,
      dedupKey: "k2",
      sync: true,
    });
    expect(r.doublons).toEqual({ prive: "skipped", email: "queued" });
    expect(enqueueEmailMock).toHaveBeenCalledTimes(1);
    expect(appelsVers("4242")).toHaveLength(0);
  });

  it("jamais de repli : un salon ne remplace pas la conversation privée", () => {
    delete process.env.TELEGRAM_CHAT_ID_PRIVE;
    process.env.TELEGRAM_CHAT_ID = "-general";
    expect(resolveConversationPrivee()).toBeUndefined();
  });

  it("Calendly : l'en-tête, la date du rendez-vous et le canal", async () => {
    const r = await notify({
      category: "CLIENT_CALL_BOOKED",
      payload: RDV,
      dedupKey: "evt_7",
      sync: true,
    });
    expect(r.doublons?.prive).toBe("sent");
    const texte = String(appelsVers("4242")[0]!["text"]);
    expect(texte.split("\n")[0]).toBe("🚨 IMPORTANT — DEMANDE CLIENT · CALENDLY");
    expect(texte).toContain("🗓 20 oct. 2026, 10:00");
    expect((enqueueEmailMock.mock.calls[0]![3] as Record<string, unknown>)["canal"]).toBe(
      "calendly",
    );
  });

  it("annulation et report : en-têtes et objets distincts", () => {
    const annule = formatDoublonPrive({
      category: "CLIENT_CALL_CANCELED",
      payload: RDV,
    } as EvenementClient);
    expect(annule.split("\n")[0]).toBe("🚨 IMPORTANT — DEMANDE CLIENT · CALENDLY ANNULÉ");
    const reporte = formatDoublonPrive({
      category: "CLIENT_CALL_RESCHEDULED",
      payload: { ...RDV, oldStart: RDV.eventStartTime, newStart: "2026-10-21T08:00:00.000Z" },
    } as EvenementClient);
    expect(reporte.split("\n")[0]).toBe("🚨 IMPORTANT — DEMANDE CLIENT · CALENDLY REPORTÉ");
    expect(reporte).toContain("🗓 21 oct. 2026, 10:00");
    expect(objetAlerteClient("message", "nouveau")).toBe("🔴 IMPORTANT DEMANDE CLIENT MESSAGE");
    expect(objetAlerteClient("calendly", "annule")).toBe(
      "🔴 IMPORTANT DEMANDE CLIENT CALENDLY ANNULÉ",
    );
    expect(objetAlerteClient("calendly", "reporte")).toBe(
      "🔴 IMPORTANT DEMANDE CLIENT CALENDLY REPORTÉ",
    );
  });

  it("🔴 un rejeu du même fait ne redouble pas (anti-doublon propre, 24 h)", async () => {
    // La clé « prive: » existe déjà (SET NX → null) ; celle du hub est neuve.
    redisSetMock.mockImplementation(async (k: string) => (k.includes("prive:") ? null : "OK"));
    const r = await notify({
      category: "CONTACT_FORM_SUBMITTED",
      payload: DEMANDE,
      dedupKey: "sub_43",
      sync: true,
    });
    expect(r.doublons?.prive).toBe("deduped");
    expect(appelsVers("4242")).toHaveLength(0);
  });

  it("🔴 un doublon Telegram raté libère sa clé et ne casse ni le salon ni l'e-mail", async () => {
    fetchMock.mockImplementation(async (_u: unknown, init: { body: string }) =>
      JSON.parse(init.body).chat_id === "4242"
        ? new Response('{"ok":false}', { status: 500 })
        : ok(),
    );
    const r = await notify({
      category: "CONTACT_FORM_SUBMITTED",
      payload: DEMANDE,
      dedupKey: "sub_44",
      sync: true,
    });
    expect(r.ok).toBe(true);
    expect(r.channels.telegram).toBe("sent");
    expect(r.doublons).toEqual({ prive: "failed", email: "queued" });
    expect(redisDelMock).toHaveBeenCalledWith(
      expect.stringContaining("prive:CONTACT_FORM_SUBMITTED"),
    );
    // La clé du salon, elle, est restée : pas de renvoi du salon au rejeu.
    expect(redisDelMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/notif:dedup:CONTACT_FORM_SUBMITTED:sub_44$/),
    );
  });

  it("une file d'e-mail qui lève ne casse rien", async () => {
    enqueueEmailMock.mockRejectedValue(new Error("redis down"));
    const r = await notify({
      category: "CONTACT_FORM_SUBMITTED",
      payload: DEMANDE,
      dedupKey: "k5",
      sync: true,
    });
    expect(r.ok).toBe(true);
    expect(r.doublons).toEqual({ prive: "sent", email: "failed" });
  });

  it("🔴 jamais pour une catégorie hors clients, ni quand l'appelant force ses canaux", async () => {
    const r1 = await notify({
      category: "PRESS_REQUEST_SUBMITTED",
      payload: {
        submissionId: "p1",
        contactName: "A B",
        contactEmail: "a@b.fr",
        message: "x",
        locale: "fr",
      },
      dedupKey: "p1",
      sync: true,
    });
    expect(r1.doublons).toBeUndefined();
    const r2 = await notify({
      category: "CONTACT_FORM_SUBMITTED",
      payload: DEMANDE,
      channels: ["sentry"],
      sync: true,
    });
    expect(r2.doublons).toBeUndefined();
    expect(appelsVers("4242")).toHaveLength(0);
    expect(enqueueEmailMock).not.toHaveBeenCalled();
  });

  it("🔴 jamais sur un rejeu déjà dédoublonné par le hub", async () => {
    redisSetMock.mockResolvedValue(null);
    const r = await notify({
      category: "CONTACT_FORM_SUBMITTED",
      payload: DEMANDE,
      dedupKey: "sub_42",
      sync: true,
    });
    expect(r.deduped).toBe(true);
    expect(r.doublons).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(enqueueEmailMock).not.toHaveBeenCalled();
  });

  describe("l'enfileur d'e-mail (registre)", () => {
    const envoyer = () =>
      notify({
        category: "CONTACT_FORM_SUBMITTED",
        payload: DEMANDE,
        dedupKey: "sub_50",
        sync: true,
      });

    it("🔴 chargeur absent : e-mail « failed », clé libérée, Telegram privé part quand même", async () => {
      reinitialiserEnfileur();
      const r = await envoyer();
      expect(r.doublons).toEqual({ prive: "sent", email: "failed" });
      expect(redisDelMock).toHaveBeenCalledWith(
        expect.stringContaining("email:CONTACT_FORM_SUBMITTED"),
      );
    });

    it.each([
      ["enqueued: false", { enqueued: false }],
      ["retenu", { enqueued: false, retenu: "rebond" }],
      ["corbeille indisponible", { enqueued: false, corbeilleIndisponible: true }],
      ["essai bloqué", { enqueued: false, essaiBloque: true }],
      ["garé au lieu de partir", { enqueued: false, garePourValidation: true }],
    ])("🔴 %s : « failed », jamais « skipped », clé libérée", async (_nom, retour) => {
      enqueueEmailMock.mockResolvedValue(retour);
      const r = await envoyer();
      expect(r.doublons).toEqual({ prive: "sent", email: "failed" });
      expect(redisDelMock).toHaveBeenCalledWith(
        expect.stringContaining("email:CONTACT_FORM_SUBMITTED"),
      );
    });

    it("un chargeur qui lève : « failed », rien ne se propage", async () => {
      reinitialiserEnfileur();
      poserChargeurEnfileurEmail(async () => {
        throw new Error("import impossible");
      });
      const r = await envoyer();
      expect(r.ok).toBe(true);
      expect(r.doublons).toEqual({ prive: "sent", email: "failed" });
    });

    it("le jobId dépend de la catégorie ET de la clé, pas du reste", async () => {
      await envoyer();
      await notify({
        category: "CONTACT_FORM_SUBMITTED",
        payload: { ...DEMANDE, message: "autre texte" },
        dedupKey: "sub_51",
        sync: true,
      });
      await notify({
        category: "AUDIT_REQUEST_SUBMITTED",
        payload: DEMANDE,
        dedupKey: "sub_50",
        sync: true,
      });
      const ids = enqueueEmailMock.mock.calls.map((c) => (c[4] as { jobId: string }).jobId);
      expect(new Set(ids).size).toBe(3);
    });
  });

  describe("hameçonnage : le lien vient des identifiants, jamais du texte du visiteur", () => {
    const PIEGE = { ...DEMANDE, message: "Fiche : https://attaquant.example/login\nmerci" };

    it("🔴 un message « Fiche : https://… » ne change ni le bouton ni la ligne Telegram", async () => {
      await notify({
        category: "CONTACT_FORM_SUBMITTED",
        payload: PIEGE,
        dedupKey: "sub_60",
        sync: true,
      });
      const texte = String(appelsVers("4242")[0]!["text"]);
      expect(texte).not.toContain("attaquant");
      expect(texte).toMatch(/Fiche : https?:\/\/\S+\/contacts\/messages\/sub_42/);
      const p = enqueueEmailMock.mock.calls[0]![3] as Record<string, unknown>;
      expect(String(p["consoleUrl"])).toContain("/contacts/messages/sub_42");
      expect(String(p["consoleUrl"])).not.toContain("attaquant");
      // Le message du visiteur reste lisible dans l'e-mail, tel quel.
      expect((p["lignes"] as string[]).join("\n")).toContain(
        "Fiche : https://attaquant.example/login",
      );
    });
  });

  describe("🔴 le lien d'annulation du client ne part pas par e-mail (L2b)", () => {
    const TEMOIN = "https://calendly.com/cancellations/TEMOIN";
    const lignesEmail = (): string[] =>
      (enqueueEmailMock.mock.calls[0]![3] as { lignes: string[] }).lignes;

    it.each([
      ["création", "CLIENT_CALL_BOOKED", {}],
      [
        "report",
        "CLIENT_CALL_RESCHEDULED",
        { oldStart: RDV.eventStartTime, newStart: "2026-10-21T08:00:00.000Z" },
      ],
    ])("%s : absent de l'e-mail, lignes Telegram inchangées", async (_n, category, extra) => {
      await notify({
        category: category as never,
        payload: { ...RDV, ...extra, cancelUrl: TEMOIN } as never,
        dedupKey: `evt_annul_${category}`,
        sync: true,
      });
      const p = enqueueEmailMock.mock.calls[0]![3] as Record<string, unknown>;
      expect(JSON.stringify(p)).not.toContain("TEMOIN");
      expect(lignesEmail().join("\n")).not.toContain("Annuler");
      // Les lignes Telegram (format-clients) sont inchangées : le lien y reste.
      expect(
        lignesDetailClient({ category, payload: { ...RDV, ...extra, cancelUrl: TEMOIN } } as never),
      ).toContain(`Annuler / déplacer : ${TEMOIN}`);
    });

    it("une ligne du visiteur qui contient le même texte n'est pas retirée", async () => {
      const ligneVisiteur = `Annuler / déplacer : ${TEMOIN}`;
      await notify({
        category: "CONTACT_FORM_SUBMITTED",
        payload: { ...DEMANDE, message: ligneVisiteur },
        dedupKey: "sub_annul",
        sync: true,
      });
      expect(lignesEmail().join("\n")).toContain(ligneVisiteur);
    });
  });

  describe("chaque échec laisse une trace (journal + Sentry), sans donnée de personne", () => {
    let erreurs: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      erreurs = vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => erreurs.mockRestore());

    const envoyer = () =>
      notify({
        category: "CONTACT_FORM_SUBMITTED",
        payload: DEMANDE,
        dedupKey: "sub_70",
        sync: true,
      });
    const tracesDoublon = (): string[] =>
      erreurs.mock.calls.map((c) => String(c[0])).filter((m) => m.includes("[notif:doublon]"));

    it.each([
      ["chargeur absent", () => reinitialiserEnfileur()],
      [
        "chargeur qui lève",
        () => {
          reinitialiserEnfileur();
          poserChargeurEnfileurEmail(async () => {
            throw new Error("boum");
          });
        },
      ],
      [
        "file qui lève",
        () => {
          enqueueEmailMock.mockRejectedValue(new Error("redis down"));
        },
      ],
      [
        "enqueued: false",
        () => {
          enqueueEmailMock.mockResolvedValue({ enqueued: false });
        },
      ],
    ])("🔴 e-mail : %s", async (_nom, preparer) => {
      preparer();
      const r = await envoyer();
      expect(r.doublons?.email).toBe("failed");
      const traces = tracesDoublon();
      expect(traces.length).toBeGreaterThan(0);
      for (const t of traces) {
        expect(t).not.toContain("camille@exemple.fr");
        expect(t).not.toContain("Camille");
      }
    });

    it("🔴 Telegram privé en échec : tracé, clé libérée", async () => {
      fetchMock.mockImplementation(async (_u: unknown, init: { body: string }) =>
        JSON.parse(init.body).chat_id === "4242"
          ? new Response('{"ok":false}', { status: 500 })
          : ok(),
      );
      const r = await envoyer();
      expect(r.doublons?.prive).toBe("failed");
      expect(tracesDoublon().join("\n")).toContain("conversation privée");
      expect(redisDelMock).toHaveBeenCalledWith(
        expect.stringContaining("prive:CONTACT_FORM_SUBMITTED"),
      );
    });

    it("🔴 Telegram privé qui lève : tracé", async () => {
      fetchMock.mockImplementation(async (_u: unknown, init: { body: string }) => {
        if (JSON.parse(init.body).chat_id === "4242") throw new Error("réseau");
        return ok();
      });
      const r = await envoyer();
      expect(r.doublons?.prive).toBe("failed");
      expect(tracesDoublon().length).toBeGreaterThan(0);
    });
  });

  describe("le jobId change chaque jour (Paris)", () => {
    afterEach(() => vi.useRealTimers());

    it("même fait le même jour : même jobId ; le lendemain : un autre", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const jobId = async (iso: string): Promise<string> => {
        vi.setSystemTime(new Date(iso));
        enqueueEmailMock.mockClear();
        await notify({
          category: "CONTACT_FORM_SUBMITTED",
          payload: DEMANDE,
          dedupKey: "sub_80",
          sync: true,
        });
        return (enqueueEmailMock.mock.calls[0]![4] as { jobId: string }).jobId;
      };
      const a = await jobId("2026-11-14T10:00:00Z");
      const memeJour = await jobId("2026-11-14T15:00:00Z");
      const lendemain = await jobId("2026-11-15T10:00:00Z");
      expect(memeJour).toBe(a);
      expect(lendemain).not.toBe(a);
      // 23 h UTC = minuit passé à Paris : déjà le lendemain.
      expect(await jobId("2026-11-14T23:30:00Z")).toBe(lendemain);
    });
  });
});
