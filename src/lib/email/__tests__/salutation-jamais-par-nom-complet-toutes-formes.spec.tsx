/**
 * Garde étendue (fiche E0-E) : aucun e-mail ne salue par un nom complet, quelle
 * que soit l'écriture. Complète `l-accuse-ne-salue-jamais-par-le-nom-complet`
 * (#2019), qui ne voit que `Bonjour ${…}` dans les `.tsx` des gabarits.
 *
 * Volet A — les SOURCES : toute salutation (Bonjour, Bonsoir, Hello, Hi, Dear,
 *   Cher, Chère) suivie d'une variable autre qu'un prénom ou `salutation(`.
 * Volet B — le RENDU : chaque gabarit du registre, en fr et en en, avec une
 *   charge où les noms valent « Zoé Sentinelle » et les prénoms « Zoé ».
 *
 * Règle du fondateur : « Bonjour Monsieur Dupont, » (civilité + nom de famille)
 * est CORRECT ; sinon le prénom ; sinon « Bonjour, » ; jamais le nom complet.
 *
 * Listes figées À SENS UNIQUE : un nouveau fichier, une hausse du compte ou un
 * nouveau gabarit fautif fait rougir ; une baisse est tolérée (S4 à S11 tournent
 * en parallèle et ne doivent pas se disputer une liste). S12 doit les vider.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";

// Contrat de build (AGENTS.md) : URLs stub, aucune connexion réelle.
vi.hoisted(() => {
  process.env["DATABASE_URL"] ??= "postgresql://stub:stub@stub.invalid:5432/stub";
  process.env["REDIS_URL"] ??= "redis://stub.invalid:6379";
});

import { EMAIL_TEMPLATE_NAMES, renderEmailTemplate } from "@/lib/email/templates";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";

import {
  MOTIF_RENDU_FAUTIF,
  surchargerNoms,
  trouverSalutations,
  trouverSalutationsFautives,
} from "./formes-salutation";

/** Fichier → nombre de salutations fautives, mesuré sur `main` le 17/11/2026. */
const SOURCES_FAUTIVES: Readonly<Record<string, number>> = {
  "src/lib/email/templates/appel-rappel.tsx": 2,
  "src/lib/email/templates/apporteur-attribution-confirmee.tsx": 1,
  "src/lib/email/templates/apporteur-demarrage.tsx": 2,
  "src/lib/email/templates/apporteur-invitation-appel.tsx": 2,
  "src/lib/email/templates/apporteur-invitation-relance.tsx": 8,
  "src/lib/email/templates/apporteur-issue-echange.tsx": 2,
  "src/lib/email/templates/apporteur-lien-espace.tsx": 1,
  "src/lib/email/templates/autofacture-transmission.tsx": 2,
  "src/lib/email/templates/avis-recu.tsx": 2,
  "src/lib/email/templates/cancellation-confirmed-by-user.tsx": 2,
  "src/lib/email/templates/candidature-commercial-confirmee.tsx": 2,
  "src/lib/email/templates/candidature-recue.tsx": 2,
  "src/lib/email/templates/convention-envoi.tsx": 2,
  "src/lib/email/templates/devis-commande-confirmation.tsx": 2,
  "src/lib/email/templates/devis-envoi.tsx": 2,
  "src/lib/email/templates/facture-envoi.tsx": 2,
  "src/lib/email/templates/facture-pieces-remboursement-opco.tsx": 2,
  "src/lib/email/templates/force-majeure-notice.tsx": 2,
  "src/lib/email/templates/formateur-contrat-travail.tsx": 1,
  "src/lib/email/templates/formateur-contresignature.tsx": 1,
  "src/lib/email/templates/formateur-convocation-j7.tsx": 1,
  "src/lib/email/templates/formateur-magic-link.tsx": 1,
  "src/lib/email/templates/formateur-mission-proposee.tsx": 1,
  "src/lib/email/templates/formateur-rappel-j1.tsx": 1,
  "src/lib/email/templates/lead-apporteur-recu.tsx": 2,
  "src/lib/email/templates/lead-apporteur-relance.tsx": 2,
  "src/lib/email/templates/opco-suivi-entreprise.tsx": 1,
  "src/lib/email/templates/payment-failed.tsx": 2,
  "src/lib/email/templates/payment-link.tsx": 2,
  "src/lib/email/templates/payment-receipt.tsx": 2,
  "src/lib/email/templates/podcast-demande-recue.tsx": 2,
  "src/lib/email/templates/qualiopi-adaptation-formateur.tsx": 1,
  "src/lib/email/templates/qualiopi-adaptation-stagiaire.tsx": 1,
  "src/lib/email/templates/qualiopi-attestation-disponible.tsx": 2,
  "src/lib/email/templates/qualiopi-convocation.tsx": 1,
  "src/lib/email/templates/qualiopi-emargement-lien.tsx": 2,
  "src/lib/email/templates/qualiopi-enquete-entreprise.tsx": 1,
  "src/lib/email/templates/qualiopi-liste-stagiaires.tsx": 1,
  "src/lib/email/templates/qualiopi-portail-acces.tsx": 2,
  "src/lib/email/templates/qualiopi-positionnement.tsx": 1,
  "src/lib/email/templates/qualiopi-presence-confirmation.tsx": 1,
  "src/lib/email/templates/qualiopi-presence-entreprise.tsx": 1,
  "src/lib/email/templates/qualiopi-questionnaire-relance.tsx": 1,
  "src/lib/email/templates/qualiopi-rappel-j1.tsx": 1,
  "src/lib/email/templates/qualiopi-rappel-j7.tsx": 1,
  "src/lib/email/templates/qualiopi-relance-impayee.tsx": 3,
  "src/lib/email/templates/qualiopi-satisfaction-j1.tsx": 1,
  "src/lib/email/templates/qualiopi-suivi-j30.tsx": 1,
  "src/lib/email/templates/rappel-confirme.tsx": 2,
  "src/lib/email/templates/recueil-besoin.tsx": 1,
  "src/lib/email/templates/relance-devis-client.tsx": 1,
  "src/lib/email/templates/ressources-magic-link.tsx": 1,
  "src/lib/email/templates/roi-report.tsx": 2,
};

/** Gabarits (nom@locale) dont le RENDU salue par le nom complet. */
const RENDUS_FAUTIFS: ReadonlySet<string> = new Set<string>([
  "roi-report@fr",
  "roi-report@en",
  "podcast-demande-recue@fr",
  "podcast-demande-recue@en",
  "candidature-recue@fr",
  "candidature-recue@en",
  "avis-recu@fr",
  "avis-recu@en",
  "payment-link@fr",
  "payment-link@en",
  "payment-receipt@fr",
  "payment-receipt@en",
  "payment-failed@fr",
  "payment-failed@en",
  "force-majeure-notice@fr",
  "force-majeure-notice@en",
  "cancellation-confirmed-by-user@fr",
  "cancellation-confirmed-by-user@en",
  "qualiopi-enquete-entreprise@fr",
  "qualiopi-enquete-entreprise@en",
  "qualiopi-liste-stagiaires@fr",
  "qualiopi-liste-stagiaires@en",
  "qualiopi-presence-entreprise@fr",
  "qualiopi-presence-entreprise@en",
  "formateur-magic-link@fr",
  "formateur-magic-link@en",
  "ressources-magic-link@fr",
  "ressources-magic-link@en",
  "devis-envoi@fr",
  "devis-envoi@en",
  "devis-commande-confirmation@fr",
  "devis-commande-confirmation@en",
  "relance-devis-client@fr",
  "relance-devis-client@en",
  "convention-envoi@fr",
  "convention-envoi@en",
  "facture-envoi@fr",
  "facture-envoi@en",
  "facture-pieces-remboursement-opco@fr",
  "facture-pieces-remboursement-opco@en",
  "autofacture-transmission@fr",
  "autofacture-transmission@en",
  "recueil-besoin@fr",
  "recueil-besoin@en",
  "opco-suivi-entreprise@fr",
  "opco-suivi-entreprise@en",
  // Ajoutés à la correction : le champ `*PrenomNom` porte le NOM COMPLET ; la charge
  // d'essai le traitait à tort en prénom, ce qui masquait ces gabarits.
  "qualiopi-convocation@fr",
  "qualiopi-convocation@en",
  "qualiopi-rappel-j7@fr",
  "qualiopi-rappel-j7@en",
  "qualiopi-rappel-j1@fr",
  "qualiopi-rappel-j1@en",
  "qualiopi-satisfaction-j1@fr",
  "qualiopi-satisfaction-j1@en",
  "qualiopi-suivi-j30@fr",
  "qualiopi-suivi-j30@en",
  "qualiopi-positionnement@fr",
  "qualiopi-positionnement@en",
  "qualiopi-questionnaire-relance@fr",
  "qualiopi-questionnaire-relance@en",
  "qualiopi-adaptation-stagiaire@fr",
  "qualiopi-adaptation-stagiaire@en",
  "qualiopi-adaptation-formateur@fr",
  "qualiopi-adaptation-formateur@en",
  "qualiopi-attestation-disponible@fr",
  "qualiopi-attestation-disponible@en",
  "qualiopi-portail-acces@fr",
  "qualiopi-portail-acces@en",
  "qualiopi-emargement-lien@fr",
  "qualiopi-emargement-lien@en",
  "qualiopi-presence-confirmation@fr",
  "qualiopi-presence-confirmation@en",
  "formateur-mission-proposee@fr",
  "formateur-mission-proposee@en",
  "formateur-convocation-j7@fr",
  "formateur-convocation-j7@en",
  "formateur-rappel-j1@fr",
  "formateur-rappel-j1@en",
  "formateur-contresignature@fr",
  "formateur-contresignature@en",
  "formateur-contrat-travail@fr",
  "formateur-contrat-travail@en",
]);

/** Gabarits qui lèvent une erreur avec la charge sentinelle (nom@locale). */
const RENDUS_IMPOSSIBLES: ReadonlySet<string> = new Set<string>([]);

describe("détection (test du test)", () => {
  const fautive = (s: string) => trouverSalutationsFautives(s).length;

  it.each([
    ["gabarit de chaîne", "const t = `Bonjour ${p.nom},`;"],
    ["JSX", "<p>Bonjour {p.stagiairePrenomNom} — voici</p>"],
    ["JSX conditionnel", 'Bonjour{p.x ? ` ${p.destinataireNom}` : ""}, la formation'],
    ["concaténation", 'const i = "Bonjour " + p.contactName + ",";'],
    ["marque simple", '"Hello {name},"'],
    ["marque double", "Cher {{nom}},"],
    ["Chère (accent)", "Chère ${nomComplet}"],
    ["prénom + nom en deux variables (gabarit)", "`Bonjour ${p.prenom} ${p.nom},`"],
    ["prénom + nom en deux variables (JSX)", "<p>Bonjour {p.prenom} {p.nom},</p>"],
    ["prénom + nom séparés par &nbsp;", "<p>Bonjour {p.prenom}&nbsp;{p.nom},</p>"],
    ['prénom + nom séparés par {" "}', '<p>Bonjour {p.prenom}{" "}{p.nom},</p>'],
    ["prénom + nom sur deux lignes", "<p>Bonjour {p.prenom}\n  {p.nom},</p>"],
    ["civilité + nom de famille écrits à la main", "`Bonjour ${civ} ${p.nomFamille}`"],
  ])("détecte la forme %s", (_forme, source) => {
    expect(fautive(source)).toBe(1);
  });

  it.each([
    ["prénom en gabarit", "`Bonjour ${prenom},`"],
    ["prénom en JSX", "Bonjour {p.prenom},"],
    ["prénom conditionnel", 'Bonjour{p.x ? ` ${p.firstName}` : ""},'],
    ["suffixe Prenom", "`Hello ${p.contactPrenom}`"],
    ["concaténation de prénom", '"Bonjour " + texteOuNull(p.prenom) + ","'],
    ["marque prénom", '"Bonjour {prenom},"'],
    ["appel salutation()", "`${salutation(p, locale)}`"],
    ["deux prénoms", "`Bonjour ${p.prenom} ${p.autrePrenom},`"],
    ["prénom puis texte", "<p>Bonjour {p.prenom}, {p.nom} est inscrit</p>"],
    ["texte sans variable", "Bonjour, nous revenons vers vous. Hier, Chercher {x}"],
  ])("ne détecte pas : %s", (_cas, source) => {
    expect(fautive(source)).toBe(0);
  });

  it.each([
    ["saut de ligne, variable fautive", "<p>\n  Bonjour\n  {p.nom},\n</p>"],
    ['{" "} puis variable fautive', '<p>Bonjour{" "}{p.nom},</p>'],
    ['{" "} + saut de ligne, fautive', '<p>Bonjour{" "}\n  {p.stagiairePrenomNom},</p>'],
  ])("franchit les blancs : %s", (_cas, source) => {
    expect(fautive(source)).toBe(1);
  });

  it.each([
    ["saut de ligne, prénom", "<p>\n  Bonjour\n  {p.prenom},\n</p>"],
    ['{" "} puis prénom', '<p>Bonjour{" "}{p.prenom},</p>'],
    ['{" "} sans variable', '<p>Bonjour{" "}</p>'],
  ])("ne compte pas à tort : %s", (_cas, source) => {
    expect(fautive(source)).toBe(0);
  });

  it("`Bonjour ${prenom}` est vu mais toléré ; `PrenomNom` n'est pas toléré", () => {
    expect(trouverSalutations("`Bonjour ${prenom}`")[0]?.toleree).toBe(true);
    expect(fautive("Bonjour {p.stagiairePrenomNom}")).toBe(1);
  });
});

function sourcesDuDepot(): string[] {
  const racine = process.cwd();
  const fichiers: string[] = [];
  const marcher = (dossier: string) => {
    for (const entree of readdirSync(dossier)) {
      const chemin = join(dossier, entree);
      if (statSync(chemin).isDirectory()) {
        if (entree !== "__tests__" && entree !== "node_modules") marcher(chemin);
      } else if (/\.tsx?$/.test(entree) && !/\.(spec|test)\./.test(entree)) {
        fichiers.push(chemin);
      }
    }
  };
  for (const d of [
    "src/lib/email",
    "src/server",
    "src/features",
    "src/content",
    "src/components/admin",
  ]) {
    marcher(join(racine, d));
  }
  return fichiers.map((f) => relative(racine, f).split("\\").join("/"));
}

describe("volet A — sources", () => {
  const mesure = new Map<string, number>();
  for (const f of sourcesDuDepot()) {
    const n = trouverSalutationsFautives(readFileSync(join(process.cwd(), f), "utf8")).length;
    if (n > 0) mesure.set(f, n);
  }

  it("aucun fichier hors liste ne salue par une variable autre qu'un prénom", () => {
    const nouveaux = [...mesure.keys()].filter((f) => !(f in SOURCES_FAUTIVES));
    expect(nouveaux).toEqual([]);
  });

  it("aucun fichier de la liste n'en compte davantage (liste à sens unique)", () => {
    const hausses = [...mesure].filter(
      ([f, n]) => f in SOURCES_FAUTIVES && n > SOURCES_FAUTIVES[f]!,
    );
    expect(hausses).toEqual([]);
  });

  it("témoin : la mesure voit la liste figée, à au plus deux écarts près", () => {
    // Égalité attendue. Tolérance de DEUX fichiers au plus : les lots S4 à S11
    // corrigent des gabarits en parallèle et peuvent vider une entrée avant que
    // cette liste ne soit mise à jour (la liste est à sens unique, S12 la vide).
    const disparus = Object.keys(SOURCES_FAUTIVES).filter((f) => !mesure.has(f));
    expect(disparus.length).toBeLessThanOrEqual(2);
  });
});

describe("volet B — rendu", () => {
  it("aucun gabarit ne salue « Zoé Sentinelle » (fr et en), hors liste figée", async () => {
    const charge = surchargerNoms(PAYLOAD_EXEMPLE);
    const fautifs: string[] = [];
    const impossibles: string[] = [];
    let rendus = 0;
    for (const nom of EMAIL_TEMPLATE_NAMES) {
      for (const locale of ["fr", "en"] as const) {
        const cle = `${nom}@${locale}`;
        try {
          const r = await renderEmailTemplate(nom, locale, charge, {
            destinataire: "zoe.sentinelle@example.invalid",
          });
          rendus += 1;
          if (MOTIF_RENDU_FAUTIF.test(r.html) || MOTIF_RENDU_FAUTIF.test(r.text)) fautifs.push(cle);
        } catch {
          impossibles.push(cle);
        }
      }
    }
    expect(rendus).toBeGreaterThan(EMAIL_TEMPLATE_NAMES.length); // témoin : on rend vraiment
    expect(fautifs.filter((c) => !RENDUS_FAUTIFS.has(c))).toEqual([]);
    expect(impossibles.filter((c) => !RENDUS_IMPOSSIBLES.has(c))).toEqual([]);
  }, 120_000);

  it("le motif de rendu fait rougir le nom complet, avec ou sans civilité", () => {
    expect(MOTIF_RENDU_FAUTIF.test("<p>Bonjour Zoé Sentinelle,</p>")).toBe(true);
    expect(MOTIF_RENDU_FAUTIF.test("<p>Bonjour Monsieur Zoé Sentinelle,</p>")).toBe(true);
    expect(MOTIF_RENDU_FAUTIF.test("<p>Bonjour Zoé,</p>")).toBe(false);
  });

  it("le motif de rendu voit &nbsp; et l'ordre inversé", () => {
    expect(MOTIF_RENDU_FAUTIF.test("<p>Bonjour Zoé&nbsp;Sentinelle,</p>")).toBe(true);
    expect(MOTIF_RENDU_FAUTIF.test("<p>Bonjour Zoé&#160;Sentinelle,</p>")).toBe(true);
    expect(MOTIF_RENDU_FAUTIF.test("<p>Bonjour Sentinelle Zoé,</p>")).toBe(true);
    expect(MOTIF_RENDU_FAUTIF.test("<p>Bonjour Monsieur Sentinelle&nbsp;Zoé,</p>")).toBe(true);
    expect(MOTIF_RENDU_FAUTIF.test("<p>Bonjour Monsieur Sentinelle, Zoé</p>")).toBe(false);
  });

  it("les formes décidées par le fondateur ne rougissent pas", () => {
    expect(MOTIF_RENDU_FAUTIF.test("<p>Bonjour Monsieur Sentinelle,</p>")).toBe(false);
    expect(MOTIF_RENDU_FAUTIF.test("<p>Hello Mr Sentinelle,</p>")).toBe(false);
  });

  it("la charge d'essai : nom de famille seul → « Sentinelle », noms complets → « Zoé Sentinelle »", () => {
    const c = surchargerNoms({
      nomFamille: "x",
      prenom: "x",
      nom: "x",
      name: "x",
      nomComplet: "x",
      stagiairePrenomNom: "x",
      contactNom: "x",
    });
    expect(c["nomFamille"]).toBe("Sentinelle");
    expect(c["prenom"]).toBe("Zoé");
    for (const k of ["nom", "name", "nomComplet", "stagiairePrenomNom", "contactNom"]) {
      expect(c[k]).toBe("Zoé Sentinelle");
    }
  });
});
