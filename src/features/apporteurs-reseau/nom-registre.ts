/**
 * Le nom du contrat correspond-il à une personne de l'entreprise au registre ? (décision de
 * Will, 10/10)
 *
 * Le SIRET est contrôlé au registre de l'État (existe, actif, NAF), mais rien ne disait que
 * l'entreprise APPARTIENT à la personne : on pouvait taper le SIRET d'un autre. On compare donc
 * le prénom et le nom du contrat aux personnes que le registre rattache à l'entreprise (le
 * titulaire d'une entreprise individuelle, les dirigeants personnes physiques d'une société).
 *
 * Une ALERTE, jamais un blocage : un écart se confirme d'une case à cocher à la contresignature.
 *
 * ⚠️ Module PUR et sans import serveur (fonctions testées sans réseau ni base).
 */

// Imports de TYPE seuls : effacés à la compilation.
import type { PersonneRegistre, ResultatRegistre } from "./annuaire";
import { normaliserNom } from "./signature-regles";

export type ResultatNom = "correspond" | "ne_correspond_pas" | "non_verifiable";

export interface NomDuContrat {
  prenom: string;
  nom: string;
}

/** Particules ignorées pour comparer deux noms : « de » seul ne fait pas une correspondance. */
const PARTICULES = new Set([
  "d",
  "da",
  "de",
  "del",
  "der",
  "des",
  "di",
  "du",
  "el",
  "l",
  "la",
  "le",
  "les",
  "van",
  "von",
  "y",
]);

function mots(s: string | null | undefined): string[] {
  // Le registre sépare parfois les prénoms par des virgules : « MARIE, CLAIRE ».
  return normaliserNom((s ?? "").replace(/[,;/()]/g, " "))
    .split(" ")
    .filter(Boolean);
}

/** Les mots qui portent le nom (sans particules ; si tout est particule, on garde tout). */
function motsSignificatifs(s: string | null | undefined): string[] {
  const m = mots(s);
  const sans = m.filter((x) => !PARTICULES.has(x));
  return sans.length > 0 ? sans : m;
}

/**
 * Même nom de famille : identique, ou l'un est une partie de l'autre (nom d'usage composé :
 * « Martin-Dupont » au contrat, « DUPONT » au registre, ou l'inverse).
 */
function memeNom(contrat: string, registre: string): boolean {
  const a = motsSignificatifs(contrat);
  const b = motsSignificatifs(registre);
  if (a.length === 0 || b.length === 0) return false;
  const [court, long] = a.length <= b.length ? [a, b] : [b, a];
  return court.every((x) => long.includes(x));
}

/** Au moins un prénom en commun (« Marie Claire Louise » au registre, « Marie » au contrat). */
function prenomCommun(contrat: string, registre: string): boolean {
  const b = new Set(mots(registre));
  return mots(contrat).some((x) => b.has(x));
}

function personneCorrespond(c: NomDuContrat, p: PersonneRegistre): boolean {
  if (p.enBloc) {
    // Titulaire lu en un seul libellé (« MARIE CLAIRE DUPONT ») : tous les mots du nom ET un
    // prénom doivent s'y trouver, dans un ordre ou l'autre.
    const t = new Set(mots(p.nom));
    const contient = (nom: string, prenom: string) => {
      const n = motsSignificatifs(nom);
      return n.length > 0 && n.every((x) => t.has(x)) && mots(prenom).some((x) => t.has(x));
    };
    return contient(c.nom, c.prenom) || contient(c.prenom, c.nom);
  }
  return (
    (memeNom(c.nom, p.nom) && prenomCommun(c.prenom, p.prenoms)) ||
    // Prénom et nom inversés au contrat.
    (memeNom(c.prenom, p.nom) && prenomCommun(c.nom, p.prenoms))
  );
}

/** La personne du registre qui correspond au nom du contrat, ou `null`. */
export function personneCorrespondante(
  contrat: NomDuContrat,
  personnes: readonly PersonneRegistre[],
): PersonneRegistre | null {
  if (mots(contrat.prenom).length === 0 || mots(contrat.nom).length === 0) return null;
  return personnes.find((p) => personneCorrespond(contrat, p)) ?? null;
}

/**
 * Le verdict. `non_verifiable` quand on ne peut pas comparer : nom du contrat incomplet, ou
 * aucune personne physique nommée au registre (diffusion partielle d'un entrepreneur
 * individuel, société dirigée seulement par une autre société).
 */
export function comparerNomAuRegistre(
  contrat: NomDuContrat,
  personnes: readonly PersonneRegistre[],
): ResultatNom {
  if (mots(contrat.prenom).length === 0 || mots(contrat.nom).length === 0) return "non_verifiable";
  const nommees = personnes.filter((p) => mots(p.nom).length > 0);
  if (nommees.length === 0) return "non_verifiable";
  return personneCorrespondante(contrat, nommees) ? "correspond" : "ne_correspond_pas";
}

// ── Les messages de la console ───────────────────────────────────────────

/** « Marie Claire DUPONT, gérante » : prénoms en clair, nom en capitales. */
export function libellePersonne(p: PersonneRegistre): string {
  const nom = p.enBloc ? p.nom : [p.prenoms, p.nom.toUpperCase()].filter(Boolean).join(" ");
  return p.qualite ? `${nom}, ${p.qualite.toLowerCase()}` : nom;
}

export type NiveauNom = "correspond" | "alerte" | "impossible" | "registre_muet";

export interface VerdictNom {
  niveau: NiveauNom;
  message: string;
}

const MAX_PERSONNES_AFFICHEES = 5;

/**
 * Le verdict lisible par Williams, à partir de la réponse du registre (déjà lue). Sert à la
 * fiche ET à l'aperçu de la contresignature : les deux disent exactement la même chose.
 */
export function verdictNomRegistre(
  contrat: NomDuContrat,
  registre: ResultatRegistre | null,
): VerdictNom {
  const impossible = (raison: string): VerdictNom => ({
    niveau: "impossible",
    message: `Vérification automatique impossible (${raison}) : comparez vous-même la pièce d'identité avec l'entreprise.`,
  });
  if (!registre) return impossible("aucun numéro SIREN ou SIRET au dossier");
  if (!registre.ok) {
    if (registre.raison === "indisponible")
      return {
        niveau: "registre_muet",
        message: "Registre indisponible, rechargez dans quelques minutes.",
      };
    return impossible(
      registre.raison === "introuvable"
        ? "l'entreprise est introuvable au registre"
        : "le numéro SIREN ou SIRET n'est pas valide",
    );
  }
  const e = registre.entreprise;
  const personnes = (e.personnes ?? []).filter((p) => mots(p.nom).length > 0);
  const resultat = comparerNomAuRegistre(contrat, personnes);
  if (resultat === "correspond") {
    const p = personneCorrespondante(contrat, personnes)!;
    return {
      niveau: "correspond",
      message: `Le nom du contrat correspond au titulaire de l'entreprise (${libellePersonne(p)}).`,
    };
  }
  if (resultat === "ne_correspond_pas") {
    const liste = personnes.slice(0, MAX_PERSONNES_AFFICHEES).map(libellePersonne);
    if (personnes.length > MAX_PERSONNES_AFFICHEES) liste.push("…");
    const numero = e.siret ? "ce SIRET" : "ce SIREN";
    const nom = `${contrat.prenom} ${contrat.nom}`.trim();
    return {
      niveau: "alerte",
      message: `Le nom du contrat (${nom}) ne correspond à personne dans le registre pour ${numero} : personnes trouvées : ${liste.join(" ; ")}. Vérifiez la pièce d'identité et le RIB avant de contresigner.`,
    };
  }
  if (mots(contrat.prenom).length === 0 || mots(contrat.nom).length === 0)
    return impossible("le prénom ou le nom du contrat est incomplet");
  if ((e.dirigeantsSocietes ?? 0) > 0)
    return impossible("l'entreprise est dirigée par une autre société, pas par une personne");
  if (e.diffusionPartielle)
    return impossible("le registre ne publie pas le nom de cet entrepreneur, à sa demande");
  return impossible("le registre ne donne aucun nom de dirigeant pour cette entreprise");
}
