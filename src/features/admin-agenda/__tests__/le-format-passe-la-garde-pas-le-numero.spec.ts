// @vitest-environment node

/**
 * Verrou — dans l'agenda, un rôle NON habilité voit le format du rendez-vous,
 * et ne voit toujours pas le numéro du prospect.
 *
 * ## Deux décisions de Will qui semblaient s'opposer
 *
 * - **2026-08-27** : `/contacts/appels` est fermé à `super_admin | admin |
 *   editor`, et cet agenda-ci, qui servait les mêmes données sans jamais
 *   appeler `auth()`, a été aligné : nom, téléphone et lieu ne sont même plus
 *   SÉLECTIONNÉS pour un rôle non habilité.
 * - **2026-08-31** : « il faut que tous les rôles qui travaillent chez Axion-IA
 *   le voient. Considère que tout le monde voit tout. » — à propos du format.
 *
 * Elles ne se contredisent que si on confond deux choses. Un numéro de
 * téléphone est une donnée personnelle ; « ce rendez-vous se tient par
 * téléphone » n'en est pas une. Le code dérive donc le format côté serveur et
 * ne laisse traverser que lui.
 *
 * ## Pourquoi ce témoin, et pas une relecture
 *
 * La bascule consistait à passer `location` de `peutVoirAppels` à `true` dans le
 * `select`. Une inattention symétrique — laisser `lieu: e.location` au lieu de
 * `peutVoirAppels ? … : null` — rouvrirait la fuite sans rien changer d'autre à
 * l'écran, et personne ne la verrait. Ce test appelle la vraie fonction avec un
 * Prisma simulé, et LIT ce qui sort.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { calendlyEvent: { findMany } } }));
// L'agenda Google n'a rien à voir avec cette garde : on le déclare non
// configuré pour que la fenêtre ne contienne que la source Calendly.
vi.mock("@/server/google-calendar/client", () => ({
  isGoogleCalendarConfigured: () => false,
  listerEvenements: vi.fn(),
}));

const { getAgendaFenetre } = await import("../queries");

const DEBUT = new Date("2026-09-25T00:00:00.000Z");
const FIN = new Date("2026-09-26T00:00:00.000Z");

/** Une réservation téléphonique telle que la prod en contient 14 sur 19. */
const APPEL_TELEPHONE = {
  id: "evt_tel",
  eventTypeName: "Discutons de votre projet IA",
  status: "active",
  startTime: new Date("2026-09-25T09:30:00.000Z"),
  endTime: new Date("2026-09-25T10:15:00.000Z"),
  inviteeName: "Camille Prospect",
  inviteePhone: "+33 6 12 34 56 78",
  location: "+33 6 12 34 56 78",
  rawPayload: { event: { location: { type: "outbound_call" } } },
};

/** La même, en visioconférence — le cas qui n'existe pas encore en base. */
const APPEL_VISIO = {
  ...APPEL_TELEPHONE,
  id: "evt_visio",
  location: "https://meet.google.com/abc-defg-hij",
  rawPayload: { event: { location: { type: "google_conference" } } },
};

/**
 * Prisma ne rend que les colonnes demandées. On le simule fidèlement, sinon le
 * test passerait alors même que le `select` aurait cessé de filtrer.
 */
function commePrisma(lignes: Record<string, unknown>[]) {
  findMany.mockImplementation(async (args: { select: Record<string, boolean> }) => {
    const champs = Object.entries(args.select)
      .filter(([, pris]) => pris === true)
      .map(([nom]) => nom);
    return lignes.map((l) => Object.fromEntries(champs.map((c) => [c, l[c]])));
  });
}

beforeEach(() => {
  findMany.mockReset();
});

describe("l'agenda montre le format à tout le monde", () => {
  it("🔴 un rôle NON habilité voit le format, et pas le numéro", async () => {
    commePrisma([APPEL_TELEPHONE]);
    const { items } = await getAgendaFenetre(DEBUT, FIN, false);
    const rdv = items.find((i) => i.key === "cal_evt_tel");

    expect(rdv, "la réservation doit rester visible : on filtre, on ne cache pas").toBeDefined();
    expect(rdv?.format, "le format est l'information que Will veut partagée").toBe("telephone");

    // 🔑 Le cœur de la garde : rien de personnel ne traverse.
    expect(rdv?.lieu, "le numéro ne doit pas sortir pour un rôle non habilité").toBeNull();
    expect(rdv?.telephone).toBeNull();
    expect(rdv?.contact).toBeNull();
    expect(rdv?.detailHref).toBeNull();
    // Et le titre retombe sur le type de rendez-vous, jamais sur le prospect.
    expect(rdv?.titre).toBe("Discutons de votre projet IA");
    expect(JSON.stringify(rdv)).not.toContain("Camille");
    expect(JSON.stringify(rdv)).not.toContain("+33 6 12 34 56 78");
  });

  it("une visio est reconnue comme telle, même sans habilitation", async () => {
    commePrisma([APPEL_VISIO]);
    const { items } = await getAgendaFenetre(DEBUT, FIN, false);
    const rdv = items.find((i) => i.key === "cal_evt_visio");
    expect(rdv?.format).toBe("visio");
    // Le lien de réunion est un accès, pas seulement une adresse : il reste gardé.
    expect(rdv?.lieu).toBeNull();
    expect(JSON.stringify(rdv)).not.toContain("meet.google.com");
  });

  it("un rôle habilité voit le format ET la coordonnée", async () => {
    commePrisma([APPEL_TELEPHONE]);
    const { items } = await getAgendaFenetre(DEBUT, FIN, true);
    const rdv = items.find((i) => i.key === "cal_evt_tel");
    expect(rdv?.format).toBe("telephone");
    expect(rdv?.lieu).toBe("+33 6 12 34 56 78");
    expect(rdv?.contact).toBe("Camille Prospect");
  });

  it("🔑 CONTRE-TÉMOIN : le simulateur Prisma FILTRE vraiment", async () => {
    // Sans cette vérification, tout le fichier pourrait passer pour une mauvaise
    // raison : un simulateur qui rend toutes les colonnes quoi qu'on demande
    // ferait croire que la garde tient alors qu'on ne l'aurait jamais exercée.
    commePrisma([APPEL_TELEPHONE]);
    await getAgendaFenetre(DEBUT, FIN, false);
    const select = findMany.mock.calls[0]?.[0]?.select as Record<string, boolean>;
    expect(select, "le select doit être lisible depuis l'appel").toBeDefined();
    expect(select["inviteePhone"], "le téléphone ne doit pas être demandé").toBe(false);
    expect(select["location"], "le lieu EST demandé — c'est ce qui dérive le format").toBe(true);
    // Et la simulation en tient compte : la ligne rendue n'a pas de téléphone.
    const rendu = await findMany.mock.results[0]?.value;
    expect(Object.keys(rendu[0])).not.toContain("inviteePhone");
    expect(Object.keys(rendu[0])).toContain("location");
  });
});
