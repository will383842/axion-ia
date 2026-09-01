/**
 * Rendre au visiteur ce qu'il vient de taper, sans une ligne de JavaScript.
 *
 * ## Le problème
 *
 * Le formulaire de réservation n'envoie aucun script — c'est ce qui le rend
 * instantané sur un téléphone. Mais un formulaire natif qui échoue à la
 * validation ne peut pas se re-rendre tout seul : il faut un POST, puis une
 * redirection, puis un GET (le motif « POST-redirect-GET », qui évite qu'un
 * rafraîchissement ne renvoie le formulaire). Reste à faire voyager la saisie
 * entre les deux.
 *
 * ## 🔴 Pourquoi PAS dans l'URL
 *
 * C'était la solution évidente, et elle est interdite ici. Un nom et une adresse
 * e-mail placés en paramètres d'URL se retrouvent dans l'historique du
 * navigateur, dans les journaux du serveur, dans ceux de Cloudflare, et dans
 * l'en-tête `Referer` envoyé à tout tiers que la page suivante contacterait.
 * Une donnée personnelle ne se met pas dans une adresse.
 *
 * ## Ce que fait ce module
 *
 * Un cookie éphémère, `httpOnly`, `sameSite: strict`, valable deux minutes et
 * apparié au créneau auquel il se rapporte. Il reste sur l'appareil du visiteur,
 * ne part vers aucun tiers, et expire de lui-même — y compris si le visiteur
 * abandonne.
 *
 * ⚠️ Il n'est PAS « consommé à la lecture », contrairement à ce que cette phrase
 * a affirmé pendant une heure : une page Next n'a pas le droit d'effacer un
 * cookie. C'est l'appariement au créneau qui joue ce rôle. Détail complet sous
 * `REPRISE_TTL_SECONDES`.
 *
 * ## ⚠️ LA LIMITE, ÉCRITE PLUTÔT QUE DÉCOUVERTE
 *
 * Un cookie plafonne à 4 096 octets, en-tête comprise. Une réponse longue à une
 * question ouverte peut à elle seule dépasser ce budget. Quand ça arrive, on ne
 * tronque pas en silence : on garde les ERREURS (sans elles, le visiteur ne
 * saurait même pas ce qui a été refusé) et on abandonne les valeurs les plus
 * volumineuses, en le DISANT dans le formulaire. Un champ vide sans explication
 * ferait croire à une perte de données ; un champ vide annoncé se retape.
 */

import { cookies } from "next/headers";

import type { Erreurs, Valeurs } from "./formulaire-reservation";

/** Nom du cookie. Préfixé `__Host-` : lié à l'origine, exigé en HTTPS. */
export const COOKIE_REPRISE = "__Host-axion-reserv";

/**
 * Deux minutes.
 *
 * ## ⚠️ POURQUOI SI COURT, ET POURQUOI CE N'EST PAS UN CHOIX DE CONFORT
 *
 * Le premier jet écrivait « cinq minutes, le cookie est de toute façon consommé
 * au premier GET ». La seconde moitié était FAUSSE : Next n'autorise la mutation
 * d'un cookie que dans une action serveur ou un gestionnaire de route. Une page
 * peut le LIRE, pas l'effacer. Il n'y a donc pas de consommation, seulement une
 * expiration.
 *
 * Deux protections remplacent celle qu'on croyait avoir :
 * — la reprise porte le CRÉNEAU auquel elle appartient, et la page ignore une
 *   reprise qui ne correspond pas au créneau affiché ;
 * — le délai est ramené à deux minutes, ce qui suffit très largement à une
 *   redirection et laisse peu de place à une saisie oubliée sur un appareil
 *   partagé.
 *
 * Reste un cas résiduel, assumé et écrit : revenir en arrière sur le MÊME
 * créneau dans les deux minutes réaffiche les erreurs précédentes. C'est
 * inesthétique, ce n'est pas une perte de données, et le corriger exigerait de
 * faire passer l'effacement par le proxy — trop de machinerie pour ce gain.
 */
export const REPRISE_TTL_SECONDES = 120;

/**
 * Budget d'écriture, sous le plafond réel de 4 096 octets.
 *
 * ## 🔴 CE QUI SE MESURE ICI : L'EN-TÊTE ÉMISE, PAS LE JSON
 *
 * La première version comparait `JSON.stringify(...)` à 3 500 octets et
 * expliquait que la marge de 596 octets « couvre le nom du cookie, ses
 * attributs, et l'encodage ». **C'était faux, et d'un facteur, pas d'une
 * marge** : l'encodage est MULTIPLICATIF. Next sérialise
 * `${nom}=${encodeURIComponent(valeur)}` ; chaque guillemet devient `%22`,
 * chaque accolade `%7B`, chaque accent six caractères. Mesuré :
 *
 *     réponse de 2 600 caractères → JSON 2 963 o  (sous le budget, AUCUN sacrifice)
 *                                 → Set-Cookie 4 189 o  → REFUSÉ par le navigateur
 *
 * Le seuil réel tombait donc autour de 2 500 caractères, très en dessous du
 * `maxLength` de 10 000 du champ. Au-delà, la redirection aboutissait, la page
 * lisait un cookie absent, et **le formulaire revenait entièrement vide** —
 * sans le bandeau d'avertissement, qui dépend d'`abandonnes` resté vide. Le
 * « silence parfait » que ce commentaire prétendait prévenir.
 *
 * ⚠️ La garde ne mordait pas non plus : elle mesurait le MÊME
 * `JSON.stringify` que le code. Garde et chose gardée partageaient la mesure,
 * donc aucune des deux ne voyait l'encodage.
 *
 * On mesure désormais ce que le navigateur reçoit réellement.
 */
const BUDGET_OCTETS = 3_800;

/** Les champs dont la valeur peut être longue, sacrifiés en premier. */
const SACRIFIABLES_EN_PREMIER = (nom: string): boolean => nom.startsWith("q") || nom === "invites";

export interface Reprise {
  /**
   * Le créneau auquel cette reprise se rapporte.
   *
   * 🔑 Sans lui, une reprise laissée par un créneau abandonné se collerait sur
   * le suivant : le visiteur choisirait un autre horaire et retrouverait les
   * erreurs — et surtout les VALEURS — d'une tentative qui n'est plus la sienne.
   */
  readonly debut: string;
  readonly erreurs: Erreurs;
  readonly valeurs: Valeurs;
  /** Champs dont la valeur n'a PAS pu être conservée. Jamais silencieux. */
  readonly abandonnes: readonly string[];
}

/**
 * La taille de l'en-tête `Set-Cookie` que le navigateur recevra.
 *
 * 🔑 `encodeURIComponent` fait partie de la mesure, pas d'une marge : c'est lui
 * qui triple le coût des guillemets et des accolades d'un JSON. Le nom du
 * cookie et ses attributs sont comptés aussi — ils entrent dans le plafond de
 * 4 096 octets, qui porte sur l'en-tête entière.
 *
 * Exporté pour que la garde mesure la MÊME chose que le code, et pour qu'elle
 * puisse le faire sans dépendre de Next.
 */
export function tailleDeLEnTete(charge: unknown): number {
  const attributs = "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=120";
  const entete = `${COOKIE_REPRISE}=${encodeURIComponent(JSON.stringify(charge))}${attributs}`;
  return new TextEncoder().encode(entete).length;
}

function taille(o: unknown): number {
  return tailleDeLEnTete(o);
}

/**
 * Compose la charge à écrire, en sacrifiant ce qu'il faut pour tenir.
 *
 * Exporté pour être éprouvé sans cookie ni requête : c'est ici que vit la seule
 * décision non triviale du module.
 */
export function composerReprise(debut: string, erreurs: Erreurs, valeurs: Valeurs): Reprise {
  const abandonnes: string[] = [];
  const retenues: Record<string, string> = { ...valeurs };

  // Les erreurs ne se sacrifient jamais : sans elles, le visiteur retrouverait
  // son formulaire tel quel, sans savoir ce qui a été refusé ni pourquoi.
  const essai = (): Reprise => ({ debut, erreurs, valeurs: retenues, abandonnes });

  if (taille(essai()) <= BUDGET_OCTETS) return essai();

  // On sacrifie du plus gros au plus petit, et d'abord les champs faits pour
  // être longs. Le nom, l'e-mail et le créneau sont les derniers à partir — ce
  // sont les plus courts et les plus coûteux à retaper.
  const ordre = Object.keys(retenues).sort((a, b) => {
    const pa = SACRIFIABLES_EN_PREMIER(a) ? 0 : 1;
    const pb = SACRIFIABLES_EN_PREMIER(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (retenues[b] ?? "").length - (retenues[a] ?? "").length;
  });

  for (const nom of ordre) {
    if ((retenues[nom] ?? "") === "") continue;
    delete retenues[nom];
    abandonnes.push(nom);
    if (taille(essai()) <= BUDGET_OCTETS) break;
  }

  return essai();
}

/** Dépose la reprise, juste avant la redirection. */
export async function deposerLaReprise(
  debut: string,
  erreurs: Erreurs,
  valeurs: Valeurs,
): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_REPRISE, JSON.stringify(composerReprise(debut, erreurs, valeurs)), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: REPRISE_TTL_SECONDES,
  });
}

/**
 * Lit la reprise DU CRÉNEAU DEMANDÉ, et rien d'autre.
 *
 * ⚠️ Cette fonction ne peut pas effacer le cookie : une page Next n'a le droit
 * que de lire. C'est précisément pour ça que l'appariement sur le créneau
 * existe — c'est lui qui empêche une reprise abandonnée de se coller sur une
 * tentative qui n'est pas la sienne. Voir `REPRISE_TTL_SECONDES`.
 */
export async function lireLaRepriseDuCreneau(debut: string): Promise<Reprise | null> {
  const jar = await cookies();
  const brut = jar.get(COOKIE_REPRISE)?.value;
  if (!brut) return null;
  const reprise = lireLaReprise(brut);
  if (!reprise || reprise.debut !== debut) return null;
  return reprise;
}

/**
 * Analyse une charge de reprise.
 *
 * Séparé de la lecture du cookie pour être testable, et parce qu'un contenu
 * illisible n'est pas une exception : un cookie tronqué par un intermédiaire,
 * ou laissé par une version antérieure du code, doit simplement être ignoré.
 */
export function lireLaReprise(brut: string): Reprise | null {
  let parse: unknown;
  try {
    parse = JSON.parse(brut);
  } catch {
    return null;
  }
  if (typeof parse !== "object" || parse === null) return null;
  const o = parse as Record<string, unknown>;

  const chaines = (v: unknown): Record<string, string> => {
    if (typeof v !== "object" || v === null) return {};
    const out: Record<string, string> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (typeof x === "string") out[k] = x;
    }
    return out;
  };

  const debut = o["debut"];
  if (typeof debut !== "string") return null;

  return {
    debut,
    erreurs: chaines(o["erreurs"]),
    valeurs: chaines(o["valeurs"]),
    abandonnes: Array.isArray(o["abandonnes"])
      ? o["abandonnes"].filter((x): x is string => typeof x === "string")
      : [],
  };
}
