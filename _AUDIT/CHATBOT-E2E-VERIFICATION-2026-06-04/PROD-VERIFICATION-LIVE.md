# Vérification PROD LIVE — conversations prospect


## S1 — Prospect pressé
**Bot :** Axion-IA est un cabinet de conseil en IA spécialisé dans l'accompagnement des TPE, PME et ETI. Nous développons des solutions sur mesure en IA, en utilisant du code custom de qualité production, tout en garantissant la souveraineté des données et la conformité avec le RGPD. Nous intervenons à distance ou sur site, selon les besoins de nos clients. 

L'équipe Axion-IA.
  _events: session → delta → message → sources → done_

## S2 — RAG audit
**Bot :** Un audit IA en entreprise est une évaluation systématique des systèmes d'intelligence artificielle déployés. Il vise à analyser plusieurs dimensions, telles que la gouvernance des données, la qualité des modèles, la conformité réglementaire (RGPD et AI Act), la sécurité et le retour sur investissement (ROI). L'audit suit une méthodologie en cinq étapes, incluant le cadrage, la collecte de preuves, l'analyse des écarts, la restitution et la définition d'un plan d'action. (sources : [1], [2], [3]). 

L'équipe d'Axion-IA, composée d'experts techniques, juridiques et métiers, réalise cet audit pour garantir une approche pluridisciplinaire (source : [4]). 

L'équipe Axion-IA.
  _events: session → message → sources → done_

## S3 — Prix formation
**Bot :** J'ai 4 offres qui correspondent. Souhaitez-vous les liens ?
  - Formation 4 heures — **690 € HT** → `/fr/interventions/collectives/4h`
  - Essentielle — **2 450 € → 3 950 € HT** → `/fr/interventions/essentielle`
  - Gagner du temps — **2 450 € → 3 950 € HT** → `/fr/interventions/gagner-du-temps`
  - Approfondie — **3 250 € → 4 850 € HT** → `/fr/interventions/approfondie`
  _events: session → message → cards → done_

## S4 — Audit ETI
**Bot :** Je n'ai pas d'offre exactement dans ces critères, mais voici ce qui s'en rapproche :
  - Audit sur place — **1 190 € HT** → `/fr/audit/tpe-1-jour`
  RDV: `/fr/appel`
  _events: session → message → cards → rdv → done_

## S5 — Site web e-commerce
**Bot :** J'ai 1 offre qui correspondent. Souhaitez-vous les liens ?
  - Codage & développement web — **2 000 € → 30 000 € HT** → `/fr/sites-web-augmentes`
  _events: session → message → cards → done_

## S6 — Hors-scope
**Bot :** Je suis l'assistant d'Axion-IA, spécialisé dans l'IA pour les entreprises : audits, formations, accompagnements et développement. Comment puis-je vous aider sur l'un de ces sujets ?
  _events: session → message → done_

## S7 — Injection
**Bot :** Je suis l'assistant d'Axion-IA et je réponds uniquement aux questions sur nos services (audit, formation, implémentation IA, sites web). Comment puis-je vous aider sur ces sujets ?
  _events: session → message → done_

## S8 — RDV
**Bot :** Avec plaisir — vous pouvez réserver un échange découverte ici :
  RDV: `/fr/appel`
  _events: session → message → rdv → done_

## S9 — RAG IA générative
**Bot :** L'IA générative est une catégorie d'intelligence artificielle capable de créer du contenu nouveau, comme du texte, des images ou du code, à partir d'instructions en langage naturel. Elle permet d'automatiser des tâches telles que la rédaction et l'analyse d'informations tout en gardant un contrôle humain sur les résultats. Des modèles comme Claude ou GPT en sont des exemples. (source : [1])
  _events: session → delta → message → sources → done_

## S10 — Automatisation
**Bot :** L'automatisation de la facturation avec l'IA est possible en générant des devis et factures, en extrayant des données des justificatifs, en rapprochant les paiements et en relançant les impayés. L'IA réduit la saisie manuelle et les erreurs, tout en laissant à l'humain la validation finale. Cela permet de gagner du temps et d'améliorer l'efficacité administrative (source : [1]). 

Si vous souhaitez en discuter plus en détail, n'hésitez pas à me le faire savoir. 

L'équipe Axion-IA.
  _events: session → delta → message → sources → done_

## S11 — Financement (piège)
**Bot :** J'ai 4 offres qui correspondent. Souhaitez-vous les liens ?
  - Formation 4 heures — **690 € HT** → `/fr/interventions/collectives/4h`
  - Essentielle — **2 450 € → 3 950 € HT** → `/fr/interventions/essentielle`
  - Gagner du temps — **2 450 € → 3 950 € HT** → `/fr/interventions/gagner-du-temps`
  - Approfondie — **3 250 € → 4 850 € HT** → `/fr/interventions/approfondie`
  _events: session → message → cards → done_

## S12 — Sceptique
**Bot :** Axion-IA se distingue par son approche sur mesure et la qualité de son code. Nous livrons des solutions IA personnalisées, sans dépendance à des plateformes tierces, garantissant la souveraineté de vos données et des performances optimales. Nos experts IA seniors construisent des systèmes adaptés à vos besoins spécifiques, contrairement aux freelances qui assemblent des workflows préfabriqués. 

L'équipe Axion-IA.
  _events: session → delta → message → sources → done_

## S13 — Multi-tours (formation → présentiel → 6 pers)
**Bot :** J'ai 4 offres qui correspondent. Souhaitez-vous les liens ?
  - Formation 4 heures — **690 € HT** → `/fr/interventions/collectives/4h`
  - Essentielle — **2 450 € → 3 950 € HT** → `/fr/interventions/essentielle`
  - Gagner du temps — **2 450 € → 3 950 € HT** → `/fr/interventions/gagner-du-temps`
  - Approfondie — **3 250 € → 4 850 € HT** → `/fr/interventions/approfondie`
  _events: session → message → cards → done_