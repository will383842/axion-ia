// @vitest-environment node
/**
 * Lot L0c-3 — « Ajouter un candidat formateur » en console (calque de la
 * saisie manuelle des apporteurs). Livré ÉTEINT (`formateurs.ajout_console`).
 *
 * Règles : administrateur seulement ; nature figée `freelance`, origine
 * `console` ; F1 SEULEMENT si la case est cochée (et par le module d'envoi, qui
 * exige le texte validé) ; une adresse RELAIS (Indeed…) n'arrête jamais rien par
 * l'empreinte ; « Adresse réelle » la remplace pour les envois.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  estAdresseRelais,
  preparerSaisieCandidatFormateur,
} from "@/lib/careers/candidat-formateur-console";

const h = vi.hoisted(() => ({
  role: "admin" as string,
  allume: true,
  existant: null as null | {
    id: string;
    offerId: string | null;
    origine: string | null;
    invitationFormateurAt: Date | null;
  },
  /** Fiches réellement « en base » : une transaction qui échoue n'en laisse aucune. */
  base: [] as Array<Record<string, unknown>>,
  echecJournal: false,
  echecEnvoi: false,
  cree: [] as Array<Record<string, unknown>>,
  maj: [] as Array<Record<string, unknown>>,
  envois: [] as Array<Record<string, unknown>>,
  resultatEnvoi: "envoye" as string,
  texteValide: true,
}));

vi.mock("@/auth", () => ({
  auth: async () => ({ user: { id: "11111111-1111-4111-8111-111111111111", role: h.role } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/qualiopi/formateurs-independants/etats-entree", () => ({
  lireEtatsEntree: async () => ({ ajout_console: h.allume }),
}));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({
  texteValide: async () => h.texteValide,
  envoyer: async (e: Record<string, unknown>) => {
    if (h.echecEnvoi) throw new Error("panne d'envoi");
    h.envois.push(e);
    return h.resultatEnvoi;
  },
}));
vi.mock("@/lib/prisma", () => {
  const jobApplication = {
    findFirst: async (a: { where: { emailHash: string } }) =>
      h.existant ??
      (h.base.find((f) => f.emailHash === a.where.emailHash)
        ? {
            id: "22222222-2222-4222-8222-222222222222",
            offerId: "offre-1",
            origine: "console",
            invitationFormateurAt: null,
          }
        : null),
    create: async (a: { data: Record<string, unknown> }) => {
      h.cree.push(a.data);
      h.base.push(a.data);
      return { id: "22222222-2222-4222-8222-222222222222" };
    },
    update: async (a: { data: Record<string, unknown> }) => {
      h.maj.push(a.data);
      return {};
    },
  };
  const activityLog = {
    create: async () => {
      if (h.echecJournal) throw new Error("panne du journal");
      return {};
    },
  };
  return {
    prisma: {
      jobOffer: { findFirst: async () => ({ id: "offre-1", titleFr: "Formateur IA freelance" }) },
      jobApplication,
      activityLog,
      // Transaction simulée : un échec dans le rappel annule les écritures faites dedans.
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const avant = { cree: [...h.cree], base: [...h.base] };
        try {
          return await fn({ jobApplication, activityLog });
        } catch (e) {
          h.cree = avant.cree;
          h.base = avant.base;
          throw e;
        }
      },
    },
  };
});

const { ajouterCandidatFormateurAction } = await import("../candidat-formateur-actions");

function saisie(over: Record<string, unknown> = {}) {
  return {
    prenom: "Marie",
    nom: "Dupont",
    email: "marie@exemple.fr",
    telephone: "0612345678",
    origine: "salon",
    adresseReelle: "",
    envoyerInvitation: false,
    accordContact: false,
    ...over,
  };
}

beforeEach(() => {
  h.role = "admin";
  h.allume = true;
  h.existant = null;
  h.base = [];
  h.echecJournal = false;
  h.echecEnvoi = false;
  h.cree = [];
  h.maj = [];
  h.envois = [];
  h.resultatEnvoi = "envoye";
  h.texteValide = true;
});

describe("L0c-3 — règles pures", () => {
  it("adresse relais reconnue par son domaine", () => {
    expect(estAdresseRelais("abc123@indeedemail.com")).toBe(true);
    expect(estAdresseRelais("Marie@Exemple.fr")).toBe(false);
  });

  it("adresse relais sans adresse réelle : aucune empreinte (jamais d'arrêt par elle)", () => {
    const p = preparerSaisieCandidatFormateur(saisie({ email: "x@indeedemail.com" }) as never);
    expect(p).toMatchObject({
      ok: true,
      relais: true,
      adresseEnvoi: "x@indeedemail.com",
      empreinteSur: null,
    });
  });

  it("adresse réelle fournie : elle sert aux envois et à l'empreinte", () => {
    const p = preparerSaisieCandidatFormateur(
      saisie({ email: "x@indeedemail.com", adresseReelle: "marie@exemple.fr" }) as never,
    );
    expect(p).toMatchObject({
      ok: true,
      adresseEnvoi: "marie@exemple.fr",
      empreinteSur: "marie@exemple.fr",
    });
  });

  it("adresse venue d'ailleurs : pas d'invitation sans accord", () => {
    expect(
      preparerSaisieCandidatFormateur(
        saisie({ origine: "recommandation", envoyerInvitation: true }) as never,
      ).ok,
    ).toBe(false);
  });
});

describe("L0c-3 — l'action", () => {
  it("coupé : rien n'est écrit", async () => {
    h.allume = false;
    const r = await ajouterCandidatFormateurAction(saisie());
    expect(r.ok).toBe(false);
    expect(h.cree).toHaveLength(0);
  });

  it("un éditeur ne peut pas ajouter de candidat", async () => {
    h.role = "editor";
    expect((await ajouterCandidatFormateurAction(saisie())).ok).toBe(false);
    expect(h.cree).toHaveLength(0);
  });

  it("case décochée : la candidature est créée, aucun e-mail", async () => {
    const r = await ajouterCandidatFormateurAction(saisie());
    expect(r.ok).toBe(true);
    expect(h.cree[0]).toMatchObject({ natureCollaboration: "freelance", origine: "console" });
    expect(h.envois).toHaveLength(0);
  });

  it("case cochée : F1 par le module d'envoi, invitation datée", async () => {
    const r = await ajouterCandidatFormateurAction(saisie({ envoyerInvitation: true }));
    expect(r.ok).toBe(true);
    expect(h.envois).toHaveLength(1);
    expect(h.envois[0]).toMatchObject({
      gabarit: "formateur-invitation-echange",
      destinataire: "marie@exemple.fr",
      entityType: "JobApplication",
    });
    expect(String((h.envois[0]!.payload as { lien: string }).lien)).toContain(
      "/fr/appel/formateur-independant?depuis=fa-22222222-2222-4222-8222-222222222222",
    );
    expect(h.maj[0]).toHaveProperty("invitationFormateurAt");
  });

  it("texte de l'invitation non validé : refus AVANT d'écrire", async () => {
    h.texteValide = false;
    const r = await ajouterCandidatFormateurAction(saisie({ envoyerInvitation: true }));
    expect(r.ok).toBe(false);
    expect(h.cree).toHaveLength(0);
    expect(h.envois).toHaveLength(0);
  });

  it("l'origine saisie ne fausse pas la provenance mesurée (aucune balise utm)", async () => {
    await ajouterCandidatFormateurAction(saisie({ origine: "linkedin" }));
    expect(h.cree[0]).not.toHaveProperty("utmSource");
    expect(h.cree[0]).toMatchObject({ answers: { "Origine (saisie en console)": "LinkedIn" } });
  });

  it("une candidature existe déjà pour cette adresse : rien n'est créé", async () => {
    h.existant = {
      id: "ancienne",
      offerId: "autre-offre",
      origine: "formulaire",
      invitationFormateurAt: null,
    };
    const r = await ajouterCandidatFormateurAction(saisie({ envoyerInvitation: true }));
    expect(r.ok).toBe(false);
    expect(h.cree).toHaveLength(0);
    expect(h.envois).toHaveLength(0);
  });

  it("même adresse + même offre : la fiche est retrouvée et dite, rien n'est créé ni écrasé", async () => {
    h.existant = {
      id: "ancienne",
      offerId: "offre-1",
      origine: "formulaire",
      invitationFormateurAt: null,
    };
    const r = await ajouterCandidatFormateurAction(saisie({ envoyerInvitation: true }));
    expect(r).toMatchObject({ ok: true, id: "ancienne" });
    expect(r.message).toMatch(/existe déjà/);
    expect(h.cree).toHaveLength(0);
    expect(h.maj).toHaveLength(0);
    // fiche venue du formulaire public : l'invitation ne part pas d'ici
    expect(h.envois).toHaveLength(0);
  });

  it("erreur à mi-chemin (journal) : aucune fiche ne reste ; le second envoi n'en crée qu'une", async () => {
    h.echecJournal = true;
    const premier = await ajouterCandidatFormateurAction(saisie());
    expect(premier.ok).toBe(false);
    expect(h.base).toHaveLength(0);

    h.echecJournal = false;
    const second = await ajouterCandidatFormateurAction(saisie());
    expect(second.ok).toBe(true);
    expect(h.base).toHaveLength(1);

    const troisieme = await ajouterCandidatFormateurAction(saisie());
    expect(troisieme).toMatchObject({ ok: true, id: second.ok ? second.id : "" });
    expect(troisieme.message).toMatch(/existe déjà/);
    expect(h.base).toHaveLength(1);
  });

  it("fiche posée puis panne d'envoi : pas d'échec affiché, et le renvoi ne duplique pas", async () => {
    h.echecEnvoi = true;
    const premier = await ajouterCandidatFormateurAction(saisie({ envoyerInvitation: true }));
    expect(premier.ok).toBe(true);
    expect(premier.message).toMatch(/n'est pas partie/);
    expect(h.base).toHaveLength(1);

    h.echecEnvoi = false;
    const second = await ajouterCandidatFormateurAction(saisie({ envoyerInvitation: true }));
    expect(second.ok).toBe(true);
    expect(h.base).toHaveLength(1);
    // reprise de l'invitation, sous la même clé gardée
    expect(h.envois).toHaveLength(1);
    expect(h.envois[0]).toMatchObject({
      jobId: "fi-f1-22222222-2222-4222-8222-222222222222",
    });
  });

  it("adresse relais : jamais d'arrêt par l'empreinte (pas de recherche de doublon)", async () => {
    h.existant = {
      id: "ancienne",
      offerId: "offre-1",
      origine: "formulaire",
      invitationFormateurAt: null,
    };
    const r = await ajouterCandidatFormateurAction(saisie({ email: "x@indeedemail.com" }));
    expect(r.ok).toBe(true);
    expect(h.cree[0]).toMatchObject({ emailHash: null });
  });
});
