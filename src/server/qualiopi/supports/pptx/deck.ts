/**
 * Le DIAPORAMA PROJETÉ, décrit avant d'être rendu.
 *
 * Ce module est PUR : il transforme un programme enrichi en une suite de slides
 * typées, et rien d'autre. Aucun XML, aucune I/O. Le rendu OOXML vit à côté
 * (`render-pptx.ts`) et ne prend aucune décision de contenu.
 *
 * ## Les règles de composition, et pourquoi elles sont ici
 *
 * Une slide projetée n'est pas une page. Elle est lue à quatre mètres, en trois
 * secondes, pendant que quelqu'un parle. Trois règles en découlent, et elles
 * sont appliquées ICI plutôt que laissées au rédacteur :
 *
 *  1. **Une idée par slide.** Un bloc pédagogique produit plusieurs slides quand
 *     il porte plusieurs idées — la démonstration en produit trois : le contraste
 *     avant/après, le chiffre, puis le prompt.
 *  2. **Ce qui est long ne se projette pas, il se dit.** Les consignes
 *     détaillées, la FAQ, les parades aux blocages partent dans les NOTES DU
 *     PRÉSENTATEUR, que le formateur voit et que la salle ne voit pas. C'est le
 *     mécanisme natif de PowerPoint, et c'est exactement « une aide au formateur
 *     pour chaque slide ».
 *  3. **Le rythme se compose.** Une slide pleine teinte mocha ouvre chaque
 *     module et referme chaque synthèse : sur sept heures, l'alternance est ce
 *     qui empêche la journée de se confondre en un seul bloc.
 *
 * ## Un seul thème
 *
 * Décision de Will : pas de variante claire/sombre à maintenir. Le fond ivoire
 * (#faf8f3) tient dans une salle éclairée comme dans une salle sombre ; c'est
 * l'inverse qui échoue, un fond sombre étant illisible dès qu'il y a du jour.
 * Le contraste vient des slides pleine teinte, pas d'un second thème.
 */

import type { ModuleProgramme } from "../types";
import { titreModuleSansPrefixe } from "@/server/qualiopi/documents/programme-modules";

/** Fonds disponibles. Le contraste du deck se joue entre `ivoire` et `mocha`. */
export type FondSlide = "ivoire" | "mocha" | "sable";

/**
 * Les mises en page. Chacune correspond à une intention de lecture, pas à un
 * gabarit graphique : c'est le rendu qui décide des positions.
 */
export type LayoutSlide =
  /** Ouverture de deck ou de module : un titre, pleine teinte. */
  | "couverture"
  /** Un énoncé seul, composé grand — objectif, règle, acquis. */
  | "enonce"
  /** Deux colonnes opposées — avant / après. */
  | "contraste"
  /** Un chiffre qui se lit du fond de la salle. */
  | "chiffre"
  /** Un bloc de texte à recopier — le prompt, en chasse fixe. */
  | "prompt"
  /** Une liste courte, trois points maximum. */
  | "points"
  /** Le déroulé horaire de la journée. */
  | "sommaire";

export interface Slide {
  layout: LayoutSlide;
  fond: FondSlide;
  /** Surtitre discret : « Module 2 · Démonstration ». Situe sans encombrer. */
  eyebrow?: string;
  titre: string;
  /** Corps, selon le layout. Jamais plus de trois entrées sur `points`. */
  corps?: string[];
  /** Colonnes du layout `contraste`. */
  contraste?: { gaucheTitre: string; gauche: string; droiteTitre: string; droite: string };
  /** Le chiffre du layout `chiffre` : « 40 min » → « 10 min ». */
  chiffre?: { avant: string; apres: string };
  /**
   * Ce que le formateur lit en mode présentateur, et que la salle ne voit pas.
   * Toujours renseigné dès qu'un bloc porte des notes — c'est la raison d'être
   * du diaporama généré par rapport à un diaporama déposé.
   */
  notes?: string;
}

export interface Deck {
  titre: string;
  sousTitre: string;
  slides: Slide[];
}

/** Minutes → « 1 h 30 », « 45 min ». */
function duree(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/**
 * Assemble les notes du présentateur d'un bloc.
 *
 * L'ordre n'est pas arbitraire : le script d'abord, parce qu'il se lit en
 * démarrant la slide ; le plan B ensuite, parce qu'on le cherche en panique ; la
 * FAQ et les blocages en dernier, parce qu'on y revient après coup.
 */
function notesDeBloc(bloc: unknown): string | undefined {
  if (bloc === null || typeof bloc !== "object") return undefined;
  const notes = (bloc as { notes?: unknown }).notes;
  if (notes === null || typeof notes !== "object") return undefined;
  const n = notes as {
    script?: unknown;
    planB?: unknown;
    faq?: unknown;
    blocages?: unknown;
  };

  const parties: string[] = [];
  if (typeof n.script === "string" && n.script.length > 0) parties.push(n.script);
  if (typeof n.planB === "string" && n.planB.length > 0) parties.push(`PLAN B — ${n.planB}`);

  if (Array.isArray(n.faq) && n.faq.length > 0) {
    const lignes = n.faq
      .filter(
        (q): q is { question: string; reponse: string } => q !== null && typeof q === "object",
      )
      .map((q) => `« ${q.question} » → ${q.reponse}`);
    if (lignes.length > 0) parties.push(`ILS DEMANDENT\n${lignes.join("\n")}`);
  }

  if (Array.isArray(n.blocages) && n.blocages.length > 0) {
    const lignes = n.blocages
      .filter(
        (b): b is { situation: string; parade: string } => b !== null && typeof b === "object",
      )
      .map((b) => `${b.situation} → ${b.parade}`);
    if (lignes.length > 0) parties.push(`SI ÇA COINCE\n${lignes.join("\n")}`);
  }

  return parties.length > 0 ? parties.join("\n\n") : undefined;
}

/** Chaîne non vide, sinon `undefined`. */
function texte(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

/** Durée d'un module : ses séquences font foi, comme partout ailleurs. */
function dureeModule(mod: ModuleProgramme): number {
  if (mod === null || typeof mod !== "object") return 0;
  if (typeof mod.dureeMin === "number" && mod.dureeMin > 0) return mod.dureeMin;
  const sequences = Array.isArray(mod.sequences) ? mod.sequences : [];
  return sequences.reduce((n, s) => n + (typeof s?.dureeMin === "number" ? s.dureeMin : 0), 0);
}

/**
 * Slides d'un module enrichi. Un module sans blocs rédigés ne produit que sa
 * couverture et son déroulé : il vaut mieux un module visiblement mince qu'un
 * module rempli de titres de séquences projetés comme s'ils étaient du contenu.
 */
function slidesDeModule(mod: ModuleProgramme, index: number): Slide[] {
  // 🔴 Une entrée aberrante ne fait pas tomber la génération. Le contenu vient
  // d'une colonne JSON, et une seule ligne mal formée priverait la formation de
  // TOUS ses documents — pas seulement du module fautif.
  const titre = texte((mod as { titre?: unknown } | null)?.titre);
  if (titre === undefined) return [];

  const numero = index + 1;
  const eyebrow = (quoi: string) => `Module ${numero} · ${quoi}`;
  const minutes = dureeModule(mod);
  const slides: Slide[] = [];

  const m = mod as unknown as Record<string, unknown>;
  const objectif = m["objectif"] as Record<string, unknown> | undefined;
  const demo = m["demonstration"] as Record<string, unknown> | undefined;
  const pratique = m["pratique"] as Record<string, unknown> | undefined;
  const verification = m["verification"] as Record<string, unknown> | undefined;
  const synthese = m["synthese"] as Record<string, unknown> | undefined;

  // Couverture du module — pleine teinte, elle marque la rupture.
  slides.push({
    layout: "couverture",
    fond: "mocha",
    eyebrow: `Module ${numero}`,
    // Le titre du catalogue porte son repere de demi-journee (« Matin · Module
    // 1 — … ») : indispensable a la timeline publique, illisible projete.
    titre: titreModuleSansPrefixe(titre),
    ...(minutes > 0 ? { corps: [duree(minutes)] } : {}),
  });

  const enonce = texte(objectif?.["enonce"]);
  if (enonce !== undefined) {
    slides.push({
      layout: "enonce",
      fond: "ivoire",
      eyebrow: eyebrow("Ce que vous saurez faire"),
      titre: enonce,
      ...(notesDeBloc(objectif) !== undefined ? { notes: notesDeBloc(objectif)! } : {}),
    });
  }

  // La démonstration porte trois idées : elle produit donc trois slides.
  const avant = texte(demo?.["avant"]);
  const apres = texte(demo?.["apres"]);
  const notesDemo = notesDeBloc(demo);
  if (avant !== undefined && apres !== undefined) {
    slides.push({
      layout: "contraste",
      fond: "ivoire",
      eyebrow: eyebrow("Démonstration"),
      titre: "Avant / après",
      contraste: {
        gaucheTitre: "Aujourd'hui",
        gauche: avant,
        droiteTitre: "Avec la méthode",
        droite: apres,
      },
      ...(notesDemo !== undefined ? { notes: notesDemo } : {}),
    });
  }

  const gain = demo?.["gain"] as { avant?: unknown; apres?: unknown } | undefined;
  const gainAvant = texte(gain?.avant);
  const gainApres = texte(gain?.apres);
  if (gainAvant !== undefined && gainApres !== undefined) {
    slides.push({
      layout: "chiffre",
      fond: "sable",
      eyebrow: eyebrow("Démonstration"),
      titre: "Ce que ça change",
      chiffre: { avant: gainAvant, apres: gainApres },
    });
  }

  const prompt = texte(demo?.["prompt"]);
  const outil = texte(demo?.["outil"]);
  const nomOutil = outil !== undefined && outil.length <= 24 ? outil : undefined;
  if (prompt !== undefined) {
    slides.push({
      layout: "prompt",
      fond: "sable",
      // L'outil n'entre dans le surtitre que si c'est un NOM. Le champ accepte
      // une phrase (« Un seul outil, celui valide dans la salle ») : projetee en
      // surtitre, elle deborde et ne dit rien de plus que le silence.
      eyebrow: eyebrow(nomOutil === undefined ? "Le prompt" : `Le prompt · ${nomOutil}`),
      titre: "À recopier tel quel",
      corps: [prompt],
      ...(notesDemo !== undefined ? { notes: notesDemo } : {}),
    });
  }

  const consigne = texte(pratique?.["consigne"]);
  if (consigne !== undefined) {
    const aEmporter = texte(pratique?.["aEmporter"]);
    const notesPratique = notesDeBloc(pratique);
    const dureePratique = pratique?.["dureeMin"];
    slides.push({
      layout: "enonce",
      fond: "ivoire",
      eyebrow: eyebrow(
        typeof dureePratique === "number" ? `À vous · ${duree(dureePratique)}` : "À vous",
      ),
      titre: consigne,
      ...(aEmporter !== undefined ? { corps: [`Vous repartez avec : ${aEmporter}`] } : {}),
      ...(notesPratique !== undefined ? { notes: notesPratique } : {}),
    });
  }

  const question = texte(verification?.["question"]);
  if (question !== undefined) {
    const notesVerif = notesDeBloc(verification);
    slides.push({
      layout: "enonce",
      fond: "ivoire",
      eyebrow: eyebrow("On vérifie"),
      titre: question,
      // La réponse attendue ne se projette PAS : elle se corrige avec la salle.
      // Elle part dans les notes, où le formateur l'a sous les yeux.
      ...(notesVerif !== undefined || texte(verification?.["reponseAttendue"]) !== undefined
        ? {
            notes: [texte(verification?.["reponseAttendue"]), notesVerif]
              .filter((x): x is string => x !== undefined)
              .join("\n\n"),
          }
        : {}),
    });
  }

  const acquis = synthese?.["acquis"];
  if (Array.isArray(acquis) && acquis.length > 0) {
    const notesSynthese = notesDeBloc(synthese);
    slides.push({
      layout: "points",
      fond: "mocha",
      eyebrow: eyebrow("Ce qui est acquis"),
      titre: "À partir de maintenant",
      corps: acquis.filter((a): a is string => typeof a === "string").slice(0, 3),
      ...(notesSynthese !== undefined ? { notes: notesSynthese } : {}),
    });
  }

  return slides;
}

export interface DeckInput {
  titreFormation: string;
  modules: ModuleProgramme[];
  /** Durée vendue, en heures — affichée en couverture. */
  dureeHeures: number;
}

/**
 * Construit le diaporama complet.
 *
 * ⚠️ Aucune slide de présentation de l'organisme ni de biographie du formateur :
 * décision de Will, le deck doit servir n'importe quel formateur sans être
 * nominatif. Ce qui doit être dit sur Axion-IA se dit, il ne se projette pas.
 */
export function construireDeck(input: DeckInput): Deck {
  const slides: Slide[] = [];

  slides.push({
    layout: "couverture",
    fond: "mocha",
    titre: input.titreFormation,
    corps: [`${input.dureeHeures} heures`],
  });

  // Sommaire : le déroulé de la journée, module par module.
  const sommaire = (Array.isArray(input.modules) ? input.modules : [])
    .map((mod, i) => {
      const titre = texte((mod as { titre?: unknown } | null)?.titre);
      if (titre === undefined) return undefined;
      const minutes = dureeModule(mod);
      return minutes > 0 ? `${i + 1}. ${titre} — ${duree(minutes)}` : `${i + 1}. ${titre}`;
    })
    .filter((l): l is string => l !== undefined);
  if (sommaire.length > 0) {
    slides.push({
      layout: "sommaire",
      fond: "ivoire",
      eyebrow: "Le déroulé",
      titre: "Ce qu'on fait aujourd'hui",
      corps: sommaire,
    });
  }

  const modules = Array.isArray(input.modules) ? input.modules : [];
  for (const [i, mod] of modules.entries()) slides.push(...slidesDeModule(mod, i));

  return {
    titre: input.titreFormation,
    sousTitre: `${input.dureeHeures} heures`,
    slides,
  };
}
