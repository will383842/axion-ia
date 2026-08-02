/**
 * Identité de l'acheteur sur une facture — règles + garde-fou structurel.
 *
 * ── Ce qui s'est passé en production (2026-08-01) ───────────────────────────
 * La PREMIÈRE facture réelle (`AXI-FACT-2026-001`, INVEST SUN, 660 € TTC) est
 * sortie au nom de « IA pour l'immobilier — INVEST SUN (Saint-Étienne) » : le
 * TITRE DE LA SESSION. Sans SIRET, sans adresse.
 *
 * `genererFactureFormationAction` écrivait `destinataireNom:
 * trainingSession.titreSession` — tout en chargeant déjà
 * `client: { select: { raisonSociale: true } }`, qu'elle ne lisait jamais. Le
 * PDF et le hub servent tous deux cette colonne : le défaut se propageait
 * partout d'un seul point.
 *
 * Une facture doit porter le nom ET l'adresse de l'acheteur (art. L.441-9 C.
 * com., 242 nonies A CGI). En l'état, elle était irrégulière et le client ne
 * pouvait pas la passer en charge.
 *
 * ── Pourquoi un test de FORME en plus des tests de règles ───────────────────
 * Six émetteurs de `FactureFormation` coexistent. Cinq résolvaient correctement
 * l'acheteur ; un seul avait dérivé, et rien ne le distinguait à la lecture —
 * `destinataireNom: session.titreSession` compile, passe le typecheck, et
 * produit une facture d'apparence normale. C'est exactement la régression qu'un
 * septième émetteur réintroduira sans que personne ne s'en aperçoive.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { resoudreDestinataireFacture } from "./destinataire-facture";

const CLIENT = {
  raisonSociale: "INVEST SUN",
  siret: "90143483700018",
  adresse: "4 rue Dervieux, 42000 Saint-Étienne",
  tvaIntracom: "FR12901434837",
  opcoIdentifie: "atlas",
};

describe("resoudreDestinataireFacture", () => {
  it("facture l'entreprise sous sa raison sociale, avec SIRET et adresse", () => {
    const d = resoudreDestinataireFacture("entreprise", CLIENT);
    expect(d.nom).toBe("INVEST SUN");
    expect(d.siret).toBe("90143483700018");
    expect(d.adresse).toBe("4 rue Dervieux, 42000 Saint-Étienne");
    expect(d.tvaIntracom).toBe("FR12901434837");
  });

  it("recompose l'adresse structurée quand le champ libre est vide", () => {
    const d = resoudreDestinataireFacture("entreprise", {
      raisonSociale: "INVEST SUN",
      adresse: null,
      adresseRue: "4 rue Dervieux",
      adresseCodePostal: "42000",
      adresseVille: "Saint-Étienne",
    });
    expect(d.adresse).toBe("4 rue Dervieux, 42000 Saint-Étienne");
  });

  it("n'invente NI SIRET NI adresse pour un financeur", () => {
    for (const destinataire of ["opco", "france_travail", "stagiaire"] as const) {
      const d = resoudreDestinataireFacture(destinataire, CLIENT);
      expect(d.siret, `${destinataire} ne doit pas hériter du SIRET du client`).toBeNull();
      expect(d.adresse, `${destinataire} ne doit pas hériter de l'adresse du client`).toBeNull();
      expect(d.nom).not.toBe("INVEST SUN");
    }
  });

  it("nomme l'OPCO en clair, et le dit quand il est inconnu", () => {
    expect(resoudreDestinataireFacture("opco", CLIENT).nom).not.toBe("atlas");
    expect(resoudreDestinataireFacture("opco", { raisonSociale: "X" }).nom).toBe(
      "OPCO (à préciser)",
    );
  });

  it("annonce « À compléter » plutôt que d'inventer une identité", () => {
    expect(resoudreDestinataireFacture("entreprise", null).nom).toBe("À compléter");
    expect(resoudreDestinataireFacture("entreprise", { raisonSociale: "   " }).nom).toBe(
      "À compléter",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Garde-fou structurel
// ─────────────────────────────────────────────────────────────────────────────

const SRC = path.resolve(process.cwd(), "src");

/**
 * `destinataireNom` alimenté par un intitulé de prestation plutôt que par une
 * identité de tiers. `titreSession`, `intitule`, `titre`, `designation` : ce
 * sont des libellés de CE QUI EST VENDU, jamais de QUI ACHÈTE.
 */
const DESTINATAIRE_DEPUIS_INTITULE =
  /destinataireNom\s*:\s*[^,;\n]*\b(titreSession|intituleFormation|designation|titreFormation)\b/;

function fichiersTs(racine: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(racine)) {
    const complet = path.join(racine, entree);
    if (statSync(complet).isDirectory()) {
      trouves.push(...fichiersTs(complet));
      continue;
    }
    if (/\.tsx?$/.test(entree) && !entree.includes(".spec.")) trouves.push(complet);
  }
  return trouves;
}

describe("aucun émetteur ne facture au nom de la prestation", () => {
  it("n'alimente jamais `destinataireNom` depuis un intitulé de session", () => {
    const fautifs = fichiersTs(SRC)
      .filter((f) => DESTINATAIRE_DEPUIS_INTITULE.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(SRC, f).split(path.sep).join("/"));

    expect(
      fautifs,
      "`destinataireNom` est l'identité de l'ACHETEUR (art. L.441-9 C. com., 242 nonies A CGI), " +
        "pas l'intitulé de ce qui est vendu. Utiliser `resoudreDestinataireFacture()` " +
        "(server/qualiopi/financements/destinataire-facture.ts), qui rend aussi le SIRET et " +
        "l'adresse à écrire dans `destinataireSiret` / `destinataireAdresse`.",
    ).toEqual([]);
  });

  it("fait bien passer les deux émetteurs de facture de session par le résolveur", () => {
    // Sans cette assertion, supprimer les appels ferait passer le test ci-dessus
    // — et rendrait le garde-fou muet le jour où il compte.
    for (const emetteur of [
      "server/actions/qualiopi/financements.ts",
      "server/qualiopi/financements/facturation-service.ts",
    ]) {
      const source = readFileSync(path.join(SRC, emetteur), "utf8");
      expect(source, `${emetteur} doit résoudre l'acheteur par le module partagé`).toMatch(
        /resoudreDestinataireFacture\s*\(/,
      );
    }
  });
});
