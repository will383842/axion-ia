/**
 * GÉNÉRATEUR DU KIT FORMATEUR IMPRIMÉ — un classeur A4 par formation.
 *
 * ## Le problème que ce script résout
 *
 * Chaque bloc de chaque formation porte un plan B : ce que le formateur fait
 * quand l'outil tombe en panne devant la salle. Tous ces plans B reposent sur
 * des pièces IMPRIMÉES — sorties de démonstration datées, grilles, corrigés,
 * trames. L'inventaire `_AUDIT/KIT-FORMATEUR-INVENTAIRE-2026-08-07.md` en a
 * recensé 254 sur les 22 formations.
 *
 * ## Pourquoi générer plutôt que rédiger à la main
 *
 * 91 de ces pièces sont des SORTIES D'OUTIL à capturer, et chacune se capture
 * en collant un prompt précis — celui de la démonstration, déjà écrit dans la
 * fiche. Recopier 91 prompts à la main, c'est refabriquer exactement la panne
 * que la PR #553 vient de réparer : des renvois inventés indépendamment les uns
 * des autres, qui divergent de la fiche dès la première correction. Ici le
 * prompt de la fiche EST le prompt de la fiche de capture ; il ne peut pas
 * dériver.
 *
 * Ce qui demande une plume — quiz, corrigés, textes à erreurs plantées,
 * documents fictifs — ne se génère pas. Ces pièces sont écrites à la main dans
 * `_KIT/<slug>/pieces.html` et ce script les incorpore telles quelles, en
 * lisant leur désignation dans les attributs `data-*` de chaque `<section>`.
 *
 * ## Ce que produit le script
 *
 *   _KIT/<slug>/kit-formateur.html   ← page de garde + sommaire + pièces
 *                                       rédigées + fiches de capture + annexe
 *
 * Le PDF se produit ensuite depuis ce HTML (Chrome `--print-to-pdf`, cf. le
 * README du dossier `_KIT`).
 *
 * ## Aucun numéro de page, jamais
 *
 * Les pièces se désignent A1, A2… B1, B2… — jamais « page 17 ». C'est la leçon
 * des 154 renvois retirés : une pagination inventée ne survit pas à la première
 * pièce ajoutée, et un formateur en panne cherche alors une page qui n'existe
 * pas.
 *
 * Usage : pnpm tsx scripts/kit-formateur/build-kits.ts [slug…]
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";
import { ENRICHISSEMENTS } from "@/content/formations/modules";
import type { EnrichissementModule } from "@/content/formations/modules";

// ─────────────────────────────────────────────────────────────────────────────
// Types locaux
// ─────────────────────────────────────────────────────────────────────────────

/** Une pièce rédigée à la main, déclarée par les `data-*` de sa `<section>`. */
interface PieceRedigee {
  code: string;
  titre: string;
  bloc: string;
  tirage: string;
  /**
   * `mod-2` si cette pièce EST la fiche de capture de ce module.
   *
   * Une fiche de capture écrite à la main porte ce qu'un script ne peut pas
   * dériver : la parade prévue quand la démonstration tombe à plat, le découpage
   * en couples, les points de contrôle avant impression. Là où elle existe, le
   * générateur s'efface — sinon le classeur porterait deux fiches pour la même
   * démonstration, et le formateur ne saurait pas laquelle fait foi.
   */
  couvre: string;
}

/** Une fiche de capture, dérivée d'une démonstration. */
interface FicheCapture {
  code: string;
  moduleId: string;
  moduleTitre: string;
  prompt: string;
  captureEcran: string;
  outil: string;
  verifieLe: string;
  planB: string;
}

/** Ce qu'un plan B exige, bloc par bloc — l'annexe qui ne perd rien. */
interface ExigencePlanB {
  moduleTitre: string;
  bloc: string;
  texte: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitaires
// ─────────────────────────────────────────────────────────────────────────────

const RACINE_KIT = "_KIT";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Texte libre → HTML : échappé, sauts de ligne préservés. */
function escMultiligne(s: string): string {
  return esc(s).replace(/\n/g, "<br />");
}

const LIBELLE_BLOC: Readonly<Record<string, string>> = {
  objectif: "Objectif",
  demonstration: "Démonstration",
  pratique: "Pratique",
  verification: "Vérification",
  synthese: "Synthèse",
};

/**
 * Un plan B qui n'exige aucune pièce imprimée.
 *
 * « Aucun outil en jeu » est la formule des blocs qui ne dépendent de rien —
 * les lister dans l'annexe des exigences noierait les vraies dépendances.
 */
function nExigeRien(planB: string): boolean {
  const t = planB.trim().toLowerCase();
  return t.startsWith("aucun outil en jeu") || t === "";
}

function planBDe(bloc: { notes?: { planB?: string } } | undefined): string {
  return bloc?.notes?.planB ?? "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecture des pièces rédigées à la main
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrait les désignations des pièces rédigées.
 *
 * Le fragment porte sa propre table des matières : chaque `<section class="piece"
 * data-piece="A1" data-titre="…" data-bloc="…" data-tirage="…">` se déclare.
 * Garder la désignation COLLÉE à la pièce est ce qui empêche le sommaire de
 * mentir — un sommaire tenu à part diverge au premier ajout.
 */
function lirePiecesRedigees(fragment: string): PieceRedigee[] {
  const pieces: PieceRedigee[] = [];
  const re = /<section\b[^>]*\bdata-piece="([^"]+)"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment)) !== null) {
    const balise = m[0];
    const code = m[1] ?? "";
    const attr = (nom: string): string => {
      const a = new RegExp(`\\b${nom}="([^"]*)"`).exec(balise);
      return a?.[1] ?? "";
    };
    pieces.push({
      code,
      titre: attr("data-titre"),
      bloc: attr("data-bloc"),
      tirage: attr("data-tirage"),
      couvre: attr("data-couvre"),
    });
  }
  return pieces;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feuille de style — impression A4, noir et blanc
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
html { font-size: 11pt; }
body { font-family: Georgia, "Times New Roman", serif; color: #111; line-height: 1.45; margin: 0; }
h1, h2, h3, .piece-badge, th, .banniere, .champ-date, .encadre-titre { font-family: "Segoe UI", Arial, sans-serif; }
h1 { font-size: 20pt; margin: 0 0 4mm; }
h2 { font-size: 14pt; border-bottom: 2px solid #111; padding-bottom: 1mm; margin: 0 0 4mm; }
h3 { font-size: 11.5pt; margin: 5mm 0 2mm; }
p { margin: 0 0 2.5mm; }
ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
li { margin-bottom: 1.2mm; }
table { border-collapse: collapse; width: 100%; margin: 0 0 4mm; }
th, td { border: 1px solid #444; padding: 1.8mm 2.5mm; text-align: left; vertical-align: top; font-size: 10pt; }
th { background: #eee; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.03em; }
.piece { page-break-before: always; }
.piece-badge { display: inline-block; border: 2px solid #111; padding: 1mm 3mm; font-weight: bold; font-size: 10pt; margin-bottom: 2mm; }
.piece-usage { font-style: italic; color: #333; margin-bottom: 4mm; }
.banniere { border: 1.5px solid #111; background: #f3f3f3; padding: 2mm 3mm; font-size: 9pt; margin: 3mm 0; }
.champ-date { border: 1.5px dashed #111; padding: 2mm 3mm; font-size: 9.5pt; margin: 3mm 0; }
.encadre { border: 1.5px solid #111; padding: 3mm 4mm; margin: 0 0 4mm; }
.encadre-titre { font-weight: bold; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 1.5mm; }
.lignes { border-bottom: 1px solid #999; height: 8mm; }
.texte-exercice { border: 1px solid #444; padding: 4mm 5mm; font-size: 10.5pt; line-height: 1.7; margin: 0 0 4mm; }
.corrige { background: #f6f6f6; border: 1px dashed #444; padding: 3mm 4mm; margin: 0 0 4mm; }
.prompt-bloc { font-family: Consolas, "Courier New", monospace; font-size: 9.5pt; border: 1px solid #444; background: #fafafa; padding: 3mm 4mm; white-space: pre-wrap; margin: 0 0 4mm; }
.deux-colonnes { display: flex; gap: 6mm; }
.deux-colonnes > div { flex: 1; }
.petit { font-size: 9pt; color: #333; }
.verso-note { text-align: center; font-style: italic; margin-top: 8mm; }
.coche { display: inline-block; width: 4mm; height: 4mm; border: 1.2px solid #111; vertical-align: middle; margin-right: 2mm; }
.manque { border: 2px solid #111; background: #f3f3f3; padding: 3mm 4mm; margin: 0 0 4mm; }
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// Fabrication d'un kit
// ─────────────────────────────────────────────────────────────────────────────

function sectionGarde(
  titre: string,
  duree: string,
  slug: string,
  nbModules: number,
  redigees: PieceRedigee[],
  captures: FicheCapture[],
): string {
  // Un verso ou un corrigé prolonge sa pièce : il ne prend pas sa propre ligne
  // au sommaire. Seule une section portant une désignation en ouvre une.
  const lignes = [
    ...redigees
      .filter((p) => p.titre.length > 0)
      .map(
        (p) =>
          `<tr><td><strong>${esc(p.code)}</strong></td><td>${esc(p.titre)}</td><td>${esc(p.bloc)}</td><td>${esc(p.tirage)}</td></tr>`,
      ),
    ...captures.map(
      (c) =>
        `<tr><td><strong>${esc(c.code)}</strong></td><td>Sorties de la démonstration — ${esc(c.moduleTitre)} <em>(à capturer)</em></td><td>${esc(c.moduleId)}, démonstration</td><td>1 jeu formateur + 1 par table</td></tr>`,
    ),
  ].join("\n          ");

  const avertissementSansPieces =
    redigees.length === 0
      ? `<div class="manque">
        <strong>⛔ Ce kit n'est pas complet.</strong> Les pièces rédigées — quiz, corrigés, grilles, textes
        d'exercice, documents fictifs — restent à écrire : elles demandent une plume, pas un script. L'annexe
        « Ce que les plans B exigent » liste, bloc par bloc, exactement ce qu'il manque. En l'état, ce classeur
        fournit les fiches de capture et le cahier des charges des pièces à produire.
      </div>`
      : "";

  return `<section>
      <h1>Kit formateur imprimé<br />« ${esc(titre)} » — ${esc(duree)}</h1>
      <p><strong>Version du kit :</strong> 2026-08-08 · <strong>Formation :</strong> <code>${esc(slug)}</code> · ${nbModules} modules</p>

      ${avertissementSansPieces}

      <div class="encadre">
        <div class="encadre-titre">À quoi sert ce kit</div>
        <p>
          Chaque bloc de la formation porte un plan B : ce que vous faites quand l'outil tombe en panne devant la
          salle — quota atteint, service indisponible, réseau saturé, vidéoprojecteur mort. Toutes ces parades
          reposent sur les pièces imprimées de ce classeur.
          <strong>Sans ce kit imprimé et complet, la session ne se tient pas.</strong>
        </p>
      </div>

      <div class="encadre">
        <div class="encadre-titre">Trois règles, avant d'imprimer</div>
        <ul>
          <li>
            <strong>Chaque sortie d'outil porte sa date de capture.</strong> Les pièces B sont des sorties réelles à
            capturer dans l'outil retenu pour la session — jamais des reconstitutions. Une capture de plus de trois
            mois se refait : une interface disparue décrédibilise la démonstration en direct.
          </li>
          <li>
            <strong>Chaque trame remise porte la mention « projet — à faire valider par votre conseil avant
            diffusion »</strong>, non retirable. Le formateur n'arbitre aucune question juridique.
          </li>
          <li>
            <strong>Les pièces se désignent par leur code</strong> (A1, B2…), jamais par un numéro de page : une
            pagination ne survit pas à la première pièce ajoutée, et un formateur en panne chercherait une page
            inexistante.
          </li>
        </ul>
      </div>

      <h2>Sommaire des pièces</h2>
      <table>
        <thead>
          <tr><th>Pièce</th><th>Désignation</th><th>Sert au bloc</th><th>Tirage conseillé</th></tr>
        </thead>
        <tbody>
          ${lignes}
        </tbody>
      </table>

      <h2>Liste de contrôle — avant la session</h2>
      <ul>
        <li><span class="coche"></span> Toutes les pièces A imprimées aux tirages conseillés ci-dessus.</li>
        <li><span class="coche"></span> Pièces B capturées dans l'outil de la session, <strong>datées</strong>, de moins de trois mois.</li>
        <li><span class="coche"></span> Deux <strong>comptes de secours</strong> créés et testés sur l'outil retenu.</li>
        <li><span class="coche"></span> Surligneurs (un par stagiaire) et chronomètre.</li>
        <li><span class="coche"></span> Corrigés formateur rangés <strong>séparément</strong> des pièces à distribuer.</li>
      </ul>
    </section>`;
}

function sectionCapture(c: FicheCapture): string {
  return `<section class="piece">
      <div class="piece-badge">Pièce ${esc(c.code)} — fiche de capture</div>
      <h2>À capturer — ${esc(c.moduleTitre)}</h2>
      <p class="piece-usage">
        À produire AVANT la session, dans l'outil retenu. Une conversation NEUVE par demande. Imprimer chaque sortie
        avec la demande visible, puis annoter à la main comme indiqué. Jamais de reconstitution : les sorties du kit
        ont été vérifiées, une sortie inventée ne l'est pas.
      </p>
      <div class="champ-date">
        <strong>Capturé le :</strong> ____ / ____ / 20____ · <strong>Outil et version :</strong> ______________________ ·
        <strong>Par :</strong> ______________
      </div>

      <h3>La demande à coller, telle quelle</h3>
      <div class="prompt-bloc">${escMultiligne(c.prompt)}</div>

      <h3>Ce qu'il faut imprimer et annoter</h3>
      <p>${escMultiligne(c.captureEcran)}</p>

      <h3>L'outil</h3>
      <p>${escMultiligne(c.outil)}</p>

      <div class="encadre">
        <div class="encadre-titre">Le plan B que cette pièce rend possible</div>
        <p>${escMultiligne(c.planB)}</p>
      </div>

      <p class="petit">
        Dernière vérification du contenu de la fiche : ${esc(c.verifieLe)}. Si la capture ne porte pas la
        démonstration (aucun écart visible, sortie hors sujet), recommencer dans une conversation neuve — on
        n'imprime que des sorties qui tiennent devant la salle.
      </p>
    </section>`;
}

function sectionAnnexe(exigences: ExigencePlanB[]): string {
  const lignes = exigences
    .map(
      (e) =>
        `<tr><td>${esc(e.moduleTitre)}</td><td>${esc(e.bloc)}</td><td>${escMultiligne(e.texte)}</td></tr>`,
    )
    .join("\n          ");

  return `<section class="piece">
      <div class="piece-badge">Annexe</div>
      <h2>Ce que les plans B exigent, bloc par bloc</h2>
      <p class="piece-usage">
        Extrait automatiquement du contenu rédigé de la formation : le texte ci-dessous est celui que le formateur
        lira dans son guide d'animation. C'est le cahier des charges du kit — toute pièce citée ici et absente du
        sommaire reste à produire.
      </p>
      <table>
        <thead><tr><th style="width: 26%">Module</th><th style="width: 14%">Bloc</th><th>Ce que le plan B exige</th></tr></thead>
        <tbody>
          ${lignes}
        </tbody>
      </table>
    </section>`;
}

function construireKit(slug: string, modules: readonly EnrichissementModule[]): string | null {
  const formation = FORMATIONS_V2.find((f) => f.id === slug);
  if (!formation) {
    console.warn(`  ⚠️  ${slug} — absent du catalogue, ignoré`);
    return null;
  }

  const titreModule = (moduleId: string): string => {
    const m = /^mod-(\d+)$/.exec(moduleId);
    const i = m?.[1] ? Number.parseInt(m[1], 10) - 1 : -1;
    return formation.programme[i]?.titreFr ?? moduleId;
  };

  const cheminFragment = join(RACINE_KIT, slug, "pieces.html");
  const fragment = existsSync(cheminFragment) ? readFileSync(cheminFragment, "utf8") : "";
  const redigees = lirePiecesRedigees(fragment);
  const modulesCouverts = new Set(redigees.map((p) => p.couvre).filter((c) => c.length > 0));

  const captures: FicheCapture[] = [];
  const exigences: ExigencePlanB[] = [];

  for (const mod of modules) {
    const moduleTitre = titreModule(mod.moduleId);

    // Une fiche de capture par démonstration portant un prompt — sauf là où une
    // fiche écrite à la main couvre déjà le module.
    const demo = mod.demonstration;
    if (
      !modulesCouverts.has(mod.moduleId) &&
      typeof demo?.prompt === "string" &&
      demo.prompt.trim().length > 0
    ) {
      captures.push({
        code: `B${captures.length + 1}`,
        moduleId: mod.moduleId,
        moduleTitre,
        prompt: demo.prompt,
        captureEcran:
          demo.captureEcran ?? "Imprimer la sortie telle qu'elle s'affiche, demande visible.",
        outil: demo.outil ?? "L'outil retenu avec l'entreprise pour la session.",
        verifieLe: demo.verifieLe ?? "non renseigné",
        planB: planBDe(demo),
      });
    }

    // L'annexe ne perd aucun plan B qui exige une pièce.
    for (const [cle, libelle] of Object.entries(LIBELLE_BLOC)) {
      const bloc = (mod as unknown as Record<string, { notes?: { planB?: string } }>)[cle];
      const texte = planBDe(bloc);
      if (!nExigeRien(texte)) {
        exigences.push({ moduleTitre, bloc: libelle, texte });
      }
    }
  }

  const corps = [
    sectionGarde(formation.titreFr, formation.duree, slug, modules.length, redigees, captures),
    fragment.trim(),
    ...captures.map(sectionCapture),
    sectionAnnexe(exigences),
  ]
    .filter((s) => s.length > 0)
    .join("\n\n    ");

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Kit formateur — ${esc(formation.titreFr)} (${esc(formation.duree)})</title>
    <style>
${CSS}
    </style>
  </head>
  <body>
    ${corps}
  </body>
</html>
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entrée
// ─────────────────────────────────────────────────────────────────────────────

function main(): void {
  const demandes = process.argv.slice(2);
  const slugs = demandes.length > 0 ? demandes : Object.keys(ENRICHISSEMENTS);

  let produits = 0;
  let avecPieces = 0;

  for (const slug of slugs) {
    const modules = ENRICHISSEMENTS[slug];
    if (!modules) {
      console.warn(`  ⚠️  ${slug} — aucun contenu rédigé, ignoré`);
      continue;
    }
    const html = construireKit(slug, modules);
    if (html === null) continue;

    const dossier = join(RACINE_KIT, slug);
    mkdirSync(dossier, { recursive: true });
    writeFileSync(join(dossier, "kit-formateur.html"), html, "utf8");
    produits += 1;
    if (existsSync(join(dossier, "pieces.html"))) avecPieces += 1;
  }

  console.log(
    `${produits} kits produits — dont ${avecPieces} avec leurs pièces rédigées, ` +
      `${produits - avecPieces} en attente de rédaction.`,
  );
}

main();
