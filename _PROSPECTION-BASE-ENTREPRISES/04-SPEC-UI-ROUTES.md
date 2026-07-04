# 04 — Frontend / Console d'administration & routes

> Spec de conception. Source de vérité : `PLAN-DIRECTEUR-V1.md` §4.3, §7, §8. Admin sous
> `src/app/[locale]/(admin)/[adminPrefix]/prospection/**`, Server Actions, next-intl FR, Tailwind v4,
> design system admin existant (`AdminPageShell`, `AdminTable`, `AdminBadge`).

## 1. Navigation

Nouveau pôle **« Prospection »** dans `src/lib/admin-nav.ts`. Sous-sections : Tableau de bord · Campagnes ·
Base entreprises · Contacts · Couverture · Carte · Personnes · Exports · Journal · RGPD · Doublons · Réglages.

## 2. Routes / pages

| Route                                | Objet                    | Contenu clé                                                                                                                                                              |
| ------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/prospection`                       | **Dashboard**            | KPI (collecté aujourd'hui/total, enrichis, erreurs), bandeau France (complétion %, contactabilité %), campagnes actives, top dép/secteurs, âge des chiffres + rafraîchir |
| `/prospection/campagnes`             | Liste campagnes          | Statut, avancement %, actions lancer/pause/reprendre, priorité                                                                                                           |
| `/prospection/campagnes/nouvelle`    | **Wizard 4 étapes**      | Voir §3                                                                                                                                                                  |
| `/prospection/campagnes/[id]`        | Détail campagne          | Avancement par cellule, logs CollectRun, erreurs, ETA, reprise                                                                                                           |
| `/prospection/entreprises`           | **Base entreprises**     | Table keyset + filtres (dép, secteur, taille, type, contactabilité, statut enrichi, texte), tri leadScore, actions masse, export sélection                               |
| `/prospection/entreprises/[siren]`   | Fiche entreprise         | Identité, établissements, personnes+rôles, contacts, tags, carte, historique events, opt-out/effacer/→CRM                                                                |
| `/prospection/contacts`              | **Contacts (3 onglets)** | Voir §4                                                                                                                                                                  |
| `/prospection/couverture`            | **Couverture**           | Matrice dép×secteur×taille + bandeau France + vue région + drill-down + export rapport stats                                                                             |
| `/prospection/carte`                 | **Carte choroplèthe**    | France dép/région, modes complétion/contactabilité — SVG léger (pas Leaflet)                                                                                             |
| `/prospection/personnes/[personKey]` | Détail personne          | Identité, entreprises liées, rôles, coordonnées nominatives, **opt-out/effacement personne**                                                                             |
| `/prospection/journal`               | Journal / audit          | `ProspectionEvent` + `ProspectionAccessLog`, filtres (type/campagne/entreprise/acteur/date), keyset                                                                      |
| `/prospection/rgpd`                  | Espace RGPD              | Liste SuppressionEntry, demandes entrantes, prochaines purges `retentionUntil`, export registre                                                                          |
| `/prospection/doublons`              | Revue doublons           | File fuzzy (§5.9 niveau 4) à valider manuellement                                                                                                                        |
| `/prospection/exports`               | **Exports segmentés**    | Voir §5                                                                                                                                                                  |
| `/prospection/reglages`              | Réglages                 | Quotas, rate-limits, mapping taille, fenêtre fraîcheur, seuil « exploitable », paramètres RGPD                                                                           |

## 3. Wizard de campagne (4 étapes)

1. **Départements** (multi-sélection + « toute la France » / par région).
2. **Activités** : secteurs métier (BTP/Santé/Droit…) ou codes NAF précis.
3. **Tailles** : TPE / PME / ETI / GE + `typeOrganisation` (privé/public/…).
4. **Options** : `enrichirContacts`, `enrichirPersonnes`, quota, rythme, priorité, planification (`scheduledAt`/récurrence).
   → **Aperçu du volume estimé** + nombre de cellules (dépend de `StockReference` — §03). Récap avant lancement.

## 4. Page Contacts (à onglets)

Onglets : **✅ Prêts à l'emploi** (`exploitable`) · **🟡 À enrichir** (`partiel`) · **🔴 Non contactables**.
Chaque onglet : table filtrable (dép/secteur/taille/type), tri `leadScore`, **export direct de l'onglet**,
actions rapides (relancer enrichissement, opt-out, → CRM). Distinction nominatif vs générique visible.

## 5. Exports segmentés

Fichiers CSV/XLSX : « exploitables (email+tél) » / « partiels » / « à compléter », filtrables par
dép/secteur/taille/type. Colonnes normalisées **+ colonnes de conformité** (source, date de collecte,
base légale/mention). **Re-filtre opt-out + non-diffusible à la génération.** Volume disque hors web-root,
route de download authentifiée. Historique des exports (journalisé — RGPD).

## 6. RBAC & sécurité

Rôles **`viewer | operator | dpo | admin`**. Export/bulk/opt-out réservés `dpo|admin` ; consultation
pour `viewer|operator`. Toute consultation/recherche/export de données perso → `ProspectionAccessLog`.

## 7. Fonctions transverses

- **Actions en masse** : sélection « tout ce qui matche le filtre » (pas seulement la page).
- **Segments sauvegardés** + recherche avancée (query-builder multi-critères).
- **Pilotage depuis le chat** (grant + enqueue, pattern content-gen) pour lancer une campagne pilote.

## 8. Web Vitals (pages admin)

Carte = **SVG statique + GeoJSON simplifié** (pas de lib carto client). Tables = **pagination keyset** +
virtualisation, counts approximatifs. Bundle maîtrisé (`size-limit`). i18n FR. Budget admin à préciser
(probablement plus souple que les 15 pages publiques, mais soumis à `size-limit`).
