/**
 * Art. L6353-6 (1) — aucune somme exigée ni versée avant le délai de rétractation.
 *
 * ## Le défaut que ce fichier verrouille
 *
 * L'article pose TROIS obligations cumulatives. Le dépôt n'en appliquait qu'une
 * — le plafond de 30 %. Le point (1), le délai de dix jours, était **calculé et
 * jamais lu** : `encaissableAPartirDu` n'était consommé nulle part dans `src/`,
 * et `calculerAcompte()` n'était appelé nulle part hors de ses propres tests.
 *
 * 🔴 C'est la pire forme de non-conformité : pas une absence de contrôle, mais un
 * contrôle en TROMPE-L'ŒIL. Le contrat de formation annonçait au particulier une
 * date d'encaissement que rien, côté serveur, n'appliquait. À la lecture du code
 * on croyait la règle implémentée ; à l'exécution, rien n'empêchait de facturer
 * un particulier le jour même de son acceptation.
 */

import { describe, it, expect } from "vitest";
import {
  DELAI_RETRACTATION_PARTICULIER_JOURS,
  dateEncaissablePartir,
  encaissementAutorise,
} from "./acompte";

const JOUR_MS = 24 * 60 * 60 * 1000;
const ACCEPTE = new Date("2026-03-01T10:00:00.000Z");

describe("dateEncaissablePartir", () => {
  it("ajoute exactement les dix jours de l'article L6353-5", () => {
    expect(DELAI_RETRACTATION_PARTICULIER_JOURS).toBe(10);
    expect(dateEncaissablePartir(ACCEPTE).toISOString()).toBe("2026-03-11T10:00:00.000Z");
  });

  it("ne mute pas la date d'entrée", () => {
    const avant = ACCEPTE.getTime();
    dateEncaissablePartir(ACCEPTE);
    expect(ACCEPTE.getTime()).toBe(avant);
  });
});

describe("encaissementAutorise", () => {
  it("REFUSE le jour même de l'acceptation", () => {
    // Le cas nominal du défaut : rien n'empêchait cette facture.
    expect(encaissementAutorise(ACCEPTE, ACCEPTE)).toBe(false);
  });

  it("REFUSE la veille de l'expiration", () => {
    const veille = new Date(ACCEPTE.getTime() + 9 * JOUR_MS);
    expect(encaissementAutorise(ACCEPTE, veille)).toBe(false);
  });

  it("REFUSE une milliseconde avant le terme", () => {
    const presque = new Date(dateEncaissablePartir(ACCEPTE).getTime() - 1);
    expect(encaissementAutorise(ACCEPTE, presque)).toBe(false);
  });

  it("AUTORISE pile au terme", () => {
    // La borne est inclusive : le délai est « expiré » à l'instant exact.
    expect(encaissementAutorise(ACCEPTE, dateEncaissablePartir(ACCEPTE))).toBe(true);
  });

  it("AUTORISE après le terme", () => {
    const apres = new Date(ACCEPTE.getTime() + 11 * JOUR_MS);
    expect(encaissementAutorise(ACCEPTE, apres)).toBe(true);
  });

  it("🔴 REFUSE quand la date d'engagement est absente", () => {
    // Le point le plus important du fichier. Sans date, le délai est
    // INCALCULABLE : autoriser « faute de savoir » ferait de l'absence de donnée
    // un laissez-passer, précisément dans le cas où l'on ne peut rien prouver
    // devant un contrôle. Le refus est la seule réponse défendable.
    expect(encaissementAutorise(null, new Date("2030-01-01"))).toBe(false);
  });
});

describe("le garde-fou est AU SERVEUR, et il est branché", () => {
  // Test de PROPRIÉTÉ. Le défaut d'origine n'était pas un mauvais calcul : le
  // calcul était juste. Il n'était appelé par personne. Un test de comportement
  // sur la fonction pure serait donc passé au vert pendant que la production
  // facturait sans contrôle — c'est exactement ce qui s'est produit.
  it("`encaissementAutorise` est appelé par le hub de facturation", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "src", "server", "actions", "qualiopi", "facturation-hub.ts"),
      "utf8",
    );
    expect(source).toMatch(/encaissementAutorise\s*\(/);
    // Le garde-fou lit une date qui doit être dans le `select` Prisma : sans
    // elle, il lirait `undefined` et laisserait passer TOUTES les factures.
    expect(source).toMatch(/acceptedAt: true/);
  });
});
