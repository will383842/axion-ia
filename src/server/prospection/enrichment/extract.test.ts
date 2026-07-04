import { describe, it, expect } from "vitest";
import { confirmDomainOwnership } from "./domain-confirm";
import { extractContacts } from "./contact-extract";
import { extractPersons } from "./person-extract";

const MENTIONS_HTML = `<html><body>
<h1>Mentions légales</h1>
<p>ACME BTP SAS — SIREN 123 456 789 — RCS Grenoble</p>
<p>Contact : <a href="mailto:contact@acme-btp.fr">contact@acme-btp.fr</a></p>
<p>Tél : <a href="tel:+33476001122">04 76 00 11 22</a></p>
<p>Commercial : jean.dupont@acme-btp.fr — 06 12 34 56 78</p>
</body></html>`;

const EQUIPE_HTML = `<html><body>
<h2>Notre équipe</h2>
<ul>
<li>Jean DUPONT — Directeur Général</li>
<li>Marie MARTIN, Responsable des achats</li>
<li>Paul BERNARD - Chef de chantier</li>
</ul>
</body></html>`;

describe("confirmDomainOwnership (#9)", () => {
  it("SIREN sur la page (tolérant aux espaces) → confirmé", () => {
    const r = confirmDomainOwnership(MENTIONS_HTML, {
      siren: "123456789",
      denomination: "ACME BTP",
    });
    expect(r.confirmed).toBe(true);
    expect(r.method).toBe("siren_on_page");
  });
  it("dénomination sur la page → confirmé", () => {
    const r = confirmDomainOwnership(MENTIONS_HTML, {
      siren: "999999999",
      denomination: "ACME BTP",
    });
    expect(r.confirmed).toBe(true);
    expect(r.method).toBe("denomination_on_page");
  });
  it("homonyme sans preuve → NON confirmé (anti collecte déloyale)", () => {
    const r = confirmDomainOwnership("<p>Autre société sans lien</p>", {
      siren: "123456789",
      denomination: "ACME BTP",
    });
    expect(r.confirmed).toBe(false);
    expect(r.method).toBe("none");
  });
});

describe("extractContacts", () => {
  it("emails (mailto + texte) dédupliqués", () => {
    const { emails } = extractContacts(MENTIONS_HTML);
    expect(emails).toEqual(
      expect.arrayContaining(["contact@acme-btp.fr", "jean.dupont@acme-btp.fr"]),
    );
  });
  it("téléphones normalisés E.164", () => {
    const { phones } = extractContacts(MENTIONS_HTML);
    expect(phones).toEqual(expect.arrayContaining(["+33476001122", "+33612345678"]));
  });
});

describe("extractPersons (passe B, #7)", () => {
  it("capture les responsables (nom + titre) d'une page équipe", () => {
    const persons = extractPersons(EQUIPE_HTML);
    const names = persons.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(["Jean DUPONT", "Marie MARTIN", "Paul BERNARD"]));
    const jean = persons.find((p) => p.name === "Jean DUPONT");
    expect(jean?.titre).toMatch(/Directeur/i);
  });

  it("layout carte : <h3>Nom</h3><p>Fonction</p> (réconciliation T5 D2)", () => {
    const html = `<div class="card"><h3>Jean DUPONT</h3><p>Directeur Général</p></div>
<div class="card"><h3>Marie MARTIN</h3><p>Responsable achats</p></div>`;
    const names = extractPersons(html).map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(["Jean DUPONT", "Marie MARTIN"]));
  });

  it("`Rôle : Nom` (réconciliation T5 D2)", () => {
    const html = `<li>Directeur Commercial : Marc PETIT</li>`;
    const names = extractPersons(html).map((p) => p.name);
    expect(names).toContain("Marc PETIT");
  });

  it("REJETTE une raison sociale comme personne (pas de ligne perso bidon)", () => {
    const html = `<li>Cabinet DUPONT Associés — Responsable juridique</li>`;
    const persons = extractPersons(html);
    expect(persons.find((p) => /Cabinet/i.test(p.name))).toBeUndefined();
  });

  it("REJETTE une section de page (Mentions Légales) comme personne (vérif data)", () => {
    const html = `<div class="card"><h3>Mentions Légales</h3><p>Responsable du site</p></div>`;
    const persons = extractPersons(html);
    expect(persons.find((p) => /Mentions|Légales/i.test(p.name))).toBeUndefined();
  });
});

describe("confirmDomainOwnership — frontière de mot (réconciliation T5 D3)", () => {
  it("dénomination courte ne matche pas un sous-mot (ELIS ≠ modélisation)", () => {
    const r = confirmDomainOwnership("<p>Nous faisons de la modélisation 3D</p>", {
      siren: "999999999",
      denomination: "ELIS",
    });
    expect(r.confirmed).toBe(false);
  });

  it("SIREN fabriqué par concaténation de nombres sans rapport → NON confirmé (vérif data)", () => {
    // "00123456789" contient "123456789" mais collé à un autre chiffre → pas le SIREN.
    const r = confirmDomainOwnership("<p>Commande n° 00123456789 du 12/03</p>", {
      siren: "123456789",
      denomination: "ZZZ SANS LIEN",
    });
    expect(r.confirmed).toBe(false);
  });

  it("SIRET (SIREN + NIC) sur la page → confirmé", () => {
    const r = confirmDomainOwnership("<p>SIRET 12345678900012</p>", {
      siren: "123456789",
      denomination: "ZZZ",
    });
    expect(r.confirmed).toBe(true);
    expect(r.method).toBe("siren_on_page");
  });
});
