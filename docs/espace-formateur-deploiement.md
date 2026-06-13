# Espace formateur passwordless + coaching 1-to-1 en ligne — mise en route

> Chantier 2026-06-13 (branche `feat/documents-interventions`). Phases 1→5.
> Comptes formateurs **sans mot de passe** (lien magique HMAC) + 5 formulaires
> AFEST remplis en ligne + console admin (suivi + dashboards).

## Ce qui est livré

| Phase | Contenu                                                                                                                                                                      |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 7 modèles Prisma (`FormateurMagicLink`, `CoachingSession` + cartographie / optimisations / plan / comptes-rendus / journaux) + migration `20260613150000_coaching_formateur` |
| 2     | Auth passwordless : cookie de session signé HMAC isolé de l'admin, lien magique one-shot (15 min), route de vérif, garde `requireFormateur`, garde middleware Edge           |
| 3     | Espace formateur `/fr/espace-formateur` (noindex, mobile-first) : connexion, tableau de bord, 5 formulaires AFEST                                                            |
| 4     | Console admin « Coaching 1-to-1 » : tableau de bord (gains de temps, optimisations par type/métier, conformité AFEST), liste des séances, comptes formateurs                 |
| 5     | Vérifs : 11 tests unitaires verts (crypto session 6 + nav 5), ESLint 0, Prettier conforme                                                                                    |

## Côté Will au déploiement

1. **Aucune nouvelle variable d'environnement.** L'auth réutilise `AUTH_SECRET`
   (déjà présent). Les liens utilisent `NEXT_PUBLIC_SITE_URL` (déjà présent).
2. **Migration** : `20260613150000_coaching_formateur` s'applique **automatiquement**
   à l'entrypoint deploy (`prisma migrate deploy`). 100 % additive.
3. **Activer un formateur** : sa fiche `Trainer` (Formation / Qualiopi) doit avoir
   `actif = true` et un e-mail valide. Il se connecte ensuite seul via
   `/fr/espace-formateur/connexion` (ou tu lui envoies un lien depuis
   _Coaching 1-to-1 → Comptes formateurs_).
4. **SMTP** : l'envoi du lien passe par BullMQ + Nodemailer (worker déjà en prod).

## Vérification post-deploy (E2E manuel)

1. `/fr/espace-formateur/connexion` → saisir l'e-mail d'un formateur actif →
   message générique, e-mail reçu avec bouton « Me connecter ».
2. Cliquer le lien → arrivée sur le tableau de bord (cookie `formateur_session`).
3. Re-cliquer le **même** lien → refus (usage unique) → retour connexion + erreur.
4. Créer une séance → remplir cartographie / optimisations / plan / CR / journal.
5. Se déconnecter → `/fr/espace-formateur` redirige vers la connexion.
6. Désactiver le compte (admin) → l'accès est coupé immédiatement.
7. Console admin _Coaching 1-to-1 → Tableau de bord_ : les KPIs reflètent la séance.

## Sécurité (rappel)

- Session = cookie HttpOnly + Secure + SameSite=Lax, jeton signé HMAC-SHA256
  (`AUTH_SECRET`), TTL 30 j. Vérification Edge dans `proxy.ts`.
- Révocation = relookup `Trainer.actif` à chaque requête protégée (`requireFormateur`).
- Lien magique = signature HMAC (scope `formateur_login`) **+** usage unique en base
  (hash SHA-256, `updateMany` atomique) → pas de replay.
- Toute action coaching vérifie la **propriété** de la séance (`assertOwnership`) :
  un formateur ne peut jamais lire/écrire la séance d'un autre.
- Console admin protégée par les guards `requireAdminRead/Write`.

## Espace ressources passwordless (commerciaux + formateurs)

> Le P3 reporté du chantier documents-interventions, construit comme **compte
> passwordless** : commerciaux + formateurs consultent/téléchargent à la demande
> les documents de leur périmètre (complément des notifications e-mail).

- **Identité = `DocumentRecipient`** (la liste « Annuaire équipe » EST la liste de
  comptes). Pour donner accès à quelqu'un : l'ajouter dans _Documents
  interventions → Annuaire équipe_ (rôle commercial/formateur + périmètre).
- **URL** : `/fr/espace-ressources/connexion` → e-mail → lien magique → liste des
  documents (groupés par prestation) avec boutons **PDF** / **source**.
- **Migration** `20260613160000_ressources_portal` (additive, auto au deploy) :
  `ressources_magic_links` + `ressource_telechargements` (accusé de
  téléchargement) + colonne `last_ressources_login_at`.
- **Sécurité** : mêmes garanties que l'espace formateur (cookie HMAC, lien
  one-shot 15 min, garde Edge). Filtrage rôle↔visibilité : commercial →
  `commercial` ; formateur → `formateur`+`commercial` ; borné au périmètre
  famille/prestation (UNION si plusieurs lignes pour le même e-mail).
- **Aucune nouvelle env** (URL R2 signées 5 min, `R2_*` déjà requis).
- **E2E** : ajouter un destinataire (Annuaire équipe) → `/espace-ressources/connexion`
  → lien → liste → télécharger un PDF (trace dans `ressource_telechargements`) →
  désactiver le destinataire = accès coupé.

## Reste optionnel / futur

- Génération .docx/.pdf des livrables (plan, CR) — non inclus (les formulaires
  centralisent les données ; export à brancher plus tard).
- Notification e-mail du bénéficiaire à la remise du plan.
- Rattachement d'une séance à un `Booking` (champ `bookingId` souple déjà prévu).
