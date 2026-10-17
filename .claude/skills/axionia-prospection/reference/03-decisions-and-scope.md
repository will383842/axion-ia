# 03 — Décisions & périmètre

> Miroir condensé de `axionia/_PROSPECTION-BASE-ENTREPRISES/07-DECISIONS.md` (source de vérité).
> Décisions verrouillées par Will le 2026-07-01.

## Périmètre

|                                                                          | V1 (à construire)           | V2 (hors périmètre)          |
| ------------------------------------------------------------------------ | --------------------------- | ---------------------------- |
| Collecte dép × NAF × taille (Stock Sirene)                               | ✅                          | —                            |
| Enrichissement gratuit (dirigeants, responsables, email/tél best-effort) | ✅                          | —                            |
| Pilotage + suivi dép→région→France + dashboard                           | ✅                          | —                            |
| Recherche/filtres + fiches + contacts à onglets + export segmenté        | ✅                          | —                            |
| Cold-outreach (emailing, séquences, IMAP)                                | ❌                          | ✅ (base légale/AIPD dédiée) |
| Enrichissement payant                                                    | ❌ (jamais — décision Will) | ❌                           |
| Scoring avancé, sync CRM auto, tous établissements                       | Basique / manuel / siège    | ✅                           |

## Les 10 arbitrages

1. **Domaine** : données ouvertes → heuristique + vérif DNS/HTTP. **Pas de SERP.**
2. **Exploitable** = ≥ 1 email valide (MX OK) ; tél = bonus ; nuance nominatif > générique.
3. **Pilote** : Isère (38) + BTP + Santé.
4. **Organisations publiques** : `typeOrganisation` = filtre (pas un 4e axe de la matrice).
5. **Export** : CSV/XLSX segmenté + bouton « → CRM Qualiopi » manuel (crée un `Client` statut `prospect`).
6. **Conservation** : 3 ans après dernière action (déclencheur = collecte si jamais contacté) + page
   d'information publique (exemption art. 14.5.b). ⚠️ **à valider juridiquement**.
7. **Nom** : module `prospection`, pôle admin « Prospection ».
8. **Établissements** : siège uniquement en V1.
9. **Validation juridique** : **BLOQUANTE** — AIPD + LIA + exemption art.14 validées par DPO/juriste
   **avant tout connecteur de collecte** (bloque T3+, pas T1/T2).
10. **Passe B (responsables)** : `maxPagesPersonnes=4`, profondeur ≤ 2, activée par défaut sur secteurs à
    cabinets/agences (droit, santé, conseil, BTP), désactivable par campagne (`enrichirPersonnes`).

## Rappels transverses

- **100 % gratuit** (collecte + enrichissement). Coût infra non nul mais aucune API payante.
- **Sources** : Stock Sirene (backbone) + delta + recherche-entreprises (ciblage) + INPI RNE + Annuaire
  administration + BODACC + BAN + site public. Interdits : LinkedIn, Pages Jaunes, société.com, annuaires
  privés, SERP.
- **Anti-doublon** : 1 SIREN = 1 Company (upsert) ; succursales = Establishment/SIRET ; dédup email/tél
  (valueNormalized) ; dédup personne (`personKey` = nom+prénoms, **sans** fonction).
- **RGPD** = contrainte n°1 (voir `05-CONFORMITE-RGPD-AIPD.md`) : le gate Q9 conditionne toute collecte.
