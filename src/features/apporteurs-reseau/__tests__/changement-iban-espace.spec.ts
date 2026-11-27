// Lot 5 : l'état de la section « Mon compte bancaire » (règle pure) et les gardes de la route des liens.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { etatSectionCompte, dateReponseAuPlusTot } from "../changement-iban-espace";

const base = {
  signe: true,
  restreint: false,
  interrupteur: true,
  secret: true,
  aTelephone: true,
  demande: null,
};

describe("etatSectionCompte", () => {
  it("normal : dossier signé, non restreint, service ouvert", () => {
    expect(etatSectionCompte(base)).toEqual({ etat: "normal" });
  });
  it("absente si le dossier n'est pas signé ou est restreint", () => {
    expect(etatSectionCompte({ ...base, signe: false }).etat).toBe("absente");
    expect(etatSectionCompte({ ...base, restreint: true }).etat).toBe("absente");
  });
  it("service fermé : interrupteur éteint OU secret absent", () => {
    expect(etatSectionCompte({ ...base, interrupteur: false }).etat).toBe("ferme");
    expect(etatSectionCompte({ ...base, secret: false }).etat).toBe("ferme");
  });
  it("sans téléphone : message « écrivez-nous », pas de formulaire", () => {
    expect(etatSectionCompte({ ...base, aTelephone: false }).etat).toBe("sans-telephone");
  });
  it("demande à confirmer / confirmée / refusée", () => {
    const d = new Date("2026-11-25T10:00:00Z");
    expect(etatSectionCompte({ ...base, demande: { statut: "a_confirmer", demandeeAt: d } }).etat).toBe("a-confirmer");
    expect(etatSectionCompte({ ...base, demande: { statut: "confirmee", demandeeAt: d } }).etat).toBe("confirmee");
    const r = etatSectionCompte({
      ...base,
      demande: { statut: "refusee", demandeeAt: d, motifRefus: "RIB illisible" },
    });
    expect(r).toEqual({ etat: "refusee", motif: "RIB illisible" });
  });
  it("validée, opposée, annulée, expirée : retour à l'état normal", () => {
    const d = new Date();
    for (const statut of ["validee", "opposee", "annulee", "expiree"] as const) {
      expect(etatSectionCompte({ ...base, demande: { statut, demandeeAt: d } }).etat).toBe("normal");
    }
  });
  it("réponse au plus tôt : 72 h après la confirmation", () => {
    expect(dateReponseAuPlusTot(new Date("2026-11-25T10:00:00Z")).toISOString()).toBe("2026-11-28T10:00:00.000Z");
  });
});

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const ROUTE = "src/app/apporteur/dossier/compte/[demande]/[signature]/page.tsx";

describe("la route des liens de l'e-mail", () => {
  const src = lire(ROUTE);
  it("est rendue à la demande et répond no-store, sans index", () => {
    expect(src).toMatch(/export const dynamic = "force-dynamic"/);
    expect(src).toMatch(/nocache: true/);
    expect(src).toMatch(/index: false/);
  });
  it("afficher la page n'écrit rien : seul l'envoi du formulaire appelle confirmer / bloquer", () => {
    const page = src.slice(0, src.indexOf("export default") === -1 ? undefined : src.length);
    expect(page).not.toMatch(/confirmerDemande\(|sOpposerALaDemande\(/);
    const actions = lire("src/app/apporteur/dossier/compte/[demande]/[signature]/actions.ts");
    expect(actions).toMatch(/confirmerDemande\(/);
    expect(actions).toMatch(/sOpposerALaDemande\(/);
  });
  it("ne rend ni IBAN entier ni lien personnel", () => {
    expect(src).not.toMatch(/jetonDossier|urlDossier|\.iban\b/);
  });
});

describe("la section de l'espace", () => {
  it("l'action de demande relit le dossier par son lien et ne prend jamais l'adresse dans la requête", () => {
    const a = lire("src/app/apporteur/dossier/[id]/[jeton]/actions-compte.ts");
    expect(a).toMatch(/lireDossierParLien/);
    expect(a).not.toMatch(/get\("(email|adresse|destinataire)"\)/);
  });
});
