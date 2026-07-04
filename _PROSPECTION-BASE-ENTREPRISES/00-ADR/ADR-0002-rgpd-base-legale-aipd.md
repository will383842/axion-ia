# ADR-0002 — Conformité RGPD : base légale, AIPD et garde-fous

- **Statut** : **Accepté** (Will 2026-07-03) — validation juridique/DPO recommandée avant collecte prod (non bloquant build)
- **Date** : 2026-07-01
- **Module** : Prospection & Base Entreprises
- **Voir aussi** : `ADR-0001` (architecture collecte), `05-CONFORMITE-RGPD-AIPD.md` (détail), plan §9

## Contexte

Le module collecte à grande échelle des données d'entreprises françaises **et de personnes**
(dirigeants légaux, responsables de secteur/équipe, emails et téléphones). Même en B2B, le
**dirigeant/responsable identifiable, l'email nominatif et le téléphone direct sont des données
personnelles** (RGPD). Les données sont collectées **indirectement** (pas auprès de la personne) et
**enrichies/croisées** depuis plusieurs sources, avec un **scoring** (`leadScore`). Ce profil coche
plusieurs critères CNIL rendant une analyse d'impact quasi-obligatoire.

## Décision

1. **Base légale = intérêt légitime** (prospection B2B), **opposable uniquement si formellement pesée**
   via un **test de mise en balance (LIA)** documenté.
2. **AIPD/DPIA obligatoire et BLOQUANTE** : produite (modèle CNIL PIA) **avant tout connecteur de
   collecte**. Aucune collecte ne démarre sans AIPD validée.
3. **Statut « non-diffusible » INSEE** stocké et **exclusion systématique** de ces unités de la
   collecte, de l'affichage et de l'export.
4. **Opposition RNE/INPI** des personnes physiques à la réutilisation à des fins de prospection :
   respectée partout (`oppositionProspectionRNE`).
5. **Information des personnes (art. 14)** : notice publique complète (finalité, base légale,
   catégories, sources, durée, droits, contact DPO) + invocation documentée de l'**exemption « effort
   disproportionné » (art. 14.5.b)**. En V2 (outreach), l'information devient obligatoire au 1er contact.
6. **Opt-out réellement bloquant** : `SuppressionEntry` **multi-clé** (siren/email/domaine/personKey),
   vérifié **à la collecte, à l'enrichissement ET à la génération de l'export** ; page publique d'intake.
7. **Journal d'accès** aux données personnelles (qui consulte/recherche/exporte) + **RBAC** (export/bulk
   réservés `dpo|admin`).
8. **Minimisation** : pas de date de naissance ; `leadScore` = aide au tri, **aucune décision automatisée**
   (hors art. 22). **Durée de conservation** : 3 ans après dernière action (déclencheur = date de collecte
   pour un prospect jamais contacté) — à confirmer.
9. **Loyauté des sources** : données ouvertes officielles + site propre de chaque entreprise uniquement.
   **Interdits** : LinkedIn, Pages Jaunes, société.com, annuaires privés, **scraping de moteurs (SERP)**.

## Alternatives considérées

- **Consentement préalable** : inadapté à la prospection B2B de masse (impossible à recueillir en amont).
  Rejeté au profit de l'intérêt légitime + information + opposition.
- **Pas d'AIPD (registre seul)** : non conforme vu l'échelle + le profilage. Rejeté.
- **Notice passive sans exemption formalisée** : juridiquement insuffisant pour de la collecte indirecte.
  Rejeté au profit de l'exemption art. 14.5.b documentée.

## Conséquences

- **Positives** : conformité opposable, risque juridique maîtrisé, confiance, réutilisation des hooks
  RGPD existants (retention-purge, IP hashées).
- **Négatives / coûts** : AIPD + LIA à produire avant de coder (délai T0) ; complexité (exclusions
  non-diffusible/opposition à chaque étape) ; validation juridique externe recommandée.

## STOP & ASK

Durée de conservation exacte · texte de la notice d'information · toute source hors données ouvertes ·
tout usage outreach (V2) · validation AIPD/LIA par un DPO/juriste.
