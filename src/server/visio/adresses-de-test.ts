/**
 * Les ADRESSES DE TEST du pilote (chantier visio, correctif P-2, ADR 0061).
 *
 * Un « Discutons » réservé sur Calendly par l'une de ces adresses donne une
 * rencontre de TEST (`Rencontre.estTestInterne`), sans fiche client : c'est ce
 * qui permet de jouer en production, en mode `pilote`, le chemin d'un
 * NOUVEAU prospect (rencontre à classer, P2 sautée, « Créer la fiche
 * prospect », P2-P5, devis) avant d'ouvrir l'enregistrement au public.
 *
 * ## Où vit la liste
 *
 * Dans la variable `VISIO_ADRESSES_DE_TEST`, posée sur le site ET le worker
 * (les deux créent des rencontres Calendly) : adresses séparées par des
 * virgules, points-virgules ou espaces. Une entrée de 64 caractères
 * hexadécimaux est lue comme une EMPREINTE déjà calculée
 * (`hashEmailForLookup`), pour qui ne veut pas poser l'adresse en clair.
 * Jamais dans le dépôt : il est public.
 *
 * Absente ou vide : aucune adresse n'est de test, rien ne change.
 *
 * Seule l'adresse du TITULAIRE de la réservation compte (celle que Will saisit
 * en réservant) ; un invité ajouté n'en fait pas un test.
 *
 * Lue à l'EXÉCUTION (jamais au build), module PUR : le worker l'importe.
 */

import { hashEmailForLookup } from "@/lib/security/email-hash";

export const VARIABLE_ADRESSES_DE_TEST = "VISIO_ADRESSES_DE_TEST";

type Env = Readonly<Record<string, string | undefined>>;

const EMPREINTE = /^[0-9a-f]{64}$/;

/** Les empreintes des adresses de test. L'argument ne sert qu'aux tests. */
export function empreintesDesAdressesDeTest(env: Env = process.env): ReadonlySet<string> {
  const out = new Set<string>();
  for (const brut of (env[VARIABLE_ADRESSES_DE_TEST] ?? "").split(/[\s,;]+/)) {
    const entree = brut.trim();
    if (entree === "") continue;
    const empreinte = EMPREINTE.test(entree) ? entree : hashEmailForLookup(entree);
    if (empreinte !== null) out.add(empreinte);
  }
  return out;
}

/** Cette adresse est-elle une adresse de test du pilote ? */
export function estAdresseDeTest(
  email: string | null | undefined,
  env: Env = process.env,
): boolean {
  const empreintes = empreintesDesAdressesDeTest(env);
  if (empreintes.size === 0) return false;
  const empreinte = hashEmailForLookup(email);
  return empreinte !== null && empreintes.has(empreinte);
}
