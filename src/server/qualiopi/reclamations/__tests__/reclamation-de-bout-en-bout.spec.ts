/**
 * L09 — UNE RÉCLAMATION D'ESSAI, DE BOUT EN BOUT, sur une base simulée.
 *
 * Dépôt (formulaire) → réception datée → accusé automatique immédiat →
 * analyse → réponse signée (corbeille de validation) → réexamen → analyse →
 * seconde réponse → clôture. On vérifie à chaque pas ce que l'auditeur lira :
 * le journal des étapes (datées par le serveur, signées), le statut résumé, et
 * les deux e-mails — l'accusé part seul, la réponse ne part qu'après validation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Etape {
  id: string;
  reclamationId: string;
  etape: string;
  contenu: string;
  auteurId: string | null;
  auteurNom: string;
  creeLe: Date;
}

const h = vi.hoisted(() => {
  const reclamations: Array<Record<string, unknown>> = [];
  const etapes: Etape[] = [];
  let horloge = Date.parse("2026-10-16T14:00:00.000Z");
  const tick = () => new Date((horloge += 60_000));
  const enqueueEmail = vi.fn(
    async (_t: string, _to: string, _l: string, _p: unknown, o?: { exigerValidation?: boolean }) =>
      o?.exigerValidation === true
        ? { enqueued: false, garePourValidation: true, outboxId: "outbox-1" }
        : { enqueued: true },
  );
  function ajouterEtape(data: Omit<Etape, "id" | "creeLe">): Etape {
    const e = { ...data, id: `etape-${etapes.length + 1}`, creeLe: tick() };
    etapes.push(e);
    return e;
  }
  const client = {
    reclamation: {
      findMany: vi.fn(async () => reclamations.map((r) => ({ numero: r["numero"] }))),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const { etapes: imbriquees, ...champs } = data as {
          etapes?: { create: Array<Omit<Etape, "id" | "creeLe" | "reclamationId">> };
        } & Record<string, unknown>;
        const r = {
          id: `rec-${reclamations.length + 1}`,
          reclamantEmail: null,
          reponse: null,
          dateReponse: null,
          enrollmentId: null,
          ...champs,
        };
        reclamations.push(r);
        for (const e of imbriquees?.create ?? [])
          ajouterEtape({ ...e, reclamationId: r.id as string });
        return r;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const r = reclamations.find((x) => x["id"] === where.id);
        if (!r) return null;
        return { ...r, etapes: etapes.filter((e) => e.reclamationId === where.id) };
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const r = reclamations.find((x) => x["id"] === where.id);
          if (!r) throw new Error("introuvable");
          Object.assign(r, data);
          return r;
        },
      ),
      // 🔴 Rien ne s'efface : la base simulée n'offre même pas la méthode.
    },
    reclamationEtape: {
      create: vi.fn(async ({ data }: { data: Omit<Etape, "id" | "creeLe"> }) => ajouterEtape(data)),
    },
    numeroEmis: { findMany: vi.fn(async () => []) },
    $executeRaw: vi.fn(async () => 0),
  };
  const prisma = {
    ...client,
    $transaction: vi.fn(async (fn: (tx: typeof client) => unknown) => fn(client)),
  };
  return { reclamations, etapes, enqueueEmail, prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: h.enqueueEmail }));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(async () => 15),
}));

import { ajouterEtapeReclamation, deposerReclamation } from "../cycle-service";
import { etatEcheances } from "../echeances";

const ADMIN = { id: "00000000-0000-4000-8000-0000000000a1", nom: "Camille Exemple" };
const FORMULAIRE = { id: null, nom: "Formulaire public de réclamation" };

describe("réclamation d'essai — de bout en bout", () => {
  beforeEach(() => {
    h.reclamations.length = 0;
    h.etapes.length = 0;
    h.enqueueEmail.mockClear();
  });

  it("parcourt tout le cycle, sans rien effacer ni réécrire", async () => {
    // 1. Dépôt par un formateur, depuis le formulaire public.
    const recue = new Date("2026-10-16T14:00:00.000Z");
    const deposee = await deposerReclamation({
      qualite: "formateur",
      reclamantNom: "Prénom Formateur",
      reclamantEmail: "formateur@example.test",
      objet: "Salle indisponible à l'arrivée",
      description: "La salle réservée était occupée à 9 h, la session a commencé à 9 h 40.",
      dateReception: recue,
      canal: "formulaire_public",
      auteur: FORMULAIRE,
    });

    expect(deposee.numero).toBe("AXI-REC-2026-001");
    expect(deposee.accuse).toBe("envoye");
    const rec = h.reclamations[0] as Record<string, unknown>;
    // Le formateur n'a pas de case dans `reclamations.source` : `autre`, et la
    // qualité exacte vit dans l'étape de réception.
    expect(rec["source"]).toBe("autre");
    expect(rec["statut"]).toBe("nouvelle");
    expect(h.etapes.map((e) => e.etape)).toEqual(["reception", "accuse"]);
    expect(h.etapes[0]?.contenu).toBe(
      "Réclamation reçue le 16 octobre 2026 par le formulaire de réclamation du site, déposée en qualité de formateur.",
    );
    expect(h.etapes[1]?.auteurNom).toBe("Envoi automatique de l'organisme");

    // L'accusé est parti seul, immédiatement, avec les échéances en jours ouvrés.
    const [gabarit, dest, , payload, options] = h.enqueueEmail.mock.calls[0] as unknown as [
      string,
      string,
      string,
      Record<string, string>,
      Record<string, unknown>,
    ];
    expect(gabarit).toBe("reclamation-accuse");
    expect(dest).toBe("formateur@example.test");
    expect(payload).toEqual({
      numero: "AXI-REC-2026-001",
      recueLe: "16 octobre 2026",
      reponseAvant: "6 novembre 2026",
    });
    expect(options["exigerValidation"]).toBeUndefined();

    // 2. Une réponse ne peut pas précéder l'analyse.
    const tropTot = await ajouterEtapeReclamation({
      reclamationId: deposee.id,
      etape: "reponse",
      contenu: "Nous sommes désolés pour ce retard de démarrage.",
      auteur: ADMIN,
      signataireQualite: "Responsable qualité",
    });
    expect(tropTot.ok).toBe(false);

    // 3. Analyse, puis réponse signée → corbeille de validation.
    expect(
      (
        await ajouterEtapeReclamation({
          reclamationId: deposee.id,
          etape: "analyse",
          contenu: "Double réservation de la salle par le gestionnaire du lieu.",
          auteur: ADMIN,
        })
      ).ok,
    ).toBe(true);
    expect(rec["statut"]).toBe("en_cours");

    const reponse = await ajouterEtapeReclamation({
      reclamationId: deposee.id,
      etape: "reponse",
      contenu: "La salle est désormais confirmée par écrit 48 h avant chaque session.",
      auteur: ADMIN,
      signataireQualite: "Responsable qualité",
    });
    expect(reponse).toEqual({ ok: true, email: "a_valider" });
    expect(rec["statut"]).toBe("resolue");
    expect(rec["reponse"]).toBe(
      "La salle est désormais confirmée par écrit 48 h avant chaque session.",
    );
    const premiereDateReponse = rec["dateReponse"];
    expect(premiereDateReponse).toBeInstanceOf(Date);
    const etapeReponse = h.etapes.find((e) => e.etape === "reponse");
    expect(etapeReponse?.auteurNom).toBe("Camille Exemple");
    expect(etapeReponse?.contenu).toMatch(/Camille Exemple, Responsable qualité\.$/);

    const appelReponse = h.enqueueEmail.mock.calls[1] as unknown as [
      string,
      string,
      string,
      Record<string, string>,
      Record<string, unknown>,
    ];
    expect(appelReponse[0]).toBe("reclamation-reponse");
    expect(appelReponse[3]["signataireNom"]).toBe("Camille Exemple");
    expect(appelReponse[4]["exigerValidation"]).toBe(true);

    // 4. Réexamen demandé, nouvelle analyse, seconde réponse, clôture.
    for (const [etape, contenu] of [
      ["reexamen", "Le formateur conteste : la confirmation écrite ne suffit pas."],
      ["analyse", "Ajout d'un contact sur place joignable dès 8 h 30."],
      ["reponse", "Un contact sur place est désormais nommé sur chaque convocation."],
      ["cloture", "Réponse acceptée par le formateur le 28 octobre."],
    ] as const) {
      const r = await ajouterEtapeReclamation({
        reclamationId: deposee.id,
        etape,
        contenu,
        auteur: ADMIN,
        signataireQualite: "Responsable qualité",
      });
      expect(r.ok, etape).toBe(true);
    }
    expect(rec["statut"]).toBe("cloturee");
    // La première réponse reste dans les colonnes historiques : rien n'est réécrit.
    expect(rec["reponse"]).toBe(
      "La salle est désormais confirmée par écrit 48 h avant chaque session.",
    );
    expect(rec["dateReponse"]).toBe(premiereDateReponse);

    expect(h.etapes.map((e) => e.etape)).toEqual([
      "reception",
      "accuse",
      "analyse",
      "reponse",
      "reexamen",
      "analyse",
      "reponse",
      "cloture",
    ]);
    // Des dates serveur, strictement croissantes.
    const dates = h.etapes.map((e) => e.creeLe.getTime());
    expect([...dates].sort((a, b) => a - b)).toEqual(dates);

    // Les échéances sont toutes tenues.
    const e = etatEcheances(
      recue,
      h.etapes as unknown as Parameters<typeof etatEcheances>[1],
      new Date("2026-12-01T09:00:00Z"),
    );
    expect(e.accuse).toBe("fait");
    expect(e.reponse).toBe("fait");

    // Et la base simulée n'a jamais offert de suppression : aucune n'a été tentée.
    expect("delete" in h.prisma.reclamation).toBe(false);
  });

  it("sans adresse (réclamation reçue par téléphone) : pas d'accusé automatique", async () => {
    const deposee = await deposerReclamation({
      qualite: "entreprise",
      reclamantNom: "Contact entreprise",
      objet: "Facture erronée",
      description: "Le nombre de stagiaires facturés ne correspond pas.",
      dateReception: new Date("2026-10-16T09:00:00.000Z"),
      canal: "telephone",
      auteur: ADMIN,
    });
    expect(deposee.accuse).toBe("sans_adresse");
    expect(h.enqueueEmail).not.toHaveBeenCalled();
    expect(h.reclamations[0]?.["source"]).toBe("client");
    expect(h.etapes.map((x) => x.etape)).toEqual(["reception"]);

    // L'accusé remis par téléphone se consigne à la main.
    const r = await ajouterEtapeReclamation({
      reclamationId: deposee.id,
      etape: "accuse",
      contenu: "Accusé de réception donné de vive voix lors de l'appel, puis par courrier.",
      auteur: ADMIN,
    });
    expect(r).toEqual({ ok: true, email: null });
  });

  it("un dépôt irrecevable se clôt juste après la réception, motif consigné, rien supprimé", async () => {
    const deposee = await deposerReclamation({
      qualite: "autre",
      reclamantNom: "Inconnu",
      reclamantEmail: "spam@example.test",
      objet: "Offre promotionnelle",
      description: "Message publicitaire sans rapport avec une formation.",
      dateReception: new Date("2026-10-16T09:00:00.000Z"),
      canal: "formulaire_public",
      auteur: FORMULAIRE,
    });
    const court = await ajouterEtapeReclamation({
      reclamationId: deposee.id,
      etape: "cloture",
      contenu: "spam",
      auteur: ADMIN,
    });
    expect(court.ok).toBe(false);
    const r = await ajouterEtapeReclamation({
      reclamationId: deposee.id,
      etape: "cloture",
      contenu: "Message publicitaire sans rapport avec la formation.",
      auteur: ADMIN,
    });
    expect(r).toEqual({ ok: true, email: null });
    expect(h.reclamations[0]?.["statut"]).toBe("cloturee");
    const derniere = h.etapes[h.etapes.length - 1];
    expect(derniere?.etape).toBe("cloture");
    expect(String(derniere?.contenu)).toMatch(/^Irrecevable — /);
    expect(h.etapes.map((x) => x.etape)).toContain("reception");
  });

  it("une réponse non signée est refusée", async () => {
    const deposee = await deposerReclamation({
      qualite: "stagiaire",
      reclamantNom: "Stagiaire",
      reclamantEmail: "stagiaire@example.test",
      objet: "Support illisible",
      description: "Le support projeté était illisible du fond de la salle.",
      dateReception: new Date("2026-10-16T09:00:00.000Z"),
      canal: "espace_stagiaire",
      auteur: FORMULAIRE,
    });
    await ajouterEtapeReclamation({
      reclamationId: deposee.id,
      etape: "analyse",
      contenu: "Police trop petite sur trois diapositives.",
      auteur: ADMIN,
    });
    const r = await ajouterEtapeReclamation({
      reclamationId: deposee.id,
      etape: "reponse",
      contenu: "Les supports ont été corrigés et renvoyés au groupe.",
      auteur: ADMIN,
    });
    expect(r).toEqual({ ok: false, erreur: expect.stringMatching(/signée/) });
  });
});
