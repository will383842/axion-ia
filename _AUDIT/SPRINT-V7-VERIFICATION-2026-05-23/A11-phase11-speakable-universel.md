# A11 Phase 11 — Speakable universel cross-template

## Statut : ⚠️ STUB-OK

Helper livré, testé, conforme schema.org — mais **0 template ne l'a encore adopté**. Le commit annonce explicitement "Usage cross-template (Sessions 12+)", donc l'adoption est différée. Helper prêt à l'emploi, mais cross-template = potentiel non-câblé.

## Files claimed vs found

| Claim commit                                        | Fichier                                      | Présent         | Taille      |
| --------------------------------------------------- | -------------------------------------------- | --------------- | ----------- |
| `src/lib/seo/speakable-universal.ts`                | `axionia/src/lib/seo/speakable-universal.ts` | ✅              | 86 lignes   |
| `src/lib/seo/__tests__/speakable-universal.spec.ts` | idem                                         | ✅              | 69 lignes   |
| 8 tests vitest verts (S1-S8)                        | spec.ts contient bien le pattern S1→S8       | ✅ (revue code) | non exécuté |

Stat git `65beafeb` : 2 fichiers / 155 insertions — strictement aligné avec le diff annoncé.

## Cross-checks

- **Helper signature universelle (multi-template) : oui.**
  Generic `<T extends Record<string, unknown>>` → `injectSpeakableInto(schema, selectors)` et `withUniversalSpeakable(schema, selectors)` acceptent n'importe quel objet JSON-LD page-level (`WebPage`, `Article`, `Service`, `FAQPage`, etc.). Pas de contrainte de type sur `@type`. `buildSpeakableSpecification()` retourne la propriété brute, agnostique du conteneur.
  Idempotence : `if ("speakable" in schema && schema["speakable"] != null) return schema` (ligne 65) — n'écrase pas une valeur existante.
  No-op safe : `if (selectors.length === 0) return schema` (ligne 84).

- **Adopté par ≥3 templates différents : non.**
  Grep `withUniversalSpeakable|injectSpeakableInto|buildSpeakableSpecification` sur tout `src/` retourne **uniquement** `speakable-universal.ts` (source) et `speakable-universal.spec.ts` (tests). 0 import depuis un template / page / generator / factory.

- **Pas de `SpeakableSpecification` hardcoded leftover : non.**
  Inventaire des sites qui émettent encore `"@type": "SpeakableSpecification"` en dur (pourraient être migrés vers le helper) :
  - `src/lib/seo.ts:317, 716` (helper FAQPage existant `buildFaqSpeakableJsonLd`, explicitement mentionné par le commit comme antérieur — admissible)
  - `src/lib/seo-content-gen-factories.ts:200, 308, 386` (3 factories content-gen)
  - `src/lib/seo/ville-service-jsonld.ts:230, 321` (2 occurrences ville-service)
  - `src/server/image-bank/services/image-seo.service.ts:104`
  - 10 routes app : `blog/[slug]`, `glossaire`, `glossaire/[slug]`, `guides`, `presse`, `presse/[slug]`, `connaissances`, `comparaisons`, `centre-aide`, `charte-editoriale`, `corrections`
  - Total : ~18 sites de duplication SpeakableSpecification inline non-migrés. Commit `65beafeb` n'a touché aucun de ces fichiers.

## Verdict / écarts trouvés

**Écart principal** : le titre du sprint annonce "Speakable universel **cross-template**" mais la livraison se limite à l'**outillage** (helper + tests). L'**adoption** par les ~18 call-sites existants n'est pas faite — le commit le reconnaît honnêtement ("Usage cross-template (Sessions 12+)"). Résultat opérationnel à date : zéro page additionnelle ne sert Speakable, et la dette de duplication JSON-LD reste intégrale. Le bénéfice AEO p75 = 0 tant qu'aucun template n'appelle `withUniversalSpeakable`.

**Conformité technique du helper** : correcte. Type `SpeakableSpec` aligné schema.org (cssSelector + xpath optionnels, ReadonlyArray pour immutabilité). `DEFAULT_SPEAKABLE_SELECTORS` raisonnables (`h1`, `[itemprop="text"]`, `.speakable`, `.direct-answer`). Idempotence + no-op safe = bonnes propriétés défensives. Generic-safe sur tout schema page-level.

**Couverture tests** : 8 tests S1-S8 (revue code de spec.ts) — couvrent builder defaults, custom selectors, xpath, injection, idempotence, no-op safe, sélecteurs canoniques. Pas d'exécution vitest dans ce passage (read-only), mais structure conforme.

**Action restante (hors scope A11)** : Sessions 12+ doivent migrer les ~18 sites inline vers `withUniversalSpeakable(...)` pour matérialiser le "cross-template". Sinon l'investissement reste théorique.

**Verdict binaire** : STUB-OK. Helper livré et utilisable, mais le qualificatif "cross-template" du commit message est prospectif, pas constaté à `HEAD = 98e7626a`.
