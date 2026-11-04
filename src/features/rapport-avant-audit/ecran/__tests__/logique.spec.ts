import { describe, expect, it } from "vitest";

import {
  cibleDuChamp,
  clientIdDeLaFiche,
  decisionTelechargement,
  etatBoutonLancer,
  listerPropositions,
  planifierCompletion,
  pourcentage,
  rappelReponses,
  RAISON_EN_COURS,
  RAISON_INTERRUPTEUR,
  RAISON_NON_BRANCHE,
  RAISON_SANS_REPONSE,
  RESERVE_SUPER_ADMIN,
  valeurPourLeChamp,
} from "../logique";
import { motsInterditsDans } from "../../mots-interdits";
import * as logique from "../logique";
import { ficheVide, proposition, resume } from "./fixtures";

const d = (iso: string) => new Date(iso);

describe("rappel des réponses", () => {
  it("sans réponse : rien à faire", () => {
    const r = rappelReponses([], []);
    expect(r.genre).toBe("sans_reponse");
    expect(r.ton).toBe("neutre");
  });

  it("réponses reçues, aucun rapport : « rapport pas lancé »", () => {
    const r = rappelReponses([d("2026-11-01T09:00:00Z"), d("2026-11-01T09:30:00Z")], []);
    expect(r.genre).toBe("pas_lance");
    expect(r.ton).toBe("attention");
    expect(r.texte).toContain("Réponses reçues (2)");
    expect(r.texte).toContain("pas encore été lancé");
  });

  it("une réponse arrivée après le dernier rapport : « relancer »", () => {
    const r = rappelReponses(
      [d("2026-11-01T09:00:00Z"), d("2026-11-02T08:00:00Z")],
      [resume({ lanceLe: d("2026-11-01T10:00:00Z") })],
    );
    expect(r.genre).toBe("nouvelles");
    expect(r.texte).toContain("1 réponse");
    expect(r.texte).toContain("relancez");
  });

  it("`reponsesJusquau` prime sur la date de lancement", () => {
    const r = rappelReponses(
      [d("2026-11-01T11:00:00Z")],
      [resume({ lanceLe: d("2026-11-01T10:00:00Z"), reponsesJusquau: d("2026-11-01T12:00:00Z") })],
    );
    expect(r.genre).toBe("a_jour");
  });

  it("rapport à jour : neutre", () => {
    const r = rappelReponses([d("2026-11-01T09:00:00Z")], [resume()]);
    expect(r.genre).toBe("a_jour");
    expect(r.ton).toBe("neutre");
  });

  it("une analyse en cours l'emporte", () => {
    const r = rappelReponses(
      [d("2026-11-02T09:00:00Z")],
      [resume({ id: "r2", version: 2, statut: "en_cours" }), resume()],
    );
    expect(r.genre).toBe("en_cours");
  });

  it("seulement des échecs : relancer, sans parler de « nouvelles réponses »", () => {
    const r = rappelReponses([d("2026-11-01T09:00:00Z")], [resume({ statut: "echoue" })]);
    expect(r.genre).toBe("echec");
  });

  it("un échec récent ne masque pas le dernier rapport réussi", () => {
    const r = rappelReponses(
      [d("2026-11-01T09:00:00Z")],
      [resume({ id: "r2", version: 2, statut: "echoue" }), resume()],
    );
    expect(r.genre).toBe("a_jour");
  });
});

describe("bouton « Lancer l'analyse complète » — garde super-administrateur", () => {
  const ok = {
    role: "super_admin",
    interrupteurAllume: true,
    branche: true,
    nbReponses: 3,
    rapports: [],
  };

  it("actif pour le super-administrateur, interrupteur allumé, avec réponses", () => {
    expect(etatBoutonLancer(ok)).toEqual({
      actif: true,
      libelle: "Lancer l'analyse complète",
      raison: null,
    });
  });

  it.each(["admin", "editor", "responsable_qualite", "secretaire", "", null, undefined])(
    "éteint pour le rôle %s",
    (role) => {
      const e = etatBoutonLancer({ ...ok, role });
      expect(e.actif).toBe(false);
      expect(e.raison).toBe(RESERVE_SUPER_ADMIN);
    },
  );

  it("éteint, avec l'explication, quand l'interrupteur est éteint", () => {
    expect(etatBoutonLancer({ ...ok, interrupteurAllume: false }).raison).toBe(RAISON_INTERRUPTEUR);
  });

  it("éteint tant que le vrai code n'est pas raccordé", () => {
    expect(etatBoutonLancer({ ...ok, branche: false }).raison).toBe(RAISON_NON_BRANCHE);
  });

  it("éteint sans réponse", () => {
    expect(etatBoutonLancer({ ...ok, nbReponses: 0 }).raison).toBe(RAISON_SANS_REPONSE);
  });

  it("éteint pendant une analyse en cours", () => {
    const e = etatBoutonLancer({ ...ok, rapports: [resume({ statut: "en_attente" })] });
    expect(e.raison).toBe(RAISON_EN_COURS);
  });

  it("« Relancer » quand un rapport existe déjà", () => {
    expect(etatBoutonLancer({ ...ok, rapports: [resume()] }).libelle).toBe(
      "Relancer l'analyse complète",
    );
  });
});

describe("progression", () => {
  it("progression bornée à 0-99 tant que ça tourne, 100 une fois terminé", () => {
    expect(pourcentage(resume({ statut: "en_cours", progression: 50 }))).toBe(50);
    expect(pourcentage(resume({ statut: "en_cours", progression: 100 }))).toBe(99);
    expect(pourcentage(resume({ statut: "en_attente", progression: -3 }))).toBe(0);
    expect(pourcentage(resume({ statut: "en_cours", progression: Number.NaN }))).toBe(0);
    expect(pourcentage(resume({ statut: "termine", progression: 40 }))).toBe(100);
  });
});

describe("téléchargements — super-administrateur seul, documents V2 selon la version", () => {
  it("refuse tout autre rôle (403)", () => {
    for (const role of ["admin", "editor", null]) {
      expect(
        decisionTelechargement({ role, format: "base-json", rapport: resume() }),
      ).toMatchObject({
        ok: false,
        statut: 403,
      });
    }
  });

  it("format inconnu : 400 ; rapport absent : 404 ; pas fini : 409", () => {
    const role = "super_admin";
    expect(decisionTelechargement({ role, format: "zip", rapport: resume() })).toMatchObject({
      statut: 400,
    });
    expect(decisionTelechargement({ role, format: "synthese-html", rapport: null })).toMatchObject({
      statut: 404,
    });
    expect(
      decisionTelechargement({
        role,
        format: "synthese-html",
        rapport: resume({ statut: "en_cours" }),
      }),
    ).toMatchObject({ statut: 409 });
  });

  it("automatisations et schéma : 409 tant que la base n'est pas en version 2", () => {
    const role = "super_admin";
    for (const format of ["automatisations-html", "schema-html"]) {
      const refus = decisionTelechargement({
        role,
        format,
        rapport: resume({ versionSchema: "base-audit/1" }),
      });
      expect(refus).toMatchObject({ ok: false, statut: 409 });
      expect(refus.ok ? "" : refus.texte).toBe(
        "Ce document n'existe que pour une analyse lancée après la mise à jour : relancez l'analyse",
      );
      expect(
        decisionTelechargement({ role, format, rapport: resume({ versionSchema: null }) }),
      ).toMatchObject({ statut: 409 });
      expect(decisionTelechargement({ role, format, rapport: resume() })).toEqual({ ok: true });
    }
  });

  it("synthèse et JSON : disponibles aussi pour une base V1", () => {
    for (const format of ["synthese-html", "base-json"]) {
      expect(
        decisionTelechargement({
          role: "super_admin",
          format,
          rapport: resume({ versionSchema: "base-audit/1" }),
        }),
      ).toEqual({ ok: true });
    }
  });

  it("les anciens formats (pdf-client, base-md, fiches-md) sont refusés (400)", () => {
    for (const format of ["pdf-client", "base-md", "fiches-md"]) {
      expect(
        decisionTelechargement({ role: "super_admin", format, rapport: resume() }),
      ).toMatchObject({ ok: false, statut: 400 });
    }
  });

  it("un rapport échoué n'a rien à télécharger (409)", () => {
    for (const format of ["base-json", "synthese-html", "schema-html"]) {
      expect(
        decisionTelechargement({
          role: "super_admin",
          format,
          rapport: resume({ statut: "echoue" }),
        }),
      ).toMatchObject({ ok: false, statut: 409 });
    }
  });
});

describe("liste « Compléter la fiche »", () => {
  it("reconnaît les libellés libres de l'analyse", () => {
    expect(cibleDuChamp("Secteur d'activité")).toBe("secteur");
    expect(cibleDuChamp("Code NAF/APE")).toBe("nafCode");
    expect(cibleDuChamp("code postal")).toBe("adresseCodePostal");
    expect(cibleDuChamp("TVA intracommunautaire")).toBe("tvaIntracom");
    expect(cibleDuChamp("SIREN")).toBe("siren");
    expect(cibleDuChamp("SIRET")).toBe("siret");
    expect(cibleDuChamp("E-mail")).toBe("email");
    expect(cibleDuChamp("Couleur préférée")).toBeNull();
  });

  it("normalise ou refuse les valeurs selon le champ", () => {
    expect(valeurPourLeChamp("siren", "123 456 789")).toBe("123456789");
    expect(valeurPourLeChamp("siren", "12345678")).toBeNull();
    expect(valeurPourLeChamp("adresseCodePostal", "3800")).toBeNull();
    expect(valeurPourLeChamp("adresseCodePostal", "75 011")).toBe("75011");
    expect(valeurPourLeChamp("nafCode", "14.13z")).toBe("14.13Z");
    expect(valeurPourLeChamp("tvaIntracom", "fr12 345678901")).toBe("FR12345678901");
    expect(valeurPourLeChamp("tvaIntracom", "FR123")).toBeNull();
    expect(valeurPourLeChamp("secteur", "  ")).toBeNull();
  });

  it("donne champ, valeur, source et confiance de chaque ligne", () => {
    const [l] = listerPropositions(
      [
        proposition({
          sources: [
            { type: "registre", reference: "Annuaire des entreprises" },
            { type: "web", reference: "Site de l'entreprise", url: "https://exemple.fr" },
          ],
          confiance: "probable",
        }),
      ],
      ficheVide(),
    );
    expect(l).toMatchObject({
      cle: "p0",
      champ: "Secteur d'activité",
      champFiche: "secteur",
      valeur: "Confection textile",
      source: "Annuaire des entreprises · Site de l'entreprise",
      confiance: "Probable",
      etat: "a_cocher",
    });
  });

  it("un champ déjà rempli n'est pas cochable", () => {
    const [l] = listerPropositions([proposition()], ficheVide({ secteur: "Habillement" }));
    expect(l?.etat).toBe("deja_rempli");
    expect(l?.valeurActuelle).toBe("Habillement");
  });

  it("le SIREN a son propre bouton ; SIRET, e-mail et inconnus sont à recopier", () => {
    const lignes = listerPropositions(
      [
        proposition({ champ: "SIREN", valeur: "123456789" }),
        proposition({ champ: "SIRET", valeur: "12345678900012" }),
        proposition({ champ: "E-mail", valeur: "a@b.fr" }),
        proposition({ champ: "Nombre de machines", valeur: "12" }),
      ],
      ficheVide(),
    );
    expect(lignes.map((l) => l.etat)).toEqual(["siren", "a_recopier", "a_recopier", "a_recopier"]);
  });

  it("un SIREN déjà posé n'est pas reproposé", () => {
    const [l] = listerPropositions(
      [proposition({ champ: "SIREN", valeur: "123456789" })],
      ficheVide({ siren: "987654321" }),
    );
    expect(l?.etat).toBe("deja_rempli");
  });
});

describe("refus d'écrasement — `planifierCompletion`", () => {
  const props = [
    proposition(),
    proposition({ champ: "Ville", valeur: "Lyon" }),
    proposition({ champ: "SIREN", valeur: "123456789" }),
    proposition({ champ: "Code postal", valeur: "69001" }),
    proposition({ champ: "Secteur", valeur: "Autre secteur" }),
  ];

  it("n'écrit que les lignes cochées, sur des champs vides", () => {
    const plan = planifierCompletion(props, ficheVide(), ["p0", "p3"]);
    expect(plan.aEcrire).toEqual({ secteur: "Confection textile", adresseCodePostal: "69001" });
    expect(plan.refuses).toEqual([]);
  });

  it("⛔ jamais d'écrasement : un champ rempli entre l'affichage et le clic est refusé", () => {
    const plan = planifierCompletion(props, ficheVide({ adresseVille: "Paris" }), ["p0", "p1"]);
    expect(plan.aEcrire).toEqual({ secteur: "Confection textile" });
    expect(plan.aEcrire).not.toHaveProperty("adresseVille");
    expect(plan.refuses).toHaveLength(1);
    expect(plan.refuses[0]?.cle).toBe("p1");
  });

  it("⛔ le SIREN n'est jamais écrit par la liste, même coché à la main", () => {
    const plan = planifierCompletion(props, ficheVide(), ["p2"]);
    expect(plan.aEcrire).toEqual({});
    expect(plan.aEcrire).not.toHaveProperty("siren");
    expect(plan.refuses[0]?.cle).toBe("p2");
  });

  it("deux valeurs pour le même champ : la première seulement", () => {
    const plan = planifierCompletion(props, ficheVide(), ["p0", "p4"]);
    expect(plan.aEcrire).toEqual({ secteur: "Confection textile" });
    expect(plan.refuses.map((r) => r.cle)).toEqual(["p4"]);
  });

  it("clé inconnue ou rien coché : rien n'est écrit", () => {
    expect(planifierCompletion(props, ficheVide(), ["p99"]).aEcrire).toEqual({});
    expect(planifierCompletion(props, ficheVide(), []).ecrits).toEqual([]);
  });

  it("rien n'est écrit sur une fiche entièrement remplie", () => {
    const pleine = ficheVide({
      secteur: "x",
      adresseVille: "x",
      adresseCodePostal: "x",
      siren: "x",
    });
    expect(planifierCompletion(props, pleine, ["p0", "p1", "p2", "p3", "p4"]).aEcrire).toEqual({});
  });
});

describe("fiche hôte", () => {
  it("tire l'identifiant d'une vraie adresse de fiche, rien sinon", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(clientIdDeLaFiche(`/fr/console/qualiopi/clients/${id}`)).toBe(id);
    expect(clientIdDeLaFiche(`/fr/console/qualiopi/clients/${id.toUpperCase()}`)).toBe(id);
    expect(clientIdDeLaFiche("/fr/console/qualiopi/clients/c1")).toBeNull();
    expect(clientIdDeLaFiche(`/fr/console/qualiopi/clients/${id}/edit`)).toBeNull();
    expect(clientIdDeLaFiche("/f")).toBeNull();
  });
});

describe("textes de l'écran", () => {
  it("aucun mot interdit dans les textes fixes", () => {
    const textes: string[] = Object.values(logique as Record<string, unknown>).filter(
      (v): v is string => typeof v === "string",
    );
    expect(textes.length).toBeGreaterThan(3);
    for (const t of textes) expect(motsInterditsDans(t)).toEqual([]);
  });
});
