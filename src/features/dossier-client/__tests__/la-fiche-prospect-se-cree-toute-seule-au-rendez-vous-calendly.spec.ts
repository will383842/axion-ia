// @vitest-environment node
/**
 * La fiche prospect se crée TOUTE SEULE à la réservation d'un rendez-vous
 * Calendly de la liste blanche (décision de Will, 24/10/2026) — `fiche-auto.ts`.
 *
 * Ce qui est RÉEL ici : la comparaison de la porte (`preparerCandidat`,
 * `trouverFichesProches` : même adresse, nom + ville, domaine), la proposition
 * de rattachement, le rangement (`validerRattachement`), le passage et le
 * balayage. Ce qui est simulé : la base (en mémoire), la LECTURE des fiches de la
 * porte (ses filtres de relation ne sont pas rejouables en mémoire) et son écriture
 * (`creerOuRetrouverClient`, testée à part).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const porte = vi.hoisted(() => ({
  refus: null as null | Record<string, unknown>,
  planter: 0,
}));

vi.mock("@/server/qualiopi/crm/porte-client", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/server/qualiopi/crm/porte-client")>();
  const { porteSimulee } = await import("./_porte-simulee");
  const { hashEmailForLookup } = await import("@/lib/security/email-hash");
  const { natureAdresse, domaineDe } = await import("@/lib/email/nature-adresse");
  type Lignes = Array<Record<string, unknown>>;
  return {
    ...reel,
    // Lecture des fiches : la même sortie que la vraie, calculée sur la base en mémoire.
    chargerFichesCandidates: async (db: Record<string, { findMany: () => Promise<Lignes> }>) => {
      const clients = await db["client"]!.findMany();
      const adresses = await db["clientContactAdresse"]!.findMany();
      const contacts = await db["clientContact"]!.findMany();
      return clients.map((c) => {
        const siennes = adresses.filter((a) =>
          contacts.some((p) => p["id"] === a["contactId"] && p["clientId"] === c["id"]),
        );
        const mails = [
          ...(c["contactEmail"] ? [String(c["contactEmail"]).toLowerCase()] : []),
          ...siennes.map((a) => String(a["email"]).toLowerCase()),
        ];
        return {
          id: c["id"],
          numero: c["numero"],
          raisonSociale: c["raisonSociale"],
          siren: c["siren"] ?? null,
          adresseVille: c["adresseVille"] ?? null,
          adresseCodePostal: c["adresseCodePostal"] ?? null,
          emailHashes: mails.map((m) => hashEmailForLookup(m)),
          domainesPro: [
            ...new Set(mails.filter((m) => natureAdresse(m) === "pro").map((m) => domaineDe(m))),
          ],
          absorbee: false,
        };
      });
    },
    creerOuRetrouverClient: (...a: Parameters<typeof porteSimulee>) => {
      if (porte.planter > 0) {
        porte.planter -= 1;
        return Promise.reject(new Error("base indisponible"));
      }
      return porte.refus ? Promise.resolve(porte.refus) : porteSimulee(...a);
    },
  };
});

// La relance du compte rendu (file BullMQ) n'est pas l'objet de ce test : pas de compte rendu.
vi.mock("@/server/visio/gestes-compte-rendu", () => ({
  completerApresRattachement: async () => null,
}));

import { passerBalayage } from "@/server/visio/balayage";
import {
  activeDepuis,
  assurerFicheProspectAuto,
  assurerLesFichesProspectAuto,
  entrepriseUtilisable,
  identiteDeLaFiche,
  modeFicheAuto,
} from "../fiche-auto";
import { assurerRencontrePourCalendly } from "../rencontre-calendly";
import { appelsPorte } from "./_porte-simulee";
import { CLE_TEST, dossierEnMemoire, fiche, rendezVousCalendly } from "./_dossier-en-memoire";
import type { BaseEnMemoire, Ligne } from "./_prisma-en-memoire";

const BORNE = new Date("2026-10-01T00:00:00Z");
const DEPUIS = "2026-10-01T00:00:00Z";
const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
const relancer = vi.fn(async () => true);

beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
  vi.stubEnv("DOSSIER_FICHE_AUTO", "true");
  vi.stubEnv("DOSSIER_FICHE_AUTO_DEPUIS", DEPUIS);
  appelsPorte.length = 0;
  porte.refus = null;
  porte.planter = 0;
  relancer.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

function payload(opts: { entreprise?: string; ville?: string; invites?: string[] } = {}) {
  return {
    event: {
      location: { type: "google_conference" },
      event_guests: (opts.invites ?? []).map((email) => ({ email })),
    },
    invitee: {
      questions_and_answers: [
        ...(opts.entreprise !== undefined
          ? [{ question: "Nom de l'entreprise", answer: opts.entreprise }]
          : []),
        ...(opts.ville !== undefined ? [{ question: "Ville", answer: opts.ville }] : []),
      ],
    },
  };
}

async function scene(evs: Ligne[], extra: Record<string, Ligne[]> = {}) {
  const base = dossierEnMemoire({ calendlyEvent: evs, ...extra });
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
const rencontreDe = (base: BaseEnMemoire, id: string) =>
  base.tables["rencontre"]?.find((x) => x["id"] === id);
const traces = (base: BaseEnMemoire, action: string) =>
  (base.tables["activityLog"] ?? []).filter((l) => l["action"] === action);

describe("la fiche prospect se crée toute seule au rendez-vous Calendly", () => {
  it("crée la fiche prospect au nom de l'entreprise, sans signature, avec sa trace", async () => {
    const { base, rencontres } = await scene([
      rendezVousCalendly({ rawPayload: payload({ entreprise: "Menuiserie Fictive" }) }),
    ]);
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 1, rattachees: 0, doutes: 0, plantees: 0 });
    const clients = base.tables["client"] ?? [];
    expect(clients).toHaveLength(1);
    expect(clients[0]).toMatchObject({
      raisonSociale: "Menuiserie Fictive",
      type: "entreprise",
      statut: "prospect",
    });
    expect(clients[0]?.["siren"]).toBeUndefined();
    const r = rencontreDe(base, rencontres[0]!);
    expect(r).toMatchObject({ clientId: clients[0]?.["id"], rattachementStatut: "valide" });
    expect(r?.["rattacheParId"]).toBeNull();
    expect(
      (base.tables["rencontreRattachementEvenement"] ?? []).every((e) => e["parAdminId"] == null),
    ).toBe(true);
    expect(base.tables["preRemplissage"] ?? []).toHaveLength(0);
    const trace = traces(base, "client.creation_automatique");
    expect(trace).toHaveLength(1);
    expect(trace[0]).toMatchObject({ adminUserId: null, targetId: clients[0]?.["id"] });
    expect(trace[0]?.["changes"]).toMatchObject({ origine: "automatique" });
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

  it("une entreprise « - » ou « aucune » est un particulier, jamais une fiche « - »", async () => {
    const { base } = await scene([
      rendezVousCalendly({ rawPayload: payload({ entreprise: "-" }) }),
      rendezVousCalendly({
        inviteeEmail: "luc@autre-fictif.fr",
        inviteeName: "Luc Martin",
        rawPayload: payload({ entreprise: "Aucune" }),
        startTime: new Date("2026-10-08T08:00:00Z"),
        endTime: new Date("2026-10-08T08:45:00Z"),
      }),
    ]);
    await passage(base);
    expect((base.tables["client"] ?? []).map((c) => [c["raisonSociale"], c["type"]])).toEqual([
      ["Camille Prospect", "particulier"],
      ["Luc Martin", "particulier"],
    ]);
  });

  it("sans nom de personne (« jean.dupont ») ni entreprise : doute, aucune fiche", async () => {
    const { base, rencontres } = await scene([
      rendezVousCalendly({ inviteeName: "jean.dupont", rawPayload: payload() }),
    ]);
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 0, doutes: 1 });
    expect(bilan.aClasser).toMatchObject({ nombre: 1, raisons: { sans_nom: 1 } });
    expect(bilan.aClasser.empreinte).toMatch(/^[0-9a-f]{12}$/);
    expect(base.tables["client"] ?? []).toHaveLength(0);
    expect(rencontreDe(base, rencontres[0]!)).toMatchObject({ clientId: null });
  });

  it("rattache à la fiche existante quand le TITULAIRE a son adresse, sans doublon", async () => {
    const existante = fiche({
      raisonSociale: "Atelier Existant",
      contactEmail: "camille@exemple-fictif.fr",
    });
    const { base, rencontres } = await scene([rendezVousCalendly()], { client: [existante] });
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 0, rattachees: 1 });
    expect(base.tables["client"]).toHaveLength(1);
    const r = rencontreDe(base, rencontres[0]!);
    expect(r).toMatchObject({ clientId: existante["id"], rattachementStatut: "valide" });
    expect(r?.["rattacheParId"]).toBeNull();
    // La proposition de la réservation est dépassée : rangée, plus « proposée ».
    expect(r).toMatchObject({ clientProposeId: null, motifProposition: null });
    expect(traces(base, "rencontre.rattachement_automatique")).toHaveLength(1);
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

  /** Une fiche créée en doute : « doublon possible », avec le lien vers les fiches proches. */
  const doublonDe = (base: BaseEnMemoire, proches: Ligne[], signal?: string) => {
    const nouvelle = (base.tables["client"] ?? []).find(
      (c) => !proches.some((p) => p["id"] === c["id"]),
    );
    expect(nouvelle).toBeDefined();
    const trace = traces(base, "client.doublon_possible");
    expect(trace).toHaveLength(1);
    expect(trace[0]).toMatchObject({ adminUserId: null, targetId: nouvelle?.["id"] });
    const liens = (trace[0]?.["changes"] as { proches: Array<{ ficheId: string; signal: string }> })
      .proches;
    expect(liens.map((l) => l.ficheId).sort()).toEqual(proches.map((p) => p["id"]).sort());
    if (signal) expect(liens[0]?.signal).toBe(signal);
    return nouvelle;
  };

  it("un invité connu chez un AUTRE client : fiche créée, doublon possible, jamais rattachée", async () => {
    const autre = fiche({ raisonSociale: "Cabinet Autre", contactEmail: "collegue@gmail.com" });
    const { base, rencontres } = await scene(
      [rendezVousCalendly({ rawPayload: payload({ invites: ["collegue@gmail.com"] }) })],
      { client: [autre] },
    );
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 1, rattachees: 0, doutes: 0 });
    expect(bilan.doublons).toHaveLength(1);
    const nouvelle = doublonDe(base, [autre], "email");
    expect(rencontreDe(base, rencontres[0]!)).toMatchObject({ clientId: nouvelle?.["id"] });
    expect(autre["statut"]).toBe("prospect");
  });

  it("la même adresse sur une personne de la fiche rattache (contact connu du titulaire)", async () => {
    const f = fiche({ raisonSociale: "Atelier Équipe" });
    const { hashEmailForLookup } = await import("@/lib/security/email-hash");
    const { base, rencontres } = await scene([rendezVousCalendly()], {
      client: [f],
      clientContact: [{ id: "c1", clientId: f["id"] }],
      clientContactAdresse: [
        {
          contactId: "c1",
          email: "camille@exemple-fictif.fr",
          emailHash: hashEmailForLookup("camille@exemple-fictif.fr"),
        },
      ],
    });
    expect((await passage(base)).rattachees).toBe(1);
    expect(rencontreDe(base, rencontres[0]!)).toMatchObject({ clientId: f["id"] });
  });

  it("la même entreprise déclarée (homonyme) : nouvelle fiche, doublon possible", async () => {
    const homonyme = fiche({ raisonSociale: "Menuiserie Fictive" });
    const { base } = await scene(
      [rendezVousCalendly({ rawPayload: payload({ entreprise: "Menuiserie Fictive" }) })],
      { client: [homonyme] },
    );
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 1, rattachees: 0, doutes: 0 });
    expect(base.tables["client"]).toHaveLength(2);
    doublonDe(base, [homonyme], "entreprise_declaree");
  });

  it("même nom dans la même ville (comparaison réelle de la porte) : doublon possible", async () => {
    const voisine = fiche({ raisonSociale: "Boulangerie Dupont", adresseVille: "Grenoble" });
    const { base } = await scene(
      [
        rendezVousCalendly({
          rawPayload: payload({ entreprise: "Boulangerie Dupont Sarl", ville: "Grenoble" }),
        }),
      ],
      { client: [voisine] },
    );
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 1, doutes: 0 });
    doublonDe(base, [voisine]);
  });

  it("deux fiches au même domaine professionnel : nouvelle fiche liée aux DEUX", async () => {
    const a = fiche({ raisonSociale: "Cabinet A" });
    const b = fiche({ raisonSociale: "Cabinet B" });
    const { base } = await scene([rendezVousCalendly({ inviteeEmail: "x@cabinet-fictif.fr" })], {
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
    expect((await passage(base)).creees).toBe(1);
    expect(base.tables["client"]).toHaveLength(3);
    doublonDe(base, [a, b], "domaine");
  });

  it("une fiche sans doute n'a pas de marque « doublon possible »", async () => {
    const { base } = await scene([
      rendezVousCalendly({ rawPayload: payload({ entreprise: "Menuiserie Fictive" }) }),
    ]);
    expect((await passage(base)).doublons).toEqual([]);
    expect(traces(base, "client.doublon_possible")).toHaveLength(0);
  });

  it("un refus de la porte laisse la rencontre à classer, sans rien forcer", async () => {
    porte.refus = { statut: "motif_requis", proches: [], message: "Adresse déjà connue." };
    const { base, rencontres } = await scene([rendezVousCalendly()]);
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 0, doutes: 1 });
    expect(bilan.aClasser).toMatchObject({ nombre: 1, raisons: { refus_porte: 1 } });
    expect(base.tables["client"] ?? []).toHaveLength(0);
    expect(rencontreDe(base, rencontres[0]!)).toMatchObject({
      clientId: null,
      rattachementStatut: "a_classer",
    });
    expect(relancer).not.toHaveBeenCalled();
  });

  it("un refus pour le SIREN est de même laissé à classer", async () => {
    porte.refus = {
      statut: "refuse_siren",
      fiche: { id: "x", numero: "AXI-CLI-001", raisonSociale: "Autre" },
      message: "Ce SIREN est déjà pris.",
    };
    const { base } = await scene([rendezVousCalendly()]);
    expect((await passage(base)).doutes).toBe(1);
    expect(base.tables["client"] ?? []).toHaveLength(0);
  });

  it("un rendez-vous devenu annulé n'attend plus personne : il sort du décompte « à classer »", async () => {
    porte.refus = { statut: "motif_requis", proches: [], message: "connue" };
    const { base, rencontres } = await scene([rendezVousCalendly()]);
    expect((await passage(base)).aClasser?.nombre).toBe(1);
    const r = rencontreDe(base, rencontres[0]!);
    if (r) r["statut"] = "annule";
    expect((await passage(base)).aClasser?.nombre).toBe(0);
  });

  it("un doute déjà vu sort des candidats : il n'affame pas le passage suivant", async () => {
    porte.refus = { statut: "motif_requis", proches: [], message: "connue" };
    const { base } = await scene([rendezVousCalendly()]);
    await passage(base);
    expect(traces(base, "dossier.fiche_auto_doute")).toHaveLength(1);
    expect(appelsPorte).toHaveLength(0);
    porte.refus = null;
    const second = await passage(base);
    expect(second).toMatchObject({ creees: 0, doutes: 0 });
    expect(second.aClasser?.nombre).toBe(1);
    expect(traces(base, "dossier.fiche_auto_doute")).toHaveLength(1);
    expect(base.tables["client"] ?? []).toHaveLength(0);
  });

  it("idempotent : un second passage ne crée ni seconde fiche ni seconde rangée", async () => {
    const { base } = await scene([
      rendezVousCalendly({ rawPayload: payload({ entreprise: "Menuiserie Fictive" }) }),
    ]);
    await passage(base);
    const second = await passage(base);
    expect(second).toMatchObject({ creees: 0, rattachees: 0, doutes: 0 });
    expect(base.tables["client"]).toHaveLength(1);
    expect(appelsPorte).toHaveLength(1);
  });

  it("le même titulaire qui réserve deux fois retombe sur sa fiche", async () => {
    const { base } = await scene([
      rendezVousCalendly({ rawPayload: payload({ entreprise: "Menuiserie Fictive" }) }),
    ]);
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
    expect(bilan).toMatchObject({ creees: 0, rattachees: 1, doutes: 0 });
    // Sa fiche porte l'adresse de contact créée par la porte : aucun doublon, jamais deux fiches.
    expect(base.tables["client"]).toHaveLength(1);
  });

  it("une rencontre déjà rangée par un autre passage est reconnue, jamais comptée en doute", async () => {
    const { base, rencontres } = await scene([
      rendezVousCalendly({ rawPayload: payload({ entreprise: "Menuiserie Fictive" }) }),
    ]);
    await passage(base);
    const issue = await assurerFicheProspectAuto(base.client as never, rencontres[0]!, {
      relancer,
    });
    expect(issue.statut).toBe("deja_rangee");
  });
});

describe("ce que la fiche automatique ne traite jamais", () => {
  it("une réservation CAPTÉE avant l'activation, même si sa rencontre est créée après", async () => {
    const { base, rencontres } = await scene([
      rendezVousCalendly({
        capturedAt: new Date("2026-09-20T08:00:00Z"),
        rawPayload: payload({ entreprise: "Menuiserie Fictive" }),
      }),
    ]);
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 0, rattachees: 0, doutes: 0 });
    expect(base.tables["client"] ?? []).toHaveLength(0);
    expect(rencontreDe(base, rencontres[0]!)).toMatchObject({ clientId: null });
  });

  it("un rendez-vous annulé dans Calendly", async () => {
    const { base } = await scene([rendezVousCalendly({ status: "canceled" })]);
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 0, rattachees: 0, doutes: 0 });
    expect(base.tables["client"] ?? []).toHaveLength(0);
  });

  it("une rencontre annulée ou absente", async () => {
    const { base, rencontres } = await scene([
      rendezVousCalendly(),
      rendezVousCalendly({
        inviteeEmail: "luc@autre-fictif.fr",
        inviteeName: "Luc Martin",
        startTime: new Date("2026-10-08T08:00:00Z"),
        endTime: new Date("2026-10-08T08:45:00Z"),
      }),
    ]);
    const un = rencontreDe(base, rencontres[0]!);
    const deux = rencontreDe(base, rencontres[1]!);
    if (un) un["statut"] = "annule";
    if (deux) deux["statut"] = "absent";
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 0, doutes: 0 });
    expect(base.tables["client"] ?? []).toHaveLength(0);
    const direct = await assurerFicheProspectAuto(base.client as never, rencontres[0]!, {
      relancer,
    });
    expect(direct.statut).toBe("ignoree");
  });

  it("une rencontre de test interne", async () => {
    const { base, rencontres } = await scene([rendezVousCalendly()]);
    const r = rencontreDe(base, rencontres[0]!);
    if (r) r["estTestInterne"] = true;
    expect(await passage(base)).toMatchObject({ creees: 0, rattachees: 0, doutes: 0 });
    expect(base.tables["client"] ?? []).toHaveLength(0);
  });

  it("une reprise d'historique", async () => {
    const { base, rencontres } = await scene([rendezVousCalendly()]);
    const r = rencontreDe(base, rencontres[0]!);
    if (r) r["repriseHistorique"] = true;
    await passage(base);
    expect(base.tables["client"] ?? []).toHaveLength(0);
  });

  it("le stock ANCIEN (créé avant l'activation) reste à Will", async () => {
    const { base, rencontres } = await scene([
      rendezVousCalendly({ rawPayload: payload({ entreprise: "Menuiserie Fictive" }) }),
    ]);
    const r = rencontreDe(base, rencontres[0]!);
    if (r) r["createdAt"] = new Date("2026-09-20T08:00:00Z");
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 0, rattachees: 0, doutes: 0 });
    expect(base.tables["client"] ?? []).toHaveLength(0);
    expect(rencontreDe(base, rencontres[0]!)).toMatchObject({ rattachementStatut: "a_classer" });
  });

  it("sans date d'activation, rien n'est traité", async () => {
    vi.stubEnv("DOSSIER_FICHE_AUTO_DEPUIS", "");
    const { base } = await scene([rendezVousCalendly()]);
    expect(await passage(base)).toMatchObject({ creees: 0, doutes: 0 });
    expect(base.tables["client"] ?? []).toHaveLength(0);
  });
});

describe("la trace et la fiche sont écrites ensemble", () => {
  /** Une trace qui ne s'écrit pas : le journal refuse. */
  const casserLeJournal = (base: BaseEnMemoire) => {
    (base.client as Record<string, unknown>)["activityLog"] = {
      findMany: async () => [],
      create: async () => {
        throw new Error("journal indisponible");
      },
    };
  };

  it("échec d'écriture de la trace : aucune fiche orpheline, la rencontre reste intacte", async () => {
    const { base, rencontres } = await scene([
      rendezVousCalendly({ rawPayload: payload({ entreprise: "Menuiserie Fictive" }) }),
    ]);
    casserLeJournal(base);
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 0, plantees: 1 });
    expect(base.tables["client"] ?? []).toHaveLength(0);
    expect(base.tables["clientContact"] ?? []).toHaveLength(0);
    expect(rencontreDe(base, rencontres[0]!)).toMatchObject({ clientId: null });
  });

  it("l'alerte « doublon possible » s'écrit avec la fiche, dans la même transaction", async () => {
    const homonyme = fiche({ raisonSociale: "Menuiserie Fictive" });
    const { base } = await scene(
      [rendezVousCalendly({ rawPayload: payload({ entreprise: "Menuiserie Fictive" }) })],
      { client: [homonyme] },
    );
    await passage(base);
    const nouvelle = (base.tables["client"] ?? []).find((c) => c["id"] !== homonyme["id"]);
    const alertes = base.tables["alerteSysteme"] ?? [];
    expect(alertes).toHaveLength(1);
    expect(alertes[0]).toMatchObject({
      code: "visio.doublon_possible",
      cibleId: nouvelle?.["id"],
      notifiedAt: null,
    });
  });

  /** La fiche « disparaît » au moment de ranger : `validerRattachement` lève ErreurRattachement. */
  const fichesIntrouvablesAuRangement = (base: BaseEnMemoire) => {
    const delegue = (base.client as Record<string, unknown>)["client"] as Record<string, unknown>;
    (base.client as Record<string, unknown>)["client"] = {
      ...delegue,
      findUnique: async () => null,
    };
  };

  it("un refus de rattachement (fiche sûre) est un doute, jamais une panne", async () => {
    const existante = fiche({
      raisonSociale: "Atelier Existant",
      contactEmail: "camille@exemple-fictif.fr",
    });
    const { base, rencontres } = await scene([rendezVousCalendly()], { client: [existante] });
    fichesIntrouvablesAuRangement(base);
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ rattachees: 0, doutes: 1, plantees: 0 });
    expect(bilan.aClasser?.raisons).toEqual({ rattachement_refuse: 1 });
    expect(rencontreDe(base, rencontres[0]!)).toMatchObject({ clientId: null });
  });

  it("un refus de rattachement en pleine création annule la fiche : doute, pas une panne", async () => {
    const { base, rencontres } = await scene([
      rendezVousCalendly({ rawPayload: payload({ entreprise: "Menuiserie Fictive" }) }),
    ]);
    fichesIntrouvablesAuRangement(base);
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ creees: 0, doutes: 1, plantees: 0 });
    expect(bilan.aClasser?.raisons).toEqual({ creation_refusee: 1 });
    expect(base.tables["client"] ?? []).toHaveLength(0);
    expect(rencontreDe(base, rencontres[0]!)).toMatchObject({ clientId: null });
  });

  it("une erreur autre qu'un refus de rattachement n'est pas avalée : le passage la compte", async () => {
    const existante = fiche({
      raisonSociale: "Atelier Existant",
      contactEmail: "camille@exemple-fictif.fr",
    });
    const { base, rencontres } = await scene([rendezVousCalendly()], { client: [existante] });
    casserLeJournal(base);
    const bilan = await passage(base);
    expect(bilan).toMatchObject({ rattachees: 0, doutes: 0, plantees: 1 });
    expect(rencontreDe(base, rencontres[0]!)).toMatchObject({ clientId: null });
  });
});

describe("l'interrupteur et l'essai à blanc", () => {
  it("actif seulement si DOSSIER_FICHE_AUTO vaut « true » ; « essai » est à blanc", () => {
    expect(modeFicheAuto({})).toBe("coupe");
    expect(modeFicheAuto({ DOSSIER_FICHE_AUTO: "false" })).toBe("coupe");
    expect(modeFicheAuto({ DOSSIER_FICHE_AUTO: "oui" })).toBe("coupe");
    expect(modeFicheAuto({ DOSSIER_FICHE_AUTO: "true" })).toBe("actif");
    expect(modeFicheAuto({ DOSSIER_FICHE_AUTO: "essai" })).toBe("essai");
    expect(activeDepuis({ DOSSIER_FICHE_AUTO_DEPUIS: "2026-10-25T00:00:00Z" })?.toISOString()).toBe(
      "2026-10-25T00:00:00.000Z",
    );
    expect(activeDepuis({ DOSSIER_FICHE_AUTO_DEPUIS: "pas une date" })).toBeNull();
    expect(activeDepuis({})).toBeNull();
  });

  it("coupé (absent ou « false ») : rien n'est créé", async () => {
    vi.stubEnv("DOSSIER_FICHE_AUTO", "false");
    const { base } = await scene([rendezVousCalendly()]);
    expect(await passage(base)).toMatchObject({ mode: "coupe", creees: 0, doutes: 0 });
    vi.stubEnv("DOSSIER_FICHE_AUTO", "");
    expect((await passage(base)).mode).toBe("coupe");
    expect(base.tables["client"] ?? []).toHaveLength(0);
  });

  it("à blanc : dit ce qu'il ferait et n'écrit RIEN", async () => {
    vi.stubEnv("DOSSIER_FICHE_AUTO", "essai");
    const existante = fiche({
      raisonSociale: "Atelier Existant",
      contactEmail: "luc@autre-fictif.fr",
    });
    const { base, rencontres } = await scene(
      [
        rendezVousCalendly({ rawPayload: payload({ entreprise: "Menuiserie Fictive" }) }),
        rendezVousCalendly({
          inviteeEmail: "luc@autre-fictif.fr",
          inviteeName: "Luc Martin",
          startTime: new Date("2026-10-08T08:00:00Z"),
          endTime: new Date("2026-10-08T08:45:00Z"),
        }),
      ],
      { client: [existante] },
    );
    const bilan = await passage(base);
    expect(bilan).toMatchObject({
      mode: "essai",
      creeraient: 1,
      rattacheraient: 1,
      creees: 0,
      rattachees: 0,
      aClasser: { nombre: 0, raisons: {}, empreinte: "" },
    });
    expect(base.tables["client"]).toHaveLength(1);
    expect(base.tables["activityLog"] ?? []).toHaveLength(0);
    expect(appelsPorte).toHaveLength(0);
    for (const id of rencontres) {
      expect(rencontreDe(base, id)?.["clientId"]).toBeNull();
      expect(rencontreDe(base, id)?.["rattachementStatut"]).not.toBe("valide");
    }
  });
});

describe("les noms inutilisables", () => {
  it("« - », « aucune », « non » ne sont pas des entreprises", () => {
    for (const n of ["-", "--", "Aucune", "NON", "N/A", "néant", "", null]) {
      expect(entrepriseUtilisable(n)).toBe(false);
    }
    expect(entrepriseUtilisable("Menuiserie Fictive")).toBe(true);
  });

  it("l'identité : entreprise, sinon personne, sinon rien", () => {
    expect(identiteDeLaFiche({ nom: "Atelier X", ville: null }, { nom: null })?.type).toBe(
      "entreprise",
    );
    expect(identiteDeLaFiche({ nom: "-", ville: null }, { nom: "Luc Martin" })?.type).toBe(
      "particulier",
    );
    expect(identiteDeLaFiche({ nom: null, ville: null }, { nom: "jean.dupont" })).toBeNull();
    expect(identiteDeLaFiche({ nom: null, ville: null }, { nom: "a@b.fr" })).toBeNull();
  });
});

describe("le balayage appelle la fiche automatique", () => {
  const notifier = vi.fn(async () => ({ channels: { telegram: "sent" } })) as never;
  const maintenant = new Date("2026-10-03T10:00:00Z");

  function deps(base: BaseEnMemoire, codes: string[]) {
    return {
      maintenant,
      notifier,
      creerAlerte: async (input: { code: string }) => {
        codes.push(input.code);
        await (
          base.client as unknown as {
            alerteSysteme: { create: (a: unknown) => Promise<unknown> };
          }
        ).alerteSysteme.create({
          data: { ...input, niveau: "important", titre: "t", message: "m" },
        });
      },
    };
  }

  it("un doute ouvre l'alerte « à classer » et jamais une panne", async () => {
    porte.refus = { statut: "motif_requis", proches: [], message: "connue" };
    const base = dossierEnMemoire({
      calendlyEvent: [rendezVousCalendly()],
      alerteSysteme: [
        {
          id: "panne-veille",
          code: "visio.balayage_en_panne",
          resolue: false,
          cibleId: null,
          metadata: { etapes: ["etape-inconnue"], essais: 1, dernierEssaiLe: null },
        },
      ],
    });
    const codes: string[] = [];
    const r = await passerBalayage(base.client as never, deps(base, codes));
    expect(r.fichesAuto.doutes).toBe(1);
    expect(r.etapesEnEchec).not.toContain("fiches-auto");
    expect(codes).toEqual(["visio.rendez_vous_a_classer"]);
    // Une vraie panne déjà ouverte n'est ni masquée ni résolue par l'alerte « à classer ».
    const panne = base.tables["alerteSysteme"]?.find((a) => a["id"] === "panne-veille");
    expect(panne).toMatchObject({ resolue: false });
    expect(panne?.["metadata"]).toMatchObject({ etapes: ["etape-inconnue"] });
    // Second passage : même nombre, pas de nouvelle alerte ; plus aucun doute : elle se résout.
    await passerBalayage(base.client as never, deps(base, codes));
    expect(codes).toEqual(["visio.rendez_vous_a_classer"]);
    const rencontre = base.tables["rencontre"]?.[0];
    if (rencontre) rencontre["clientId"] = "00000000-0000-4000-8000-0000000000c1";
    await passerBalayage(base.client as never, deps(base, codes));
    const alerte = base.tables["alerteSysteme"]?.find(
      (a) => a["code"] === "visio.rendez_vous_a_classer",
    );
    expect(alerte).toMatchObject({ resolue: true });
  });

  it("interrupteur coupé ou à blanc : l'alerte « à classer » encore ouverte est résolue", async () => {
    for (const mode of ["false", "essai"]) {
      vi.stubEnv("DOSSIER_FICHE_AUTO", mode);
      const base = dossierEnMemoire({
        calendlyEvent: [rendezVousCalendly()],
        alerteSysteme: [
          {
            id: "a-classer",
            code: "visio.rendez_vous_a_classer",
            resolue: false,
            cibleId: null,
            metadata: { nombre: 2 },
          },
        ],
      });
      await passerBalayage(base.client as never, deps(base, []));
      expect(base.tables["alerteSysteme"]?.find((a) => a["id"] === "a-classer")).toMatchObject({
        resolue: true,
      });
    }
  });

  it("une rencontre qui plante n'arrête pas les autres, et la panne est signalée", async () => {
    porte.planter = 1;
    const base = dossierEnMemoire({
      calendlyEvent: [
        rendezVousCalendly({ rawPayload: payload({ entreprise: "Menuiserie Fictive" }) }),
        rendezVousCalendly({
          inviteeEmail: "luc@autre-fictif.fr",
          inviteeName: "Luc Martin",
          rawPayload: payload({ entreprise: "Atelier Lumière" }),
          startTime: new Date("2026-10-08T08:00:00Z"),
          endTime: new Date("2026-10-08T08:45:00Z"),
        }),
      ],
    });
    const codes: string[] = [];
    const r = await passerBalayage(base.client as never, deps(base, codes));
    expect(r.fichesAuto).toMatchObject({ creees: 1, plantees: 1 });
    expect(r.etapesEnEchec).toContain("fiches-auto");
    expect(base.tables["client"]).toHaveLength(1);
    // Le passage suivant reprend la rencontre plantée.
    const suite = await passerBalayage(base.client as never, deps(base, codes));
    expect(suite.fichesAuto.creees).toBe(1);
    expect(base.tables["client"]).toHaveLength(2);
  });

  it("une fiche créée en doute prévient Will (une alerte par fiche), sans panne", async () => {
    const homonyme = fiche({ raisonSociale: "Menuiserie Fictive" });
    const base = dossierEnMemoire({
      client: [homonyme],
      calendlyEvent: [
        rendezVousCalendly({ rawPayload: payload({ entreprise: "Menuiserie Fictive" }) }),
      ],
    });
    const codes: string[] = [];
    const r = await passerBalayage(base.client as never, deps(base, codes));
    expect(r.fichesAuto.doublons).toHaveLength(1);
    expect(r.etapesEnEchec).toEqual([]);
    expect(codes).toEqual(["visio.doublon_possible"]);
  });

  it("crée la fiche au passage quand l'interrupteur est allumé", async () => {
    const base = dossierEnMemoire({
      calendlyEvent: [
        rendezVousCalendly({ rawPayload: payload({ entreprise: "Menuiserie Fictive" }) }),
      ],
    });
    const r = await passerBalayage(base.client as never, deps(base, []));
    expect(r.fichesAuto.creees).toBe(1);
    expect(base.tables["client"]?.[0]).toMatchObject({ statut: "prospect" });
  });
});
