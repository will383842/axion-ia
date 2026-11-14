// @vitest-environment node
//
// PR-S2a — le guide IA est EN PRODUCTION (lien Facebook) : ce fichier FIGE, octet pour octet, ce qu'il
// livre AUJOURD'HUI, avant que « livrer le bon guide » (PR-S2b) ne touche au code. Les références ont été
// enregistrées sur `origin/main` SANS aucune modification de code ; S2b ne doit PAS les modifier.
//
//   · l'e-mail « Votre guide » (sujet, HTML, texte) FR/EN pour chaque variante réellement envoyée ;
//   · la charge passée à `enqueueEmail` par chacun des appelants à aimant `guide-ia` (aucune clé en trop) ;
//   · la page du lien (GET) et la redirection (POST 303 vers `urlGuideIa()`), sans jamais lire `cibles_reseau`.
//
// Le chemin guide-ia ne lit JAMAIS la table des cibles : le modèle `cibleReseau` du faux client lève.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

type Ligne = Record<string, unknown>;

const bd = vi.hoisted(() => ({
  envois: [] as unknown[][],
  lecturesCibles: 0,
  reponses: {} as Record<string, (a: Ligne) => unknown>,
}));

function valeurParDefaut(methode: string): unknown {
  if (methode === "count") return 0;
  if (methode === "findMany") return [];
  if (methode === "findUnique" || methode === "findFirst") return null;
  if (methode === "updateMany" || methode === "deleteMany") return { count: 1 };
  return { id: "x" };
}

vi.mock("@/lib/prisma", () => {
  const modele = (nom: string) =>
    new Proxy(
      {},
      {
        get:
          (_c, methode: string) =>
          async (a: Ligne = {}) => {
            if (nom === "cibleReseau") {
              bd.lecturesCibles += 1;
              throw new Error("cibles_reseau ne doit JAMAIS être lue par le chemin guide-ia");
            }
            const f = bd.reponses[`${nom}.${methode}`];
            return f ? f(a) : valeurParDefaut(methode);
          },
      },
    );
  return {
    prisma: new Proxy(
      {},
      {
        get: (_c, nom: string) => {
          if (nom === "$transaction") return async (fn: (t: unknown) => unknown) => fn({});
          if (nom === "$executeRaw" || nom === "$queryRaw") return async () => 0;
          return modele(nom);
        },
      },
    ),
  };
});
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: async (...a: unknown[]) => {
    bd.envois.push(a);
    return { enqueued: true };
  },
}));
vi.mock("../coupe-circuit", () => ({ coupeCircuitDeclenche: async () => false }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/analytics/plausible-serveur", () => ({
  emettreEvenementPlausible: async () => true,
}));
vi.mock("@/server/guides-reseau/preuve-page-guide", () => ({
  confirmerPreuvesAuClic: async () => undefined,
}));
vi.mock("@/server/crm-sync/lettre-guide", () => ({
  transmettreClicGuide: async () => undefined,
  transmettreInscriptionApresClic: async () => undefined,
}));
vi.mock("@/server/notifications", () => ({ notify: async () => undefined }));
vi.mock("@/lib/consents", () => ({ recordConsentEvent: async () => true }));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => `h:${e.trim().toLowerCase()}`,
}));
vi.mock("@/lib/email/nature-adresse", () => ({ natureAdresse: () => "pro" }));
vi.mock("@/server/email/opposition-jeton", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  jetonOpposition: () => "opp.jeton-opaque",
}));
vi.mock("@/server/email/opposition", () => ({ estOpposee: async () => false }));
vi.mock("@/server/email/verdict-envoi", () => ({
  verdictAvantEnvoi: async () => ({ retenu: false }),
}));

import { renderEmailTemplate } from "@/lib/email/templates";
import { enregistrerDemandeGuide } from "../demande";
import { envoyerGuideAAbonne, renvoyerGuide } from "../envoi-console";
import { rattraperGuides } from "../rattrapage";
// La route est elle aussi figée ici : un test lit l'app, jamais l'inverse.
// eslint-disable-next-line no-restricted-imports
import { GET, POST } from "@/app/api/guide-ia/telecharger/route";
import { urlGuideIa } from "@/content/guide-ia";

const D = "d".repeat(64);
const U = "u".repeat(64);
const C = "c".repeat(64);
const O = "o".repeat(40);
const MAINTENANT = new Date("2026-11-14T10:00:00.000Z");

beforeEach(() => {
  bd.envois.length = 0;
  bd.lecturesCibles = 0;
  for (const k of Object.keys(bd.reponses)) delete bd.reponses[k];
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://axion-ia.com");
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/**
 * Le jeton d'opposition signé du pied de page (`/api/unsubscribe?token=…`) est une valeur à forte entropie :
 * l'écrire dans un snapshot ferait lever gitleaks. Seule cette valeur est remplacée ; tout le reste du HTML
 * et du texte reste comparé octet pour octet.
 */
const sansJetonSigne = (t: string): string =>
  t.replace(/(\/api\/unsubscribe\?token=)[^"&\s<]+/g, "$1<JETON-SIGNE>");

// ── 1. L'e-mail, octet pour octet ─────────────────────────────────────────────
const VARIANTES: Record<string, Ligne> = {
  "formulaire-simple": { downloadToken: D },
  "inscrit-lettre": { downloadToken: D, unsubscribeToken: U },
  desabonne: { downloadToken: D, confirmToken: C },
  reseau: { downloadToken: D, reseau: true },
  "page-du-guide-avec-reseau-origine": {
    downloadToken: D,
    reseau: true,
    pageGuide: true,
    oppositionToken: O,
    reseauOrigine: "instagram",
  },
  "page-du-guide-sans-reseau-origine": {
    downloadToken: D,
    reseau: true,
    pageGuide: true,
    oppositionToken: O,
  },
  reprise: { downloadToken: D, reprise: true },
};

describe("l'e-mail « Votre guide » — références (sujet, HTML, texte)", () => {
  for (const [nom, payload] of Object.entries(VARIANTES)) {
    for (const locale of ["fr", "en"] as const) {
      it(`${nom} · ${locale}`, async () => {
        const r = await renderEmailTemplate("guide-ia-envoi", locale, payload, {
          destinataire: "personne@example.test",
        });
        expect(r.subject).toMatchSnapshot("sujet");
        expect(sansJetonSigne(r.html)).toMatchSnapshot("html");
        expect(sansJetonSigne(r.text)).toMatchSnapshot("texte");
      });
    }
  }
});

// ── 2. La charge passée à enqueueEmail, clé pour clé ───────────────────────────
function envoiUnique(): {
  gabarit: unknown;
  to: unknown;
  loc: unknown;
  payload: unknown;
  opts: unknown;
} {
  expect(bd.envois).toHaveLength(1);
  const [gabarit, to, loc, payload, opts] = bd.envois[0]!;
  return { gabarit, to, loc, payload, opts };
}
const OPTS = { entityType: "GuideRequest", entityId: "demande-1", priority: 10 };

describe("la charge de l'e-mail — chaque appelant à aimant guide-ia (aucune clé en trop)", () => {
  it("formulaire (demande.ts) : inscrit à la lettre ⇒ downloadToken + unsubscribeToken", async () => {
    bd.reponses["guideRequest.findUnique"] = () => null;
    bd.reponses["guideRequest.create"] = () => ({ id: "demande-1", downloadToken: D });
    bd.reponses["newsletterSubscriber.findUnique"] = () => ({
      id: "a1",
      email: "jeanne@example.invalid",
      status: "confirmed",
      unsubscribeToken: U,
      confirmToken: null,
    });
    await enregistrerDemandeGuide({
      email: "jeanne@example.invalid",
      locale: "fr",
      source: "guide-ia",
      variante: "guide",
      caseLettre: false,
      ipHash: "empreinte",
      ip: "192.0.2.1",
      userAgent: "agent",
    } as never);
    const e = envoiUnique();
    expect(e.gabarit).toBe("guide-ia-envoi");
    expect(e.to).toBe("jeanne@example.invalid");
    expect(e.loc).toBe("fr");
    expect(Object.keys(e.payload as object).sort()).toEqual(["downloadToken", "unsubscribeToken"]);
    expect((e.payload as Ligne)["downloadToken"]).toBe(D);
    expect(e.opts).toEqual(OPTS);
    expect(bd.lecturesCibles).toBe(0);
  });

  it("console, « envoyer » (envoi-console.ts) : downloadToken seul, reprise ⇒ + reprise", async () => {
    bd.reponses["newsletterSubscriber.findUnique"] = (a) =>
      (a["select"] as Ligne | undefined)?.["status"] === true
        ? { id: "a1", email: "jeanne@example.invalid", locale: "fr", status: "confirmed" }
        : null;
    bd.reponses["guideRequest.findUnique"] = (a) =>
      (a["select"] as Ligne | undefined)?.["sentAt"] === true &&
      Object.keys(a["select"] as Ligne).length === 1
        ? { sentAt: null }
        : {
            id: "demande-1",
            email: "jeanne@example.invalid",
            locale: "fr",
            downloadToken: D,
            origine: "formulaire",
            aimant: "guide-ia",
            queuedAt: null,
            sentAt: null,
          };
    const r = await envoyerGuideAAbonne("a1", { adminUserId: "admin-1", maintenant: MAINTENANT });
    expect(r.resultat).toBe("en-file");
    const e = envoiUnique();
    expect(e.payload).toStrictEqual({ downloadToken: D });
    expect(e.opts).toEqual(OPTS);
    expect(bd.lecturesCibles).toBe(0);
  });

  it("console, « renvoyer » avec reprise : downloadToken + reprise", async () => {
    bd.reponses["guideRequest.findUnique"] = () => ({
      id: "demande-1",
      email: "jeanne@example.invalid",
      locale: "en",
      downloadToken: D,
      origine: "formulaire",
      aimant: "guide-ia",
      queuedAt: null,
      sentAt: new Date("2026-11-01T00:00:00Z"),
    });
    const r = await renvoyerGuide("demande-1", {
      adminUserId: "admin-1",
      reprise: true,
      maintenant: MAINTENANT,
    });
    expect(r.resultat).toBe("en-file");
    const e = envoiUnique();
    expect(e.loc).toBe("en");
    expect(e.payload).toStrictEqual({ downloadToken: D, reprise: true });
    expect(bd.lecturesCibles).toBe(0);
  });

  it("rattrapage (rattrapage.ts) : formulaire ⇒ downloadToken seul ; message privé ⇒ + reseau", async () => {
    const candidate = (id: string, origine: string) => ({
      id,
      email: `${id}@example.invalid`,
      locale: "fr",
      downloadToken: D,
      sendCount: 0,
      origine,
      aimant: "guide-ia",
    });
    bd.reponses["guideRequest.findMany"] = () => [
      candidate("demande-1", "formulaire"),
      candidate("demande-2", "message_prive"),
    ];
    bd.reponses["guideRequest.findUnique"] = () => ({ sentAt: null, sendCount: 0 });
    await rattraperGuides(MAINTENANT);
    expect(bd.envois).toHaveLength(2);
    expect(bd.envois[0]![3]).toStrictEqual({ downloadToken: D });
    expect(bd.envois[1]![3]).toStrictEqual({ downloadToken: D, reseau: true });
    expect(bd.lecturesCibles).toBe(0);
  });
});

// ── 3. Le téléchargement ──────────────────────────────────────────────────────
const BASE = "https://axion-ia.com";
const JETON = "a1".repeat(32);

describe("/api/guide-ia/telecharger — guide-ia", () => {
  it("GET : la page du lien est figée (FR et EN), sans lire cibles_reseau", async () => {
    for (const locale of ["fr", "en"] as const) {
      bd.reponses["guideRequest.findUnique"] = () => ({
        id: "demande-1",
        locale,
        aimant: "guide-ia",
      });
      const res = await GET(new NextRequest(`${BASE}/api/guide-ia/telecharger?t=${JETON}`));
      expect(res.status).toBe(200);
      expect(Object.fromEntries(res.headers)).toMatchSnapshot(`entetes-${locale}`);
      expect(await res.text()).toMatchSnapshot(`page-${locale}`);
    }
    expect(bd.lecturesCibles).toBe(0);
  });

  it("POST : 303 vers urlGuideIa(), sans lire cibles_reseau", async () => {
    bd.reponses["guideRequest.findUnique"] = () => ({
      id: "demande-1",
      source: "guide-ia",
      locale: "fr",
      aimant: "guide-ia",
    });
    const res = await POST(
      new NextRequest(`${BASE}/api/guide-ia/telecharger`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `t=${JETON}`,
      }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(urlGuideIa());
    expect(bd.lecturesCibles).toBe(0);
  });

  it("POST : un jeton inconnu reste un 404 (page figée)", async () => {
    bd.reponses["guideRequest.findUnique"] = () => null;
    const res = await POST(
      new NextRequest(`${BASE}/api/guide-ia/telecharger`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `t=${JETON}`,
      }),
    );
    expect(res.status).toBe(404);
    expect(await res.text()).toMatchSnapshot("introuvable");
  });
});
