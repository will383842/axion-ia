# ADR 0024 — Classification AI Act EU 2024/1689 d'Axion-IA

> ⚠️ **SUPERSEDED (identité) — Axion-IA est désormais une SAS française (régime France).** Toute référence à « Axion-IA OÜ » ou à l'autorité estonienne **AKI** ci-dessous est obsolète : l'autorité de contrôle compétente est la **CNIL** (et l'autorité française de marché pour l'AI Act). La classification AI Act elle-même (risque, GPAI aval, transparence art. 50) reste valable. Corps historique conservé pour l'audit trail.

- **Statut** : Accepté
- **Date** : 2026-05-15
- **Auteur** : Will + Claude (Opus 4.7), suite à méta-cert `_AUDIT/META-CERT-2026-05-15/20-AI-ACT-EU-2026.md` P0-3
- **Référence** : Règlement (UE) 2024/1689 (AI Act EU), `/transparence`, `/equipe/manon`, `/sous-processeurs`, `_AUDIT/META-CERT-2026-05-15/05-RGPD-AI-ACT-V2.md`

## Contexte

L'AI Act EU 2024/1689 est entré en vigueur le 1er août 2024, applicable
progressivement de 2025 à 2027. Axion-IA OÜ opère une factory de contenu
éditorial IA-assistée (Pipeline 1 RSS, Pipeline 2 articles factory,
Pipeline 3 KB, fiches villes pSEO). L'audit méta-cert AGENT 20 a noté
que la classification du système Axion-IA dans le cadre AI Act n'est
documentée nulle part — risque légal si une autorité demande la
qualification (la qualification implicite n'est pas valable).

Cette ADR explicite la position d'Axion-IA OÜ vis-à-vis des 4 articles
clés de l'AI Act applicables à un usage marketing B2B de l'IA générative.

## Décision

### Article 50 — Obligations de transparence

**Applicable. Conformité revendiquée.**

L'article 50 §4 impose une divulgation _« in a clear and distinguishable
manner at the first interaction »_ pour tout contenu généré ou
manipulé par l'IA.

**Implémentation Axion-IA :**

- **Machine-readable** : tous les Article / BlogPosting / TechArticle /
  NewsArticle JSON-LD produits par les factories portent `creator` →
  Manon Person + `disambiguatingDescription` (texte AI Act art. 50) +
  `usageInfo` → `/transparence` (cf. `src/lib/seo-content-gen-factories.ts`
  `buildArticleBase`).
- **Human-visible** : composant `AiContentDisclaimer` (cf. `src/components/marketing/AiContentDisclaimer.tsx`)
  affiché en pied d'article sur les 4 routes factory (`/blog/[slug]`,
  `/actualites/[slug]`, `/centre-aide/[slug]`, `/guides/[slug]`).
- **Persona Manon** : `/equipe/manon` documente le caractère IA-disclosed
  du portrait + de la voix éditoriale. `AuthorProfile.aiGenerated = true`
  côté DB.
- **Hub** : `/transparence` consolide la doctrine pour le visiteur humain
  et un éventuel auditeur AKI / CNIL.

### Article 52 — Systèmes d'IA à haut risque

**Non applicable. Position documentée.**

Axion-IA OÜ n'opère **pas** un système d'IA à haut risque au sens de
l'annexe III du Règlement. La factory produit des contenus marketing B2B
(articles SEO, FAQ, fiches villes) — pas de décision automatisée sur :

- accès à l'éducation ou à la formation professionnelle ;
- accès aux services privés ou publics essentiels (santé, justice, social) ;
- recrutement / évaluation employé / promotion / licenciement ;
- scoring crédit / assurance / fraude ;
- migration, asile, contrôle des frontières ;
- application de la loi, biométrie temps réel.

Conséquence : aucune obligation de conformité art. 8-15, 16-21, 22-29
(gestion des risques, gouvernance des données, documentation technique,
surveillance humaine, exactitude, déclaration de conformité, marquage CE).

### Article 53 — Modèles d'IA à usage général (GPAI)

**Position : downstream user (deployer) — pas provider de GPAI.**

Axion-IA OÜ est utilisateur en aval des modèles GPAI :

- **OpenAI** GPT-4o, GPT-4o-mini (Pipeline 1+2 rédaction, Pipeline 3 KB)
- **Anthropic** Claude Sonnet 4.6 (Pipeline 2 long-form, fact-checking)
- **Perplexity** Sonar (Pipeline 2 fact-checking sourcé)

Les obligations art. 53-55 (transparence vis-à-vis des deployers,
documentation training data, copyright opt-out) pèsent sur les
fournisseurs ci-dessus, pas sur Axion-IA. Notre exposition se limite à :

- **Devoir de diligence** : sélectionner des fournisseurs ayant publié
  les éléments AI Act art. 53 (model cards + documentation). Tous les
  3 fournisseurs sont en conformité publique.
- **Information visiteur** : la liste des modèles GPAI utilisés est
  publiée sur `/sous-processeurs` + `/transparence` + `/politique-confidentialite`
  §IA générative.
- **Pas de fine-tuning** : Axion-IA n'entraîne ni ne fine-tune ces modèles
  → pas de question de redistribution.

### Article 26 — Évaluation d'impact sur les droits fondamentaux (FRIA)

**Non applicable.**

Les obligations FRIA art. 26 pèsent sur les déployeurs de systèmes
d'IA à haut risque listés à l'annexe III (cf. art. 52). Axion-IA
n'étant pas un système haut-risque, l'obligation FRIA ne s'applique
pas. Aucune décision automatisée affectant les droits fondamentaux
n'est prise par la factory.

## Conséquences

### Positives

- **Risque légal documenté et bas** : qualification explicite défendable
  devant AKI (autorité estonienne) ou toute autorité européenne.
- **Conformité art. 50** vérifiable techniquement (JSON-LD + composant
  visible).
- **Transparence visiteur** : 3 surfaces alignées (machine, humain inline,
  hub dédié `/transparence`).
- **Décision Manon persona disclosed** déjà tranchée dans audit pré-impl
  S0 Q13 option 4 (mémoire `axionia_session_2026-05-14_sprint_s0`).

### Négatives / À surveiller

- L'AI Act EU est encore en interprétation jurisprudentielle (codes de
  pratique en cours d'élaboration par l'AI Office). Cette ADR doit être
  revue à 12 mois ou en cas d'évolution majeure (code de pratique GPAI
  publié, jurisprudence CJUE, lignes directrices Commission).
- Si Axion-IA bascule en 2026+ vers un usage IA dépassant le marketing
  (ex. chatbot conseillant des décisions RH, scoring automatisé fournisseurs,
  outil de recrutement) → reclassifier en art. 52 + déclencher FRIA
  art. 26 + ADR dédié.
- L'absence de surveillance humaine 100 % systématique sur les contenus
  pSEO villes (12 942 routes en V1) repose sur :
  (a) la garde-fou `KB_AUTO_PUBLISH` (default `false`) bloque la mise
  en ligne automatique sans review ;
  (b) le composant `AiContentDisclaimer` couvre les contenus IA-assistés ;
  (c) cap doctrine ~95 % AxionIA-centric + ~5 % data INSEE (bouclier
  anti-doorway HCU 2024). Si cette doctrine évolue → re-évaluer.

## Alternatives écartées

1. **Auto-déclaration high-risk art. 52** — aurait imposé documentation
   technique, marquage CE, déclaration de conformité, surveillance
   humaine systématique. Coût/bénéfice défavorable pour un usage
   marketing B2B sans automatisation décisionnelle.
2. **Pas d'ADR (statu quo)** — laissait la qualification implicite,
   risque légal et opérationnel inutile.
3. **Page /ai-act dédiée hors /transparence** — redondant avec
   `/transparence` qui consolide déjà la doctrine.

## Validation cible

- [x] Composant `AiContentDisclaimer` livré (méta-cert P0-1)
- [x] Page `/transparence` livrée (méta-cert P0-2)
- [x] Routage `routing.pathnames` étendu
- [x] JSON-LD machine-readable sur 4 routes factory
- [x] ADR 0024 (ce document) publié
- [ ] Audit visuel 3 articles Manon production (méta-cert P1-8, post-activation)
- [ ] Revue 12 mois (2027-05-15) ou trigger événement AI Office
