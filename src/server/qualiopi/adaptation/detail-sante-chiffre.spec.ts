/**
 * La colonne `Trainee.handicapDetailsChiffre` ne reçoit QUE du chiffré.
 *
 * ## Le défaut, et pourquoi il a survécu à quatre relectures
 *
 * `encryptPii` n'échoue jamais. Elle chiffre, ou elle rend l'entrée
 * **INCHANGÉE** — chaîne vide, texte portant déjà le préfixe (garde
 * d'idempotence, voulue), clé absente. Un appelant qui écrit
 * `encryptPii(detail)` sans regarder le résultat peut donc écrire du clair.
 *
 * Tester le préfixe de la SORTIE ne suffit pas : sur une entrée déjà préfixée,
 * le test répond « c'est chiffré » alors que rien ne l'est. C'est la faille
 * corrigée dans #1103 sur un seul des quatre chemins d'écriture.
 *
 * La seule propriété qui discrimine : **le chiffrement a-t-il TRANSFORMÉ le
 * texte ?** Elle couvre les trois cas d'un coup.
 *
 * ## Ce que ces cas verrouillent
 *
 * 1. un texte ordinaire est chiffré et rendu ;
 * 2. une entrée déjà préfixée est REFUSÉE (`null`), jamais rendue telle quelle ;
 * 3. clé absente → REFUSÉE ;
 * 4. le clair ne fuit dans aucune trace ;
 * 5. `detailSanteSaisissable` refuse en amont ce que la garde refuserait.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const captureMessage = vi.fn();
/** Bascule du doublon : `false` = clé de chiffrement absente. */
let cleDisponible = true;

vi.mock("@sentry/nextjs", () => ({
  captureMessage: (...a: unknown[]) => captureMessage(...a),
  captureException: vi.fn(),
}));

// ⚠️ Doublon FIDÈLE au module réel, garde d'idempotence comprise. Un doublon
// plus indulgent que la production rend la garde invisible — c'est exactement
// ce qui avait laissé passer la faille : le doublon chiffrait là où le vrai
// module ne chiffre pas.
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => {
    if (v === "") return v;
    if (v.startsWith("enc:v1:")) return v; // idempotence
    if (!cleDisponible) return v; // clé absente
    return `enc:v1:iv:${Buffer.from(v).toString("hex")}:tag`;
  },
  isEncryptedPii: (v: unknown) => typeof v === "string" && v.startsWith("enc:v1:"),
}));

import { chiffrerDetailSante, detailSanteSaisissable } from "./detail-sante-chiffre";

const CONTEXTE = { service: "spec", traineeId: "11111111-2222-4333-8444-555555555555" };
const SANTE = "je suis malentendant de l'oreille gauche";

beforeEach(() => {
  vi.clearAllMocks();
  cleDisponible = true;
});

describe("chiffrerDetailSante", () => {
  it("chiffre un texte ordinaire", () => {
    const r = chiffrerDetailSante(SANTE, CONTEXTE);
    expect(r).not.toBeNull();
    expect(r).toMatch(/^enc:v1:/);
    expect(r, "le clair a été rendu tel quel").not.toBe(SANTE);
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("🔴 REFUSE une entrée qui porte déjà le préfixe — le cœur de la faille", () => {
    // `encryptPii` court-circuite et rend le texte inchangé ; un simple test de
    // préfixe validerait cette donnée de santé EN CLAIR.
    const r = chiffrerDetailSante(`enc:v1:${SANTE}`, CONTEXTE);

    expect(r, "une donnée de santé en clair a été acceptée comme chiffrée").toBeNull();
    expect(captureMessage).toHaveBeenCalledOnce();
  });

  it("🔴 REFUSE quand la clé de chiffrement est absente", () => {
    cleDisponible = false;
    expect(chiffrerDetailSante(SANTE, CONTEXTE)).toBeNull();
    expect(captureMessage).toHaveBeenCalledOnce();
  });

  it("🔴 le clair ne fuit dans AUCUNE trace", () => {
    cleDisponible = false;
    chiffrerDetailSante(SANTE, CONTEXTE);

    const trace = JSON.stringify(captureMessage.mock.calls);
    expect(trace, "le détail de santé est parti dans la trace").not.toContain(SANTE);
    expect(trace).not.toContain("malentendant");
    // Ce qui doit y être : de quoi retrouver la personne, pas ce qu'elle a écrit.
    expect(trace).toContain(CONTEXTE.traineeId);
  });

  it("sans identifiant, la trace part quand même", () => {
    cleDisponible = false;
    expect(chiffrerDetailSante(SANTE, { service: "spec" })).toBeNull();
    expect(captureMessage).toHaveBeenCalledOnce();
  });
});

describe("detailSanteSaisissable", () => {
  it("accepte un texte ordinaire", () => {
    expect(detailSanteSaisissable(SANTE)).toBe(true);
  });

  it("🔴 refuse le préfixe de chiffrement, espaces de tête compris", () => {
    expect(detailSanteSaisissable(`enc:v1:${SANTE}`)).toBe(false);
    expect(detailSanteSaisissable(`   enc:v1:${SANTE}`), "le trim n'est pas appliqué").toBe(false);
  });

  it("accepte le préfixe AILLEURS qu'en tête — il n'empêche pas le chiffrement", () => {
    expect(detailSanteSaisissable(`mon besoin enc:v1: au milieu`)).toBe(true);
  });

  it("refuse ce qui n'est pas une chaîne", () => {
    expect(detailSanteSaisissable(null)).toBe(false);
    expect(detailSanteSaisissable(42)).toBe(false);
  });
});
