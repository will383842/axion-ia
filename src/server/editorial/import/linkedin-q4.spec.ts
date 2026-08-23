/**
 * Console éditoriale — tests de l'analyse du dossier LinkedIn (§6).
 *
 * 🔑 Le protocole est explicite : « le test qui compte est celui du cas
 * refusé. Un test qui ne vérifie que le succès ne prouve rien : il passerait
 * aussi si la garde était supprimée. » Chaque conversion a donc son cas
 * refusé, et les pièges connus (BOM, CRLF, `;` dans une cellule, décalage de
 * fuseau) ont chacun leur test nommé.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  decouperCsv,
  lireCalendrier,
  lirePosts,
  convertirDate,
  convertirHeure,
  convertirTags,
  refImport,
  refImportEcho,
  construireLien,
  estVrai,
  normaliserFormat,
  DESTINATIONS,
} from "./linkedin-q4";

const DOSSIER_FIXTURE = path.join(process.cwd(), "tests", "fixtures", "editorial", "linkedin-q4");

function lireFixture(nom: string): string {
  return fs.readFileSync(path.join(DOSSIER_FIXTURE, nom), "utf8");
}

describe("decouperCsv", () => {
  it("retire le BOM UTF-8, sans quoi la première en-tête est illisible", () => {
    const avecBom = "﻿numero;date\r\n1;01/09/2026\r\n";
    const lignes = decouperCsv(avecBom);
    expect(lignes[0]![0]).toBe("numero");
    // Le cas refusé : sans retrait, l'en-tête vaudrait « ﻿numero » et
    // toute lecture par nom rendrait `undefined` — en silence.
    expect(lignes[0]![0]).not.toContain("﻿");
  });

  it("avale le CR de CRLF au lieu de le coller à la dernière cellule", () => {
    const lignes = decouperCsv("a;b\r\n1;2\r\n");
    expect(lignes[1]![1]).toBe("2");
    expect(lignes[1]![1]).not.toBe("2\r");
  });

  it("garde un « ; » à l'intérieur d'un champ cité", () => {
    const lignes = decouperCsv('a;b\n1;"gauche ; droite"\n');
    expect(lignes[1]).toHaveLength(2);
    expect(lignes[1]![1]).toBe("gauche ; droite");
  });

  it('rend un guillemet littéral pour un « "" » cité', () => {
    const lignes = decouperCsv('a\n"il a dit ""oui"""\n');
    expect(lignes[1]![0]).toBe('il a dit "oui"');
  });

  it("garde un saut de ligne à l'intérieur d'un champ cité", () => {
    const lignes = decouperCsv('a;b\n1;"deux\nlignes"\n');
    expect(lignes).toHaveLength(2);
    expect(lignes[1]![1]).toBe("deux\nlignes");
  });

  it("ignore les lignes entièrement vides", () => {
    const lignes = decouperCsv("a;b\n1;2\n\n;\n");
    expect(lignes).toHaveLength(2);
  });
});

describe("lireCalendrier", () => {
  it("lit la fixture et rend 61 lignes sans erreur", () => {
    const { lignes, erreurs } = lireCalendrier(lireFixture("02-calendrier-publication.csv"));
    expect(erreurs).toHaveLength(0);
    expect(lignes).toHaveLength(61);
    expect(lignes[0]!.numero).toBe("1");
    expect(lignes[0]!.date).toBe("01/09/2026");
  });

  it("compte 13 échos de page dans la fixture", () => {
    const { lignes } = lireCalendrier(lireFixture("02-calendrier-publication.csv"));
    expect(lignes.filter((l) => estVrai(l.echoPage))).toHaveLength(13);
  });

  it("compte 15 publications en septembre — le critère du lot 0", () => {
    const { lignes } = lireCalendrier(lireFixture("02-calendrier-publication.csv"));
    expect(lignes.filter((l) => l.date.endsWith("/09/2026"))).toHaveLength(15);
  });

  it("REFUSE un fichier auquel il manque une colonne", () => {
    expect(() => lireCalendrier("numero;date;heure\n1;01/09/2026;7h45\n")).toThrow(
      /Colonnes absentes/,
    );
  });

  it("REFUSE une ligne dont le numéro est vide, en la signalant", () => {
    const csv =
      "numero;date;heure;format;accroche;production;photo_will;lien;echo_page;tags;note\n" +
      ";01/09/2026;7h45;texte;a;;;;;#RGPD;\n";
    const { lignes, erreurs } = lireCalendrier(csv);
    expect(lignes).toHaveLength(0);
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0]!.ligne).toBe(2);
    expect(erreurs[0]!.motif).toMatch(/numero/);
  });
});

describe("lirePosts", () => {
  it("apparie les 61 sections de la fixture", () => {
    const posts = lirePosts(lireFixture("10-LES-61-POSTS.md"));
    expect(posts.size).toBe(61);
    expect(posts.get(1)?.corps).toBeTruthy();
    expect(posts.get(61)?.corps).toBeTruthy();
  });

  it("sépare le corps du premier commentaire", () => {
    const md = "## #1 — titre\n\nLe corps.\n\n### Premier commentaire\n\nLe commentaire.\n";
    const posts = lirePosts(md);
    expect(posts.get(1)?.corps).toBe("Le corps.");
    expect(posts.get(1)?.premierCommentaire).toBe("Le commentaire.");
  });

  it("laisse le commentaire vide quand la section n'en porte pas", () => {
    const posts = lirePosts("## #7\n\nSeulement un corps.\n");
    expect(posts.get(7)?.corps).toBe("Seulement un corps.");
    expect(posts.get(7)?.premierCommentaire).toBe("");
  });

  it("rend une table vide sur un fichier vide, sans lever", () => {
    expect(lirePosts("").size).toBe(0);
    expect(lirePosts("   \n").size).toBe(0);
  });
});

describe("convertirDate", () => {
  it("convertit JJ/MM/AAAA en date UTC", () => {
    const d = convertirDate("12/09/2026");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(8);
    expect(d.getUTCDate()).toBe(12);
  });

  it("🔴 ne décale PAS d'un jour, quel que soit le fuseau de la machine", () => {
    // Le piège : `new Date(2026, 8, 12)` construit à minuit LOCAL. Stocké en
    // colonne `@db.Date` depuis un fuseau UTC+2, le 12 redescend au 11 — et le
    // calendrier afficherait la veille. On vérifie donc la date UTC, la seule
    // qui parte en base.
    const d = convertirDate("01/09/2026");
    expect(d.toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  it("REFUSE une date illisible", () => {
    expect(() => convertirDate("2026-09-12")).toThrow(/illisible/);
    expect(() => convertirDate("")).toThrow(/illisible/);
    expect(() => convertirDate("12 septembre")).toThrow(/illisible/);
  });

  it("REFUSE un mois ou un jour hors bornes", () => {
    expect(() => convertirDate("12/13/2026")).toThrow(/mois hors bornes/);
    expect(() => convertirDate("32/01/2026")).toThrow(/jour hors bornes/);
  });

  it("REFUSE une date qui n'existe pas au calendrier", () => {
    expect(() => convertirDate("30/02/2026")).toThrow(/inexistante/);
    expect(() => convertirDate("31/04/2026")).toThrow(/inexistante/);
  });
});

describe("convertirHeure", () => {
  it("convertit les écritures rencontrées", () => {
    expect(convertirHeure("7h45")).toBe("07:45");
    expect(convertirHeure("07h45")).toBe("07:45");
    expect(convertirHeure("7:45")).toBe("07:45");
    expect(convertirHeure("18h00")).toBe("18:00");
    expect(convertirHeure("7h")).toBe("07:00");
    expect(convertirHeure(" 8h30 ")).toBe("08:30");
  });

  it("REFUSE une heure illisible ou hors bornes", () => {
    expect(() => convertirHeure("midi")).toThrow(/illisible/);
    expect(() => convertirHeure("")).toThrow(/illisible/);
    expect(() => convertirHeure("25h00")).toThrow(/heures hors bornes/);
    expect(() => convertirHeure("7h99")).toThrow(/minutes hors bornes/);
  });
});

describe("convertirTags", () => {
  it("retire le croisillon et garde l'ordre", () => {
    expect(convertirTags("#IAPourPME #RGPD #AIAct")).toEqual(["IAPourPME", "RGPD", "AIAct"]);
  });

  it("accepte la virgule et les espaces multiples", () => {
    expect(convertirTags("#RGPD,  #AIAct")).toEqual(["RGPD", "AIAct"]);
  });

  it("rend un tableau vide sur une cellule vide", () => {
    expect(convertirTags("")).toEqual([]);
    expect(convertirTags("   ")).toEqual([]);
  });
});

describe("refImport", () => {
  it("préfixe et complète sur deux chiffres, comme le §6", () => {
    expect(refImport(4)).toBe("linkedin-2026-q4-04");
    expect(refImport("4")).toBe("linkedin-2026-q4-04");
    expect(refImport(61)).toBe("linkedin-2026-q4-61");
  });

  it("dérive l'écho du numéro d'origine, rattachable à vue d'œil", () => {
    expect(refImportEcho(4)).toBe("linkedin-2026-q4-04-echo");
  });

  it("REFUSE un numéro illisible", () => {
    expect(() => refImport("abc")).toThrow(/illisible/);
  });
});

describe("construireLien", () => {
  it("pose les quatre UTM exigés par la règle « utm »", () => {
    const { url } = construireLien("reservation", "q4-2026", "linkedin-2026-q4-04");
    expect(url).toBeTruthy();
    const u = new URL(url as string);
    expect(u.searchParams.get("utm_source")).toBe("linkedin");
    expect(u.searchParams.get("utm_medium")).toBe("social");
    expect(u.searchParams.get("utm_campaign")).toBe("q4-2026");
    expect(u.searchParams.get("utm_content")).toBe("linkedin-2026-q4-04");
  });

  it("vise la vraie route de réservation, pas une URL inventée", () => {
    expect(DESTINATIONS.reservation).toBe("https://axion-ia.com/fr/appel");
    expect(DESTINATIONS.candidature).toBe("https://axion-ia.com/fr/carrieres");
  });

  it("rend un lien vide, sans avertissement, quand la cellule est vide", () => {
    expect(construireLien("", "q4-2026", "x")).toEqual({ url: null, avertissement: null });
  });

  it("🔴 REFUSE d'inventer une URL pour une destination inconnue", () => {
    // `newsletter` est le cas réel : le compte n°9 est « à créer », aucune
    // route ne lui correspond. Inventer une URL rendrait la règle `utm` verte
    // sur une page qui n'existe pas — une garde qui ne garde rien.
    const { url, avertissement } = construireLien("newsletter", "q4-2026", "x");
    expect(url).toBeNull();
    expect(avertissement).toMatch(/inconnue/);
  });
});

describe("estVrai", () => {
  it("reconnaît les écritures affirmatives du CSV", () => {
    for (const v of ["oui", "OUI", "x", "1", "true", " yes "]) {
      expect(estVrai(v)).toBe(true);
    }
  });

  it("🔴 REFUSE « non » — que `Boolean(cellule)` rendrait vrai", () => {
    // Le piège exact : `Boolean("non")` vaut `true`. Une lecture naïve
    // créerait un asset pour chacune des 61 lignes.
    expect(estVrai("non")).toBe(false);
    expect(estVrai("NON")).toBe(false);
    expect(estVrai("")).toBe(false);
    expect(estVrai("  ")).toBe(false);
    expect(estVrai("0")).toBe(false);
  });
});

describe("normaliserFormat", () => {
  it("aplanit casse, accents et espaces", () => {
    expect(normaliserFormat("  Vidéo  Courte ")).toBe("video courte");
    expect(normaliserFormat("CARROUSEL")).toBe("carrousel");
  });
});
