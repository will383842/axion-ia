# ADR 0076 — Cliquet du shell partagé relevé de 138 à 138,1 KB (page /journee-ia)

- **Statut** : **ACCEPTÉ** — décision de Williams, le 2026-11-11 (option A)
- **Date** : 2026-11-11
- **Référence** : `package.json` (bucket `size-limit` « Shell partagé »), PR 1906 (branche `brand/L3-V5-04`), ADR 0072, ADR 0075

## 1. Contexte

Le contrôle « Poids du bundle » (`pnpm bundle:check`) échoue sur la PR 1906 :
`Package size limit has exceeded by 6 B (138.01 kB)`. Le bucket « Shell partagé »
(framework + main + main-app + webpack + polyfills) porte un cliquet à 138 KB gz.
Le dépassement est de **6 octets**. Il n'est pas causé par un module client nouveau :
la page `/journee-ia` est rendue côté serveur seulement.

## 2. Décision

Williams a décidé le 2026-11-11 (option A) de relever la limite du bucket de **138 KB à
138.1 KB**, soit le minimum nécessaire (marge de 94 octets sur la mesure de 138,006 kB).
Aucune autre limite ne change. Le contrôle reste **bloquant**.

## 3. Conséquences

- Cliquet du shell partagé relevé de 138 KB à 138.1 KB. La cible de 100 KB reste écrite dans le nom du bucket.
- Le budget Web Vitals First Load JS par route (≤ 75 KB gz) est inchangé.
- La page `/journee-ia` n'ajoute aucun module client.
- Le cliquet ne doit plus monter sans réduction : tout nouveau relèvement est une nouvelle décision de Williams, chiffres à l'appui.
- Note : `main` a relevé ce même cliquet à 139 KB (ADR 0075, PR 1920). Au moment d'intégrer cette branche à `main`, c'est la valeur de `main` (139 KB) qui prévaut ; cet ADR garde sa trace.
