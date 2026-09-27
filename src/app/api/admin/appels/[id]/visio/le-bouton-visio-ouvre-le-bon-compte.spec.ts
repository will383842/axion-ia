// « Rejoindre la visio » ouvre la salle sur le compte qui organise (2026-09-27).
//
// La charge ci-dessous est la forme RÉELLE lue en production sur le rendez-vous
// TELEOS du 28/09 (identifiants conservés, adresses remplacées) : Calendly
// enregistre une redirection, pas le lien Meet, et cette redirection perd
// `?authuser=`. D'où la route, et d'où ces tests.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { calendlyEvent: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import {
  avecCompteGoogle,
  compteOrganisateur,
  estLienVisio,
  estRedirectionCalendly,
  invitesSupplementaires,
  lienRejoindreVisio,
  momentVisio,
} from "@/features/admin-rendezvous/visio";
import { GET } from "./route";

const REDIRECTION = "https://calendly.com/events/fdf98536-f02d-4be4-ad15-35dfe2ad2ac3/google_meet";
const MEET = "https://meet.google.com/wts-pffy-ktm";
const ORGANISATEUR = "organisateur@example.com";

const CHARGE = {
  event: {
    location: { type: "google_conference", status: "pushed", join_url: REDIRECTION },
    event_memberships: [{ user_email: ORGANISATEUR }],
    event_guests: [{ email: "collegue@example.com" }],
  },
};

function appeler(id = "evt_1") {
  return GET({} as never, { params: Promise.resolve({ id }) });
}

describe("le lien de visio", () => {
  it("n'accepte que du https — une adresse, un numéro ou un javascript: ne sont pas des visios", () => {
    expect(estLienVisio(REDIRECTION)).toBe(true);
    expect(estLienVisio(MEET)).toBe(true);
    expect(estLienVisio("+33 6 12 34 56 78")).toBe(false);
    expect(estLienVisio("12 rue de la Paix, Lyon")).toBe(false);
    expect(estLienVisio("javascript:alert(1)")).toBe(false);
    expect(estLienVisio("http://meet.google.com/abc")).toBe(false);
    expect(estLienVisio(null)).toBe(false);
  });

  it("le bouton pointe sur la route console, jamais sur le lien brut", () => {
    expect(lienRejoindreVisio("evt_1", REDIRECTION)).toBe("/api/admin/appels/evt_1/visio");
    expect(lienRejoindreVisio("evt_1", "+33 6 12 34 56 78")).toBeNull();
  });

  it("lit l'organisateur et les invités supplémentaires dans la charge Calendly", () => {
    expect(compteOrganisateur(CHARGE)).toBe(ORGANISATEUR);
    expect(invitesSupplementaires(CHARGE)).toEqual(["collegue@example.com"]);
    expect(compteOrganisateur({})).toBeNull();
    expect(invitesSupplementaires(null)).toEqual([]);
  });

  it("pose authuser sur Meet seulement", () => {
    expect(avecCompteGoogle(MEET, ORGANISATEUR)).toBe(
      `${MEET}?authuser=${encodeURIComponent(ORGANISATEUR)}`,
    );
    expect(avecCompteGoogle("https://zoom.us/j/123", ORGANISATEUR)).toBe("https://zoom.us/j/123");
    expect(avecCompteGoogle(MEET, null)).toBe(MEET);
  });

  it("ne suit que la redirection Calendly — pas n'importe quelle adresse saisie", () => {
    expect(estRedirectionCalendly(REDIRECTION)).toBe(true);
    expect(estRedirectionCalendly("https://calendly.com.evil.example/events/x")).toBe(false);
    expect(estRedirectionCalendly("https://intranet.local/events/x")).toBe(false);
  });
});

describe("le moment de la visio", () => {
  const debut = new Date("2026-09-28T13:30:00Z");
  const fin = new Date("2026-09-28T14:15:00Z");

  it("passe en évidence 10 minutes avant, reste pendant, disparaît après", () => {
    expect(momentVisio(debut, fin, new Date("2026-09-28T13:19:00Z"))).toBe("a-venir");
    expect(momentVisio(debut, fin, new Date("2026-09-28T13:20:00Z"))).toBe("imminente");
    expect(momentVisio(debut, fin, new Date("2026-09-28T14:00:00Z"))).toBe("imminente");
    expect(momentVisio(debut, fin, new Date("2026-09-28T14:16:00Z"))).toBe("terminee");
  });
});

describe("GET /api/admin/appels/[id]/visio", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    findUnique.mockResolvedValue({ location: REDIRECTION, rawPayload: CHARGE });
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { location: MEET } }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("ouvre le VRAI lien Meet, sur le compte organisateur", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "super_admin" } });

    const res = await appeler();

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      `${MEET}?authuser=${encodeURIComponent(ORGANISATEUR)}`,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      REDIRECTION,
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("si Calendly ne répond pas, renvoie sur son lien — il mène quand même à la salle", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    fetchMock.mockRejectedValue(new Error("timeout"));

    const res = await appeler();

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(REDIRECTION);
  });

  it("un lien Meet direct est ouvert sans appel réseau", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    findUnique.mockResolvedValue({ location: MEET, rawPayload: CHARGE });

    const res = await appeler();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("authuser=");
  });

  it("sans session : vers la connexion, sans lire la base", async () => {
    authMock.mockResolvedValue(null);

    const res = await appeler();

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/fr/adm/login");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it.each(["reader", "secretaire", "responsable_qualite"])(
    "refuse le rôle « %s » avant de lire la base",
    async (role) => {
      authMock.mockResolvedValue({ user: { id: "u1", role } });

      const res = await appeler();

      expect(res.status).toBe(403);
      expect(findUnique).not.toHaveBeenCalled();
    },
  );

  it("un rendez-vous par téléphone n'a pas de visio à ouvrir", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    findUnique.mockResolvedValue({ location: "+33 6 12 34 56 78", rawPayload: {} });

    const res = await appeler();

    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
  });
});
