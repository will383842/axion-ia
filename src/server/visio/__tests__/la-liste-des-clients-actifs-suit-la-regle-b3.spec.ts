/**
 * La liste des destinataires du préavis suit la règle B3.
 *
 * Un client est actif s'il a au moins un devis, une facture de formation, une
 * session, une inscription financée, un contrat de coaching, une mission
 * d'audit ou un dossier de financement. La mesure du 28/09 (lecture seule en
 * production) donnait UNE fiche active : une session, une facture de
 * formation, un dossier de financement, aucun devis. Une règle qui ne
 * regarderait que les devis la manquerait.
 *
 * Le dernier test confronte `RELATIONS_B3` au schéma Prisma RÉEL : si une
 * relation est renommée ou supprimée (comme `Invoice` et `Refund` l'ont été le
 * 26/08), la règle ne peut pas continuer à la lire en silence.
 *
 * Angle mort avoué : on compte des pièces, sans regarder leur statut (un devis
 * refusé rend la fiche active). C'est voulu : le préavis s'adresse à quiconque a
 * reçu une pièce sous l'ancienne liste de sous-traitants.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  RELATIONS_B3,
  clientsActifsPourPreavis,
  estClientActif,
  type ComptesB3,
  type LecteurClients,
} from "../preavis-destinataires";

const ZERO: ComptesB3 = {
  devis: 0,
  facturesFormation: 0,
  sessions: 0,
  enrollmentsFinances: 0,
  coachingContracts: 0,
  auditMissions: 0,
  dossiersFinancement: 0,
};

function lecteur(
  fiches: Array<{ id: string; contactEmail: string | null; _count: Partial<ComptesB3> }>,
): LecteurClients {
  return { client: { findMany: async () => fiches } };
}

describe("règle B3 — qui est un client actif", () => {
  it("une fiche avec une seule facture de formation est active", () => {
    expect(estClientActif({ ...ZERO, facturesFormation: 1 })).toBe(true);
  });

  it("une fiche sans aucune pièce ne l'est pas", () => {
    expect(estClientActif(ZERO)).toBe(false);
  });

  it.each(Object.keys(RELATIONS_B3) as Array<keyof ComptesB3>)(
    "une seule pièce « %s » suffit",
    (r) => {
      expect(estClientActif({ ...ZERO, [r]: 1 })).toBe(true);
    },
  );

  it("la fiche mesurée le 28/09 (session + facture + dossier, sans devis) est active", async () => {
    const r = await clientsActifsPourPreavis(
      lecteur([
        {
          id: "c1",
          contactEmail: "client@exemple.invalid",
          _count: { sessions: 1, facturesFormation: 1, dossiersFinancement: 1 },
        },
        { id: "c2", contactEmail: "prospect@exemple.invalid", _count: {} },
      ]),
    );
    expect(r.actifs).toBe(1);
    expect(r.destinataires).toEqual([{ clientId: "c1", email: "client@exemple.invalid" }]);
    expect(r.sansAdresse).toBe(0);
  });

  it("compte à part les fiches actives sans adresse, et une adresse partagée une seule fois", async () => {
    const r = await clientsActifsPourPreavis(
      lecteur([
        { id: "c1", contactEmail: null, _count: { devis: 1 } },
        { id: "c2", contactEmail: "", _count: { devis: 1 } },
        { id: "c3", contactEmail: "pas-une-adresse", _count: { devis: 1 } },
        { id: "c4", contactEmail: "meme@exemple.invalid", _count: { devis: 1 } },
        { id: "c5", contactEmail: "MEME@exemple.invalid", _count: { auditMissions: 2 } },
      ]),
    );
    expect(r.actifs).toBe(5);
    expect(r.sansAdresse).toBe(3);
    expect(r.adressesEnDouble).toBe(1);
    expect(r.destinataires.map((d) => d.clientId)).toEqual(["c4"]);
  });

  it("chaque relation de la règle existe sur `Client` et vise le bon modèle (schéma réel)", () => {
    const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    const bloc = /\nmodel Client \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
    expect(bloc, "modèle Client introuvable dans le schéma").not.toBe("");
    for (const [relation, modele] of Object.entries(RELATIONS_B3)) {
      expect(bloc, `Client.${relation} → ${modele}[] absent du schéma`).toMatch(
        new RegExp(`\\n\\s+${relation}\\s+${modele}\\[\\]`),
      );
    }
  });
});
