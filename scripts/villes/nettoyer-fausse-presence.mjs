#!/usr/bin/env node
/**
 * Nettoie la fausse présence physique et « Grenoble » dans
 * `src/content/villes/copy/*.ts`.
 *
 * Axion-IA n'a aucun bureau ni consultant basé localement : elle intervient
 * partout en France, sur place ou à distance. « Grenoble » est interdit en
 * communication.
 *
 * Méthode : une TABLE de remplacements par chaîne EXACTE (motif, avant, après).
 * Aucune expression régulière appliquée au texte. Chaque ligne de la table est
 * une phrase ou une proposition fautive, remplacée par une formulation vraie.
 * Rien d'autre n'est touché. `grenoble.ts` (page DE la ville) est ignoré : il
 * ne contient aucune phrase de présence à retirer, le nom y est le sujet.
 *
 * Usage :
 *   node scripts/villes/nettoyer-fausse-presence.mjs --dry-run   # affiche fichier:ligne avant/après
 *   node scripts/villes/nettoyer-fausse-presence.mjs             # écrit
 *
 * Après écriture, lancer `pnpm exec prettier --write` sur les fichiers touchés : certaines
 * chaînes tiennent désormais sur une ligne et prettier les remonte.
 *
 * Idempotent : relancé après écriture, il ne change rien (code de sortie 0,
 * « 0 fichier à modifier »). Les remplacements sont rejoués jusqu'à stabilité
 * (6 passes max) : retirer une phrase peut en exposer une autre en début de
 * chaîne.
 *
 * Verrouillé par `tests/unit/content/villes-sans-fausse-presence.spec.ts`.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DOSSIER = join(process.cwd(), "src", "content", "villes", "copy");
const IGNORES = new Set(["grenoble.ts"]);
const DRY_RUN = process.argv.includes("--dry-run");

/** [motif, avant exact, après]. Appliqués dans cet ordre (du plus long au plus court). */
const TABLE = [
  ["phrase", 'seoHook: "proche grenoble",', 'seoHook: "parc technologique Inovallée",'],
  [
    "phrase",
    "Fontaine est à 2,5 km de la gare de Grenoble (TGV Paris en 3h00), 35 km de l'aéroport Grenoble-Alpes-Isère et 85 km de l'aéroport Lyon-Saint-Exupéry, accessible par l'A480 et la ligne A du tramway de Grenoble.",
    "Fontaine est à 85 km de l'aéroport Lyon-Saint-Exupéry, accessible par l'A480 et la ligne A du tramway.",
  ],
  [
    "phrase",
    "Seyssins est membre de la métropole Grenoble-Alpes Métropole (« La Métro »), à l'ouest immédiat de Grenoble dans l'aire urbaine de l'agglomération.",
    "Seyssins est membre de la métropole grenobloise (« La Métro »), à l'ouest immédiat de l'agglomération dans l'aire urbaine.",
  ],
  [
    "phrase",
    "commune de l'aire urbaine de Grenoble adhérente à Grenoble-Alpes Métropole, jouxte Seyssinet-Pariset à l'ouest immédiat de Grenoble.",
    "commune de l'aire urbaine grenobloise adhérente à la métropole grenobloise, jouxte Seyssinet-Pariset à l'ouest immédiat de l'agglomération.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (10 min tramway A) ou Lyon (1h15 voiture A48) pour les missions sur site à Seyssinet-Pariset.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "phrase",
    " La gare de Grenoble (TGV Paris ~3 h) est à environ 7 km, et l'aéroport Grenoble-Alpes-Isère est accessible en 45 min par l'A48.",
    "",
  ],
  [
    "phrase",
    "commune limitrophe de Grenoble, abrite un pôle hospitalier majeur : CHU Grenoble Nord (CHU Grenoble Alpes) et site historique",
    "commune de l'agglomération grenobloise, abrite un pôle hospitalier majeur : le CHU et le site historique",
  ],
  [
    "basés",
    "Nos consultants sont basés à Paris et se déplacent dans les 20 arrondissements ainsi que dans la première couronne.",
    "Nous intervenons dans les 20 arrondissements ainsi que dans la première couronne, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (35 min A43) ou Grenoble (1h voiture) pour les missions sur site à Villefontaine.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés à Lille (20 min) et couvrent l'ensemble de l'axe Lille-Tourcoing-frontière belge.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés à Lille (10 min) et couvrent l'ensemble de la Métropole Européenne de Lille.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés à Lille (12 min) et couvrent l'ensemble de la Métropole Européenne de Lille.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants arrivent par la ligne A du tramway de Grenoble (5 stations à Fontaine) ou par l'A480.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "hebergement",
    "Pour les missions multi-jours en zone rurale, hébergement local possible (gîtes ou hôtels Grenoble).",
    "Pour les missions de plusieurs jours en zone rurale, un hébergement local est possible.",
  ],
  [
    "phrase",
    "CHU Grenoble Nord (CHU Grenoble Alpes, l'un des plus importants CHU de France) et site historique",
    "le CHU (l'un des plus importants CHU de France) et site historique",
  ],
  [
    "phrase",
    "Couverture Grenoble-Alpes Métropole et accès depuis Lyon (1h15 A48) ou Paris (TGV Grenoble 3h).",
    "Couverture de la métropole grenobloise.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (20 min A480 ou via tramway A à Pont-de-Claix + voiture).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "phrase",
    "— limitrophe Grenoble, hôpitaux civil et militaire (CHU Grenoble Nord, École militaire santé).",
    "— commune grenobloise, hôpitaux civil et militaire (CHU, École militaire santé).",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (10-15 min tramway A via Seyssinet) ou Lyon (1h15 A48).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "phrase",
    " La gare de Grenoble est à environ 5 km, l'aéroport de Grenoble Alpes Isère à environ 45 km.",
    "",
  ],
  [
    "phrase",
    "— sud-ouest Grenoble, balcons sud Vercors, banlieue résidentielle Grenoble-Alpes Métropole.",
    "— sud-ouest grenoblois, balcons sud Vercors, banlieue résidentielle de la métropole grenobloise.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (10 min tramway A) ou Paris (TGV Grenoble 3h + tram).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (1h A43), Grenoble (1h voiture) ou Chambéry (50 min A43).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "phrase",
    "— banlieue sud-est Grenoble, route Napoléon (retour Île d'Elbe), Grenoble-Alpes Métropole.",
    "— banlieue sud-est grenobloise, route Napoléon (retour Île d'Elbe), métropole grenobloise.",
  ],
  [
    "phrase",
    "membre de Grenoble-Alpes Métropole en position limitrophe nord-ouest de Grenoble, au pied",
    "membre de la métropole grenobloise en position nord-ouest, au pied",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Paris (TGV Grenoble 3h + tram E) ou Lyon (1h15 voiture A48).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité de La Défense (10 min) et Paris centre (25 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "phrase",
    "toute Grenoble-Alpes Métropole (Grenoble, Saint-Martin-d'Hères, Échirolles, La Tronche)",
    "toute la métropole grenobloise (Saint-Martin-d'Hères, Échirolles, La Tronche)",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Paris (TGV Grenoble 3h + tram/voiture) ou Lyon (1h15 A48).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité, déplacement sous 10 min depuis Annecy centre.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "phrase",
    "commune limitrophe au nord-ouest de Grenoble, est membre de Grenoble-Alpes Métropole.",
    "commune du nord-ouest de la métropole grenobloise.",
  ],
  [
    "bureaux",
    "puis mise en production sans downtime depuis nos bureaux ou les vôtres à Carquefou —",
    "puis mise en production sans downtime, sur place à Carquefou ou à distance —",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants se déplacent sur site à Briançon depuis Gap (1h15) ou Grenoble (2h).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble centre (15 min tramway B/D) ou Lyon (1h15 A48).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (15 min tramway A) ou Lyon (1h15 voiture A48).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "hebergement",
    "Pour les multi-jours, hébergement local possible (hôtels Grenoble ou Saint-Égrève).",
    "Pour les missions de plusieurs jours, un hébergement local est possible.",
  ],
  [
    "phrase",
    "Gières est membre de Grenoble-Alpes Métropole (« La Métro »), à l'est de Grenoble.",
    "Gières est membre de la métropole grenobloise (« La Métro »), à l'est.",
  ],
  [
    "basés",
    "Nos consultants sont basés à Limoges (10 min) et couvrent tout Limoges Métropole.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés à Limoges (15 min) et couvrent tout Limoges Métropole.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité immédiate de Vannes, à 10 minutes de Séné.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants se déplacent depuis Lyon et Grenoble pour les missions sur site.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés à Poitiers (10 min) et couvrent tout Grand Poitiers.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés à Poitiers (15 min) et couvrent tout Grand Poitiers.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés à Poitiers (20 min) et couvrent tout Grand Poitiers.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "hebergement",
    "Pour les multi-jours, hébergement local possible (hôtels Grenoble ou Vercors).",
    "Pour les missions de plusieurs jours, un hébergement local est possible.",
  ],
  [
    "hebergement",
    "Pour les multi-jours, hébergement local possible (hôtels Voreppe ou Grenoble).",
    "Pour les missions de plusieurs jours, un hébergement local est possible.",
  ],
  [
    "hebergement",
    "Pour les multi-jours, hébergement local possible (hôtels Grenoble ou Eybens).",
    "Pour les missions de plusieurs jours, un hébergement local est possible.",
  ],
  [
    "hebergement",
    "Pour les multi-jours, hébergement local possible (hôtels Voiron ou Grenoble).",
    "Pour les missions de plusieurs jours, un hébergement local est possible.",
  ],
  [
    "phrase",
    "Voiron est à 29 km par la route au nord-ouest de Grenoble via l'autoroute A48",
    "Voiron est accessible par l'autoroute A48",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Gap (1h15 sud) ou Grenoble (2h col du Lautaret).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (15 min A480/N532) ou Lyon (1h15 A48).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés sur Rennes, déplacement en 25 min via la RN157.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (20 min A480) ou Lyon (1h30 voiture).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (20 min voiture N85, route Napoléon).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (1h A48) ou Grenoble (20 min A48 ou TER).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés en agglomération angevine, déplacement rapide.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés en agglomération mancelle, déplacement rapide.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité de Limoges, déplacement en 10 min.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "bureaux",
    " Démos hebdomadaires en visio depuis nos bureaux, à 40 minutes de Nantes.",
    " Démos hebdomadaires en visio.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (50 min A49) ou Lyon (1h15 voiture).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "phrase",
    "— vallée du Grésivaudan, banlieue est Grenoble, Grenoble-Alpes Métropole.",
    "— vallée du Grésivaudan, banlieue est grenobloise, métropole grenobloise.",
  ],
  [
    "phrase",
    "— est Grenoble, gare Grenoble-Universités-Gières (2e gare agglomération)",
    "— est grenoblois, gare Universités-Gières (2e gare agglomération)",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (25 min A41) ou Chambéry (50 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (30 min A41) ou Chambéry (25 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (30 min A41) ou Chambéry (50 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (35 min A43) ou Grenoble (1h voiture).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (40 min A43) ou Grenoble (1h voiture).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "phrase",
    "commune à l'est de Grenoble dans la métropole Grenoble-Alpes Métropole,",
    "commune de l'est de la métropole grenobloise,",
  ],
  [
    "basés",
    "Nos consultants sont basés sur le bassin nantais, à 15 min du centre.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "faq-question",
    'q: "Comment se passe une mission depuis Lyon, Grenoble ou Chambéry ?"',
    'q: "Comment se passe une mission chez vous ?"',
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (20 min A41) ou Lyon (1h15 A48).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (1h A43) ou Grenoble (1h voiture).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (1h A48) ou Grenoble (20 min A48).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (1h A48) ou Grenoble (30 min A48).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "hebergement",
    "Pour les multi-jours, hébergement local possible (hôtels Grenoble).",
    "Pour les missions de plusieurs jours, un hébergement local est possible.",
  ],
  [
    "phrase",
    "domaine universitaire de Grenoble (Polytech Grenoble, bibliothèque",
    "domaine universitaire (Polytech, bibliothèque",
  ],
  [
    "bureaux",
    "mise en production sans downtime depuis nos bureaux toulousains —",
    "mise en production sans downtime, sur place ou à distance —",
  ],
  [
    "phrase",
    "La proximité immédiate de Grenoble (2,5 km de la gare) et du pôle",
    "La proximité immédiate du pôle",
  ],
  [
    "faq-question",
    'q: "Comment se passe une mission depuis Grenoble ou Chambéry ?"',
    'q: "Comment se passe une mission chez vous ?"',
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (35 min A43) ou Grenoble (1h).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Lyon (40 min A43) ou Grenoble (1h).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  ["liste-acces", "Tramway B (CHU-Michallon arrêt) vers Grenoble centre (10 min). ", ""],
  [
    "phrase",
    "occupe une position carrefour entre Lyon, Grenoble et Chambéry.",
    "occupe une position carrefour entre Lyon et Chambéry.",
  ],
  [
    "phrase",
    "limitrophe immédiate de Grenoble dans Grenoble-Alpes Métropole.",
    "immédiatement voisine du centre de la métropole grenobloise.",
  ],
  [
    "phrase",
    "commune limitrophe de Grenoble dans l'agglomération grenobloise",
    "commune de l'agglomération grenobloise",
  ],
  [
    "consultants-viennent-de",
    "Consultants depuis Lyon (40 min A43) ou Grenoble (1h voiture).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés sur Rennes, déplacement en 15 min.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité de Perpignan (10 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité de Perpignan (12 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité de Perpignan (15 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité de Perpignan (20 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité de Perpignan (25 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité de Perpignan (30 min).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "faq-question",
    'q: "Comment se déroule une mission depuis Grenoble ou Lyon ?"',
    'q: "Comment se passe une mission chez vous ?"',
  ],
  [
    "basés",
    "Nos consultants sont basés en proximité, déplacement rapide.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés sur Lille, déplacement en 10 min.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés sur Lille, déplacement en 12 min.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "basés",
    "Nos consultants sont basés sur Lille, déplacement en 20 min.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "faq-question",
    'q: "Comment se passe une mission depuis Grenoble ou Paris ?"',
    'q: "Comment se passe une mission chez vous ?"',
  ],
  [
    "phrase",
    "Position de transit entre Lyon et Grenoble, proximité Voiron",
    "Position de transit sur l'A48, proximité Voiron",
  ],
  [
    "faq-question",
    'q: "Comment se passe une mission depuis Grenoble ou Lyon ?"',
    'q: "Comment se passe une mission chez vous ?"',
  ],
  [
    "faq-question",
    'q: "Comment se passe une mission depuis Lyon ou Grenoble ?"',
    'q: "Comment se passe une mission chez vous ?"',
  ],
  ["phrase", " et accès rapide depuis Lyon (1h A48) ou Grenoble (20 min).", "."],
  [
    "faq-question",
    'q: "Comment se passe une mission rurale depuis Grenoble ?"',
    'q: "Comment se passe une mission rurale chez vous ?"',
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (25 min voiture N75).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  ["liste-acces", "Tramway A vers Grenoble centre (10-15 min via Seyssinet). ", ""],
  ["phrase", "(TER Grenoble-Chambéry, 30 min Grenoble, 25 min Chambéry)", "(TER Chambéry, 25 min)"],
  [
    "phrase",
    "tissu industriel microélectronique périphérique Grenoble.",
    "tissu industriel microélectronique en périphérie grenobloise.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (10 min tramway E).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "phrase",
    "Échirolles est à 7 km au sud de Grenoble, accessible via",
    "Échirolles est accessible via",
  ],
  [
    "phrase",
    "avec le CHU Grenoble Alpes et structures hospitalières ?",
    "avec le CHU et les structures hospitalières ?",
  ],
  ["phrase", "à La Tronche (CHU Grenoble Nord, CHU Grenoble Alpes) sur", "à La Tronche (CHU) sur"],
  [
    "phrase",
    "recherches en mathématiques de l'Université de Grenoble.",
    "recherches universitaires en mathématiques.",
  ],
  [
    "phrase",
    ", en TER depuis Grenoble ou Lyon (cadencé 20 min) ou par",
    ", en TER (cadencé 20 min) ou par",
  ],
  ["liste-acces", "Grenoble centre à 20 min voiture N85 (route Napoléon). ", ""],
  [
    "phrase",
    "Lyon à 100 km (A43), Grenoble à 60 km (A41 Sud), Annecy",
    "Lyon à 100 km (A43), Annecy",
  ],
  [
    "phrase",
    "— sud Grenoble, vallée de la Gresse, péri-urbain rural.",
    "— sud grenoblois, vallée de la Gresse, péri-urbain rural.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (25 min voiture).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "bureaux",
    "build IA-native depuis nos bureaux proches de CITIS :",
    "build IA-native, sur place ou à distance :",
  ],
  [
    "faq-question",
    'q: "Comment se déroule une mission depuis Grenoble ?"',
    'q: "Comment se passe une mission chez vous ?"',
  ],
  [
    "consultants-viennent-de",
    "Nos consultants se déplacent depuis Lyon et Grenoble.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "phrase",
    "au carrefour des axes Lyon-Chambéry et Lyon-Grenoble.",
    "au carrefour des axes Lyon-Chambéry et A43.",
  ],
  ["phrase", " (frontière Isère-Savoie sur l'axe Grenoble-Chambéry)", " (frontière Isère-Savoie)"],
  [
    "phrase",
    "Position péri-urbaine immédiate de Grenoble, à l'est.",
    "Position péri-urbaine à l'est de l'agglomération grenobloise.",
  ],
  [
    "phrase",
    "(cluster deep-tech Grenoble), banlieue est Grenoble.",
    "(cluster deep-tech), banlieue est grenobloise.",
  ],
  [
    "phrase",
    "Saint-Martin-d'Hères, de Grenoble ou de la Métropole",
    "Saint-Martin-d'Hères ou de la Métropole",
  ],
  [
    "faq-question",
    'q: "Comment se passe une mission depuis Grenoble ?"',
    'q: "Comment se passe une mission chez vous ?"',
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (20 min D524).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "phrase",
    "— banlieue nord Grenoble, Grenoble-Alpes Métropole.",
    "— banlieue nord grenobloise, métropole grenobloise.",
  ],
  [
    "phrase",
    "mathematics research at the University of Grenoble.",
    "university mathematics research.",
  ],
  ["phrase", "Située à 29 km au nord-ouest de Grenoble en bordure", "Située en bordure"],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (15 min A41).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "consultants-viennent-de",
    "Nos consultants viennent de Grenoble (20 min A41).",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "phrase",
    "— sud Grenoble, plateforme industrielle historique",
    "— sud grenoblois, plateforme industrielle historique",
  ],
  [
    "basés",
    "Nos consultants sont basés à proximité immédiate.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  [
    "phrase",
    "deuxième ville de l'Isère après Grenoble, les TPE",
    "deuxième ville de l'Isère, les TPE",
  ],
  ["phrase", "à 20 km de Grenoble sur l'axe A48 Lyon-Grenoble.", "sur l'axe A48."],
  [
    "phrase",
    "(Sassenage, Seyssinet-Pariset, Grenoble) coincé",
    "(Sassenage, Seyssinet-Pariset) coincé",
  ],
  ["phrase", "bodies of the Grenoble Alpes university campus?", "bodies of the university campus?"],
  [
    "phrase",
    "Saint-Martin-d'Hères, Grenoble or the Métropole",
    "Saint-Martin-d'Hères or the Métropole",
  ],
  ["phrase", "à 2,5 km de la gare de Grenoble, desservie par", "desservie par"],
  ["phrase", "campus universitaire Université Grenoble Alpes", "campus universitaire"],
  ["phrase", "vers Grenoble (env. 25 min) et Lyon (env. 1 h)", "vers Lyon (env. 1 h)"],
  ["phrase", "(TER Lyon-Grenoble, 20 min Grenoble, 1h Lyon)", "(TER Lyon, 1h)"],
  ["phrase", "(TER Grenoble-Lyon, 30 min Grenoble, 1h Lyon)", "(TER Lyon, 1h)"],
  ["phrase", "(TER Lyon-Grenoble, 30 min Grenoble, 1h Lyon)", "(TER Lyon, 1h)"],
  ["phrase", "(TER Lyon-Grenoble, 25 min Grenoble, 1h Lyon)", "(TER Lyon, 1h)"],
  [
    "phrase",
    "Couverture également Grenoble-Alpes Métropole",
    "Couverture également de la métropole grenobloise",
  ],
  [
    "phrase",
    "La ville est reliée à Grenoble par la ligne A",
    "La ville est desservie par la ligne A",
  ],
  ["liste-acces", "Grenoble centre à 15 min voiture A480/N532. ", ""],
  ["phrase", "Axe A48 vers Lyon (1h) et Grenoble (20 min).", "Axe A48 vers Lyon (1h)."],
  ["phrase", "second-largest town in Isère after Grenoble,", "second-largest town in Isère,"],
  [
    "phrase",
    "banlieue ouest immédiate de Grenoble séparée",
    "banlieue ouest immédiate de l'agglomération grenobloise séparée",
  ],
  ["liste-acces", "Grenoble centre à 20 min voiture A480/N75. ", ""],
  ["liste-acces", "Grenoble centre à 25 min voiture N75/A480. ", ""],
  ["phrase", "11 km), 75 km de Grenoble et environ 110 km", "11 km) et environ 110 km"],
  ["phrase", "Routes : Grenoble 100 km au nord, Marseille", "Routes : Marseille"],
  [
    "phrase",
    "l'intercommunalité Grenoble-Alpes Métropole",
    "l'intercommunalité de la métropole grenobloise",
  ],
  ["phrase", "mathématiciens de l'Université de Grenoble,", "mathématiciens universitaires,"],
  [
    "phrase",
    "Accès rapide centre Grenoble via tramway E.",
    "Accès rapide au centre via tramway E.",
  ],
  ["phrase", "position carrefour Lyon-Grenoble-Chambéry.", "position carrefour Lyon-Chambéry."],
  [
    "phrase",
    "à l'est immédiat de Grenoble, est intégrée",
    "à l'est immédiat de l'agglomération grenobloise, est intégrée",
  ],
  ["phrase", ", située 7 km au sud de Grenoble en Isère.", ", située en Isère."],
  ["phrase", "2nd city of the Grenoble metropolitan area", "2nd city of its metropolitan area"],
  [
    "phrase",
    "banlieue sud-est de Grenoble, est intégrée",
    "banlieue sud-est de l'agglomération grenobloise, est intégrée",
  ],
  ["phrase", "2e ville de l'Isère après Grenoble, est un", "2e ville de l'Isère, est un"],
  ["phrase", "Le vivier d'ingénieurs Grenoble INP–Esisar", "Le vivier d'ingénieurs de l'Esisar"],
  ["liste-acces", "Tramway A vers Grenoble centre (10 min). ", ""],
  ["liste-acces", "Tramway A vers Grenoble centre (15 min). ", ""],
  ["liste-acces", "Tramway B vers Grenoble centre (15 min). ", ""],
  ["liste-acces", "Tramway E vers Grenoble centre (15 min). ", ""],
  ["liste-acces", "Grenoble centre à 20 min voiture (D524). ", ""],
  ["liste-acces", "Tramway E vers Grenoble centre (10 min). ", ""],
  [
    "liste-acces-reformule",
    "Gare Grenoble-Universités-Gières à 5 min.",
    "Gare Universités-Gières à 5 min.",
  ],
  ["phrase", "(~10 000 emplois sur l'axe Lyon-Grenoble)", "(~10 000 emplois sur l'axe A43)"],
  [
    "phrase",
    "banlieue est de Grenoble, mix résidentiel",
    "banlieue est grenobloise, mix résidentiel",
  ],
  [
    "phrase",
    "— banlieue ouest Grenoble, massif Vercors",
    "— banlieue ouest grenobloise, massif Vercors",
  ],
  [
    "phrase",
    "une commune limitrophe de Grenoble (38600",
    "une commune de l'agglomération grenobloise (38600",
  ],
  ["phrase", "spun off from the University of Grenoble,", "spun off from the local university,"],
  ["liste-acces", " Aéroport Grenoble-Alpes-Isère à 50 min.", ""],
  ["liste-acces", " Aéroport Grenoble-Alpes-Isère à 45 min.", ""],
  ["phrase", "l'agglomération Grenoble-Alpes Métropole", "l'agglomération grenobloise"],
  [
    "phrase",
    "— nord-ouest Grenoble, massif Chartreuse",
    "— nord-ouest grenoblois, massif Chartreuse",
  ],
  ["phrase", "Nous intervenons à Grenoble, La Tronche,", "Nous intervenons à La Tronche,"],
  [
    "basés",
    "Nos consultants sont basés à proximité.",
    "Nous intervenons partout en France, sur place ou à distance.",
  ],
  ["liste-acces", " Grenoble à 2h ouest (col du Lautaret).", ""],
  ["liste-acces", "Gare Grenoble à 15 min (TGV Paris 3h). ", ""],
  ["liste-acces", "Gare Grenoble à 20 min (TGV Paris 3h). ", ""],
  ["phrase", ", porte d'entrée vers Grenoble (60 km).", "."],
  [
    "phrase",
    "— banlieue ouest Grenoble, aire urbaine",
    "— banlieue ouest grenobloise, aire urbaine",
  ],
  ["liste-acces", "Grenoble centre à 15 min voiture A41. ", ""],
  ["liste-acces", " Grenoble centre à 15 min tramway B/D.", ""],
  ["liste-acces", "Grenoble centre à 20 min voiture A41. ", ""],
  ["liste-acces", " Aéroport Grenoble-Alpes-Isère à 1h15.", ""],
  ["phrase", "sud Grenoble, héritage rural Dauphiné.", "sud grenoblois, héritage rural Dauphiné."],
  [
    "phrase",
    "au sud immédiat de Grenoble, est ancré",
    "au sud immédiat de l'agglomération grenobloise, est ancré",
  ],
  ["phrase", "(cadencé 20 min vers Grenoble et Lyon)", "(cadencé 20 min vers Lyon)"],
  ["phrase", "on the A43 between Lyon and Grenoble.", "on the A43."],
  ["phrase", "l'axe stratégique Lyon-Grenoble (A48)", "l'axe stratégique A48"],
  ["phrase", "pôle hospitalier CHU Grenoble Nord et", "pôle hospitalier du CHU et"],
  ["bureaux", "build IA-native depuis nos bureaux :", "build IA-native, sur place ou à distance :"],
  ["liste-acces", " Aéroport Grenoble-Alpes-Isère à 1h.", ""],
  ["liste-acces", "Aéroport Grenoble-Alpes-Isère à 1h. ", ""],
  ["phrase", "(TER Lyon-Grenoble, 40 min Grenoble)", "(TER Lyon)"],
  ["phrase", "Oui, nous couvrons Grenoble, Eybens,", "Oui, nous couvrons Eybens,"],
  ["phrase", "ou l'A480 depuis Grenoble — on remet", "ou l'A480 — on remet"],
  ["phrase", "Domaine universitaire Grenoble Alpes", "Domaine universitaire"],
  ["phrase", "The Grenoble Alpes university campus", "The university campus"],
  ["phrase", "the Grenoble Alpes university campus", "the university campus"],
  ["phrase", "côté Seyssinet (limitrophe Grenoble)", "côté Seyssinet (en bordure du Drac)"],
  ["phrase", "du couloir rhodanien Lyon-Grenoble.", "du couloir rhodanien."],
  ["phrase", "Couverture Grenoble-Alpes Métropole", "Couverture de la métropole grenobloise"],
  [
    "phrase",
    "en périphérie nord-est de Grenoble.",
    "en périphérie nord-est de l'agglomération grenobloise.",
  ],
  ["phrase", "Caterpillar et Bull Grenoble (Atos)", "Caterpillar et Bull (Atos)"],
  ["phrase", "Seyssinet-Pariset, Grenoble, Engins", "Seyssinet-Pariset, Engins"],
  ["phrase", "à La Tronche et CHU Grenoble Nord ?", "à La Tronche et au CHU ?"],
  ["phrase", "The Grenoble INP–Esisar engineering", "The Esisar engineering"],
  ["phrase", "sur l'axe Lyon-Grenoble, Berjallie", "sur l'axe A43, Berjallie"],
  ["phrase", "Axe A41 vers Grenoble et Chambéry.", "Axe A41 vers Chambéry."],
  ["phrase", "à 15 min, Grenoble à 1h, Marseille", "à 15 min, Marseille"],
  ["phrase", "sud-ouest Grenoble-Alpes Métropole", "sud-ouest de la métropole grenobloise"],
  ["phrase", "du bassin nord-Isère vers Grenoble", "du bassin nord-Isère"],
  ["phrase", "tout le nord-Isère vers Grenoble (", "tout le nord-Isère ("],
  ["phrase", "sur l'A43 entre Lyon et Grenoble.", "sur l'A43."],
  ["phrase", "La ligne Valence–Grenoble dessert", "La ligne TER depuis Valence dessert"],
  [
    "phrase",
    "en banlieue est de Grenoble, mêle",
    "en banlieue est de l'agglomération grenobloise, mêle",
  ],
  ["phrase", "cluster Grenoble-Chambéry-Annecy", "cluster Chambéry-Annecy"],
  ["phrase", "(TER Lyon-Grenoble, 25 min Lyon)", "(TER Lyon, 25 min)"],
  ["phrase", "l'ouest Grenoble-Alpes Métropole", "l'ouest de la métropole grenobloise"],
  ["phrase", "by any Grenoble metro integrator", "by any metro-area integrator"],
  ["phrase", "campus Université Grenoble Alpes", "campus universitaire"],
  ["phrase", "missions au CHU Grenoble Nord ou", "missions au CHU ou"],
  [
    "phrase",
    "banlieue est de Grenoble, abrite",
    "banlieue est de l'agglomération grenobloise, abrite",
  ],
  ["phrase", "le sud Grenoble-Alpes Métropole", "le sud de la métropole grenobloise"],
  ["phrase", "du sud Grenoble-Alpes Métropole", "du sud de la métropole grenobloise"],
  ["phrase", "l'A480 depuis Grenoble assurent", "l'A480 assurent"],
  ["phrase", "héritière du CEA-Leti Grenoble)", "héritière du CEA-Leti)"],
  ["phrase", "integrator in the Grenoble area", "integrator in the area"],
  ["liste-acces", " Grenoble centre à 30 min A48.", ""],
  ["liste-acces", " Grenoble centre à 30 min A41.", ""],
  ["liste-acces", " Grenoble centre à 20 min A41.", ""],
  ["liste-acces", " Grenoble centre à 50 min A49.", ""],
  ["liste-acces", " Grenoble centre à 25 min A41.", ""],
  ["phrase", "(TER vallée Grenoble-Chambéry)", "(TER vallée du Grésivaudan)"],
  ["phrase", "Axe A48 vers Lyon et Grenoble.", "Axe A48 vers Lyon."],
  ["phrase", "le CHU et la gare de Grenoble)", "le CHU et la gare)"],
  ["phrase", "of the Lyon-Grenoble corridor", "of the A43 corridor"],
  ["phrase", "sur l'axe Lyon-Grenoble (A48)", "sur l'axe A48"],
  ["phrase", "(sur l'axe Lyon-Grenoble A48)", "(sur l'axe A48)"],
  ["phrase", "dans Grenoble-Alpes Métropole", "dans la métropole grenobloise"],
  ["phrase", "reliée à Grenoble par les bus", "desservie par les bus"],
  ["phrase", "(Grenoble-Universités-Gières)", "(Universités-Gières)"],
  ["phrase", "et Grenoble-Alpes Métropole.", "et de la métropole grenobloise."],
  ["phrase", "de Grenoble-Alpes Métropole", "de la métropole grenobloise"],
  ["phrase", "nord-ouest de Grenoble, fut", "nord-ouest de l'agglomération grenobloise, fut"],
  ["phrase", "à Grenoble-Alpes Métropole", "à la métropole grenobloise"],
  ["phrase", "by any Grenoble integrator", "by any local integrator"],
  ["phrase", "du couloir Lyon-Grenoble.", "du couloir de l'A43."],
  ["phrase", "on the Lyon-Grenoble axis", "on the A43 axis"],
  ["liste-acces", " Grenoble centre à 1h15.", ""],
  ["liste-acces", "Gare Grenoble à 15 min. ", ""],
  ["phrase", "au nord-est de Grenoble.", "au nord-est de l'agglomération grenobloise."],
  ["phrase", "cluster Grenoble-Annecy", "cluster d'Annecy"],
  ["liste-acces", " Grenoble centre à 1h.", ""],
  ["phrase", "(TER Valence-Grenoble)", "(TER Valence)"],
  ["phrase", "axe A48 Lyon-Grenoble.", "axe A48."],
  ["phrase", " (Golfe-Juan-Grenoble)", ""],
  ["phrase", " / A49 vers Grenoble.", "."],
  ["phrase", "axe A48 Lyon-Grenoble", "axe A48"],
  ["phrase", "Sciences Po Grenoble", "Sciences Po"],
  ["phrase", "à l'est de Grenoble.", "à l'est de l'agglomération grenobloise."],
  ["phrase", "(TER Lyon-Grenoble)", "(TER Lyon)"],
  ["phrase", "(TER Grenoble-Lyon)", "(TER Lyon)"],
  ["phrase", "(CHU Grenoble Nord)", "(CHU)"],
  ["liste-acces", " Grenoble à 2h30.", ""],
  ["phrase", "Polytech Grenoble", "Polytech"],
  ["liste-acces", " Grenoble à 1h.", ""],
  ["phrase", "sud Grenoble ?", "sud grenoblois ?"],
  ["phrase", "sud-Grenoble", "sud grenoblois"],
];

function nettoyer(texte) {
  let t = texte;
  for (let passe = 0; passe < 6; passe += 1) {
    const avant = t;
    for (const [, de, vers] of TABLE) t = t.split(de).join(vers);
    if (t === avant) break;
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
  const apres = nettoyer(avant);
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
  for (const [motif, de] of TABLE) if (avant.includes(de)) motifs.add(motif);
  for (const motif of motifs) parMotif.set(motif, (parMotif.get(motif) ?? 0) + 1);
  if (!DRY_RUN) writeFileSync(chemin, apres);
}

console.log(
  `${DRY_RUN ? "[dry-run] " : ""}${modifies} fichier(s) à modifier, ${lignes} ligne(s) changée(s).`,
);
for (const [motif, n] of [...parMotif].sort()) console.log(`  ${motif} : ${n} fichier(s)`);
