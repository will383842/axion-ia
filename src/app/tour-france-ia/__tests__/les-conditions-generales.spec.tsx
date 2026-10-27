/**
 * LES CONDITIONS GÉNÉRALES DU TOUR (2026-10-27).
 *
 * `/tour-france-ia/conditions-generales` est liée sous chaque grand bouton de la
 * landing et depuis son pied de page. Ce qui doit tenir :
 *
 *   · 18 articles (les articles du midi et du déplacement retirés le 2026-10-27), chacun sous un
 *     `h2 id="article-N"`, jamais repliés ;
 *   · la version affichée sous le titre ; la page ni indexée ni dans un sitemap ;
 *   · AUCUN montant chiffré (correction du propriétaire, 2026-10-27) : le tarif
 *     Tour est « convenu avec l’entreprise », la journée payante fixée la semaine
 *     suivant le passage du Tour ; ni « Grenoble », ni « cliente », ni aucune
 *     promesse de conformité ou de certification (hors la phrase de l'article 15
 *     qui la NIE) ; ni déjeuner ni repas de midi ;
 *   · les adaptations listées dans la PR (à valider par le propriétaire avant
 *     toute publicité) sont bien écrites.
 *
 * Ce fichier a sa propre garde : `conditions.ts` est hors de celle de la landing,
 * qui interdit les montants et « filmé » hors FAQ.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ConditionsGeneralesDuTour, { metadata } from "../conditions-generales/page";
import {
  ARTICLES,
  LIBELLES_CG,
  META_CG,
  TITRE_CG,
  VERSION_CG,
  toutLeTexteDesConditions,
} from "../conditions-generales/conditions";
import { CHEMIN_CONDITIONS, PIED } from "../contenu";

const RACINE = process.cwd();
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), "utf8");
const texte = toutLeTexteDesConditions();
const article = (n: number) =>
  (ARTICLES.find((a) => a.numero === n)?.blocs ?? [])
    .flatMap((b) => (typeof b === "string" ? [b] : b.liste))
    .join("\n");

/** La seule phrase où « certification » et « conformité » sont dites : pour les NIER. */
const NEGATION_ART_15 = "Elle n’est ni une certification ni une garantie de conformité.";

describe("🔑 la page des conditions générales", () => {
  it("18 articles, chacun sous un h2 à id, dans l'ordre, jamais repliés", async () => {
    const { container } = render(await ConditionsGeneralesDuTour());
    const titres = [...container.querySelectorAll("h2")];
    expect(titres).toHaveLength(18);
    expect(titres.map((h) => h.id)).toEqual(ARTICLES.map((a) => `article-${a.numero}`));
    expect(ARTICLES.map((a) => a.numero)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    for (const h of titres) {
      expect(h.className).toMatch(/scroll-mt-/);
      expect(h.closest("details"), h.id).toBeNull();
    }
    // Un seul H1, le titre ; la version est affichée sous lui.
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelector("h1")?.textContent).toBe(TITRE_CG);
    expect(container.querySelector(`time[datetime="${VERSION_CG}"]`)?.textContent).toBe(
      "27 octobre 2026",
    );
    // Le sommaire : un details FERMÉ (téléphone) et une colonne (grand écran), vers chaque article.
    const sommaire = container.querySelector("details");
    expect(sommaire?.hasAttribute("open")).toBe(false);
    expect(sommaire?.querySelectorAll('a[href^="#article-"]')).toHaveLength(18);
    expect(container.querySelectorAll('nav a[href^="#article-"]')).toHaveLength(18);
    // Le retour au Tour, et aucun script.
    expect(container.querySelector('a[href="/tour-france-ia"]')).not.toBeNull();
    expect(container.querySelectorAll("script, img, video")).toHaveLength(0);
    cleanup();
  });

  it("version 2026-10-27 ; ni indexée ni dans un sitemap ; 17 px, 68 caractères, impression", () => {
    expect(VERSION_CG).toBe("2026-10-27");
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates).toEqual({ canonical: CHEMIN_CONDITIONS });
    const page = lire("src/app/tour-france-ia/conditions-generales/page.tsx");
    expect(page).toContain("text-[1.0625rem]");
    expect(page).toContain("max-w-[68ch]");
    expect(page).toMatch(/print:hidden/);
    expect(page).toMatch(/lg:sticky|sticky top-/);
    expect(page).not.toMatch(/"use client"|next\/script|next\/image|@\/components\//);
    // Liée depuis le pied de page de la landing, en premier.
    expect(PIED.liens[0]?.href).toBe(CHEMIN_CONDITIONS);
  });
});

describe("🔴 le texte des conditions : montants, mots interdits, adaptations", () => {
  it("aucun montant chiffré (tarif convenu) ; ni 490, ni 690, ni Grenoble, ni cliente, ni Qualiopi", () => {
    expect(texte).not.toMatch(/\d+\s?€/);
    expect(texte).not.toMatch(/€/);
    expect(texte).not.toMatch(/\bHT\b/);
    expect(texte).not.toMatch(/490|690/);
    expect(texte).not.toMatch(/grenoble/i);
    expect(texte).not.toMatch(/cliente/i);
    expect(texte).not.toMatch(/qualiopi/i);
    expect(texte).not.toMatch(/conforme/i);
    // « certifi » n'apparaît que dans la phrase qui NIE toute certification.
    expect(article(15)).toContain(NEGATION_ART_15);
    expect(texte.replace(NEGATION_ART_15, "")).not.toMatch(/certifi/i);
    expect(texte).not.toMatch(/inscription|candidature/i);
  });

  it("les adaptations du 2026-10-27 sont écrites", () => {
    expect(article(1)).toMatch(/^La demande ne donne aucun droit automatique/);
    expect(article(1)).toMatch(/ni par tirage au sort ni selon l’ordre d’arrivée/);
    expect(article(2)).toMatch(/l’acceptation de la demande par AXION IA/);
    expect(article(3)).toContain(
      "Le refus ou le retrait d’un salarié n’a aucune conséquence, ni pour lui ni pour la gratuité.",
    );
    expect(article(4)).toMatch(/conditions générales de vente d’AXION IA/);
    expect(article(6)).toMatch(/intégralement déduit de la première commande/);
    expect(article(6)).toMatch(/s’applique sur la facture de solde/);
    expect(article(8)).toMatch(/Journée offerte : le jour d’intervention est fixé/);
    expect(article(6)).toMatch(/plafonnée au montant hors taxes de cette facture/);
    expect(article(6)).toMatch(/n’est pas cessible/);
    expect(article(6)).toMatch(/une seule fois par entreprise/);
    expect(article(7)).toMatch(
      /les sommes versées sont remboursées sous 14 jours ou la journée est reportée, au choix de l’entreprise/,
    );
    expect(article(10)).toMatch(/facultatif et n’est pas compris dans la journée offerte/);
    expect(article(10)).toMatch(/Chacun y paie sa part/);
    expect(article(11)).toMatch(
      /comme entreprise accompagnée lors du Tour France IA \(journée offerte\)/,
    );
    expect(article(11)).toContain(
      "«\u00a0Journée offerte par Axion-IA dans le cadre du Tour\u00a0»",
    );
    expect(article(12)).toContain('rel="sponsored"');
    expect(article(15)).toMatch(/article 4 du règlement \(UE\) 2024\/1689/);
    expect(article(15)).toMatch(
      /Une attestation de fin de formation est remise à chaque participant/,
    );
    expect(article(17)).toMatch(/celle acceptée lors de la demande/);
    expect(article(17)).toMatch(/retirer sa demande sans frais/);
    expect(article(18)).toMatch(/tribunal de commerce du ressort du siège social d’AXION IA SAS/);
    expect(article(18)).toMatch(/30 jours/);
  });

  it("🔴 la journée payante (corrections du 2026-10-27) : tarif convenu, semaine suivante, 100 % d’avance", () => {
    expect(texte).toContain("convenu avec l’entreprise");
    expect(texte).toContain("semaine suivant");
    expect(article(4)).toContain(
      "à un tarif convenu avec l’entreprise avant la confirmation de la date",
    );
    expect(article(4)).toContain(
      "La journée est fixée la semaine suivant le passage du Tour dans la ville, ou à une date convenue.",
    );
    expect(article(5)).toMatch(/payables à 100\s%\sd’avance, à la confirmation de la date/);
  });

  it("🔴 le repas de midi n’est dit nulle part (corrections du 2026-10-27)", () => {
    expect(texte).not.toMatch(/d[ée]jeuner/i);
    expect(texte).not.toMatch(/repas de midi/i);
    expect(ARTICLES.map((a) => a.titre)).not.toContain("Repas de midi");
    // Le dîner du vendredi, lui, reste : facultatif et hors offre.
    expect(ARTICLES.map((a) => a.titre)).toContain("Dîner du vendredi soir");
  });

  it("🔴 le nom : « Tour France IA », jamais « Tour de France IA » ni « … de l’IA en entreprise »", () => {
    expect(texte).not.toMatch(/Tour de France IA/i);
    expect(texte).not.toMatch(/Tour de France de l[’']IA/i);
    expect(texte).not.toMatch(/Tour de France/i);
    expect(TITRE_CG).toBe("Conditions générales du Tour France IA — AXION IA SAS");
    expect(META_CG.titre).toBe("Conditions générales du Tour France IA");
    expect(LIBELLES_CG.retour).toBe("Retour au Tour");
  });

  it("🔴 aucune mention des frais de déplacement (ordre du propriétaire)", () => {
    expect(texte).not.toMatch(/d[ée]placement/i);
  });

  it("la page des conditions n'est dans aucun sitemap", () => {
    expect(lire("src/app/sitemap-tour-france-ia.xml/route.ts")).not.toMatch(/conditions-generales/);
  });
});
