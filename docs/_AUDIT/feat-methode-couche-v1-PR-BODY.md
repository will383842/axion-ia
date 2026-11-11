## Couche « Méthode » : collection séparée dans la base de connaissance (M-1)

ADR : `docs/adr/0076-couche-methode-collection-separee.md` (statut PROPOSÉ, à valider par
Williams). **Aucune migration.**

### Ce que fait la PR

- **Modèle** : réutilise `KnowledgeEntry` / `KnowledgeTranslation` / `KnowledgeCollection` /
  `KnowledgeTag`. Fiches `audience = team`, `confidentiality = internal`,
  `status = approved` (**jamais `published`**), slug stable `methode/<fichier>/<section>`.
  Collections `methode-vente` et `methode-secteur-sante` (à part).
- **Import** `scripts/methode/importer-methode.ts <dossier>` : **essai à blanc par défaut**,
  écriture avec `--ecrire`, idempotent, aucune suppression, aucune publication. Essai à blanc
  sur la copie `axion-brand` : 276 fiches (242 vente, 34 santé), 122 `chiffres-exercice`.
- **Point d'entrée unique** `obtenirContexteMethode({ sujet, secteur?, max? })`
  (`src/server/methode/index.ts`) : noyau (fiche 00, « L'essentiel » + « Le chemin ») +
  recherche plein texte `fr_unaccent`. Santé seulement si `secteur = 'sante'`.
- **Chiffres** : les montants des fiches (290 €/mois, 1 900 €, acompte de 30 %, abonnement,
  suivi à 30 jours) sont des **EXEMPLES**, jamais des règles ni des prix : étiquette
  `chiffres-exercice` + avertissement en tête, reposé par `obtenirContexteMethode` sur
  chaque extrait concerné. Seul prix public : Journée IA 1 490 € HT.
- **Interrupteur** `METHODE_ACTIVE` (`src/env.ts`, `.env.example`), **éteint par défaut** :
  contexte neutre, aucune lecture en base, rien ne change.
- **Branchements** : outil MCP de lecture `axionia.methode.contexte` (manifeste et jeu
  maximal régénérés) ; `injecterMethodeDansPromptSysteme` côté content-gen, limité à
  `mail | offre | script` et branché sur **aucun** générateur de page publique.
  **Chatbot public non touché.**
- **Doc** : `docs/knowledge/COUCHE-METHODE.md`.

### Vérifications

Cf. `docs/_AUDIT/feat-methode-couche-v1-VERIFS.md` : `tsc` 0 erreur ; vitest méthode 26/26,
MCP 51/51, content-gen 204/204, `tests/unit/ci` + gardes de prix 679 passés ; eslint,
prettier et contrôles statiques verts.

### Après fusion (décision de Williams)

1. Import réel : `pnpm tsx scripts/methode/importer-methode.ts <methode> --ecrire
   --autoriser-prod` (jamais depuis une routine).
2. Allumage : `METHODE_ACTIVE=true` dans Coolify, puis redémarrage.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Qdj3f52zBXTTDWZq16WStL
