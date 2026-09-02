#!/usr/bin/env tsx
/**
 * Qualiopi — Isolation check CI (miroir des autres checks d'isolation du repo).
 *
 * Garantit que tout le code Formation Engine + Qualiopi Manager vit
 * EXCLUSIVEMENT dans ses zones dédiées (cloisonnement, skill `reference/01` §2) :
 *
 *  - src/server/qualiopi/**
 *  - src/server/actions/qualiopi/**
 *  - src/app/[locale]/(admin)/[adminPrefix]/qualiopi/**
 *  - src/app/[locale]/(admin)/[adminPrefix]/formations/**
 *  - src/app/[locale]/formations/**          (fiches publiques, flag-gated)
 *  - src/app/[locale]/portail/**             (portail stagiaire)
 *  - src/app/api/qualiopi/**                 (route SSE alertes T15)
 *  - src/components/admin/qualiopi/**
 *  - src/server/queue/workers/qualiopi-*-worker.ts
 *  - prisma/seeds/qualiopi/**  ·  prisma/migrations/*_qualiopi_*
 *  - scripts/qualiopi/**  ·  tests/qualiopi/**  ·  tests/e2e/qualiopi/**
 *  - docs/qualiopi/**  ·  src/types/qualiopi*
 *
 * + exceptions explicites (SSOT transverses qui RÉFÉRENCENT qualiopi)
 * + `CONSOMMATEURS_ASSUMES` : les surfaces qui importent le domaine, nommées
 *   une par une (voir le commentaire de cette constante).
 * Exit 1 si un fichier hors zone IMPORTE le module, ou si une exception est périmée.
 *
 * Usage : `pnpm qualiopi:isolation-check`.
 *
 * 🔴 2026-08-24 — cette ligne affirmait « câblé dans verify:all + pre-push ».
 * C'était FAUX pour `pre-push` (le hook ne l'a jamais appelé), et sans effet pour
 * `verify:all`, qui n'a lui-même aucun appelant : ni CI, ni hook, ni workflow.
 * Personne n'exécutait donc cette garde — et elle est passée de 24 violations le
 * 2026-07-30 à 58 le 2026-08-24 sans que rien ne rougisse. Le commentaire qui
 * décrit un câblage inexistant est pire que pas de commentaire : il fait croire
 * que la dérive serait détectée.
 * Elle est désormais appelée par le job `gate-a` de `.github/workflows/ci.yml`,
 * à côté de `content-gen:isolation-check` — le seul des trois qui était câblé,
 * et le seul qui était vert. `gate-a` est un contexte EXIGÉ par la protection
 * de `main` : à partir d'ici, la dérive rougit avant d'entrer.
 */

import { execSync } from "node:child_process";
import path from "node:path";

const ALLOWED_PATTERNS: ReadonlyArray<RegExp> = [
  /^src\/server\/qualiopi\//,
  /^src\/server\/actions\/qualiopi\//,
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/qualiopi\//,
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/formations\//,
  /^src\/app\/\[locale\]\/formations\//,
  /^src\/app\/\[locale\]\/portail\//,
  // Espace formateur collectif (étapes B et C du chantier émargement) : le
  // formateur consulte ses sessions de formation et recueille les signatures
  // des stagiaires sans téléphone, sur son propre poste. C'est un consommateur
  // ASSUMÉ du domaine qualiopi, au même titre que le portail stagiaire — pas
  // une fuite. Il n'importe que des lectures et l'action de signature ; la
  // politique de champs stagiaire (jamais d'e-mail, jamais de détail handicap)
  // est portée par `src/server/formateur/collectif-queries.ts`.
  // Restreint aux SESSIONS : c'est le seul usage réel. Ouvrir tout l'espace
  // formateur au domaine qualiopi serait plus large que nécessaire.
  /^src\/app\/\[locale\]\/espace-formateur\/sessions\//,
  /^src\/components\/espace-formateur\/Emargement/,
  /^src\/app\/\[locale\]\/verifier-attestation\//,
  /^src\/app\/api\/qualiopi\//,
  /^src\/components\/admin\/qualiopi\//,
  // Zone dédiée OUBLIÉE de cette liste jusqu'au 2026-08-24 : le hub de session
  // admin vit sous `features/`, pas sous `components/admin/`. Son unique fichier
  // signalé (`session-hub/ChecklistSession.tsx`) n'était pas une fuite — c'est
  // du code Qualiopi, dans un répertoire Qualiopi, que le motif ne couvrait pas.
  /^src\/features\/admin-qualiopi\//,
  // Composants PUBLICS Qualiopi (badge, bandeau, section mentions légales) —
  // surfaces de divulgation Phase B, flag-gated. Importés par le layout/footer/
  // mentions-légales QUI n'importent QUE depuis `@/components/qualiopi/`.
  /^src\/components\/qualiopi\//,
  /^src\/server\/queue\/workers\/qualiopi-.*-worker(\.spec)?\.ts$/,
  /^src\/server\/queue\/workers\/__tests__\/qualiopi-.*\.(spec|test)\.ts$/,
  /^prisma\/seeds\/qualiopi\//,
  /^prisma\/migrations\/\d+_(add_)?qualiopi_/,
  /^scripts\/qualiopi\//,
  /^tests\/qualiopi\//,
  /^tests\/e2e\/qualiopi\//,
  /^docs\/qualiopi\//,
  /^src\/types\/qualiopi/,
  // ── Exceptions explicites (SSOT transverses référençant qualiopi) ──
  // Nav admin SSOT — référence le groupe + routes /qualiopi & /formations.
  /^src\/lib\/admin-nav\.ts$/,
  // package.json — scripts qualiopi:seed / qualiopi:isolation-check.
  /^package\.json$/,
  // Workflow de seed prod Qualiopi (docker exec → prisma db execute des SQL boot).
  /^\.github\/workflows\/qualiopi-seed\.yml$/,
  // Layout admin + ⌘K — référencent les routes admin qualiopi.
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/layout\.tsx$/,
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/AdminCommandPalette\.tsx$/,
  // Queues + worker entry — orchestrent les queues qualiopi (T6/T15).
  /^src\/server\/queue\/queues\.ts$/,
  /^src\/server\/queue\/worker\.ts$/,
  // Seed principal — peut importer le seed qualiopi.
  /^prisma\/seed\.ts$/,
  // Instrumentation Next — hook de boot qui déclenche le seed auto du référentiel qualiopi.
  /^src\/instrumentation\.ts$/,
  // Routing i18n — pathnames /formations (Phase B).
  /^src\/i18n\/routing\.ts$/,
  // ── Références transverses légitimes (coaching 1-to-1 + handicap) ──
  // Coaching 1-to-1 (conseil) : l'admin coaching consomme la couche qualiopi
  // coaching-1to1 (heures, facturation). Surfaces métier, pas une fuite.
  // (2026-08-10 : le module AFEST `coaching-afest/**` a été supprimé — décision Will.)
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/coaching\//,
  /^src\/components\/admin\/coaching\//,
  // Page publique d'accessibilité — référence le SSOT `HANDICAP_PARTENAIRES`
  // (relais handicap, indicateur 26), exposé par `qualiopi/legal/legal-mentions`.
  /^src\/app\/\[locale\]\/accessibilite\//,
];

/**
 * Les surfaces qui CONSOMMENT le domaine, fichier par fichier — un CLIQUET.
 *
 * ## Pourquoi cette liste existe, et pourquoi elle est nominative
 *
 * Cette garde a rougi sans discontinuer pendant des mois : 24 fichiers le
 * 2026-07-30, **58** le 2026-08-24. Elle n'était branchée nulle part — ni CI,
 * ni hook — et `verify:all`, la seule chose qui l'appelait, n'a elle-même aucun
 * appelant. Une garde que personne n'exécute ne garde rien : elle enregistre
 * la dérive au lieu de l'arrêter. Le contraste est net dans ce dépôt même —
 * `content-gen:isolation-check`, le seul des trois câblé en CI, est à **0
 * violation sur 11 268 fichiers**.
 *
 * Les 49 imports réels mesurés ne sont PAS des fuites : le domaine expose une
 * API transverse assumée (l'identité de certification s'affiche sur le site
 * public — c'est le critère 1 du RNQ ; les mentions légales alimentent contrats
 * et factures ; le planning lit formateurs, financements et lieux). Prétendre
 * rétablir un cloisonnement que l'architecture a dépassé depuis un an
 * demanderait de déplacer 49 fichiers, pour un gain nul.
 *
 * On acte donc l'état réel — mais **nominativement, pas par répertoire**. Une
 * exception par dossier serait un blanc-seing : le 50ᵉ consommateur entrerait
 * sans que personne ne le voie. Ici, tout NOUVEAU fichier qui importe le
 * domaine fait rougir la garde, y compris dans un dossier déjà représenté.
 * C'est ce que cette garde peut honnêtement promettre : pas « le domaine est
 * cloisonné », mais « aucune surface ne se met à le consommer sans décision ».
 *
 * ⚠️ Cette liste doit RÉTRÉCIR, jamais grandir. `main()` échoue si une entrée
 * n'importe plus rien : une exception périmée est une garde qu'on a desserrée
 * pour rien.
 */
const CONSOMMATEURS_ASSUMES: ReadonlySet<string> = new Set([
  // Lot 4b — l'adaptateur MCP branche `qualiopi.conformite` sur `listAlertes()`
  // (la lecture persistée, PAS l'évaluateur). Inscrit NOMINATIVEMENT : un motif
  // de répertoire serait un blanc-seing pour tout fichier futur sous mcp/.
  "src/server/mcp/outils/qualiopi-conformite.ts",
  // ── Surfaces PUBLIQUES : affichage de la certification et de l'identité
  //    légale. Obligation réglementaire (RNQ critère 1 — information du public).
  "src/app/[locale]/a-propos/page.tsx",
  "src/app/[locale]/apporteur-affaires-independant-formation-ia-entreprise/page.tsx",
  "src/app/[locale]/avis/page.tsx",
  "src/app/[locale]/certification-qualiopi/page.tsx",
  "src/app/[locale]/equipe/[slug]/page.tsx",
  "src/app/[locale]/financement-opco-france-travail/page.tsx",
  "src/app/[locale]/memo-isere/page.tsx",
  "src/app/[locale]/page.tsx",
  "src/app/[locale]/secteurs/[secteur]/[activite]/page.tsx",
  "src/app/api/zeptomail/webhook/route.ts",
  "src/app/sitemap-images-services.xml/route.ts",
  "src/app/sitemap.ts",
  "src/components/formations/FormationDetailPage.tsx",
  "src/components/nav/Footer.tsx",
  "src/components/recrutement/PartenaireLandingPage.tsx",
  "src/server/content-gen/generators/blog-article.ts",
  // ── Boîte de réception (2026-08-27) : annote chaque demande entrante du
  //    client CRM au même e-mail, pour qu'on ne convertisse pas deux fois la
  //    même personne. Cette annotation était la seule valeur propre de l'écran
  //    « Entrées récentes », quatrième porte pour un seul geste, désormais
  //    fermée en 308 (UNE-SEULE-PORTE.md).
  //
  //    ⚠️ La surface consomme VRAIMENT le domaine, elle ne le duplique pas :
  //    `clientsParEmail()` est importée, jamais recopiée. Deux règles doivent
  //    rester communes aux deux appelants — comparaison insensible à la casse,
  //    et « le premier client créé gagne » sur un e-mail en double. Recopiées,
  //    elles auraient fini par désigner deux clients différents pour la même
  //    demande, sur deux écrans qui la montrent tous les deux.
  "src/app/[locale]/(admin)/[adminPrefix]/contacts/page.tsx",
  // ── Planning & pilotage admin : lisent formateurs, financements, lieux,
  //    prévisionnel. Surfaces métier assumées, comme `coaching/` au-dessus.
  "src/app/[locale]/(admin)/[adminPrefix]/planning/[type]/[id]/page.tsx",
  "src/app/[locale]/(admin)/[adminPrefix]/planning/ics/route.ts",
  "src/app/[locale]/(admin)/[adminPrefix]/planning/page.tsx",
  "src/app/[locale]/(admin)/[adminPrefix]/planning/previsionnel/page.tsx",
  "src/app/[locale]/(admin)/[adminPrefix]/planning/timeline/page.tsx",
  "src/features/admin-planning/charge-queries.ts",
  "src/features/admin-planning/detail.ts",
  "src/features/admin-planning/hub-queries.ts",
  "src/features/admin-planning/pipeline.ts",
  "src/features/admin-planning/queries.ts",
  "src/server/admin/dossiers-pipeline.ts",
  "src/server/admin/pilotage-dashboard.ts",
  "src/server/admin/qualiopi-nav-counts.ts",
  // ── Espace formateur & portail stagiaire : consommateurs assumés du domaine,
  //    au même titre que `[locale]/portail/` déjà autorisé plus haut.
  "src/app/[locale]/espace-formateur/page.tsx",
  "src/app/api/formateur/lettre-mission/[id]/route.ts",
  "src/components/portail/DemanderAccesForm.tsx",
  // 🔴 2026-08-24, cahier D3-3 — la phrase d'attestation que le stagiaire COCHE
  // était codée en dur dans ce composant, hors de `qualiopi/emargement/mentions`.
  // Elle échappait donc à la règle de versionnement que ce module impose : on
  // pouvait la réécrire sans incrémenter `mentionVersion`, et les empreintes
  // déjà scellées auraient pointé vers un texte qui n'existe plus.
  //
  // Le composant consomme donc désormais la SSOT des mentions. C'est un
  // élargissement ASSUMÉ, et le plus étroit possible : un seul libellé, depuis
  // un module de logique pure (aucun import Prisma, aucune horloge). Son jumeau
  // de l'espace formateur fait de même et vit déjà en zone autorisée
  // (`components/espace-formateur/Emargement*`).
  "src/components/portail/EmargementForm.tsx",
  "src/components/portail/EnqueteEntrepriseForm.tsx",
  "src/server/formateur/echeances-formateur.ts",
  "src/server/formateur/etapes-formateur.ts",
  // ── Dossier société (2026-08-26) : l'onglet « Société & conformité » affiche
  //    l'identité de l'organisme de formation — numéro de déclaration
  //    d'activité, numéro de certificat Qualiopi, adresse d'exercice, référent
  //    handicap. Ce sont des pièces que RÉCLAME un service achats de grand
  //    compte (checklist Délifrance, point 19), et elles n'existent qu'ici.
  //
  //    L'élargissement est le plus étroit possible : UNE page, en LECTURE
  //    SEULE, qui appelle `getOrganismeIdentite()` et rien d'autre du domaine.
  //    Elle ne lit ni session, ni stagiaire, ni indicateur, et n'écrit rien.
  //
  //    ⚠️ L'alternative — recopier ces lectures hors du domaine — aurait créé
  //    une seconde vérité sur le numéro de déclaration d'activité, que onze
  //    gabarits de documents lisent déjà depuis cette source. C'est exactement
  //    le motif que ce dépôt a payé quatre fois : un prédicat recopié diverge.
  "src/app/[locale]/(admin)/[adminPrefix]/societe/identite/page.tsx",
  // ── Fiche message (boîte de réception) : appelle `findClientByEmail()` et
  //    rien d'autre du domaine, pour proposer « Créer le devis » quand le
  //    client existe déjà (audit réservation 2026-08-26, P1-09) — le même
  //    appariement e-mail que qualiopi/entrees. L'alternative — recopier la
  //    requête hors domaine — aurait créé une seconde vérité sur « ce client
  //    existe-t-il ? », le motif payé quatre fois dans ce dépôt.
  "src/app/[locale]/(admin)/[adminPrefix]/submissions/_v2/SubmissionDetailContent.tsx",
  // ── E-mails : le pied de page porte les mentions légales, qui sont la SSOT
  //    du domaine (`qualiopi/legal`). (contract/invoice retirés avec le système
  //    Booking, 2026-08-26.)
  //
  //    2026-08-31 — l'import du domaine a ÉTÉ DÉPLACÉ, pas ajouté : les mentions
  //    vivaient dans `_layout.tsx` et sont descendues dans `legal-footer.ts`,
  //    module PUR dédié à l'identité légale du pied de page. Le layout garde son
  //    entrée parce qu'il lit toujours le drapeau de certification
  //    (`qualiopi/config/flag`) pour décider s'il affiche le lockup.
  //
  //    Ce que le pied de page emprunte au domaine est exactement DEUX
  //    constantes : `NDA_NUMERO` et `MENTION_NON_AGREMENT`. Elles ne sont pas
  //    décoratives — l'art. L.6352-12 C. trav. interdit de faire état de
  //    l'enregistrement sans préciser qu'il ne vaut pas agrément de l'État, et
  //    les e-mails d'Axion-IA portent des devis, des convocations et des
  //    relances : ce sont des documents commerciaux d'un organisme de
  //    formation. Les recopier hors du domaine créerait la seconde vérité que
  //    ce contrôle existe pour empêcher.
  "src/lib/email/templates/_layout.tsx",
  "src/lib/email/legal-footer.ts",
  // ── Plan de production éditorial en PDF : n'emprunte au domaine que la
  //    PLOMBERIE du rendu — jetons de marque, polices, nettoyage d'espaces,
  //    extraction du texte pour les tests. Aucune lecture métier Qualiopi :
  //    ni session, ni stagiaire, ni indicateur. Ces utilitaires sont logés
  //    dans le domaine sans lui appartenir, comme `revues/sans-commentaires`
  //    plus bas.
  //
  //    ⚠️ Même arbitrage que là-bas : au troisième emprunteur de la plomberie
  //    PDF, la DÉPLACER vers une zone neutre plutôt que d'allonger cette
  //    liste. Trois exceptions pour une même plomberie ne sont plus des
  //    exceptions — c'est un module mal rangé.
  "src/server/editorial/plan-production-pdf.spec.tsx",
  "src/server/editorial/plan-production-pdf.tsx",
  // ── Workers & santé : rétention de preuve d'envoi, alertes.
  "src/server/email/health.ts",
  "src/server/queue/workers/retention-purge-worker.ts",
  // ── Recherche admin : partage le garde d'habilitation `actions/qualiopi/_guards`.
  "src/server/actions/admin-recherche.ts",
  // ── Tests des surfaces ci-dessus. Un test qui ne peut pas importer ce qu'il
  //    teste ne teste rien.
  "src/content/formations/catalog-v2-minutage.test.ts",
  "src/content/formations/modules/enrichissements.test.ts",
  "src/server/admin/dossiers-pipeline.spec.ts",
  "src/server/formateur/echeances-formateur.spec.ts",
  "src/server/formateur/etapes-formateur.spec.ts",
  "src/server/queue/workers/__tests__/envoi-non-parti-aucune-trace.spec.ts",
  "src/server/queue/workers/__tests__/retention-preuve-envoi.spec.ts",
  // Compare le pied de page des e-mails aux SSOT dont il dérive — dont
  // `MENTION_NON_AGREMENT` et `NDA_NUMERO`. C'est le test qui empêche la
  // recopie : il ne peut pas vérifier la dérivation sans lire la source.
  "src/lib/email/legal-footer.spec.ts",
  // ── Gardes CI qui empruntent `sansCommentaires` au domaine.
  //
  //    Ce n'est PAS une dependance metier : `revues/sans-commentaires` est un
  //    utilitaire de TEXTE (retirer les commentaires d'une source avant de la
  //    fouiller), qui se trouve loge dans le domaine sans lui appartenir. Un
  //    cliquet statique en a besoin pour la meme raison que les autres : sans
  //    lui, il trouve ses propres commentaires et rend un vert imaginaire --
  //    defaut deja paye ici.
  //
  //    L'alternative etait de recopier le predicat, comme le font deja une
  //    dizaine de specs qui le redefinissent localement. C'est precisement ce
  //    qu'il ne faut pas faire : un predicat recopie diverge toujours, et ce
  //    depot l'a paye quatre fois. On assume donc l'arete, ecrite ici.
  //
  //    ⚠️ Le jour ou un troisieme emprunteur apparait, DEPLACER l'utilitaire
  //    vers une zone neutre (`src/lib/`) plutot que d'allonger cette liste :
  //    trois exceptions pour un meme symbole ne sont plus des exceptions.
  // ── Garde du PowerPoint projeté. Elle DOIT importer `TOUS_SUPPORT_TYPES`
  //    depuis le domaine : c'est la valeur qu'elle surveille. Lire la liste
  //    par une regex sur le fichier source serait plus faible — un extracteur
  //    trop malin nous a déjà menti trois fois le 2026-08-25 (un `[a-z-]+`
  //    aveugle aux chiffres, un comptage sur une base périmée, un filtre qui
  //    écartait un prérequis). La constante vit dans `supports/types.ts`, un
  //    module PUR : l'import ne tire aucun runtime, seulement une donnée.
  "tests/unit/qualiopi/le-ppt-projete-nest-jamais-genere.spec.ts",
  "tests/unit/ci/origine-de-prod-jamais-en-repli.spec.ts",
]);

/**
 * Marqueurs = symboles exportés UNIQUES du module qualiopi. S'ils apparaissent
 * hors zone, c'est une vraie fuite (pas un faux positif sur le mot « formation »
 * qui est omniprésent dans le repo). On NE marque PAS sur "qualiopi"/"formation"
 * génériques.
 */
const QUALIOPI_MARKERS: ReadonlyArray<string> = [
  "getQualiopiConfig",
  "setQualiopiConfig",
  "getAllQualiopiConfig",
  "logQualiopiActivity",
  "isQualiopiPublicDisclosureEnabled",
  "QUALIOPI_BRAND_COLORS",
  "QUALIOPI_CONFIG_REGISTRY",
  "QUALIOPI_BRAND_FONTS",
  "@/server/qualiopi/",
  "@/server/actions/qualiopi/",
];

/**
 * Une ligne qui crée une ARÊTE DE DÉPENDANCE — la seule chose que cette garde
 * ait à surveiller.
 *
 * ⚠️ Ne PAS tester `^\s*import` : un import multi-lignes porte son chemin sur
 * la ligne `} from "…"`, qui ne commence pas par `import`. Ce raccourci fait
 * passer de VRAIS imports pour de simples mentions — vérifié le 2026-08-24 sur
 * `src/app/sitemap.ts`, `equipe/[slug]/page.tsx` et `echeances-formateur.ts`.
 */
const EST_ARETE = /\bfrom\s*["']|\brequire\s*\(|\bimport\s*\(/;

function isPathAllowed(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return ALLOWED_PATTERNS.some((re) => re.test(normalized));
}

function looksLikeQualiopi(filePath: string, content: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  if (isPathAllowed(normalized)) return false;
  // Docs / audit / skill / markdown : commentaires textuels OK.
  if (/^_AUDIT\//.test(normalized) || /\.md$/.test(normalized) || /^\.claude\//.test(normalized)) {
    return false;
  }
  // Modèles qualiopi attendus dans le schéma ; env vars qualiopi gérées à part.
  if (normalized === "prisma/schema.prisma") return false;
  if (normalized === "src/env.ts") return false;

  // 🔴 2026-08-24 — c'était `QUALIOPI_MARKERS.some((m) => content.includes(m))`.
  // La garde marquait donc sur une simple MENTION : un workflow YAML qui cite un
  // symbole en commentaire, une migration SQL, des specs qui passent un chemin à
  // `path.join()` pour LIRE le fichier — 9 des 58 signalements du jour. Une garde
  // qui interdit de CITER un symbole interdit de le documenter, et ce dépôt
  // documente ses correctifs en nommant ce qu'ils corrigent.
  // Ce qu'on surveille est l'arête de dépendance, pas le vocabulaire.
  return content
    .split("\n")
    .some((ligne) => EST_ARETE.test(ligne) && QUALIOPI_MARKERS.some((m) => ligne.includes(m)));
}

function listFiles(mode: "staged" | "all"): string[] {
  const cmd =
    mode === "staged" ? "git diff --cached --name-only --diff-filter=ACMR" : "git ls-files";
  try {
    return execSync(cmd, { encoding: "utf8" })
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  const mode = process.argv.includes("--staged") ? "staged" : "all";
  const files = listFiles(mode);
  const violations: Array<{ file: string; reason: string }> = [];

  // Exceptions effectivement utilisées pendant ce passage — sert à détecter
  // celles qui ne servent plus (voir plus bas).
  const exceptionsUtilisees = new Set<string>();

  for (const f of files) {
    if (isPathAllowed(f)) continue;
    try {
      const content = await import("node:fs").then((m) =>
        m.promises.readFile(path.join(process.cwd(), f), "utf8"),
      );
      if (!looksLikeQualiopi(f, content)) continue;

      const normalized = f.replace(/\\/g, "/");
      if (CONSOMMATEURS_ASSUMES.has(normalized)) {
        exceptionsUtilisees.add(normalized);
        continue;
      }
      violations.push({
        file: f,
        reason: "Importe le domaine qualiopi hors des zones dédiées (cloisonnement).",
      });
    } catch {
      // binaire / illisible → skip
    }
  }

  // ── La liste d'exceptions doit RÉTRÉCIR ──────────────────────────────────
  // Une exception qui ne correspond plus à rien est une garde desserrée pour
  // rien : elle laisserait rentrer, sans un mot, un futur fichier portant le
  // même chemin. On ne peut le vérifier qu'en mode « all » : en `--staged`, la
  // plupart des fichiers ne sont simplement pas dans le lot examiné.
  const perimees =
    mode === "all" ? [...CONSOMMATEURS_ASSUMES].filter((f) => !exceptionsUtilisees.has(f)) : [];

  if (violations.length === 0 && perimees.length === 0) {
    console.log(
      `✅ [qualiopi:isolation-check] OK — ${files.length} fichiers scannés, ` +
        `0 violation, ${exceptionsUtilisees.size} consommateurs assumés (tous encore actifs).`,
    );
    process.exit(0);
  }

  if (violations.length > 0) {
    console.error(`❌ [qualiopi:isolation-check] ${violations.length} violation(s) :`);
    for (const v of violations) console.error(`  - ${v.file} : ${v.reason}`);
    console.error(
      "\n  Ce fichier importe le domaine Qualiopi depuis une surface qui ne le faisait pas.\n" +
        "  Deux issues, et une seule est un choix :\n" +
        "    · le code appartient au domaine  → le déplacer dans une zone dédiée ;\n" +
        "    · la surface le consomme vraiment → l'ajouter à CONSOMMATEURS_ASSUMES\n" +
        "      dans ce fichier, AVEC sa raison. Ce n'est pas une formalité : c'est la\n" +
        "      trace qu'on a décidé d'élargir la surface qui dépend du domaine.",
    );
  }

  if (perimees.length > 0) {
    console.error(
      `\n❌ [qualiopi:isolation-check] ${perimees.length} exception(s) PÉRIMÉE(S) — ` +
        "ces fichiers n'importent plus le domaine (ou n'existent plus) :",
    );
    for (const f of perimees) console.error(`  - ${f}`);
    console.error(
      "\n  Les retirer de CONSOMMATEURS_ASSUMES. Une exception qu'on garde « au cas où »\n" +
        "  rouvre la porte en silence au prochain fichier qui portera ce chemin.",
    );
  }

  process.exit(1);
}

main().catch((err) => {
  console.error("[qualiopi:isolation-check] FATAL:", err);
  process.exit(2);
});
