// @vitest-environment node
/**
 * La fiche prospect se crée TOUTE SEULE à la réservation d'un rendez-vous
 * Calendly de la liste blanche (décision de Will, 24/10/2026) — `fiche-auto.ts`.
 *
 * Gardes : création sans clic ; rattachement à la fiche existante quand
 * l'adresse l'identifie ; un doute (refus de la porte, fiche proche ambiguë)
 * reste « à classer » et fait signaler le balayage ; idempotence ; test interne
 * exclu ; un client n'est jamais rétrogradé ; interrupteur `DOSSIER_FICHE_AUTO`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refus = vi.hoisted(() => ({ courant: null as null | Record<string, unknown> }));

vi.mock("@/server/qualiopi/crm/porte-client", async () => {
  const { porteSimulee } = await import("./_porte-simulee");
  return {
    creerOuRetrouverClient: (...a: Parameters<typeof porteSimulee>) =>
      refus.courant ? Promise.resolve(refus.courant) : porteSimulee(...a),
  };
});

// La relance du compte rendu (file BullMQ) n'est pas l'objet de ce test : pas de compte rendu.
vi.mock("@/server/visio/gestes-compte-rendu", () => ({
  completerApresRattachement: async () => null,
}));

import { passerBalayage } from "@/server/visio/balayage";
import {
  assurerFicheProspectAuto,
  assurerLesFichesProspectAuto,
  ficheAutoActive,
} from "../fiche-auto";
import { assurerRencontrePourCalendly } from "../rencontre-calendly";
import { appelsPorte } from "./_porte-simulee";
import { CLE_TEST, dossierEnMemoire, fiche, rendezVousCalendly } from "./_dossier-en-memoire";
import type { BaseEnMemoire } from "./_prisma-en-memoire";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const BORNE = new Date("2026-10-01T00:00:00Z");
const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
const relancer = vi.fn(async () => true);

beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
  vi.stubEnv("DOSSIER_FICHE_AUTO", "true");
  appelsPorte.length = 0;
  refus.courant = null;
  relancer.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

const superAdmin = () => ({
  id: ADMIN,
  role: "super_admin",
  status: "active",
  createdAt: new Date("2026-01-01T00:00:00Z"),
});

function avecEntreprise(nom: string) {
  return {
    event: { location: { type: "google_conference" } },
    invitee: { questions_and_answers: [{ question: "Nom de l'entreprise", answer: nom }] },
  };
}

async function scene(
  evs: Array<Record<string, unknown>>,
  extra: Record<string, Array<Record<string, unknown>>> = {},
) {
  const base = dossierEnMemoire({ calendlyEvent: evs, adminUser: [superAdmin()], ...extra });
  const rencontres: string[] = [];
  for (const ev of evs) {
    const a = await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, {
      borne: BORNE,
    });
    if (a.statut !== "creee") throw new Error("rencontre");
    rencontres.push(a.rencontreId);
  }
  return { base, rencontres };
}

const passage = (base: BaseEnMemoire) =>
  assurerLesFichesProspectAuto(base.client as never, { relancer });

describe("la fiche prospect se crée toute seule au rendez-vous Calendly", () => {
  it("crée la fiche prospect au nom de l'entreprise déclarée et y range la rencontre", async () => {
    const { base, rencontres } = await scene([
      rendezVousCalendly({ rawPayload: avecEntreprise("Menuiserie Fictive") }),
    ]);
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 1, rattachees: 0, laisseesAClasser: 0 });
    const clients = base.tables["client"] ?? [];
    expect(clients).toHaveLength(1);
    expect(clients[0]).toMatchObject({
      raisonSociale: "Menuiserie Fictive",
      type: "entreprise",
      statut: "prospect",
    });
    expect(clients[0]?.["siren"]).toBeUndefined();
    const r = base.tables["rencontre"]?.find((x) => x["id"] === rencontres[0]);
    expect(r).toMatchObject({ clientId: clients[0]?.["id"], rattachementStatut: "valide" });
    expect(r?.["rattacheParId"]).toBe(ADMIN);
    expect(relancer).toHaveBeenCalledWith(rencontres[0]);
  });

  it("sans entreprise déclarée : fiche de type particulier au nom de l'invité", async () => {
    const { base } = await scene([rendezVousCalendly()]);
    await passage(base);
    expect(base.tables["client"]?.[0]).toMatchObject({
      raisonSociale: "Camille Prospect",
      type: "particulier",
      statut: "prospect",
    });
  });

  it("rattache à la fiche existante quand l'adresse l'identifie, sans créer de doublon", async () => {
    const existante = fiche({
      raisonSociale: "Atelier Existant",
      contactEmail: "camille@exemple-fictif.fr",
    });
    const { base, rencontres } = await scene([rendezVousCalendly()], { client: [existante] });
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 0, rattachees: 1 });
    expect(base.tables["client"]).toHaveLength(1);
    expect(base.tables["rencontre"]?.find((x) => x["id"] === rencontres[0])).toMatchObject({
      clientId: existante["id"],
      rattachementStatut: "valide",
    });
    expect(appelsPorte).toHaveLength(0);
  });

  it("un client existant n'est jamais rétrogradé en prospect", async () => {
    const cliente = fiche({
      raisonSociale: "Atelier Cliente",
      contactEmail: "camille@exemple-fictif.fr",
      statut: "client_actif",
    });
    const { base } = await scene([rendezVousCalendly()], { client: [cliente] });
    await passage(base);
    expect(base.tables["client"]?.find((c) => c["id"] === cliente["id"])?.["statut"]).toBe(
      "client_actif",
    );
  });

  it("un refus de la porte laisse la rencontre à classer, sans rien forcer", async () => {
    refus.courant = {
      statut: "motif_requis",
      proches: [],
      message: "Cette adresse e-mail est déjà connue.",
    };
    const { base, rencontres } = await scene([rendezVousCalendly()]);
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 0, laisseesAClasser: 1 });
    expect(base.tables["client"] ?? []).toHaveLength(0);
    expect(base.tables["rencontre"]?.find((x) => x["id"] === rencontres[0])).toMatchObject({
      clientId: null,
      rattachementStatut: "a_classer",
    });
    expect(relancer).not.toHaveBeenCalled();
  });

  it("un refus pour le SIREN est de même laissé à classer", async () => {
    refus.courant = {
      statut: "refuse_siren",
      fiche: { id: "x", numero: "AXI-CLI-001", raisonSociale: "Autre" },
      message: "Ce SIREN est déjà pris.",
    };
    const { base } = await scene([rendezVousCalendly()]);
    expect((await passage(base)).laisseesAClasser).toBe(1);
    expect(base.tables["client"] ?? []).toHaveLength(0);
  });

  it("une proposition faible (même entreprise déclarée) n'est pas rangée toute seule", async () => {
    const homonyme = fiche({ raisonSociale: "Menuiserie Fictive" });
    const { base } = await scene(
      [rendezVousCalendly({ rawPayload: avecEntreprise("Menuiserie Fictive") })],
      { client: [homonyme] },
    );
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 0, rattachees: 0, laisseesAClasser: 1 });
    expect(base.tables["client"]).toHaveLength(1);
  });

  it("deux fiches au même domaine professionnel : ambigu, rien n'est créé", async () => {
    const a = fiche({ raisonSociale: "Cabinet A" });
    const b = fiche({ raisonSociale: "Cabinet B" });
    const base = dossierEnMemoire({
      calendlyEvent: [rendezVousCalendly({ inviteeEmail: "x@cabinet-fictif.fr" })],
      adminUser: [superAdmin()],
      client: [a, b],
      clientContact: [
        { id: "c1", clientId: a["id"] },
        { id: "c2", clientId: b["id"] },
      ],
      clientContactAdresse: [
        { contactId: "c1", email: "a@cabinet-fictif.fr", emailHash: "h1" },
        { contactId: "c2", email: "b@cabinet-fictif.fr", emailHash: "h2" },
      ],
    });
    const ev = base.tables["calendlyEvent"]?.[0] as Record<string, unknown>;
    await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, {
      borne: BORNE,
    });
    const bilan = await passage(base);
    expect(bilan.laisseesAClasser).toBe(1);
    expect(base.tables["client"]).toHaveLength(2);
  });

  it("idempotent : un second passage ne crée ni seconde fiche ni seconde rangée", async () => {
    const { base } = await scene([
      rendezVousCalendly({ rawPayload: avecEntreprise("Menuiserie Fictive") }),
    ]);
    await passage(base);
    const second = await passage(base);
    expect(second).toMatchObject({ creees: 0, rattachees: 0, laisseesAClasser: 0 });
    expect(base.tables["client"]).toHaveLength(1);
    expect(appelsPorte).toHaveLength(1);
  });

  it("le même titulaire qui réserve deux fois retombe sur sa fiche", async () => {
    const un = rendezVousCalendly({ rawPayload: avecEntreprise("Menuiserie Fictive") });
    const { base } = await scene([un]);
    await passage(base);
    const deux = rendezVousCalendly({
      startTime: new Date("2026-10-13T08:00:00Z"),
      endTime: new Date("2026-10-13T08:45:00Z"),
    });
    base.tables["calendlyEvent"]?.push(deux);
    await assurerRencontrePourCalendly(base.client as never, deux["id"] as string, {
      borne: BORNE,
    });
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 0, rattachees: 1 });
    expect(base.tables["client"]).toHaveLength(1);
  });

  it("une rencontre déjà rangée par un autre passage est reconnue, jamais comptée en doute", async () => {
    const { base, rencontres } = await scene([
      rendezVousCalendly({ rawPayload: avecEntreprise("Menuiserie Fictive") }),
    ]);
    await passage(base);
    const issue = await assurerFicheProspectAuto(base.client as never, rencontres[0]!, {
      relancer,
    });
    expect(issue.statut).toBe("deja_rangee");
  });

  it("une rencontre de test interne est exclue", async () => {
    const { base, rencontres } = await scene([rendezVousCalendly()]);
    const r = base.tables["rencontre"]?.find((x) => x["id"] === rencontres[0]);
    if (r) r["estTestInterne"] = true;
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 0, rattachees: 0, laisseesAClasser: 0 });
    expect(base.tables["client"] ?? []).toHaveLength(0);
  });

  it("une reprise d'historique est exclue", async () => {
    const { base, rencontres } = await scene([rendezVousCalendly()]);
    const r = base.tables["rencontre"]?.find((x) => x["id"] === rencontres[0]);
    if (r) r["repriseHistorique"] = true;
    await passage(base);
    expect(base.tables["client"] ?? []).toHaveLength(0);
  });

  it("sans super_admin actif, rien n'est écrit et la rencontre reste à classer", async () => {
    const { base } = await scene([rendezVousCalendly()]);
    base.tables["adminUser"] = [];
    const bilan = await passage(base);
    expect(bilan.laisseesAClasser).toBe(1);
    expect(base.tables["client"] ?? []).toHaveLength(0);
  });

  it("interrupteur DOSSIER_FICHE_AUTO=false : rien n'est créé", async () => {
    vi.stubEnv("DOSSIER_FICHE_AUTO", "false");
    const { base } = await scene([rendezVousCalendly()]);
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 0, rattachees: 0, laisseesAClasser: 0 });
    expect(base.tables["client"] ?? []).toHaveLength(0);
  });

  it("l'interrupteur : absent = actif en production, « false » coupe, coupé en test sauf « true »", () => {
    expect(ficheAutoActive({ NODE_ENV: "production" })).toBe(true);
    expect(ficheAutoActive({ NODE_ENV: "production", DOSSIER_FICHE_AUTO: "false" })).toBe(false);
    expect(ficheAutoActive({ NODE_ENV: "test" })).toBe(false);
    expect(ficheAutoActive({ NODE_ENV: "test", DOSSIER_FICHE_AUTO: "true" })).toBe(true);
  });
});

describe("le balayage appelle la fiche automatique", () => {
  it("crée la fiche au passage, et signale un doute sans rien forcer", async () => {
    const ev = rendezVousCalendly({ rawPayload: avecEntreprise("Menuiserie Fictive") });
    const base = dossierEnMemoire({ calendlyEvent: [ev], adminUser: [superAdmin()] });
    const maintenant = new Date("2026-10-03T10:00:00Z");
    const notifier = vi.fn(async () => ({ channels: { telegram: "sent" } })) as never;
    // Les relances passent par la vraie fonction : la base en mémoire n'a pas de compte rendu.
    const r = await passerBalayage(base.client as never, {
      maintenant,
      notifier,
      creerAlerte: async () => undefined,
    });
    expect(r.fichesAuto.creees).toBe(1);
    expect(base.tables["client"]?.[0]).toMatchObject({ statut: "prospect" });

    refus.courant = { statut: "motif_requis", proches: [], message: "connue" };
    const ev2 = rendezVousCalendly({
      inviteeEmail: "autre@exemple-fictif.fr",
      startTime: new Date("2026-10-07T08:00:00Z"),
      endTime: new Date("2026-10-07T08:45:00Z"),
    });
    base.tables["calendlyEvent"]?.push(ev2);
    const r2 = await passerBalayage(base.client as never, {
      maintenant,
      notifier,
      creerAlerte: async () => undefined,
    });
    expect(r2.fichesAuto.laisseesAClasser).toBe(1);
    expect(r2.etapesEnEchec).toContain("fiches-auto");
    expect(base.tables["client"]).toHaveLength(1);
  });
});
