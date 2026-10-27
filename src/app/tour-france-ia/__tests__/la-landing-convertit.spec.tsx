/**
 * LA LANDING DU TOUR EST UNE PAGE DE CONVERSION, ET UNE PAGE VISUELLE (refonte
 * « page de conversion » du 2026-10-26, refonte visuelle du 2026-10-27, modèle
 * « 5 journées offertes par ville, sur sélection » du 2026-10-27).
 *
 * Trafic visé : un post Facebook ou Instagram, sur téléphone, dans le navigateur
 * intégré, en 4G. Ce qui doit tenir, en plus de `le-tour-est-ouvert.spec.ts` :
 *
 *   · UNE seule action, « Demander ma journée offerte », vers la visio du Tour ;
 *   · le premier écran d'un téléphone : puce, H1, promesse, l'emplacement de la
 *     vidéo (la frise tant qu'elle n'est pas là), bouton, micro-texte, et SOUS LE
 *     BOUTON, dans la même boîte, les conditions et leur lien ;
 *   · la contrepartie (« podcast ») sous CHAQUE grand bouton, jamais « filmé » ;
 *   · très peu de texte : 200 mots visibles au plus hors FAQ, conditions et pied,
 *     des titres de 6 mots au plus, un dessin par bloc ;
 *   · cinq emplacements de bouton, ceux que la console connaît (tdf-entete,
 *     tdf-heros, tdf-bandeau, tdf-final, tdf-collant) — pas un de plus ;
 *   · le suivi d'arrivée (`utm_*` seulement) passe de la page aux boutons, puis
 *     de `/fr/appel/…` à Calendly — exécuté, pas lu ;
 *   · le bouton collant ne se montre qu'entre le bouton du héros et l'appel final ;
 *   · le JavaScript reste minimal : aucun `next/image`, `next/script`, ni
 *     composant d'interface partagé qui tirerait du JS ; la FAQ est un
 *     `details` natif ; les animations sont en CSS et respectent le mouvement
 *     réduit ; UNE seule image matricielle (le fondateur, en différé) ; aucune
 *     balise `video` tant que `VIDEO_HEROS` est nul ;
 *   · CLS nul : chaque dessin porte largeur et hauteur NUMÉRIQUES ;
 *   · aucune animation en boucle infinie ;
 *   · le vocabulaire : aucun mot du cyclisme, aucun emoji, aucun chiffre hors
 *     de ceux du concept.
 *
 * Angle mort assumé : jsdom n'a pas de mise en page. « Le bouton tient dans le
 * premier écran à 360 × 640 » se vérifie dans un navigateur (cf. la PR), pas ici.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { avecUtmContent, lireSuiviArrivee } from "@/server/calendly/choix-rendez-vous";

import TourDeFranceIaPage from "../page";
import {
  AMBASSADEURS,
  APPEL_FINAL,
  CHEMIN_CONDITIONS,
  CHEMIN_RENDEZ_VOUS,
  CONDITIONS,
  EMPLACEMENTS_CTA,
  ETAPES,
  FAQ,
  FONDATEUR,
  GAINS,
  HEROS,
  LIBELLE_CTA,
  LIBELLE_CTA_COURT,
  MICRO_TEXTE_CTA,
  PIED,
  PROMESSE,
  VIDEO_HEROS,
  VILLE,
  lienRendezVous,
  texteDesBoutons,
  texteVisibleHorsFaq,
  toutLeTexte,
} from "../contenu";
import { EmplacementVideo } from "../_composants/EmplacementVideo";
import { PiloteCta } from "../_composants/PiloteCta";
import styles from "../tour.module.css";
import {
  CarteFrance,
  Fleche,
  IllustrationMoment,
  Jauge,
  PictoSecteur,
  PictoTour,
  PictoVisio,
} from "../_composants/Visuels";

const CSS_ESCAPE = (s: string) => s.replace(/[^\w-]/g, "\\$&");
const RACINE = process.cwd();
const DOSSIER = "src/app/tour-france-ia";
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), "utf8");
const sansCommentaires = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");

const PAGE = lire(`${DOSSIER}/page.tsx`);
const VISUELS = lire(`${DOSSIER}/_composants/Visuels.tsx`);
const VIDEO = lire(`${DOSSIER}/_composants/EmplacementVideo.tsx`);
const CSS = lire(`${DOSSIER}/tour.module.css`);
const SOURCES = [PAGE, VISUELS, VIDEO, lire(`${DOSSIER}/contenu.ts`)].join("\n");
const mots = (t: string) => t.split(/\s+/).filter((m) => /[\p{L}\d]/u.test(m)).length;

/** La page entière, rendue (composant serveur asynchrone : le Tour est ouvert, aucune requête). */
async function rendrePage() {
  return render(await TourDeFranceIaPage());
}

describe("🔑 une seule action : ma journée offerte", () => {
  it("le libellé dit ce que l'entreprise demande, et il mène à la visio du Tour", () => {
    expect(LIBELLE_CTA).toBe("Demander ma journée offerte");
    expect(LIBELLE_CTA_COURT).toBe("Ma journée offerte");
    for (const l of [LIBELLE_CTA, LIBELLE_CTA_COURT]) expect(l).toMatch(/journée offerte$/);
    // Court : l'en-tête et la barre collante tiennent sur une ligne à 360 px.
    expect(LIBELLE_CTA_COURT.length).toBeLessThanOrEqual(25);
    // La barre collante porte le libellé court, les grands boutons le long.
    expect(sansCommentaires(PAGE)).toMatch(
      /\{compact \|\| pleineLargeur \? LIBELLE_CTA_COURT : LIBELLE_CTA\}/,
    );
    expect(`${LIBELLE_CTA} ${LIBELLE_CTA_COURT}`).not.toMatch(
      /participer|candidat|r[ée]serv|inscri|film|tourn/i,
    );
    expect(lienRendezVous("tdf-heros")).toBe(`${CHEMIN_RENDEZ_VOUS}?depuis=tdf-heros`);
    expect(lienRendezVous("tdf-entete")).toBe(`${CHEMIN_RENDEZ_VOUS}?depuis=tdf-entete`);
  });

  it("chaque lien de la page qui n'est pas du pied de page est un bouton, les conditions ou la fiche du fondateur", () => {
    const code = sansCommentaires(PAGE);
    const emplacements = [...code.matchAll(/<BoutonAudit\s+depuis="([^"]+)"/g)].map((m) => m[1]);
    // Exactement les cinq que la console connaît, chacun une fois — aucun inventé.
    expect([...emplacements].sort()).toEqual([...EMPLACEMENTS_CTA].sort());
    expect(EMPLACEMENTS_CTA).toEqual([
      "tdf-entete",
      "tdf-heros",
      "tdf-bandeau",
      "tdf-final",
      "tdf-collant",
    ]);
    expect(code).not.toContain("tdf-etapes");
    const autres = [...code.matchAll(/href=\{([^}]+)\}/g)].map((m) => m[1]);
    expect(autres).toEqual([
      "lienRendezVous(depuis)",
      "LIEN_CONDITIONS.chemin",
      "FONDATEUR.lien.chemin",
      "LIEN_CONDITIONS.chemin",
      "l.href",
    ]);
    expect(FONDATEUR.lien).toEqual({
      libelle: "Découvrir Williams",
      chemin: "/fr/equipe/williams",
    });
    expect(CHEMIN_CONDITIONS).toBe("/tour-france-ia/conditions-generales");
    expect(PIED.liens[0]).toEqual({
      libelle: "Conditions générales du Tour",
      href: "/tour-france-ia/conditions-generales",
    });
  });

  it("l'en-tête du tunnel : le logo et UN bouton (tdf-entete, 44 px minimum), aucun menu, aucun lien de sortie", () => {
    const code = sansCommentaires(PAGE);
    const entete = code.slice(code.indexOf("<header"), code.indexOf("</header>"));
    expect(entete).toMatch(/<BoutonAudit\s+depuis="tdf-entete"\s+compact\s*\/>/);
    expect(entete).toContain("ENTETE.marque");
    expect(entete).toContain("ml-auto");
    expect(entete).not.toMatch(/<a\b|href=/);
    expect(entete.match(/<BoutonAudit/g)).toHaveLength(1);
    expect(code.indexOf("</header>")).toBeLessThan(code.indexOf("<h1"));
    expect(code.indexOf("</header>")).toBeLessThan(code.indexOf("<main"));
    const compact = CSS.match(/\.boutonCompact\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(compact).toMatch(/min-height:\s*2\.75rem/);
    expect(code).toMatch(/data-tdf-cta=""/);
  });

  it("le bloc « Ce que vous gagnez » porte la pilule compacte (tdf-bandeau), après le héros", () => {
    const code = sansCommentaires(PAGE);
    const i = code.indexOf('depuis="tdf-bandeau"');
    expect(i).toBeGreaterThan(code.indexOf('depuis="tdf-heros"'));
    expect(i).toBeGreaterThan(code.indexOf("{GAINS.titre}"));
    expect(i).toBeLessThan(code.indexOf("{AMBASSADEURS.titre}"));
    expect(code).toMatch(/<BoutonAudit\s+depuis="tdf-bandeau"\s+compact\s*\/>/);
  });

  it("la charte d'Axion : jetons de globals.css seulement, UNE couleur d'action (bleu primaire plein), le terracotta en accent", () => {
    // Aucune couleur écrite en dur dans la feuille du Tour, la page ni les dessins.
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(sansCommentaires(PAGE)).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(sansCommentaires(VISUELS)).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    expect(sansCommentaires(VIDEO)).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    // Les couleurs écrites dans les dessins sont toutes des jetons.
    for (const m of VISUELS.matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
      expect(m[1], m[1]).toMatch(/^(none|var\(--color-[a-z-]+\))$/);
    }
    // Refonte « 2027 » : en-tête crème dépoli, héros et appel final CLAIRS (plus de fond
    // quasi noir), le terracotta en accent et en UNE bande pleine, le bleu pour l'action.
    expect(PAGE).toMatch(/<header className="border-border\/70 bg-bg\/90 border-b backdrop-blur">/);
    const code = sansCommentaires(PAGE);
    expect(code).not.toMatch(/bg-terracotta-deep|from-terracotta-deep|bg-(mocha|ink)(?![\w-])/);
    // Les ambassadeurs : LA bande au terracotta de marque, entre deux vagues.
    expect(code).toMatch(
      /<section\s+className=\{`bg-terracotta text-mocha-fg \$\{SECTION\}`\}\s+aria-labelledby="tdf-ambassadeurs"/,
    );
    expect(code.match(/<Vague\b/g)).toHaveLength(2);
    expect(code.match(/bg-terracotta text-mocha-fg \$\{SECTION\}/g)).toHaveLength(1);
    expect(CSS).toMatch(/\.bouton\s*\{[^}]*background:\s*var\(--color-primary\)/);
    // Le bleu plein n'habille QUE l'action : aucun autre fond `bg-primary` que la pastille
    // du jour fixé (dernière étape, celle du rendez-vous).
    expect(code.match(/\bbg-primary\b(?![-/])/g)).toHaveLength(1);
    expect(PAGE).toMatch(/const FOND_LUMINEUX =\s*"bg-bg /);
    expect(PAGE).toContain("var(--color-terracotta)_16%");
    expect(PAGE.match(/\$\{FOND_LUMINEUX\} text-fg/g)).toHaveLength(2);
  });

  it("aucun menu de navigation, aucun carrousel, aucun défilement horizontal", () => {
    expect(PAGE).not.toMatch(/<nav\b/);
    expect(SOURCES).not.toMatch(/carousel|carrousel|swiper|embla|slick|scroll-snap|snap-x/i);
    expect(PAGE).not.toMatch(/overflow-x-(auto|scroll)/);
    expect(lire(`${DOSSIER}/layout.tsx`)).toContain("overflow-x-clip");
  });

  it("l'ordre de la page : en-tête, héros, ville, gains, ambassadeurs, étapes, fondateur, FAQ, appel final, pied", () => {
    const code = sansCommentaires(PAGE);
    const i = (t: string) => {
      const n = code.indexOf(t);
      expect(n, t).toBeGreaterThan(-1);
      return n;
    };
    const ordre = [
      "<header",
      "{HEROS.surtitre}",
      "<h1",
      "{HEROS.promesse}",
      "<EmplacementVideo",
      "HEROS.frise.map",
      "id={ID_CTA_HEROS}",
      "{MICRO_TEXTE_CTA}",
      "{HEROS.conditions}",
      "{VILLE.titre}",
      "<CarteFrance",
      "{GAINS.titre}",
      "{AMBASSADEURS.titre}",
      "{ETAPES.titre}",
      "{FONDATEUR.titre}",
      "{FAQ.titre}",
      "{APPEL_FINAL.titre}",
      "<footer",
    ].map(i);
    expect([...ordre].sort((x, y) => x - y)).toEqual(ordre);
    for (const t of ["{HEROS.promesse}", "{HEROS.conditions}", "HEROS.frise.map", "<CarteFrance"]) {
      expect(code.split(t).length - 1, t).toBe(1);
    }
    // Rien n'est caché sur mobile dans le héros.
    expect(code.slice(i("{HEROS.surtitre}"), i("{VILLE.titre}"))).not.toMatch(/\bhidden\b/);
    // Aucune police à chasse fixe au-dessus du pli : le surtitre est une puce en Manrope.
    expect(code.slice(code.indexOf("<main"), i("{VILLE.titre}"))).not.toMatch(/font-mono/);
    // La carte est plus petite sur téléphone.
    expect(code).toMatch(/max-w-\[300px\][^"`]*sm:max-w-\[380px\]/);
  });

  it("🔴 sous CHAQUE grand bouton : le micro-texte, puis les conditions (retenues, podcast) et leur lien, en clair (≥ 12 px)", () => {
    const code = sansCommentaires(PAGE);
    const heros =
      /<BoutonAudit depuis="tdf-heros" id=\{ID_CTA_HEROS\} \/>\s*<p[^>]*>\s*\{MICRO_TEXTE_CTA\}\s*<\/p>\s*<p className=\{`\$\{TEXTE_CONDITIONS\}[^`]*`\}>\s*\{HEROS\.conditions\}\{" "\}\s*<a href=\{LIEN_CONDITIONS\.chemin\}/.exec(
        code,
      );
    expect(
      heros,
      "héros : bouton, micro-texte, conditions et lien dans la même boîte",
    ).not.toBeNull();
    const final =
      /<BoutonAudit depuis="tdf-final" \/>\s*<p[^>]*>\{MICRO_TEXTE_CTA\}<\/p>\s*<p className=\{TEXTE_CONDITIONS\}>\s*\{APPEL_FINAL\.conditions\}\{" "\}\s*<a href=\{LIEN_CONDITIONS\.chemin\}/.exec(
        code,
      );
    expect(final, "appel final : bouton, micro-texte, conditions et lien").not.toBeNull();
    // 13 px, jamais `text-xs` (12 px) ni moins, jamais repliées, en gris-brun lisible sur
    // le crème (`fg-soft` : 8,1:1), jamais en gris pâle.
    const classes = /const TEXTE_CONDITIONS = "([^"]+)"/.exec(code)?.[1] ?? "";
    expect(classes).toContain("text-[0.8125rem]");
    expect(classes).not.toMatch(/\btext-(xs|\[0\.[0-6])/);
    expect(classes).toContain("text-fg-soft");
    expect(classes).not.toMatch(/text-fg-muted|text-mocha/);
    expect(code).not.toMatch(/<details[^>]*>[\s\S]{0,400}HEROS\.conditions/);
    expect(HEROS.conditions).toBe(CONDITIONS);
    for (const c of [CONDITIONS, APPEL_FINAL.conditions]) {
      expect(c).toMatch(/retenues/);
      expect(c).toMatch(/podcast/);
      expect(c).not.toMatch(/film|tourn|\*/i);
    }
    expect(PAGE.match(/\{MICRO_TEXTE_CTA\}/g)).toHaveLength(2);
  });

  it("🔴 rendue : les conditions et leur lien suivent les deux grands boutons, dans la même boîte", async () => {
    const { container } = await rendrePage();
    for (const id of ["tdf-cta-heros", null]) {
      const bouton = id
        ? container.querySelector(`#${id}`)
        : container.querySelector('a[href$="depuis=tdf-final"]');
      const boite = bouton?.parentElement;
      expect(boite?.textContent).toContain(MICRO_TEXTE_CTA);
      expect(boite?.textContent).toMatch(/retenues[^]*podcast/);
      expect(boite?.querySelector(`a[href="${CHEMIN_CONDITIONS}"]`)?.textContent).toBe(
        "Conditions générales",
      );
      expect(boite?.textContent).not.toMatch(/filmé|tournage/);
    }
    cleanup();
  });

  it("la promesse et la frise : la journée offerte, comprise d'un coup d'œil, sans le vendredi", () => {
    expect(HEROS.promesse).toBe(PROMESSE);
    expect(PROMESSE).toMatch(/^Une journée offerte dans votre entreprise/);
    expect(PROMESSE).toMatch(/audit \+ formation IA de votre équipe\.$/);
    expect(PROMESSE.length).toBeLessThanOrEqual(90);
    expect(HEROS.frise).toEqual(["Audit", "Formation", "4 h chez vous"]);
    expect(HEROS.frise.join(" ")).not.toMatch(/vendredi/i);
    // La frise est une liste ordonnée nommée, à trois disques dessinés.
    const code = sansCommentaires(PAGE);
    expect(code).toMatch(/<ol\s+aria-label=\{HEROS\.friseTitre\}/);
    expect(code).toMatch(/<PictoFrise index=\{i\} \/>/);
  });

  it("lisible sur téléphone : H1 à 32 px au moins, bouton à 56 px", () => {
    const h1 = sansCommentaires(PAGE).match(/<h1[\s\S]*?className="([^"]+)"/)?.[1] ?? "";
    expect(h1).toMatch(/text-\[clamp\(2rem,/);
    expect(h1).toContain("font-serif");
    const bouton = CSS.match(/\.bouton\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(bouton).toMatch(/text-align:\s*center/);
    expect(bouton).toMatch(/min-height:\s*3\.5rem/);
    expect(bouton).toMatch(/line-height:\s*1\.25/);
    expect(CSS.match(/\.boutonCompact\s*\{([^}]*)\}/)?.[1] ?? "").toMatch(/white-space:\s*nowrap/);
  });

  it("🔴 très peu de texte : 200 mots visibles au plus hors FAQ, conditions et pied ; titres de 6 mots au plus", () => {
    const n = mots(texteVisibleHorsFaq());
    // Mesuré le 2026-10-27 : 188 mots rédigés.
    expect(n, `${n} mots`).toBeLessThanOrEqual(200);
    // Avec le logo, chaque libellé de bouton et chaque micro-texte, à chaque affichage :
    // 215 mesurés le 2026-10-27, 224 depuis la légende « … ou un membre de son équipe »
    // (9 mots, demandée par le propriétaire : la citation n'est plus attribuée au seul
    // fondateur). Cliquet : ajouter un bouton ou une phrase, c'est en retirer.
    const total = n + mots(texteDesBoutons());
    expect(total, `${total} mots`).toBeLessThanOrEqual(224);
    for (const titre of [
      VILLE.titre,
      GAINS.titre,
      AMBASSADEURS.titre,
      ETAPES.titre,
      FONDATEUR.titre,
      FAQ.titre,
      APPEL_FINAL.titre,
    ]) {
      expect(mots(titre), titre).toBeLessThanOrEqual(6);
    }
    for (const e of ETAPES.liste) expect(mots(e), e).toBeLessThanOrEqual(6);
    // FAQ : six questions courtes, réponses de deux phrases au plus.
    expect(FAQ.questions).toHaveLength(6);
    for (const q of FAQ.questions) {
      expect(
        q.reponse.split(/[.!?](\s|$)/).filter((p) => p.trim().length > 1).length,
        q.question,
      ).toBeLessThanOrEqual(2);
    }
  });

  it("les blocs supprimés ne reviennent pas", () => {
    const code = sansCommentaires(PAGE);
    for (const ancien of [
      "OFFRE_DETAIL",
      "PROBLEME",
      "LEVIERS.",
      "BANDEAU",
      "POUR_QUI",
      "EN_BREF",
      "{DEFINITION}",
      "REASSURANCE",
      "BENEFICE",
      "REGLE_ETAPE",
      "CONDITION_GRATUITE",
      "JOURNEE",
      "VENDREDI",
      "SceneEntreprise",
      "PictoLevier",
    ]) {
      expect(code, ancien).not.toContain(ancien);
    }
    expect(SOURCES).not.toMatch(/SceneEntreprise|PictoLevier|sceneFenetre|sceneLune/);
    expect(CSS).not.toMatch(/sceneFenetre|sceneLune|@keyframes (allumer|paraitre)/);
  });

  it("« En 3 étapes », « Ce que vous gagnez », les ambassadeurs : le texte du propriétaire, mot pour mot", () => {
    expect(ETAPES.liste).toEqual([
      "Votre demande, en 1 minute",
      "Une visio de 30 minutes",
      "Retenu ? Votre jour est fixé",
    ]);
    expect(sansCommentaires(PAGE)).toMatch(/\$\{styles\.parcours\} mt-8 grid gap-8 lg:grid-cols-3/);
    expect(GAINS.cartes.map((c) => c.titre)).toEqual([
      "On trouve vos heures perdues.",
      "On vous montre votre première automatisation.",
      "Votre équipe formée à l’IA.",
    ]);
    expect(GAINS.cartes[2]?.texte).toMatch(/jusqu’à 15 personnes/);
    expect(AMBASSADEURS.titre).toBe("5 entreprises, visages de leur ville");
    expect(AMBASSADEURS.avantages).toEqual([
      "Votre page sur notre site, avec un lien vers le vôtre",
      "Votre dirigeant dans notre podcast",
      "Le dîner des dirigeants, vendredi soir (facultatif)",
    ]);
    expect(VILLE.titre).toBe("Votre ville s’ouvre dès 5 demandes");
    expect(VILLE.semaine).toBe("Puis une semaine : une entreprise par jour, du lundi au vendredi.");
    expect(VILLE.legende).toBe("Illustration : aucune ville n’est encore annoncée.");
    expect(APPEL_FINAL.titre).toBe("5 journées offertes par ville.");
    expect(texteVisibleHorsFaq()).not.toMatch(/\d+\s?h\s?\d+|\d{1,2}:\d{2}|\d+\s?heures/);
  });

  it("🔴 les ambassadeurs : cinq badges en pointillé, des pictos de secteurs — aucun logo, aucune personne", async () => {
    const code = sansCommentaires(PAGE);
    expect(code).toMatch(/const SECTEURS_BADGES = \[[\d, ]+\] as const;/);
    const n = /const SECTEURS_BADGES = \[([\d, ]+)\]/.exec(code)?.[1]?.split(",").length;
    expect(n).toBe(5);
    expect(code).toMatch(/border-2 border-dashed/);
    const { container } = await rendrePage();
    const section = container.querySelector('section[aria-labelledby="tdf-ambassadeurs"]');
    expect(section?.querySelectorAll("img")).toHaveLength(0);
    expect(section?.querySelectorAll('ul[aria-hidden="true"] > li svg')).toHaveLength(5);
    cleanup();
  });

  it("qui vient chez vous : la photo ronde du fondateur, la phrase de l'équipe mot pour mot, sa légende vraie, la fiche", () => {
    expect(FONDATEUR.titre).toBe("Qui vient chez vous");
    // La phrase est dite par l'équipe : celui qui vient est le fondateur OU l'un de ses équipiers.
    expect(FONDATEUR.citation).toBe(
      "On vient chez vous, on regarde comment vous travaillez, et on vous montre ce que l’IA peut faire dès demain.",
    );
    expect(FONDATEUR.legende).toBe(
      "Williams Jullin, fondateur d’Axion-IA, ou un membre de son équipe",
    );
    expect(FONDATEUR.alt).toBe("Williams Jullin, fondateur d’Axion-IA");
    expect(FONDATEUR.photo).toBe("/illustrations/william-fondateur-axion-ia.webp");
    // Plus aucun « je » de l'entreprise : la page parle en « on » / « nous ». Le seul « je »
    // du texte est celui du VISITEUR (une question de la FAQ), comme « Ma journée offerte ».
    const premierePersonne = /(^|[^\p{L}])(je|j’|moi|mon|mes)(?=[^\p{L}]|$)/iu;
    expect(texteVisibleHorsFaq()).not.toMatch(premierePersonne);
    expect(FONDATEUR.citation).toMatch(/^On vient chez vous/);
    const questionsEnJe = FAQ.questions.filter((q) => premierePersonne.test(q.question));
    expect(questionsEnJe).toHaveLength(1);
    expect(questionsEnJe[0]?.question).toMatch(/^Et si je ne suis pas retenu/);
    for (const q of FAQ.questions) expect(q.reponse, q.question).not.toMatch(premierePersonne);
    // Le fichier existe déjà (illustration du site) : aucun fichier image n'est créé.
    expect(readFileSync(join(RACINE, "public", FONDATEUR.photo)).length).toBeGreaterThan(1_000);
  });
});

describe("🔴 le suivi d'arrivée passe jusqu'à Calendly", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
  });

  function rendreAvec(query: string): HTMLAnchorElement {
    window.history.replaceState(null, "", `/tour-france-ia${query}`);
    const { container } = render(
      <>
        <a href={lienRendezVous("tdf-heros")} id="heros" data-tdf-cta="">
          {LIBELLE_CTA}
        </a>
        <PiloteCta />
      </>,
    );
    return container.querySelector("a") as HTMLAnchorElement;
  }

  it("les utm_* d'un post Facebook sont recopiés sur le bouton, le fbclid et les valeurs invalides abandonnés", () => {
    const lien = rendreAvec(
      "?utm_source=facebook&utm_medium=paid-social&utm_campaign=tour-ia&utm_content=post-3&fbclid=IwAR0Zx_9-ab&utm_term=ignore",
    );
    const url = new URL(lien.getAttribute("href") ?? "", "https://axion-ia.com");
    expect(url.pathname).toBe(CHEMIN_RENDEZ_VOUS);
    expect(url.searchParams.get("depuis")).toBe("tdf-heros");
    expect(url.searchParams.get("utm_source")).toBe("facebook");
    expect(url.searchParams.get("utm_medium")).toBe("paid-social");
    expect(url.searchParams.get("utm_campaign")).toBe("tour-ia");
    expect(url.searchParams.get("utm_content")).toBe("post-3");
    // `/fr/appel/…` ne lit pas le fbclid : il n'est plus recopié.
    expect(url.searchParams.get("fbclid")).toBeNull();
    expect(sansCommentaires(lire(`${DOSSIER}/_composants/PiloteCta.tsx`))).not.toMatch(/fbclid/i);

    // …puis `/fr/appel/tour-france-ia` les relit, et Calendly les reçoit.
    const suivi = lireSuiviArrivee(Object.fromEntries(url.searchParams));
    expect(suivi).toMatchObject({
      utm_source: "facebook",
      utm_campaign: "tour-ia",
      depuis: "tdf-heros",
    });
    const calendly = new URL(avecUtmContent("https://calendly.com/axion-ia/tour", suivi));
    expect(calendly.searchParams.get("utm_source")).toBe("facebook");
    expect(calendly.searchParams.get("utm_medium")).toBe("paid-social");
    expect(calendly.searchParams.get("utm_campaign")).toBe("tour-ia");
    expect(calendly.searchParams.get("utm_content")).toBe("post-3");
    expect(calendly.searchParams.get("utm_term")).toBe("tdf-heros");
  });

  it("une valeur hors forme n'est pas recopiée", () => {
    const lien = rendreAvec("?utm_source=%3Cscript%3E&fbclid=a%20b%3Cc");
    const url = new URL(lien.getAttribute("href") ?? "", "https://axion-ia.com");
    expect(url.searchParams.get("utm_source")).toBeNull();
    expect(url.searchParams.get("fbclid")).toBeNull();
    expect(url.searchParams.get("depuis")).toBe("tdf-heros");
  });

  it("aucun pixel, aucun script tiers, aucune mesure ajoutée", () => {
    expect(SOURCES).not.toMatch(/fbq\(|connect\.facebook|plausible\(|gtag\(|<script[^>]+src=/i);
  });
});

describe("🔴 la barre collante : entre le héros et l'appel final, en CSS seul", () => {
  // Refonte du 2026-10-27 : plus d'observateur ni de script. La barre est
  // `position: sticky; bottom: 0`, DERNIER enfant du bloc qui va de la ville à la
  // FAQ : elle ne peut pas paraître avant que ce bloc entre à l'écran (le héros est
  // dépassé), ni le quitter (elle s'arrête avant l'appel final et le pied de page).
  it("elle est le dernier enfant du bloc ville → FAQ, juste avant l'appel final", async () => {
    const { container } = await rendrePage();
    const collant = container.querySelector("#tdf-cta-collant") as HTMLElement;
    expect(collant).not.toBeNull();
    const bloc = collant.parentElement as HTMLElement;
    expect(bloc.lastElementChild).toBe(collant);
    expect(bloc.firstElementChild?.getAttribute("aria-labelledby")).toBe("tdf-ville");
    expect(bloc.querySelector('section[aria-labelledby="tdf-faq"]')).not.toBeNull();
    expect(bloc.querySelector("h1, #tdf-section-finale")).toBeNull();
    expect(bloc.nextElementSibling?.id).toBe("tdf-section-finale");
    // Aucun ancêtre ne coupe le collant (un `overflow` caché l'empêcherait de coller).
    for (let el: HTMLElement | null = bloc; el; el = el.parentElement) {
      expect(el.className, el.tagName).not.toMatch(/overflow-(hidden|auto|scroll)/);
    }
    // Le seul bouton qu'elle porte : le libellé court, emplacement tdf-collant.
    const liens = collant.querySelectorAll("a");
    expect(liens).toHaveLength(1);
    expect(liens[0]?.getAttribute("href")).toBe(lienRendezVous("tdf-collant"));
    expect(liens[0]?.textContent).toBe(LIBELLE_CTA_COURT);
    cleanup();
  });

  it("sticky en bas, mobile seulement, au-dessus de la zone système, sans aucun script", () => {
    const code = sansCommentaires(PAGE);
    const classes = /id=\{ID_CTA_COLLANT\}\s+className=\{`([^`]+)`\}/.exec(code)?.[1] ?? "";
    expect(classes).toMatch(/\bsticky bottom-0\b/);
    expect(classes).toMatch(/\bmd:hidden\b/);
    expect(classes).toMatch(/\bz-40\b/);
    expect(classes).not.toMatch(/\bfixed\b|translate-y|opacity-0|data-\[visible/);
    expect(code).not.toMatch(/\binert\b|data-visible/);
    const collant = CSS.match(/\.collant\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(collant).toMatch(/env\(safe-area-inset-bottom\)/);
    // Le seul composant client ne fait plus que recopier les utm_* : aucun observateur.
    const pilote = sansCommentaires(lire(`${DOSSIER}/_composants/PiloteCta.tsx`));
    expect(pilote).not.toMatch(/IntersectionObserver|scroll|getElementById|dataset/);
    expect(code).toMatch(/<PiloteCta \/>/);
  });
});

describe("🔴 un élément SVG animé ne porte pas d'attribut `transform`", () => {
  // Une animation CSS sur `transform` ÉCRASE l'attribut SVG du même nom : le
  // décalage `translate(108 0)` de la coche était perdu et elle recouvrait le
  // premier point de la jauge. Décalage et animation vivent sur deux éléments.
  const classesAnimees = [
    ...CSS.matchAll(/\.([A-Za-z][\w-]*)(?::[\w()-]+)?\s*\{[^}]*\banimation\s*:/g),
  ].map((m) => m[1] ?? "");

  it("le CSS déclare bien des classes animées (le test ne tourne pas à vide)", () => {
    expect(classesAnimees).toEqual(
      expect.arrayContaining(["jaugeCoche", "carteHalo", "carteEntreprise", "jaugePoint"]),
    );
  });

  it("aucun élément rendu des Visuels, animé par sa classe, ne porte `transform`", () => {
    const { container } = render(
      <>
        <Jauge />
        <Jauge echelle={1.5} />
        <CarteFrance titre="t" titreId="t" />
        <CarteFrance titre="t" titreId="t2" surSombre />
        {(["heures", "automatisation", "equipe", "site", "micro", "calendrier"] as const).map(
          (nom) => (
            <PictoTour key={nom} nom={nom} />
          ),
        )}
      </>,
    );
    let vus = 0;
    for (const nom of classesAnimees) {
      const classe = (styles as Record<string, string>)[nom];
      if (!classe) continue;
      for (const el of container.querySelectorAll(`.${CSS_ESCAPE(classe)}`)) {
        vus++;
        expect(el.hasAttribute("transform"), `.${nom} porte un attribut transform`).toBe(false);
      }
    }
    expect(vus).toBeGreaterThan(0);
  });

  it("la coche de la jauge est décalée par un <g> parent, à x = 108", () => {
    const { container } = render(<Jauge />);
    const coche = container.querySelector(
      `.${CSS_ESCAPE((styles as Record<string, string>)["jaugeCoche"] ?? "jaugeCoche")}`,
    );
    expect(coche?.parentElement?.getAttribute("transform")).toBe("translate(108 0)");
  });
});

describe("🔴 la carte : aucun repère ne tombe sur une grande ville", () => {
  // Villes projetées comme le contour (équirectangulaire à 46,5° N, 430 × 410).
  const VILLES: Array<[string, number, number]> = [
    ["Lille", 236, 30],
    ["Paris", 217, 100],
    ["Strasbourg", 362, 111],
    ["Rennes", 108, 129],
    ["Nantes", 112, 164],
    ["Lyon", 284, 221],
    ["Bordeaux", 138, 257],
    ["Toulouse", 192, 305],
    ["Marseille", 300, 308],
    ["Clermont-Ferrand", 236, 220],
    ["Montpellier", 258, 302],
    ["Nice", 349, 299],
    ["Tours", 172, 157],
    ["Dijon", 289, 160],
  ];

  it("chaque cercle de la carte est à plus de 40 unités de ces villes", () => {
    const { container } = render(<CarteFrance titre="t" titreId="t3" />);
    const cercles = [...container.querySelectorAll("svg > circle, svg > g:not(:first-of-type)")];
    expect(cercles.length).toBeGreaterThan(0);
    const point = (c: Element) => {
      if (c.tagName === "circle")
        return [Number(c.getAttribute("cx")), Number(c.getAttribute("cy"))];
      const m = /translate\((\d+) (\d+)\)/.exec(c.getAttribute("transform") ?? "");
      return [Number(m?.[1]), Number(m?.[2])];
    };
    for (const c of cercles) {
      const [x, y] = point(c) as [number, number];
      for (const [nom, vx, vy] of VILLES) {
        expect(Math.hypot(x - vx, y - vy), `${x},${y} près de ${nom}`).toBeGreaterThan(40);
      }
    }
  });
});

describe("🔴 la carte : chaque repère est à l'intérieur du contour", () => {
  // Ray casting sur le sous-chemin principal de FRANCE (la Corse est un autre chemin).
  const nombres = /const FRANCE =\s*"M([^"]+?)Z"/.exec(VISUELS)?.[1] ?? "";
  const n = nombres.split(/\s+/).map(Number);
  const polygone: Array<[number, number]> = [];
  for (let i = 0; i + 1 < n.length; i += 2) polygone.push([n[i] as number, n[i + 1] as number]);
  const dedans = (x: number, y: number) => {
    let in_ = false;
    for (let i = 0, j = polygone.length - 1; i < polygone.length; j = i++) {
      const [xi, yi] = polygone[i] as [number, number];
      const [xj, yj] = polygone[j] as [number, number];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) in_ = !in_;
    }
    return in_;
  };

  it("le contour FRANCE est lu (plusieurs centaines de sommets)", () => {
    expect(polygone.length).toBeGreaterThan(200);
  });

  it("repères et point de démonstration sont dans la France continentale", () => {
    const { container } = render(<CarteFrance titre="t" titreId="t4" />);
    const cercles = [...container.querySelectorAll("svg > circle")];
    const demo = /translate\((\d+) (\d+)\)/.exec(
      container.querySelector("svg > g:not(:first-of-type)")?.getAttribute("transform") ?? "",
    );
    const points = cercles.map((c) => [Number(c.getAttribute("cx")), Number(c.getAttribute("cy"))]);
    points.push([Number(demo?.[1]), Number(demo?.[2])]);
    expect(points.length).toBeGreaterThan(8);
    for (const [x, y] of points as Array<[number, number]>) {
      expect(dedans(x, y), `${x},${y} hors du contour`).toBe(true);
    }
  });

  it("chaque repère (hors point de démonstration) est à au moins 6 unités du bord", () => {
    const { container } = render(<CarteFrance titre="t" titreId="t5" />);
    const reperes = [...container.querySelectorAll("svg > circle")].map(
      (c) => [Number(c.getAttribute("cx")), Number(c.getAttribute("cy"))] as [number, number],
    );
    expect(reperes.length).toBeGreaterThan(7);
    const distSegment = (x: number, y: number, a: [number, number], b: [number, number]) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const t = Math.max(
        0,
        Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)),
      );
      return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
    };
    for (const [x, y] of reperes) {
      const bord = Math.min(
        ...polygone.map((p, i) =>
          distSegment(x, y, p, polygone[(i + 1) % polygone.length] as [number, number]),
        ),
      );
      expect(bord, `${x},${y} trop près du bord`).toBeGreaterThanOrEqual(6);
    }
  });
});

describe("🔴 le JavaScript reste minimal, le rendu stable (CLS nul)", () => {
  it("aucun module qui tirerait du JS client : next/image, next/script, UI partagée", () => {
    const imports = [...SOURCES.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1] ?? "");
    for (const i of imports) {
      expect(i).not.toMatch(
        /^next\/(image|script|dynamic|link)$|@\/components\/|@radix-ui|framer|motion/,
      );
    }
  });

  it("la FAQ est un accordéon natif details/summary, six fois, sans titre DANS le summary", () => {
    expect(PAGE).toContain("<details");
    expect(PAGE).toContain("<summary>");
    expect(PAGE).toMatch(/FAQ\.questions\.map/);
    expect(FAQ.questions).toHaveLength(6);
    // Un `summary` a le rôle de bouton : un titre à l'intérieur y est invalide.
    for (const m of PAGE.matchAll(/<summary>([\s\S]*?)<\/summary>/g)) {
      expect(m[1]).not.toMatch(/<h[1-6]\b/);
      expect(m[1]).toContain("{q.question}");
    }
  });

  it("toute animation s'arrête sous prefers-reduced-motion", () => {
    const anime = [...CSS.matchAll(/\.([A-Za-z]+)\s*\{[^}]*animation:/g)].map((m) => m[1]);
    expect(anime.length).toBeGreaterThan(2);
    const reduit = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduit.length).toBeGreaterThan(0);
    for (const classe of anime) expect(reduit, classe).toContain(`.${classe}`);
    expect(reduit).toContain("animation: none");
    // Aucune boucle sans fin : chaque animation se joue UNE fois, puis s'arrête sur son
    // état final (`1 both`). Et aucune ne dure plus de 600 ms (refonte du 2026-10-27).
    expect(CSS).not.toMatch(/infinite/);
    const declarations = [...CSS.matchAll(/\banimation:\s*([^;]+);/g)].map((m) => m[1] ?? "");
    const jouees = declarations.filter((d) => d.trim() !== "none");
    expect(jouees.length).toBe(new Set(anime).size);
    for (const d of jouees) {
      expect(d, d).toMatch(/\s1\s+both$/);
      const duree = /^[\w-]+\s+(\d+(?:\.\d+)?)(ms|s)\b/.exec(d.trim());
      expect(duree, d).not.toBeNull();
      const ms = Number(duree?.[1]) * (duree?.[2] === "s" ? 1000 : 1);
      expect(ms, d).toBeLessThanOrEqual(600);
    }
    expect(CSS).not.toMatch(/animation-duration|animation-iteration-count/);
    // Les animations ne touchent pas la mise en page.
    for (const bloc of CSS.matchAll(/@keyframes[^{]+\{([\s\S]*?)\n\}/g)) {
      expect(bloc[1]).not.toMatch(/\b(width|height|top|left|margin|padding)\s*:/);
    }
  });

  it("chaque dessin SVG, RENDU, porte une largeur et une hauteur numériques et un viewBox", () => {
    const { container } = render(
      <>
        <Jauge />
        <CarteFrance titre="Carte" titreId="t" />
        <CarteFrance titre="Carte" titreId="t2" surSombre />
        <Jauge echelle={1.5} />
        {[0, 1, 2, 3].map((i) => (
          <IllustrationMoment key={`m${i}`} index={i} />
        ))}
        {[0, 1].map((i) => (
          <IllustrationMoment key={`t${i}`} index={i} taille={30} />
        ))}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <PictoSecteur key={`s${i}`} index={i} />
        ))}
        <PictoSecteur index={3} taille={26} />
        {(["heures", "automatisation", "equipe", "site", "micro", "calendrier"] as const).map(
          (nom) => (
            <PictoTour key={nom} nom={nom} />
          ),
        )}
        <PictoTour nom="calendrier" taille={32} />
        <PictoVisio taille={32} />
        <Fleche />
      </>,
    );
    const svgs = [...container.querySelectorAll("svg")];
    expect(svgs).toHaveLength(28);
    // Les pictogrammes du Tour : 48 px par défaut, aucun texte, aucune couleur en dur.
    for (const svg of svgs.slice(-9, -3)) expect(svg.getAttribute("width")).toBe("48");
    for (const svg of svgs) {
      for (const dim of ["width", "height"]) {
        const v = svg.getAttribute(dim) ?? "";
        expect(v, `${dim}="${v}"`).toMatch(/^\d+(\.\d+)?$/);
        expect(Number(v)).toBeGreaterThan(0);
      }
      const vb = (svg.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
      expect(vb).toHaveLength(4);
      // Le rapport largeur/hauteur est celui du viewBox : la place réservée est la bonne.
      const rapport = Number(svg.getAttribute("width")) / Number(svg.getAttribute("height"));
      expect(rapport).toBeCloseTo((vb[2] ?? 0) / (vb[3] ?? 1), 2);
    }
    cleanup();
  });

  it("UNE seule image matricielle : la photo du fondateur, native, en différé, 128 × 128", async () => {
    // Dans le code : une seule balise <img>, aucune <picture>, aucune image en CSS.
    expect(sansCommentaires(PAGE).match(/<img\b/g)).toHaveLength(1);
    expect(PAGE).not.toMatch(/<picture\b|background-image:\s*url/);
    expect(CSS).not.toMatch(/url\(/);
    // Rendue : une seule <img>, celle du fondateur, sous le pli.
    const { container } = await rendrePage();
    const images = [...container.querySelectorAll("img")];
    expect(images).toHaveLength(1);
    const img = images[0] as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/illustrations/william-fondateur-axion-ia.webp");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("decoding")).toBe("async");
    expect(img.getAttribute("width")).toBe("128");
    expect(img.getAttribute("height")).toBe("128");
    expect(img.getAttribute("alt")).toBe(FONDATEUR.alt);
    expect(img.className).toContain("rounded-full");
    expect(img.className).toMatch(/\bh-32 w-32\b/);
    // Le LCP reste le texte du H1 : l'image vient bien après lui.
    const h1 = container.querySelector("h1") as HTMLElement;
    expect(h1.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    cleanup();
  });

  it("🔴 aucune balise <video> tant que VIDEO_HEROS est nul : la boîte porte la frise", async () => {
    expect(VIDEO_HEROS).toBeNull();
    const { container } = await rendrePage();
    expect(container.querySelectorAll("video, iframe")).toHaveLength(0);
    const frise = container.querySelector(`ol[aria-label="${HEROS.friseTitre}"]`);
    expect(frise?.querySelectorAll("li")).toHaveLength(3);
    expect(frise?.parentElement?.className).toMatch(/sm:aspect-video/);
    cleanup();
  });

  it("l'emplacement vidéo : sans vidéo, ses enfants ; avec, un <video> natif sous-titré, sans script", () => {
    const vide = render(
      <EmplacementVideo video={null} titre="Titre">
        <p>frise</p>
      </EmplacementVideo>,
    );
    expect(vide.container.querySelector("video")).toBeNull();
    expect(vide.container.textContent).toBe("frise");
    cleanup();

    const { container } = render(
      <EmplacementVideo
        video={{ mp4: "/videos/tour.mp4", poster: "/videos/tour.webp", vtt: "/videos/tour.vtt" }}
        titre="Le Tour en vidéo"
      >
        <p>frise</p>
      </EmplacementVideo>,
    );
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(container.textContent).not.toContain("frise");
    expect(video.hasAttribute("controls")).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.getAttribute("preload")).toBe("none");
    expect(video.getAttribute("poster")).toBe("/videos/tour.webp");
    expect(video.getAttribute("aria-label")).toBe("Le Tour en vidéo");
    expect(video.querySelector("source")?.getAttribute("src")).toBe("/videos/tour.mp4");
    const piste = video.querySelector("track");
    expect(piste?.getAttribute("kind")).toBe("captions");
    expect(piste?.getAttribute("srclang")).toBe("fr");
    expect(piste?.hasAttribute("default")).toBe(true);
    expect(piste?.getAttribute("src")).toBe("/videos/tour.vtt");
    // La boîte réserve sa place en 16/9 : CLS nul.
    expect(video.parentElement?.className).toMatch(/\baspect-video\b/);
    expect(sansCommentaires(VIDEO)).not.toMatch(/youtube|vimeo|<iframe|<script|"use client"/i);
    cleanup();
  });
});

describe("🔴 le vocabulaire de la landing", () => {
  const texte = toutLeTexte();

  it("aucun mot du cyclisme, aucune action interdite, aucun emoji", () => {
    // Le texte seul pour « col » : les sources portent des classes `flex-col`.
    expect(texte).not.toMatch(/\bcol\b/i);
    const interdits: RegExp[] = [
      /sprint/i,
      /\bmaillot/i,
      /\bpeloton/i,
      /\bjaune\b/i,
      /candidater/i,
      /r[ée]server/i,
      /\bdevis\b/i,
      /certifi[ée]/i,
      /\bsignature\b/i,
      /\bobligatoire\b/i,
      /[ée]tincelle/i,
      /\bv[ée]lo/i,
      /\bASO\b/,
      /\p{Extended_Pictographic}/u,
    ];
    for (const motif of interdits) {
      expect(texte, String(motif)).not.toMatch(motif);
      // Sources sans commentaires : ceux du dépôt portent des repères (🔑, 🔴).
      expect(sansCommentaires(SOURCES), String(motif)).not.toMatch(motif);
    }
  });

  it("aucun chiffre hors de ceux du concept : pas de compteur, pas de statistique", () => {
    const chiffres = new Set(texte.match(/\d+/g) ?? []);
    for (const c of chiffres) expect(["1", "3", "4", "5", "15", "30"], c).toContain(c);
  });

  it("« offert » et « gratuit » ne disent jamais la visio : elle est « sans engagement »", () => {
    expect(MICRO_TEXTE_CTA).toBe("Visio de 30 minutes · sans engagement");
    expect(texte).not.toMatch(/visio[^.\n]*(gratuite|offerte)|gratuite et sans engagement/i);
    // La phrase est écrite UNE fois (contenu.ts) ; la page la cite sous les deux grands boutons.
    expect(PAGE.match(/\{MICRO_TEXTE_CTA\}/g)).toHaveLength(2);
  });

  it("ni promesse de résultat ni construction du slogan d'Axion (« partout… sauf »)", () => {
    // « partout » n'est permis que dans l'accroche validée : le H1, et le texte
    // alternatif de l'image de partage, qui la recopie.
    expect(texte.split(HEROS.titreAvant).length - 1).toBe(2);
    expect(texte.replaceAll(HEROS.titreAvant, "")).not.toMatch(/\bpartout\b/i);
    expect(texte).not.toMatch(/\bsauf\b/i);
    expect(texte).not.toMatch(/d[èe]s le lendemain|ce que vous ne voyez plus|gagner du temps/i);
    // L'audit « chiffre » ou « met en évidence » : il ne garantit rien.
    expect(texte).not.toMatch(/garanti|assur[ée]|à coup sûr|sans engagement de r[ée]sultat/i);
    expect(texte).toMatch(/L’audit du matin, chiffré\./);
  });

  it("la carte ne nomme aucune ville et le dit ; les dessins ne portent aucun texte", () => {
    expect(VISUELS).not.toMatch(/<text\b|<tspan\b|<foreignObject\b/);
    expect(texte).toMatch(/aucune ville n’est encore annoncée/);
  });
});
