# Source de la table IDCC → OPCO (RM-08) — LUE le 2026-10-04

Lue depuis le poste de b0 (l'environnement cloud n'a pas accès à data.gouv.fr : CONNECT 403).

- Jeu de données : « Table SIRET-OPCO », France compétences, data.gouv.fr, id `688a210c012cfbf595d7a99a`.
  API (pour retrouver la ressource du mois sans URL figée) :
  `https://www.data.gouv.fr/api/1/datasets/688a210c012cfbf595d7a99a/` → `resources[]` (format `csv`, titre `siro-AAAAMM.csv`).
- Ressource lue : `https://static.data.gouv.fr/resources/table-siret-opco/20260924-155236/siro-202606.csv`
  — millésime **2026-06** (DSN de juin, publiée le 2026-09-24), 109 242 949 octets, **3 671 884 lignes de données** + 1 en-tête.
- Dictionnaire : `https://static.data.gouv.fr/resources/table-siret-opco/20250731-130402/dictionnaire-donnees-table-siro-v2au310725.pdf` (v2.0, 31/07/2025).

## Format constaté (fichier réel)
- Séparateur `|`, pas de guillemets, UTF-8 sans BOM, fin de ligne `\n`.
- En-tête exact : `SIRET|IDCC|OPCO_PROPRIETAIRE|OPCO_GESTION`.
- `OPCO_GESTION` vide sauf outre-mer (12 260 lignes, toujours `AKTO`) : AKTO gère pour le compte de l'OPCO propriétaire (dictionnaire § 2, note 3). **Le couple IDCC → OPCO se lit sur `OPCO_PROPRIETAIRE`.**
- `IDCC` vide sur 124 504 lignes (SIRET en anomalie ou inconnu, § 3.2/3.3) ; `OPCO_PROPRIETAIRE` vide sur 124 575 lignes. Ces lignes ne donnent aucun couple (ce n'est PAS une ligne invalide à compter dans la tolérance : c'est un cas prévu par le dictionnaire).
- **Valeurs d'échappement** (dictionnaire § 2) : `5100`, `5501`, `9998`, `9999` — ce ne sont pas des IDCC ; l'OPCO y est choisi par le déclarant. À EXCLURE de `idcc_opco` (43 couples dans le millésime).
- Libellés d'OPCO présents (11, exactement) : `OPCO EP`, `AKTO`, `CONSTRUCTYS`, `ATLAS`, `L'OPCOMMERCE`, `OCAPIAT`, `OPCO MOBILITES`, `AFDAS`, `OPCO2I`, `UNIFORMATION COHESION SOCIALE`, `OPCO SANTE`.

## Chiffres du millésime 2026-06
- 1 052 couples (idcc, opco) distincts dont 43 sur valeurs d'échappement → **1 009 couples réels**.
- **56 IDCC réels rattachés à ≥ 2 OPCO.** Certains sont structurels (ex. `8822` AKTO 235 / OCAPIAT 67, IDCC agricoles outre-mer), d'autres sont des anomalies isolées (ex. `1596` CONSTRUCTYS 274 837 / OPCO EP 1 ; `1486` ATLAS 253 637 / OPCO2I 2).
- `siro-202606-couples-idcc-opco.txt` : TOUS les couples du millésime, `idcc|opco|nombre de SIRET`, agrégés depuis le fichier réel.
- `siro-extrait-202606.csv` : 264 lignes RÉELLES du fichier (1 sur 15 000 + cas choisis : IDCC à deux OPCO, échappements, OPCO_GESTION renseigné, IDCC vide).
