import { describe, expect, it } from "vitest";
import { messageValide } from "@/server/content-gen/equipe/charge-de-liens";
import {
  BROUILLON_MAX,
  MENTION_INFORMATION,
  avecMentionInformation,
  controlerBrouillon,
} from "../brouillon";

const URL_PAGE = "https://axion-ia.com/fr/blog/ia-pme";
const BON = `Bonjour, nous avons publié un article qui peut intéresser vos lecteurs. Vous pouvez le consulter ici : ${URL_PAGE}. Cordialement.`;

describe("controlerBrouillon", () => {
  it("accepte un texte sobre, vouvoyé, avec la seule URL proposée", () => {
    expect(controlerBrouillon(BON, URL_PAGE)).toEqual({ valide: true, motifs: [] });
  });
  it("refuse un texte vide, trop long, ou sans l'URL proposée", () => {
    expect(controlerBrouillon("  ", URL_PAGE).motifs).toContain("vide");
    expect(controlerBrouillon(`${BON} ${"a".repeat(BROUILLON_MAX)}`, URL_PAGE).motifs).toContain(
      "trop_long",
    );
    expect(
      controlerBrouillon("Bonjour, voici notre article. Cordialement.", URL_PAGE).motifs,
    ).toContain("url_absente");
  });
  it("refuse une seconde URL", () => {
    const r = controlerBrouillon(`${BON} Voir aussi https://exemple.fr/autre`, URL_PAGE);
    expect(r.valide).toBe(false);
    expect(r.motifs).toContain("autre_url");
  });
  it.each([
    ["un prix", "Cette offre est à 500 € seulement."],
    ["le mot prix", "Nos prix sont bas."],
    ["un pourcentage", "Gagnez 30% de trafic."],
    ["une promesse", "Nous garantissons un résultat."],
    ["un échange", "Proposons un échange de liens."],
    ["backlink", "Un backlink serait apprécié."],
    ["un achat", "Nous pouvons acheter ce lien."],
    ["sponsoring", "Un lien sponsorisé ?"],
    ["la ville du siège", "Notre équipe de Grenoble vous écrit."],
  ])("refuse %s", (_nom, ajout) => {
    const r = controlerBrouillon(`${BON} ${ajout}`, URL_PAGE);
    expect(r.valide).toBe(false);
  });
  it("refuse le tutoiement", () => {
    expect(controlerBrouillon(`${BON} Tu peux le lire, toi aussi.`, URL_PAGE).motifs).toContain(
      "tutoiement",
    );
  });
  it("ne déclenche pas les motifs à cause de l'URL elle-même (slug)", () => {
    const url = "https://axion-ia.com/fr/blog/prix-et-achat-ia";
    const texte = `Bonjour, voici notre article : ${url}. Cordialement.`;
    expect(controlerBrouillon(texte, url).valide).toBe(true);
  });
  it("refuse la ville du siège même dans l'URL proposée ou déguisée", () => {
    const url = "https://axion-ia.com/fr/ingenieur-ia/grenoble";
    expect(controlerBrouillon(`Bonjour, voici : ${url}. Cordialement.`, url).valide).toBe(false);
    expect(controlerBrouillon(`${BON} Grenóble`, URL_PAGE).valide).toBe(false);
    expect(controlerBrouillon(`${BON} Gre\u00adnoble`, URL_PAGE).valide).toBe(false);
    expect(controlerBrouillon(`${BON} \uff27renoble`, URL_PAGE).valide).toBe(false);
  });
  it.each(["ftp://evil.fr/x", "//evil.fr/x", "evil.paris", "evil.bzh", "evil.studio"])(
    "refuse une autre adresse : %s",
    (u) => {
      expect(controlerBrouillon(`${BON} ${u}`, URL_PAGE).motifs).toContain("autre_url");
    },
  );
  it("va dans le même sens que messageValide du chargé de liens", () => {
    const corpus = [
      BON,
      `${BON} Tarifs sur demande.`,
      `${BON} Un échange ?`,
      `${BON} https://exemple.fr/x`,
      `${BON} Tu peux regarder, toi, ton avis compte, tes idées aussi.`,
      "Sans lien",
    ];
    for (const t of corpus) {
      expect(controlerBrouillon(t, URL_PAGE).valide).toBe(messageValide(t, URL_PAGE));
    }
  });
});

describe("adresse nominative : mention d'information (RGPD art. 14)", () => {
  it("exige la mention quand le destinataire est nominatif", () => {
    const sans = controlerBrouillon(BON, URL_PAGE, { nominatif: true });
    expect(sans.valide).toBe(false);
    expect(sans.motifs).toContain("mention_absente");
    const avec = controlerBrouillon(avecMentionInformation(BON), URL_PAGE, { nominatif: true });
    expect(avec).toEqual({ valide: true, motifs: [] });
  });
  it("n'exige pas la mention pour un canal d'organisation", () => {
    expect(controlerBrouillon(BON, URL_PAGE, { nominatif: false }).valide).toBe(true);
  });
  it("la mention est une phrase d'information et d'opposition, sans URL, qui tient dans la limite", () => {
    expect(MENTION_INFORMATION).toMatch(/opposer|opposition/i);
    expect(MENTION_INFORMATION).not.toMatch(/https?:/);
    expect(avecMentionInformation(BON).length).toBeLessThanOrEqual(BROUILLON_MAX);
    expect(avecMentionInformation(avecMentionInformation(BON))).toBe(avecMentionInformation(BON));
  });
});

describe("contournements fermés", () => {
  it("refuse une URL attendue vide", () => {
    expect(controlerBrouillon("Bonjour, cordialement.", "").motifs).toContain("url_absente");
  });
  it("refuse une seconde adresse sans schéma", () => {
    expect(controlerBrouillon(`${BON} Voir www.autre-site.fr`, URL_PAGE).motifs).toContain(
      "autre_url",
    );
  });
  it("refuse un montant en sigle", () => {
    expect(controlerBrouillon(`${BON} Soit 500 EUR.`, URL_PAGE).valide).toBe(false);
  });
  it("ne prend pas « têtu » pour du tutoiement", () => {
    expect(controlerBrouillon(`${BON} Nous sommes têtus.`, URL_PAGE).motifs).not.toContain(
      "tutoiement",
    );
  });
});

describe("adresses sans schéma", () => {
  it("refuse « autre-site.fr/page »", () => {
    expect(controlerBrouillon(`${BON} Visitez autre-site.fr/page`, URL_PAGE).motifs).toContain(
      "autre_url",
    );
  });
});

describe("tour 3 : adresses sans schéma, tout domaine", () => {
  it.each(["www.autre-site.de", "WWW.AUTRE.DE", "bit.ly/abc", "exemple.dev", "site.uk/x"])(
    "refuse %s",
    (a) => {
      expect(controlerBrouillon(`${BON} Voir ${a}`, URL_PAGE).motifs).toContain("autre_url");
    },
  );
});

describe("tour 5 : faux refus et déguisements", () => {
  it.each([
    "Nous utilisons Node.js au quotidien.",
    "Plus d'informations sur axion-ia.com.",
    "Sur un ton neutre, suite à nos échanges.",
    "Un projet prometteur, une formation garantie par Qualiopi n'est pas notre propos.",
    "Will Dupont, will.dupont@exemple.fr",
  ])("accepte : %s", (ajout) => {
    const r = controlerBrouillon(`${BON} ${ajout}`, URL_PAGE);
    expect(r.motifs).not.toContain("autre_url");
    expect(r.motifs).not.toContain("tutoiement");
    expect(r.motifs).not.toContain("echange");
  });
  it("accepte l'URL proposée suivie de ! ou entre guillemets", () => {
    expect(controlerBrouillon(`Voici : ${URL_PAGE}! Cordialement.`, URL_PAGE).valide).toBe(true);
    expect(controlerBrouillon(`Voici : "${URL_PAGE}" Cordialement.`, URL_PAGE).valide).toBe(true);
  });
  it.each(["G r e n o b l e", "gre-noble", "G.r.e.n.o.b.l.e"])("refuse la ville : %s", (v) => {
    expect(controlerBrouillon(`${BON} ${v}`, URL_PAGE).valide).toBe(false);
  });
  it("refuse toujours un échange de liens et une garantie", () => {
    expect(controlerBrouillon(`${BON} Un échange de liens ?`, URL_PAGE).valide).toBe(false);
    expect(controlerBrouillon(`${BON} Résultat garanti.`, URL_PAGE).valide).toBe(false);
  });
});

describe("tour 6", () => {
  it("refuse le gentilé et les faux domaines d'Axion IA", () => {
    expect(controlerBrouillon(`${BON} Entreprises grenobloises.`, URL_PAGE).valide).toBe(false);
    for (const u of ["axion-ia.com.evil.fr/x", "monsite-axion-ia.com", "café.fr"]) {
      expect(controlerBrouillon(`${BON} Voir ${u}`, URL_PAGE).motifs).toContain("autre_url");
    }
  });
});
