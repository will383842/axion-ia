# Console éditoriale — point de reprise

_Écrit le 21 août 2026 à la mise en pause. Branche `feat/console-editoriale`._

Ce document sert à une seule chose : **reprendre sans rien relire d'autre**.
Il remplace, pour la reprise, les deux rapports précédents — qui restent
valables sur leur périmètre mais décrivent un état antérieur aux passes de
vérification.

---

## 1. Où en est le dépôt, exactement

|                  |                                                           |
| ---------------- | --------------------------------------------------------- |
| Branche          | `feat/console-editoriale`                                 |
| HEAD local       | `19f062edd`                                               |
| Arbre de travail | **propre** — rien en attente                              |
| Base locale      | 193 migrations appliquées, dossier LinkedIn importé       |
| Serveur de dev   | **arrêté** (je l'ai tué pour débloquer `prisma generate`) |

### ⚠️ L'état du push — à vérifier EN PREMIER à la reprise

```bash
git status --short                                    # doit être vide
git rev-list --count origin/feat/console-editoriale..HEAD
```

- Si le compte vaut **0** : tout est sur GitHub, rien à faire.
- Si le compte vaut **4** (ou plus) : le push n'est pas passé. Relancer
  `git push` et **lire la sortie jusqu'au bout**.

🔴 **Le hook de pré-push lance la suite complète (~25 min) et il PEUT
refuser le push.** C'est arrivé une fois pendant cette session : le hook a
tourné sur un instantané de travail en cours et a rougi sur un test que
j'étais en train de corriger. La notification de fin affichait `exited with
code 0` — c'était le code du **shell**, pas celui de `git`. J'ai d'abord
annoncé « push passé » à tort.

**La leçon vaut pour la reprise : ne jamais conclure d'un code de sortie de
shell qu'un push a abouti.** Vérifier avec `git rev-list --count`.

---

## 2. Les quatre commits de cette session

| Commit      | Ce qu'il corrige                           |
| ----------- | ------------------------------------------ |
| `3767d00a4` | Six défauts + l'injection de formule CSV   |
| `f6b6050b1` | Deux gardes vertes qui ne gardaient rien   |
| `e4f25282c` | Le câblage des gestes aux écrans           |
| `19f062edd` | Quatre défauts de la passe 2 + une gate CI |

Chaque message de commit contient le raisonnement complet. `git show <sha>`
en dit plus que ce tableau.

---

## 3. Ce que les trois vérificateurs ont trouvé

Trois agents indépendants ont audité le code sans l'avoir écrit :
**passe 2** (vérification à l'aveugle des critères), **passe 4**
(adversaire), **passe 5** (second vérificateur à l'aveugle).

### Le constat qui compte

**Les passes 2 et 5 ont trouvé la même chose, séparément** : la logique et
les Server Actions étaient livrées et testées, mais **aucun écran ne les
appelait**. Le §7 du plan s'ouvre sur « en gestes observables » — une action
qu'aucun bouton ne déclenche n'est pas un critère tenu.

C'était ma plus grosse lacune, et mon décompte de « 36 critères tenus »
était donc trop généreux. Corrigé en `e4f25282c`.

**Mesure actuelle : 38 des 41 actions sont joignables depuis un écran.**
Le script qui le mesure (atteignabilité transitive : une action compte si un
écran l'appelle, directement ou via son adaptateur de formulaire) est décrit
au §6 ci-dessous.

Les trois restantes ne sont pas un oubli :

- `chargerArbreAction` et `controlerConformiteAction` font ce que les écrans
  calculent déjà au rendu ;
- `historiqueRelevesAction` attend l'écran d'historique des relevés.

### Les défauts corrigés, par gravité

**Auraient détruit des données ou trompé sans bruit :**

1. **La garde anti-cycle ne gardait qu'un niveau.** On alimentait
   `creeraitUnCycle` — qui REMONTE — avec un lot qui DESCEND. La fonction
   pure était juste ; on lui donnait le mauvais objet.
2. **Deux personnes sur une fiche s'écrasaient en silence**, sans que le
   texte perdu existe nulle part.
3. **Les dates impossibles entraient**, silencieusement reportées :
   `2026-02-30` → 2 mars, `9999-99-99` → +010007.
4. **La recherche plein texte n'avait JAMAIS tourné** sous Next — et le
   message d'erreur envoyait appliquer une migration déjà appliquée.

**Gardes vertes qui ne gardaient rien** (le piège du §1 du protocole) :

5. Un champ mal orthographié dans les paramètres d'une règle **désarmait un
   interdit réglementaire** et affichait « conforme ».
6. Un motif de règle pouvait **geler la console plus de deux minutes**
   (ReDoS) — le motif vient de la base, donc d'une saisie non relue.

**Contournements de règles métier :**

7. Le téléversement **contournait la porte de validation** : le rôle
   `montage` produisait un asset `pret` sans passer par la garde qui lui est
   fermée.
8. **Marquer « publié » deux fois désarmait une alerte** — le second appel
   repoussait `derniereParutionA`, qui arme « canal muet ».
9. L'import **ne rattrapait jamais un écho manquant**.

**Traçabilité et outillage :**

10. **Le journal n'a jamais su qui agissait** — toutes les entrées portaient
    `membre_id = NULL`. Deux colonnes neuves (`auteur_user_id`,
    `auteur_nom`), migration `20260821120000_ed_journal_auteur`.
11. **La gate CI validait un schéma FTS que la production n'applique pas.**
12. **La fixture E2E cherchait un compte qui n'existe pas** — 3 passés,
    14 sautés, un vert trompeur sur toute suite authentifiée du dépôt.
13. Injection de formule CSV neutralisée (l'export est fait pour Excel).

### Un point où j'ai contredit un vérificateur

La passe 2 affirmait que l'index FTS éditorial ne serait **jamais posé en
production**. J'ai vérifié : **c'est faux.** `scripts/docker-entrypoint.sh`
applique `prisma/migrations_fts/*.sql` par glob depuis toujours. Seule la CI
était en retard, et c'est ce que j'ai corrigé.

**À la reprise : les rapports d'agents se vérifient, ils ne se croient pas.**

---

## 4. Ce qui reste à faire

### Vérification

- [ ] **La passe 6 n'a jamais tourné** — bout en bout cumulé sur base
      vierge. Elle était impossible pendant la session : les trois
      vérificateurs interrogeaient la base en même temps, et la réinitialiser
      aurait saboté leurs passes.
- [ ] **Rejouer la chaîne complète** sur base vierge après les correctifs :
      volume détruit → migrations → FTS → amorçage → import → critères
      vérifiés en SQL.
- [ ] **Les tests E2E n'ont pas été rejoués** depuis la correction de la
      fixture. Deux tests préexistants (`admin-booking-flow`,
      `admin-nav-clic`) étaient masqués par la fixture morte — ni l'un ni
      l'autre ne concerne la console éditoriale, mais ils doivent être
      rejoués **en CI** (`pnpm start`), pas en dev.

### Trous de couverture connus

- [ ] **`src/server/actions/editorial/` n'a AUCUN test.** Les 450 tests
      couvrent exclusivement les modules purs. Le versionnage, la détection
      de doublon, la journalisation, l'application de recette, le refus en
      revue : tout le câblage transactionnel est non testé. **Les deux
      vérificateurs le signalent — c'est le premier chantier de la reprise.**
- [ ] `recherche.ts` n'a pas de test.
- [ ] La **transcription d'asset** est lue par la recherche mais écrite par
      aucune action ni écran — la moitié du critère 1.6 est morte.
- [ ] **`ed_recettes` est vide** : aucune recette n'est semée, donc le geste
      « appliquer une recette » n'a rien à proposer.
- [ ] Le **poids des routes des lots 2 à 4** n'a jamais été mesuré, et aucun
      bucket `size-limit` ne couvre la console.

### Deux arbitrages qui reviennent à Will

1. **Le rôle `montage` peut-il détacher un asset d'une publication ?**
   Le §4 réserve « supprimer quoi que ce soit » à l'admin, mais l'action
   n'exige que `asset.ecrire`. « Modifier un asset » et « supprimer un
   lien » se défendent l'un comme l'autre. Le geste est branché tel quel et
   la question posée — pas résolue en douce par un choix d'écran.
2. **Une date passée doit-elle être refusée ?** Le protocole l'exige ;
   aucune règle du plan ne l'interdit ; et antidater une publication déjà
   parue est un besoin légitime. Critère ambigu.

### Écarts entre le plan et le code

- Le plan pose `/[adminPrefix]/editorial/*` ; le code vit sous
  `/[adminPrefix]/console-editoriale/*`.
- Trois routes du §3 manquent : `/invites`, `/capture` (l'écran mobile à
  deux gestes) et `/reglages/*`.
- Une route hors plan existe : `/equipe`.

🔴 **L'absence de `/reglages` vide l'argument, répété dans mes commentaires,
selon lequel « un seuil se corrige depuis la console sans pull request ».**
Aujourd'hui il se corrige avec un accès à la base. C'est dit sur le tableau
de bord depuis `19f062edd`.

---

## 5. Ce qui n'est PAS livrable aujourd'hui, et pourquoi

- **Le lot 5 (publication automatique)** ne dépend pas de code : les cinq
  portes de plateforme sont fermées et s'ouvrent par demande, revue ou
  audit. Sans l'audit TikTok, une vidéo envoyée par l'API part **en privé**
  sans que rien ne le signale — le pire mode d'échec possible.
- **La durée d'une vidéo** n'est pas extraite : il faudrait `ffprobe` dans
  l'image Docker. C'est un choix d'infrastructure.
- **Les vraies données LinkedIn** (`Linkedin complet.zip`,
  `02-calendrier-publication.csv`, `10-LES-61-POSTS.md`) restent
  introuvables sur cette machine. Tout repose sur une fixture fidèle au
  format. **Les critères 2, 3 et 4 du lot 0 sont à rejouer** dès que les
  fichiers seront fournis.

---

## 6. Commandes utiles à la reprise

```bash
# L'état du push — À FAIRE EN PREMIER
git status --short
git rev-list --count origin/feat/console-editoriale..HEAD

# Les tests éditoriaux (rapide, ~15 s)
pnpm vitest run src/server/editorial          # attendu : 450 verts

# Les gates de design du dépôt (elles attrapent les classes CSS inventées,
# ce que ni le typecheck ni le lint ne voient)
pnpm vitest run admin-design-tokens admin-emoji-ratchet

npx tsc --noEmit                              # attendu : 0
pnpm exec tsx scripts/check-use-client.ts

# Le serveur de dev
pnpm dev
# → http://localhost:3000/fr/admin-dev-x7k2n9/console-editoriale
#   admin@axion-ia.com / AdminAxion2026!
```

⚠️ **Si `tsc` rend des centaines de `TS1005` dans `.next/dev/types/`** : ce
n'est pas votre code. Le serveur de dev corrompt ce fichier quand il est
tué, et `tsconfig` l'inclut. `rm -rf .next/dev` et recommencer.

⚠️ **Un rouge E2E en local se vérifie d'abord en regardant la capture.** Si
elle montre « Erreur d'aiguillage » ou un 404 du site public, c'est le
serveur de dev qui recompile, pas le code.

---

## 7. Rollback

Le travail reste **entièrement additif** : 24 tables neuves, 13 énumérations
neuves, deux colonnes ajoutées à `ed_journal`. Aucune table existante
modifiée, aucun `DROP` dans aucune migration.

| Si…                                   | Alors                                                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Les écrans cassent                    | Supprimer `src/app/**/console-editoriale/`. Rien d'autre n'en dépend                                              |
| La migration doit être annulée        | `DROP TABLE ed_*` (24) puis `DROP TYPE "Ed*"` (13)                                                                |
| L'import a versé de mauvaises données | `DELETE FROM ed_publications WHERE ref_import LIKE 'linkedin-2026-q4-%'` puis supprimer le marqueur `SiteSetting` |

Un déploiement inachevé ne casse rien : sans amorçage, les écrans affichent
leur état vide, qui explique quoi lancer.
