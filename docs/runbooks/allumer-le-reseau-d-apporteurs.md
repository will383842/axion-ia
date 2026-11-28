# Allumer le réseau d'apporteurs

> Page unique : variables, conteneur, ordre d'allumage. Créée le 2026-11-27 (critique #2464,
> point 26). **Aucune valeur réelle ici** : les secrets se posent dans Coolify, jamais dans le dépôt.

## Règle générale

Les interrupteurs sont **éteints par défaut** : absents = éteints, **seule la valeur exacte
`true`** les allume. Ils sont lus à chaque appel (pas figés au démarrage) mais Coolify demande un
**redémarrage du conteneur** pour qu'une variable change.

Il y a **deux conteneurs** (voir `AGENTS.md`, « DEUX conteneurs, DEUX vitesses ») : l'**app**
(site, console, espace apporteur) et le **worker** (passages planifiés, e-mails). Une variable
lue par les deux se pose sur les deux.

## Variables

| Variable                                            | Conteneur                        | Rôle                                                                                                                               |
| --------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `APPORTEURS_VALIDATION_RDV`                         | app **et** worker                | Validation d'une entreprise par rendez-vous (règle du contrat 2.8).                                                                |
| `APPORTEURS_EMAIL_REFUS`                            | app (après le worker)            | E-mail à l'apporteur quand une entreprise est écartée (`refus-annonce.ts`).                                                        |
| `APPORTEUR_MES_COMMISSIONS_ENABLED`                 | app                              | Page « Mes commissions » et téléchargement des factures.                                                                           |
| `APPORTEUR_CHALLENGES_CONSOLE_ENABLED`              | app                              | Challenges : écrans de la console.                                                                                                 |
| `APPORTEUR_CHALLENGES_ESPACE_ENABLED`               | app                              | Challenges visibles dans l'espace. ⛔ Ne pas allumer tant qu'aucun chemin ne verse la prime (point 4 de #2464).                    |
| `APPORTEUR_CHANGEMENT_IBAN_ENABLED`                 | app (après #2453)                | Changement de RIB par l'apporteur. Voir `apporteurs-changement-iban-retour-arriere.md`.                                            |
| `RESERVATION_DIRECTE_ACTIVE`                        | app                              | Formulaire de réservation directe et liens de rendez-vous.                                                                         |
| `PII_ENCRYPTION_KEY`                                | app **et** worker, **identique** | Chiffre IBAN et pièces. Une valeur différente rend les données illisibles d'un côté.                                               |
| `CALENDLY_APPORTEUR_URL`, `CALENDLY_API_TOKEN`      | app **et** worker                | Lien et lecture des rendez-vous. Lien absent = passage suspendu (dit au journal).                                                  |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID_APPORTEURS` | app **et** worker                | Alertes Telegram (facultatives). Sur le worker : alertes de surveillance (passage absent). Sans elles, seul l'e-mail interne part. |

## Ordre d'allumage

1. **Worker d'abord** pour tout ce qui touche un contrat app↔worker : poser `PII_ENCRYPTION_KEY`
   (identique), Calendly, Telegram, `APPORTEURS_VALIDATION_RDV` ; redémarrer le worker.
2. **Vérifier le worker** : le contenu, pas l'étiquette d'image (voir `AGENTS.md`). Un passage
   quotidien (07:00 UTC) puis un passage horaire (minute 10) doivent tourner sans étape en erreur.
3. **App ensuite** : `PII_ENCRYPTION_KEY`, `APPORTEUR_MES_COMMISSIONS_ENABLED`, puis
   `APPORTEURS_EMAIL_REFUS` (après le worker), `RESERVATION_DIRECTE_ACTIVE`, puis
   `APPORTEUR_CHANGEMENT_IBAN_ENABLED` (après #2453) ; redémarrer l'app.
4. **Challenges en dernier** : `APPORTEUR_CHALLENGES_CONSOLE_ENABLED`, puis
   `…_ESPACE_ENABLED` seulement quand une prime peut réellement être versée.
5. **Retour arrière** : retirer la variable (ou la passer à autre chose que `true`) et
   redémarrer. Aucune donnée n'est effacée.

## Surveillance des passages (à connaître avant d'allumer)

- Le worker note dans Redis (`apporteurs:dernier-passage-reussi:<nom>`) le dernier passage
  **réussi** (sans étape en erreur) de `reseau-quotidien` et `reseau-facturation`.
- Alerte interne (e-mail + Telegram si configuré, une fois par jour) au-delà de **26 h** et
  **3 h**, ou si la clé est absente (Redis vidé : **une alerte le premier jour est normale**).
- Une étape en erreur dans le passage alerte aussi (une fois par jour et par étape).
- Un apporteur « à vérifier » depuis plus de 2 jours ouvrés déclenche une alerte interne.
- Limite : un worker entièrement arrêté ne peut pas s'alerter lui-même ; la supervision
  Coolify reste nécessaire.
