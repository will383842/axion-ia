#!/usr/bin/env node
/**
 * Nettoie la fausse présence physique et « Grenoble » dans
 * `src/content/villes/copy/*.ts`.
 *
 * Axion-IA n'a aucun bureau ni consultant basé localement : elle intervient
 * partout en France, sur place ou à distance. « Grenoble » est interdit en
 * communication.
 *
 * Méthode : deux TABLES de remplacements par chaîne EXACTE, chaque entrée étant
 * BORNÉE à sa liste de fichiers : [motif, avant, après, fichiers]. Aucune
 * expression régulière appliquée au texte, aucun fragment appliqué à tout le
 * dossier. Rien d'autre n'est touché. `grenoble.ts` (page DE la ville) est
 * ignoré : il ne contient aucune phrase de présence à retirer.
 *
 *   ETAPE_1 : le nettoyage initial (fausse présence + Grenoble), calculé depuis
 *             l'état de origin/main 7f0d5a6d9.
 *   ETAPE_2 : corrections de relecture, écrites contre le texte issu de l'étape 1
 *             (contradictions d'origine des consultants, formulations bancales,
 *             doublons de réponse, intitulé des questions de FAQ).
 *
 * Usage :
 *   node scripts/villes/nettoyer-fausse-presence.mjs --dry-run   # fichier:ligne avant/après
 *   node scripts/villes/nettoyer-fausse-presence.mjs             # écrit
 *   node scripts/villes/nettoyer-fausse-presence.mjs --dossier=<chemin>   # autre dossier (vérification)
 *
 * Le dossier par défaut se résout depuis l'emplacement du script, pas depuis le
 * répertoire courant. Après écriture, lancer `pnpm exec prettier --write` sur
 * les fichiers touchés : certaines chaînes tiennent désormais sur une ligne.
 *
 * Idempotent : relancé après écriture, il ne change rien (« 0 fichier à modifier »).
 * Chaque étape est rejouée jusqu'à stabilité (6 passes max) : retirer une phrase
 * peut en exposer une autre en début de chaîne.
 *
 * Verrouillé par `tests/unit/content/villes-sans-fausse-presence.spec.ts`.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ARG_DOSSIER = process.argv.find((a) => a.startsWith("--dossier="));
const DOSSIER = ARG_DOSSIER
  ? resolve(ARG_DOSSIER.slice("--dossier=".length))
  : resolve(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "content",
      "villes",
      "copy",
    );
const IGNORES = new Set(["grenoble.ts"]);
const DRY_RUN = process.argv.includes("--dry-run");

/** [motif, avant exact, après, fichiers concernés]. */
const ETAPE_1 = [
  [
    "phrase",
    'seoHook: "proche grenoble",',
    'seoHook: "parc technologique Inovallée",',
    ["meylan.ts"],
  ],
  [
    "phrase",
    "Fontaine est à 2,5 km de la gare de Grenoble (TGV Paris en 3h00), 35 km de l'aéroport Grenoble-Alpes-Isère et 85 km de l'aéroport Lyon-Saint-Exupéry, accessible par l'A480 et la ligne A du tramway de Grenoble.",
    "Fontaine est à 85 km de l'aéroport Lyon-Saint-Exupéry, accessible par l'A480 et la ligne A du tramway.",
    ["fontaine.ts"],
  ],
  [
    "phrase",
    "Seyssins est membre de la métropole Grenoble-Alpes Métropole (« La Métro »), à l'ouest immédiat de Grenoble dans l'aire urbaine de l'agglomération.",
    "Seyssins est membre de la métropole grenobloise (« La Métro »), à l'ouest immédiat de l'agglomération dans l'aire urbaine.",
    ["seyssins.ts"],
  ],
  [
    "phrase",
    "commune de l'aire urbaine de Grenoble adhérente à Grenoble-Alpes Métropole, jouxte Seyssinet-Pariset à l'ouest immédiat de Grenoble.",
    "commune de l'aire urbaine grenobloise adhérente à la métropole grenobloise, jouxte Seyssinet-Pariset à l'ouest immédiat de l'agglomération.",
    ["seyssins.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (10 min tramway A) ou Lyon (1h15 voiture A48) pour les missions sur site à Seyssinet-Pariset.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["seyssinet-pariset.ts"],
  ],
  [
    "phrase",
    " La gare de Grenoble (TGV Paris ~3 h) est à environ 7 km, et l'aéroport Grenoble-Alpes-Isère est accessible en 45 min par l'A48.",
    "",
    ["echirolles.ts"],
  ],
  [
    "phrase",
    "commune limitrophe de Grenoble, abrite un pôle hospitalier majeur : CHU Grenoble Nord (CHU Grenoble Alpes) et site historique",
    "commune de l'agglomération grenobloise, abrite un pôle hospitalier majeur : le CHU et le site historique",
    ["la-tronche.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à Paris et se déplacent dans les 20 arrondissements ainsi que dans la première couronne.",
    "Nous intervenons dans les 20 arrondissements ainsi que dans la première couronne, sur place ou à distance.",
    ["paris.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (35 min A43) ou Grenoble (1h voiture) pour les missions sur site à Villefontaine.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["villefontaine.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à Lille (20 min) et couvrent l'ensemble de l'axe Lille-Tourcoing-frontière belge.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["roncq.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à Lille (10 min) et couvrent l'ensemble de la Métropole Européenne de Lille.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["ronchin.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à Lille (12 min) et couvrent l'ensemble de la Métropole Européenne de Lille.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["wattignies.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants arrivent par la ligne A du tramway de Grenoble (5 stations à Fontaine) ou par l'A480.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["fontaine.ts"],
  ],
  [
    "hebergement",
    "Pour les missions multi-jours en zone rurale, hébergement local possible (gîtes ou hôtels Grenoble).",
    "Pour les missions de plusieurs jours en zone rurale, un hébergement local est possible.",
    ["vif.ts"],
  ],
  [
    "phrase",
    "CHU Grenoble Nord (CHU Grenoble Alpes, l'un des plus importants CHU de France) et site historique",
    "le CHU (l'un des plus importants CHU de France) et site historique",
    ["la-tronche.ts"],
  ],
  [
    "phrase",
    "Couverture Grenoble-Alpes Métropole et accès depuis Lyon (1h15 A48) ou Paris (TGV Grenoble 3h).",
    "Couverture de la métropole grenobloise.",
    ["sassenage.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (20 min A480 ou via tramway A à Pont-de-Claix + voiture).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["varces-allieres-et-risset.ts"],
  ],
  [
    "phrase",
    "— limitrophe Grenoble, hôpitaux civil et militaire (CHU Grenoble Nord, École militaire santé).",
    "— commune grenobloise, hôpitaux civil et militaire (CHU, École militaire santé).",
    ["la-tronche.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (10-15 min tramway A via Seyssinet) ou Lyon (1h15 A48).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["seyssins.ts"],
  ],
  [
    "phrase",
    " La gare de Grenoble est à environ 5 km, l'aéroport de Grenoble Alpes Isère à environ 45 km.",
    "",
    ["saint-martin-d-heres.ts"],
  ],
  [
    "phrase",
    "— sud-ouest Grenoble, balcons sud Vercors, banlieue résidentielle Grenoble-Alpes Métropole.",
    "— sud-ouest grenoblois, balcons sud Vercors, banlieue résidentielle de la métropole grenobloise.",
    ["claix.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (10 min tramway A) ou Paris (TGV Grenoble 3h + tram).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["eybens.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (1h A43), Grenoble (1h voiture) ou Chambéry (50 min A43).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["la-tour-du-pin.ts"],
  ],
  [
    "phrase",
    "— banlieue sud-est Grenoble, route Napoléon (retour Île d'Elbe), Grenoble-Alpes Métropole.",
    "— banlieue sud-est grenobloise, route Napoléon (retour Île d'Elbe), métropole grenobloise.",
    ["eybens.ts"],
  ],
  [
    "phrase",
    "membre de Grenoble-Alpes Métropole en position limitrophe nord-ouest de Grenoble, au pied",
    "membre de la métropole grenobloise en position nord-ouest, au pied",
    ["saint-martin-le-vinoux.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Paris (TGV Grenoble 3h + tram E) ou Lyon (1h15 voiture A48).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["saint-egreve.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité de La Défense (10 min) et Paris centre (25 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["garches.ts"],
  ],
  [
    "phrase",
    "toute Grenoble-Alpes Métropole (Grenoble, Saint-Martin-d'Hères, Échirolles, La Tronche)",
    "toute la métropole grenobloise (Saint-Martin-d'Hères, Échirolles, La Tronche)",
    ["meylan.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Paris (TGV Grenoble 3h + tram/voiture) ou Lyon (1h15 A48).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["montbonnot-saint-martin.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité, déplacement sous 10 min depuis Annecy centre.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["epagny-metz-tessy.ts"],
  ],
  [
    "phrase",
    "commune limitrophe au nord-ouest de Grenoble, est membre de Grenoble-Alpes Métropole.",
    "commune du nord-ouest de la métropole grenobloise.",
    ["saint-martin-le-vinoux.ts"],
  ],
  [
    "bureaux",
    "puis mise en production sans downtime depuis nos bureaux ou les vôtres à Carquefou —",
    "puis mise en production sans downtime, sur place à Carquefou ou à distance —",
    ["carquefou.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants se déplacent sur site à Briançon depuis Gap (1h15) ou Grenoble (2h).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["briancon.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble centre (15 min tramway B/D) ou Lyon (1h15 A48).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["gieres.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (15 min tramway A) ou Lyon (1h15 voiture A48).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["sassenage.ts"],
  ],
  [
    "hebergement",
    "Pour les multi-jours, hébergement local possible (hôtels Grenoble ou Saint-Égrève).",
    "Pour les missions de plusieurs jours, un hébergement local est possible.",
    ["saint-egreve.ts"],
  ],
  [
    "phrase",
    "Gières est membre de Grenoble-Alpes Métropole (« La Métro »), à l'est de Grenoble.",
    "Gières est membre de la métropole grenobloise (« La Métro »), à l'est.",
    ["gieres.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à Limoges (10 min) et couvrent tout Limoges Métropole.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["couzeix.ts", "feytiat.ts", "isle.ts", "panazol.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à Limoges (15 min) et couvrent tout Limoges Métropole.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["aixe-sur-vienne.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité immédiate de Vannes, à 10 minutes de Séné.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["sene.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants se déplacent depuis Lyon et Grenoble pour les missions sur site.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["valence.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à Poitiers (10 min) et couvrent tout Grand Poitiers.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["mignaloux-beauvoir.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à Poitiers (15 min) et couvrent tout Grand Poitiers.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["neuville-de-poitou.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à Poitiers (20 min) et couvrent tout Grand Poitiers.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["saint-martin-la-pallu.ts"],
  ],
  [
    "hebergement",
    "Pour les multi-jours, hébergement local possible (hôtels Grenoble ou Vercors).",
    "Pour les missions de plusieurs jours, un hébergement local est possible.",
    ["claix.ts"],
  ],
  [
    "hebergement",
    "Pour les multi-jours, hébergement local possible (hôtels Voreppe ou Grenoble).",
    "Pour les missions de plusieurs jours, un hébergement local est possible.",
    ["voreppe.ts"],
  ],
  [
    "hebergement",
    "Pour les multi-jours, hébergement local possible (hôtels Grenoble ou Eybens).",
    "Pour les missions de plusieurs jours, un hébergement local est possible.",
    ["eybens.ts"],
  ],
  [
    "hebergement",
    "Pour les multi-jours, hébergement local possible (hôtels Voiron ou Grenoble).",
    "Pour les missions de plusieurs jours, un hébergement local est possible.",
    ["moirans.ts"],
  ],
  [
    "phrase",
    "Voiron est à 29 km par la route au nord-ouest de Grenoble via l'autoroute A48",
    "Voiron est accessible par l'autoroute A48",
    ["voiron.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Gap (1h15 sud) ou Grenoble (2h col du Lautaret).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["briancon.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (15 min A480/N532) ou Lyon (1h15 A48).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["claix.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés sur Rennes, déplacement en 25 min via la RN157.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["chateaubourg.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (20 min A480) ou Lyon (1h30 voiture).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["varces-allieres-et-risset.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (20 min voiture N85, route Napoléon).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["vizille.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (1h A48) ou Grenoble (20 min A48 ou TER).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["moirans.ts", "voreppe.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés en agglomération angevine, déplacement rapide.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["beaucouze.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés en agglomération mancelle, déplacement rapide.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["allonnes.ts", "change.ts", "coulaines.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité de Limoges, déplacement en 10 min.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["le-palais-sur-vienne.ts"],
  ],
  [
    "bureaux",
    " Démos hebdomadaires en visio depuis nos bureaux, à 40 minutes de Nantes.",
    " Démos hebdomadaires en visio.",
    ["challans.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (50 min A49) ou Lyon (1h15 voiture).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["saint-marcellin.ts"],
  ],
  [
    "phrase",
    "— vallée du Grésivaudan, banlieue est Grenoble, Grenoble-Alpes Métropole.",
    "— vallée du Grésivaudan, banlieue est grenobloise, métropole grenobloise.",
    ["domene.ts"],
  ],
  [
    "phrase",
    "— est Grenoble, gare Grenoble-Universités-Gières (2e gare agglomération)",
    "— est grenoblois, gare Universités-Gières (2e gare agglomération)",
    ["gieres.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (25 min A41) ou Chambéry (50 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["villard-bonnot.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (30 min A41) ou Chambéry (25 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["pontcharra.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (30 min A41) ou Chambéry (50 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["crolles.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (35 min A43) ou Grenoble (1h voiture).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["charvieu-chavagneux.ts", "la-verpilliere.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (40 min A43) ou Grenoble (1h voiture).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["tignieu-jameyzieu.ts"],
  ],
  [
    "phrase",
    "commune à l'est de Grenoble dans la métropole Grenoble-Alpes Métropole,",
    "commune de l'est de la métropole grenobloise,",
    ["gieres.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés sur le bassin nantais, à 15 min du centre.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["sainte-luce-sur-loire.ts"],
  ],
  [
    "faq-question",
    'q: "Comment se passe une mission depuis Lyon, Grenoble ou Chambéry ?"',
    'q: "Comment se passe une mission chez vous ?"',
    ["la-tour-du-pin.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (20 min A41) ou Lyon (1h15 A48).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["saint-ismier.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (1h A43) ou Grenoble (1h voiture).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["la-tour-du-pin.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (1h A48) ou Grenoble (20 min A48).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["moirans.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (1h A48) ou Grenoble (30 min A48).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["coublevie.ts", "rives.ts", "tullins.ts"],
  ],
  [
    "hebergement",
    "Pour les multi-jours, hébergement local possible (hôtels Grenoble).",
    "Pour les missions de plusieurs jours, un hébergement local est possible.",
    ["gieres.ts", "saint-ismier.ts", "varces-allieres-et-risset.ts"],
  ],
  [
    "phrase",
    "domaine universitaire de Grenoble (Polytech Grenoble, bibliothèque",
    "domaine universitaire (Polytech, bibliothèque",
    ["saint-martin-d-heres.ts"],
  ],
  [
    "bureaux",
    "mise en production sans downtime depuis nos bureaux toulousains —",
    "mise en production sans downtime, sur place ou à distance —",
    ["cugnaux.ts"],
  ],
  [
    "phrase",
    "La proximité immédiate de Grenoble (2,5 km de la gare) et du pôle",
    "La proximité immédiate du pôle",
    ["fontaine.ts"],
  ],
  [
    "faq-question",
    'q: "Comment se passe une mission depuis Grenoble ou Chambéry ?"',
    'q: "Comment se passe une mission chez vous ?"',
    ["crolles.ts", "pontcharra.ts", "villard-bonnot.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (35 min A43) ou Grenoble (1h).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["villefontaine.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (40 min A43) ou Grenoble (1h).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["l-isle-d-abeau.ts", "pont-de-cheruy.ts"],
  ],
  [
    "liste-acces",
    "Tramway B (CHU-Michallon arrêt) vers Grenoble centre (10 min). ",
    "",
    ["la-tronche.ts"],
  ],
  [
    "phrase",
    "occupe une position carrefour entre Lyon, Grenoble et Chambéry.",
    "occupe une position carrefour entre Lyon et Chambéry.",
    ["la-tour-du-pin.ts"],
  ],
  [
    "phrase",
    "limitrophe immédiate de Grenoble dans Grenoble-Alpes Métropole.",
    "immédiatement voisine du centre de la métropole grenobloise.",
    ["la-tronche.ts"],
  ],
  [
    "phrase",
    "commune limitrophe de Grenoble dans l'agglomération grenobloise",
    "commune de l'agglomération grenobloise",
    ["fontaine.ts"],
  ],
  [
    "consultants-viennent-de",
    "Consultants depuis Lyon (40 min A43) ou Grenoble (1h voiture).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["chavanoz.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés sur Rennes, déplacement en 15 min.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["acigne.ts", "melesse.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité de Perpignan (10 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["le-soler.ts", "pia.ts", "rivesaltes.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité de Perpignan (12 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["canet-en-roussillon.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité de Perpignan (15 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["saint-laurent-de-la-salanque.ts", "thuir.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité de Perpignan (20 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["le-barcares.ts", "saint-cyprien.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité de Perpignan (25 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["argeles-sur-mer.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité de Perpignan (30 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["ceret.ts"],
  ],
  [
    "faq-question",
    'q: "Comment se déroule une mission depuis Grenoble ou Lyon ?"',
    'q: "Comment se passe une mission chez vous ?"',
    ["seyssinet-pariset.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés en proximité, déplacement rapide.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["bonchamp-les-laval.ts", "change-53.ts", "saint-berthevin.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés sur Lille, déplacement en 10 min.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["marquette-lez-lille.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés sur Lille, déplacement en 12 min.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["haubourdin.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés sur Lille, déplacement en 20 min.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["comines.ts"],
  ],
  [
    "faq-question",
    'q: "Comment se passe une mission depuis Grenoble ou Paris ?"',
    'q: "Comment se passe une mission chez vous ?"',
    ["eybens.ts"],
  ],
  [
    "phrase",
    "Position de transit entre Lyon et Grenoble, proximité Voiron",
    "Position de transit sur l'A48, proximité Voiron",
    ["tullins.ts"],
  ],
  [
    "faq-question",
    'q: "Comment se passe une mission depuis Grenoble ou Lyon ?"',
    'q: "Comment se passe une mission chez vous ?"',
    ["saint-marcellin.ts", "sassenage.ts"],
  ],
  [
    "faq-question",
    'q: "Comment se passe une mission depuis Lyon ou Grenoble ?"',
    'q: "Comment se passe une mission chez vous ?"',
    [
      "charvieu-chavagneux.ts",
      "coublevie.ts",
      "la-verpilliere.ts",
      "moirans.ts",
      "rives.ts",
      "tignieu-jameyzieu.ts",
      "tullins.ts",
      "villefontaine.ts",
      "voreppe.ts",
    ],
  ],
  ["phrase", " et accès rapide depuis Lyon (1h A48) ou Grenoble (20 min).", ".", ["voreppe.ts"]],
  [
    "faq-question",
    'q: "Comment se passe une mission rurale depuis Grenoble ?"',
    'q: "Comment se passe une mission rurale chez vous ?"',
    ["vif.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (25 min voiture N75).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["vif.ts"],
  ],
  [
    "liste-acces",
    "Tramway A vers Grenoble centre (10-15 min via Seyssinet). ",
    "",
    ["seyssins.ts"],
  ],
  [
    "phrase",
    "(TER Grenoble-Chambéry, 30 min Grenoble, 25 min Chambéry)",
    "(TER Chambéry, 25 min)",
    ["pontcharra.ts"],
  ],
  [
    "phrase",
    "tissu industriel microélectronique périphérique Grenoble.",
    "tissu industriel microélectronique en périphérie grenobloise.",
    ["crolles.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (10 min tramway E).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["saint-martin-le-vinoux.ts"],
  ],
  [
    "phrase",
    "Échirolles est à 7 km au sud de Grenoble, accessible via",
    "Échirolles est accessible via",
    ["echirolles.ts"],
  ],
  [
    "phrase",
    "avec le CHU Grenoble Alpes et structures hospitalières ?",
    "avec le CHU et les structures hospitalières ?",
    ["la-tronche.ts"],
  ],
  [
    "phrase",
    "à La Tronche (CHU Grenoble Nord, CHU Grenoble Alpes) sur",
    "à La Tronche (CHU) sur",
    ["la-tronche.ts"],
  ],
  [
    "phrase",
    "recherches en mathématiques de l'Université de Grenoble.",
    "recherches universitaires en mathématiques.",
    ["saint-martin-d-heres.ts"],
  ],
  [
    "phrase",
    ", en TER depuis Grenoble ou Lyon (cadencé 20 min) ou par",
    ", en TER (cadencé 20 min) ou par",
    ["voiron.ts"],
  ],
  ["liste-acces", "Grenoble centre à 20 min voiture N85 (route Napoléon). ", "", ["vizille.ts"]],
  [
    "phrase",
    "Lyon à 100 km (A43), Grenoble à 60 km (A41 Sud), Annecy",
    "Lyon à 100 km (A43), Annecy",
    ["chambery.ts"],
  ],
  [
    "phrase",
    "— sud Grenoble, vallée de la Gresse, péri-urbain rural.",
    "— sud grenoblois, vallée de la Gresse, péri-urbain rural.",
    ["vif.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (25 min voiture).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["vif.ts"],
  ],
  [
    "bureaux",
    "build IA-native depuis nos bureaux proches de CITIS :",
    "build IA-native, sur place ou à distance :",
    ["herouville-saint-clair.ts"],
  ],
  [
    "faq-question",
    'q: "Comment se déroule une mission depuis Grenoble ?"',
    'q: "Comment se passe une mission chez vous ?"',
    ["seyssins.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants se déplacent depuis Lyon et Grenoble.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["valence.ts"],
  ],
  [
    "phrase",
    "au carrefour des axes Lyon-Chambéry et Lyon-Grenoble.",
    "au carrefour des axes Lyon-Chambéry et A43.",
    ["la-tour-du-pin.ts"],
  ],
  [
    "phrase",
    " (frontière Isère-Savoie sur l'axe Grenoble-Chambéry)",
    " (frontière Isère-Savoie)",
    ["pontcharra.ts"],
  ],
  [
    "phrase",
    "Position péri-urbaine immédiate de Grenoble, à l'est.",
    "Position péri-urbaine à l'est de l'agglomération grenobloise.",
    ["domene.ts"],
  ],
  [
    "phrase",
    "(cluster deep-tech Grenoble), banlieue est Grenoble.",
    "(cluster deep-tech), banlieue est grenobloise.",
    ["meylan.ts"],
  ],
  [
    "phrase",
    "Saint-Martin-d'Hères, de Grenoble ou de la Métropole",
    "Saint-Martin-d'Hères ou de la Métropole",
    ["saint-martin-d-heres.ts"],
  ],
  [
    "faq-question",
    'q: "Comment se passe une mission depuis Grenoble ?"',
    'q: "Comment se passe une mission chez vous ?"',
    [
      "claix.ts",
      "domene.ts",
      "gieres.ts",
      "saint-ismier.ts",
      "saint-martin-d-uriage.ts",
      "saint-martin-le-vinoux.ts",
      "varces-allieres-et-risset.ts",
      "vizille.ts",
    ],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (20 min D524).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["saint-martin-d-uriage.ts"],
  ],
  [
    "phrase",
    "— banlieue nord Grenoble, Grenoble-Alpes Métropole.",
    "— banlieue nord grenobloise, métropole grenobloise.",
    ["saint-martin-le-vinoux.ts"],
  ],
  [
    "phrase",
    "mathematics research at the University of Grenoble.",
    "university mathematics research.",
    ["saint-martin-d-heres.ts"],
  ],
  [
    "phrase",
    "Située à 29 km au nord-ouest de Grenoble en bordure",
    "Située en bordure",
    ["voiron.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (15 min A41).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["domene.ts"],
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (20 min A41).",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["saint-ismier.ts"],
  ],
  [
    "phrase",
    "— sud Grenoble, plateforme industrielle historique",
    "— sud grenoblois, plateforme industrielle historique",
    ["le-pont-de-claix.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité immédiate.",
    "Nous intervenons partout en France, sur place ou à distance.",
    [
      "bompas.ts",
      "cabestany.ts",
      "canohes.ts",
      "pollestres.ts",
      "saint-esteve.ts",
      "saleilles.ts",
      "toulouges.ts",
    ],
  ],
  [
    "phrase",
    "deuxième ville de l'Isère après Grenoble, les TPE",
    "deuxième ville de l'Isère, les TPE",
    ["saint-martin-d-heres.ts"],
  ],
  ["phrase", "à 20 km de Grenoble sur l'axe A48 Lyon-Grenoble.", "sur l'axe A48.", ["voreppe.ts"]],
  [
    "phrase",
    "(Sassenage, Seyssinet-Pariset, Grenoble) coincé",
    "(Sassenage, Seyssinet-Pariset) coincé",
    ["fontaine.ts"],
  ],
  [
    "phrase",
    "bodies of the Grenoble Alpes university campus?",
    "bodies of the university campus?",
    ["saint-martin-d-heres.ts"],
  ],
  [
    "phrase",
    "Saint-Martin-d'Hères, Grenoble or the Métropole",
    "Saint-Martin-d'Hères or the Métropole",
    ["saint-martin-d-heres.ts"],
  ],
  ["phrase", "à 2,5 km de la gare de Grenoble, desservie par", "desservie par", ["fontaine.ts"]],
  [
    "phrase",
    "campus universitaire Université Grenoble Alpes",
    "campus universitaire",
    ["gieres.ts"],
  ],
  [
    "phrase",
    "vers Grenoble (env. 25 min) et Lyon (env. 1 h)",
    "vers Lyon (env. 1 h)",
    ["voiron.ts"],
  ],
  ["phrase", "(TER Lyon-Grenoble, 20 min Grenoble, 1h Lyon)", "(TER Lyon, 1h)", ["moirans.ts"]],
  ["phrase", "(TER Grenoble-Lyon, 30 min Grenoble, 1h Lyon)", "(TER Lyon, 1h)", ["rives.ts"]],
  ["phrase", "(TER Lyon-Grenoble, 30 min Grenoble, 1h Lyon)", "(TER Lyon, 1h)", ["tullins.ts"]],
  ["phrase", "(TER Lyon-Grenoble, 25 min Grenoble, 1h Lyon)", "(TER Lyon, 1h)", ["voreppe.ts"]],
  [
    "phrase",
    "Couverture également Grenoble-Alpes Métropole",
    "Couverture également de la métropole grenobloise",
    ["crolles.ts"],
  ],
  [
    "phrase",
    "La ville est reliée à Grenoble par la ligne A",
    "La ville est desservie par la ligne A",
    ["fontaine.ts"],
  ],
  ["liste-acces", "Grenoble centre à 15 min voiture A480/N532. ", "", ["claix.ts"]],
  [
    "phrase",
    "Axe A48 vers Lyon (1h) et Grenoble (20 min).",
    "Axe A48 vers Lyon (1h).",
    ["moirans.ts", "voreppe.ts"],
  ],
  [
    "phrase",
    "second-largest town in Isère after Grenoble,",
    "second-largest town in Isère,",
    ["saint-martin-d-heres.ts"],
  ],
  [
    "phrase",
    "banlieue ouest immédiate de Grenoble séparée",
    "banlieue ouest immédiate de l'agglomération grenobloise séparée",
    ["seyssinet-pariset.ts"],
  ],
  [
    "liste-acces",
    "Grenoble centre à 20 min voiture A480/N75. ",
    "",
    ["varces-allieres-et-risset.ts"],
  ],
  ["liste-acces", "Grenoble centre à 25 min voiture N75/A480. ", "", ["vif.ts"]],
  [
    "phrase",
    "11 km), 75 km de Grenoble et environ 110 km",
    "11 km) et environ 110 km",
    ["romans-sur-isere.ts"],
  ],
  ["phrase", "Routes : Grenoble 100 km au nord, Marseille", "Routes : Marseille", ["gap.ts"]],
  [
    "phrase",
    "l'intercommunalité Grenoble-Alpes Métropole",
    "l'intercommunalité de la métropole grenobloise",
    ["eybens.ts"],
  ],
  [
    "phrase",
    "mathématiciens de l'Université de Grenoble,",
    "mathématiciens universitaires,",
    ["saint-martin-d-heres.ts"],
  ],
  [
    "phrase",
    "Accès rapide centre Grenoble via tramway E.",
    "Accès rapide au centre via tramway E.",
    ["saint-martin-le-vinoux.ts"],
  ],
  [
    "phrase",
    "position carrefour Lyon-Grenoble-Chambéry.",
    "position carrefour Lyon-Chambéry.",
    ["la-tour-du-pin.ts"],
  ],
  [
    "phrase",
    "à l'est immédiat de Grenoble, est intégrée",
    "à l'est immédiat de l'agglomération grenobloise, est intégrée",
    ["domene.ts"],
  ],
  ["phrase", ", située 7 km au sud de Grenoble en Isère.", ", située en Isère.", ["echirolles.ts"]],
  [
    "phrase",
    "2nd city of the Grenoble metropolitan area",
    "2nd city of its metropolitan area",
    ["echirolles.ts"],
  ],
  [
    "phrase",
    "banlieue sud-est de Grenoble, est intégrée",
    "banlieue sud-est de l'agglomération grenobloise, est intégrée",
    ["eybens.ts"],
  ],
  [
    "phrase",
    "2e ville de l'Isère après Grenoble, est un",
    "2e ville de l'Isère, est un",
    ["saint-martin-d-heres.ts"],
  ],
  [
    "phrase",
    "Le vivier d'ingénieurs Grenoble INP–Esisar",
    "Le vivier d'ingénieurs de l'Esisar",
    ["valence.ts"],
  ],
  [
    "liste-acces",
    "Tramway A vers Grenoble centre (10 min). ",
    "",
    ["eybens.ts", "seyssinet-pariset.ts"],
  ],
  [
    "liste-acces",
    "Tramway A vers Grenoble centre (15 min). ",
    "",
    ["le-pont-de-claix.ts", "sassenage.ts"],
  ],
  ["liste-acces", "Tramway B vers Grenoble centre (15 min). ", "", ["meylan.ts"]],
  ["liste-acces", "Tramway E vers Grenoble centre (15 min). ", "", ["saint-egreve.ts"]],
  ["liste-acces", "Grenoble centre à 20 min voiture (D524). ", "", ["saint-martin-d-uriage.ts"]],
  ["liste-acces", "Tramway E vers Grenoble centre (10 min). ", "", ["saint-martin-le-vinoux.ts"]],
  [
    "liste-acces-reformule",
    "Gare Grenoble-Universités-Gières à 5 min.",
    "Gare Universités-Gières à 5 min.",
    ["gieres.ts"],
  ],
  [
    "phrase",
    "(~10 000 emplois sur l'axe Lyon-Grenoble)",
    "(~10 000 emplois sur l'axe A43)",
    ["bourgoin-jallieu.ts"],
  ],
  [
    "phrase",
    "banlieue est de Grenoble, mix résidentiel",
    "banlieue est grenobloise, mix résidentiel",
    ["saint-ismier.ts"],
  ],
  [
    "phrase",
    "— banlieue ouest Grenoble, massif Vercors",
    "— banlieue ouest grenobloise, massif Vercors",
    ["seyssinet-pariset.ts"],
  ],
  [
    "phrase",
    "une commune limitrophe de Grenoble (38600",
    "une commune de l'agglomération grenobloise (38600",
    ["fontaine.ts"],
  ],
  [
    "phrase",
    "spun off from the University of Grenoble,",
    "spun off from the local university,",
    ["saint-martin-d-heres.ts"],
  ],
  [
    "liste-acces",
    " Aéroport Grenoble-Alpes-Isère à 50 min.",
    "",
    [
      "eybens.ts",
      "la-tronche.ts",
      "le-pont-de-claix.ts",
      "meylan.ts",
      "moirans.ts",
      "saint-ismier.ts",
      "tullins.ts",
      "villard-bonnot.ts",
      "voreppe.ts",
    ],
  ],
  ["liste-acces", " Aéroport Grenoble-Alpes-Isère à 45 min.", "", ["rives.ts"]],
  [
    "phrase",
    "l'agglomération Grenoble-Alpes Métropole",
    "l'agglomération grenobloise",
    ["saint-egreve.ts"],
  ],
  [
    "phrase",
    "— nord-ouest Grenoble, massif Chartreuse",
    "— nord-ouest grenoblois, massif Chartreuse",
    ["saint-egreve.ts"],
  ],
  [
    "phrase",
    "Nous intervenons à Grenoble, La Tronche,",
    "Nous intervenons à La Tronche,",
    ["saint-martin-d-heres.ts"],
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité.",
    "Nous intervenons partout en France, sur place ou à distance.",
    ["elne.ts"],
  ],
  ["liste-acces", " Grenoble à 2h ouest (col du Lautaret).", "", ["briancon.ts"]],
  [
    "liste-acces",
    "Gare Grenoble à 15 min (TGV Paris 3h). ",
    "",
    ["eybens.ts", "seyssinet-pariset.ts"],
  ],
  [
    "liste-acces",
    "Gare Grenoble à 20 min (TGV Paris 3h). ",
    "",
    ["le-pont-de-claix.ts", "meylan.ts", "saint-egreve.ts", "sassenage.ts"],
  ],
  ["phrase", ", porte d'entrée vers Grenoble (60 km).", ".", ["bourgoin-jallieu.ts"]],
  [
    "phrase",
    "— banlieue ouest Grenoble, aire urbaine",
    "— banlieue ouest grenobloise, aire urbaine",
    ["seyssins.ts"],
  ],
  ["liste-acces", "Grenoble centre à 15 min voiture A41. ", "", ["domene.ts"]],
  ["liste-acces", " Grenoble centre à 15 min tramway B/D.", "", ["gieres.ts"]],
  ["liste-acces", "Grenoble centre à 20 min voiture A41. ", "", ["saint-ismier.ts"]],
  ["liste-acces", " Aéroport Grenoble-Alpes-Isère à 1h15.", "", ["vif.ts"]],
  [
    "phrase",
    "sud Grenoble, héritage rural Dauphiné.",
    "sud grenoblois, héritage rural Dauphiné.",
    ["varces-allieres-et-risset.ts"],
  ],
  [
    "phrase",
    "au sud immédiat de Grenoble, est ancré",
    "au sud immédiat de l'agglomération grenobloise, est ancré",
    ["le-pont-de-claix.ts"],
  ],
  ["phrase", "(cadencé 20 min vers Grenoble et Lyon)", "(cadencé 20 min vers Lyon)", ["voiron.ts"]],
  ["phrase", "on the A43 between Lyon and Grenoble.", "on the A43.", ["bourgoin-jallieu.ts"]],
  ["phrase", "l'axe stratégique Lyon-Grenoble (A48)", "l'axe stratégique A48", ["tullins.ts"]],
  [
    "phrase",
    "pôle hospitalier CHU Grenoble Nord et",
    "pôle hospitalier du CHU et",
    ["la-tronche.ts"],
  ],
  [
    "bureaux",
    "build IA-native depuis nos bureaux :",
    "build IA-native, sur place ou à distance :",
    ["concarneau.ts"],
  ],
  [
    "liste-acces",
    " Aéroport Grenoble-Alpes-Isère à 1h.",
    "",
    [
      "claix.ts",
      "crolles.ts",
      "domene.ts",
      "gieres.ts",
      "montbonnot-saint-martin.ts",
      "pontcharra.ts",
      "saint-marcellin.ts",
      "saint-martin-le-vinoux.ts",
      "seyssins.ts",
      "varces-allieres-et-risset.ts",
    ],
  ],
  [
    "liste-acces",
    "Aéroport Grenoble-Alpes-Isère à 1h. ",
    "",
    [
      "saint-egreve.ts",
      "saint-martin-d-uriage.ts",
      "sassenage.ts",
      "seyssinet-pariset.ts",
      "vizille.ts",
    ],
  ],
  ["phrase", "(TER Lyon-Grenoble, 40 min Grenoble)", "(TER Lyon)", ["saint-marcellin.ts"]],
  [
    "phrase",
    "Oui, nous couvrons Grenoble, Eybens,",
    "Oui, nous couvrons Eybens,",
    ["echirolles.ts"],
  ],
  ["phrase", "ou l'A480 depuis Grenoble — on remet", "ou l'A480 — on remet", ["fontaine.ts"]],
  [
    "phrase",
    "Domaine universitaire Grenoble Alpes",
    "Domaine universitaire",
    ["saint-martin-d-heres.ts"],
  ],
  [
    "phrase",
    "The Grenoble Alpes university campus",
    "The university campus",
    ["saint-martin-d-heres.ts"],
  ],
  [
    "phrase",
    "the Grenoble Alpes university campus",
    "the university campus",
    ["saint-martin-d-heres.ts"],
  ],
  [
    "phrase",
    "côté Seyssinet (limitrophe Grenoble)",
    "côté Seyssinet (en bordure du Drac)",
    ["seyssinet-pariset.ts"],
  ],
  [
    "phrase",
    "du couloir rhodanien Lyon-Grenoble.",
    "du couloir rhodanien.",
    ["bourgoin-jallieu.ts"],
  ],
  [
    "phrase",
    "Couverture Grenoble-Alpes Métropole",
    "Couverture de la métropole grenobloise",
    [
      "domene.ts",
      "eybens.ts",
      "le-pont-de-claix.ts",
      "saint-egreve.ts",
      "saint-martin-le-vinoux.ts",
    ],
  ],
  [
    "phrase",
    "en périphérie nord-est de Grenoble.",
    "en périphérie nord-est de l'agglomération grenobloise.",
    ["crolles.ts"],
  ],
  [
    "phrase",
    "Caterpillar et Bull Grenoble (Atos)",
    "Caterpillar et Bull (Atos)",
    ["echirolles.ts"],
  ],
  ["phrase", "Seyssinet-Pariset, Grenoble, Engins", "Seyssinet-Pariset, Engins", ["fontaine.ts"]],
  ["phrase", "à La Tronche et CHU Grenoble Nord ?", "à La Tronche et au CHU ?", ["la-tronche.ts"]],
  ["phrase", "The Grenoble INP–Esisar engineering", "The Esisar engineering", ["valence.ts"]],
  [
    "phrase",
    "sur l'axe Lyon-Grenoble, Berjallie",
    "sur l'axe A43, Berjallie",
    ["bourgoin-jallieu.ts"],
  ],
  ["phrase", "Axe A41 vers Grenoble et Chambéry.", "Axe A41 vers Chambéry.", ["pontcharra.ts"]],
  ["phrase", "à 15 min, Grenoble à 1h, Marseille", "à 15 min, Marseille", ["valence.ts"]],
  [
    "phrase",
    "sud-ouest Grenoble-Alpes Métropole",
    "sud-ouest de la métropole grenobloise",
    ["claix.ts"],
  ],
  ["phrase", "du bassin nord-Isère vers Grenoble", "du bassin nord-Isère", ["voreppe.ts"]],
  ["phrase", "tout le nord-Isère vers Grenoble (", "tout le nord-Isère (", ["voreppe.ts"]],
  ["phrase", "sur l'A43 entre Lyon et Grenoble.", "sur l'A43.", ["bourgoin-jallieu.ts"]],
  [
    "phrase",
    "La ligne Valence–Grenoble dessert",
    "La ligne TER depuis Valence dessert",
    ["romans-sur-isere.ts"],
  ],
  [
    "phrase",
    "en banlieue est de Grenoble, mêle",
    "en banlieue est de l'agglomération grenobloise, mêle",
    ["saint-ismier.ts"],
  ],
  ["phrase", "cluster Grenoble-Chambéry-Annecy", "cluster Chambéry-Annecy", ["chambery.ts"]],
  ["phrase", "(TER Lyon-Grenoble, 25 min Lyon)", "(TER Lyon, 25 min)", ["la-verpilliere.ts"]],
  [
    "phrase",
    "l'ouest Grenoble-Alpes Métropole",
    "l'ouest de la métropole grenobloise",
    ["seyssins.ts"],
  ],
  ["phrase", "by any Grenoble metro integrator", "by any metro-area integrator", ["echirolles.ts"]],
  ["phrase", "campus Université Grenoble Alpes", "campus universitaire", ["gieres.ts"]],
  ["phrase", "missions au CHU Grenoble Nord ou", "missions au CHU ou", ["la-tronche.ts"]],
  [
    "phrase",
    "banlieue est de Grenoble, abrite",
    "banlieue est de l'agglomération grenobloise, abrite",
    ["meylan.ts"],
  ],
  [
    "phrase",
    "le sud Grenoble-Alpes Métropole",
    "le sud de la métropole grenobloise",
    ["varces-allieres-et-risset.ts"],
  ],
  [
    "phrase",
    "du sud Grenoble-Alpes Métropole",
    "du sud de la métropole grenobloise",
    ["varces-allieres-et-risset.ts"],
  ],
  ["phrase", "l'A480 depuis Grenoble assurent", "l'A480 assurent", ["fontaine.ts"]],
  ["phrase", "héritière du CEA-Leti Grenoble)", "héritière du CEA-Leti)", ["meylan.ts"]],
  [
    "phrase",
    "integrator in the Grenoble area",
    "integrator in the area",
    ["saint-martin-d-heres.ts"],
  ],
  ["liste-acces", " Grenoble centre à 30 min A48.", "", ["coublevie.ts"]],
  ["liste-acces", " Grenoble centre à 30 min A41.", "", ["crolles.ts"]],
  ["liste-acces", " Grenoble centre à 20 min A41.", "", ["montbonnot-saint-martin.ts"]],
  ["liste-acces", " Grenoble centre à 50 min A49.", "", ["saint-marcellin.ts"]],
  ["liste-acces", " Grenoble centre à 25 min A41.", "", ["villard-bonnot.ts"]],
  [
    "phrase",
    "(TER vallée Grenoble-Chambéry)",
    "(TER vallée du Grésivaudan)",
    ["crolles.ts", "villard-bonnot.ts"],
  ],
  ["phrase", "Axe A48 vers Lyon et Grenoble.", "Axe A48 vers Lyon.", ["rives.ts", "tullins.ts"]],
  ["phrase", "le CHU et la gare de Grenoble)", "le CHU et la gare)", ["saint-martin-d-heres.ts"]],
  ["phrase", "of the Lyon-Grenoble corridor", "of the A43 corridor", ["bourgoin-jallieu.ts"]],
  ["phrase", "sur l'axe Lyon-Grenoble (A48)", "sur l'axe A48", ["moirans.ts"]],
  ["phrase", "(sur l'axe Lyon-Grenoble A48)", "(sur l'axe A48)", ["moirans.ts"]],
  ["phrase", "dans Grenoble-Alpes Métropole", "dans la métropole grenobloise", ["sassenage.ts"]],
  ["phrase", "reliée à Grenoble par les bus", "desservie par les bus", ["fontaine.ts"]],
  ["phrase", "(Grenoble-Universités-Gières)", "(Universités-Gières)", ["gieres.ts"]],
  [
    "phrase",
    "et Grenoble-Alpes Métropole.",
    "et de la métropole grenobloise.",
    ["montbonnot-saint-martin.ts"],
  ],
  [
    "phrase",
    "de Grenoble-Alpes Métropole",
    "de la métropole grenobloise",
    [
      "claix.ts",
      "domene.ts",
      "echirolles.ts",
      "eybens.ts",
      "gieres.ts",
      "la-tronche.ts",
      "le-pont-de-claix.ts",
      "meylan.ts",
      "saint-martin-d-heres.ts",
      "saint-martin-le-vinoux.ts",
      "sassenage.ts",
      "seyssinet-pariset.ts",
      "seyssins.ts",
    ],
  ],
  [
    "phrase",
    "nord-ouest de Grenoble, fut",
    "nord-ouest de l'agglomération grenobloise, fut",
    ["sassenage.ts"],
  ],
  [
    "phrase",
    "à Grenoble-Alpes Métropole",
    "à la métropole grenobloise",
    ["claix.ts", "domene.ts", "eybens.ts", "saint-egreve.ts", "seyssinet-pariset.ts"],
  ],
  ["phrase", "by any Grenoble integrator", "by any local integrator", ["echirolles.ts"]],
  ["phrase", "du couloir Lyon-Grenoble.", "du couloir de l'A43.", ["bourgoin-jallieu.ts"]],
  ["phrase", "on the Lyon-Grenoble axis", "on the A43 axis", ["bourgoin-jallieu.ts"]],
  ["liste-acces", " Grenoble centre à 1h15.", "", ["bourg-les-valence.ts"]],
  [
    "liste-acces",
    "Gare Grenoble à 15 min. ",
    "",
    ["la-tronche.ts", "saint-martin-le-vinoux.ts", "seyssins.ts"],
  ],
  [
    "phrase",
    "au nord-est de Grenoble.",
    "au nord-est de l'agglomération grenobloise.",
    ["villard-bonnot.ts"],
  ],
  ["phrase", "cluster Grenoble-Annecy", "cluster d'Annecy", ["chambery.ts"]],
  [
    "liste-acces",
    " Grenoble centre à 1h.",
    "",
    [
      "charvieu-chavagneux.ts",
      "l-isle-d-abeau.ts",
      "la-verpilliere.ts",
      "pont-de-cheruy.ts",
      "saint-quentin-fallavier.ts",
      "tignieu-jameyzieu.ts",
      "villefontaine.ts",
    ],
  ],
  ["phrase", "(TER Valence-Grenoble)", "(TER Valence)", ["bourg-de-peage.ts"]],
  ["phrase", "axe A48 Lyon-Grenoble.", "axe A48.", ["tullins.ts"]],
  ["phrase", " (Golfe-Juan-Grenoble)", "", ["vizille.ts"]],
  ["phrase", " / A49 vers Grenoble.", ".", ["bourg-les-valence.ts"]],
  ["phrase", "axe A48 Lyon-Grenoble", "axe A48", ["moirans.ts", "tullins.ts"]],
  ["phrase", "Sciences Po Grenoble", "Sciences Po", ["saint-martin-d-heres.ts"]],
  [
    "phrase",
    "à l'est de Grenoble.",
    "à l'est de l'agglomération grenobloise.",
    ["saint-martin-d-uriage.ts"],
  ],
  [
    "phrase",
    "(TER Lyon-Grenoble)",
    "(TER Lyon)",
    [
      "charvieu-chavagneux.ts",
      "l-isle-d-abeau.ts",
      "saint-quentin-fallavier.ts",
      "villefontaine.ts",
    ],
  ],
  ["phrase", "(TER Grenoble-Lyon)", "(TER Lyon)", ["coublevie.ts"]],
  ["phrase", "(CHU Grenoble Nord)", "(CHU)", ["la-tronche.ts"]],
  ["liste-acces", " Grenoble à 2h30.", "", ["embrun.ts"]],
  ["phrase", "Polytech Grenoble", "Polytech", ["saint-martin-d-heres.ts"]],
  [
    "liste-acces",
    " Grenoble à 1h.",
    "",
    ["bourg-de-peage.ts", "la-ravoire.ts", "la-tour-du-pin.ts"],
  ],
  ["phrase", "sud Grenoble ?", "sud grenoblois ?", ["vizille.ts"]],
  ["phrase", "sud-Grenoble", "sud grenoblois", ["varces-allieres-et-risset.ts", "vif.ts"]],
];

/** Corrections de relecture, contre le texte issu de l'étape 1. */
const ETAPE_2 = [
  [
    "contradiction",
    " Nos consultants viennent de Toulouse, à 15 minutes.",
    " Nous intervenons sur place ou à distance.",
    ["cugnaux.ts"],
  ],
  [
    "contradiction",
    "Nos consultants se déplacent depuis Lyon sur tout le Nord-Isère :",
    "Nous intervenons sur place ou à distance sur tout le Nord-Isère :",
    ["bourgoin-jallieu.ts"],
  ],
  [
    "contradiction",
    "Nos consultants se déplacent depuis Paris via la gare TGV de Valence (20 km) ou Valence-Ville, dans le respect",
    "Nous intervenons sur place ou à distance, dans le respect",
    ["romans-sur-isere.ts"],
  ],
  [
    "contradiction",
    "l'ensemble de la métropole grenobloise depuis Échirolles.",
    "l'ensemble de la métropole grenobloise, sur place ou à distance.",
    ["echirolles.ts"],
  ],
  [
    "sillon-alpin",
    "Le cluster Chambéry-Annecy structure les pôles",
    "Le sillon alpin structure les pôles",
    ["chambery.ts"],
  ],
  [
    "sillon-alpin",
    "dans le cluster d'Annecy, en lien avec",
    "dans le sillon alpin, en lien avec",
    ["chambery.ts"],
  ],
  [
    "sillon-alpin",
    "avec le cluster Chambéry-Annecy et l'INES",
    "avec le sillon alpin et l'INES",
    ["chambery.ts"],
  ],
  [
    "sillon-alpin",
    "l'ensemble du cluster Chambéry-Annecy.",
    "l'ensemble du sillon alpin.",
    ["chambery.ts"],
  ],
  [
    "axe-a43",
    "au carrefour des axes Lyon-Chambéry et A43.",
    "sur l'axe A43 Lyon-Chambéry.",
    ["la-tour-du-pin.ts"],
  ],
  [
    "gare-gieres",
    "gare Universités-Gières (2e gare agglomération)",
    "gare de Gières (2e gare agglomération)",
    ["gieres.ts"],
  ],
  [
    "gare-gieres",
    "de l'agglomération grenobloise (Universités-Gières) et le campus",
    "de l'agglomération grenobloise et le campus",
    ["gieres.ts"],
  ],
  [
    "gare-gieres",
    "(« La Métro »), à l'est. Position stratégique : seconde gare ferroviaire de l'agglomération (Universités-Gières) desservant",
    "(« La Métro ») et se situe à l'est de l'agglomération. Position stratégique : seconde gare ferroviaire de l'agglomération, la gare de Gières, desservant",
    ["gieres.ts"],
  ],
  ["gare-gieres", "Gare Universités-Gières à 5 min.", "Gare de Gières à 5 min.", ["gieres.ts"]],
  [
    "phrase-sans-verbe",
    "Saint-Martin-le-Vinoux (38), commune du nord-ouest de la métropole grenobloise.",
    "Saint-Martin-le-Vinoux (38) est une commune du nord-ouest de la métropole grenobloise.",
    ["saint-martin-le-vinoux.ts"],
  ],
  [
    "sciences-po",
    "Polytech, Sciences Po, IUT 1) génère",
    "Polytech, l'institut d'études politiques (IEP), IUT 1) génère",
    ["saint-martin-d-heres.ts"],
  ],
  [
    "sciences-po",
    "Polytech, Sciences Po, IUT 1) s'étend",
    "Polytech, l'institut d'études politiques (IEP), IUT 1) s'étend",
    ["saint-martin-d-heres.ts"],
  ],
  [
    "sciences-po",
    "Polytech, Sciences Po, IUT 1) generates",
    "Polytech, the Institute of Political Studies (IEP), IUT 1) generates",
    ["saint-martin-d-heres.ts"],
  ],
  [
    "sciences-po",
    "Polytech, Sciences Po, IUT 1) largely",
    "Polytech, the Institute of Political Studies (IEP), IUT 1) largely",
    ["saint-martin-d-heres.ts"],
  ],
  [
    "ter-tronque",
    "(TER Lyon)",
    "(TER vers Lyon)",
    [
      "charvieu-chavagneux.ts",
      "coublevie.ts",
      "l-isle-d-abeau.ts",
      "saint-marcellin.ts",
      "saint-quentin-fallavier.ts",
      "villefontaine.ts",
    ],
  ],
  [
    "ter-tronque",
    "(TER Lyon, 1h)",
    "(TER vers Lyon, 1h)",
    ["moirans.ts", "rives.ts", "tullins.ts", "voreppe.ts"],
  ],
  ["ter-tronque", "(TER Lyon, 25 min)", "(TER vers Lyon, 25 min)", ["la-verpilliere.ts"]],
  ["ter-tronque", "(TER Chambéry, 25 min)", "(TER vers Chambéry, 25 min)", ["pontcharra.ts"]],
  ["ter-tronque", "(TER Valence)", "(TER vers Valence)", ["bourg-de-peage.ts"]],
  [
    "duree-orpheline",
    "métropole grenobloise (30 min A41) et accès Chambéry",
    "métropole grenobloise et accès Chambéry",
    ["crolles.ts"],
  ],
  ["seohook", 'seoHook: "parc technologique Inovallée",', 'seoHook: "Inovallée",', ["meylan.ts"]],
  [
    "fausse-presence-locaux",
    "build IA-native dans nos locaux et à distance :",
    "build IA-native, sur place ou à distance :",
    ["bouguenais.ts"],
  ],
  [
    "doublon-reponse",
    'a: "Nous intervenons partout en France, sur place ou à distance.',
    'a: "Sur place ou à distance, selon votre besoin.',
    [
      "briancon.ts",
      "charvieu-chavagneux.ts",
      "coublevie.ts",
      "la-tour-du-pin.ts",
      "moirans.ts",
      "pontcharra.ts",
      "rives.ts",
      "saint-ismier.ts",
      "saint-marcellin.ts",
      "saint-martin-d-uriage.ts",
      "tignieu-jameyzieu.ts",
      "tullins.ts",
      "varces-allieres-et-risset.ts",
      "vif.ts",
      "villard-bonnot.ts",
      "villefontaine.ts",
    ],
  ],
  [
    "doublon-reponse",
    "ponctuellement ETI dans le cadrage, le prototypage et l'industrialisation de cas d'usage IA. Nous intervenons partout en France, sur place ou à distance. Audit",
    "ponctuellement ETI dans le cadrage, le prototypage et l'industrialisation de cas d'usage IA. Interventions sur place ou à distance. Audit",
    ["fontaine.ts"],
  ],
  [
    "doublon-reponse",
    "tout le département. Nous intervenons partout en France, sur place ou à distance.",
    "tout le département, sur place ou à distance.",
    ["valence.ts"],
  ],
  [
    "faq-question",
    'q: "Comment se passe une mission chez vous ?"',
    'q: "Comment se déroule une intervention ?"',
    [
      "charvieu-chavagneux.ts",
      "claix.ts",
      "coublevie.ts",
      "crolles.ts",
      "domene.ts",
      "eybens.ts",
      "gieres.ts",
      "la-tour-du-pin.ts",
      "la-verpilliere.ts",
      "moirans.ts",
      "pontcharra.ts",
      "rives.ts",
      "saint-ismier.ts",
      "saint-marcellin.ts",
      "saint-martin-d-uriage.ts",
      "saint-martin-le-vinoux.ts",
      "sassenage.ts",
      "seyssinet-pariset.ts",
      "seyssins.ts",
      "tignieu-jameyzieu.ts",
      "tullins.ts",
      "varces-allieres-et-risset.ts",
      "villard-bonnot.ts",
      "villefontaine.ts",
      "vizille.ts",
      "voreppe.ts",
    ],
  ],
  [
    "faq-question",
    'q: "Comment se passe une mission rurale chez vous ?"',
    'q: "Comment se déroule une intervention rurale ?"',
    ["vif.ts"],
  ],
];

/** nom de fichier -> [[avant, après], ...] pour une étape. */
function indexer(etape) {
  const index = new Map();
  for (const [, de, vers, fichiers] of etape) {
    for (const nom of fichiers) {
      if (!index.has(nom)) index.set(nom, []);
      index.get(nom).push([de, vers]);
    }
  }
  return index;
}
const INDEX = [indexer(ETAPE_1), indexer(ETAPE_2)];

function nettoyer(nom, texte) {
  let t = texte;
  for (const index of INDEX) {
    const regles = index.get(nom) ?? [];
    for (let passe = 0; passe < 6; passe += 1) {
      const avant = t;
      for (const [de, vers] of regles) t = t.split(de).join(vers);
      if (t === avant) break;
    }
  }
  return t;
}

const noms = readdirSync(DOSSIER)
  .filter((n) => n.endsWith(".ts") && !IGNORES.has(n))
  .sort();

let modifies = 0;
let lignes = 0;
const parMotif = new Map();

for (const nom of noms) {
  const chemin = join(DOSSIER, nom);
  const avant = readFileSync(chemin, "utf8");
  const apres = nettoyer(nom, avant);
  if (apres === avant) continue;
  modifies += 1;
  const a = avant.split("\n");
  const b = apres.split("\n");
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === b[i]) continue;
    lignes += 1;
    if (DRY_RUN) {
      console.log(`${nom}:${i + 1}`);
      console.log(`  - ${a[i].trim()}`);
      console.log(`  + ${b[i].trim()}`);
    }
  }
  const motifs = new Set();
  for (const [motif, de, , fichiers] of [...ETAPE_1, ...ETAPE_2]) {
    if (fichiers.includes(nom) && avant.includes(de)) motifs.add(motif);
  }
  for (const motif of motifs) parMotif.set(motif, (parMotif.get(motif) ?? 0) + 1);
  if (!DRY_RUN) writeFileSync(chemin, apres);
}

console.log(
  `${DRY_RUN ? "[dry-run] " : ""}${modifies} fichier(s) à modifier, ${lignes} ligne(s) changée(s).`,
);
for (const [motif, n] of [...parMotif].sort()) console.log(`  ${motif} : ${n} fichier(s)`);
