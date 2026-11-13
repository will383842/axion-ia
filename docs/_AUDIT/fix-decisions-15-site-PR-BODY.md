## Décisions Williams du 11/11/2026 — site public

Branche `fix/decisions-15-site` (main fusionné dedans, dc6cae81).

- Diagnostic IA 45 min : annoncé **gratuit et facultatif** ; « Déjà décidé ? » mène à `/contact` (message), sans diagnostic ni paiement en ligne.
- Priorités : « dans le rapport détaillé remis sous 3 jours ouvrés » (plus jamais « avant le départ / le soir même »).
- Audit du matin : « de 2 à 4 h selon la structuration de l'entreprise ».
- Seuil « > 5 000 € HT » retiré de `/demande-devis`.
- Frais de déplacement / transport / kilométriques retirés (~60 fiches villes, FAQ, `transversal.ts`, `regions.ts`) ; « partout en France métropolitaine et en Corse » conservé.
- Prise en charge OPCO retirée des fiches Dunkerque et Tourcoing.
- Promesses de délai « sous 24-48 h ouvrées » retirées de `/demande-devis` (FR/EN).
- Inventaire villes lot 3 recalé (sable-sur-sarthe, saint-cannat) ; mesure du premier écran Journée IA recalée (204 → 205) après fusion de main.
- Inchangés : garantie 3× le prix, texte RGPD Google Meet.

Tests vitest ciblés verts (messages, content, journee-ia, demande-devis : 128/128). Reste à trancher (OPCO dans les CGV/page dédiée, `/politique-deplacement`, metas 155 car.) : voir `docs/_AUDIT/fix-decisions-15-site-RAPPORT.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_011KcQpJNUcgcB7XtS1h5rJv
