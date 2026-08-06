/**
 * Qualiopi — Lecture du programme détaillé pour le document « Programme ».
 *
 * ## Pourquoi ce module existe plutôt qu'un `as ModuleContenu[]`
 *
 * `Formation.programmeDetaille` est un `Json` qui porte TROIS formes distinctes
 * en production, toutes légitimes et toutes vivantes :
 *
 *   1. une **chaîne** JSON (import catalogue passé par une sérialisation) ;
 *   2. un **tableau** de modules `[{ moduleId, titre, dureeMin, sequences }]`
 *      (formations issues du catalogue) ;
 *   3. un **objet** `{ modules: [...], persona, contenuDetaille, fil_rouge, … }`
 *      (formations produites par le moteur de contenu).
 *
 * `supports-service.ts` traite déjà les trois — c'est de là que vient cette
 * tolérance, et la reproduire ici est délibéré : un document légal ne doit pas
 * dépendre du module « supports », qui appartient à la chaîne pédagogique et
 * peut évoluer pour ses propres raisons.
 *
 * 🔴 Ce module ne LÈVE JAMAIS et ne devine JAMAIS. Une donnée qu'il ne sait pas
 * lire produit une liste vide, et l'appelant le dit sur la pièce (« programme
 * non structuré »), plutôt que d'imprimer une annexe qui aurait l'air complète.
 * Une convention qui annexe un programme faux est pire qu'une convention qui
 * annexe un programme visiblement incomplet.
 *
 * Module PUR — testable sans base.
 */

/** Séquence telle qu'imprimée : un titre, une durée facultative. */
export interface SequenceProgramme {
  titre: string;
  dureeMin: number | null;
  /**
   * Nature pédagogique de la séquence (`objectif`, `demonstration`, `pratique`,
   * `verification`, `synthese`, `cadre`, `pause`), ou `null` sur un programme
   * qui n'en porte pas.
   *
   * Les gabarits imprimés ne s'en servent pas — une annexe de convention ne
   * qualifie pas ses séquences. La console, elle, en a besoin : c'est ce qui
   * distingue un atelier d'un exposé, et donc ce qui décide du ratio de
   * pratique. Le lecteur l'écartait, ce qui obligeait la console à relire le
   * JSON brut en parallèle — deux lectures d'une même donnée, la porte ouverte
   * à deux verdicts.
   */
  type: string | null;
}

/** Module tel qu'imprimé : un titre, une durée facultative, ses séquences. */
export interface ModuleProgramme {
  titre: string;
  dureeMin: number | null;
  sequences: SequenceProgramme[];
}

/** Chaîne non vide après trim, sinon null. */
function texte(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Durée en minutes, ou `null`.
 *
 * Refuse zéro, les négatifs et les non-entiers : imprimer « 0 min » en face
 * d'un module donnerait à lire que le module ne dure pas, alors que la seule
 * chose établie est qu'on ne sait pas.
 */
function dureeMin(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (!Number.isInteger(v) || v <= 0) return null;
  return v;
}

/** Déballe la valeur Prisma : chaîne JSON → objet, sinon telle quelle. */
function deballer(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * Les modules TELS QUELS, une fois la forme de stockage déballée — chaîne JSON,
 * tableau direct, ou objet `{ modules }`.
 *
 * 🔴 `lireModulesProgramme` NORMALISE pour l'impression : il ne garde que titre,
 * durée et séquences, et écarte donc les cinq blocs du contenu pédagogique. Le
 * générateur de diaporama, branché dessus, recevait des modules vides et
 * produisait un deck de six slides sans une seule ligne de contenu. Le défaut
 * n'était visible nulle part : le fichier se produisait, il était simplement
 * creux.
 *
 * Les deux lecteurs partagent donc le déballage et divergent sur le contrat :
 * l'un rend ce qui s'imprime, l'autre rend tout. Le déballage, lui, n'est écrit
 * qu'une fois — c'est lui qui porte la connaissance des trois formes.
 */
export function modulesBrutsProgramme(programmeDetaille: unknown): unknown[] {
  return extraireModulesBruts(programmeDetaille);
}

/**
 * Ordre de résolution : tableau direct, puis `contenuDetaille.modules`, puis
 * `modules` — la forme produite par le moteur de contenu passe devant, étant la
 * plus riche et la plus fidèle à ce qui sera réellement animé.
 */
function extraireModulesBruts(programmeDetaille: unknown): unknown[] {
  const raw = deballer(programmeDetaille);
  if (Array.isArray(raw)) return raw;
  if (raw === null || typeof raw !== "object") return [];

  const obj = raw as Record<string, unknown>;

  const contenu = obj["contenuDetaille"];
  if (contenu !== null && typeof contenu === "object") {
    const modulesRiches = (contenu as Record<string, unknown>)["modules"];
    if (Array.isArray(modulesRiches) && modulesRiches.length > 0) return modulesRiches;
  }

  const modules = obj["modules"];
  if (Array.isArray(modules)) return modules;

  return [];
}

/** Normalise une séquence brute. `null` si elle n'a même pas de titre. */
function lireSequence(brut: unknown): SequenceProgramme | null {
  if (brut === null || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const titre = texte(o["titre"]);
  if (titre === null) return null;
  return { titre, dureeMin: dureeMin(o["dureeMin"]), type: texte(o["type"]) };
}

/**
 * Modules du programme, prêts à imprimer.
 *
 * Un module sans titre est ÉCARTÉ plutôt que rendu « Module sans titre » :
 * l'annexe d'une convention n'est pas l'endroit où signaler un défaut de
 * saisie, et une entrée vide au milieu d'un programme se lit comme une erreur
 * d'impression.
 */
export function lireModulesProgramme(programmeDetaille: unknown): ModuleProgramme[] {
  const bruts = extraireModulesBruts(programmeDetaille);
  const modules: ModuleProgramme[] = [];

  for (const brut of bruts) {
    if (brut === null || typeof brut !== "object") continue;
    const o = brut as Record<string, unknown>;
    const titre = texte(o["titre"]);
    if (titre === null) continue;

    const sequencesBrutes = Array.isArray(o["sequences"]) ? (o["sequences"] as unknown[]) : [];
    const sequences = sequencesBrutes
      .map(lireSequence)
      .filter((s): s is SequenceProgramme => s !== null);

    modules.push({ titre, dureeMin: dureeMin(o["dureeMin"]), sequences });
  }

  return modules;
}

/**
 * Durée totale déclarée par les modules, en minutes. `null` si aucune durée
 * n'est exploitable.
 *
 * ⚠️ Sert à COMPARER avec la durée contractuelle de l'action, jamais à la
 * remplacer : c'est `dureeHeures` qui engage, et le programme ne doit pas
 * pouvoir annoncer un volume différent de la convention. Quand les deux
 * divergent, le gabarit imprime la durée contractuelle et tait le total des
 * modules — un écart de découpage pédagogique n'est pas un écart contractuel,
 * mais l'afficher inviterait un auditeur à le lire comme tel.
 */
export function totalDureeModulesMin(modules: ModuleProgramme[]): number | null {
  let total = 0;
  let vu = false;
  for (const m of modules) {
    if (m.dureeMin !== null) {
      total += m.dureeMin;
      vu = true;
      continue;
    }
    for (const s of m.sequences) {
      if (s.dureeMin !== null) {
        total += s.dureeMin;
        vu = true;
      }
    }
  }
  return vu ? total : null;
}

/** « 1 h 30 », « 45 min », « 2 h ». `null` en entrée ⇒ `null`. */
export function formaterDuree(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

/**
 * Retire le préfixe « Module N — » que les titres portent DÉJÀ.
 *
 * 🔴 Les titres de modules issus de la génération de contenu commencent presque
 * tous par « Module 1 — », « Module 2 — »… Toute pièce qui préfixe à son tour
 * imprime le libellé deux fois.
 *
 * Constaté sur `AXI-DOC-2026-002` (« Module 1 — Module 1 — L'IA… »), corrigé
 * dans `programme-formation.tsx`, et **retrouvé intact le 04/08 dans les
 * supports pédagogiques** — « Module mod-1 : Module 1 — L'IA dans le métier
 * immobilier » sur les 167 supports générés. Le correctif vivait en copie
 * privée dans un seul gabarit ; la deuxième famille de pièces ne pouvait pas en
 * bénéficier. Il est ici pour que la troisième n'ait pas à le réécrire.
 *
 * ⚠️ Tolère les trois tirets (—, –, -) et l'absence d'espace : les titres
 * générés ne sont pas normalisés.
 *
 * 🔴 Depuis le 2026-08-06, les titres du catalogue portent AUSSI leur repère de
 * demi-journée — « Matin · Module 1 — … », « Après-midi J2 · Module 5 — … ». Ce
 * repère existe pour que la timeline publique sache quand l'horloge repart à
 * 9 h ou à 14 h ; il n'a rien à faire sur une couverture de diaporama ni dans
 * une annexe de convention, où il se lit comme une coquille. Il se retire ici,
 * une fois, pour toutes les familles de pièces.
 */
/**
 * Repère de demi-journée en tête de titre : « Matin · », « Après-midi J2 · »,
 * « Demi-journée — », « Jour 1 — ».
 *
 * ⚠️ Pas de `\b` : en JavaScript, `\b` se calcule sur `\w`, qui EXCLUT les
 * lettres accentuées. « matin\b » matcherait donc à l'intérieur de « Matinée »,
 * et « Matinée d'accueil » perdrait son titre entier. C'est un séparateur
 * explicite — point médian ou tiret — qui prouve qu'on a affaire à un repère et
 * non au premier mot du titre. Les libellés composés passent en premier dans
 * l'alternance, sans quoi « demi-journée » serait coupé par « jour ».
 */
const REPERE_DEMI_JOURNEE =
  /^\s*(?:demi-journ[ée]e|apr[èe]s-midi|matin|jour)(?:\s*j?\s*\d+)?\s*[·:—–-]\s*/i;

export function titreModuleSansPrefixe(titre: string): string {
  return titre
    .replace(REPERE_DEMI_JOURNEE, "")
    .replace(/^module\s*\d+\s*[—–-]\s*/i, "")
    .trim();
}
