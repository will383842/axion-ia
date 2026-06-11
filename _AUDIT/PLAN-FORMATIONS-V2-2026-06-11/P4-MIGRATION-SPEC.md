# P4 — Spec de migration Qualiopi (offres des 17 + champ gamme + booking)

> « Je prépare le code, tu appliques la migration » (Will, 2026-06-11).
> ⚠️ À exécuter dans le **repo principal** (`axionia/`), PAS dans le worktree
> (qui partage le client Prisma généré via junction). Migration **additive
> uniquement** (aucun DROP), conforme ADR 0020.

## Pourquoi une adaptation de schéma
Le catalogue V2 tarife par **matrice (gamme × durée × effectif)** (`FORMATION_PRICE_MATRIX`,
pricing.ts), pas par un `tierId` unique. Le modèle `OffreSite` actuel exige
`tierId @unique` (1 offre = 1 tier pricing). Les 17 nouvelles offres n'ont pas
de tierId → on rend `tierId` nullable et on ajoute les axes `gamme` + `dureeCode`.

---

## 1. schema.prisma (diff additif)

### model OffreSite — ajouter / modifier
```prisma
model OffreSite {
  // ... champs existants ...
  // MODIFIÉ : nullable (les offres V2 n'ont pas de tier pricing.ts ; prix via matrice)
  tierId      String?  @unique @map("tier_id") @db.VarChar(80)
  // AJOUTÉS (axes catalogue V2 — null pour les offres legacy)
  gamme       String?  @db.VarChar(40)          // "ia-standard" | "agents-automatisations" | "claude"
  dureeCode   String?  @map("duree_code") @db.VarChar(8) // "4h" | "1j" | "2j" | "3j"
  // ... reste inchangé ...
  @@index([gamme])
}
```
> Postgres autorise plusieurs `NULL` dans un index unique → `tierId @unique` nullable OK.

### enum OffreFormatPedagogique — ajouter
```prisma
enum OffreFormatPedagogique {
  // ... valeurs existantes (collectif_4h, collectif_1jour, collectif_2jours, conference,
  // dirigeant_1to1, individuel, sur_devis) ...
  collectif_3jours   // AJOUT — formations 3 jours (IA Transformation, Agents avancé)
  agents_automatisations // AJOUT — gamme Agents (code source)
  claude             // AJOUT — gamme Claude (formateur certifié)
}
```

### enum InterventionType (booking calendrier, Q-B = 3 CTA dont calendrier) — ajouter les 17
```prisma
enum InterventionType {
  // ... valeurs existantes (essentielle, approfondie, ...) — NE PAS RETIRER (legacy live jusqu'au flip) ...
  // AJOUT V2 (snake_case) :
  ia_express
  art_du_prompt
  ia_securite
  ia_conformite
  ia_fondamentaux
  ia_commercial
  ia_au_bureau
  ia_sur_le_terrain
  automatisations_decouverte
  ia_integration_metier
  ia_commercial_avance
  ia_transformation_equipe
  agents_automatisations
  agents_automatisations_avance
  claude_decouverte
  claude_createur
  claude_architecte
}
```

---

## 2. Seed des 17 OffreSite — `prisma/seeds/qualiopi/offres-v2.ts` (NOUVEAU)
Dérive du catalogue V2 (SSOT). Codes `AXI-OFF-012` → `028` (après les 11 existants).
```ts
import type { PrismaClient } from "../../generated/client";
import { FORMATIONS_V2 } from "../../../src/content/formations/catalog-v2";
import { getGammeMeta } from "../../../src/content/formations/catalog-v2-meta";
import { getFormationEntryPrice } from "../../../src/content/pricing";

const FORMAT_PEDA: Record<string, string> = {
  "4h": "collectif_4h", "1j": "collectif_1jour", "2j": "collectif_2jours", "3j": "collectif_3jours",
};
const DUREE_HEURES: Record<string, [number, number]> = {
  "4h": [4, 4], "1j": [6, 8], "2j": [12, 14], "3j": [18, 21],
};

export async function seedOffresV2(prisma: PrismaClient): Promise<void> {
  let created = 0, kept = 0, index = 12; // après AXI-OFF-011
  for (const f of [...FORMATIONS_V2].sort((a, b) => a.numero - b.numero)) {
    const code = `AXI-OFF-${String(index++).padStart(3, "0")}`;
    const existing = await prisma.offreSite.findUnique({ where: { slug: f.slugFr } });
    if (existing) { kept++; continue; }
    const [hMin, hMax] = DUREE_HEURES[f.duree]!;
    const gamme = getGammeMeta(f.gamme);
    await prisma.offreSite.create({
      data: {
        code,
        tierId: null,                       // prix via matrice (pas de tier pricing)
        gamme: f.gamme,
        dureeCode: f.duree,
        slug: f.slugFr,
        titreFr: f.titreFr,
        categorie: "intervention",
        formatPedagogique: FORMAT_PEDA[f.duree] as never,
        publicViseFr: f.publicViseFr,
        dureeHeuresMin: hMin,
        dureeHeuresMax: hMax,
        modalites: ["presentiel", "distanciel"],
        tarifType: "a_partir_de",
        promessePrincipaleFr: f.accrocheFr,
        nbModulesMin: 2,
        nbModulesMax: 6,
        anglePedagogiqueFr: gamme.labelFr,
      },
    });
    created++;
  }
  console.log(`✅ [qualiopi:seed] offres V2 — ${created} créée(s), ${kept} préservée(s).`);
}
```
Brancher dans `prisma/seeds/qualiopi/index.ts` : `await seedOffresV2(prisma);` après `seedOffresSite`.

---

## 3. pricing-resolver — gérer les offres V2 (matrice)
`src/server/qualiopi/offres/pricing-resolver.ts` : si `tierId` absent et `gamme`+`dureeCode`
présents, dériver « À partir de X € HT » via `getFormationEntryPrice(gamme, dureeCode)`
(import depuis `@/content/pricing`). Sinon, comportement actuel (tierId → pricing tier).

---

## 4. Fiche publique `/formations/[slug]` (déjà OK)
Aucun changement requis : la fiche rend déjà depuis le SSOT catalog-v2 (P3.1). L'overlay
DB Qualiopi (indicateurs, certif) s'ajoutera automatiquement quand une `Formation`
publiée existe pour ce slug (logique de fallback déjà en place).

---

## 5. Booking calendrier (Q-B) — additif
- `prisma/schema.prisma` : enum `InterventionType` + 17 valeurs (cf. §1).
- `src/lib/intervention-type.ts` : ajouter les 17 à `INTERVENTION_SLUGS`. Le mapping prix
  pour ces slugs passe par la matrice (gamme×durée) et non `SLUG_TO_TIER_ID` → ajouter un
  helper `bookingPriceForV2(slug)` qui résout via catalog-v2 + matrice.
- `src/content/booking-catalog.ts` : ajouter une catégorie « Formations (V2) » avec les 17
  `BookingFormat` (durationDays = ceil jours, prix dérivé). ⚠️ budget bundle `/reserver`
  (`size-limit`) — importer via `durations-lite` si delta > +5 KB.
- Tests `booking-catalog.test.ts` / `intervention-type.test.ts` verrouillent les oublis.

---

## 6. Commandes (dans le repo principal `axionia/`)
```bash
# 1. Appliquer le schema (génère la migration SQL additive)
pnpm prisma migrate dev --name formations-v2-gamme-booking
# 2. Régénérer le client (⚠️ stopper tout `pnpm dev` avant — verrou DLL)
pnpm prisma generate
# 3. Seeder les 17 offres V2
pnpm qualiopi:seed
# 4. Vérifier
pnpm typecheck && pnpm test
```

---

## 7. P5 — Console admin (après migration, le client a `gamme`/`dureeCode`)
- `/qualiopi/offres` (liste) : ajouter colonnes **Gamme** + **Durée** (lire `offre.gamme`,
  `offre.dureeCode`) ; le prix reste résolu en lecture via le resolver (matrice).
- `/qualiopi/formations` : badge gamme sur la fiche.
- `verifyOffreCoherence()` : pour les offres V2 (tierId null), vérifier que `gamme`+`dureeCode`
  résolvent un prix dans la matrice (au lieu de la cohérence tierId↔pricing).

---

## 8. Tests anti-drift à ajouter (post-migration)
- `offres-v2 == catalog-v2` : pour chaque offre V2 seedée, `gamme`/`dureeCode`/`slug`/
  `publicViseFr` == la formation catalog correspondante ; le prix résolu == matrice.
- booking : chaque slug V2 ∈ `InterventionType` enum + résout un prix.

## 9. Bascule (flip) — mémo
Le jour de l'agrément OF : `OF_PUBLIC_DISCLOSURE_ENABLED=true` (Coolify) + redémarrage →
catalogue public visible, sitemap actif. + activer les redirects 301 `/interventions/*`
→ `/formations/*` (next.config.ts) + registrer `KEYWORDS_FORMATIONS_V2` dans master.ts
(retirer/rediriger en parallèle les anciens keywords /interventions pour éviter la
cannibalisation).
