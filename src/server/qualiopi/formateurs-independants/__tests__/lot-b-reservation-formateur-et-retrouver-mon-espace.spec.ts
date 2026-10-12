/**
 * Lot B, M25 — réservation de l'échange et « Retrouver mon espace ».
 *
 *   · le jeton signé des liens F1 / F7 désigne la candidature, sans rien de personnel ;
 *   · il préremplit le formulaire de réservation pour une candidature de formateur
 *     FREELANCE seulement (nature de la candidature lue d'abord) ;
 *   · l'écran de fin n'annonce nos e-mails que s'ils partent vraiment (suivi des
 *     échanges allumé ET textes F3 / F4 validés).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  etatsEntree: vi.fn(),
  texteValide: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { jobApplication: { findUnique: (...a: unknown[]) => h.findUnique(...a) } },
}));
vi.mock("@/lib/pii-crypto", async (orig) => ({
  ...(await orig<object>()),
  decryptPii: (v: string) => v.replace(/^enc:/, ""),
}));
vi.mock("@/server/qualiopi/formateurs-independants/etats-entree", () => ({
  lireEtatsEntree: () => h.etatsEntree(),
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-etat", () => ({
  lireEtatsInterrupteurs: async () => ({ textes_valides: true }),
}));
vi.mock("@/server/email/textes-valides-lecture", () => ({ lireTextesValides: async () => ({}) }));
vi.mock("@/server/email/textes-valides", () => ({
  estTexteValide: (_r: unknown, g: string) => h.texteValide(g),
}));

import { estCandidatureFormateurFreelance } from "@/lib/careers/formateur-freelance";
import { nosEmailsPourEchangeFormateur } from "@/server/calendly/annonces-echange-formateur";
import { configDuChoix } from "@/server/calendly/types-reservables";

import { identiteDuJetonReservation } from "../identite-reservation";
import {
  candidatureDuJetonReservation,
  jetonReservationFormateur,
  lienEchangeFormateur,
} from "../jeton-reservation";

const CAND = "0b7c3a52-4a0e-4d4c-9f43-2f6a7d1c9e10";
const MAINTENANT = new Date("2026-10-12T09:00:00Z");
const OFFRE_FREELANCE = {
  slug: "formateur-ia-freelance",
  titleFr: "Formateur IA freelance",
  employmentType: "CONTRACTOR",
  secondaryEmploymentType: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.findUnique.mockResolvedValue({
    firstName: "enc:Camille",
    lastName: "enc:Martin",
    email: "enc:camille@exemple.fr",
    offerTitleSnap: "Formateur IA freelance",
    natureCollaboration: null,
    offer: OFFRE_FREELANCE,
  });
  h.etatsEntree.mockResolvedValue({ suivi_echange: true });
  h.texteValide.mockReturnValue(true);
});

describe("le jeton de réservation", () => {
  it("désigne la candidature, et rien d'autre", () => {
    const j = jetonReservationFormateur(CAND, MAINTENANT)!;
    expect(j.startsWith(`${CAND}.`)).toBe(true);
    expect(j).not.toMatch(/@|camille/i);
    expect(candidatureDuJetonReservation(j, MAINTENANT)).toBe(CAND);
  });

  it("altéré, échu ou mal formé : rien", () => {
    const j = jetonReservationFormateur(CAND, MAINTENANT)!;
    const autre = "1b7c3a52-4a0e-4d4c-9f43-2f6a7d1c9e10";
    expect(candidatureDuJetonReservation(j.replace(CAND, autre), MAINTENANT)).toBeNull();
    expect(
      candidatureDuJetonReservation(j, new Date(MAINTENANT.getTime() + 31 * 86_400_000)),
    ).toBeNull();
    expect(candidatureDuJetonReservation("x", MAINTENANT)).toBeNull();
    expect(candidatureDuJetonReservation(42, MAINTENANT)).toBeNull();
  });

  it("le lien F1 / F7 porte le marqueur de rattachement ET le jeton", () => {
    const l = lienEchangeFormateur(CAND, MAINTENANT);
    const u = new URL(l);
    expect(u.pathname).toBe("/fr/appel/formateur-independant");
    expect(u.searchParams.get("depuis")).toBe(`fa-${CAND}`);
    expect(candidatureDuJetonReservation(u.searchParams.get("j"), MAINTENANT)).toBe(CAND);
  });
});

describe("identiteDuJetonReservation — le préremplissage", () => {
  it("candidature de formateur freelance : nom et adresse en clair", async () => {
    const j = jetonReservationFormateur(CAND, MAINTENANT);
    expect(await identiteDuJetonReservation(j, MAINTENANT)).toEqual({
      nom: "Camille Martin",
      email: "camille@exemple.fr",
    });
  });

  it("jeton faux : la base n'est même pas lue", async () => {
    expect(await identiteDuJetonReservation("faux", MAINTENANT)).toBeNull();
    expect(h.findUnique).not.toHaveBeenCalled();
  });

  it("candidature à la nature « salarié » : rien, même sur une offre freelance", async () => {
    h.findUnique.mockResolvedValue({
      firstName: "enc:Camille",
      lastName: "enc:Martin",
      email: "enc:camille@exemple.fr",
      offerTitleSnap: "Formateur IA freelance",
      natureCollaboration: "salarie",
      offer: OFFRE_FREELANCE,
    });
    expect(
      await identiteDuJetonReservation(jetonReservationFormateur(CAND, MAINTENANT), MAINTENANT),
    ).toBeNull();
  });

  it("adresse effacée : rien", async () => {
    h.findUnique.mockResolvedValue({
      firstName: "enc:Camille",
      lastName: "enc:Martin",
      email: "enc:x@erased.local",
      offerTitleSnap: "Formateur IA freelance",
      natureCollaboration: "freelance",
      offer: null,
    });
    expect(
      await identiteDuJetonReservation(jetonReservationFormateur(CAND, MAINTENANT), MAINTENANT),
    ).toBeNull();
  });
});

describe("estCandidatureFormateurFreelance — la nature de la CANDIDATURE d'abord", () => {
  it("nature figée au dépôt : elle décide", () => {
    expect(
      estCandidatureFormateurFreelance({
        offerTitleSnap: "Formateur IA",
        natureCollaboration: "freelance",
        offer: null,
      }),
    ).toBe(true);
    expect(
      estCandidatureFormateurFreelance({
        offerTitleSnap: "Formateur IA freelance",
        natureCollaboration: "salarie",
        offer: OFFRE_FREELANCE,
      }),
    ).toBe(false);
  });

  it("sans nature (candidature antérieure) ou pour une OFFRE : la règle d'avant", () => {
    expect(
      estCandidatureFormateurFreelance({ offerTitleSnap: "Formateur IA freelance", offer: null }),
    ).toBe(true);
    // Une offre ne lit jamais ce champ ici (sa nature passe par `estOffreFormateurFreelance`).
    expect(
      estCandidatureFormateurFreelance({
        ...OFFRE_FREELANCE,
        natureCollaboration: "salarie",
      } as never),
    ).toBe(true);
  });
});

describe("l'écran de fin n'annonce que ce qui part", () => {
  it("suivi allumé et textes F3 / F4 validés : nos e-mails sont annoncés", async () => {
    expect(await nosEmailsPourEchangeFormateur()).toBe(true);
    expect(h.texteValide).toHaveBeenCalledWith("formateur-echange-confirme");
    expect(h.texteValide).toHaveBeenCalledWith("formateur-echange-rappel");
  });

  it("suivi coupé, ou un texte non validé : rien d'annoncé (comme avant)", async () => {
    h.etatsEntree.mockResolvedValue({ suivi_echange: false });
    expect(await nosEmailsPourEchangeFormateur()).toBe(false);
    h.etatsEntree.mockResolvedValue({ suivi_echange: true });
    h.texteValide.mockImplementation((g: string) => g !== "formateur-echange-rappel");
    expect(await nosEmailsPourEchangeFormateur()).toBe(false);
  });

  it("la page de réservation a deux textes : sans et avec nos e-mails", () => {
    const c = configDuChoix("formateur");
    expect(c.deuxiemeEtape).toMatch(/invitation d'agenda/);
    expect(c.deuxiemeEtapeAvecNosEmails).toMatch(/confirmation/);
    expect(c.deuxiemeEtapeAvecNosEmails).toMatch(/veille/);
  });
});
