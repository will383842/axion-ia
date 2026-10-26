/**
 * Les textes de l'écran de confirmation et l'attribution propres à la visio du
 * Tour de France IA (2026-10-25). Garde de SOURCE, comme les autres gardes du
 * parcours : la page est un composant serveur asynchrone.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (chemin: string): string => readFileSync(join(process.cwd(), chemin), "utf8");

const CONFIRME = lire("src/app/[locale]/appel/confirme/page.tsx");

describe("l'écran /appel/confirme", () => {
  it("reconnaît le Tour par son type propre, et par le choix transmis pour les anciennes lignes", () => {
    expect(CONFIRME).toMatch(/type === "tour_de_france_ia"/);
    expect(CONFIRME).toMatch(/choixTransmis === "tour"/);
  });

  it("porte un texte propre au Tour, sans promesse de résultat ni de prestation", () => {
    expect(CONFIRME).toContain("Une visio pour faire connaissance");
    expect(CONFIRME).toContain("nous vous présentons le Tour de France IA");
    expect(CONFIRME).toContain("confirmez votre participation");
    const bloc = CONFIRME.slice(CONFIRME.indexOf("Une visio pour faire connaissance") - 200);
    expect(bloc.slice(0, 600)).not.toMatch(/devis|prix|signature|gratuit/i);
  });
});

describe("l'attribution", () => {
  it("l'action passe la source par défaut du choix au validateur, qui ne remplace jamais une source connue", () => {
    expect(lire("src/app/[locale]/appel/reserver/actions.ts")).toContain(
      "utmSourceParDefaut: utmSourceParDefaut(choix)",
    );
    expect(lire("src/server/calendly/formulaire-reservation.ts")).toContain(
      "utmSource: o.utmSource ?? o.utmSourceParDefaut ?? null",
    );
  });

  it("la page /appel retombe sur la source du Tour pour son suivi", () => {
    expect(lire("src/app/[locale]/appel/page.tsx")).toContain("utmSourceParDefaut(choix)");
  });
});
