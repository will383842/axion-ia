/**
 * Console éditoriale — l'évaluateur de conformité (§8 du plan, lot 1).
 *
 * Module PUR : aucun import `next`/prisma, aucun accès base. Il reçoit les
 * règles **déjà chargées** et rend des constats. C'est ce qui le rend
 * testable au cas près — et le protocole exige, pour chaque règle, un cas
 * qui passe ET un cas qui refuse.
 *
 * ── Le partage des rôles, qui est tout l'enjeu ────────────────────────────
 *
 * > **Les RÈGLES vivent en base. Le code ne porte que l'ÉVALUATEUR.**
 *
 * Aucun seuil, aucune liste, aucun motif n'est écrit ici. La fourchette de
 * tags, les 17 valeurs autorisées, les quatre UTM, les toponymes : tout vient
 * de `ed_regles_conformite`. Corriger un seuil se fait depuis la console, un
 * dimanche soir, sans pull request. Un seuil écrit en dur serait un seuil que
 * Will ne peut pas corriger.
 *
 * ── Deux conventions héritées du registre ─────────────────────────────────
 *
 * 1. **Les motifs s'évaluent en `i`, jamais en `u`.** Aucun drapeau n'est
 *    stocké : c'est l'évaluateur qui les pose. Le drapeau `u` durcirait les
 *    classes accentuées et ferait échouer des motifs valides.
 * 2. **`parametres.champs` dit OÙ chercher.** Défaut : corps, premier
 *    commentaire, tags. `lien-corps` ne regarde que le corps — un lien en
 *    PREMIER COMMENTAIRE est la pratique recommandée sur LinkedIn.
 */

import type { ChampConformite } from "@/server/editorial/referentiels/conformite";

/** Une règle telle qu'elle sort de `ed_regles_conformite`. */
export interface RegleEvaluable {
  code: string;
  libelle: string;
  motif: string;
  motifRegex: string;
  interdit: boolean;
  gravite: "info" | "avertissement" | "bloquant";
  message: string;
  parametres: Record<string, unknown> | null;
  actif: boolean;
}

/** Ce sur quoi porte le contrôle. */
export interface PublicationAControler {
  corps: string | null;
  premierCommentaire: string | null;
  accroche: string | null;
  tags: string[];
  lienUrl: string | null;
}

/**
 * Contexte externe, pour les règles qui ne se lisent pas dans le texte.
 *
 * Absent, ces règles sont rendues **`nonEvaluee`** — et surtout PAS
 * « conforme ». Un contrôle qu'on ne sait pas faire n'est pas un contrôle
 * réussi : le confondre serait la gate verte qui ne garde rien.
 */
export interface ContexteConformite {
  /** Statut de l'autorisation de droit à l'image, si la publication en dépend. */
  autorisationStatut?: string | null;
  /** Nom de l'invité, pour un message qui dit de QUI il s'agit. */
  autorisationInvite?: string | null;
  /** Assets liés, pour le contrôle de spec de plateforme. */
  assets?: readonly {
    libelle: string;
    dureeSec: number | null;
    specDureeMinSec: number | null;
    specDureeMaxSec: number | null;
  }[];
}

export type EtatConstat = "conforme" | "enfreinte" | "non_evaluee";

export interface Constat {
  code: string;
  libelle: string;
  gravite: "info" | "avertissement" | "bloquant";
  etat: EtatConstat;
  /** Message prêt à afficher, cité par le refus. Vide si conforme. */
  message: string;
  /** L'extrait fautif — le §7 l'exige : « avec le motif ET l'extrait ». */
  extrait: string | null;
  /** Pourquoi la règle n'a pas pu être évaluée, le cas échéant. */
  raisonNonEvaluee?: string;
}

const CHAMPS_PAR_DEFAUT: ChampConformite[] = ["corps", "premierCommentaire", "tags"];

/** Les règles qui exigent un contexte externe, et lequel. */
const REGLES_CONTEXTUELLES: Record<string, "autorisation" | "specs"> = {
  "droit-image": "autorisation",
  "spec-plateforme": "specs",
};

/** Les seuls champs qu'une règle peut désigner. Le `as` d'avant mentait. */
const CHAMPS_CONNUS: readonly string[] = ["corps", "premierCommentaire", "tags", "lienUrl"];

/**
 * Les champs qu'une règle inspecte, ou la liste des champs INCONNUS.
 *
 * 🔴 Défaut trouvé par la passe 4 du protocole (adversaire).
 *
 * `parametres.champs` était transtypé (`as ChampConformite[]`) sans le
 * moindre contrôle. Une règle configurée sur `["inexistant"]` n'inspectait
 * donc AUCUN texte — et une règle `interdit: true` qui ne trouve rien est
 * déclarée CONFORME. La règle `geo` ainsi mal configurée rendait vert un
 * corps citant « Grenoble ».
 *
 * C'est le piège du §1 du protocole dans sa forme la plus pure : la gate
 * verte qui ne garde rien. Une faute de frappe dans un paramètre éditable
 * depuis la console désarmait un interdit réglementaire, en silence, et
 * l'écran affichait un succès.
 *
 * L'absence de bornes rendait déjà `non_evaluee` ; un champ inconnu doit
 * faire de même. Les deux disent la même chose — « je n'ai rien pu
 * vérifier » — et c'est l'inverse de « tout va bien ».
 */
function lireChamps(regle: RegleEvaluable): {
  champs: ChampConformite[];
  inconnus: string[];
} {
  const brut = regle.parametres?.["champs"];
  if (!Array.isArray(brut) || brut.length === 0) {
    return { champs: [...CHAMPS_PAR_DEFAUT], inconnus: [] };
  }
  const demandes = brut.map(String);
  const inconnus = demandes.filter((c) => !CHAMPS_CONNUS.includes(c));
  return {
    champs: demandes.filter((c) => CHAMPS_CONNUS.includes(c)) as ChampConformite[],
    inconnus,
  };
}

function nombre(regle: RegleEvaluable, cle: string): number | null {
  const v = regle.parametres?.[cle];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function liste(regle: RegleEvaluable, cle: string): string[] | null {
  const v = regle.parametres?.[cle];
  return Array.isArray(v) ? v.map(String) : null;
}

/**
 * Remplace les jetons du message : `{extrait}`, `{min}`, `{max}`,
 * `{trouve}`, `{total}`.
 *
 * Un jeton non fourni est retiré plutôt que laissé en clair : « il faut de
 * {min} à {max} tags » affiché tel quel à l'utilisateur ferait passer la
 * console pour cassée.
 */
function rendreMessage(gabarit: string, valeurs: Record<string, string | number>): string {
  return gabarit
    .replace(/\{(\w+)\}/g, (_, cle: string) => (cle in valeurs ? String(valeurs[cle]) : ""))
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Assemble les textes à inspecter, champ par champ. */
function textesDe(
  publication: PublicationAControler,
  champs: readonly ChampConformite[],
): { champ: ChampConformite; valeur: string }[] {
  const out: { champ: ChampConformite; valeur: string }[] = [];
  for (const champ of champs) {
    if (champ === "tags") {
      for (const t of publication.tags) out.push({ champ, valeur: t });
    } else {
      const v = publication[champ];
      if (v) out.push({ champ, valeur: v });
    }
  }
  return out;
}

/** Un extrait lisible autour du fautif — jamais le texte entier. */
function extraitAutour(texte: string, index: number, longueur: number): string {
  const marge = 24;
  const debut = Math.max(0, index - marge);
  const fin = Math.min(texte.length, index + longueur + marge);
  const avant = debut > 0 ? "…" : "";
  const apres = fin < texte.length ? "…" : "";
  return `${avant}${texte.slice(debut, fin).trim()}${apres}`;
}

function conforme(regle: RegleEvaluable): Constat {
  return {
    code: regle.code,
    libelle: regle.libelle,
    gravite: regle.gravite,
    etat: "conforme",
    message: "",
    extrait: null,
  };
}

function enfreinte(
  regle: RegleEvaluable,
  extrait: string | null,
  valeurs: Record<string, string | number> = {},
): Constat {
  return {
    code: regle.code,
    libelle: regle.libelle,
    gravite: regle.gravite,
    etat: "enfreinte",
    message: rendreMessage(regle.message, { extrait: extrait ?? "", ...valeurs }),
    extrait,
  };
}

function nonEvaluee(regle: RegleEvaluable, raison: string): Constat {
  return {
    code: regle.code,
    libelle: regle.libelle,
    gravite: regle.gravite,
    etat: "non_evaluee",
    message: "",
    extrait: null,
    raisonNonEvaluee: raison,
  };
}

// ── Les règles structurelles, une par une ─────────────────────────────────

function evaluerTagsNombre(regle: RegleEvaluable, pub: PublicationAControler): Constat {
  const min = nombre(regle, "min");
  const max = nombre(regle, "max");
  if (min === null || max === null) {
    return nonEvaluee(regle, "Bornes `min`/`max` absentes des paramètres de la règle.");
  }
  const trouve = pub.tags.length;
  if (trouve >= min && trouve <= max) return conforme(regle);
  return enfreinte(regle, null, { min, max, trouve });
}

function evaluerTagsListe(regle: RegleEvaluable, pub: PublicationAControler): Constat {
  const valeurs = liste(regle, "valeurs");
  if (!valeurs) return nonEvaluee(regle, "Liste fermée absente des paramètres de la règle.");
  // Comparaison insensible à la casse : `#rgpd` et `#RGPD` désignent le même
  // sujet, et refuser l'un des deux serait une chicane, pas une garde.
  const autorises = new Set(valeurs.map((v) => v.toLowerCase()));
  const hors = pub.tags.filter((t) => !autorises.has(t.toLowerCase()));
  if (hors.length === 0) return conforme(regle);
  return enfreinte(regle, hors.join(", "), { total: valeurs.length, trouve: hors.length });
}

function evaluerMentions(regle: RegleEvaluable, pub: PublicationAControler): Constat {
  const max = nombre(regle, "max");
  if (max === null) return nonEvaluee(regle, "Plafond `max` absent des paramètres de la règle.");
  // 🔴 Même trou que dans l'évaluateur par motif : un champ inconnu ne
  // faisait inspecter AUCUN texte, donc `trouve` restait à 0, donc la règle
  // était déclarée conforme. Ici le défaut est pire : le plafond de
  // mentions passait même sur une publication qui en compte trente.
  const { champs, inconnus } = lireChamps(regle);
  if (inconnus.length > 0) {
    return nonEvaluee(
      regle,
      `Champ(s) inconnu(s) dans la configuration : ${inconnus.join(", ")}. ` +
        `Cette règle n'inspecte donc rien.`,
    );
  }
  let trouve = 0;
  for (const { valeur } of textesDe(pub, champs)) {
    // Une mention est un `@` suivi d'au moins un caractère de nom. Un `@`
    // isolé, ou une adresse e-mail, n'en est pas une.
    trouve += (valeur.match(/(?<![\w.])@[A-Za-z0-9][\w.-]*/g) ?? []).length;
  }
  if (trouve <= max) return conforme(regle);
  return enfreinte(regle, null, { max, trouve });
}

function evaluerUtm(regle: RegleEvaluable, pub: PublicationAControler): Constat {
  const requis = liste(regle, "utm");
  if (!requis) return nonEvaluee(regle, "Liste des UTM absente des paramètres de la règle.");

  // Pas de lien = rien à marquer. Exiger des UTM sur une publication qui n'en
  // porte aucun bloquerait toutes les publications sans lien.
  if (!pub.lienUrl || pub.lienUrl.trim() === "") return conforme(regle);

  let parametres: URLSearchParams;
  try {
    parametres = new URL(pub.lienUrl).searchParams;
  } catch {
    return enfreinte(regle, pub.lienUrl, { total: requis.length, trouve: 0 });
  }
  const manquants = requis.filter((u) => !parametres.get(u));
  if (manquants.length === 0) return conforme(regle);
  return enfreinte(regle, manquants.join(", "), {
    total: requis.length,
    trouve: manquants.length,
  });
}

function evaluerDroitImage(
  regle: RegleEvaluable,
  contexte: ContexteConformite | undefined,
): Constat {
  const requis = (regle.parametres?.["statutRequis"] as string | undefined) ?? "signee";
  const statut = contexte?.autorisationStatut;
  if (statut === undefined) {
    return nonEvaluee(
      regle,
      "Aucune autorisation au contexte : la publication ne dépend d'aucun invité, " +
        "ou le contexte n'a pas été fourni.",
    );
  }
  if (statut === requis) return conforme(regle);
  return enfreinte(regle, contexte?.autorisationInvite ?? "l'invité", {
    trouve: statut ?? "absente",
  });
}

function evaluerSpecPlateforme(
  regle: RegleEvaluable,
  contexte: ContexteConformite | undefined,
): Constat {
  const assets = contexte?.assets;
  if (!assets) return nonEvaluee(regle, "Aucun asset au contexte.");

  for (const a of assets) {
    if (a.dureeSec === null) continue;
    const min = a.specDureeMinSec;
    const max = a.specDureeMaxSec;
    if (max !== null && a.dureeSec > max) {
      return enfreinte(regle, a.libelle, { trouve: `${a.dureeSec} s pour ${max} s au plus` });
    }
    if (min !== null && a.dureeSec < min) {
      return enfreinte(regle, a.libelle, { trouve: `${a.dureeSec} s pour ${min} s au moins` });
    }
  }
  return conforme(regle);
}

// ── L'évaluateur ──────────────────────────────────────────────────────────

/** Évalue UNE règle. Exporté pour que les tests puissent cibler au cas près. */
export function evaluerRegle(
  regle: RegleEvaluable,
  publication: PublicationAControler,
  contexte?: ContexteConformite,
): Constat {
  if (!regle.actif) return conforme(regle);

  // Les règles structurelles, reconnues par leur code : leur logique ne
  // s'exprime pas en motif, et le code est la clé stable (le libellé, non).
  switch (regle.code) {
    case "tags-nombre":
      return evaluerTagsNombre(regle, publication);
    case "tags-liste":
      return evaluerTagsListe(regle, publication);
    case "mentions":
      return evaluerMentions(regle, publication);
    case "utm":
      return evaluerUtm(regle, publication);
    case "droit-image":
      return evaluerDroitImage(regle, contexte);
    case "spec-plateforme":
      return evaluerSpecPlateforme(regle, contexte);
    default:
      break;
  }

  if (REGLES_CONTEXTUELLES[regle.code]) {
    return nonEvaluee(regle, "Règle contextuelle sans évaluateur dédié.");
  }

  if (!regle.motifRegex) {
    return nonEvaluee(
      regle,
      "Règle sans motif ni évaluateur structurel — elle ne garde rien en l'état.",
    );
  }

  // 🔴 Le motif vient de la BASE, donc d'une saisie que personne n'a
  // relue. On le refuse AVANT de le compiler : voir `motifRisque`.
  if (motifRisque(regle.motifRegex)) {
    return nonEvaluee(
      regle,
      `Motif refusé : il contient un quantificateur dans un groupe lui-même ` +
        `quantifié (« ${regle.motifRegex} »), ce qui peut geler l'évaluation ` +
        `pendant plusieurs minutes sur un texte court. Réécrivez-le sans ` +
        `imbriquer les répétitions.`,
    );
  }

  let motif: RegExp;
  try {
    // `g` pour parcourir, `i` par convention du registre. Jamais `u`.
    motif = new RegExp(regle.motifRegex, "gi");
  } catch {
    return nonEvaluee(regle, `Motif illisible : ${regle.motifRegex}`);
  }

  const { champs, inconnus } = lireChamps(regle);
  if (inconnus.length > 0) {
    // 🔴 Surtout pas `conforme` : voir `lireChamps`.
    return nonEvaluee(
      regle,
      `Champ(s) inconnu(s) dans la configuration : ${inconnus.join(", ")}. ` +
        `Cette règle n'inspecte donc rien. Champs possibles : ` +
        `${CHAMPS_CONNUS.join(", ")}.`,
    );
  }
  if (champs.length === 0) {
    return nonEvaluee(regle, "Aucun champ à inspecter : la règle ne garde rien en l'état.");
  }

  const textes = textesDe(publication, champs);
  for (const { valeur } of textes) {
    motif.lastIndex = 0;
    // Seconde ceinture : même un motif sain ne reçoit pas un texte sans
    // borne. L'extrait fautif reste correct — il est borné bien avant.
    const trouve = motif.exec(valeur.slice(0, LONGUEUR_MAX_INSPECTEE));
    if (trouve) {
      if (regle.interdit) {
        return enfreinte(regle, extraitAutour(valeur, trouve.index, trouve[0].length));
      }
      return conforme(regle);
    }
  }

  // Rien trouvé. Une règle `interdit: true` est donc respectée ; une règle
  // `interdit: false` — « doit être présent » — est enfreinte.
  return regle.interdit ? conforme(regle) : enfreinte(regle, null);
}

export interface ResultatConformite {
  constats: Constat[];
  /** Les enfreintes bloquantes. Vide ⇒ la validation peut passer. */
  bloquantes: Constat[];
  avertissements: Constat[];
  /** Règles qu'on n'a PAS su évaluer. Ni conformes, ni enfreintes. */
  nonEvaluees: Constat[];
  /** `true` seulement si aucune enfreinte bloquante. */
  validable: boolean;
}

/**
 * Évalue toutes les règles d'un coup.
 *
 * ⚠️ `validable` ne regarde que les enfreintes **bloquantes**. Une règle
 * `non_evaluee` ne bloque pas — mais elle est rendue à part, pour que
 * l'interface puisse le dire au lieu de laisser croire à un contrôle réussi.
 */
export function evaluerConformite(
  regles: readonly RegleEvaluable[],
  publication: PublicationAControler,
  contexte?: ContexteConformite,
): ResultatConformite {
  const constats = regles.map((r) => evaluerRegle(r, publication, contexte));
  const enfreintes = constats.filter((c) => c.etat === "enfreinte");
  const bloquantes = enfreintes.filter((c) => c.gravite === "bloquant");
  return {
    constats,
    bloquantes,
    avertissements: enfreintes.filter((c) => c.gravite === "avertissement"),
    nonEvaluees: constats.filter((c) => c.etat === "non_evaluee"),
    validable: bloquantes.length === 0,
  };
}

// ── Le motif vient de la BASE : il n'est pas de confiance ─────────────────

/**
 * Longueur maximale d'un texte soumis à un motif.
 *
 * Un corps de 108 000 caractères s'évalue en 1 ms contre les 12 règles
 * réelles — la borne n'est donc pas là pour elles. Elle est là pour qu'un
 * motif mal écrit ne dispose pas d'un texte arbitrairement long.
 */
const LONGUEUR_MAX_INSPECTEE = 200_000;

/**
 * Motifs à explosion combinatoire — un quantificateur DANS un groupe
 * lui-même quantifié.
 *
 * 🔴 Défaut trouvé par la passe 4 du protocole (adversaire).
 *
 * `motifRegex` est lu en base et compilé tel quel. Le §8 fait de cette
 * modifiabilité une promesse centrale — « corriger un seuil un dimanche soir
 * sans pull request » — ce qui veut dire, en creux, qu'un motif arrive dans
 * le moteur sans passer par une revue de code. Mesuré sur `(a+)+$` :
 *
 * | Longueur du texte | Temps         |
 * | ----------------- | ------------- |
 * | 18 caractères     | 39 ms         |
 * | 24 caractères     | 273 ms        |
 * | 26 caractères     | 989 ms        |
 * | 40 caractères     | **> 2 min**   |
 *
 * JavaScript n'offre aucun délai d'expiration sur une expression régulière :
 * la seule parade est de REFUSER le motif avant de le compiler.
 *
 * ⚠️ Cette détection est une heuristique, et elle le reste. Elle attrape la
 * forme de loin la plus fréquente — `(a+)+`, `(a*)*`, `(\d+){2,}` — mais pas
 * les alternances qui se recouvrent, `(a|a)*`. Un motif qui passe ici n'est
 * donc pas prouvé sûr ; il est seulement débarrassé du piège courant. Le dire
 * vaut mieux que laisser croire à une garantie.
 */
const QUANTIFICATEUR_IMBRIQUE = /\([^()]*[+*][^()]*\)\s*[+*{]/;

/** Vrai si le motif est refusé avant même d'être compilé. */
export function motifRisque(source: string): boolean {
  return QUANTIFICATEUR_IMBRIQUE.test(source);
}
