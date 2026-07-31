/**
 * Tests — `portail/routes.ts` : le motif d'URL de la garde Edge (audit X3).
 *
 * Ces assertions verrouillent le PÉRIMÈTRE de la garde, pas son effet. L'effet
 * (307 + Location) est vérifié en e2e — `tests/e2e/qualiopi/portail-garde-acces.spec.ts` —
 * parce que `src/proxy.ts` n'est pas montable en Vitest (NextAuth + next-intl + Edge).
 *
 * Les deux tests d'exclusion (`emarger`, `acces`) sont les plus importants du
 * fichier : ils échouent si quelqu'un « complète » la garde, ce qui casserait
 * respectivement l'émargement (pièce probante ind. 9 et 11) et la connexion.
 */

import { describe, it, expect } from "vitest";
import { PORTAIL_COOKIE_NAME, localeSiPortailProtege } from "./routes";

describe("PORTAIL_COOKIE_NAME", () => {
  it("vaut exactement le nom posé par setPortailCookie", () => {
    // Si cette valeur change sans que `cookie.ts` suive, la garde Edge ne verra
    // plus jamais de cookie et redirigera les stagiaires connectés.
    expect(PORTAIL_COOKIE_NAME).toBe("portail_session");
  });
});

describe("localeSiPortailProtege", () => {
  it("protège /fr/portail/mon-espace et rend sa locale", () => {
    expect(localeSiPortailProtege("/fr/portail/mon-espace")).toBe("fr");
  });

  it("protège la variante EN (utile le jour où EN sera réactivé)", () => {
    expect(localeSiPortailProtege("/en/portail/mon-espace")).toBe("en");
  });

  it("protège un futur sous-chemin de mon-espace", () => {
    expect(localeSiPortailProtege("/fr/portail/mon-espace/attestations")).toBe("fr");
  });

  it("NE protège PAS emarger/[token] — le jeton est dans le chemin, pas dans un cookie", () => {
    expect(localeSiPortailProtege("/fr/portail/emarger/abc123")).toBeNull();
  });

  it("NE protège PAS acces/[token] — c'est la route qui POSE le cookie", () => {
    expect(localeSiPortailProtege("/fr/portail/acces/abc123")).toBeNull();
  });

  it("NE protège PAS demander-acces — cible de la redirection, sinon boucle", () => {
    expect(localeSiPortailProtege("/fr/portail/demander-acces")).toBeNull();
  });

  it("NE protège PAS acces-invalide — page d'information publique", () => {
    expect(localeSiPortailProtege("/fr/portail/acces-invalide")).toBeNull();
  });

  it("ignore un chemin sans préfixe de locale", () => {
    expect(localeSiPortailProtege("/portail/mon-espace")).toBeNull();
  });

  it("ne se laisse pas contourner par un préfixe qui ressemble", () => {
    expect(localeSiPortailProtege("/fr/portail/mon-espace-public")).toBeNull();
    expect(localeSiPortailProtege("/fr/faux/portail/mon-espace")).toBeNull();
  });
});
