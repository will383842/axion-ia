> ⚠️ **MIS À JOUR le 2026-09-05 à 18:15 (heure locale, UTC+2).**
>
> **Filet de relance : tâche Windows « Axion-IA relance Qualiopi 10h40 »,
> prochaine exécution vérifiée `2026-09-05 20:30:30`.**
> Script `_RELANCE/relancer-qualiopi.cmd` · prompt `_RELANCE/PROMPT-RELANCE-QUALIOPI.txt`
> · journal `_RELANCE/journal-relance.txt` · sorties `_RELANCE/relance-<date>.log`.
>
> ⛔ **Si le chantier se termine, SUPPRIMER la tâche** :
> `Unregister-ScheduledTask -TaskName "Axion-IA relance Qualiopi 10h40" -Confirm:$false`
>
> ### 🔴 Ce que le tir RÉEL de 12:30 a appris — et que le test à blanc n'avait pas vu
>
> La première version lançait `claude.exe` en mode **interactif** depuis le
> Planificateur. Elle a tiré pour de vrai à 12:30:07. Résultat **mesuré** : le
> processus a démarré (PID 3164), consommé **9 s de CPU en 18 minutes**, ne s'est
> **jamais enregistré** auprès des autres sessions Claude, et n'a touché à rien.
> Il attendait très probablement une confirmation que personne ne pouvait donner.
>
> 🔑 **Le test à blanc du matin ne pouvait pas le voir : il neutralisait
> justement la ligne `claude.exe`.** Un essai qui saute la seule ligne qui compte
> ne prouve rien d'elle — il prouve que le reste du script marche, ce qui n'était
> pas la question.
>
> ⚠️ **Et ma première explication était fondée sur un MAUVAIS INSTRUMENT.** J'ai
> conclu « aucune fenêtre » depuis `MainWindowHandle = 0` ; dans cet
> environnement **toutes** les consoles rendent 0, y compris celles qui
> fonctionnent. Le seul fait solide reste l'inactivité de 18 minutes.
>
> **Le filet tourne désormais en `claude -p`** — aucun terminal requis, aucune
> question posée, sortie dans un fichier relisible à froid. Éprouvé **de bout en
> bout depuis le Planificateur**, ligne `claude` comprise : la tâche a produit un
> fichier contenant la réponse attendue.
>
> ⚠️ **Ce que je n'ai PAS vérifié** : qu'une session `-p` non surveillée puisse
> réellement ÉDITER, COMMITER et POUSSER. Elle pourrait n'avoir le droit que de
> lire. Le filet garantit donc qu'une reprise DÉMARRE et laisse une trace ; il ne
> garantit pas qu'elle travaille. **Garder l'arbre commité et poussé en
> permanence** reste la vraie protection.
>
> **État à 12:55** : branche `qualiopi/session-editable-et-conventions`,
> **19 commits**, poussée, arbre PROPRE, aucune PR ouverte. Base `f62368221` ;
> `origin/main` est à `0452729b5` (2 commits d'écart, aucun sur la zone Qualiopi).

---

3 · Qualiopi — AUTOPILOT — REPRISE du 2026-09-05, depuis C:\Users\willi\Documents\Projets\Axion-IA

Travaille dans C:\Users\willi\Documents\Projets\Axion-IA\wt-app30
(branche qualiopi/session-editable-et-conventions, POUSSÉE sur origin, 6 commits,
arbre PROPRE, partie de main = f62368221).

LIS D'ABORD, ET EN ENTIER :
wt-app30/_SESSIONS/2026-09-05_QUALIOPI-ETAT-VIVANT.md
C'est l'état complet : ce qui est fait, ce qui est vérifié, ce qui reste, les
cartes du terrain déjà payées, et les pièges de la session précédente.
Ne repaye AUCUN des audits listés à son § 6.

CE QUI EST DÉJÀ FAIT — ne le refais pas, ne le casse pas :
· #991 fusionnée 03:57:28 UTC → main = f62368221, ATTERRIE en prod (vérifié par
x-axion-build-sha, et les jobs build+deploy sont verts).
· Lot A TERMINÉ : « rien ne part après la contresignature » est corrigé, gardé
(19 témoins, vu rougir 3 fois) et commité, avec son filet d'alerte.
· Socle du lot 3 posé côté SERVEUR (montant + modalité + libellés dérivés,
18 témoins) — mais AUCUN écran ne l'appelle encore.

REPRENDS EXACTEMENT ICI :

1. Relire l'état vivant, puis relancer `pnpm typecheck` (lire la BANNIÈRE
   `> tsc --noEmit`, jamais l'exit code seul) et les gardes de dépôt
   `tests/unit/ci/` (~17 min, elles balaient toute l'arborescence).
2. Lot B — le CÂBLAGE UI du lot 3 : les 7 points du § 5 de l'état vivant
   (N1 montant, N2+F4 modalité et libellés, N4 le filigrane COPIE forcé,
   N5+F7 acompte, F10 les repères J-n faux, N6 SIRET à reconfirmer en prod,
   puis F1 F2 F5 F8 F9 et le débordement du bloc Documents).
3. Lot C — le distanciel de bout en bout. La carte du terrain est au § 7 :
   il n'existe AUCUNE intégration Zoom/Teams, mais toutes les briques à
   réutiliser sont nommées avec leur chemin:ligne (jeton lié à l'empreinte du
   destinataire, contrôle avant vol bloquant, envoi par personne à l'échelle,
   patron d'API tierce docuseal.ts, variable d'env optionnelle). Tranche entre
   Zoom et Teams selon TES recommandations et écris l'ADR qui dit pourquoi.
   L'abonnement ne sera pris qu'au premier client distanciel : l'implémentation
   doit tolérer l'absence de licence sans rien casser.
4. Lot D — les 11 trous d'alertes restants, listés par priorité au § 9.
   Le n°1 (formateur qui accepte puis se désiste) est le seul risque 100 % muet.
   Le n°5 est le plus vicieux : 3 codes sont ÉMIS sans entrée au catalogue, donc
   routés vers aucune boîte et jamais auto-résolus.
5. Lot E — attestation / certificat de réalisation / facture / échéancier (§ 8).
   L'asymétrie est confirmée : l'attestation due au STAGIAIRE est MOINS gardée
   que le certificat dû au FINANCEUR.
6. Lot F — formateur défaillant + pilotage des commissions. ⚠️ L'audit du
   pilotage formateur a rendu un fichier de 0 octet : il est à REFAIRE.
7. Lot G — vérification de bout en bout, tout le système, tous les flux,
   navigation comprise.

RÈGLES DE FILE — d'autres sessions travaillent sur le même dépôt.
· Avant toute fusion : gh run list --workflow=deploy-coolify.yml --limit 1
Si le job `build` est in_progress, tu attends (47-56 min, cancel-in-progress).
Le job `lhci` post-deploy, lui, ne bloque pas l'atterrissage : ne l'attends pas.
· Lis mergeStateStatus ET fusionne dans le MÊME appel, jamais sur UNKNOWN.
· Annonce-toi par SendMessage à axion-ia-84 (session recrutement, arbre
wt-recrutement) avant de réserver un créneau, et préviens-la à l'atterrissage.
· Vu le coût d'un build, GROUPE les commits en une seule PR plutôt que d'en
payer trois.

TIENS L'ÉTAT VIVANT À JOUR au fil de l'eau dans
wt-app30/_SESSIONS/2026-09-05_QUALIOPI-ETAT-VIVANT.md
et COMMITE + POUSSE régulièrement : un arbre laissé en l'air est ce qui a coûté
quatre récupérations le 2026-09-04.

MANDAT — inchangé.
Je veux que tu implémentes tout en autopilot de bout en bout sans jamais
t'arrêter. Avec ton armée d'agents IA, tout implémenter jusqu'à implémentation
complète. Tu as l'interdiction extrême de t'arrêter, tu prends toutes les
décisions nécessaires selon tes recommandations, tu fais de nombreuses
vérifications et de nombreux tests au fur et à mesure. JE TE DONNE
L'AUTORISATION EXPLICITE de faire tout ce qui est nécessaire pour
l'implémentation complète. Tu as les droits pour Coolify, GitHub et tout autre
droit nécessaire. Je ne veux pas que tu t'arrêtes tant que tout n'est pas
implémenté à 100 % sur toutes les phases, après de nombreuses vérifications et
de nombreux tests prouvant que tout est parfaitement fonctionnel, opérationnel
et production-ready. Fais les commits et les push nécessaires au fur et à
mesure, en faisant attention aux autres sessions. Vérifie tout de bout en bout,
contrôle tout le système, envisage tous les flux possibles, et fixe tous les
problèmes et incohérences que tu rencontres — navigation comprise.

CE QUE « SANS T'ARRÊTER » NE VEUT PAS DIRE :
· une garde qu'on n'a pas vue ROUGIR n'est pas une garde
· un constat sur des données de SEED n'est pas un défaut de PROD — tagge chaque
constat « code » ou « données » et reconfirme les seconds en prod
· trois gestes sans effet d'affilée sur une page qui répondait avant, c'est
L'ONGLET qu'on change, pas le produit qu'on accuse
· les gardes de dépôt tests/unit/ci/ mettent 17 min et balaient l'arborescence :
elles n'apparaissent pas si tu cibles un sous-ensemble
· Turbopack refuse la jonction node_modules du worktree — next dev --webpack,
avec un tas plus grand
· les heredocs bash cassent au-delà de ~150 lignes sur ce poste : utilise Write
ou un script Python pour les gros fichiers
