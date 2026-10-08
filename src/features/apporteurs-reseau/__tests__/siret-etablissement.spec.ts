import { describe, expect, it, vi } from "vitest";

// Plusieurs activités = un SIREN, plusieurs SIRET (2026-10-08). L'établissement du SIRET est lu
// au registre (actif, adresse, NAF) ; le contrat et l'autofacture affichent le SIRET et l'adresse
// de l'établissement, JAMAIS un libellé d'activité ni « agent commercial » : c'est un contrat
// d'APPORT D'AFFAIRES (art. 1.4 : ni agence commerciale ni L.134-1).

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { luhnValid } from "@/lib/siret";

import { lireEtablissementParSiret } from "../annuaire";
import { construireDonneesAutofacture } from "../autofacture-donnees";
import { texteDuContrat } from "../contrat-pdf";
import { valeursDuContrat } from "../signature-regles";

const SIREN = "732829320";
let SIRET = "";
let AUTRE = "";
for (let i = 0; i < 100000 && !AUTRE; i++) {
  const c = `${SIREN}${String(i).padStart(5, "0")}`;
  if (luhnValid(c)) {
    if (!SIRET) SIRET = c;
    else AUTRE = c;
  }
}

function registre(
  etab: { siret: string; etat: string; adresse: string; naf: string },
  unite = "A",
) {
  return vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              siren: SIREN,
              nom_complet: "DELPHINE EXEMPLE",
              etat_administratif: unite,
              nature_juridique: "1000",
              complements: { est_entrepreneur_individuel: true },
              siege: {
                siret: AUTRE,
                adresse: "1 avenue du Siège 75001 Paris",
                activite_principale: "68.20A",
                etat_administratif: "A",
              },
              matching_etablissements: [
                {
                  siret: etab.siret,
                  adresse: etab.adresse,
                  activite_principale: etab.naf,
                  etat_administratif: etab.etat,
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
  );
}

describe("registre : l'établissement d'un SIRET", () => {
  it("adresse et NAF de l'ÉTABLISSEMENT (pas du siège) ; actif si l'unité et l'établissement le sont", async () => {
    const r = await lireEtablissementParSiret(SIRET, {
      fetch: registre({
        siret: SIRET,
        etat: "A",
        adresse: "8 rue du Domicile 69003 Lyon",
        naf: "46.19B",
      }) as never,
    });
    expect(r).toMatchObject({
      ok: true,
      entreprise: {
        siren: SIREN,
        siret: SIRET,
        adresse: "8 rue du Domicile 69003 Lyon",
        naf: "46.19B",
        active: true,
      },
    });
  });

  it("établissement FERMÉ, ou unité légale cessée : inactif", async () => {
    const f1 = registre({ siret: SIRET, etat: "F", adresse: "x", naf: "46.19B" });
    expect(await lireEtablissementParSiret(SIRET, { fetch: f1 as never })).toMatchObject({
      entreprise: { active: false },
    });
    const f2 = registre({ siret: SIRET, etat: "A", adresse: "x", naf: "46.19B" }, "C");
    expect(await lireEtablissementParSiret(SIRET, { fetch: f2 as never })).toMatchObject({
      entreprise: { active: false },
    });
  });

  it("SIRET absent de la réponse : introuvable ; clé fausse : invalide, sans appel", async () => {
    // La réponse ne porte qu'un autre établissement (et le siège, autre SIRET) : introuvable.
    const f = registre({ siret: AUTRE, etat: "A", adresse: "x", naf: "x" });
    expect(await lireEtablissementParSiret(SIRET, { fetch: f as never })).toEqual({
      ok: false,
      raison: "introuvable",
    });
    const g = vi.fn();
    const faux = `${SIRET.slice(0, 13)}${(Number(SIRET[13]) + 1) % 10}`;
    expect(await lireEtablissementParSiret(faux, { fetch: g as never })).toEqual({
      ok: false,
      raison: "siren_invalide",
    });
    expect(g).not.toHaveBeenCalled();
  });
});

describe("contrat et autofacture : SIRET et adresse de l'établissement, jamais « agent commercial »", () => {
  const dossier = {
    prenom: "Delphine",
    nom: "Exemple",
    statutJuridique: "micro_entrepreneur",
    siren: SIREN,
    siret: SIRET,
    adresse: "8 rue du Domicile 69003 Lyon",
    codeNaf: "46.19B",
    denomination: "DELPHINE EXEMPLE",
  };

  it("première page : « SIREN … — SIRET de l'établissement … » et l'adresse de l'établissement", () => {
    const t = texteDuContrat(valeursDuContrat(dossier, new Date("2026-10-08T10:00:00Z")));
    expect(t).toContain(`${SIREN} — SIRET de l'établissement ${SIRET}`);
    expect(t).toContain("8 rue du Domicile 69003 Lyon");
  });

  it("NAF 46.19B : ni « agent commercial » ni code NAF dans le contrat", () => {
    const t = texteDuContrat(valeursDuContrat(dossier, new Date("2026-10-08T10:00:00Z")));
    expect(t).not.toMatch(/agent[s]? commercia/i);
    expect(t).not.toContain("46.19");
  });

  it("sans SIRET : le contrat est inchangé (le SIREN seul)", () => {
    const sans = texteDuContrat(
      valeursDuContrat({ ...dossier, siret: null }, new Date("2026-10-08T10:00:00Z")),
    );
    expect(sans).not.toContain(`${SIREN} — SIRET`);
    expect(sans).toContain(`immatriculé sous le numéro ${SIREN},`);
  });

  it("autofacture : SIRET de l'établissement, libellé « SIRET », jamais « agent commercial »", () => {
    const r = construireDonneesAutofacture({
      numero: "AXI-APP-2026-0001",
      periodeLibelle: "commissions exigibles",
      dateEmission: new Date("2026-10-08T10:00:00Z"),
      apporteur: {
        nom: "Delphine Exemple",
        denomination: "DELPHINE EXEMPLE",
        siren: SIREN,
        siret: SIRET,
        adresse: "8 rue du Domicile 69003 Lyon",
        regimeTva: "franchise_293b",
        numeroTva: null,
        email: "d@exemple.fr",
      },
      commissions: [
        {
          id: "c1",
          activite: "audit",
          palier: null,
          parrainage: false,
          montantCents: 30_000,
          factureHtCents: 100_000,
          entreprise: "Acme",
          factureNumero: "F-1",
        } as never,
      ],
      organisme: {} as never,
      totalAttenduCents: 30_000,
    });
    expect(r.ok).toBe(true);
    const data = (r as { data: Record<string, unknown> }).data;
    expect(data["sousTraitant"]).toMatchObject({
      siret: SIRET,
      adresseProfessionnelle: "8 rue du Domicile 69003 Lyon",
    });
    expect(data["libelleIdentifiantFournisseur"]).toBe("SIRET");
    expect(JSON.stringify(data)).not.toMatch(/agent[s]? commercia|46\.19/i);
  });
});
