import { beforeEach, describe, expect, it, vi } from "vitest";

// Lot 5 — l'outil PROPOSE, le dirigeant valide : ce module n'écrit que des propositions.
// Base simulée en mémoire (unicité (presentationId, rendezVousCle) comprise).

type Ligne = Record<string, unknown>;
const bd = vi.hoisted(() => ({
  presentations: [] as Ligne[],
  reservations: [] as Ligne[],
  etablissements: [] as Ligne[],
  evenements: [] as Ligne[],
  rencontres: [] as Ligne[],
  adresses: [] as Ligne[],
  propositions: [] as Ligne[],
  ecritures: 0,
  lecturesPresentations: 0,
}));

vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string | null | undefined) => (e ? `h:${e.trim().toLowerCase()}` : null),
}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string | null) => (v?.startsWith("enc:") ? v.slice(4) : v),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    presentationEntreprise: {
      findMany: async ({
        where,
      }: {
        where: { id: { in: string[] }; statut: string; recueAt: { lte: Date } };
      }) => {
        bd.lecturesPresentations += where.id.in.length;
        return bd.presentations.filter(
          (p) =>
            where.id.in.includes(p.id as string) &&
            p.statut === where.statut &&
            (p.recueAt as Date).getTime() <= where.recueAt.lte.getTime(),
        );
      },
    },
    presentationReservation: {
      findMany: async ({
        where,
        take,
      }: {
        where: {
          presentationId: { in?: string[]; gt?: string };
          regle?: string;
          echueAt?: null;
          valideeAt?: null;
          reserveeJusquAt?: { gte: Date };
        };
        take?: number;
      }) => {
        const w = where;
        const l = bd.reservations
          .filter((r) => {
            const pid = r.presentationId as string;
            if (w.presentationId?.in && !w.presentationId.in.includes(pid)) return false;
            if (w.presentationId?.gt !== undefined && !(pid > w.presentationId.gt)) return false;
            if (w.regle !== undefined && r.regle !== w.regle) return false;
            if (w.echueAt === null && r.echueAt) return false;
            if (w.valideeAt === null && r.valideeAt) return false;
            if (
              w.reserveeJusquAt &&
              !((r.reserveeJusquAt as Date).getTime() >= w.reserveeJusquAt.gte.getTime())
            )
              return false;
            return true;
          })
          .sort((a, b) => ((a.presentationId as string) < (b.presentationId as string) ? -1 : 1));
        return take ? l.slice(0, take) : l;
      },
    },
    presentationEtablissement: {
      findMany: async ({ where }: { where: { presentationId: { in: string[] } } }) =>
        bd.etablissements.filter((r) =>
          where.presentationId.in.includes(r.presentationId as string),
        ),
    },
    calendlyEvent: {
      findUnique: async ({ where }: { where: { id?: string; inviteeUri?: string } }) =>
        bd.evenements.find((e) =>
          where.inviteeUri !== undefined ? e.inviteeUri === where.inviteeUri : e.id === where.id,
        ) ?? null,
    },
    rencontre: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        bd.rencontres.find((e) => e.id === where.id) ?? null,
    },
    clientContactAdresse: {
      findMany: async ({ where }: { where: { emailHash: { in: string[] } } }) =>
        bd.adresses.filter((a) => where.emailHash.in.includes(a.emailHash as string)),
    },
    propositionRendezVousPresentation: {
      createMany: async ({ data, skipDuplicates }: { data: Ligne[]; skipDuplicates?: boolean }) => {
        let count = 0;
        for (const d of data) {
          bd.ecritures++;
          if (
            bd.propositions.some(
              (p) => p.presentationId === d.presentationId && p.rendezVousCle === d.rendezVousCle,
            )
          ) {
            if (skipDuplicates) continue;
            throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
          }
          bd.propositions.push({ ...d });
          count++;
        }
        return { count };
      },
    },
  },
}));

import { proposerPourRendezVous } from "../rapprochement-rendez-vous";

const SIRET_A = "73282932000074";
const SIRET_B = "73282932000041";
const SAISIE = new Date("2026-11-01T10:00:00Z");
const PRIS = new Date("2026-11-05T10:00:00Z");

function presentation(id: string, o: Ligne = {}) {
  bd.presentations.push({
    id,
    apporteurId: `app-${id}`,
    siren: "732829320",
    statut: "reservee",
    personneEmail: "enc:dirigeant@acme-industrie.fr",
    personneEmailHash: "h:dirigeant@acme-industrie.fr",
    recueAt: SAISIE,
    ...o,
  });
  if (o.__sansReservation !== true)
    bd.reservations.push({
      presentationId: id,
      regle: "rendez_vous",
      reserveeJusquAt: new Date("2026-12-31T00:00:00Z"),
      echueAt: null,
      valideeAt: null,
    });
  bd.etablissements.push({
    presentationId: id,
    siret: SIRET_A,
    entreprise: false,
    exclus: [],
    etendueAt: null,
  });
}

function evenement(id: string, email: string | null, o: Ligne = {}) {
  bd.evenements.push({
    id,
    enrichedAt: new Date("2026-11-05T10:01:00Z"),
    status: "scheduled",
    // Création de NOTRE ligne (balayage) : ne doit JAMAIS servir de date de prise.
    capturedAt: new Date("2026-11-20T10:00:00Z"),
    startTime: new Date("2026-11-12T09:00:00Z"),
    rawPayload: {
      _refreshedAt: "2026-11-05T10:01:00Z",
      invitee: {
        created_at: PRIS.toISOString(),
        ...(email ? { email } : {}),
        questions_and_answers: [{ question: "Vous êtes ?", answer: "Un apporteur d'affaires" }],
      },
    },
    rencontre: null,
    ...o,
  });
}

function payload(email: string, creeLe: string | null, o: Ligne = {}) {
  return {
    _refreshedAt: "2026-11-05T10:01:00Z",
    invitee: { email, ...(creeLe ? { created_at: creeLe } : {}), questions_and_answers: [], ...o },
  };
}

beforeEach(() => {
  for (const k of Object.keys(bd) as (keyof typeof bd)[])
    if (Array.isArray(bd[k])) (bd[k] as unknown[]).length = 0;
  bd.ecritures = 0;
  bd.lecturesPresentations = 0;
  vi.stubEnv("APPORTEURS_VALIDATION_RDV", "true");
});

describe("proposerPourRendezVous", () => {
  it("même adresse : propose (email_exact), sans rien valider", async () => {
    presentation("p1");
    evenement("e1", "dirigeant@acme-industrie.fr");
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(1);
    expect(bd.propositions).toHaveLength(1);
    expect(bd.propositions[0]).toMatchObject({
      presentationId: "p1",
      rendezVousCle: "calendly:e1",
      motif: "email_exact",
      apporteurCite: true,
    });
    expect(bd.reservations[0]!.valideeAt).toBeNull();
  });

  it("interrupteur éteint : rien, et aucune lecture", async () => {
    vi.stubEnv("APPORTEURS_VALIDATION_RDV", "TRUE");
    presentation("p1");
    evenement("e1", "dirigeant@acme-industrie.fr");
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(0);
    expect(bd.ecritures).toBe(0);
  });

  it("adresse non confirmée par Calendly, ou événement non enrichi : rien", async () => {
    presentation("p1");
    evenement("sans-adresse", null);
    evenement("non-enrichi", "dirigeant@acme-industrie.fr", { enrichedAt: null });
    expect(await proposerPourRendezVous({ calendlyEventId: "sans-adresse" })).toBe(0);
    expect(await proposerPourRendezVous({ calendlyEventId: "non-enrichi" })).toBe(0);
    expect(bd.propositions).toHaveLength(0);
  });

  it("rejeu : pas de doublon", async () => {
    presentation("p1");
    evenement("e1", "dirigeant@acme-industrie.fr");
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(1);
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(0);
    expect(bd.propositions).toHaveLength(1);
  });

  it("une autre personne du même domaine professionnel : proposée (meme_entreprise)", async () => {
    presentation("p1");
    evenement("e1", "assistante@acme-industrie.fr");
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(1);
    expect(bd.propositions[0]).toMatchObject({ motif: "meme_entreprise" });
  });

  it("un domaine de webmail ne rapproche personne", async () => {
    presentation("p1", { personneEmail: "enc:a@gmail.com", personneEmailHash: "h:a@gmail.com" });
    evenement("e1", "b@gmail.com");
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(0);
  });

  it("une rencontre dont la fiche client porte le même SIRET : proposée (meme_siren)", async () => {
    presentation("p1");
    bd.rencontres.push({
      id: "r1",
      createdAt: PRIS,
      debutPrevu: new Date("2026-11-12T09:00:00Z"),
      calendlyEventId: null,
      calendlyEvent: null,
      client: { siren: "732829320", siret: SIRET_A },
      participants: [],
    });
    expect(await proposerPourRendezVous({ rencontreId: "r1" })).toBe(1);
    expect(bd.propositions[0]).toMatchObject({
      motif: "meme_siren",
      rendezVousCle: "rencontre:r1",
    });
  });

  it("un autre SIRET du même SIREN : non proposée", async () => {
    presentation("p1");
    bd.rencontres.push({
      id: "r1",
      createdAt: PRIS,
      debutPrevu: null,
      calendlyEventId: null,
      calendlyEvent: null,
      client: { siren: "732829320", siret: SIRET_B },
      participants: [],
    });
    expect(await proposerPourRendezVous({ rencontreId: "r1" })).toBe(0);
  });

  it("deux apporteurs : une proposition chacun (aucun ordre garanti : l'affichage trie sur recueAt)", async () => {
    presentation("recente", { recueAt: new Date("2026-11-03T10:00:00Z") });
    presentation("ancienne", { recueAt: new Date("2026-11-01T10:00:00Z") });
    evenement("e1", "dirigeant@acme-industrie.fr");
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(2);
    expect(bd.propositions.map((p) => p.presentationId).sort()).toEqual(["ancienne", "recente"]);
  });

  it("rendez-vous pris avant la saisie : rien ; après la fin de la réservation : rien", async () => {
    presentation("p1");
    evenement("avant", "dirigeant@acme-industrie.fr", {
      rawPayload: payload("dirigeant@acme-industrie.fr", "2026-10-30T10:00:00Z"),
    });
    evenement("apres", "dirigeant@acme-industrie.fr", {
      rawPayload: payload("dirigeant@acme-industrie.fr", "2027-01-15T10:00:00Z"),
    });
    expect(await proposerPourRendezVous({ calendlyEventId: "avant" })).toBe(0);
    expect(await proposerPourRendezVous({ calendlyEventId: "apres" })).toBe(0);
  });

  it("rendez-vous à venir (pas encore tenu) : proposé quand même", async () => {
    presentation("p1");
    evenement("e1", "dirigeant@acme-industrie.fr", {
      startTime: new Date("2999-01-01T09:00:00Z"),
    });
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(1);
  });

  it("présentation sans ligne de réservation, ou non « réservée » : rien", async () => {
    presentation("sans", { __sansReservation: true });
    presentation("confirmee", { statut: "confirmee" });
    evenement("e1", "dirigeant@acme-industrie.fr");
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(0);
  });

  it("type de rendez-vous sans la question d'origine : rapproché quand même, apporteurCite faux", async () => {
    presentation("p1");
    evenement("e1", "dirigeant@acme-industrie.fr", {
      rawPayload: payload("dirigeant@acme-industrie.fr", PRIS.toISOString()),
    });
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(1);
    expect(bd.propositions[0]).toMatchObject({ apporteurCite: false });
  });

  it("la réponse « Un apporteur d'affaires » ne rapproche rien à elle seule", async () => {
    presentation("p1");
    evenement("e1", "inconnu@autre-societe.fr");
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(0);
  });

  it("proposition écartée : jamais recréée", async () => {
    presentation("p1");
    evenement("e1", "dirigeant@acme-industrie.fr");
    bd.propositions.push({
      presentationId: "p1",
      rendezVousCle: "calendly:e1",
      ecarteeAt: new Date("2026-11-06T10:00:00Z"),
    });
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(0);
    expect(bd.propositions).toHaveLength(1);
    expect(bd.propositions[0]!.ecarteeAt).toBeInstanceOf(Date);
  });

  it("découvert par le balayage APRÈS la saisie, mais réservé AVANT : rien", async () => {
    presentation("p1"); // saisie le 1er novembre
    evenement("e1", "dirigeant@acme-industrie.fr", {
      capturedAt: new Date("2026-11-03T10:00:00Z"), // découvert après la saisie
      rawPayload: payload("dirigeant@acme-industrie.fr", "2026-10-31T10:00:00Z"), // pris avant
    });
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(0);
  });

  it("pas de date de prise dans la charge confirmée : rien (jamais capturedAt)", async () => {
    presentation("p1");
    evenement("e1", "dirigeant@acme-industrie.fr", {
      rawPayload: payload("dirigeant@acme-industrie.fr", null),
    });
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(0);
  });

  it("charge stockée non confirmée par l'API (sans _refreshedAt) : rien ; fournie par l'enrichissement : ok", async () => {
    presentation("p1");
    const brute = payload("dirigeant@acme-industrie.fr", PRIS.toISOString());
    evenement("e1", "dirigeant@acme-industrie.fr", {
      rawPayload: { invitee: brute.invitee },
    });
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(0);
    expect(await proposerPourRendezVous({ calendlyEventId: "e1", invitee: brute.invitee })).toBe(1);
  });

  it("rendez-vous annulé (colonne ou invité) ou absent : rien", async () => {
    presentation("p1");
    evenement("col", "dirigeant@acme-industrie.fr", { status: "canceled" });
    evenement("abs", "dirigeant@acme-industrie.fr", { status: "no_show" });
    evenement("inv", "dirigeant@acme-industrie.fr", {
      rawPayload: payload("dirigeant@acme-industrie.fr", PRIS.toISOString(), {
        status: "canceled",
      }),
    });
    for (const id of ["col", "abs", "inv"])
      expect(await proposerPourRendezVous({ calendlyEventId: id })).toBe(0);
    expect(bd.propositions).toHaveLength(0);
  });

  it("reporté après la saisie, réservé à l'origine avant : rien", async () => {
    presentation("p1"); // saisie le 1er novembre
    evenement("ancien", "dirigeant@acme-industrie.fr", {
      inviteeUri: "https://api.calendly.com/invitees/ANCIEN",
      status: "canceled",
      rawPayload: payload("dirigeant@acme-industrie.fr", "2026-10-30T10:00:00Z"), // pris avant
    });
    evenement("nouveau", "dirigeant@acme-industrie.fr", {
      startTime: new Date("2026-12-01T09:00:00Z"),
      rawPayload: payload("dirigeant@acme-industrie.fr", PRIS.toISOString(), {
        old_invitee: "https://api.calendly.com/invitees/ANCIEN",
      }),
    });
    expect(await proposerPourRendezVous({ calendlyEventId: "nouveau" })).toBe(0);
  });

  it("reporté, réservé à l'origine APRÈS la saisie : proposé (date de la première réservation)", async () => {
    presentation("p1");
    evenement("ancien", "dirigeant@acme-industrie.fr", {
      inviteeUri: "https://api.calendly.com/invitees/ANCIEN",
      status: "canceled",
      rawPayload: payload("dirigeant@acme-industrie.fr", "2026-11-03T10:00:00Z"),
    });
    evenement("nouveau", "dirigeant@acme-industrie.fr", {
      startTime: new Date("2026-12-01T09:00:00Z"),
      rawPayload: payload("dirigeant@acme-industrie.fr", "2026-11-20T10:00:00Z", {
        old_invitee: "https://api.calendly.com/invitees/ANCIEN",
      }),
    });
    expect(await proposerPourRendezVous({ calendlyEventId: "nouveau" })).toBe(1);
    expect(bd.propositions[0]!.prisAt).toEqual(new Date("2026-11-03T10:00:00Z"));
  });

  it("report en chaîne : on remonte jusqu'à la première réservation", async () => {
    presentation("p1");
    evenement("a", "dirigeant@acme-industrie.fr", {
      inviteeUri: "https://api.calendly.com/invitees/A",
      rawPayload: payload("dirigeant@acme-industrie.fr", "2026-10-30T10:00:00Z"),
    });
    evenement("b", "dirigeant@acme-industrie.fr", {
      inviteeUri: "https://api.calendly.com/invitees/B",
      rawPayload: payload("dirigeant@acme-industrie.fr", "2026-11-10T10:00:00Z", {
        old_invitee: "https://api.calendly.com/invitees/A",
      }),
    });
    evenement("c", "dirigeant@acme-industrie.fr", {
      startTime: new Date("2026-12-01T09:00:00Z"),
      rawPayload: payload("dirigeant@acme-industrie.fr", "2026-11-15T10:00:00Z", {
        old_invitee: "https://api.calendly.com/invitees/B",
      }),
    });
    expect(await proposerPourRendezVous({ calendlyEventId: "c" })).toBe(0);
  });

  it("reporté, ancienne réservation introuvable ou non confirmée : rien", async () => {
    presentation("p1");
    evenement("orphelin", "dirigeant@acme-industrie.fr", {
      startTime: new Date("2026-12-01T09:00:00Z"),
      rawPayload: payload("dirigeant@acme-industrie.fr", "2026-11-20T10:00:00Z", {
        old_invitee: "https://api.calendly.com/invitees/INCONNU",
      }),
    });
    evenement("ancien", "dirigeant@acme-industrie.fr", {
      inviteeUri: "https://api.calendly.com/invitees/BRUT",
      rawPayload: { invitee: { created_at: "2026-11-03T10:00:00Z" } }, // sans _refreshedAt
    });
    evenement("nouveau", "dirigeant@acme-industrie.fr", {
      startTime: new Date("2026-12-01T09:00:00Z"),
      rawPayload: payload("dirigeant@acme-industrie.fr", "2026-11-20T10:00:00Z", {
        old_invitee: "https://api.calendly.com/invitees/BRUT",
      }),
    });
    expect(await proposerPourRendezVous({ calendlyEventId: "orphelin" })).toBe(0);
    expect(await proposerPourRendezVous({ calendlyEventId: "nouveau" })).toBe(0);
  });

  it("rencontre annulée, absente ou reportée alors que l'événement Calendly est scheduled : rien", async () => {
    presentation("p1");
    for (const statut of ["annule", "absent", "reporte"]) {
      bd.evenements.length = 0;
      evenement(`ev-${statut}`, "dirigeant@acme-industrie.fr", {
        rencontre: { statut, client: null },
      });
      expect(await proposerPourRendezVous({ calendlyEventId: `ev-${statut}` })).toBe(0);
    }
    bd.evenements.length = 0;
    evenement("ev-ok", "dirigeant@acme-industrie.fr", {
      rencontre: { statut: "planifie", client: null },
    });
    expect(await proposerPourRendezVous({ calendlyEventId: "ev-ok" })).toBe(1);
  });

  it("rencontre saisie à la main annulée, absente ou reportée : rien", async () => {
    presentation("p1");
    for (const statut of ["annule", "absent", "reporte"]) {
      bd.rencontres.length = 0;
      bd.rencontres.push({
        id: `r-${statut}`,
        statut,
        createdAt: PRIS,
        debutPrevu: new Date("2026-11-12T09:00:00Z"),
        calendlyEventId: null,
        client: null,
        participants: [{ emailHash: "h:dirigeant@acme-industrie.fr" }],
      });
      expect(await proposerPourRendezVous({ rencontreId: `r-${statut}` })).toBe(0);
    }
  });

  it("startTime antérieur à la prise : rien", async () => {
    presentation("p1");
    evenement("e1", "dirigeant@acme-industrie.fr", {
      startTime: new Date("2026-11-04T09:00:00Z"), // PRIS = 5 novembre
    });
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(0);
  });

  it("présentation déjà validée, échue ou d'une autre règle : rien", async () => {
    presentation("validee");
    presentation("echue");
    presentation("autre");
    bd.reservations.find((r) => r.presentationId === "validee")!.valideeAt = new Date();
    bd.reservations.find((r) => r.presentationId === "echue")!.echueAt = new Date();
    bd.reservations.find((r) => r.presentationId === "autre")!.regle = "ancienne";
    evenement("e1", "dirigeant@acme-industrie.fr");
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(0);
  });

  it("plus de 500 réservations ouvertes : aucune n'est perdue (pagination)", async () => {
    for (let i = 0; i < 1203; i++) {
      presentation(`x${String(i).padStart(5, "0")}`, {
        personneEmail: `enc:p${i}@autre${i}.fr`,
        personneEmailHash: `h:p${i}@autre${i}.fr`,
      });
    }
    presentation("zz-cible"); // sort en dernier : au-delà de toute page ou plafond
    evenement("e1", "dirigeant@acme-industrie.fr");
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(1);
    expect(bd.propositions[0]).toMatchObject({ presentationId: "zz-cible" });
    expect(bd.lecturesPresentations).toBe(1204);
  });

  it("fiche client d'un AUTRE SIREN au même domaine : pas de rapprochement par domaine", async () => {
    presentation("p1");
    evenement("e1", "assistante@acme-industrie.fr");
    bd.evenements[0]!["rencontre"] = { client: { siren: "123456789", siret: null } };
    expect(await proposerPourRendezVous({ calendlyEventId: "e1" })).toBe(0);
  });

  it("l'erreur envoyée à Sentry ne porte ni cause ni arguments", async () => {
    const { erreurRapprochement } = await import("../rapprochement-rendez-vous");
    const brute = Object.assign(new Error("Invalid invocation emailHash: h:a@b.fr"), {
      code: "P2010",
    });
    const e = erreurRapprochement(brute);
    expect(e.message).toBe("rapprochement : P2010");
    expect(e.cause).toBeUndefined();
  });
});
