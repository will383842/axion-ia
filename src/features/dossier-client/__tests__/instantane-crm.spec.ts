/**
 * Garde de la photo du dossier envoyée au CRM (synchro console → CRM,
 * 25/10/2026). Données FICTIVES. Le CRM a le test symétrique
 * (`DossierClientSynchroTest`, axion-crm-pro).
 */
import { describe, expect, it } from "vitest";

import {
  CLES_CONTACT_CRM,
  CLES_DOSSIER_CRM,
  CLES_ENTREPRISE_CRM,
  CLES_QUESTIONNAIRE_CRM,
  dossierPourCrm,
  empreinteDossier,
  entreprisePourCrm,
  evenementDossierClient,
  eventIdDossierClient,
  separerNom,
  trancheEffectif,
  type EntreeInstantaneCrm,
} from "@/features/dossier-client/instantane-crm";

const CLIENT = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const HASH = "a".repeat(64);

/** Clés refusées par le CRM à toute profondeur (`DossierClient::CLES_INTERDITES`). */
const CLES_INTERDITES_CRM = [
  "reponse",
  "reponses",
  "reponses_equipe",
  "reponses_dirigeant",
  "texte",
  "texte_libre",
  "commentaire",
  "commentaires",
  "notes",
  "donnees",
  "montant",
  "montant_ht",
  "montant_ttc",
  "prix",
  "tarif",
  "total",
  "ca",
  "chiffre_affaires",
  "numero_facture",
  "facture_numero",
  "numero_devis",
  "devis",
  "outils",
];

function entree(surcharge: Partial<EntreeInstantaneCrm> = {}): EntreeInstantaneCrm {
  return {
    clientId: CLIENT,
    numero: "AXI-CLI-004",
    raisonSociale: "Pharmacie Fictive",
    siren: "123456789",
    adresseRue: "1 rue des Tests",
    adresseCodePostal: "75001",
    adresseVille: "Paris",
    telephone: "0102030405",
    effectif: 12,
    factureEmise: false,
    urlConsole: "https://axion-ia.com/console/clients/x",
    questionnaire: {
      envoyeLe: new Date("2026-10-20T08:00:00Z"),
      recuLe: new Date("2026-10-22T08:00:00Z"),
      nbReponsesEquipe: 3,
    },
    contacts: [
      {
        id: "c1",
        nom: "Marie Dupont",
        fonction: "Titulaire",
        telephone: "0600000000",
        email: "Marie@Exemple.fr",
        emailHash: HASH,
        parti: false,
      },
    ],
    ...surcharge,
  };
}

function cles(valeur: unknown, sortie: string[] = []): string[] {
  if (Array.isArray(valeur)) valeur.forEach((v) => cles(v, sortie));
  else if (typeof valeur === "object" && valeur !== null) {
    for (const [k, v] of Object.entries(valeur)) {
      sortie.push(k.toLowerCase());
      cles(v, sortie);
    }
  }
  return sortie;
}

describe("photo du dossier pour le CRM", () => {
  it("ne porte que les clés de la liste blanche, du plus haut au plus bas", () => {
    const e = evenementDossierClient(entree({ factureEmise: true }), 1, new Date());
    const dossier = (e.payload as { dossier: Record<string, unknown> }).dossier;
    expect(Object.keys(e.payload!)).toEqual(["dossier"]);
    for (const k of Object.keys(dossier)) expect(CLES_DOSSIER_CRM).toContain(k);
    for (const k of Object.keys(dossier["questionnaire"] as object)) {
      expect(CLES_QUESTIONNAIRE_CRM).toContain(k);
    }
    for (const c of dossier["contacts"] as object[]) {
      for (const k of Object.keys(c)) expect(CLES_CONTACT_CRM).toContain(k);
    }
    for (const k of Object.keys(e.company!)) expect(CLES_ENTREPRISE_CRM).toContain(k);
    // Pas de personne, de consentement, de candidat, de tag, de type de formulaire.
    for (const absent of ["person", "consent", "candidate", "tags", "form_type", "source_slug"]) {
      expect(Object.keys(e)).not.toContain(absent);
    }
  });

  it("n'emporte jamais de réponse, de texte libre, de montant ni d'outil", () => {
    // Une entrée hostile : des champs en trop, que le module ne doit pas recopier.
    const hostile = {
      ...entree({ factureEmise: true }),
      reponses: [{ texte: "secret du salarié" }],
      donnees: "chiffré",
      notes: "note interne",
      contexteIa: "contexte",
      outils: ["ERP"],
      caCents: 987654,
      montant: 99,
    } as unknown as EntreeInstantaneCrm;
    const e = evenementDossierClient(hostile, 2, new Date());
    const toutes = cles(e);
    for (const interdite of CLES_INTERDITES_CRM) expect(toutes).not.toContain(interdite);
    const texte = JSON.stringify(e);
    expect(texte).not.toContain("secret du salarié");
    expect(texte).not.toContain("note interne");
    expect(texte).not.toContain("987654");
  });

  it("statut client SI ET SEULEMENT SI une facture est émise", () => {
    expect(dossierPourCrm(entree({ factureEmise: false }))).toMatchObject({
      statut: "prospect",
      facture_emise: false,
    });
    expect(dossierPourCrm(entree({ factureEmise: true }))).toMatchObject({
      statut: "client",
      facture_emise: true,
    });
  });

  it("omet les valeurs vides au lieu de les envoyer à null (rien ne se supprime)", () => {
    const d = dossierPourCrm(
      entree({
        adresseRue: null,
        telephone: "  ",
        effectif: null,
        urlConsole: null,
        questionnaire: { envoyeLe: null, recuLe: null, nbReponsesEquipe: null },
        contacts: [],
      }),
    );
    expect(Object.keys(d).sort()).toEqual(["axi_cli", "facture_emise", "statut"]);
    expect(JSON.stringify(d)).not.toContain("null");
  });

  it("n'envoie ni contact parti, ni contact sans nom, ni doublon", () => {
    const base = entree().contacts[0]!;
    const d = dossierPourCrm(
      entree({
        contacts: [
          { ...base, id: "parti", parti: true },
          { ...base, id: "vide", nom: "   " },
          base,
          base,
        ],
      }),
    );
    expect(d.contacts?.map((c) => c.ref)).toEqual(["c1"]);
  });

  it("plafonne à 50 contacts (le CRM refuse au-delà)", () => {
    const base = entree().contacts[0]!;
    const beaucoup = Array.from({ length: 60 }, (_, i) => ({ ...base, id: `c${i}` }));
    expect(dossierPourCrm(entree({ contacts: beaucoup })).contacts).toHaveLength(50);
  });

  it("met l'e-mail en minuscules, écarte une clé de personne mal formée", () => {
    const base = entree().contacts[0]!;
    const d = dossierPourCrm(entree({ contacts: [{ ...base, emailHash: "xyz" }] }));
    expect(d.contacts![0]!.email).toBe("marie@exemple.fr");
    expect(d.contacts![0]).not.toHaveProperty("person_key");
  });

  it("sans SIREN valide, la société part sans SIREN (le CRM arbitre)", () => {
    expect(entreprisePourCrm(entree({ siren: null }))).not.toHaveProperty("siren");
    expect(entreprisePourCrm(entree({ siren: "12345" }))).not.toHaveProperty("siren");
    expect(entreprisePourCrm(entree())).toMatchObject({ siren: "123456789", city: "Paris" });
  });

  it("refuse une URL de console qui n'est pas en https", () => {
    expect(dossierPourCrm(entree({ urlConsole: "http://x.fr" }))).not.toHaveProperty("url_console");
  });

  it("tranche d'effectif : inconnu reste inconnu", () => {
    expect(trancheEffectif(null)).toBeNull();
    expect(trancheEffectif(-1)).toBeNull();
    expect(trancheEffectif(0)).toBe("0-9");
    expect(trancheEffectif(12)).toBe("10-19");
    expect(trancheEffectif(49)).toBe("20-49");
    expect(trancheEffectif(1000)).toBe("500+");
  });

  it("sépare « Prénom Nom » ; un mot seul est un nom", () => {
    expect(separerNom("Marie Dupont")).toEqual({ prenom: "Marie", nom: "Dupont" });
    expect(separerNom("Jean de la Fontaine")).toEqual({ prenom: "Jean", nom: "de la Fontaine" });
    expect(separerNom("Dupont")).toEqual({ nom: "Dupont" });
    expect(separerNom("  ")).toEqual({});
  });

  it("event_id déterministe par (client, version) ; empreinte stable, sensible au contenu", () => {
    expect(eventIdDossierClient(CLIENT, 1)).toBe(eventIdDossierClient(CLIENT, 1));
    expect(eventIdDossierClient(CLIENT, 1)).not.toBe(eventIdDossierClient(CLIENT, 2));
    const a = entree();
    const emp = (e: EntreeInstantaneCrm) =>
      empreinteDossier(entreprisePourCrm(e), dossierPourCrm(e));
    expect(emp(a)).toBe(emp(entree()));
    expect(emp(a)).not.toBe(emp(entree({ adresseVille: "Lyon" })));
    expect(emp(a)).not.toBe(emp(entree({ factureEmise: true })));
  });

  it("refuse une version qui n'est pas un entier ≥ 1", () => {
    expect(() => evenementDossierClient(entree(), 0, new Date())).toThrow();
    expect(() => evenementDossierClient(entree(), 1.5, new Date())).toThrow();
  });
});
