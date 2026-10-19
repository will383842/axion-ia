// @vitest-environment node

/**
 * LOT P15 — offres d'intervenants (interrupteur `qualiopi.documents_organisme.actif`).
 *
 *  (a) CH4-38 : une offre qui porte des candidatures ne se supprime pas, elle
 *      s'archive — interrupteur ACTIF seulement.
 *  (b) CH4-37 : la réponse automatique « poste pourvu » n'écrit jamais à une
 *      candidature à une offre d'intervenant, formateur SALARIÉ compris.
 *
 * Éteint (ou `essai`, qui n'agit pas sur ces objets sans session) : le
 * comportement d'avant, à l'octet près.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { etat, db } = vi.hoisted(() => ({
  etat: { valeur: "eteint" as "eteint" | "essai" | "actif" },
  db: {
    offre: vi.fn(async (..._a: unknown[]): Promise<unknown> => null),
    supprimer: vi.fn(async (..._a: unknown[]) => ({})),
    journal: vi.fn(async (..._a: unknown[]) => ({})),
    lister: vi.fn(async (..._a: unknown[]): Promise<unknown[]> => []),
    compter: vi.fn(async (..._a: unknown[]) => 0),
    ecrire: vi.fn(async (..._a: unknown[]) => ({ ecrit: true, enfile: true })),
  },
}));

vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "admin-1", role: "super_admin" } }) }));
vi.mock("@/server/auth/habilitations", () => ({
  peutConsulter: () => true,
  peutGererLesOffres: () => true,
  estSuperAdmin: () => true,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobOffer: { findUnique: db.offre, delete: db.supprimer },
    activityLog: { create: db.journal },
    setting: {
      findUnique: async (a: { where: { key: string } }) => {
        if (a.where.key === "qualiopi.documents_organisme.actif")
          return { value: { etat: etat.valeur } };
        if (a.where.key === "recrutement.reponse-poste-pourvu-auto")
          return { value: { actif: true } };
        return null;
      },
    },
    $queryRaw: async () => [],
    jobApplication: { findMany: db.lister, count: db.compter },
  },
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "127.0.0.1" }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/indexnow", () => ({ pingIndexNow: async () => {} }));
vi.mock("@/server/content-gen/indexing/enqueue", () => ({
  enqueueGoogleIndexingForUrls: async () => {},
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v }));
vi.mock("@/features/admin-job-applications/envoyer-reponse", () => ({
  ecrireEtEnfilerReponse: (...a: unknown[]) => db.ecrire(...a),
}));
vi.mock("@/server/careers/proposer-reseau-auto", () => ({
  DEBUT_PROPOSITION_RESEAU: new Date("2026-09-29T12:00:00+02:00"),
  preparerProposition: async () => ({ fiche: "absente" }),
  envoyerProposition: async () => "envoyee",
}));
vi.mock("@/server/qualiopi/formateurs-independants/etats-entree", () => ({
  lireEtatsEntree: async () => ({ nature_offre: false }),
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-lecture", () => ({
  lireEtatsEntree: async () => ({ nature_offre: false }),
}));

import { deleteJobOfferAction } from "@/features/admin-job-offers/actions";
import { estOffreIntervenant } from "@/lib/careers/etapes-intervenant";
import {
  critereEligible,
  critereEligibleActuel,
  passerReponsePostePourvu,
} from "../reponse-poste-pourvu";
import { messageRefusSuppression } from "../garde-suppression-offre";

const ID = "11111111-1111-4111-8111-111111111111";
const form = () => {
  const f = new FormData();
  f.set("id", ID);
  return f;
};
const MAINTENANT = new Date("2026-10-19T10:00:00Z");

beforeEach(() => {
  etat.valeur = "eteint";
  for (const m of Object.values(db)) m.mockClear();
});

describe("(a) CH4-38 — supprimer une offre qui porte des candidatures", () => {
  it("message : « Archivez l'offre : elle porte N candidatures »", () => {
    expect(messageRefusSuppression(3)).toBe("Archivez l'offre : elle porte 3 candidatures.");
    expect(messageRefusSuppression(1)).toBe("Archivez l'offre : elle porte 1 candidature.");
  });

  it("ACTIF + candidatures : refus, rien n'est supprimé ni journalisé", async () => {
    etat.valeur = "actif";
    db.offre.mockResolvedValue({ slug: "x", _count: { applications: 4 } });
    const r = await deleteJobOfferAction({ ok: false, error: "" }, form());
    expect(r).toEqual({ ok: false, error: "Archivez l'offre : elle porte 4 candidatures." });
    expect(db.supprimer).not.toHaveBeenCalled();
    expect(db.journal).not.toHaveBeenCalled();
  });

  it("ACTIF sans candidature : la suppression passe", async () => {
    etat.valeur = "actif";
    db.offre.mockResolvedValue({ slug: "x", _count: { applications: 0 } });
    expect(await deleteJobOfferAction({ ok: false, error: "" }, form())).toEqual({ ok: true });
    expect(db.supprimer).toHaveBeenCalledTimes(1);
  });

  it.each(["eteint", "essai"] as const)("%s + candidatures : comportement d'avant", async (e) => {
    etat.valeur = e;
    db.offre.mockResolvedValue({ slug: "x", _count: { applications: 4 } });
    expect(await deleteJobOfferAction({ ok: false, error: "" }, form())).toEqual({ ok: true });
    expect(db.supprimer).toHaveBeenCalledTimes(1);
    expect(db.journal.mock.calls[0]?.[0]).toMatchObject({
      data: { changes: { candidaturesDetachees: 4 } },
    });
  });
});

describe("(b) CH4-37 — la réponse « poste pourvu » ignore les offres d'intervenants", () => {
  it("ÉTEINT : le filtre est celui d'avant (snapshot)", () => {
    expect(JSON.stringify(critereEligible(MAINTENANT, ["t"], {}))).toBe(
      JSON.stringify(critereEligible(MAINTENANT, ["t"], { intervenantsExclus: false })),
    );
    expect(critereEligible(MAINTENANT, ["t"], { intervenantsExclus: false })).toMatchSnapshot();
  });

  it("ALLUMÉ : le filtre ajoute exactement une exclusion", () => {
    const avant = critereEligible(MAINTENANT) as { AND: unknown[] };
    const apres = critereEligible(MAINTENANT, [], { intervenantsExclus: true }) as {
      AND: unknown[];
    };
    expect(apres.AND.length).toBe(avant.AND.length + 1);
    expect(apres.AND.slice(0, avant.AND.length)).toEqual(avant.AND);
  });

  it("critereEligibleActuel : éteint = sans exclusion ; actif = avec", async () => {
    const eteint = JSON.stringify(await critereEligibleActuel(MAINTENANT));
    expect(eteint).toBe(JSON.stringify(critereEligible(MAINTENANT, [], { natureOffreLue: false })));
    etat.valeur = "actif";
    expect(JSON.stringify(await critereEligibleActuel(MAINTENANT))).toBe(
      JSON.stringify(
        critereEligible(MAINTENANT, [], { natureOffreLue: false, intervenantsExclus: true }),
      ),
    );
  });

  it("la clause Prisma couvre titre, slug et intitulé figé, formateur/formatrice", () => {
    const tout = critereEligible(MAINTENANT, [], { intervenantsExclus: true }) as {
      AND: unknown[];
    };
    const j = JSON.stringify(tout.AND[tout.AND.length - 1]);
    for (const champ of ["titleFr", "slug", "offerTitleSnap"]) expect(j).toContain(`"${champ}"`);
    expect(j).toContain('"formateur"');
    expect(j).toContain('"formatrice"');
  });

  it("FILET : un formateur SALARIÉ renvoyé par la base n'est jamais écrit", async () => {
    etat.valeur = "actif";
    const lot = [
      { slug: "formateur-ia-itinerant", titleFr: "Formateur IA en entreprise (itinérant)" },
      { slug: "formatrice-ia", titleFr: "Formatrice IA" },
    ].map((offer, i) => ({
      id: `id-${i}`,
      email: "c",
      locale: "fr",
      status: "new",
      offerTitleSnap: offer.titleFr,
      firstName: "Camille",
      submittedAt: new Date("2026-08-01T00:00:00Z"),
      offer: { ...offer, employmentType: "FULL_TIME", secondaryEmploymentType: null },
    }));
    for (const c of lot) expect(estOffreIntervenant(c.offer)).toBe(true);
    db.lister.mockResolvedValue([
      ...lot,
      {
        id: "id-r",
        email: "c",
        locale: "fr",
        status: "new",
        offerTitleSnap: "Rédacteur web",
        firstName: "Camille",
        submittedAt: new Date("2026-08-01T00:00:00Z"),
        offer: {
          slug: "redacteur",
          titleFr: "Rédacteur web",
          employmentType: "FULL_TIME",
          secondaryEmploymentType: null,
        },
      },
    ]);
    const bilan = await passerReponsePostePourvu(MAINTENANT);
    expect(bilan.envoyees).toBe(1);
    expect(bilan.ecartees).toBe(2);
    expect(db.ecrire).toHaveBeenCalledTimes(1);
    expect((db.ecrire.mock.calls[0]?.[0] as { id: string }).id).toBe("id-r");
    // La clause envoyée à la base porte l'exclusion.
    expect((db.lister.mock.calls[0]?.[0] as { where: unknown }).where).toEqual(
      critereEligible(MAINTENANT, [], { natureOffreLue: false, intervenantsExclus: true }),
    );
  });

  it("ÉTEINT : le même lot passe tel quel (aucun filet)", async () => {
    db.lister.mockResolvedValue([
      {
        id: "id-0",
        email: "c",
        locale: "fr",
        status: "new",
        offerTitleSnap: "Formatrice IA",
        firstName: "Camille",
        submittedAt: new Date("2026-08-01T00:00:00Z"),
        offer: {
          slug: "formatrice-ia",
          titleFr: "Formatrice IA",
          employmentType: "FULL_TIME",
          secondaryEmploymentType: null,
        },
      },
    ]);
    const bilan = await passerReponsePostePourvu(MAINTENANT);
    expect(bilan.envoyees).toBe(1);
    expect((db.lister.mock.calls[0]?.[0] as { where: unknown }).where).toEqual(
      critereEligible(MAINTENANT, [], { natureOffreLue: false }),
    );
  });
});
