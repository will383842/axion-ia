# Ménage OpenAI du contenu : aucun retrait, rien n'est prouvé mort

## But

Retirer ce qui reste d'OpenAI pour la génération de contenu, une fois celle-ci passée sur Claude.

## Résultat : aucun code retiré

Sur `origin/main` (6c74995c), OpenAI n'est PAS encore un reliquat pour le contenu. C'est toujours le chemin par défaut. Le brief demande de ne retirer que le « prouvé mort », et rien ne l'est. Cette branche ne contient donc que ce document.

## Inventaire (grep `openai`, `gpt-`, `OPENAI_`)

### À retirer : rien

### À garder (vivant)

- `providers/provider-router.ts` : `text: [openaiProvider]`. La voie Claude (`genererTexteBlogClaude`) ne part que si trois conditions sont réunies : requête marquée `blogClaudeRole`, `CONTENT_GEN_BLOG_CLAUDE=true`, type autorisé par `CONTENT_GEN_CLAUDE_TYPES`. Interrupteur éteint (valeur par défaut) = OpenAI. Le chatbot (`qa_derived`) reste sur OpenAI même avec « tous ».
- `providers/openai.ts` (+ tarifs gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini) : appelé par le routeur.
- `reviewer/llm-judge.ts` : importe `openaiProvider` et l'appelle directement quand `sansClaude` ou hors voie Claude. `JUDGE_MODEL = "gpt-4o"`.
- `quality/benefit-judge-llm.ts` : `preferredProvider: "openai"`.
- Générateurs de villes (`ville-hub-copy.ts`, `landing-ville-*.ts`) : `preferredProvider: "openai"`.
- `actions/content-gen/enqueue.ts` : `primaryProvider: "openai"`.
- `lib/config-reader.ts` : réglage `openai: gpt-4o`, lu par le suivi de coût.
- `lib/cost-tracker.ts` (`TEXT_CHAIN_PROVIDERS = ["openai"]`) et `providers/quota-guard.ts` (`CRITICAL_PROVIDERS`) : plafonds et registre de coût, à ne pas toucher.
- Embeddings (anti-doublon) : `dedup/*`, `OPENAI_EMBEDDINGS_*`, `OPENAI_EMBEDDING_*`, `OPENAI_DEDUP`, `OPENAI_DRIFT`. Consigne : garder.
- Hors contenu : chatbot (`src/server/chatbot/generation/*`, gpt-4o / gpt-4o-mini), visio (`src/server/visio/**`, `OPENAI_VISIO`). Consigne : garder.
- `OPENAI_API_KEY` et `OPENAI_API_URL` dans `src/env.ts` : à garder (facultatives, la prod les définit).

### Douteux (restent, listés)

- Rôles `image` et `rerank` du routeur (`[openaiProvider]`) : aucun appelant trouvé par grep sur `role: "image"` / `role: "rerank"`, mais la table est indexée dynamiquement (`ROLE_TO_PROVIDERS[req.role]`) et le type `GenerationRequest` les autorise. Pas de preuve de mort.
- Entrée `gpt_image` de `config-reader.ts` (désactivée, plafond 0) : probablement inutile, mais lue par la console/suivi.
- Placeholders `"gpt-4o" / "claude-sonnet-4-6"` dans `TemplateForm.tsx` et `TemplateNewFormWrapper.tsx` : texte de console visible. Le brief interdit de changer un comportement visible sans preuve. Les modèles OpenAI restent valides tant que le routeur les sert.
- Commentaires « Model: gpt-4o » dans `src/content/villes/copy/*.ts` : historique de provenance, à laisser.
- Commentaires datés (2026-07-09) du routeur sur « OpenAI UNIQUEMENT » : décision de Will, texte à réviser quand l'interrupteur Claude sera allumé partout.

## Condition pour une vraie suppression

À faire dans une PR séparée, une fois `CONTENT_GEN_BLOG_CLAUDE=true` et `CONTENT_GEN_CLAUDE_TYPES=tous` en prod, avec une décision de Will sur : le juge qualité, le juge bénéfices, les générateurs de villes et le chatbot `qa_derived`, qui n'ont pas de voie Claude. Il faudrait aussi lever l'interdiction écrite dans le routeur de remettre `anthropicProvider` dans la chaîne `text`.

## Fichiers

Seul `.pr/chore-contenu-menage-openai.md` est ajouté. Aucun test à lancer (aucun code modifié). Aucune migration. Aucun secret ni donnée client.

## Risques

Aucun (documentation seulement).

## Relecture

Aucune relecture par sous-agent : le diff ne contient aucun code.

VERDICT OPUS : BON
