/**
 * 🔴 LA CONFIRMATION D'ACCEPTATION NE S'AFFICHAIT JAMAIS.
 *
 * Constaté en recette le 2026-09-03, en acceptant vraiment une mission par le
 * lien de l'e-mail : l'écran rendu une seconde après le clic disait
 *
 *     « Cette proposition n'attend plus de réponse : acceptée. »
 *
 * — un constat écrit pour quelqu'un qui rouvre un vieux lien. La phrase qui
 * répond à la seule question du formateur (« et maintenant ? ») vivait dans
 * l'état local du formulaire, et `router.refresh()` la détruisait : la page
 * serveur voit la mission quittée de `en_attente`, cesse de rendre le
 * formulaire, et son état part avec lui.
 *
 * Deux gardes ici, et elles couvrent deux erreurs DIFFÉRENTES :
 *
 *   1. la page serveur doit rendre les MÊMES phrases que le formulaire — une
 *      recopie dériverait, et c'est la version jamais vue qui porterait la
 *      bonne ;
 *   2. le module qui les porte ne doit PAS être `"use client"`. Dans l'App
 *      Router, tout export d'un module `"use client"` devient une référence
 *      client : un Server Component qui y lit `.titre` trouve `undefined` et
 *      rend un 500. C'est exactement ce qui est arrivé au premier essai de
 *      correction, et rien dans le typage ne l'annonce.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SUITE_APRES_REPONSE } from "./mission-copy";

const lire = (p: string): string => readFileSync(join(process.cwd(), p), "utf8");

const MODULE = "src/components/espace-formateur/mission-copy.ts";
const FORMULAIRE = "src/components/espace-formateur/MissionReponseForm.tsx";
const PAGE = "src/app/[locale]/espace-formateur/mission/[token]/page.tsx";

describe("les phrases d'après-réponse", () => {
  it("répondent à « et maintenant ? », pas seulement « c'est fait »", () => {
    expect(SUITE_APRES_REPONSE.acceptee.titre).toBe("Mission acceptée.");
    expect(SUITE_APRES_REPONSE.acceptee.suite).toContain("une semaine avant le démarrage");
    expect(SUITE_APRES_REPONSE.refusee.titre).toBe("Refus enregistré.");
    expect(SUITE_APRES_REPONSE.refusee.suite).toContain("un autre intervenant");
  });

  it("🔴 leur module n'est PAS « use client » — sinon la page serveur lit undefined", () => {
    // La garde porte sur la PREMIÈRE ligne significative : une directive
    // "use client" ne compte que là.
    const premiere =
      lire(MODULE)
        .split("\n")
        .find((l) => l.trim() !== "") ?? "";
    expect(premiere).not.toMatch(/use client/);
  });

  it("le module reste un `.ts` — donc sans JSX, donc importable des deux côtés", () => {
    // Volontairement l'EXTENSION et rien d'autre : chercher « <Balise » dans la
    // source attrape `Record<ReponseDonnee, …>` et rougit sur du TypeScript
    // parfaitement légitime. Une garde qui crie à tort cesse d'être lue.
    expect(MODULE.endsWith(".ts")).toBe(true);
    expect(MODULE.endsWith(".tsx")).toBe(false);
  });
});

describe("les deux écrans disent la même chose", () => {
  it("le formulaire et la page serveur LISENT la constante, ils ne la recopient pas", () => {
    for (const f of [FORMULAIRE, PAGE]) {
      const src = lire(f);
      expect(src, `${f} n'importe pas la constante`).toContain(
        'from "@/components/espace-formateur/mission-copy"',
      );
      expect(src, `${f} n'utilise pas la constante`).toContain("SUITE_APRES_REPONSE");
    }
  });

  it("🔴 aucun des deux ne réécrit la phrase à la main", () => {
    // C'est la recopie qui rouvrirait le défaut : deux textes, un seul visible.
    for (const f of [FORMULAIRE, PAGE]) {
      expect(lire(f), `${f} recopie la phrase`).not.toContain(
        "une semaine avant le démarrage, et restent consultables",
      );
    }
  });

  it("la page serveur traite l'acceptation et le refus À PART du reste", () => {
    // `retiree` et `expiree` gardent le constat neutre : personne n'a répondu,
    // il n'y a pas de « et maintenant ? » à promettre.
    const src = lire(PAGE);
    expect(src).toContain('mission.statut === "acceptee" || mission.statut === "refusee"');
    expect(src).toContain("n'attend plus de réponse");
  });
});
