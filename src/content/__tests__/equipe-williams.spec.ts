/**
 * Gardes de la fiche d'autorité `/fr/equipe/williams`.
 *
 * Trois choses peuvent casser cette page sans qu'aucun outil existant ne
 * rougisse, et ce fichier existe pour chacune :
 *
 *  1. UN LIEN INTERNE MORT. Le rendu passe les `href` des cartes métier à
 *     `<Link href={… as never}>` — le `as never` est nécessaire parce que les
 *     chemins viennent d'une liste de données, mais il DÉSARME le typage des
 *     routes. Un slug mal orthographié compilerait, se déploierait, et
 *     n'enverrait le visiteur qu'à un 404. On revérifie donc ici, contre la
 *     vraie table `routing.pathnames`.
 *  2. UNE MENTION DE FINANCEMENT ÉMISE TROP TÔT. Afficher « finançable OPCO »
 *     avant la délivrance du certificat Qualiopi est illégal
 *     (`server/qualiopi/config/flag.ts`). La FAQ est gatée ; le test le prouve
 *     dans les deux positions du drapeau, pas seulement dans la position
 *     courante — un test qui n'exerce que l'état actuel ne garde rien.
 *  3. UN GRAPHE D'ENTITÉ QUI NE SE REJOINT PAS. Le `ProfilePage` ne décrit pas
 *     la personne : il la CITE par `@id`. Si les deux chaînes divergent, on
 *     publie deux moitiés d'entité au lieu d'une.
 */

import { describe, it, expect } from "vitest";

import { routing } from "@/i18n/routing";
import { FOUNDER_PERSON_ID } from "@/lib/brand";
import {
  WILLIAMS_EXPERTISES,
  WILLIAMS_IDENTITE,
  WILLIAMS_LEAD,
  buildWilliamsFaq,
} from "@/content/equipe/williams";
import {
  buildPersonWilliamsJsonLd,
  buildProfilePageWilliamsJsonLd,
} from "@/lib/seo/williams-person";

const CHEMINS_DECLARES = new Set(Object.keys(routing.pathnames));

describe("fiche fondateur — liens internes", () => {
  const cibles = WILLIAMS_EXPERTISES.flatMap((e) =>
    [e.href, e.hrefSecondaire].filter((h): h is string => typeof h === "string"),
  );

  it("chaque carte métier pointe une route réellement déclarée", () => {
    expect(cibles.length).toBeGreaterThan(0);
    const orphelins = cibles.filter((href) => !CHEMINS_DECLARES.has(href));
    expect(orphelins, `chemins absents de routing.pathnames : ${orphelins.join(", ")}`).toEqual([]);
  });

  it("chaque carte porte au moins un lien sortant libellé", () => {
    for (const e of WILLIAMS_EXPERTISES) {
      expect(e.href, `${e.id} sans href`).toBeTruthy();
      expect(e.hrefLabel.length, `${e.id} sans libellé de lien`).toBeGreaterThan(0);
    }
  });
});

describe("fiche fondateur — doctrine financement", () => {
  it("aucune mention OPCO / France Travail tant que le certificat n'est pas délivré", () => {
    const faq = buildWilliamsFaq({ certificationObtenue: false });
    const texte = faq
      .map((q) => `${q.question} ${q.answer}`)
      .join(" ")
      .toLowerCase();
    for (const interdit of ["opco", "france travail", "qualiopi", "cpf", "finançable"]) {
      expect(texte, `« ${interdit} » émis en phase non certifiée`).not.toContain(interdit);
    }
  });

  it("la Q/R financement apparaît dès que le certificat est délivré", () => {
    const faq = buildWilliamsFaq({ certificationObtenue: true });
    expect(faq.some((q) => q.id === "financement")).toBe(true);
  });

  it("le reste de la FAQ est identique dans les deux états", () => {
    const sans = buildWilliamsFaq({ certificationObtenue: false }).map((q) => q.id);
    const avec = buildWilliamsFaq({ certificationObtenue: true }).map((q) => q.id);
    expect(avec.filter((id) => id !== "financement")).toEqual(sans);
  });
});

describe("fiche fondateur — graphe d'entité", () => {
  it("le ProfilePage cite le MÊME `@id` que le nœud Person", () => {
    const person = buildPersonWilliamsJsonLd("fr");
    const page = buildProfilePageWilliamsJsonLd();
    expect(person["@id"]).toBe(FOUNDER_PERSON_ID);
    expect((page.mainEntity as { "@id": string })["@id"]).toBe(FOUNDER_PERSON_ID);
    expect((page.about as { "@id": string })["@id"]).toBe(FOUNDER_PERSON_ID);
  });

  it("le Person renvoie vers le ProfilePage, et réciproquement", () => {
    const person = buildPersonWilliamsJsonLd("fr");
    const page = buildProfilePageWilliamsJsonLd();
    expect((person.mainEntityOfPage as { "@id": string })["@id"]).toBe(page["@id"]);
  });

  it("la description structurée est la réponse-première affichée, pas une variante", () => {
    // Deux textes pour la même question, l'un dans le HTML et l'autre dans le
    // schema, c'est la divergence qui finit par se voir en SERP.
    expect(buildPersonWilliamsJsonLd("fr").description).toBe(WILLIAMS_LEAD);
    expect(buildProfilePageWilliamsJsonLd().description).toBe(WILLIAMS_LEAD);
  });
});

describe("fiche fondateur — fiche d'identité", () => {
  it("n'annonce aucun identifiant de registre tant que `content/legal.ts` ne le porte pas", () => {
    // Un SIREN inventé sur une page d'entité est pire qu'un SIREN absent : c'est
    // le champ que Google rapproche des registres publics.
    const texte = WILLIAMS_IDENTITE.map((l) => `${l.terme} ${l.valeur}`).join(" ");
    expect(texte).not.toMatch(/\bSIREN\b|\bSIRET\b|\bRCS\b|\bTVA\b/i);
    expect(texte).not.toMatch(/\b\d{9}\b|\b\d{14}\b/);
  });

  it("chaque ligne porte un terme ET une valeur non vides", () => {
    for (const ligne of WILLIAMS_IDENTITE) {
      expect(ligne.terme.trim().length).toBeGreaterThan(0);
      expect(ligne.valeur.trim().length).toBeGreaterThan(0);
    }
  });
});
