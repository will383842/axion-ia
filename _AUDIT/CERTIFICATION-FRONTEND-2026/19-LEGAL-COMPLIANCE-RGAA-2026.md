# 19 — LEGAL COMPLIANCE + RGAA 2026

> Audit légal : RGPD, CGV, mentions OÜ Estonienne, RGAA accessibilité, cookies banner.

## Audit en 5 chapitres × 10 critères = 50 points

### 1. Mentions légales OÜ Estonienne

1.1 Page mentions légales existe (`/mentions-legales`)
1.2 Raison sociale OÜ complète
1.3 Registrikood (numéro registre EE)
1.4 VAT EE (TVA intracommunautaire)
1.5 Adresse siège social Estonie
1.6 Email contact légal
1.7 Téléphone (si applicable)
1.8 Représentant légal (nom)
1.9 Hébergeur (Hetzner Allemagne, adresse)
1.10 Directeur publication

### 2. RGPD compliance

2.1 Politique confidentialité complète (`/politique-confidentialite`)
2.2 Bases légales traitement (consentement, contrat, intérêt légitime)
2.3 Finalités traitement listées
2.4 Durée conservation par catégorie
2.5 Destinataires données (sous-traitants : Hetzner, Cloudflare, etc.)
2.6 Transferts hors UE : aucun (souveraineté)
2.7 Droits utilisateur (accès, rectification, effacement, opposition, portabilité)
2.8 DPO contact (Will ou externalisé)
2.9 Procédure plainte CNIL mentionnée
2.10 Page dédiée droits utilisateur fonctionnelle (`/mes-donnees`)

### 3. Cookies & tracking

3.1 Cookies banner conforme RGPD (consentement explicite avant traceurs)
3.2 Refus aussi facile que accepter
3.3 Cookies preferences page (`/preferences-cookies`)
3.4 Liste cookies avec finalité, durée, type
3.5 Cookies essentiels distincts (pas de consentement requis)
3.6 Cookies analytics (consentement requis)
3.7 Cookies marketing (consentement requis)
3.8 Cookies third-party listés
3.9 Consentement persisté (LocalStorage ou cookie dédié)
3.10 Audit conformité (CookieBot, Axeptio, ou self-hosted)

### 4. CGV & politique commerciale

4.1 CGV complètes (`/conditions-generales`)
4.2 Tarifs précis (audit, intervention, implementation)
4.3 Conditions paiement (acompte 50 %, virement)
4.4 Délais livraison
4.5 Politique annulation
4.6 Politique remboursement
4.7 Garanties (si applicable)
4.8 Responsabilité limitée
4.9 Litiges (juridiction Estonie, médiation)
4.10 Politique déplacement (`/politique-deplacement`) à jour

### 5. RGAA accessibilité (France)

5.1 Page accessibilité publiée (`/accessibilite`)
5.2 Statut RGAA (Conforme / Partiellement / Non conforme)
5.3 Audit RGAA effectué (date)
5.4 Liste non-conformités si partielle
5.5 Plan d'amélioration
5.6 Date dernière mise à jour audit
5.7 Contact accessibilité
5.8 Procédure recours (Défenseur des Droits FR)
5.9 Date publication déclaration
5.10 Lien depuis footer ou pied de page

## Méthode

- Phase A : Lister pages légales existantes, vérifier complétude
- Phase A bis : Audit RGPD (sous-traitants, transferts, durées)
- Phase B : Diagnostic /50
- Phase C : Plan complétion
- Phase D : STOP & ASK
- Phase E : Application

## STOP & ASK

1. Avant changement page légale (validation juridique souhaitable)
2. Avant changement cookies banner
3. Avant tout commit

## Cible

> 100 % conformité RGPD + RGAA + CGV. OÜ Estonienne mentions complètes. Cookies banner conforme. 0 risque juridique.

## Livrables

```
audit-19-legal-SYNTHESE.md
audit-19-legal-DIAGNOSTIC.md
audit-19-legal-RGPD-AUDIT.md
audit-19-legal-RGAA-DECLARATION.md  (template à publier)
audit-19-legal-CGV-AUDIT.md
audit-19-legal-PLAN.md
```
