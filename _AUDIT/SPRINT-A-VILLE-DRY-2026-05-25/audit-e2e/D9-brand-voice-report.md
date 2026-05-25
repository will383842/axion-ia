# AUDIT E2E PROFOND D-9 : BRAND VOICE & PATTERNS INTERDITS
**Date** : 2026-05-25  
**Codebase** : C:\Users\willi\Documents\Projets\Axion-IA\axionia  
**Scanned** : 1,528 fichiers TS/TSX  
**Agent** : D-9 (READ-ONLY SCAN)

---

## RÉSUMÉ EXÉCUTIF

**Verdict : NOGO (P0 détecté)**

Le codebase contient **3 violations P0 critiques** dans le générateur landing-ville-by-vertical-audits.ts qui VIOLE directement l'interdiction absolue du brief Sprint A : aucune durée fixe d'audit ne doit être mentionnée ("5 jours ouvrés", "audit en 5 jours", etc.).

Ces violations se trouvent dans le **system prompt et user prompt** du générateur qui est exécuté directement pour créer les pages landing ville, ce qui signifie que **toutes les pages générées par ce générateur héritent de cette violation**.

---

## VIOLATIONS P0 DÉTECTÉES (3)

### 1. landing-ville-by-vertical-audits.ts:6 — SYSTEM PROMPT

Fichier : src/server/content-gen/generators/landing-ville-by-vertical-audits.ts
Ligne : 6
Contenu : Tone : analytique, ROI-focused, "diagnostic complet en 5 jours ouvrés".

**Problème** : Durée fixe ("5 jours ouvrés") dans le tone même du générateur.
Contraire à landing-ville-shared.ts:254.

**Fix** : Remplacer par "diagnostic adapté à la taille et au périmètre de votre entreprise"

---

### 2. landing-ville-by-vertical-audits.ts:32 — SYSTEM PROMPT OVERRIDE

Fichier : src/server/content-gen/generators/landing-ville-by-vertical-audits.ts
Lignes : 22-33

**Problème** : Même violation P0 injectée dans systemPromptOverride.
Affecte directement Claude Sonnet 4.6 qui génère le contenu landing.

---

### 3. landing-ville-by-vertical-audits.ts:37 — USER PROMPT FOCUS

Fichier : src/server/content-gen/generators/landing-ville-by-vertical-audits.ts
Lignes : 34-39
Contenu : CTA principal : /audit (formulaire 5 étapes → rapport 5 jours ouvrés).

**Problème** : Impose une durée fixe dans le CTA du formulaire audit.

---

## VIOLATIONS P1 DÉTECTÉES (3 — À VÉRIFIER)

1. **audit-detail-configs.ts:196** : "Démarrage sous 7 jours ouvrés"
   - Acceptable si c'est la durée RÉELLE du Flash Remote
   - À confirmer avec Will

2. **m-positionnements.ts:316** : "premier atelier sous 5 jours ouvrés"
   - Acceptable si limité au Flash audit UNIQUEMENT
   - À vérifier

3. **m-positionnements.ts:1140** : "rapport en 5 à 10 jours ouvrés"
   - À confirmer si c'est la plage réelle du Ciblé

---

## PATTERNS INTERDITS — ABSENCE CONFIRMÉE

✓ NDA disponible : Absent  
✓ certifié AFNOR/ISO : Absent  
✓ équipe restreinte : Absent  
✓ révolutionne : Absent  
✓ LVMH/BNP Paribas comme partenaires : Absent  
✓ PME sans TPE/ETI : Absent  
✓ "applications" pour sites web : Absent  
✓ Meta-narration HCU : Absent  

---

## CONTACT@AXION-IA.COM — ACCEPTABLES

~60+ occurences détectées.
Contexte : LEGAL/TECHNIQUE → ACCEPTABLE (DPO emails, formulaires, fallbacks, fichiers ai.txt/policy.json)

---

## SCORE BRAND VOICE

**Score final : 3/10**

3 violations P0 critiques dans le générateur audit (impact majeur sur toutes les landing ville générées).

---

## FICHIERS À CORRIGER

### PRIORITY 1 — CRITIQUE

**Fichier** : src/server/content-gen/generators/landing-ville-by-vertical-audits.ts

3 lignes à modifier :
- Ligne 6 : Supprimer "5 jours ouvrés" du tone
- Ligne 32 : Supprimer "5 jours ouvrés" du systemPromptOverride
- Ligne 37 : Remplacer "rapport 5 jours ouvrés" par "rapport avec délai adapté"

---

## AUDIT RÉALISÉ PAR
Agent D-9 (READ-ONLY PROFOND SCAN)
Date : 2026-05-25
Status : Complet
