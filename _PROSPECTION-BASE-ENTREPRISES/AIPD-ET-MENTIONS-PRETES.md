# AIPD + LIA + Mention d'information — PRÉ-REMPLIES (prêtes à l'emploi)

> Objectif : **rien à rédiger de ton côté.** Tout est pré-rempli avec les paramètres du projet. Une
> relecture rapide (idéalement par un juriste/DPO) reste _recommandée_ avant la collecte en production,
> mais ce n'est plus un chantier — juste une validation/signature.
> ⚠️ Ce document est une base opérationnelle, pas un avis juridique. Adapter les 3 champs `[À COMPLÉTER]`
> (identité société, contact DPO, date) au moment de la mise en ligne.

---

## PARTIE 1 — Analyse d'Impact (AIPD / DPIA)

**1. Responsable de traitement** : `[À COMPLÉTER : raison sociale Axion-IA + SIREN]`, France.
**2. Traitement** : « Prospection & Base Entreprises » — constitution d'une base de prospects B2B par
collecte de données ouvertes officielles + coordonnées publiques des entreprises.
**3. Finalité** : identifier et contacter des entreprises françaises pertinentes pour l'offre d'Axion-IA
(formation/conseil/IA). V1 = constitution de base + export ; **pas d'envoi automatisé** (outreach = V2).
**4. Base légale** : intérêt légitime (art. 6.1.f RGPD) — voir LIA (Partie 2).
**5. Catégories de données** :

- Entreprise : SIREN/SIRET, dénomination, NAF, effectif/taille, adresse, forme juridique (non perso).
- Personnes (dirigeants, responsables) : nom, prénom, **fonction**, + email/téléphone **professionnels**
  publics. **PAS de date de naissance, PAS de données sensibles.**
  **6. Personnes concernées** : dirigeants et responsables d'entreprises/organisations françaises.
  **7. Sources** : données ouvertes officielles (Stock Sirene INSEE, INPI RNE, Annuaire de l'administration,
  BODACC, BAN) + **site public de l'entreprise concernée** (mentions légales/contact/équipe). Aucune source
  privée ni scraping de LinkedIn/Pages Jaunes/moteurs de recherche.
  **8. Destinataires** : équipe interne Axion-IA (accès restreint par rôle). **Aucun transfert hors UE.**
  **9. Durée de conservation** : **3 ans** après la dernière action (ou après la collecte si jamais
  contactée), puis purge automatique.
  **10. Mesures de sécurité** : accès admin authentifié (NextAuth) + rôles (RBAC), journal des accès aux
  données personnelles, chiffrement au repos (infra), IP hashées, sauvegardes.
  **11. Nécessité & proportionnalité** : minimisation (uniquement données pro utiles au B2B), sources
  publiques, pas de données sensibles, pas de décision automatisée.
  **12. Analyse des risques & mesures** :
  | Risque | Mesure en place |
  |---|---|
  | Personne non informée (collecte indirecte) | Mention d'information publique (Partie 3) + exemption art. 14.5.b |
  | Collecte déloyale / mauvaise entité | Liste blanche de sources + confirmation d'appartenance du domaine au SIREN |
  | Données périmées | Delta Sirene quotidien + fenêtre de fraîcheur + purge |
  | Personne non-diffusible / opposée | Exclusion systématique (`statutDiffusion`, opposition RNE) |
  | Refus de prospection (opt-out) | Registre d'opposition multi-clé, filtré à la collecte, à l'enrichissement ET à l'export |
  | Accès indu | RBAC + journal d'accès |
  **13. Profilage** : `leadScore` = simple aide au tri, **aucune décision automatisée à effet juridique**
  (hors art. 22).
  **14. Risque résiduel** : **faible** (données pro publiques, minimisation, opt-out effectif, sécurité).
  **15. Avis / validation** : `[À COMPLÉTER : nom + date — relecture DPO/juriste recommandée]`.

---

## PARTIE 2 — Test de mise en balance (LIA — intérêt légitime)

**a. Intérêt légitime** : développement commercial B2B d'Axion-IA (intérêt reconnu et légitime).
**b. Nécessité** : la prospection ciblée requiert une base qualifiée d'entreprises ; il n'existe pas
d'alternative moins intrusive à effet équivalent (les données sont déjà publiques).
**c. Mise en balance vs droits des personnes** : données **strictement professionnelles**, non sensibles,
issues de **sources publiques**, dans un contexte B2B où les personnes s'attendent raisonnablement à être
contactées dans le cadre de leur fonction ; l'**information** + le **droit d'opposition (opt-out)** +
la **minimisation** compensent l'atteinte. → **L'intérêt légitime prévaut**, sous réserve des mesures.
**Conclusion** : base légale « intérêt légitime » retenue et documentée.

---

## PARTIE 3 — Mention d'information (à publier sur le site — prête)

> Texte prêt à publier (page « Protection des données — prospection »). Remplacer les `[…]`.

**Collecte et traitement de données professionnelles à des fins de prospection**
« `[Raison sociale]` (« nous ») constitue une base de contacts professionnels afin de proposer ses
services (formation, conseil, IA) à des entreprises et organisations. Nous traitons des données
**professionnelles** (nom, prénom, fonction, coordonnées professionnelles) issues de **sources publiques
officielles** (registres INSEE/INPI, annuaires publics) et des **sites internet publics** des
entreprises. La base légale est notre **intérêt légitime** (art. 6.1.f RGPD) à développer notre activité
B2B. Ces données sont conservées **3 ans** à compter du dernier contact et sont réservées à notre usage
interne (aucun transfert hors UE). Conformément aux articles 14 à 21 du RGPD, vous disposez d'un **droit
d'accès, de rectification, d'opposition et d'effacement**. Pour l'exercer ou vous opposer à toute
prospection : `[email DPO/contact]` ou `[formulaire d'opposition en ligne]`. Vous pouvez introduire une
réclamation auprès de la CNIL. »

_(En raison du volume et de la collecte indirecte, l'information individuelle relèverait d'un effort
disproportionné au sens de l'art. 14.5.b RGPD ; cette notice publique en tient lieu. En cas d'outreach
V2, une information sera fournie au 1er contact.)_

---

## PARTIE 4 — Registre du traitement (entrée prête)

| Champ                   | Valeur                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| Nom                     | Prospection & Base Entreprises B2B                                     |
| Finalité                | Constitution de base de prospects + contact commercial                 |
| Base légale             | Intérêt légitime (art. 6.1.f)                                          |
| Catégories de personnes | Dirigeants/responsables d'entreprises FR                               |
| Catégories de données   | Identité pro (nom, prénom, fonction) + coordonnées pro publiques       |
| Sources                 | Registres publics (INSEE/INPI/BODACC/annuaires) + sites publics        |
| Destinataires           | Équipe interne (RBAC)                                                  |
| Transferts hors UE      | Aucun                                                                  |
| Durée                   | 3 ans après dernière action                                            |
| Mesures                 | Auth+RBAC, journal d'accès, opt-out multi-clé, chiffrement, purge auto |

---

## Ce qu'il te reste (minimal, non bloquant pour préparer)

1. Compléter les 3 champs `[À COMPLÉTER]` (identité société + contact DPO + date).
2. Publier la Partie 3 sur le site (une page). ← se fera automatiquement en tranche T8 (page RGPD).
3. **Recommandé, pas obligatoire pour démarrer** : faire relire ce document par un juriste avant la
   collecte en production. Tout est déjà rédigé → c'est une relecture, pas une rédaction.
