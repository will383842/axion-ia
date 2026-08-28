// La durée annoncée de l'appel de découverte est-elle cohérente partout ?
//
// ## Le défaut que ce fichier empêche de revenir
//
// Mesuré le 2026-08-27, au navigateur, sur la page de conversion.
//
// L'event-type Calendly durait **45 minutes** — badge « 45 min », créneau
// « 10:00 – 10:45 ». Le site annonçait **30** à trente-six endroits, dont la
// pastille de réassurance de `/appel`, deux blocs de données structurées déjà
// indexés, et le contenu destiné aux moteurs de réponse.
//
// Pire : la description de l'event-type, écrite par nous et affichée PAR
// Calendly, disait elle aussi « un premier échange de 30 minutes » — juste sous
// le badge « 45 min ». La contradiction était visible sur un même écran.
//
// Personne n'avait rien cassé. Quelqu'un avait changé la durée dans Calendly, et
// le site — qui la portait en dur — ne pouvait pas suivre. Le prospect lisait 30
// et bloquait 45 minutes de son agenda.
//
// ## Ce que cette garde fait, et ce qu'elle ne peut pas faire
//
// ✅ Elle refuse qu'une durée d'appel de découverte réapparaisse à 30 minutes
//    dans le contenu du site.
// ❌ Elle NE PEUT PAS comparer au réglage réel de Calendly : ce test tourne en
//    intégration continue, sans jeton d'API. La seule chose qui suit vraiment
//    Calendly est l'affichage sous les créneaux, désormais DÉRIVÉ de la réponse
//    d'API (`availability.ts` → `dureeMinutes`). Cette garde protège le reste,
//    qui est du texte et ne peut pas être dérivé.
//
// ⚠️ POURQUOI UNE LISTE DE FICHIERS EXPLICITE ET PAS UN BALAYAGE. « 30 min »
// apparaît 1 886 fois dans `src/`, et l'écrasante majorité sont des homonymes
// parfaitement légitimes : temps de trajet des pages villes (« Paris à 30 min »),
// exemples de calcul de rendu de l'agenda, entretien de recrutement de 15 à
// 30 minutes, contenus de formation. Un balayage large rougirait sur eux et
// serait désactivé dans la semaine.
//
// On surveille donc les fichiers qui parlent de l'APPEL, et on y refuse la
// cooccurrence « 30 min » + un mot de l'appel.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Les surfaces qui décrivent l'appel de découverte.
 *
 * Une entrée dont le fichier a disparu fait ROUGIR : c'est le seul moyen qu'une
 * garde à liste explicite ne devienne pas muette au premier déménagement.
 */
const SURFACES = [
  "src/app/[locale]/appel/page.tsx",
  "src/app/[locale]/tarifs/page.tsx",
  "src/app/[locale]/un-a-un/page.tsx",
  "src/app/[locale]/formations/entreprise/page.tsx",
  "src/app/[locale]/interventions/dirigeants/page.tsx",
  "src/app/llms-full.txt/route.ts",
  "src/components/services/audit/AuditMethodology.tsx",
  "src/components/sections/IndividualCoachingPage.tsx",
  "src/components/admin/contacts/ManualCalendlyEventButton.tsx",
  "src/content/transversal.ts",
  "src/content/coaching-1to1.ts",
  "src/content/keywords/i-geo.ts",
  "src/content/press.ts",
  "src/content/intervention-documents-catalog.ts",
] as const;

/** Les mots qui signent une phrase parlant de l'appel de découverte. */
const MOTS_DE_L_APPEL =
  /appel|échange|echange|premier contact|call|cadrage|découverte|decouverte|scoping/i;

/** La durée fautive, sous ses formes rencontrées dans le dépôt. */
const DUREE_FAUTIVE = /\b30\s?-?\s?(min\b|minutes?\b)|30-min\b/i;

describe("la durée de l'appel de découverte", () => {
  it.each(SURFACES)("« %s » n'annonce plus 30 minutes", (relatif) => {
    const chemin = join(process.cwd(), relatif);
    if (!existsSync(chemin)) {
      throw new Error(
        `Garde inopérante : ${chemin} est introuvable. La surface a déménagé — ` +
          `corrige CE chemin plutôt que de retirer l'entrée, sinon la durée peut ` +
          `redevenir fausse sans que rien ne le dise.`,
      );
    }

    const fautives = readFileSync(chemin, "utf8")
      .split("\n")
      .map((ligne, i) => ({ ligne, n: i + 1 }))
      .filter(({ ligne }) => DUREE_FAUTIVE.test(ligne) && MOTS_DE_L_APPEL.test(ligne));

    expect(
      fautives.map(({ n, ligne }) => `${n}: ${ligne.trim().slice(0, 120)}`),
      "l'appel de découverte dure 45 minutes (décision de Will, 2026-08-27) — " +
        "un prospect qui lit 30 bloque 45 minutes de son agenda",
    ).toEqual([]);
  });

  it("TÉMOIN — la garde détecte bien une durée fautive", () => {
    // Sans ce cas, une expression régulière cassée rendrait les quatorze
    // précédents verts par vacuité, et personne ne le verrait. C'est le défaut
    // « trois filtres à zéro » du 2026-08-27, dans l'autre sens.
    const echantillon = 'title: isFr ? "Cadrage 30 min" : "30-min scoping",';
    expect(DUREE_FAUTIVE.test(echantillon)).toBe(true);
    expect(MOTS_DE_L_APPEL.test(echantillon)).toBe(true);
  });

  it("TÉMOIN — la garde ne se déclenche PAS sur un homonyme", () => {
    // Les temps de trajet des pages villes sont la famille d'homonymes la plus
    // nombreuse. Si ce cas rougit, la garde est trop large et sera désactivée.
    const trajet = "Nîmes à 30 min D40. Montpellier à 30 min D34. Lunel à 15 min.";
    expect(DUREE_FAUTIVE.test(trajet) && MOTS_DE_L_APPEL.test(trajet)).toBe(false);

    const agenda = "Sans plancher, un rendez-vous de 30 min sur 14 h ferait 3,6 %.";
    expect(DUREE_FAUTIVE.test(agenda) && MOTS_DE_L_APPEL.test(agenda)).toBe(false);
  });
});
