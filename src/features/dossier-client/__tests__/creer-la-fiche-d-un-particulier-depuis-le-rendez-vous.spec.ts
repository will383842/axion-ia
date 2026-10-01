// @vitest-environment node
/**
 * P-5 : « Créer la fiche prospect depuis ce rendez-vous » sait créer un
 * PARTICULIER. Sans ce choix, un indépendant sans entreprise devenait une
 * « entreprise » à son nom, « SIREN à compléter », avec une recherche
 * d'annuaire inutile.
 *
 *   · le formulaire porte le choix entreprise / particulier (mêmes libellés
 *     que la fiche client), entreprise par défaut ;
 *   · une fiche de particulier ne reçoit jamais de SIREN, même si une case
 *     de l'annuaire est restée cochée.
 *
 * Mutations qui font rougir : retirer le champ `type` du formulaire ; poser
 * le SIREN confirmé quel que soit le type.
 * Contre-témoin : une entreprise garde le SIREN confirmé.
 * SIREN FICTIF (clé de Luhn valide, aucune entreprise réelle visée).
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { donneesDeLaFicheProspect } from "../creer-prospect";

const SIREN_FICTIF = "123456782";
const VUE = "src/components/admin/dossier-client/ApresLAppelVue.tsx";

describe("créer la fiche d'un particulier depuis le rendez-vous", () => {
  it("le formulaire propose entreprise ou particulier, entreprise par défaut", () => {
    const src = readFileSync(VUE, "utf8");
    const form = src.slice(src.indexOf("action={creerProspectAction}"));
    expect(form).toMatch(/name="type"\s+value="entreprise"\s+defaultChecked/);
    expect(form).toMatch(/name="type"\s+value="particulier"/);
    expect(form).toContain("Particulier (B2C — CPF perso)");
  });

  it("un particulier n'a jamais de SIREN", () => {
    const d = donneesDeLaFicheProspect({
      rencontreId: "r",
      raisonSociale: "Camille Fictive",
      type: "particulier",
      sirenConfirme: SIREN_FICTIF,
      parAdminId: "a",
    });
    expect(d.type).toBe("particulier");
    expect("siren" in d).toBe(false);
  });

  it("contre-témoin : une entreprise garde le SIREN confirmé", () => {
    const d = donneesDeLaFicheProspect({
      rencontreId: "r",
      raisonSociale: "Entreprise Fictive",
      sirenConfirme: SIREN_FICTIF,
      parAdminId: "a",
    });
    expect(d).toEqual(expect.objectContaining({ type: "entreprise", siren: SIREN_FICTIF }));
  });
});
