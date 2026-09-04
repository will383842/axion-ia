/**
 * LES LIENS DE CAMPAGNE — construction, et rien d'autre.
 *
 * ## Le problème que ce module résout
 *
 * Un lien de campagne ressemble à ceci :
 *
 *     https://axion-ia.com/fr/apporteur-affaires
 *       ?utm_source=facebook&utm_medium=paid
 *       &utm_campaign=apporteurs-2026-09&utm_content=video-a
 *
 * Il est écrit à la main dans le gestionnaire de publicités, une fois, puis
 * perdu. À la campagne suivante on le réécrit de mémoire — et une faute de
 * frappe dans `utm_content` ne casse RIEN : la page s'affiche, le visiteur
 * candidate, et la seule chose détruite est la comparaison entre les visuels.
 * C'est un défaut silencieux, celui qui ne se voit qu'au moment où on veut
 * décider quoi remettre en ligne.
 *
 * ## Le parti pris : on ne STOCKE pas les liens, on les REDÉRIVE
 *
 * Un lien est entièrement déterminé par quatre choix : la destination, le
 * canal, la campagne, le visuel. Deux fois les mêmes choix donnent deux fois
 * le même lien. Stocker les liens dans une table créerait donc une seconde
 * vérité — celle des liens qu'on a pensé enregistrer — à côté de celle des
 * liens réellement utilisés, que les `Submission` portent déjà.
 *
 * 🔑 Conséquence pratique pour l'utilisateur : **on ne « retrouve » pas un
 * lien, on le refait**. L'écran de la console montre en regard les campagnes
 * qui ont RÉELLEMENT amené quelqu'un, lues dans les candidatures. Un lien
 * absent de cette liste n'a pas été perdu : il n'a rien rapporté.
 *
 * ## Ce module est PUR
 *
 * Aucune lecture de base, aucun appel réseau, aucune dépendance à Next. Il est
 * donc testable en entier, et réutilisable côté serveur comme côté client.
 */

/**
 * Canaux d'acquisition. Liste FERMÉE et volontairement courte.
 *
 * 🔴 `utm_source` sert de clé de regroupement dans les statistiques : deux
 * orthographes du même canal (`facebook` et `Facebook`) produisent deux lignes
 * qui ne s'additionnent jamais. C'est exactement la faute que ce module existe
 * pour rendre impossible — d'où une liste plutôt qu'un champ libre.
 */
export const CANAUX_CAMPAGNE = [
  { id: "facebook", libelle: "Facebook", medium: "paid" },
  { id: "instagram", libelle: "Instagram", medium: "paid" },
  { id: "linkedin", libelle: "LinkedIn", medium: "paid" },
  { id: "leboncoin", libelle: "Le Bon Coin", medium: "referral" },
  { id: "indeed", libelle: "Indeed", medium: "referral" },
  { id: "email", libelle: "E-mail", medium: "email" },
  { id: "affiche", libelle: "Affiche / QR code", medium: "offline" },
] as const;

export type CanalCampagne = (typeof CANAUX_CAMPAGNE)[number]["id"];

/**
 * Destinations autorisées — les pages faites pour RECEVOIR une campagne.
 *
 * Pointer une publicité vers une page qui n'a pas de formulaire coûte le clic
 * sans rien rapporter. La liste évite ce gaspillage plus sûrement qu'une
 * consigne.
 */
export const DESTINATIONS_CAMPAGNE = [
  {
    id: "apporteur-affaires",
    chemin: "/fr/apporteur-affaires",
    libelle: "Apporteurs d'affaires (tunnel court)",
    aide: "4 champs, 30 secondes. La page faite pour un post social.",
  },
  {
    id: "devenir-commercial-ia",
    chemin: "/fr/devenir-commercial-ia",
    libelle: "Devenir apporteur (page longue)",
    aide: "Présentation complète, puis le dossier. Pour un trafic déjà tiède.",
  },
  {
    id: "leboncoin",
    chemin: "/fr/leboncoin",
    libelle: "Landing Le Bon Coin",
    aide: "Habillage d'annonce. À n'utiliser que pour ce canal.",
  },
] as const;

export type DestinationCampagne = (typeof DESTINATIONS_CAMPAGNE)[number]["id"];

export interface ChoixCampagne {
  destination: DestinationCampagne;
  canal: CanalCampagne;
  /** Nom de la campagne, libre. Ex. « apporteurs septembre ». */
  campagne: string;
  /** Le visuel ou la variante. Vide = pas de comparaison possible entre créas. */
  visuel?: string;
}

/**
 * Normalise un libellé humain en valeur d'UTM : minuscules, accents retirés,
 * tout le reste en tirets.
 *
 * 🔑 Les accents sont retirés AVANT le remplacement, pas après : « Été » donne
 * `ete`, pas `-t-`. Le piège est classique et silencieux — il produit des clés
 * différentes pour la même campagne selon qui la saisit.
 */
export function normaliserValeurUtm(brut: string): string {
  return (
    brut
      .normalize("NFD")
      // Les diacritiques isolés par `NFD`, désignés par leur code plutôt qu'écrits
      // littéralement : un caractère combinant collé dans une classe de caractères
      // survit mal aux copies, aux éditeurs et aux terminaux.
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
  );
}

/** Le `utm_medium` attaché à un canal — jamais saisi à la main. */
export function mediumDuCanal(canal: CanalCampagne): string {
  return CANAUX_CAMPAGNE.find((c) => c.id === canal)?.medium ?? "referral";
}

/** Le chemin de destination, préfixe de langue compris. */
export function cheminDeDestination(destination: DestinationCampagne): string {
  return DESTINATIONS_CAMPAGNE.find((d) => d.id === destination)?.chemin ?? "/fr";
}

export interface LienCampagne {
  /** L'URL complète, prête à coller dans le gestionnaire de publicités. */
  url: string;
  /** Les paramètres retenus, pour affichage — utile quand la normalisation surprend. */
  parametres: Record<string, string>;
  /** Ce qui manque pour que la mesure soit exploitable. Jamais bloquant. */
  avertissements: string[];
}

/**
 * Construit le lien. Ne lève jamais : un champ vide produit un avertissement,
 * pas une erreur — on préfère un lien imparfait à un écran qui refuse.
 *
 * @param origine racine du site, sans barre finale (ex. `https://axion-ia.com`)
 */
export function construireLienCampagne(origine: string, choix: ChoixCampagne): LienCampagne {
  const campagne = normaliserValeurUtm(choix.campagne ?? "");
  const visuel = normaliserValeurUtm(choix.visuel ?? "");
  const avertissements: string[] = [];

  if (!campagne) {
    avertissements.push(
      "Sans nom de campagne, toutes tes publicités se confondront dans les statistiques.",
    );
  }
  if (!visuel) {
    avertissements.push(
      "Sans nom de visuel, tu ne pourras pas comparer deux créations l'une à l'autre.",
    );
  }

  const parametres: Record<string, string> = {
    utm_source: choix.canal,
    utm_medium: mediumDuCanal(choix.canal),
  };
  if (campagne) parametres["utm_campaign"] = campagne;
  if (visuel) parametres["utm_content"] = visuel;

  const base = `${origine.replace(/\/+$/, "")}${cheminDeDestination(choix.destination)}`;
  const query = new URLSearchParams(parametres).toString();

  return { url: `${base}?${query}`, parametres, avertissements };
}
