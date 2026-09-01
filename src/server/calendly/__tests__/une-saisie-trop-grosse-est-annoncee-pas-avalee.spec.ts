// @vitest-environment node

/**
 * Verrou — quand la reprise ne tient pas dans un cookie, on le DIT.
 *
 * ## Le contexte, en trois phrases
 *
 * Le formulaire n'envoie aucun JavaScript : après un refus, la saisie doit
 * voyager du POST vers le GET par un cookie (l'URL est exclue — un nom et un
 * e-mail n'ont rien à faire dans une adresse). Or un cookie plafonne à
 * 4 096 octets, et une réponse longue à une question ouverte peut à elle seule
 * dépasser ce budget.
 *
 * ## Les trois propriétés, par ordre d'importance
 *
 * **1. Les erreurs ne se sacrifient JAMAIS.** Sans elles, le visiteur retrouve
 * son formulaire tel quel, sans savoir ce qui a été refusé ni pourquoi. Un
 * formulaire qui revient identique et sans explication se lit comme un bouton
 * mort.
 *
 * **2. Ce qui est abandonné est NOMMÉ.** Un champ vide sans explication fait
 * croire à une perte de données ; un champ vide annoncé se retape. C'est la
 * différence entre une dégradation et une panne.
 *
 * **3. On sacrifie ce qui est fait pour être long.** Le nom, l'e-mail et le
 * créneau partent en dernier : ils sont les plus courts, et les plus coûteux à
 * retrouver — le créneau ne se retape même pas, il faut retourner au calendrier.
 *
 * ## L'appariement au créneau, et pourquoi il remplace une protection perdue
 *
 * Le premier jet croyait effacer le cookie à la lecture. C'était faux : une page
 * Next n'a pas le droit de muter un cookie, seulement de le lire. À défaut
 * d'effacement, la reprise porte le créneau auquel elle appartient — sinon une
 * reprise abandonnée se collerait sur la tentative suivante, et le visiteur
 * verrait les erreurs et les VALEURS d'un rendez-vous qui n'est plus le sien.
 */

import { describe, expect, it } from "vitest";

import {
  composerReprise,
  lireLaReprise,
  tailleDeLEnTete,
  REPRISE_TTL_SECONDES,
} from "../reprise-formulaire";

const CRENEAU = "2026-09-10T09:30:00.000Z";

const ERREURS = { q0: "Cette réponse est nécessaire.", email: "Cet e-mail semble incomplet." };

/** Une saisie normale, largement sous le budget. */
const PETITE = {
  debut: CRENEAU,
  nom: "Camille Prospect",
  email: "camille@",
  format: "visio",
  q0: "Un audit.",
};

/**
 * ⚠️ ON MESURE L'EN-TÊTE, PAS LE JSON.
 *
 * La première version de ce fichier recalculait `JSON.stringify` de son côté —
 * la même mesure que le code. Garde et chose gardée partageaient donc
 * l'instrument, et aucune des deux ne voyait `encodeURIComponent`, qui
 * MULTIPLIE la taille au lieu d'y ajouter une marge. Une réponse de 2 600
 * caractères passait les deux contrôles et se faisait refuser par le
 * navigateur, en silence.
 */
function octets(o: unknown): number {
  return tailleDeLEnTete(o);
}

describe("🔑 CONTRE-TÉMOIN — une saisie normale passe entière", () => {
  it("rien n'est abandonné, et tout est rendu", () => {
    // Sans lui, un `composerReprise` qui viderait TOUT ferait passer chaque
    // test de sacrifice ci-dessous pour la bonne raison apparente.
    const r = composerReprise(CRENEAU, ERREURS, PETITE);
    expect(r.abandonnes).toHaveLength(0);
    expect(r.valeurs).toEqual(PETITE);
    expect(r.erreurs).toEqual(ERREURS);
    expect(r.debut).toBe(CRENEAU);
  });
});

describe("🔴 une saisie trop grosse est annoncée, jamais avalée", () => {
  /** Une réponse de 6 000 caractères : au-dessus du budget à elle seule. */
  const ENORME = { ...PETITE, q0: "x".repeat(6_000) };

  it("la charge finit sous le plafond d'un cookie", () => {
    const r = composerReprise(CRENEAU, ERREURS, ENORME);
    expect(
      octets(r),
      "au-delà de 4 096 octets le navigateur REFUSE le cookie — et un cookie " +
        "refusé est un silence parfait : la redirection marche, le formulaire " +
        "revient vide, et rien ne le signale",
    ).toBeLessThan(4_096);
  });

  it("🔴 une réponse de 2 600 caractères tient — c'est elle qui débordait", () => {
    // Le cas EXACT qui passait sous l'ancienne mesure et se faisait refuser par
    // le navigateur : 2 963 octets de JSON, 4 189 d'en-tête. Sans encodage dans
    // la mesure, ni le code ni la garde ne le voyaient.
    const r = composerReprise(CRENEAU, ERREURS, { ...PETITE, q0: "x".repeat(2_600) });
    expect(octets(r)).toBeLessThan(4_096);
  });

  it("🔴 les ACCENTS comptent — un encodage coûte jusqu'à six octets par signe", () => {
    // Une réponse en français bien écrite est trois fois plus chère qu'un
    // remplissage en « x ». Mesurer sur des caractères ASCII donnerait une
    // fausse confiance exactement là où les vrais visiteurs écrivent.
    const r = composerReprise(CRENEAU, ERREURS, { ...PETITE, q0: "éàçù".repeat(600) });
    expect(octets(r)).toBeLessThan(4_096);
  });

  it("🔴 le champ sacrifié est NOMMÉ", () => {
    const r = composerReprise(CRENEAU, ERREURS, ENORME);
    expect(r.abandonnes).toContain("q0");
    expect(r.valeurs["q0"]).toBeUndefined();
  });

  it("🔴 les ERREURS survivent au sacrifice", () => {
    // La propriété la plus importante du fichier. Perdre les erreurs rendrait
    // au visiteur un formulaire identique et muet.
    const r = composerReprise(CRENEAU, ERREURS, ENORME);
    expect(r.erreurs).toEqual(ERREURS);
  });

  it("🔑 le nom, l'e-mail et le CRÉNEAU survivent — ils partent en dernier", () => {
    // Le créneau ne se retape pas : il faut retourner au calendrier et le
    // retrouver. Le sacrifier en premier serait exactement le mauvais ordre.
    const r = composerReprise(CRENEAU, ERREURS, ENORME);
    expect(r.valeurs["nom"]).toBe("Camille Prospect");
    expect(r.valeurs["email"]).toBe("camille@");
    expect(r.valeurs["debut"]).toBe(CRENEAU);
  });

  it("on ne sacrifie QUE ce qu'il faut, pas tout le reste par précaution", () => {
    // Vider tous les champs longs dès qu'un seul déborde serait plus simple à
    // écrire, et ferait retaper au visiteur des réponses parfaitement
    // conservables.
    const r = composerReprise(CRENEAU, ERREURS, { ...ENORME, q1: "Onze à deux cent cinquante" });
    expect(r.abandonnes).toEqual(["q0"]);
    expect(r.valeurs["q1"]).toBe("Onze à deux cent cinquante");
  });

  it("plusieurs champs énormes : on en sacrifie autant qu'il faut", () => {
    // ⚠️ Les tailles sont choisies pour qu'UN SEUL sacrifice ne suffise PAS.
    // Premier jet : 3 000 + 3 000 — retirer le premier ramenait déjà la charge
    // sous le budget, donc le test échouait en réclamant deux sacrifices là où
    // un seul était juste. Le code avait raison : il ne sacrifie que le
    // nécessaire, ce qui est exactement la propriété qu'assure le test
    // précédent. Une garde qui exige plus que le nécessaire ferait retaper au
    // visiteur des réponses parfaitement conservables.
    const r = composerReprise(CRENEAU, ERREURS, {
      ...PETITE,
      q0: "x".repeat(3_400),
      q1: "y".repeat(3_400),
    });
    expect(octets(r)).toBeLessThan(4_000);
    expect(r.abandonnes.length).toBe(2);
    expect(r.valeurs["nom"]).toBe("Camille Prospect");
  });
});

describe("la relecture ne fait jamais confiance au contenu", () => {
  it("un aller-retour conserve tout", () => {
    const r = composerReprise(CRENEAU, ERREURS, PETITE);
    expect(lireLaReprise(JSON.stringify(r))).toEqual(r);
  });

  it("un contenu illisible est ignoré, pas levé", () => {
    // Un cookie tronqué par un intermédiaire, ou laissé par une version
    // antérieure du code, ne doit pas casser la page.
    for (const brut of ["", "{", "null", "[]", '"texte"', '{"erreurs":42}']) {
      expect(() => lireLaReprise(brut)).not.toThrow();
    }
  });

  it("🔴 une reprise SANS créneau est rejetée", () => {
    // C'est le créneau qui remplace l'effacement impossible. Une charge qui
    // n'en porte pas viendrait d'une version antérieure du code — l'accepter
    // la collerait sur n'importe quelle tentative.
    expect(lireLaReprise(JSON.stringify({ erreurs: ERREURS, valeurs: PETITE }))).toBeNull();
  });

  it("les valeurs non textuelles sont écartées, pas converties", () => {
    // Une valeur numérique arrivant dans un `defaultValue` de champ texte
    // produirait un affichage inattendu ; l'écarter est plus sûr que la coercer.
    const r = lireLaReprise(
      JSON.stringify({ debut: CRENEAU, erreurs: {}, valeurs: { nom: 42, email: "a@b.fr" } }),
    );
    expect(r?.valeurs["nom"]).toBeUndefined();
    expect(r?.valeurs["email"]).toBe("a@b.fr");
  });
});

describe("le délai de vie", () => {
  it("🔑 reste court — c'est une saisie en transit, pas une sauvegarde", () => {
    // Le cookie n'est PAS effacé à la lecture (une page Next n'en a pas le
    // droit) : sa brièveté est donc la seconde moitié de la protection, avec
    // l'appariement au créneau. L'allonger « pour plus de confort » laisserait
    // traîner une saisie sur un appareil partagé.
    expect(REPRISE_TTL_SECONDES).toBeLessThanOrEqual(300);
    expect(REPRISE_TTL_SECONDES).toBeGreaterThanOrEqual(60);
  });
});
