// @vitest-environment node
/**
 * Un rendez-vous créé dans la console se pose dans Google Agenda (il ferme le
 * créneau Calendly) sans aucun invité ; échec doux ; lieu et objet gardés ;
 * un rendez-vous reporté retire l'événement.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const creerRendezVous = vi.fn();
const retirerEvenement = vi.fn();
vi.mock("@/server/google-calendar/events", () => ({ creerRendezVous, retirerEvenement }));

import { poserDansGoogleAgenda, retirerDeGoogleAgenda } from "../agenda-google";
import { creerRencontre } from "../creer-rencontre";
import { dossierEnMemoire, fiche } from "./_dossier-en-memoire";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const debut = new Date("2026-11-03T09:00:00Z");

function fauxDb(rencontre: { statut: string; googleEventId: string | null } | null) {
  const update = vi.fn().mockResolvedValue({});
  const tx = {
    rencontre: { update, findUnique: vi.fn().mockResolvedValue(rencontre) },
  };
  return {
    update,
    db: { $transaction: <T>(fn: (t: unknown) => Promise<T>) => fn(tx) } as never,
  };
}

beforeEach(() => {
  creerRendezVous.mockReset();
  retirerEvenement.mockReset();
});

describe("Google Agenda", () => {
  it("pose l'événement et garde son identifiant, sans invité", async () => {
    creerRendezVous.mockResolvedValue({ ok: true, id: "ev1", htmlLink: null });
    const { db, update } = fauxDb(null);
    const ok = await poserDansGoogleAgenda(db, {
      rencontreId: "r1",
      titre: "Point",
      debut,
      fin: new Date(debut.getTime() + 75 * 60_000),
      type: "telephone",
      lieu: "Siège",
      objet: "Devis",
      contact: "Camille",
      telephone: "0600000000",
    });
    expect(ok).toBe(true);
    const arg = creerRendezVous.mock.calls[0]![0];
    expect(arg.lieu).toBe("Siège");
    expect(arg.note).toContain("Objet : Devis");
    expect(arg.telephone).toBe("0600000000");
    expect(update).toHaveBeenCalledWith({ where: { id: "r1" }, data: { googleEventId: "ev1" } });
  });

  it("échec doux : Google injoignable ne lève pas", async () => {
    creerRendezVous.mockResolvedValue({ ok: false, reason: "not_configured" });
    const { db, update } = fauxDb(null);
    const ok = await poserDansGoogleAgenda(db, {
      rencontreId: "r1",
      titre: "t",
      debut,
      fin: debut,
      type: "visio",
    });
    expect(ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("retire l'événement d'un rendez-vous reporté, pas d'un rendez-vous tenu", async () => {
    retirerEvenement.mockResolvedValue({ ok: true });
    const a = fauxDb({ statut: "reporte", googleEventId: "ev1" });
    await retirerDeGoogleAgenda(a.db, "r1");
    expect(retirerEvenement).toHaveBeenCalledWith("ev1");
    expect(a.update).toHaveBeenCalledWith({ where: { id: "r1" }, data: { googleEventId: null } });
    retirerEvenement.mockClear();
    const b = fauxDb({ statut: "tenu", googleEventId: "ev1" });
    await retirerDeGoogleAgenda(b.db, "r1");
    expect(retirerEvenement).not.toHaveBeenCalled();
    const c = fauxDb({ statut: "annule", googleEventId: "ev2" });
    await retirerDeGoogleAgenda(c.db, "r1");
    expect(retirerEvenement).toHaveBeenCalledWith("ev2");
  });
});

describe("lieu et objet", () => {
  it("sont écrits sur la rencontre, tronqués, vides = null", async () => {
    const f = fiche({ raisonSociale: "Fiche Fictive" });
    const base = dossierEnMemoire({ client: [f] });
    await creerRencontre(base.client as never, {
      clientId: f["id"] as string,
      type: "presentiel",
      debut,
      dureeMin: 75,
      lieu: "  Salle A ",
      objet: "",
      parAdminId: ADMIN,
    });
    const r = base.tables["rencontre"]?.[0] as Record<string, unknown> | undefined;
    expect(r?.["lieu"]).toBe("Salle A");
    expect(r?.["objet"]).toBeNull();
  });

  it("rend le titre, la fin et les noms repris tels quels pour Google", async () => {
    const f = fiche({ raisonSociale: "Fiche Fictive" });
    const base = dossierEnMemoire({ client: [f] });
    const r = await creerRencontre(base.client as never, {
      clientId: f["id"] as string,
      type: "telephone",
      debut,
      dureeMin: 75,
      titre: "  Point  ",
      parAdminId: ADMIN,
    });
    expect(r.titre).toBe("Point");
    expect(r.finPrevue.toISOString()).toBe("2026-11-03T10:15:00.000Z");
    expect(r.contactNoms).toEqual([]);
  });

  it("refuse une durée libre invalide sans rien créer", async () => {
    const f = fiche({ raisonSociale: "Fiche Fictive" });
    const base = dossierEnMemoire({ client: [f] });
    for (const d of [0, 481, 7.5, Number.NaN]) {
      await expect(
        creerRencontre(base.client as never, {
          clientId: f["id"] as string,
          type: "telephone",
          debut,
          dureeMin: d,
          parAdminId: ADMIN,
        }),
      ).rejects.toThrow();
    }
    expect(base.tables["rencontre"] ?? []).toHaveLength(0);
  });
});
