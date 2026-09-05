/**
 * 🔴 F9 — les liens d'émargement étaient PERDUS à la navigation.
 *
 * Constaté en parcourant la console le 2026-09-04. L'écran prévient — à juste
 * titre — que les liens ne sont pas conservés en clair : la base n'en garde que
 * le SHA-256. Mais le chemin naturel (émettre → aller chercher l'adresse d'un
 * stagiaire → revenir) les détruisait, parce qu'ils vivaient dans le `useState`
 * d'un composant démonté à la première navigation. Il fallait alors RÉÉMETTRE,
 * ce qui invalide les liens déjà distribués.
 *
 * Ce que ce module doit garantir, et qu'aucune relecture ne garantit :
 *   1. un aller-retour rend les MÊMES liens ;
 *   2. un jeton EXPIRÉ n'est jamais rendu — un QR mort projeté en salle est
 *      pire qu'un écran vide, parce qu'on le distribue avant de s'apercevoir
 *      que personne ne peut signer ;
 *   3. la clé est PAR SESSION — sinon les liens d'une session s'afficheraient
 *      sous les noms des stagiaires d'une autre ;
 *   4. rien ne LÈVE sur une mémoire corrompue : l'écran d'émargement doit
 *      s'ouvrir le jour de la session, quoi qu'il arrive.
 */

import { describe, it, expect } from "vitest";

import {
  clefMemoireLiens,
  lireLiensMemorises,
  serialiserLiens,
  type LienMemorise,
} from "../liens-emargement-memoire";

const MAINTENANT = new Date("2026-09-05T10:00:00.000Z");

const LIEN: LienMemorise = {
  enrollmentId: "e-1",
  stagiaireNom: "Simone Blanc",
  url: "https://axion-ia.com/emargement/abc",
  qr: "data:image/png;base64,AAAA",
  expiresAtIso: "2026-09-07T10:00:00.000Z",
};

describe("clefMemoireLiens", () => {
  // 🔴 Sans le `sessionId` dans la clé, ouvrir une seconde session ferait
  // apparaître les liens de la première sous les noms de ses propres
  // stagiaires — l'erreur la plus coûteuse possible sur une pièce probante.
  it("sépare deux sessions", () => {
    expect(clefMemoireLiens("s-1")).not.toBe(clefMemoireLiens("s-2"));
    expect(clefMemoireLiens("s-1")).toContain("s-1");
  });
});

describe("lireLiensMemorises", () => {
  it("rend les liens intacts après un aller-retour", () => {
    const relu = lireLiensMemorises(serialiserLiens([LIEN]), MAINTENANT);
    expect(relu).toEqual([LIEN]);
  });

  it("écarte un jeton EXPIRÉ", () => {
    const perime: LienMemorise = { ...LIEN, expiresAtIso: "2026-09-04T10:00:00.000Z" };
    expect(lireLiensMemorises(serialiserLiens([perime]), MAINTENANT)).toBeNull();
  });

  it("ne garde que les jetons encore vivants d'un lot mixte", () => {
    const perime: LienMemorise = {
      ...LIEN,
      enrollmentId: "e-2",
      expiresAtIso: "2026-09-04T10:00:00.000Z",
    };
    const relu = lireLiensMemorises(serialiserLiens([LIEN, perime]), MAINTENANT);
    expect(relu?.map((l) => l.enrollmentId)).toEqual(["e-1"]);
  });

  // `null` et non `[]` : l'écran doit retomber sur « pas encore émis », et non
  // afficher une liste vide qui laisserait croire à un échec d'émission.
  it("rend null — et non une liste vide — quand il n'y a plus rien", () => {
    expect(lireLiensMemorises(serialiserLiens([]), MAINTENANT)).toBeNull();
    expect(lireLiensMemorises(null, MAINTENANT)).toBeNull();
    expect(lireLiensMemorises("", MAINTENANT)).toBeNull();
  });

  it("ne LÈVE jamais sur une mémoire corrompue", () => {
    expect(lireLiensMemorises("{ pas du json", MAINTENANT)).toBeNull();
    expect(lireLiensMemorises('"une chaîne"', MAINTENANT)).toBeNull();
    expect(lireLiensMemorises('{"v":99,"liens":[]}', MAINTENANT)).toBeNull();
    expect(lireLiensMemorises('{"v":1,"liens":"pas un tableau"}', MAINTENANT)).toBeNull();
    expect(lireLiensMemorises('{"v":1,"liens":[{"url":"x"}]}', MAINTENANT)).toBeNull();
    expect(
      lireLiensMemorises(
        '{"v":1,"liens":[{"enrollmentId":"e","stagiaireNom":"n","url":"u","qr":"q","expiresAtIso":"pas une date"}]}',
        MAINTENANT,
      ),
    ).toBeNull();
  });
});
