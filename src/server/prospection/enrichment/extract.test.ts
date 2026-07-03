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
});
