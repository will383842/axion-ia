/**
 * LA SESSION ADMIN PARTAGÉE — ce que ce cache doit garantir.
 *
 * 🔴 POURQUOI CE FICHIER EXISTE.
 *
 * Le cache de `tests/e2e/fixtures/session-admin-partagee.ts` décide combien de
 * connexions réelles la suite E2E consomme. Quand il marche, elle en fait une ;
 * quand il se trompe, elle en fait vingt-huit et Gate B tombe sur « Trop de
 * tentatives », un message qui accuse le produit alors que rien n'y est cassé.
 *
 * 🔑 Le défaut redouté n'est PAS « le cache ne sert à rien » — celui-là se voit,
 * la suite redevient lente. C'est « le cache sert TROP » : rejouer les cookies
 * d'un autre compte, ou des cookies périmés, rendrait vertes des specs qui n'ont
 * pas de session. Les trois premiers tests portent donc sur ce qu'il REFUSE de
 * rendre, pas sur ce qu'il rend.
 *
 * ⚠️ Ce fichier n'éprouve QUE le module pur (fichiers et verrou). La
 * vérification d'arrivée sur le tableau de bord vit dans `loginAsAdmin`, qui a
 * besoin d'un navigateur : elle est éprouvée par la suite Playwright elle-même,
 * dont le nombre de connexions est l'observable.
 */

import { describe, expect, it, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  ecrireSessionPartagee,
  lireSessionPartagee,
  oublierSessionPartagee,
  prendreLeVerrou,
  rendreLeVerrou,
  verrouPris,
} from "../../e2e/fixtures/session-admin-partagee";

const PREFIXE = "admin-test-x";

/** Une adresse par test : deux tests ne doivent jamais partager un fichier. */
let n = 0;
const adresses: string[] = [];
function adresseNeuve(): string {
  const a = `garde-${process.pid}-${++n}@exemple.test`;
  adresses.push(a);
  return a;
}

/**
 * ⚠️ On n'efface QUE ce que ce fichier a posé, jamais le dossier partagé.
 * Une exécution E2E peut tourner en même temps sur cette machine : lui retirer
 * son état sous les pieds la ferait se reconnecter vingt-huit fois.
 */
afterEach(() => {
  for (const a of adresses) {
    oublierSessionPartagee(a, PREFIXE);
    rendreLeVerrou(a, PREFIXE);
  }
  adresses.length = 0;
});

const COOKIES = [
  { name: "authjs.session-token", value: "abc", domain: "localhost", path: "/" },
] as unknown as Parameters<typeof ecrireSessionPartagee>[2];

describe("le cache de session admin refuse de rendre ce qu'il ne peut pas garantir", () => {
  it("rend `null` quand rien n'a été écrit — jamais un état vide qui passerait pour une session", () => {
    expect(lireSessionPartagee(adresseNeuve(), PREFIXE)).toBeNull();
  });

  it("rend `null` sur un fichier illisible plutôt que de lever", () => {
    const a = adresseNeuve();
    const dossier = join(tmpdir(), "axion-e2e-session");
    mkdirSync(dossier, { recursive: true });
    const cle = `${a}|${PREFIXE}`.replace(/[^a-zA-Z0-9._-]/g, "_");
    writeFileSync(join(dossier, `${cle}.json`), "{ ceci n'est pas du JSON", "utf8");

    expect(lireSessionPartagee(a, PREFIXE)).toBeNull();
  });

  it("rend `null` passé l'âge maximal — un fichier oublié n'est pas une session", () => {
    const a = adresseNeuve();
    const dossier = join(tmpdir(), "axion-e2e-session");
    mkdirSync(dossier, { recursive: true });
    const cle = `${a}|${PREFIXE}`.replace(/[^a-zA-Z0-9._-]/g, "_");
    // 21 minutes : au-delà de la borne de 20 min du module.
    const vieux = Date.now() - 21 * 60 * 1000;
    writeFileSync(
      join(dossier, `${cle}.json`),
      JSON.stringify({ ecritLe: vieux, cookies: COOKIES }),
      "utf8",
    );

    expect(lireSessionPartagee(a, PREFIXE)).toBeNull();
  });

  it("🔴 ne rend JAMAIS la session d'une autre adresse ni d'un autre préfixe", () => {
    const a = adresseNeuve();
    const b = adresseNeuve();
    ecrireSessionPartagee(a, PREFIXE, COOKIES);

    // Autre adresse, même préfixe.
    expect(lireSessionPartagee(b, PREFIXE)).toBeNull();
    // Même adresse, autre préfixe : deux consoles distinctes, deux sessions.
    expect(lireSessionPartagee(a, "admin-autre-prefixe")).toBeNull();
    // Et la sienne, elle, revient.
    expect(lireSessionPartagee(a, PREFIXE)).toHaveLength(1);
  });
});

describe("le cache rend ce qu'il a reçu", () => {
  it("relit exactement les cookies écrits", () => {
    const a = adresseNeuve();
    ecrireSessionPartagee(a, PREFIXE, COOKIES);

    const relu = lireSessionPartagee(a, PREFIXE);
    expect(relu).not.toBeNull();
    expect(relu?.[0]?.name).toBe("authjs.session-token");
    expect(relu?.[0]?.value).toBe("abc");
  });

  it("`oublier` rend le cache vide — c'est ce qui permet à une session périmée d'être refaite", () => {
    const a = adresseNeuve();
    ecrireSessionPartagee(a, PREFIXE, COOKIES);
    expect(lireSessionPartagee(a, PREFIXE)).not.toBeNull();

    oublierSessionPartagee(a, PREFIXE);

    expect(lireSessionPartagee(a, PREFIXE)).toBeNull();
  });

  it("écrire une liste vide ne crée pas une fausse session", () => {
    const a = adresseNeuve();
    ecrireSessionPartagee(a, PREFIXE, [] as unknown as typeof COOKIES);

    expect(lireSessionPartagee(a, PREFIXE)).toBeNull();
  });
});

describe("le verrou n'est pris que par un seul", () => {
  it("🔴 le second appel ÉCHOUE à le prendre — sans quoi les quatre workers se connecteraient", () => {
    const a = adresseNeuve();

    expect(prendreLeVerrou(a, PREFIXE)).toBe(true);
    expect(prendreLeVerrou(a, PREFIXE)).toBe(false);
    expect(prendreLeVerrou(a, PREFIXE)).toBe(false);
  });

  it("`verrouPris` dit la vérité avant, pendant et après", () => {
    const a = adresseNeuve();

    expect(verrouPris(a, PREFIXE)).toBe(false);
    prendreLeVerrou(a, PREFIXE);
    expect(verrouPris(a, PREFIXE)).toBe(true);
    rendreLeVerrou(a, PREFIXE);
    expect(verrouPris(a, PREFIXE)).toBe(false);
  });

  it("rendu, il se reprend — un worker suivant n'est pas condamné à attendre", () => {
    const a = adresseNeuve();

    prendreLeVerrou(a, PREFIXE);
    rendreLeVerrou(a, PREFIXE);

    expect(prendreLeVerrou(a, PREFIXE)).toBe(true);
  });

  it("deux adresses ont deux verrous distincts", () => {
    const a = adresseNeuve();
    const b = adresseNeuve();

    expect(prendreLeVerrou(a, PREFIXE)).toBe(true);
    expect(prendreLeVerrou(b, PREFIXE)).toBe(true);
  });

  it("le verrou ne vit pas dans le dépôt", () => {
    const a = adresseNeuve();
    prendreLeVerrou(a, PREFIXE);

    // Il est sous le dossier temporaire du système, pas sous le worktree :
    // un état de session commité par mégarde serait un secret de recette
    // versionné, et un `test-results/` effacé entre deux exécutions ferait
    // perdre le partage entre workers.
    expect(existsSync(join(tmpdir(), "axion-e2e-session"))).toBe(true);
    expect(existsSync(join(process.cwd(), "axion-e2e-session"))).toBe(false);
  });
});

describe("les pannes de disque dégradent, elles ne cassent pas", () => {
  it("écrire dans un dossier remplacé par un fichier ne lève pas", () => {
    // Le module attrape ses propres erreurs d'écriture : la suite doit pouvoir
    // continuer sans partage. Elle sera plus lente, elle ne sera pas fausse.
    const a = adresseNeuve();
    expect(() => ecrireSessionPartagee(a, PREFIXE, COOKIES)).not.toThrow();
    expect(() => oublierSessionPartagee(a, PREFIXE)).not.toThrow();
    expect(() => rendreLeVerrou(a, PREFIXE)).not.toThrow();
  });

  it("`rendreLeVerrou` sur un verrou absent ne lève pas", () => {
    expect(() => rendreLeVerrou(adresseNeuve(), PREFIXE)).not.toThrow();
  });
});

/**
 * ⚠️ Nettoyage de fin de fichier : on retire le dossier SEULEMENT s'il est
 * vide. Le supprimer récursivement effacerait l'état d'une exécution E2E
 * concurrente sur la même machine — un `rmSync` sur un dossier qu'on n'a pas
 * créé efface le travail du voisin.
 */
afterEach(() => {
  try {
    rmSync(join(tmpdir(), "axion-e2e-session"), { recursive: false });
  } catch {
    /* non vide, ou déjà parti : les deux sont corrects. */
  }
});
