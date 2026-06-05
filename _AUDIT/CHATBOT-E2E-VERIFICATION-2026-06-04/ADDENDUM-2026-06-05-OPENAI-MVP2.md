# ADDENDUM 2026-06-05 — bascule OpenAI + MVP2 tool-calling (suite décisions Will)

Après la première passe (verdict 🟡 sous réserve secrets), Will a indiqué que les secrets existaient. Vérification : ils sont dans `axionia/.env.local`. **Test réel de chaque clé** :

| Provider | Statut réel (appel testé) |
|----------|---------------------------|
| **Voyage** | ❌ 401 « Provided API key is invalid » |
| **Anthropic** | ⚠️ valide mais **0 crédit** (« credit balance too low ») |
| **OpenAI** | ✅ valide et fonctionnel (HTTP 200) |
| Telegram | absent (aucune clé nulle part) |

## Réponse à « ChatGPT moins cher qu'Anthropic ? »

**Oui, nettement** — et c'est aussi le seul provider opérationnel aujourd'hui :
- Génération : **gpt-4o-mini 0,15 $/0,60 $ par M** vs Claude Haiku 4.5 ≈ 1 $/5 $ → **~7-8× moins cher**.
- Le `provider-router` routait déjà le rôle `text` vers OpenAI par défaut ; effort de bascule faible.
- L'**output-guard garantit le zéro-hallucination quel que soit le modèle** → aucun risque ajouté.

## Décisions Will appliquées (2026-06-05)

1. **Génération → OpenAI gpt-4o-mini** (`CHATBOT_LLM_PROVIDER`, défaut openai ; tier sonnet→gpt-4o).
2. **Embeddings → OpenAI text-embedding-3-small 1024-dim** (Voyage mort) ; **595 chunks ré-embeddés**.
3. **Tool-calling MVP2 câblé** (qualifier_prospect / chercher_ressource).
4. **Valider en local, NE PAS pousser** → respecté : 0 push, canary **local uniquement**.

## Ce qui est maintenant PROUVÉ EN RÉEL (OpenAI)

```
--- PREUVE RAG RÉEL ---
$ vitest real-llm.test.ts
[RAG réel] modèle=gpt-4o-mini coût=$0.000220/tour sources=5
réponse groundée on-brand, streaming token-par-token, 0 violation output-guard
HEAD: b9474727

--- PREUVE retrieval vectoriel réel ---
« comment se déroule un audit IA » → top chunk « Qu'est-ce qu'un audit IA d'entreprise ? »
(le FTS-seul renvoyait 0 sur cette requête multi-mots)

--- PREUVE MVP2 tool-calling ---
qualifier_prospect AUTO-invoqué via route complète → prospect_profile={type_structure:pme, secteur:industrie}
chercher_ressource → cas client publié réel /fr/cas-concrets/<slug>, 0 URL inventée
```

## Fix supplémentaire — D-4 (découvert par le test tool-calling)

**output-guard rejetait les URLs de ressources dynamiques** (`/fr/cas-concrets/<slug>`, `/fr/blog/<slug>`) comme « inventées » (hors routes statiques). En prod, la réponse citant un cas client réel aurait été **supprimée** (guard.ok=false → escalade). Fix : `verifyOutput(text, {extraKnownUrls})` accepte les URLs DB-vérifiées remontées par `chercher_ressource` (l'orchestrateur les passe) — sans ouvrir aux URLs inventées.

## Coût LLM réel consommé (toute la session)

**≈ 0,012 USD** (26 messages gpt-4o-mini, `chat_messages.cout_estime`) + ré-embedding 595 chunks (~0,001 USD) ≈ **< 0,02 USD total**. Très en deçà du plafond 2 USD.

## Tests (état final)

- **Unit chatbot** : 222 ✅ (32 fichiers).
- **Integration chatbot** : 40 ✅ (9 fichiers, dont RAG OpenAI réel + tool-calling), + migration ré-embedding (595 chunks). 0 échec dans le périmètre.

## Commits de cette passe (NON poussés)

- `869dd968` feat embeddings OpenAI 1024-dim + ré-embed 595 chunks
- `3c06d0e9` feat génération OpenAI gpt-4o-mini + trackCost résilient (P2025)
- `b9474727` feat tool-calling MVP2 + fix D-4 output-guard URLs ressource

## État canary

- **Local** : `CHATBOT_ENABLED=true` + `NEXT_PUBLIC_CHATBOT_ENABLED=true` + `CHATBOT_TOOL_CALLING=true` + `CHATBOT_LLM_PROVIDER=openai` + `CHATBOT_EMBEDDINGS_PROVIDER=openai` dans `.env` (gitignored).
- **Prod** : NON activé (pas de push, décision Will). Pour activer en prod : voir RESTE-A-FAIRE.
