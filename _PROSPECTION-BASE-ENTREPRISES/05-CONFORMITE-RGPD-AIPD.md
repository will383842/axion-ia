# 05 — Conformité RGPD / AIPD

> Spec de conception. Source de vérité : `PLAN-DIRECTEUR-V1.md` §9. **Contrainte n°1 — à verrouiller
> AVANT tout connecteur.** Validation par un DPO/juriste recommandée.

## 0. Rappel en langage simple

- **AIPD (DPIA)** : étude de risques obligatoire à produire **avant** de démarrer un traitement à
  grande échelle de données personnelles.
- **Non-diffusible INSEE** : entreprises (souvent indépendants) ayant demandé que leurs données **ne
  soient pas publiques** → à **exclure**.
- **Opposition RNE** : un entrepreneur peut **refuser** que ses données servent à la prospection → à respecter.
- **Info art. 14** : collecte indirecte (pas auprès de la personne) → obligation d'**informer** (notice
  publique, exemption « effort disproportionné » possible).
- **Opt-out bloquant** : « retirez-moi » = **vraiment** exclu, y compris de l'export.
- **Journal d'accès** : tracer qui consulte/exporte des données perso.
- **Minimisation** : ne collecter que le nécessaire.

## 1. AIPD (structure — modèle CNIL PIA)

1. **Description du traitement** : collecte + enrichissement d'entreprises FR et de personnes
   (dirigeants, responsables), finalité **prospection B2B** d'Axion-IA.
2. **Finalités** : constituer une base qualifiée pour l'activité commerciale (V1 : base + export).
3. **Base légale** : **intérêt légitime** (art. 6.1.f) + **LIA** (§2).
4. **Nécessité / proportionnalité** : minimisation (§6), données limitées au B2B, pas de données sensibles.
5. **Catégories de données** : identité entreprise (SIREN/NAF/taille/adresse), personnes (nom, prénom,
   fonction), coordonnées pro (email, téléphone) — **pas de date de naissance**.
6. **Personnes concernées** : dirigeants et responsables d'entreprises françaises.
7. **Sources** : données ouvertes officielles (Sirene, RNE, annuaires publics) + site public de l'entreprise.
8. **Destinataires** : équipe interne (RBAC) ; pas de transfert hors UE.
9. **Durée de conservation** : 3 ans après dernière action (déclencheur = collecte si jamais contacté) — à confirmer.
10. **Mesures de sécurité** : accès admin authentifié + RBAC, journal d'accès, chiffrement au repos (infra), logs.
11. **Risques & mesures** : collecte déloyale → liste blanche + confirmation domaine ; personnes non
    informées → notice art. 14 ; données périmées → delta + fraîcheur ; réidentification → minimisation.
12. **Risque résiduel** : à évaluer et faire valider.

## 2. LIA (test de mise en balance)

- **Intérêt légitime** : développement commercial B2B (légitime, reconnu).
- **Nécessité** : la prospection ciblée requiert une base qualifiée ; pas d'alternative moins intrusive
  à effet équivalent.
- **Balance vs droits** : données **professionnelles**, non sensibles, issues de sources publiques ;
  attentes raisonnables des personnes en contexte B2B ; **opt-out + information** compensent. → intérêt
  légitime **prévaut**, sous réserve des mesures.

## 3. Registre du traitement

Entrée « Prospection B2B » : finalité, base légale, catégories, sources, destinataires, durée, mesures,
responsable + DPO.

## 4. Non-diffusible + opposition RNE

- `statutDiffusion` stocké ; **exclusion systématique** des non-diffusibles (collecte, affichage, export).
- `oppositionProspectionRNE` respecté partout.
- **Test d'acceptation** : un SIREN non-diffusible n'apparaît jamais en base ni en export.

## 5. Information des personnes (art. 14)

- **Notice publique** complète : finalité, base légale, catégories, sources, durée, droits (accès,
  rectification, opposition, effacement), contact DPO.
- **Exemption « effort disproportionné » (art. 14.5.b)** documentée pour la collecte de masse indirecte.
- **V2 (outreach)** : information obligatoire **au 1er contact** (bloc dans chaque email).

## 6. Opt-out réellement bloquant

- `SuppressionEntry` **multi-clé** : `siren | email | domaine | personKey`.
- **Vérifié à 3 points** : (1) avant écriture collecte, (2) avant enrichissement, (3) **à la génération
  de l'export** (re-filtre live → un opt-out arrivé après collecte n'est jamais exporté).
- **Page publique d'exercice des droits** (formulaire) alimentant la liste.
- **Opt-out par personne** transverse aux entreprises (`personKey`).

## 7. Journal d'accès & RBAC

`ProspectionAccessLog` (userId, action `view_person|search|export`, cible, timestamp), conservé ~6-12 mois.
RBAC : export/bulk réservés `dpo|admin`.

## 8. Minimisation & profilage

Pas de date de naissance. `leadScore` = **aide au tri**, **aucune décision automatisée à effet juridique**
(hors art. 22). Données limitées au strict B2B.

## 9. Loyauté des sources

Données ouvertes officielles + **site propre de chaque entreprise** uniquement (droit sui generis des
bases L.341-1 CPI respecté : pas d'extraction substantielle d'un annuaire tiers). **Interdits** :
LinkedIn, Pages Jaunes, société.com, annuaires privés, scraping de SERP.

## 10. STOP & ASK / validations

Durée de conservation · texte de la notice · toute source hors données ouvertes · tout usage outreach
(V2) · **validation AIPD + LIA par un DPO/juriste avant tout connecteur**.
