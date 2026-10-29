import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { EnTete } from "@/features/dossier-client/fiche/lire-en-tete";

import { CarteProchaineAction } from "../CarteProchaineAction";
import { etapesDuParcours } from "../EnTeteFiche";
import { TuilesFiche } from "../TuilesFiche";

const tache = {
  intitule: "Rappeler le dirigeant",
  echeanceLe: new Date("2026-10-30T00:00:00Z"),
  responsable: "Will",
};
const carte = (t: unknown, n: number | null, activitePrete = false): string =>
  renderToStaticMarkup(
    <CarteProchaineAction
      tache={t === "panne" ? { ok: false } : { ok: true, valeur: t as typeof tache | null }}
      nbEmailsAValider={n === null ? { ok: false } : { ok: true, valeur: n }}
      qBase="/fr/x/qualiopi"
      ficheHref="/fr/x/qualiopi/clients/1"
      activitePrete={activitePrete}
    />,
  );
const pleins = (h: string): number => (h.match(/class="admin-button[ "]/g) ?? []).length;

describe("CarteProchaineAction", () => {
  it("affiche la tâche, l'échéance et le responsable, un seul bouton plein", () => {
    const h = carte(tache, 0);
    expect(h).toContain("Prochaine action");
    expect(h).toContain("avant le 30 oct.");
    expect(h).toContain("responsable");
    expect(h).toContain("Voir toutes les tâches");
    expect(pleins(h)).toBe(1);
    expect(h).toContain("?onglet=resume");
  });
  it("mène à l'activité quand elle est prête", () => {
    expect(carte(tache, 0, true)).toContain("?onglet=activite&amp;filtre=taches");
  });
  it("« Relire et valider » quand un e-mail attend, toujours un seul bouton plein", () => {
    const h = carte(tache, 2);
    expect(h).toContain("Relire et valider");
    expect(h).toContain('href="/fr/x/qualiopi/emails"');
    expect(pleins(h)).toBe(1);
  });
  it("état vide vert sans bouton plein", () => {
    const h = carte(null, 0);
    expect(h).toContain("Rien à faire pour ce client aujourd&#x27;hui.");
    expect(pleins(h)).toBe(0);
  });
  it("lecture en panne : « Lecture impossible »", () => {
    expect(carte("panne", 0)).toContain("Lecture impossible");
    expect(carte(tache, null)).toContain("Lecture impossible");
  });
});

const ok = <T,>(valeur: T) => ({ ok: true as const, valeur });
const enTete = (surcharge: Partial<EnTete> = {}): EnTete => ({
  statut: "devis_envoye",
  prochaineTache: ok(null),
  nbTachesOuvertes: ok(0),
  nbEmailsAValider: ok(0),
  pipeline: ok({ nb: 1, htCents: 100_000, chancesPct: 40 }),
  sante: ok({ niveau: "bonne" as const, raisons: [] }),
  encours: ok({ ttcCents: 0, avantLe: null }),
  questionnaire: ok(null),
  nbRendezVous: ok(0),
  nbPrestations: ok(0),
  nbPersonnes: ok(0),
  nbDevisEtFactures: ok(0),
  ...surcharge,
});
const tuiles = (e: EnTete): string =>
  renderToStaticMarkup(<TuilesFiche enTete={e} ficheHref="/f" qBase="/q" />);

describe("TuilesFiche", () => {
  it("pipeline en HT avec le TTC dessous, sans « Probabilité »", () => {
    const h = tuiles(enTete());
    expect(h).toContain("1 000 € HT");
    expect(h).toContain("1 200 € TTC");
    expect(h).toContain("40 % de chances de signer");
    expect(h).not.toMatch(/Probabilité/);
  });
  it("chances non estimées", () => {
    expect(tuiles(enTete({ pipeline: ok({ nb: 1, htCents: 1000, chancesPct: null }) }))).toContain(
      "chances non estimées",
    );
  });
  it("santé : règle écrite en clair, ou raison", () => {
    expect(tuiles(enTete())).toContain(
      "Bonne : un échange il y a moins de 14 jours, aucun paiement en retard, aucune tâche en retard.",
    );
    const h = tuiles(
      enTete({ sante: ok({ niveau: "a_surveiller" as const, raisons: ["2 tâches en retard"] }) }),
    );
    expect(h).toContain("À surveiller");
    expect(h).toContain("2 tâches en retard");
  });
  it("reste à encaisser : rien à encaisser, ou montant TTC avec l'échéance", () => {
    expect(tuiles(enTete())).toContain("Rien à encaisser");
    const h = tuiles(
      enTete({ encours: ok({ ttcCents: 120_000, avantLe: new Date("2026-11-15T12:00:00Z") }) }),
    );
    expect(h).toContain("1 200 € TTC");
    expect(h).toContain("à payer avant le 15 nov.");
  });
  it("questionnaire : pas envoyé, 2 sur 5, complet", () => {
    expect(tuiles(enTete())).toContain("Pas envoyé");
    const h = tuiles(
      enTete({
        questionnaire: ok({ recus: 2, attendus: 5, avantLe: new Date("2026-11-02T12:00:00Z") }),
      }),
    );
    expect(h).toContain("2 sur 5");
    expect(h).toContain("à rendre avant le 2 nov.");
    expect(
      tuiles(enTete({ questionnaire: ok({ recus: 5, attendus: 5, avantLe: null }) })),
    ).not.toContain("à rendre");
  });
  it("une lecture en panne dit « Lecture impossible » (jamais 0)", () => {
    const h = tuiles(
      enTete({
        pipeline: { ok: false },
        sante: { ok: false },
        encours: { ok: false },
        questionnaire: { ok: false },
      }),
    );
    expect(h.match(/Lecture impossible/g)).toHaveLength(4);
  });
  it("aucun bouton plein dans les tuiles", () => {
    expect(pleins(tuiles(enTete()))).toBe(0);
  });
});

describe("etapesDuParcours", () => {
  it("devis envoyé : prospect fait, devis courant", () => {
    expect(etapesDuParcours("devis_envoye").map((e) => e.etat)).toEqual([
      "fait",
      "courant",
      "a_venir",
    ]);
  });
  it("perdu et inactif : pastille grise hors parcours", () => {
    for (const s of ["perdu", "client_inactif"]) {
      const e = etapesDuParcours(s);
      expect(e).toHaveLength(4);
      expect(e[3]!.etat).toBe("hors_parcours");
      expect(e.slice(0, 3).every((x) => x.etat === "a_venir")).toBe(true);
    }
  });
});
