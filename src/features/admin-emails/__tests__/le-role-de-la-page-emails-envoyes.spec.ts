/**
 * Rôle de la page « E-mails envoyés » (25/10/2026) : le JOURNAL de tous les e-mails partis, tous
 * clients confondus. Pour un seul client, on lit l'onglet « E-mails » de sa fiche. L'entrée de menu
 * s'appelle « E-mails envoyés » (une seule entrée, plus « Envoyés »), et la page le dit.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildAdminNav } from "@/lib/admin-nav";

const VUE = readFileSync(
  join(
    process.cwd(),
    "src/app/[locale]/(admin)/[adminPrefix]/emails-envoyes/_components/VueEmails.tsx",
  ),
  "utf8",
);

describe("le rôle de la page « E-mails envoyés »", () => {
  it("une seule entrée de menu, nommée « E-mails envoyés »", () => {
    const entrees = buildAdminNav("adm").filter((it) => it.href.endsWith("/emails-envoyes"));
    expect(entrees.map((e) => e.label)).toEqual(["E-mails envoyés"]);
  });

  it("la page dit qu'elle est le journal de tous les clients et renvoie à l'onglet de la fiche", () => {
    expect(VUE).toContain("tous clients confondus");
    expect(VUE).toContain("onglet « E-mails » de sa fiche");
  });

  it("le journal filtré sur un client renvoie à l'onglet « E-mails » de la fiche", () => {
    expect(VUE).toContain("?onglet=emails");
  });
});
