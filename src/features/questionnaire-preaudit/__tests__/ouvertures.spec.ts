// @vitest-environment node
/**
 * Suivi des ouvertures et de l'avancée du questionnaire avant audit (2026-10-27) — partie PURE :
 * interrupteurs (absent = éteint), robots écartés, dédoublonnage à 30 min, calcul de l'avancée,
 * affichage d'un questionnaire jamais ouvert / ouvert non commencé / commencé, notice et balise.
 */

import { describe, expect, it } from "vitest";

import { codeDirigeantPreaudit } from "@/server/visio/questionnaire-en-ligne/jeton";

import { ajoutsSuivi, scriptBaliseOuverture } from "../balise-ouverture";
import { pagePourClient } from "../html";
import { PHRASE_BROUILLON, PHRASE_OUVERTURES, phrasesNoticeSuivi } from "../notice-suivi";
import {
  avanceeDuBrouillon,
  brouillonVisible,
  champsDuBrouillon,
  estRobot,
  FENETRE_DEDOUBLONNAGE_MS,
  lignesSuivi,
  personneDeLOuverture,
  prochaineOuverture,
  resumeBandeau,
  suiviOuverturesActif,
  TEXTE_SANS_BROUILLON,
  validerSignal,
  type SuiviOuvertures,
} from "../ouvertures";
import { validerBrouillon } from "../brouillon";
import { AUCUN_LIBELLE } from "../libelles";

const QID = "00000000-0000-4000-8000-000000000001";
const CODE = "a1b2c3d4e5f6";
const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

describe("les interrupteurs : absent = éteint", () => {
  it.each([
    [undefined, false],
    ["", false],
    ["false", false],
    ["TRUE", false],
    ["1", false],
    ["true", true],
  ])("QUESTIONNAIRE_SUIVI_OUVERTURES_ENABLED=%s → %s", (v, attendu) => {
    expect(suiviOuverturesActif({ QUESTIONNAIRE_SUIVI_OUVERTURES_ENABLED: v })).toBe(attendu);
    expect(brouillonVisible({ QUESTIONNAIRE_SUIVI_BROUILLON_VISIBLE: v })).toBe(attendu);
  });
  it("les deux sont indépendants", () => {
    expect(brouillonVisible({ QUESTIONNAIRE_SUIVI_OUVERTURES_ENABLED: "true" })).toBe(false);
    expect(suiviOuverturesActif({ QUESTIONNAIRE_SUIVI_BROUILLON_VISIBLE: "true" })).toBe(false);
  });
});

describe("les robots sont ignorés", () => {
  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0 Safari/537.36",
    "Microsoft Office Word 2014 (Microsoft Office Word; ms-office)",
    "Mozilla/5.0 Mimecast URL Protect",
    "python-requests/2.31.0 and a few more characters",
    "curl/8.4.0 and a few more characters here",
    "",
    "Mozilla/5.0",
  ])("%s", (ua) => {
    expect(estRobot(ua)).toBe(true);
  });
  it("un vrai navigateur passe, même un téléphone Cubot", () => {
    expect(estRobot(CHROME)).toBe(false);
    expect(
      estRobot(
        "Mozilla/5.0 (Linux; Android 12; CUBOT X50) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
      ),
    ).toBe(false);
    expect(estRobot(null)).toBe(true);
  });
});

describe("le signal de la page", () => {
  const corps = (o: Record<string, unknown>) =>
    JSON.stringify({ m: "", s: "", etape: 1, t: 3500, ...o });

  it("une page qui se signale avant 3 s n'est pas comptée", () => {
    expect(validerSignal(corps({ t: 200 }), QID)).toEqual({ ok: false, motif: "trop_tot" });
    expect(validerSignal(corps({ t: "5000" }), QID).ok).toBe(false);
  });
  it("étape 1 ou 2 seulement, corps lisible", () => {
    expect(validerSignal(corps({ etape: 3 }), QID).ok).toBe(false);
    expect(validerSignal("pas du json", QID).ok).toBe(false);
  });
  it("le code du lien identifie la personne, comme le brouillon", () => {
    const dir = codeDirigeantPreaudit(QID) as string;
    expect(personneDeLOuverture(QID, "", dir)).toEqual({ mode: "main", membre: "" });
    expect(personneDeLOuverture(QID, "1", CODE)).toEqual({ mode: "emp", membre: CODE });
    expect(personneDeLOuverture(QID, "2", CODE)).toEqual({ mode: "it", membre: CODE });
    expect(personneDeLOuverture(QID, "", CODE)).toEqual({ mode: "perso", membre: CODE });
    expect(personneDeLOuverture(QID, "", "")).toEqual({ mode: "lien", membre: "" });
    expect(personneDeLOuverture(QID, "", "dirigeant")).toBeNull();
    // Le dirigeant d'un AUTRE questionnaire n'est pas le dirigeant de celui-ci.
    const autre = codeDirigeantPreaudit("00000000-0000-4000-8000-000000000002") as string;
    expect(personneDeLOuverture(QID, "", autre)?.mode).toBe("perso");
  });
});

describe("dédoublonnage : plusieurs rechargements en moins de 30 min = une ouverture", () => {
  const t0 = new Date("2026-10-27T08:00:00Z");
  const plus = (ms: number) => new Date(t0.getTime() + ms);

  it("première ouverture", () => {
    expect(prochaineOuverture(null, 1, t0)).toEqual({
      nombre: 1,
      derniereOuverture: t0,
      derniereEtapeAtteinte: 1,
      nouvelle: true,
    });
  });
  it("rechargé 10 min puis 25 min plus tard : toujours une seule ouverture", () => {
    const a = prochaineOuverture(null, 1, t0);
    const b = prochaineOuverture(a, 1, plus(10 * 60_000));
    const c = prochaineOuverture(b, 1, plus(35 * 60_000));
    expect([b.nombre, c.nombre]).toEqual([1, 1]);
    expect(c.nouvelle).toBe(false);
  });
  it("après 30 min de silence : une ouverture de plus", () => {
    const a = prochaineOuverture(null, 1, t0);
    const b = prochaineOuverture(a, 1, plus(FENETRE_DEDOUBLONNAGE_MS));
    expect(b).toMatchObject({ nombre: 2, nouvelle: true });
    expect(prochaineOuverture(a, 1, plus(FENETRE_DEDOUBLONNAGE_MS - 1)).nombre).toBe(1);
  });
  it("l'étape ne redescend jamais, la date ne recule jamais", () => {
    const a = prochaineOuverture(null, 2, t0);
    const b = prochaineOuverture(a, 1, plus(-60_000));
    expect(b.derniereEtapeAtteinte).toBe(2);
    expect(b.derniereOuverture).toEqual(t0);
  });
});

describe("calcul de l'avancée d'un brouillon", () => {
  const questions = new Set(["ent_nom", "ent_ville", "org_note", "vis_auto"]);

  it("compte les réponses remplies sur les questions du fichier", () => {
    const b = JSON.stringify({
      data: { ent_nom: "Exemple", ent_ville: "  ", org_note: 3, vis_auto: [], view: "x" },
      view: 2,
    });
    expect(avanceeDuBrouillon(b, questions)).toEqual({ remplies: 2, total: 4, pourcentage: 50 });
  });
  it("une liste ou un objet remplis comptent, une case décochée non", () => {
    const b = JSON.stringify({ data: { vis_auto: ["Devis"], ent_nom: false } });
    expect(avanceeDuBrouillon(b, questions)?.remplies).toBe(1);
  });
  it("sans questions connues : le nombre seul, sans pourcentage inventé", () => {
    const b = JSON.stringify({ data: { a: "x", b: "y" } });
    expect(avanceeDuBrouillon(b, new Set())).toEqual({
      remplies: 2,
      total: null,
      pourcentage: null,
    });
  });
  it("jamais plus de 100 %, brouillon illisible = null", () => {
    const b = JSON.stringify({
      data: { ent_nom: "a", ent_ville: "b", org_note: 1, vis_auto: ["c"] },
    });
    expect(avanceeDuBrouillon(b, new Set(["ent_nom"]))?.pourcentage).toBe(100);
    expect(avanceeDuBrouillon("{pas du json", questions)).toBeNull();
  });
  it("le contenu lu pour Will : les champs remplis, avec un libellé", () => {
    const champs = champsDuBrouillon(
      JSON.stringify({ data: { ent_nom: "Exemple", org_reunions: ["Point", "Revue"], vide: "" } }),
      AUCUN_LIBELLE,
      "main",
    );
    expect(champs).toEqual([
      { cle: "ent_nom", libelle: "Entreprise : nom", valeur: "Exemple" },
      { cle: "org_reunions", libelle: "Organisation : reunions", valeur: "Point ; Revue" },
    ]);
  });
});

describe("pas de brouillon sans accord", () => {
  it("le serveur refuse tout brouillon sans `consent: true` : rien à lire ni à compter", () => {
    const corps = JSON.stringify({
      horodatage: Date.now(),
      mode: "emp",
      membre: CODE,
      brouillon: "x",
    });
    expect(validerBrouillon(corps, QID)).toEqual({ ok: false, motif: "consentement_requis" });
    expect(validerBrouillon(corps.replace("{", '{"consent":false,'), QID).ok).toBe(false);
  });
  it("sans brouillon, la console ne prétend pas que la personne n'a pas ouvert", () => {
    const l = lignesSuivi({
      ouvertures: [ouverture({ mode: "main", membre: "", nombre: 2, derniereEtapeAtteinte: 2 })],
      brouillons: [],
    });
    expect(l[0]?.texte).toContain("ouvert 2 fois");
    expect(l[0]?.texte).toContain(TEXTE_SANS_BROUILLON);
  });
});

const T1 = new Date("2026-10-26T08:00:00Z");
const T2 = new Date("2026-10-27T16:30:00Z");
function ouverture(o: Partial<SuiviOuvertures["ouvertures"][number]>) {
  return {
    mode: "main",
    membre: "",
    premiereOuverture: T1,
    derniereOuverture: T2,
    nombre: 1,
    derniereEtapeAtteinte: 1,
    ...o,
  };
}

describe("ce que la fiche affiche", () => {
  it("questionnaire jamais ouvert", () => {
    const s: SuiviOuvertures = { ouvertures: [], brouillons: [] };
    expect(lignesSuivi(s)).toEqual([]);
    expect(resumeBandeau(s)).toBe("jamais ouvert");
  });

  it("ouvert, non commencé (page d'accueil seulement)", () => {
    const s: SuiviOuvertures = {
      ouvertures: [ouverture({ nombre: 3 })],
      brouillons: [],
    };
    const [l] = lignesSuivi(s);
    expect(l?.personne).toBe("Dirigeant");
    expect(l?.texte).toMatch(
      /^ouvert 3 fois \(première le 26\/10 à 09:00, dernière le 27\/10 à 17:30\)/,
    );
    expect(l?.texte).toContain("n'a vu que la page d'accueil");
    expect(l?.texte).toContain(TEXTE_SANS_BROUILLON);
    expect(l?.brouillonId).toBeNull();
    expect(resumeBandeau(s)).toBe("ouvert 3 fois, dernière fois le 27 oct.");
  });

  it("commencé : brouillon avec avancée, une ligne par personne", () => {
    const s: SuiviOuvertures = {
      ouvertures: [
        ouverture({ nombre: 1, derniereEtapeAtteinte: 2 }),
        ouverture({ mode: "perso", membre: CODE, derniereOuverture: T1 }),
      ],
      brouillons: [
        {
          id: "b1",
          mode: "main",
          membre: "",
          majLe: T2,
          avancee: { remplies: 12, total: 80, pourcentage: 15 },
        },
        {
          id: "b2",
          mode: "emp",
          membre: CODE,
          majLe: T1,
          avancee: { remplies: 3, total: 80, pourcentage: 4 },
        },
      ],
    };
    const l = lignesSuivi(s);
    expect(l.map((x) => x.personne)).toEqual(["Dirigeant", "Collaborateur …e5f6"]);
    expect(l[0]?.texte).toBe(
      "ouvert 1 fois, le 26/10 à 09:00 · a commencé à répondre · brouillon enregistré le 27/10 à 17:30 : 12 réponses remplies sur 80 questions (15 %)",
    );
    expect(l[0]?.brouillonId).toBe("b1");
    expect(resumeBandeau(s)).toBe("ouvert 2 fois, dernière fois le 27 oct. · commencé (15 %)");
  });

  it("un brouillon d'avant l'activation n'est jamais lu comme « jamais ouvert »", () => {
    const s: SuiviOuvertures = {
      ouvertures: [],
      brouillons: [{ id: "b", mode: "main", membre: "", majLe: T1, avancee: null }],
    };
    expect(lignesSuivi(s)[0]?.texte).toContain("ouverture non notée");
    expect(lignesSuivi(s)[0]?.texte).toContain("contenu illisible");
    expect(resumeBandeau(s)).toBe("ouverture non notée · commencé");
  });
});

describe("la notice et la balise de la page", () => {
  const HTML =
    "<!doctype html><html><body><script>const CONFIG = {\n  schema: 3,\n};</script></body></html>";
  const opts = {
    endpoint: "/api/x",
    client: "",
    contact: "c@x.fr",
    conservation: "5 ans",
    essai: false,
  };

  it("interrupteurs éteints : la page de Will est servie comme avant", () => {
    const fin = ajoutsSuivi({
      endpoint: null,
      titre: "T",
      phrases: phrasesNoticeSuivi({ ouvertures: false, brouillon: false }),
    });
    expect(fin).toBe("");
    expect(pagePourClient(HTML, { ...opts, finDePage: fin })).toBe(pagePourClient(HTML, opts));
  });

  it("chaque interrupteur ajoute SA phrase, et rien d'autre", () => {
    expect(phrasesNoticeSuivi({ ouvertures: true, brouillon: false })).toEqual([PHRASE_OUVERTURES]);
    expect(phrasesNoticeSuivi({ ouvertures: false, brouillon: true })).toEqual([PHRASE_BROUILLON]);
  });

  it("la balise attend le chargement, la visibilité et 3 s ; aucun cookie, aucun stockage, aucun tiers", () => {
    const s = scriptBaliseOuverture("/api/questionnaire-preaudit/x/y/ouverture");
    expect(s).toContain("addEventListener('load'");
    expect(s).toContain("visibilityState");
    expect(s).toContain("D=3000");
    expect(s).toContain("navigator.webdriver");
    expect(s).not.toMatch(/cookie|localStorage|sessionStorage|https?:\/\//);
    expect(s.length).toBeLessThan(1500);
  });

  it("la notice est insérée avant le dernier </body>, échappée", () => {
    const fin = ajoutsSuivi({ endpoint: "/e", titre: "A <b>", phrases: ["x & y"] });
    const page = pagePourClient(HTML, { ...opts, finDePage: fin });
    expect(page).toContain("A &lt;b&gt;");
    expect(page).toContain("x &amp; y");
    expect(page.indexOf("<aside")).toBeLessThan(page.lastIndexOf("</body>"));
  });
});
