# ADR 0068 — Cliquet de la console d'administration relevé de 560 à 600 KB

- **Statut** : **ACCEPTÉ** — décision de Will, en chat, le 2026-10-17 (« oui ok pour augmenter »)
- **Date** : 2026-10-17
- **Auteur** : Claude, sous mandat de Will
- **Référence** : `package.json` (bucket `size-limit` « SOMME des page chunks de la CONSOLE ADMIN »), ADR 0049, ADR 0058, `AGENTS.md` (« Performance budget »)

## 1. Contexte

Après l'audit Qualiopi du 16/10, plusieurs écrans de console sont exigés (lots QNC L04, L05,
L09, L12, L13). Ils font dépasser le cliquet de la console (560 KB brotli) de quelques KB.
La console est réservée au dirigeant : aucun visiteur ne la charge, elle n'a aucun effet sur
les Web Vitals publics (ADR 0049, ADR 0058).

## 2. Décision de Will

Relever la limite du bucket « SOMME des page chunks de la CONSOLE ADMIN » de **560 KB à
600 KB** (+ 7 %). Le contrôle reste **bloquant**.

## 3. Ce qui ne change pas

- La somme des page chunks publics (280 KB), `/appel`, les routes, le widget et le shell
  partagé : aucune autre limite n'est touchée.
- Les tests `tests/unit/ci/*` qui verrouillent la séparation public / admin.

## 4. Règle de suite

- On continue d'alléger la console par **chargement différé** (composants serveur par
  défaut, `dynamic` pour les parties lourdes).
- Chaque PR qui ajoute de la console indique, dans sa description, la ligne « CONSOLE
  ADMIN » avant et après.
- **Tout nouveau relèvement est une nouvelle décision de Will**, chiffres à l'appui.
