// @vitest-environment node

/**
 * Liens du markdown léger : liste blanche de schémas (https, http, mailto, tel).
 * Tout autre lien est rendu en simple texte — le libellé reste, l'adresse disparaît.
 */
import { describe, expect, it } from "vitest";

import { fragmenter, hrefEstSur } from "../markdown-leger";

const lien = (href: string) => fragmenter(`Voir [ici](${href}) merci`);
const liens = (href: string) => lien(href).filter((f) => f.type === "lien");

describe("liens du markdown léger : schémas acceptés", () => {
  it.each([
    "https://axion-ia.com/fr",
    "http://exemple.fr",
    "mailto:contact@axion-ia.com",
    "tel:+33400000000",
    "HTTPS://axion-ia.com",
    "Mailto:contact@axion-ia.com",
  ])("garde %s comme lien", (href) => {
    const l = liens(href);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ type: "lien", valeur: "ici", href });
  });
});

describe("liens du markdown léger : schémas refusés, rendus en texte", () => {
  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://exemple.fr",
    "/fr/contact",
    "../contact",
    "//exemple.fr/x",
    "exemple.fr",
    "#ancre",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    " javascript:alert(1)",
    "\u0001javascript:alert(1)",
    " javascript:alert(1)",
    "j a v a s c r i p t:alert(1)",
    "java​script:alert(1)",
  ])("refuse %j", (href) => {
    const f = lien(href);
    expect(f.some((x) => x.type === "lien")).toBe(false);
    expect(f.map((x) => x.valeur).join("")).toContain("ici");
    expect(JSON.stringify(f)).not.toContain("alert");
  });

  it("hrefEstSur refuse le vide", () => {
    expect(hrefEstSur("")).toBe(false);
  });
});

describe("liens du markdown léger : le reste de la grammaire est intact", () => {
  it("gras et italique continuent de fonctionner à côté d'un lien refusé", () => {
    const f = fragmenter("**a** [x](javascript:alert(1)) *b*");
    expect(f.some((x) => x.type === "gras")).toBe(true);
    expect(f.some((x) => x.type === "italique")).toBe(true);
    expect(f.some((x) => x.type === "lien")).toBe(false);
  });
});
