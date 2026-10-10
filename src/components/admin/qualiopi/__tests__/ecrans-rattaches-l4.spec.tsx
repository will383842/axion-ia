/**
 * 🔴 Lot L4 (2026-09-30), correction de revue — un écran retiré de la barre
 * latérale doit rester atteignable EN CLIQUANT depuis son parent.
 *
 * `parent` ne fait que filtrer le rendu de la barre (AdminSidebarNav). La PR
 * avait rattaché huit écrans à Catalogue, Formateurs et Affaires sans qu'aucune
 * de ces pages n'y mène : régler un formateur ou mettre à jour un barème OPCO
 * demandait de connaître le libellé exact et de passer par ⌘K. Et Sous-traitants
 * (indicateur 27) n'apparaissait plus ni au menu ni dans « Registres et suivi »
 * du Mode auditeur.
 *
 * Contre-témoin : le test de couverture exige un nombre minimal d'écrans
 * examinés, pour qu'un filtre qui ne trouverait plus rien ne passe pas au vert.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildAdminNav, ecransRattaches } from "@/lib/admin-nav";
import { EcransRattaches } from "@/components/admin/qualiopi/EcransRattaches";

const ADMIN_ROOT = resolve(process.cwd(), "src/app/[locale]/(admin)/[adminPrefix]");

const libelles = (parent: string) => ecransRattaches("p", parent).map((it) => it.label);

describe("écrans rattachés : chaque parent y mène par un lien (lot L4)", () => {
  it("Catalogue mène au Générateur, aux Validations IA, aux Offres, aux Barèmes OPCO et à l'État des fonds OPCO", () => {
    expect(libelles("qualiopi/formations").sort()).toEqual(
      [
        "Générateur de formations",
        "Validations IA",
        "Offres",
        "Barèmes OPCO",
        "État des fonds OPCO",
      ].sort(),
    );
  });

  it("Formateurs mène aux Accès, à la Rémunération, aux Interrupteurs et aux Sous-traitants", () => {
    expect(libelles("qualiopi/formateurs").sort()).toEqual(
      [
        "Accès & connexions formateurs",
        "Rémunération formateurs",
        "Interrupteurs formateurs",
        "Sous-traitants",
      ].sort(),
    );
  });

  it("Affaires mène aux Audits IA", () => {
    expect(libelles("qualiopi/dossiers")).toEqual(["Audits IA"]);
  });

  it("Sous-traitants (indicateur 27) figure AUSSI dans « Registres et suivi » du Mode auditeur", () => {
    const hrefs = ecransRattaches("p", "qualiopi/mode-auditeur").map((it) => it.href);
    expect(hrefs).toContain("/fr/p/qualiopi/sous-traitants");
    // …sans perdre les registres déjà rattachés.
    expect(hrefs).toContain("/fr/p/qualiopi/reclamations");
  });

  it("le composant rend un lien cliquable par écran rattaché", () => {
    const html = renderToStaticMarkup(
      <EcransRattaches
        adminPrefix="p"
        parent="qualiopi/formateurs"
        titre="Autour des formateurs"
      />,
    );
    expect(html).toContain("Autour des formateurs");
    expect(html).toContain('href="/fr/p/qualiopi/remuneration"');
    expect(html).toContain('href="/fr/p/coaching/formateurs"');
    expect(html).toContain('href="/fr/p/qualiopi/sous-traitants"');
  });

  it("aucun écran masqué de la rubrique n'est orphelin : la page parente le rend", () => {
    const masques = buildAdminNav("p").filter((it) => it.group === "qualiopi" && it.parent != null);
    expect(masques.length).toBeGreaterThanOrEqual(20);
    const orphelins: string[] = [];
    for (const it of masques) {
      const parent = (it.parent as string).replace(/^\/fr\/p\//, "");
      const src = readFileSync(resolve(ADMIN_ROOT, parent, "page.tsx"), "utf8");
      const viaComposant = src.includes(`<EcransRattaches`) && src.includes(`parent="${parent}"`);
      const chemin = it.href.replace(/^\/fr\/p/, "");
      const enDur = src.includes(`/${chemin.replace(/^\//, "")}\``) || src.includes(`${chemin}"`);
      if (!viaComposant && !enDur) orphelins.push(`${it.label} → ${parent}`);
    }
    expect(orphelins).toEqual([]);
  });
});
