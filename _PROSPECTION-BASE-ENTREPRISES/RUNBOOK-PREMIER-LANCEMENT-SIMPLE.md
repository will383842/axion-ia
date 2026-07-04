# Guide pas-à-pas — Premier lancement de la Prospection (version simple)

> Pour Will. Aucune décision technique à prendre : suis les étapes dans l'ordre.
> Ce qui est marqué « 🔧 ton dev/hébergeur » est à transmettre à la personne qui
> gère le serveur (ça se fait une fois, en 15 min).

---

## Avant de commencer — ce qu'il te faut sous la main

1. Ton **Kbis** (le document officiel de ta société) → pour y lire ton **SIREN**.
2. Savoir **qui gère ton serveur** (ton dev / ton hébergeur) → pour l'étape du fichier.

---

## Étape 1 — Dire au système QUI tu es (ton SIREN) · 5 min · toi

1. Connecte-toi à la console d'administration.
2. Va dans **Réglages du site → identité légale** (la clé s'appelle « legal_overrides »).
3. Recopie ton **SIREN** (les 9 chiffres sur ton Kbis). Ajoute aussi le **SIRET** et la
   **TVA** si tu les as (facultatif au début).
4. Enregistre.

✅ La raison sociale (Axion-IA) et le contact RGPD sont **déjà** remplis. Il ne manque que le SIREN.
Tu peux le vérifier dans **Prospection → Réglages** : le bandeau doit passer de « à compléter » à « complète ».

---

## Étape 2 — Donner l'annuaire des entreprises au système (fichier INSEE) · 15 min · 🔧 ton dev/hébergeur

C'est la seule partie « serveur ». Transmets ceci à ton dev :

1. Télécharger le **Stock Sirene** de l'INSEE (gratuit) :
   - Site : **insee.fr → Rubrique « Sirene » → « Fichiers Stock »** (ou data.gouv.fr « Base Sirene »).
   - Prendre **2 fichiers** : « StockUniteLegale » (les entreprises) et « StockEtablissement »
     (les adresses/établissements). Ce sont de gros fichiers (plusieurs Go) — c'est normal.
2. Les **déposer sur le serveur** et renseigner 2 variables d'environnement :
   - `PROSPECTION_STOCK_UNITE_LEGALE_PATH` = chemin du fichier « StockUniteLegale »
   - `PROSPECTION_STOCK_ETABLISSEMENT_PATH` = chemin du fichier « StockEtablissement »
3. Redémarrer l'application (ça applique aussi la mise à jour de la base automatiquement).

✅ Une fois fait, tu n'as plus jamais à y toucher (une mise à jour automatique tourne chaque nuit).

---

## Étape 3 — Remplir la base (une fois) · 1 clic · toi

1. Console → **Prospection → Réglages**.
2. Clique **« Lancer l'ingestion Stock »**.
3. Attends (le fichier est gros, ça peut prendre un moment). Quand c'est fini, **toutes les
   entreprises de France sont dans la base**, déjà classées par activité (santé, BTP, commerce…).

> Si tu cliques sans avoir fait l'étape 2, le système te le dit clairement (il refuse de tourner à vide).

---

## Étape 4 — Récupérer un département · 1 clic · toi

1. Console → **Prospection → Départements**.
2. **Coche** le(s) département(s) qui t'intéresse(nt) (ex. Isère = 38).
3. Clique **« 1️⃣ Récupérer »**.
4. La ligne du département se remplit : nombre d'entreprises, par activité. C'est **rapide**.

---

## Étape 5 — Enrichir le département · 1 clic · toi

1. Sur la même page, **coche** le(s) même(s) département(s).
2. Clique **« 2️⃣ Enrichir »**.
3. Le système va sur les sites web des entreprises pour trouver **emails, téléphones, responsables**.
   C'est **plus long** (ça tourne tout seul, tu peux fermer la page).
4. La colonne **Exploitables** monte au fur et à mesure : ce sont les entreprises **prêtes à contacter**.

---

## Étape 6 — Exploiter les résultats · toi

- **Prospection → Par activité** : vois, par secteur (et par métier précis), combien d'entreprises
  sont **exploitables** (ton taux de succès).
- **Prospection → Exports** : télécharge 3 listes (prêtes à contacter / à compléter / à revoir),
  déjà nettoyées (opt-out et non-diffusibles retirés).

---

## Plus tard (optionnel) — La spécialité des médecins (santé)

Seulement si tu veux distinguer cardiologue / ophtalmo… et avoir leur téléphone **sans site web** :

1. Faire **valider une AIPD** (document juridique) par un juriste/DPO — c'est parce que ce fichier
   contient des médecins **nommés**. (Un modèle est déjà pré-rempli dans le dossier.)
2. 🔧 ton dev : télécharger le fichier **« PS LibreAccès » de l'Annuaire Santé** + renseigner la
   variable `PROSPECTION_RPPS_PATH`, et **activer** `PROSPECTION_SANTE_INGESTION_ENABLED=true`.
3. Console → **Prospection → Réglages → « Lancer l'ingestion Santé (RPPS) »**.
4. Résultat : spécialité fine + téléphone + adresse des professionnels de santé, **sans crawler**.

Tant que l'AIPD n'est pas validée + le flag activé, le bouton **refuse** de tourner (protection).

---

## Ordre récapitulatif (le chemin le plus court)

1. Ton SIREN dans Réglages (toi, 5 min).
2. Fichier INSEE sur le serveur (ton dev, 15 min).
3. « Lancer l'ingestion Stock » (toi, 1 clic).
4. Départements → cocher → « Récupérer » (toi, 1 clic).
5. Départements → cocher → « Enrichir » (toi, 1 clic).
6. Par activité / Exports (toi).

C'est tout. La santé (RPPS) = un bonus optionnel pour plus tard.
