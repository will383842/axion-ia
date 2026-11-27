feat(apporteurs): PR L #2464 — contrôle périodique du registre pour les apporteurs actifs (point 20)

## Ce qui change

Chaque jour, le passage quotidien relit le registre public des entreprises pour les apporteurs sous contrat (statut « signé », préavis compris, et « résilié » tant qu'il reste de l'argent en jeu).

- Au plus 50 apporteurs par passage, au plus un contrôle tous les 7 jours chacun, les plus anciens d'abord.
- Lecture sans cache : par SIRET s'il existe, sinon par SIREN.
- Registre injoignable : rien n'est écrit, on retente au passage suivant.
- Entreprise fermée ou introuvable **deux contrôles de suite** : une alerte interne critique (`apporteur_registre_ferme`), une seule par période de défaut. Retour à « active » : la ligne repasse active, sans alerte.
- **Aucun e-mail à l'apporteur, aucun effet sur le contrat ni sur les paiements** : Williams décide. Le blocage existant de la facturation reste tel quel.
- Nouvelle page console `apporteurs/registre` (lecture seule) : les apporteurs dont l'état n'est pas « active ». Elle n'affiche aucun nom, seulement un identifiant. `[id]/page.tsx` n'est pas modifié.

Fichiers : `controle-registre.ts` (nouveau), une étape `controle-registre` dans `passage-quotidien.ts` (deux lignes + import), la page console, le schéma Prisma.

## Tests

- `controle-registre-apporteurs.spec.ts` : active → silence ; fermée une fois → pas d'alerte ; fermée deux fois → une alerte et pas de seconde au 3e contrôle ; introuvable ; indisponible → rien d'écrit ; retour à active ; plafond de 50 ; plus anciens d'abord ; non-signé ignoré ; résilié sans argent ignoré (avec argent : contrôlé) ; SIRET prioritaire sur SIREN.
- `controle-registre-sans-email-apporteur.spec.ts` : aucun import d'envoi d'e-mail, aucune écriture sur le statut ou le contrat.
- `migration-controle-registre.spec.ts` : table neuve, sans clé étrangère ni DROP ni énumération, CHECK sur l'état, `rollback.sql` en RENAME, horodatage supérieur aux autres.
- Mis à jour : trois tests existants qui listent les migrations ou exécutent le passage complet (`migration-additive.spec.ts` du relevé mensuel, `contacts-guide-reseau-origine-optionnelle.spec.ts`, `passage-rendez-vous.spec.ts`, `bascule-ancienne-regle-vers-rendez-vous.spec.ts`) : ajout de la nouvelle migration à leur liste, et de l'étape à leurs mocks.
- Passés : `pnpm vitest run src/features/apporteurs-reseau`, `tests/unit/ci`, `tests/unit/prisma` ; `tsc --noEmit` (avec `--max-old-space-size=8192`, le défaut manquait de mémoire) ; eslint sur les fichiers touchés ; `prisma validate`.

## Migration : oui

`20261128100000_apporteurs_controle_registre` : une table neuve `apporteur_controles_registre`, sans clé étrangère, état en VARCHAR + CHECK, aucune énumération. `rollback.sql` fourni (sauvegarde puis RENAME, « seulement sur décision du fondateur »). Le lecteur tolère la table absente (P2021) : sûr pendant la fenêtre app/worker. Horodatage vérifié supérieur à la dernière migration de `origin/main` (`20261128000000`) ; à revérifier au moment de la fusion.

## Audit argent : non

(Tableau du plan : PR L = non.) Aucune écriture sur les commissions, factures ou IBAN.

## Dépendances

Aucune.

## Points laissés ouverts

- Aucun réglage éteint par défaut n'a été nécessaire : la PR ne dépend d'aucune réponse de Will de la section 4 et n'agit que par une alerte interne.
- Une réponse du registre « SIREN invalide » est traitée comme « indisponible » (rien d'écrit) : le registre ne dit rien sur l'entreprise.
- La page console n'est pas liée depuis un menu : accès direct par `/apporteurs/registre`.
- Conflit attendu d'une ligne dans `passage-quotidien.ts` avec d'autres PR qui ajoutent une étape (plan § 0.5).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
