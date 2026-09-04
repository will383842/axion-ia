import { describe, it, expect } from "vitest";
import {
  buildAdminNav,
  findActiveNavHref,
  ADMIN_NAV_GROUP_LABELS,
  ADMIN_NAV_GROUP_ORDER,
  QUALIOPI_POLE_ORDER,
  QUALIOPI_POLE_LABELS,
  DOCUMENTS_POLE_ORDER,
  DOCUMENTS_POLE_LABELS,
  GROUP_POLE_ORDER,
  GROUP_POLE_LABELS,
} from "./admin-nav";

describe("buildAdminNav SSOT", () => {
  it("returns 164 items (snapshot count — +5 console chatbot ADR-CB-07, +20 Qualiopi T0-T16, +1 RGPD T19, +1 Formateurs R9, +1 Stagiaires R10, +1 Config Qualiopi, +2 carrières, +6 Documents interventions dont Importer un kit, +3 Coaching 1-to-1, content_gen refonte UX 2026-06-16 = 30 items en 6 pôles, +1 Observatoire IA suivi 2026-06-17, +2 sous-items Documents interventions #125 (implementations/sites-web) non répercutés sur ce snapshot, +3 Salle de presse #140 (Vue d'ensemble · Communiqués · Kit média), +1 Couverture médias 2026-06-23 (CRUD retombées presse) — réconciliation du snapshot resté à 110 ; /orchestrator et /queue fusionnés → pas d'entrée nav, redirections seules ; +1 Photos hero Unsplash 2026-06-24 (rattrapage backfill content-gen/publier) ; +1 Backfill citations 2026-06-26 (content-gen/publier, rattrapage bloc Sources) ; +1 Actualités (news RSS) 2026-07-01 (pôle Lancer, contrôle volume news/jour)) ; +1 Annonces recrutement 2026-08-23 (pôle ops, provenance des candidatures commerciales) ; +1 Tiime 2026-08-24 (pôle Finances, LIEN EXTERNE vers notre plateforme agréée de facturation électronique) ; +1 Dépliant formations 2026-08-25 (sous-onglet des Imprimés, dérivé de IMPRIMES) ; −1 Entrées récentes 2026-08-27 (quatrième porte pour lire une demande — redirige en 308 vers la Boîte de réception) ; +1 Pilotage du recrutement 2026-09-04 (vue de Candidatures livrée par #968, jusque-là sans entrée de menu) ; +1 Liens de campagne 2026-09-04 (fabrique le lien UTM à diffuser — « Annonces » dit ce qu'il a rapporté, celle-ci le construit)", () => {
    const items = buildAdminNav("admin-test-prefix");
    // Base 131 − 14 module Prospection retiré 2026-07-08 (#278) = 117.
    // Refonte messagerie 2026-07-09 : 3 groupes distincts sortis de « main » /
    // des onglets internes — Contacts (messages écrits : Tous, Clients, Presse,
    // Partenariats, Investisseurs), Rendez-vous (Appels Calendly), Recrutement
    // (Candidatures aux offres + Messages recrutement). +6 items vs base 117 = 123.
    // 2026-07-12 : groupe Recrutement FUSIONNÉ dans Contacts (décision Will) —
    // mêmes 2 items, déplacés de groupe, ±0.
    // +2 (2026-07-09) : « RV téléphonique » (liste unifiée) + « Calendrier RDV »
    // dans le groupe Rendez-vous. = 125.
    // +1 (2026-07-09) : « Planning » — calendrier unifié des prestations
    // (formations collectives + coaching 1-to-1), groupe main / sous-groupe
    // agenda. Distinct du « Calendrier » booking, vestige masqué. = 126.
    // +1 (2026-07-09) : « Charge formateurs » — taux d'occupation mensuel par
    // formateur (cockpit de pilotage). = 127.
    // +1 (2026-07-09) : « Prévisionnel » — CA planifié/réalisé, encaissements
    // attendus, reste à facturer, impayés (cockpit de pilotage). = 128.
    // +1 (2026-07-09) : « Rémunération formateurs » — run mensuel, relevés
    // d'honoraires et anomalies (pilier C du commissionnement). Groupe qualiopi,
    // sous-groupe formations, à côté de « Formateurs ». = 129.
    // +2 (2026-07-09) : « Hub de pilotage » (signaux des 3 piliers : sessions non
    // staffées, conflits, formateurs non conformes en mission, surcharge, relevés
    // en attente, anomalies) et « Timeline ressources » (formateur × jours du
    // mois). Groupe main / sous-groupe agenda, avec les autres vues cockpit. = 131.
    // +1 (2026-07-10) : « Pipeline commercial » — entonnoir Devis → Session →
    // Facture, âge des affaires bloquées et fuites nommées. 5e vue du pilier A. = 132.
    // +1 (2026-07-10) : « Audits IA » — 3ᵉ type de prestation (missions d'audit
    // affectables + rémunérées), groupe qualiopi / sous-groupe formations. = 133.
    // +1 (2026-07-12) : « Facturation (Hub) » — pilotage unifié des 5 activités
    // (page gatée FACTURATION_HUB_ENABLED), groupe qualiopi / commercial. = 134.
    // +1 (2026-07-13, Lot 2) : « Moyens pédagogiques » — inventaire off.17/18/19,
    // groupe qualiopi / registres (snapshot non réconcilié au merge). = 135.
    // +1 (2026-07-13, Lot 3) : « Entrées récentes » — pont appel/contact → CRM,
    // groupe qualiopi (snapshot non réconcilié au merge). = 136.
    // +1 (2026-07-13, Lot 4) : « Incidents » — registre des incidents (pilotage),
    // groupe qualiopi / sous-groupe registres. = 137.
    // +1 (2026-07-13, Lot 5) : « Barèmes OPCO » — référentiel OPCO centralisé et
    // versionné, groupe qualiopi / sous-groupe commercial. = 138.
    // +1 (2026-07-13, Lot 6.3) : « Cockpit financier » — marge par session/formation,
    // heures & coût par formateur, groupe qualiopi / sous-groupe formations. = 139.
    // +2 (2026-07-13) : « Facture directe » (facturation/new) + « Plans récurrents »
    // (facturation/plans), écrans du Hub facturation, groupe qualiopi / commercial. = 141.
    // +1 (2026-07-18) : « QR codes & liens » — QR dynamiques pilotables
    // (/qr/<slug> → redirection éditable + scans), groupe ops. = 142.
    // +1 (2026-07-21) : « Demandes de podcast » — demandes de tournage déposées
    // sur la page publique /podcast (+ QR du flyer), groupe contacts. = 143.
    // +1 (2026-07-26, audit certification F60) : « Emails à valider » — corbeille
    // de relecture des emails commerciaux avant envoi (relance d'impayé, devis,
    // facture, contrat). Groupe qualiopi / sous-groupe administration, à côté
    // des Alertes. = 144.
    // −1 (2026-07-29, refonte « Boîte de réception ») : les groupes Contacts (8)
    // et Rendez-vous (3) — 11 entrées pour 4 objets réels — deviennent un seul
    // groupe de 10 entrées : 5 canaux visibles (Tout, Appels réservés, Messages,
    // Candidatures, Demandes de podcast) + 5 vues filtrées de Submission
    // conservées hors sidebar (`parent`) pour ⌘K et les favoris. Les 3 anciennes
    // routes RDV deviennent de simples redirections et sortent de la nav. = 143.
    // +1 (2026-08-01, refonte console phase 1) : « 🔴 À traiter » — la porte
    // d'entrée de la console Qualiopi (signatures en attente, e-mails à valider,
    // relances, alertes), pôle a_traiter en tête du groupe. = 144.
    // +1 (2026-08-01, refonte console phase 2) : « 📁 Dossiers (pipeline) » — la
    // vue « où en est chaque affaire ? », une ligne par dossier à statut dérivé,
    // pôle dossiers juste après À traiter. = 145.
    // −10 (2026-08-01, audit UX phase 2 — structure) :
    //   −1 « Vue d'ensemble » (/qualiopi) : doublon du pipeline, route → 308.
    //   −1 « Conformité » (/qualiopi/conformite) : fusionnée dans « Conformité
    //      & mode auditeur » (même matrice sous deux entrées), route → 308.
    //   −7 module Booking mort (Calendrier, Réservations, Options 48h, Devis,
    //      Factures, Paiements, Échéanciers) : même masqués par `parent`, ils
    //      polluaient ⌘K sous les mêmes noms que les vrais modules — routes →
    //      308 vers planning/dossiers/devis Qualiopi/hub facturation/plans.
    //   −1 « Base de connaissances (consultation) » (kb-readonly) : doublon de
    //      « Connaissances », route → 308. = 135.
    // +1 (2026-08-02) : Rapprochement bancaire (import relevé Finom, groupe
    // finances) = 136.
    // +1 (2026-08-05, vente phase 0) : « Nouvelle vente » — wizard guidé
    // client → formation → devis → session → checklist, en tête du pôle
    // Catalogue & vente (groupe qualiopi). = 137.
    // +2 (2026-08-14, catégories de Messages remontées dans la sidebar) :
    // « Conférences » et « Autres » n'existaient que comme filtre interne à
    // l'écran Messages ; elles ont désormais leur route, comme les 6 autres
    // catégories. = 143.
    // +1 (2026-08-14, lot L5 observabilité) : « Synchro CRM » (groupe ops) —
    // santé de l'outbox site → Axion CRM Pro : dernier succès, file d'attente,
    // abandons définitifs, écart de réconciliation, rejeu d'une ligne. = 144.
    // +3 (2026-08-15, sous-onglets QR du catalogue remontés dans la sidebar) :
    // « QR du catalogue », « QR avis du catalogue » et « QR dans le catalogue »
    // remplacent la rangée de chips qui vivait dans l'en-tête de l'écran QR.
    // Chacun pointe une vraie route enfant : usePathname ne porte pas la query
    // string, donc des entrées en `?category=` n'auraient jamais été
    // surlignées. = 147.
    // +1 (2026-08-16, « Catalogue imprimé ») : écran de relecture des faits du
    // livre — prix, durée, format — avant tirage KDP. Le catalogue papier est
    // distribué en main propre, un prix faux ne se corrige pas ; depuis le
    // branchement SSOT (scripts/export-catalogue-kdp.ts) ces valeurs viennent
    // du site, cet écran les montre telles qu'elles partiront à l'impression.
    // Niveau 1 et non sous-onglet des QR : les QR ne sont qu'un composant du
    // livre. = 148.
    // +1 (2026-08-17, « Carte de visite & divers ») : la catégorie `general`
    // existait dans le SSOT `QR_CATEGORIES` depuis l'origine, mais n'avait NI
    // page NI entrée ici — les entrées de niveau 2 étaient recopiées à la main,
    // et la copie avait divergé. Les deux QR de la carte de visite (`vc`, `wa`)
    // n'avaient donc aucun tiroir et ne se voyaient que dans la liste racine,
    // parmi 45 QR de catalogue. Les 4 sous-onglets DÉRIVENT désormais de
    // `QR_CATEGORIES` : ce décompte suivra automatiquement toute catégorie
    // ajoutée, et `categories.spec.ts` refuse une route sans page. = 149.
    // 2026-08-17 : 149 → 152. L'onglet isolé « Catalogue imprimé » est remplacé
    // par le hub « Imprimés » et ses trois sous-onglets (catalogue A4, flyer A5,
    // livre KDP), soit −1 +4 = +3. Les sous-onglets sont DÉRIVÉS de `IMPRIMES`
    // (src/content/imprimes.ts) : ce décompte suivra tout imprimé ajouté.
    // +1 (2026-08-18, « Aperçus de partage », sous « Toutes les URLs ») :
    // recensement OG du 2026-08-17. Aucun écran ne montrait ce que le site sert
    // quand on partage un lien — `site_routes` connaissait le titre, la meta
    // description et le H1, et rien de la vignette. L'entrée vit sous
    // l'explorateur d'URLs et non dans `settings/` : même inventaire, même
    // inspecteur, même RBAC. = 153.
    // +7 (2026-08-26, groupe « Société & conformité ») : le dossier de
    // référencement fournisseur — vue d'ensemble, identité, et cinq rubriques
    // de pièces (légales, organisme de formation, commercial, audit & méthode,
    // RGPD & sécurité). Distinct du groupe « Documents », qui porte les kits de
    // prestation et des fichiers sans date de péremption ; ici l'essentiel des
    // pièces périme, et c'est ce que l'écran surveille. = 163.
    //
    // 🔴 −1 le 2026-08-27 : « Entrées récentes » retirée (quatrième porte pour
    // lire une demande, cf. UNE-SEULE-PORTE.md). = 162.
    // +1 (2026-09-04, « Pilotage du recrutement », indenté sous Candidatures) :
    // l'écran existait depuis la PR #968 et n'était atteignable QUE par un
    // bouton à l'intérieur de l'écran Candidatures — donc introuvable pour qui
    // ne l'ouvrait pas d'abord. Ce compteur ne l'aurait jamais signalé : il
    // compte les entrées de menu, pas les routes sans entrée. = 165.
    expect(items.length).toBe(165);
  });

  it("prefixes all INTERNAL hrefs with /fr/<adminPrefix>", () => {
    // 🔴 2026-08-24 — cet invariant a rougi à l'ajout du premier lien EXTERNE
    // (Tiime, notre plateforme agréée). Il n'avait pas tort : jusque-là, toute
    // entrée de nav était une route de cette application. On ne l'affaiblit
    // donc pas — on le rend CONSCIENT des deux natures, et on exige de chacune
    // ce qui lui correspond.
    const items = buildAdminNav("admin-test-prefix");
    const internes = items.filter((it) => it.external !== true);

    // Contre-témoin : si `external` était posé partout par erreur, la boucle
    // ci-dessous n'examinerait plus rien et passerait au vert.
    expect(
      internes.length,
      "presque toutes les entrées doivent rester INTERNES — un `external` posé " +
        "en masse viderait cet invariant de sa substance",
    ).toBeGreaterThan(items.length - 10);

    for (const it of internes) {
      expect(it.href.startsWith("/fr/admin-test-prefix"), `href interne : ${it.href}`).toBe(true);
    }
  });

  it("les liens EXTERNES sont des URL absolues https, jamais des routes internes", () => {
    // Le pendant du test ci-dessus. Un `external: true` posé sur une route
    // interne produirait un `target="_blank"` sur notre propre application —
    // et un `http://` en clair exposerait la navigation.
    const externes = buildAdminNav("admin-test-prefix").filter((it) => it.external === true);

    for (const it of externes) {
      expect(it.href.startsWith("https://"), `lien externe : ${it.href}`).toBe(true);
      expect(
        it.href.startsWith("/fr/admin-test-prefix"),
        `\`external: true\` sur une route interne : ${it.href}`,
      ).toBe(false);
    }
  });

  it("covers all groups in ADMIN_NAV_GROUP_ORDER", () => {
    const items = buildAdminNav("admin-test-prefix");
    const groups = new Set(items.map((it) => it.group));
    for (const g of ADMIN_NAV_GROUP_ORDER) {
      expect(groups.has(g)).toBe(true);
    }
  });

  it("ADMIN_NAV_GROUP_LABELS covers all groups", () => {
    for (const g of ADMIN_NAV_GROUP_ORDER) {
      expect(ADMIN_NAV_GROUP_LABELS[g]).toBeDefined();
    }
  });

  it("has unique hrefs (no drift)", () => {
    const items = buildAdminNav("p");
    const hrefs = items.map((it) => it.href);
    const unique = new Set(hrefs);
    expect(unique.size).toBe(hrefs.length);
  });

  // Refonte UX 2026-07-08 : les onglets Qualiopi sont regroupés en 5 pôles
  // (accordéon sidebar). On verrouille que CHAQUE item qualiopi porte un pôle
  // valide — sinon il disparaîtrait du rendu en pôles (groupItems.filter).
  it("chaque item qualiopi porte un subGroup dans QUALIOPI_POLE_ORDER", () => {
    const items = buildAdminNav("p").filter((it) => it.group === "qualiopi");
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(it.subGroup, `« ${it.label} » sans pôle`).toBeDefined();
      expect(QUALIOPI_POLE_ORDER as ReadonlyArray<string>).toContain(it.subGroup);
    }
  });

  it("QUALIOPI_POLE_LABELS couvre tous les pôles de QUALIOPI_POLE_ORDER", () => {
    for (const p of QUALIOPI_POLE_ORDER) {
      expect(QUALIOPI_POLE_LABELS[p]).toBeDefined();
    }
  });

  // Refonte UX 2026-07-08 : le groupe Documents est découpé en 2 pôles.
  it("chaque item documents-interventions porte un subGroup dans DOCUMENTS_POLE_ORDER", () => {
    const items = buildAdminNav("p").filter((it) => it.group === "documents-interventions");
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(it.subGroup, `« ${it.label} » sans pôle`).toBeDefined();
      expect(DOCUMENTS_POLE_ORDER as ReadonlyArray<string>).toContain(it.subGroup);
    }
  });

  it("DOCUMENTS_POLE_LABELS couvre tous les pôles de DOCUMENTS_POLE_ORDER", () => {
    for (const p of DOCUMENTS_POLE_ORDER) {
      expect(DOCUMENTS_POLE_LABELS[p]).toBeDefined();
    }
  });

  // Garde générique : pour TOUT groupe déclaré dans GROUP_POLE_ORDER
  // (main, content_gen, qualiopi, documents, image-bank), chaque item du groupe
  // doit porter un subGroup listé ET étiqueté — sinon il disparaît du rendu en
  // pôles (groupItems.filter). Couvre tous les groupes à pôles d'un coup.
  it("tout item d'un groupe à pôles porte un subGroup valide + étiqueté", () => {
    const items = buildAdminNav("p");
    for (const [group, poleOrder] of Object.entries(GROUP_POLE_ORDER)) {
      const groupItems = items.filter((it) => it.group === group);
      expect(groupItems.length, `groupe ${group} vide`).toBeGreaterThan(0);
      const labels = GROUP_POLE_LABELS[group as keyof typeof GROUP_POLE_LABELS];
      for (const it of groupItems) {
        expect(it.subGroup, `« ${it.label} » (${group}) sans pôle`).toBeDefined();
        expect(poleOrder as ReadonlyArray<string>).toContain(it.subGroup);
        expect(labels?.[it.subGroup as string], `pôle ${it.subGroup} sans libellé`).toBeDefined();
      }
    }
  });

  // Refonte UX 2026-07-08 : le module Prospection interne est retiré de la nav
  // (doublon avec l'appli externe Axion CRM Pro ; retiré aussi du type
  // `AdminNavGroup` par #278 → le type garantit déjà son absence). Verrou
  // runtime complémentaire (cast string car "prospection" n'est plus dans le type).
  it("le groupe prospection n'est plus dans la nav", () => {
    const items = buildAdminNav("p");
    expect(items.some((it) => (it.group as string) === "prospection")).toBe(false);
    expect(ADMIN_NAV_GROUP_ORDER as ReadonlyArray<string>).not.toContain("prospection");
  });

  // Fusion 2026-07-12 (décision Will) : le groupe « Recrutement » est fusionné
  // dans « Contacts » — tout ce qui entre par formulaire vit au même endroit.
  // Les candidatures aux offres sont déplacées sous /contacts/candidatures.
  it("le recrutement est fusionné dans le groupe contacts", () => {
    const items = buildAdminNav("p");
    expect(items.some((it) => (it.group as string) === "recrutement")).toBe(false);
    expect(ADMIN_NAV_GROUP_ORDER as ReadonlyArray<string>).not.toContain("recrutement");
    const candidatures = items.find((it) => it.label === "Candidatures");
    expect(candidatures?.group).toBe("contacts");
    expect(candidatures?.href).toBe("/fr/p/contacts/candidatures");
    // Libellé raccourci le 2026-08-14 : « Recrutement » est désormais indenté
    // sous « Messages », l'indentation dit ce que le préfixe disait.
    expect(items.find((it) => it.label === "Recrutement")?.group).toBe("contacts");
  });

  // ── Refonte « Boîte de réception » 2026-07-29 ───────────────────────────
  //
  // Ces tests verrouillent la décision, pas la mise en forme : le problème
  // corrigé (une entrée de sidebar par TABLE plutôt que par canal d'entrée)
  // revient tout seul dès qu'on ajoute un écran sans y penser.
  describe("boîte de réception unifiée", () => {
    const items = buildAdminNav("p");
    const visible = items.filter((it) => it.group === "contacts" && it.parent == null);

    it("le groupe « rendez-vous » n'existe plus", () => {
      expect(items.some((it) => (it.group as string) === "rendez-vous")).toBe(false);
      expect(ADMIN_NAV_GROUP_ORDER as ReadonlyArray<string>).not.toContain("rendez-vous");
      expect(ADMIN_NAV_GROUP_LABELS["contacts"]).toBe("Boîte de réception");
    });

    // 🔴 Révision Will 2026-08-14 : les catégories de Messages REVIENNENT dans
    // la sidebar, indentées sous leur parent (`navLevel: 2`), au lieu d'être un
    // filtre interne à l'écran. Ce qui était banni le 2026-07-29, c'est une
    // entrée par TABLE au même rang que les canaux — pas une hiérarchie qui
    // montre à quel canal chaque vue appartient. Les canaux RACINE restent donc
    // au nombre de 4 (+ Messages), et tout ce qui est indenté est une catégorie.
    it("expose 5 canaux racine, un par type d'entrée réel", () => {
      expect(visible.filter((it) => it.navLevel == null).map((it) => it.href)).toEqual([
        "/fr/p/contacts",
        "/fr/p/contacts/appels",
        "/fr/p/contacts/messages",
        "/fr/p/contacts/candidatures",
      ]);
    });

    // 🔴 2026-09-04 — cette assertion s'appelait « les 8 catégories de Messages »
    // et lisait `navLevel === 2`. Les deux ne sont pas la même chose : `navLevel`
    // dit « indenté », jamais « indenté SOUS QUI ». Tant que Messages était le
    // seul canal à avoir des enfants, la confusion ne coûtait rien ; « Pilotage
    // du recrutement » (enfant de Candidatures) la rend fausse.
    //
    // La correction ne se contente pas d'allonger la liste : elle BORNE chaque
    // enfant entre son canal et le canal suivant. L'ancienne version ne
    // vérifiait qu'une borne basse (« après Messages ») — une catégorie de
    // Messages glissée sous Candidatures serait passée au vert alors qu'elle
    // paraîtrait appartenir aux candidatures.
    it("chaque entrée indentée est rendue sous LE canal auquel elle appartient", () => {
      const enfants = visible.filter((it) => it.navLevel === 2);
      expect(enfants.map((it) => it.label)).toEqual([
        "Clients",
        "Presse",
        "Partenariats",
        "Investisseurs",
        "Conférences",
        "Recrutement",
        "Podcast",
        "Autres",
        "Pilotage du recrutement",
      ]);

      // La sidebar est une liste à plat que seule l'indentation hiérarchise :
      // un enfant paraît appartenir au dernier canal racine qui le précède.
      const racines = visible
        .map((it, index) => ({ it, index }))
        .filter(({ it }) => it.navLevel == null);
      const canalDe = (enfant: (typeof visible)[number]) =>
        racines.filter(({ index }) => index < visible.indexOf(enfant)).at(-1)?.it.href;

      for (const enfant of enfants.filter((it) => it.label !== "Pilotage du recrutement")) {
        expect(canalDe(enfant), enfant.label).toBe("/fr/p/contacts/messages");
      }
      expect(canalDe(enfants.at(-1)!), "Pilotage du recrutement").toBe(
        "/fr/p/contacts/candidatures",
      );
    });

    // Le cœur du problème d'origine : trois entrées pour la même table
    // `calendly_events`, dont la première renvoyait au détail de la troisième.
    it("les 3 anciens onglets RDV ont disparu de la nav", () => {
      for (const gone of [
        "/fr/p/contacts/rendez-vous",
        "/fr/p/contacts/rendez-vous/calendrier",
        "/fr/p/contacts/calendly",
      ]) {
        expect(
          items.some((it) => it.href === gone),
          gone,
        ).toBe(false);
      }
    });

    // Les URLs des vues filtrées n'ont PAS bougé en revenant dans la sidebar :
    // ⌘K, les favoris et les liens externes déjà posés restent valides. C'est
    // tout l'intérêt de `navLevel` — indenter sans déplacer.
    it("les vues filtrées de Submission gardent leurs URLs historiques", () => {
      for (const href of [
        "/fr/p/contacts/clients",
        "/fr/p/contacts/presse",
        "/fr/p/contacts/partenariats",
        "/fr/p/contacts/investisseurs",
        "/fr/p/contacts/commercial",
      ]) {
        const hit = items.find((it) => it.href === href);
        expect(hit, href).toBeDefined();
        expect(hit?.navLevel, href).toBe(2);
        expect(hit?.parent, href).toBeUndefined();
      }
    });

    // « Tout » est un préfixe de tous les autres : sans priorité au préfixe le
    // plus long, chaque sous-page surlignerait « Tout » dans la sidebar.
    it("les sous-pages ne rebasculent pas sur « Tout »", () => {
      expect(findActiveNavHref(items, "/fr/p/contacts")).toBe("/fr/p/contacts");
      expect(findActiveNavHref(items, "/fr/p/contacts/appels")).toBe("/fr/p/contacts/appels");
      expect(findActiveNavHref(items, "/fr/p/contacts/appels/abc123")).toBe(
        "/fr/p/contacts/appels",
      );
      expect(findActiveNavHref(items, "/fr/p/contacts/messages/xyz")).toBe(
        "/fr/p/contacts/messages",
      );
    });
  });
});

describe("findActiveNavHref — résolution sidebar (anti-rebascule)", () => {
  const items = buildAdminNav("p");
  const base = "/fr/p";
  const groupOf = (href: string | null) => items.find((it) => it.href === href)?.group ?? null;

  it("null pathname → null", () => {
    expect(findActiveNavHref(items, null)).toBeNull();
  });

  it("racine admin résout le Tableau de bord, pas une sous-page", () => {
    expect(findActiveNavHref(items, base)).toBe(base);
    expect(groupOf(findActiveNavHref(items, base))).toBe("main");
  });

  // ── Bug 2026-06-23 : clic « Communiqués » / « Kit média » rebasculait sur
  //    « Activité quotidienne » (groupe main) car ces routes ne matchaient
  //    aucun item en exact. On verrouille : chaque route presse (page ET
  //    sous-éditeur) reste dans le groupe « presse ».
  it("pages de liste presse → item exact + groupe presse", () => {
    for (const sub of [
      "/presse",
      "/presse/communiques",
      "/presse/kit-media",
      "/presse/couverture",
    ]) {
      const active = findActiveNavHref(items, `${base}${sub}`);
      expect(active).toBe(`${base}${sub}`);
      expect(groupOf(active)).toBe("presse");
    }
  });

  it("éditeurs presse (sans entrée de nav) → rattachés au parent, groupe presse", () => {
    const cases: Array<[string, string]> = [
      ["/presse/communiques/nouveau", "/presse/communiques"],
      ["/presse/communiques/abc-123", "/presse/communiques"],
      ["/presse/kit-media/upload", "/presse/kit-media"],
      ["/presse/couverture/nouveau", "/presse/couverture"],
      ["/presse/couverture/abc-123", "/presse/couverture"],
    ];
    for (const [path, expectedParent] of cases) {
      const active = findActiveNavHref(items, `${base}${path}`);
      expect(active).toBe(`${base}${expectedParent}`);
      expect(groupOf(active)).toBe("presse");
      // Surtout PAS le Tableau de bord (racine) ni le groupe main.
      expect(active).not.toBe(base);
      expect(groupOf(active)).not.toBe("main");
    }
  });

  it("le plus long préfixe gagne (jamais le parent court)", () => {
    const active = findActiveNavHref(items, `${base}/presse/communiques/nouveau`);
    expect(active).toBe(`${base}/presse/communiques`);
    expect(active).not.toBe(`${base}/presse`);
  });
});

// ─── Audit UX phase 2 (2026-08-01) — verrous de non-régression ──────────────
describe("phase 2 structure — verrous", () => {
  const items = buildAdminNav("p");
  const base = "/fr/p";
  const hrefs = new Set(items.map((it) => it.href));

  it("les 7 routes booking mortes ne sont plus dans la nav (ni sidebar ni ⌘K)", () => {
    for (const dead of [
      "/calendrier",
      "/reservations",
      "/options",
      "/devis",
      "/factures",
      "/paiements",
      "/echeanciers",
    ]) {
      expect(hrefs.has(`${base}${dead}`), `${dead} devrait avoir disparu`).toBe(false);
    }
  });

  it("🔴 « Entrées récentes » ne revient pas — une seule porte pour lire une demande", () => {
    // Retirée le 2026-08-27. Elle refaisait l'union « appels + messages » que la
    // Boîte de réception fait déjà : quatre portes pour un seul geste, dont deux
    // lectures des mêmes tables sans moyen de départager quand elles divergent.
    //
    // ⚠️ Ce test verrouille les DEUX sens. Sans la seconde assertion, retirer
    // AUSSI la Boîte de réception le laisserait vert : « aucune porte » passe
    // exactement comme « une seule porte ».
    expect(
      hrefs.has(`${base}/qualiopi/entrees`),
      "« Entrées récentes » est revenue dans la nav — voir UNE-SEULE-PORTE.md",
    ).toBe(false);
    expect(
      hrefs.has(`${base}/contacts`),
      "la porte CANONIQUE (Boîte de réception) a disparu : il n'en reste aucune",
    ).toBe(true);
  });

  it("les doublons fusionnés (Vue d'ensemble, Conformité, kb-readonly) sont sortis de la nav", () => {
    expect(hrefs.has(`${base}/qualiopi`)).toBe(false);
    expect(hrefs.has(`${base}/qualiopi/conformite`)).toBe(false);
    expect(hrefs.has(`${base}/content-gen/kb-readonly`)).toBe(false);
    // Les cibles canoniques, elles, existent toujours.
    expect(hrefs.has(`${base}/qualiopi/dossiers`)).toBe(true);
    expect(hrefs.has(`${base}/qualiopi/mode-auditeur`)).toBe(true);
    expect(hrefs.has(`${base}/connaissances`)).toBe(true);
  });

  it("pôle villes : 3 entrées visibles, 4 absorbées rattachées à la couverture", () => {
    const villes = items.filter((it) => it.group === "content_gen" && it.subGroup === "villes");
    const visibles = villes.filter((it) => it.parent == null).map((it) => it.href);
    expect(visibles).toEqual([
      `${base}/content-gen/coverage-map`,
      `${base}/content-gen/cities-order`,
      `${base}/content-gen/city-coverage`,
    ]);
    const absorbees = villes.filter((it) => it.parent != null);
    expect(absorbees.map((it) => it.href).sort()).toEqual(
      [
        `${base}/content-gen/cities-coverage`,
        `${base}/content-gen/city-equity`,
        `${base}/content-gen/geo`,
        `${base}/content-gen/geo/coverage-table`,
      ].sort(),
    );
    for (const it of absorbees) {
      expect(it.parent).toBe(`${base}/content-gen/coverage-map`);
    }
  });
});
