feat(apporteurs): PR O #2464 — lecture avec plusieurs clés de chiffrement (point 27, 1/2)

## Ce qui change

- Nouvelle variable facultative `PII_ENCRYPTION_KEYS_LECTURE` : clés de 64 caractères hexadécimaux séparées par des virgules, **pour déchiffrer seulement**.
- `decryptPii` (v1 et v2, AAD respectée) et `dechiffrerOctetsPii` (AXB1) essaient la clé courante puis chaque clé de lecture, dans l'ordre. La première dont l'étiquette GCM passe gagne.
- Le chiffrement n'utilise **que** la clé courante. Aucun changement de format.
- Entrées invalides ou en double : ignorées, avec un avertissement qui ne contient aucune valeur de clé.
- Aucune clé ne passe : même comportement qu'avant (levée de l'erreur de la clé courante ; placeholder ou levée si pas de clé courante, selon `cleExigee`).
- Nouvel export `cleQuiDechiffre(chiffre, aad?)` → `"courante" | "lecture" | null`, pour le script de la PR P. Ne lève jamais.
- `src/env.ts` : variable déclarée, facultative, avec contrôle de la liste.

## Tests

- `src/lib/__tests__/pii-crypto-trousseau.spec.ts` (8 tests) : ancienne clé lue ; chiffrement toujours sous la courante ; AAD v2 avec l'ancienne clé ; octets AXB1 ; clé invalide/doublon ignorée sans fuite ; aucune clé ne passe ; sans clé courante ; `cleQuiDechiffre`.
- 40 fichiers de tests touchant `pii-crypto` restent verts (641 tests). `pnpm typecheck` et eslint sur les fichiers touchés : OK.

## Migration

Non.

## Audit argent

**Oui** (les IBAN passent par ce code) : relire l'ordre des clés dans `essayerCles` / `clesDeLecture` et `cleQuiDechiffre`.

## Dépendances

Aucune. Aucun réglage éteint nécessaire : sans la variable, le comportement est identique à avant.

## Points laissés ouverts

- À ajouter à la page Coolify : `PII_ENCRYPTION_KEYS_LECTURE`, identique sur **app et worker** (utile seulement pendant une rotation).
- Le script de rotation et le runbook sont dans la PR P.
- Pas de réinstallation de dépendances ; `pnpm-lock.yaml` inchangé.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
