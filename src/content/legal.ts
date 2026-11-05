// Legal content — 6 pages. Droit français.
// CLAUDE.md v6 §1 + §5 + §22. Source: docs 28 + 31.
//
// IDENTITÉ LÉGALE : les sections « Éditeur » + « Directeur de la publication »
// des mentions légales ne figurent PLUS ici — elles sont résolues au runtime
// depuis le SiteSetting `legal_overrides` via `@/lib/legal-identity` (SSOT
// partagée avec les factures). Will renseigne SIREN/SIRET/capital/adresse/TVA
// une seule fois en console admin → page (ISR) + factures se synchronisent.

import { complementsNotice, sectionRendezVousDecouverte } from "./visio-annonce-textes";
import { TITRE_ARTICLE_VIOLENCES, VIOLENCES_PROCEDURE } from "./prevention-violences";

// Chantier visio (PR 8) — ce que la politique dit de l'enregistrement des
// rendez-vous bascule sur UN interrupteur (`src/server/visio/visio-annonce.ts`).
// Les phrases qui changent vivent dans `./visio-annonce-textes.ts`, écrites en
// entier, relisibles ; ici, elles ne sont qu'appelées.
const CN_FR = complementsNotice("fr");
const CN_EN = complementsNotice("en");

export type LegalSlug =
  | "mentions-legales"
  | "conditions-generales"
  | "politique-confidentialite"
  | "cookies"
  | "rgpd"
  | "politique-deplacement"
  | "reclamations"
  | "reglement-interieur";

interface LegalContent {
  slug: LegalSlug;
  pathFr: string;
  pathEn: string;
  fr: PageCopy;
  en: PageCopy;
}

interface PageCopy {
  title: string;
  /** Optional emphasized portion rendered in serif italic terracotta (parity v3). */
  titleEm?: string;
  intro: string;
  /**
   * `anchor` : identifiant de section explicite, stable même si le titre
   * change (lien profond envoyé par e-mail). À défaut, l'ancre est le titre
   * « slugifié » par `LegalPageTemplate`.
   */
  sections: ReadonlyArray<{ title: string; body: string; anchor?: string }>;
  metaSeo: { title: string; description: string };
}

export const LEGAL_PAGES: ReadonlyArray<LegalContent> = [
  {
    slug: "mentions-legales",
    pathFr: "/mentions-legales",
    pathEn: "/legal-notice",
    fr: {
      title: "Mentions",
      titleEm: "légales",
      intro:
        "Informations légales relatives au site axion-ia.com, publiées conformément à l'article 1-1 de la loi n° 2004-575 pour la confiance dans l'économie numérique (LCEN, modifiée par la loi n° 2024-449 du 21 mai 2024 dite « SREN ») et au Code de commerce. Les sections « Éditeur » et « Directeur de la publication » ci-dessous sont tenues à jour automatiquement à partir des informations d'immatriculation de la société.",
      sections: [
        {
          title: "Hébergeur",
          body: "Le site est hébergé par Hetzner Online GmbH — Industriestr. 25, 91710 Gunzenhausen, Allemagne (Union européenne). Téléphone : +49 (0)9831 505-0. Site : hetzner.com. Les données sont stockées et traitées dans l'Union européenne (datacenter de Francfort). Les services edge (CDN, sécurité, mise en cache) sont fournis par Cloudflare, avec priorité aux points de présence situés dans l'Union européenne.",
        },
        {
          title: "Conception et réalisation",
          body: "Le site axion-ia.com est conçu, développé et maintenu en interne par Axion-IA.",
        },
        {
          title: "Propriété intellectuelle",
          body: "L'ensemble des éléments du site (textes, photographies, illustrations, marques, logos, chartes graphiques, mises en page, code source et bases de données) est protégé par le droit de la propriété intellectuelle et demeure la propriété exclusive d'Axion-IA ou de ses partenaires. Toute reproduction, représentation, adaptation, diffusion ou exploitation, totale ou partielle, sans autorisation écrite préalable, est interdite et constitue une contrefaçon sanctionnée par les articles L335-2 et L335-3 du Code de la propriété intellectuelle. La marque « Axion-IA » et son logo ne peuvent être utilisés sans accord exprès.",
        },
        {
          title: "Protection des données personnelles",
          body: "Les traitements de données personnelles opérés via le site sont détaillés dans la Politique de confidentialité. Conformément au Règlement général sur la protection des données (RGPD, UE 2016/679) et à la loi « Informatique et Libertés », vous disposez de droits d'accès, de rectification, d'effacement, d'opposition, de limitation et de portabilité, exerçables à contact@axion-ia.com. Aucun délégué à la protection des données (DPO) n'est désigné, sa désignation n'étant pas obligatoire au regard de l'activité. L'autorité de contrôle compétente est la CNIL (Commission Nationale de l'Informatique et des Libertés — www.cnil.fr), auprès de laquelle vous pouvez introduire une réclamation.",
        },
        {
          title: "Cookies",
          body: "Le site utilise un minimum strict de cookies, sans cookie publicitaire ni traceur tiers de profilage. Le détail des cookies déposés et la gestion de votre consentement figurent dans la Politique de cookies.",
        },
        {
          title: "Accessibilité numérique",
          body: "Axion-IA s'engage à rendre son site accessible au plus grand nombre, conformément à la directive (UE) 2019/882 (European Accessibility Act) et au Référentiel Général d'Amélioration de l'Accessibilité (RGAA). L'état de conformité, les éventuelles dérogations et les voies de recours sont précisés dans la Déclaration d'accessibilité.",
        },
        {
          title: "Liens hypertextes",
          body: "La création de liens pointant vers axion-ia.com est libre pour un usage loyal et non commercial, sous réserve de ne pas porter atteinte à l'image d'Axion-IA et de ne pas créer de confusion sur l'origine du contenu. Axion-IA n'exerce aucun contrôle sur les sites tiers accessibles depuis ses pages et décline toute responsabilité quant à leur contenu.",
        },
        {
          // « Exclusivement B2B » contredisait les CGV, qui comportent depuis
          // une section entière consacrée au particulier. Deux pages publiques
          // qui se démentent l'une l'autre valent moins que pas de mention du
          // tout : c'est la contradiction qu'un contrôle relève en premier.
          // Formulation alignée le 2026-07-30 sur l'état réel — clientèle
          // professionnelle, aucune adhésion à ce jour, adhésion préalable à
          // toute vente à un consommateur.
          title: "Médiation de la consommation",
          body: "Les prestations d'Axion-IA sont commercialisées auprès d'une clientèle professionnelle, dans le cadre de l'activité de ses clients. En l'absence de relation contractuelle avec des consommateurs, Axion-IA n'a pas adhéré à ce jour à un dispositif de médiation de la consommation au sens des articles L.611-1 et L.612-1 du Code de la consommation. Les conditions générales de vente comportent néanmoins une section dédiée au particulier : toute vente à un consommateur suppose l'adhésion préalable à un médiateur agréé, dont les coordonnées seront alors publiées sur le site et reportées au contrat.",
        },
        {
          title: "Loi applicable",
          body: "Le présent site et les présentes mentions légales sont régis par le droit français. Tout litige relatif à leur interprétation ou à leur exécution relève de la compétence des tribunaux français.",
        },
      ],
      metaSeo: {
        title: "Mentions légales · Axion-IA",
        description:
          "Mentions légales d'Axion-IA SAS (LCEN art. 1-1) : éditeur, directeur de publication, hébergeur Hetzner UE, propriété intellectuelle, données personnelles, accessibilité.",
      },
    },
    en: {
      title: "Legal",
      titleEm: "notice",
      intro:
        "Legal information about axion-ia.com, published in accordance with article 1-1 of the French Act for Confidence in the Digital Economy (LCEN, as amended by Act no. 2024-449 of 21 May 2024) and the French Commercial Code. The « Publisher » and « Publication director » sections below are kept up to date automatically from the company's registration details.",
      sections: [
        {
          title: "Hosting provider",
          body: "The site is hosted by Hetzner Online GmbH — Industriestr. 25, 91710 Gunzenhausen, Germany (European Union). Phone: +49 (0)9831 505-0. Website: hetzner.com. Data is stored and processed in the European Union (Frankfurt datacenter). Edge services (CDN, security, caching) are provided by Cloudflare, prioritising points of presence located in the European Union.",
        },
        {
          title: "Design and development",
          body: "The axion-ia.com website is designed, developed and maintained in-house by Axion-IA.",
        },
        {
          title: "Intellectual property",
          body: "All elements of the site (text, photographs, illustrations, trademarks, logos, visual identity, layouts, source code and databases) are protected by intellectual property law and remain the exclusive property of Axion-IA or its partners. Any reproduction, representation, adaptation, distribution or exploitation, in whole or in part, without prior written authorisation is prohibited and constitutes infringement under articles L335-2 and L335-3 of the French Intellectual Property Code. The « Axion-IA » trademark and logo may not be used without express consent.",
        },
        {
          title: "Personal data protection",
          body: "Personal-data processing carried out via the site is detailed in the Privacy policy. Under the General Data Protection Regulation (GDPR, EU 2016/679) and the French Data Protection Act, you have rights of access, rectification, erasure, objection, restriction and portability, exercisable at contact@axion-ia.com. No Data Protection Officer (DPO) is appointed, as appointment is not mandatory given the activity. The competent supervisory authority is the CNIL (www.cnil.fr), with which you may lodge a complaint.",
        },
        {
          title: "Cookies",
          body: "The site uses a strict minimum of cookies, with no advertising cookies and no third-party profiling trackers. Details of the cookies set and management of your consent are provided in the Cookie policy.",
        },
        {
          title: "Digital accessibility",
          body: "Axion-IA is committed to making its site accessible to as many people as possible, in accordance with Directive (EU) 2019/882 (European Accessibility Act) and the French RGAA accessibility standard. The conformance status, any exemptions and the remedies available are set out in the Accessibility statement.",
        },
        {
          title: "Hyperlinks",
          body: "Creating links to axion-ia.com is free for fair, non-commercial use, provided it does not harm Axion-IA's image or create confusion as to the origin of the content. Axion-IA exercises no control over third-party sites reachable from its pages and accepts no liability for their content.",
        },
        {
          title: "Consumer mediation",
          body: "Axion-IA's services are intended exclusively for professional (B2B) clients, within the scope of their business activity. In the absence of any relationship with consumers, Axion-IA is not required to join a consumer-mediation scheme within the meaning of articles L611-1 and L612-1 of the French Consumer Code.",
        },
        {
          title: "Applicable law",
          body: "This site and these legal notices are governed by French law. Any dispute relating to their interpretation or performance falls within the jurisdiction of the French courts.",
        },
      ],
      metaSeo: {
        title: "Legal notice · Axion-IA",
        description:
          "Legal notice for Axion-IA SAS (LCEN art. 1-1): publisher, publication director, Hetzner EU hosting, intellectual property, personal data, accessibility.",
      },
    },
  },
  {
    slug: "conditions-generales",
    pathFr: "/conditions-generales",
    pathEn: "/terms",
    fr: {
      title: "Conditions",
      titleEm: "générales",
      intro:
        "Conditions générales de vente et de service d'Axion-IA, applicables aux devis signés à compter du 5 novembre 2026. Axion-IA contracte exclusivement avec des professionnels. Lorsqu'une valeur est « fixée au devis », elle figure au devis signé ; si le devis est muet, la valeur indiquée « à défaut » s'applique.",
      sections: [
        {
          title: "TITRE I – CADRE · Article 1. Axion-IA",
          anchor: "article-1",
          body: "1.1 Les présentes conditions sont proposées par AXION IA, société par actions simplifiée immatriculée au registre du commerce et des sociétés de Grenoble sous le numéro 108 018 631, dont le siège est situé 11 avenue Paul Verlaine, 38100 Grenoble, numéro de TVA intracommunautaire FR51108018631, représentée par son président, Williams Jullin (« Axion-IA »).\n1.2 Déclaration d'activité de prestataire de formation enregistrée sous le numéro 84381100438 auprès du préfet de la région Auvergne-Rhône-Alpes. Cet enregistrement ne vaut pas agrément de l'État.\n1.3 Contact : contact@axion-ia.com.",
        },
        {
          title: "Article 2. Objet, champ et qualité du Client",
          anchor: "article-2",
          body: "2.1 Les présentes conditions s'appliquent à toutes les prestations d'Axion-IA : journées en entreprise, audits, formations, coaching, conception et mise en place d'Automatisations, hébergement, maintenance et fourniture de l'utilisation de l'IA, sites web et plateformes, produits numériques.\n2.2 Axion-IA contracte exclusivement avec des professionnels, agissant pour les besoins de leur activité. En signant le devis, le Client déclare agir à des fins professionnelles et communique son numéro SIREN, qu'Axion-IA peut vérifier. Axion-IA ne contracte pas avec des consommateurs.\n2.3 Certains clients professionnels bénéficient de règles particulières qui priment sur les présentes : voir le Titre IX.\n2.4 Les présentes conditions constituent le socle de la relation commerciale (article L441-1 du Code de commerce). Les conditions générales d'achat du Client ne s'appliquent pas ; en cas de contradiction, les clauses incompatibles sont sans effet de part et d'autre (article 1119 du Code civil).",
        },
        {
          title: "Article 3. Définitions",
          anchor: "article-3",
          body: "• Automatisation : programme mis en place par Axion-IA qui exécute pour le Client des tâches définies au devis, avec ou sans intelligence artificielle, y compris un agent conversationnel (« Agent IA »).\n• Briques : outils, programmes, modèles, consignes, gabarits, méthodes et savoir-faire qu'Axion-IA possédait avant le contrat ou développe indépendamment de lui, inscrits au Registre des briques (annexe 6).\n• Éléments spécifiques : éléments créés pour le Client en exécution du devis et listés à l'Inventaire de livraison.\n• Client : le professionnel qui signe le devis.\n• Contrat : le devis signé, les présentes conditions et leurs annexes.\n• Crédits IA : unité de mesure de l'utilisation de l'IA comprise dans un niveau (article 23).\n• Données du Client : données et contenus fournis par le Client ou produits pour lui par une Automatisation, avec leurs métadonnées d'usage. Elles excluent les Briques, les consignes, la logique des flux et la configuration technique d'Axion-IA.\n• Écrit : courrier, courriel ou message dans l'espace client, sauf quand un article exige une lettre recommandée.\n• Formule A : achat en une fois ; les Éléments spécifiques sont cédés au Client après paiement complet (article 31).\n• Formule B : mise en service puis abonnement ; l'Automatisation fonctionne chez Axion-IA et le Client en a l'usage (article 20).\n• Heures ouvrées : de 9 h à 18 h, heure de Paris, du lundi au vendredi, hors jours fériés en France métropolitaine. Jour ouvré : du lundi au vendredi, hors jours fériés.\n• Livraison finale : remise du dernier livrable prévu au devis.\n• Mise en service : date, notée par écrit, à laquelle une Automatisation ou un site est mis à la disposition du Client en conditions réelles.\n• Niveau : tranche de volume et de service d'un abonnement, avec son prix mensuel, figurant dans la grille du devis.\n• Phase : étape de travail décrite au devis, avec son contenu, son prix et son déclencheur de paiement.\n• Réception : constat que le livrable d'une phase est conforme au devis (article 14).\n• Services extérieurs : services de tiers que le Client souscrit et paie directement (article 29).",
        },
        {
          title: "Article 4. Documents du contrat, priorité et valeurs par défaut",
          anchor: "article-4",
          body: "4.1 Ordre de priorité : (1) le devis signé et ses avenants ; (2) pour les données personnelles, l'accord de traitement des données (annexe 1) ; (3) pour une formation, la convention de formation ; (4) les présentes conditions ; (5) les autres annexes. Le document placé plus haut l'emporte, sur le seul point qu'il traite expressément.\n4.2 Le devis signé est la seule pièce commerciale. Les annexes qui lui sont jointes sont acceptées par la même signature.\n4.3 À défaut de mention au devis, la valeur par défaut indiquée entre parenthèses dans l'article concerné s'applique.",
        },
        {
          title: "Article 5. Acceptation et modification des conditions",
          anchor: "article-5",
          body: "5.1 Avant de signer, le Client lit les présentes conditions et coche une case distincte « J'ai lu et j'accepte les conditions générales de vente ». Sans cette case, la signature est impossible.\n5.2 La version acceptée est enregistrée et scellée avec la signature. Son PDF est joint au courriel de confirmation et reste téléchargeable dans l'espace client.\n5.3 Pour un contrat en cours, Axion-IA peut proposer une nouvelle version avec un préavis écrit de (préavis : valeur fixée au devis ; à défaut : 30 jours). Une nouvelle version ne peut modifier ni le prix, ni le volume, ni la durée d'engagement. Le Client peut refuser et résilier sans frais avant son entrée en vigueur ; la période payée et non consommée lui est alors remboursée au prorata. Sans résiliation, la nouvelle version s'applique à la période suivante.\n5.4 Une modification imposée par la loi s'applique à la date prévue par la loi.",
        },
        {
          title:
            "TITRE II – COMMANDE, PRIX ET PAIEMENT · Article 6. Devis, formation du contrat et preuve",
          anchor: "article-6",
          body: "6.1 Chaque prestation fait l'objet d'un devis, valable (validité : valeur fixée au devis ; à défaut : 30 jours). Le Client y choisit sa formule, ses options, son niveau et sa durée payée d'avance ; ces choix sont scellés avec la signature et ne changent ensuite que par avenant, sauf le passage automatique de l'article 24.\n6.2 Le contrat est formé lorsque les deux parties ont signé le devis : la signature du Client, puis la contresignature d'Axion-IA, qui intervient au plus tard dans les 2 jours ouvrés suivant celle du Client (à défaut, le Client peut retirer sa signature par écrit tant que la contresignature n'est pas intervenue). Axion-IA lui adresse alors la confirmation de commande. Le Client communique avant la signature son SIREN, son numéro de TVA, son adresse de facturation électronique et, le cas échéant, sa référence de commande.\n6.3 Le devis est signé en ligne, par le procédé de signature électronique d'Axion-IA : le signataire reçoit un lien personnel, coche la case d'acceptation des conditions générales, puis signe. Chaque signature est scellée (identité du signataire, date et heure, adresse IP, version et empreinte des conditions acceptées, options et cases cochées, empreinte du devis). Les parties reconnaissent à ce procédé la valeur d'une signature (articles 1366 et 1367 du Code civil) et conviennent que ce scellement fait preuve. Le signataire déclare avoir le pouvoir d'engager le Client.\n6.4 Preuve. Font foi entre les parties, sauf preuve contraire (article 1356 du Code civil) : les enregistrements de signature (identité, date, version des conditions et des annexes acceptées, options et cases cochées, empreinte du document), les relevés de consommation, les historiques de livraison et de recette, les journaux d'accès et les échanges dans l'espace client. Entre professionnels, les parties dérogent aux articles 1127-1 et 1127-2 du Code civil.\n6.5 Aucun travail ne commence avant la réception du premier versement, sauf les règles du Titre IX. Si ce versement n'est pas reçu dans les (délai : valeur fixée au devis ; à défaut : 30 jours) suivant la signature, Axion-IA peut constater par écrit l'abandon de la commande, sans frais de part ni d'autre.",
        },
        {
          title: "Article 7. Prix, taxes et frais",
          anchor: "article-7",
          body: "7.1 Les prix sont ceux du devis, en euros hors taxes. La TVA au taux en vigueur s'ajoute, sauf exonération applicable indiquée au devis. Un devis qui réunit une formation et une prestation taxable ventile le prix entre elles.\n7.2 Le prix est dû par le Client en totalité, quelle que soit l'issue d'une demande de financement qu'il ferait auprès d'un tiers.\n7.3 Les frais de déplacement figurent au devis. Aucun autre frais n'est facturé sans accord écrit préalable du Client.\n7.4 Une dépense payée par Axion-IA au nom et pour le compte du Client, sur mandat écrit, est refacturée à l'euro près, hors TVA, au titre des débours, justificatif à l'appui. Toute autre dépense refacturée fait partie du prix et supporte la TVA.\n7.5 Escompte pour paiement anticipé : néant. Les prix dégressifs selon la durée payée d'avance sont des réductions de prix fixées au devis, non un escompte.\n7.6 Les prix des Services extérieurs indiqués au devis sont indicatifs et ne font pas partie du prix d'Axion-IA.",
        },
        {
          title: "Article 8. Évolution des prix",
          anchor: "article-8",
          body: "8.1 Les prix d'une prestation ponctuelle sont fermes pendant la durée prévue au devis.\n8.2 Le prix d'un abonnement, d'un hébergement ou d'une maintenance est révisé à chaque date anniversaire selon la formule P1 = P0 × (S1 / S0), où S0 est le dernier indice Syntec publié à la signature ou à la dernière révision et S1 le dernier publié à la date de révision (révision Syntec : valeur fixée au devis ; à défaut : oui). Si l'indice disparaît, l'indice qui le remplace s'applique.\n8.3 Hors indice, et seulement à l'issue de l'engagement minimum, Axion-IA peut modifier le prix pour les périodes suivantes avec un préavis écrit de (préavis : valeur fixée au devis ; à défaut : 60 jours) ; le Client peut résilier sans frais avant la hausse.\n8.4 L'évolution du coût des fournisseurs d'IA suit l'article 25, y compris pendant l'engagement. Un prix bloqué accordé au devis ne couvre pas l'utilisation de l'IA.",
        },
        {
          title: "Article 9. Facturation et paiement",
          anchor: "article-9",
          body: "9.1 Phases. Le devis découpe le travail en phases ; à chaque phase correspond un versement et un déclencheur (signature, début de phase, réception, livraison finale). La somme des versements est égale au prix total. Une phase ne commence qu'après le paiement du versement qui la précède.\n9.2 Factures d'acompte et avoirs. Tout versement demandé avant la fin d'une phase donne lieu à une facture d'acompte, déduite de la facture de phase ou finale. Tout remboursement ou réduction après facturation donne lieu à un avoir qui reprend les références de la facture d'origine ; il s'impute sur la facture suivante ou, sur demande, est remboursé sous 30 jours.\n9.3 Échéance. Chaque facture est payable (délai : valeur fixée au devis ; à défaut : 15 jours) à compter de sa date d'émission ; sa date d'échéance y figure.\n9.4 Abonnements. Un abonnement (formule B, hébergement, maintenance, niveau d'utilisation de l'IA) se paie par périodes de (1, 2, 6 ou 12 mois : valeur fixée au devis ; à défaut : 1 mois), à échoir (à échoir ou à échu : valeur fixée au devis ; à défaut : à échoir). La première période commence à la Mise en service. Une remise peut être accordée selon la durée payée d'avance ; en cas de remboursement au prorata, le calcul se fait sur le prix remisé effectivement payé.\n9.5 Moyens de paiement. Les abonnements se paient par prélèvement SEPA interentreprises (B2B), sauf autre moyen accepté au devis ; le Client fait enregistrer le mandat par sa banque avant la première échéance. La facture, transmise au moins 5 jours calendaires avant le prélèvement, vaut pré-notification. Un rejet imputable au Client est un retard de paiement, et les frais bancaires de rejet lui sont refacturés à leur coût réel. Les autres factures se paient par virement.\n9.6 Facture électronique. Axion-IA émet ses factures par sa plateforme agréée dans un format du socle commun et, jusqu'à ce que l'émission électronique lui soit imposée, peut aussi les adresser en PDF. Une facture rejetée du fait d'une donnée erronée ou non mise à jour par le Client est réputée reçue à sa première émission ; son échéance n'est pas reportée.\n9.7 Imputation. Les paiements s'imputent d'abord sur les frais et pénalités, puis sur les factures les plus anciennes.",
        },
        {
          title: "Article 10. Retard de paiement",
          anchor: "article-10",
          body: "10.1 Tout retard entraîne de plein droit, dès le lendemain de l'échéance et sans rappel : des pénalités au taux appliqué par la Banque centrale européenne à son opération de refinancement la plus récente, majoré de 10 points, sans pouvoir être inférieur à trois fois le taux d'intérêt légal ; une indemnité forfaitaire pour frais de recouvrement de 40 euros par facture (articles L441-10 et D441-5 du Code de commerce) ; le remboursement, sur justificatifs, des frais de recouvrement supérieurs (commissaire de justice, avocat).\n10.2 Mise en demeure. Si une facture reste impayée 15 jours après son échéance, Axion-IA adresse une mise en demeure qui indique le montant dû et les mesures envisagées avec leur date d'effet.\n10.3 Mesures graduées. Faute de paiement après la mise en demeure, Axion-IA peut appliquer les mesures de l'article 28 : mode restreint 8 jours après, suspension 15 jours après. L'export des Données du Client n'est jamais suspendu.\n10.4 Déchéance du terme. Le défaut de paiement non régularisé 15 jours après la mise en demeure rend immédiatement exigible la totalité des sommes restant dues pour les phases commencées et les périodes d'abonnement en cours, ainsi que l'indemnité prévue à l'article 41.2.\n10.5 Clause résolutoire. Dans le même cas, Axion-IA peut, par une mise en demeure visant le présent article et restée sans effet 15 jours, résilier de plein droit tout ou partie du contrat par simple notification écrite (article 1225 du Code civil).\n10.6 Rétention. Jusqu'au paiement complet, Axion-IA retient le code source, les accès d'administration, les fichiers, les livrables non remis et le transfert de l'Automatisation (article 2286 du Code civil), sans préjudice de l'export des Données du Client.\n10.7 Les droits sur les livrables ne sont transférés qu'après paiement complet (article 31). Jusque-là, le Client n'a qu'un droit d'usage provisoire, limité aux essais et à la recette, révocable 8 jours après une mise en demeure de payer restée sans effet. Un nom de domaine enregistré au nom du Client reste à son nom en toute hypothèse.",
        },
        {
          title: "Article 11. Contestation et compensation",
          anchor: "article-11",
          body: "11.1 Le Client qui conteste une facture le signale par écrit et motivé dans les 30 jours de sa réception, y compris par le statut « refusée » ou « en litige » de sa plateforme de réception. Il paie sans délai la partie non contestée. Ce délai ne le prive d'aucune action.\n11.2 Le Client ne peut ni retenir, ni déduire, ni compenser une somme due à Axion-IA sans accord écrit d'Axion-IA, avoir émis par elle ou décision de justice.\n11.3 Entre professionnels, les articles 1222 et 1223 du Code civil ne s'appliquent pas : toute réduction de prix ou exécution par un tiers aux frais d'Axion-IA suppose un accord écrit ou une décision de justice.",
        },
        {
          title:
            "TITRE III – EXÉCUTION DES PRESTATIONS · Article 12. Démarrage, délais et collaboration du Client",
          anchor: "article-12",
          body: "12.1 Les délais du devis sont estimatifs. Ils courent quand le premier versement est reçu et que le Client a fourni les éléments listés au devis (accès, informations, contenus, données, interlocuteur).\n12.2 Ils sont prolongés de plein droit de la durée de tout retard du Client, d'une mesure de l'article 28, d'un changement de périmètre, d'un cas de force majeure ou de la défaillance d'un service tiers.\n12.3 Le Client désigne un interlocuteur qui peut décider. Les validations qu'il donne engagent le Client ; un changement d'interlocuteur ne les remet pas en cause, et une passation de plus d'une heure est facturée au taux journalier du devis. Le Client répond aux demandes de validation sous (délai : valeur fixée au devis ; à défaut : 5 jours ouvrés).\n12.4 Le Client dispose de tous les droits sur ce qu'il confie à Axion-IA. Avant toute intervention sur ses systèmes, il fait une sauvegarde complète et vérifiée ; il reste responsable de la sécurité de ses propres systèmes.\n12.5 Un retard imputable à Axion-IA de plus de 30 jours, persistant 15 jours après une mise en demeure, permet au Client de suspendre le versement suivant ou de résilier la phase en cours ; il obtient alors le remboursement des sommes versées pour la part non réalisée de cette phase, sans indemnité minimale due par lui.",
        },
        {
          title: "Article 13. Périmètre, corrections incluses et changements",
          anchor: "article-13",
          body: "13.1 Gel du périmètre. Le périmètre est figé à la signature du devis ou, si le devis prévoit une phase de cadrage, à la validation écrite du cahier de cadrage.\n13.2 Corrections incluses. Chaque livrable comprend (nombre : valeur fixée au devis ; à défaut : 2) cycles de corrections ; chaque cycle est une liste écrite unique envoyée par l'interlocuteur du Client.\n13.3 Changements. Toute demande au-delà, ou hors du périmètre figé, fait l'objet d'un avenant écrit, chiffré et signé avant d'être réalisé.\n13.4 Besoins imprévus. Si Axion-IA découvre un besoin imprévu (service extérieur, serveur plus puissant, outil payant), elle en informe le Client par écrit avant toute dépense, avec la raison et le coût estimé, et ne souscrit rien en son nom sans son accord écrit. Pour un Service extérieur, l'article 29 s'applique. Pour tout autre besoin refusé par le Client sans solution de remplacement, les parties ajustent le périmètre par avenant ou clôturent la phase ; le travail fait reste dû.\n13.5 Si un service tiers ou un modèle d'IA change avant la Livraison finale, l'adaptation est comprise jusqu'à (durée : valeur fixée au devis ; à défaut : 2 jours de travail) ; au-delà, elle fait l'objet d'un avenant et les délais sont prolongés d'autant. La consommation d'IA pendant la construction et les tests est comprise dans la limite du plafond du devis, puis soumise à l'article 13.4.",
        },
        {
          title: "Article 14. Recette et réception",
          anchor: "article-14",
          body: "14.1 Critères. Le devis fixe, pour chaque livrable, ses critères de conformité et, pour chaque Automatisation, un jeu d'essai (cas types et données d'exemple) et un seuil de réussite (seuil : valeur fixée au devis ; à défaut : 9 cas sur 10).\n14.2 Vérification. À la fin de chaque phase, Axion-IA met le livrable à disposition dans un environnement de test et en informe le Client, qui dispose de (délai : valeur fixée au devis ; à défaut : 10 jours ouvrés) pour signaler par écrit les écarts, classés bloquants ou mineurs. Un écart n'est retenu que s'il est décrit de façon reproductible et rattaché à une exigence écrite du devis ; une réponse inexacte isolée d'une Automatisation qui atteint le seuil du jeu d'essai n'est pas un écart.\n14.3 Réception. La phase est réceptionnée : à la signature du procès-verbal de recette ; ou à la fin du délai de vérification sans écart bloquant signalé ; ou, pour un même point, après deux cycles de recette, avec réserves mineures ; ou dès que le Client utilise le livrable en conditions réelles pendant (durée : valeur fixée au devis ; à défaut : 10 jours ouvrés) sans signaler d'écart bloquant. Les écarts mineurs n'empêchent pas la réception.\n14.4 Séquence de la dernière phase. La réception de la dernière phase rend le solde exigible. La mise en production ou la mise en ligne a lieu après le paiement du solde.\n14.5 Versions de test. Une version de test ou de démonstration est fournie en l'état, sans garantie ni maintenance. Son usage en conditions réelles par le Client vaut réception de la phase, rend exigible le versement lié et dégage Axion-IA de toute responsabilité pour les dommages liés à cet usage avant la réception formelle.",
        },
        {
          title: "Article 15. Garantie commerciale",
          anchor: "article-15",
          body: "15.1 Axion-IA corrige gratuitement, pendant (durée : valeur fixée au devis ; à défaut : 30 jours) après la réception de la Livraison finale, les anomalies signalées par écrit qui rendent le livrable non conforme au devis.\n15.2 Sont exclus : une modification faite par le Client ou un tiers ; un usage contraire au contrat ou à la documentation ; une panne ou un changement d'un service tiers, d'un fournisseur d'IA ou du serveur du Client ; une demande nouvelle ; une inexactitude ponctuelle d'un résultat d'IA dans les limites de l'article 26.",
        },
        {
          title: "Article 16. Engagements d'Axion-IA",
          anchor: "article-16",
          body: "16.1 Axion-IA s'engage à : livrer des livrables conformes au devis et aux critères de recette ; réaliser les sauvegardes et appliquer les mesures de sécurité des annexes 1 et 2 pour ce qu'elle héberge ; respecter l'engagement de disponibilité de l'article 21 ; restituer les Données du Client selon l'article 35 ; informer le Client par écrit de tout retard prévisible et de sa cause.\n16.2 Pour le reste, et en particulier pour le conseil et pour les résultats produits par l'IA, Axion-IA est tenue d'une obligation de moyens. Elle ne s'engage sur aucun résultat chiffré : les gains, économies et indicateurs évoqués avant la commande sont des hypothèses, reprises comme telles au devis.",
        },
        {
          title: "Article 17. Sous-traitance",
          anchor: "article-17",
          body: "17.1 Axion-IA peut confier tout ou partie de l'exécution à des prestataires de son choix, sans accord préalable du Client, sauf les articles 17.3 et 17.4. Elle reste seule responsable envers le Client et seule interlocutrice ; le Client s'interdit de donner des instructions directes à ces prestataires ou de les payer directement. Les fournisseurs d'hébergement et d'IA sont des fournisseurs, non des sous-traitants au sens de la loi n° 75-1334 du 31 décembre 1975.\n17.2 Axion-IA garantit qu'elle détient, de ses prestataires, les droits de propriété intellectuelle nécessaires à l'exécution du contrat et à la cession de l'article 31, et leur impose des obligations de confidentialité et de sécurité au moins équivalentes aux siennes.\n17.3 Données personnelles. Par la signature du devis, le Client donne une autorisation écrite générale au recours aux sous-traitants ultérieurs listés à l'annexe 3. Tout ajout ou remplacement est notifié 30 jours à l'avance ; le Client peut s'y opposer pour un motif légitime lié à la protection des données et, à défaut de solution, résilier la seule partie concernée, sans frais ni indemnité de part et d'autre.\n17.4 Intervenant désigné. Quand le devis désigne nommément un intervenant, Axion-IA ne peut le remplacer qu'avec l'accord écrit du Client, sauf empêchement (maladie, accident, force majeure). Elle propose alors un intervenant de qualification équivalente ou une nouvelle date ; si le Client refuse les deux, les sommes versées pour la prestation concernée lui sont remboursées, sans autre indemnité.",
        },
        {
          title: "Article 18. Continuité",
          anchor: "article-18",
          body: "18.1 Axion-IA désigne une personne de secours, liée par un engagement de confidentialité, qui assure la surveillance, la restauration et le traitement des incidents bloquants des services hébergés si l'intervenant principal est indisponible plus de 5 jours ouvrés. Elle tient à jour un dossier d'exploitation et conserve les accès d'administration dans un coffre sécurisé avec une procédure d'accès d'urgence. L'état des services est publié sur une page hébergée hors de l'infrastructure d'Axion-IA.\n18.2 Un empêchement de l'intervenant principal (maladie, accident) prolonge les délais d'un projet de sa durée, dans la limite de 45 jours, sans indemnité ; Axion-IA peut le remplacer par un intervenant de compétence équivalente en informant le Client. Au-delà de 45 jours, le Client peut arrêter la phase en cours et ne paie que le travail réalisé.",
        },
        {
          title:
            "TITRE IV – AUTOMATISATIONS, HÉBERGEMENT ET INTELLIGENCE ARTIFICIELLE · Article 19. Formule A : achat en une fois",
          anchor: "article-19",
          body: "19.1 Le Client paie un prix, éventuellement par phases, pour la mise en place de son Automatisation. Après paiement complet, les Éléments spécifiques lui sont cédés et les Briques intégrées lui sont concédées en licence (article 31).\n19.2 Hébergement (serveur du Client ou chez Axion-IA : valeur fixée au devis ; à défaut : serveur du Client). Sur le serveur du Client, celui-ci souscrit et paie son serveur et reste responsable de son hébergement et de sa sécurité. Chez Axion-IA, l'hébergement fait l'objet d'une ligne mensuelle séparée au devis (articles 21 et 22) ; il couvre le serveur et son système, pas l'Automatisation elle-même, qui relève de la maintenance.\n19.3 Maintenance (option obligatoire ou facultative, durée, prix et mois offerts : valeur fixée au devis ; à défaut : option facultative, aucun mois offert). La case cochée à la signature vaut accord exprès du Client. Sans maintenance, Axion-IA n'est pas responsable du fonctionnement de l'Automatisation après la garantie commerciale, notamment en cas d'évolution d'un service tiers ou d'un modèle d'IA ; elle informe toutefois le Client, pendant (durée : valeur fixée au devis ; à défaut : 24 mois), des failles de sécurité critiques dont elle a connaissance et met le correctif à sa disposition, que le Client installe sous sa responsabilité.",
        },
        {
          title: "Article 20. Formule B : mise en service et abonnement",
          anchor: "article-20",
          body: "20.1 L'Automatisation fonctionne sur l'infrastructure d'Axion-IA. Le Client paie des frais de mise en service et d'adaptation, selon l'échéancier du devis (d'avance, 50/50, 30/30/solde ou par phases : valeur fixée au devis ; à défaut : 50/50), puis un abonnement qui comprend l'hébergement, la maintenance, le support et le niveau d'utilisation de l'IA choisi.\n20.2 Les frais de mise en service rémunèrent une prestation de paramétrage et d'adaptation ; ils n'emportent aucune cession.\n20.3 Le Client reçoit un droit d'utilisation personnel, non exclusif et non transférable, pendant la durée de l'abonnement, ouvert aux personnes qu'il autorise (salariés, mandataires, prestataires agissant pour son compte) dans la limite de (nombre d'utilisateurs : valeur fixée au devis) et des sociétés liées désignées au devis, y compris par les interfaces fournies. Il s'interdit de mettre l'Automatisation à disposition de tiers. Axion-IA peut vérifier le respect de ces limites.\n20.4 À la fin de l'abonnement, le Client peut racheter l'Automatisation, selon l'article 31, au prix (formule de rachat : valeur fixée au devis ; à défaut : 12 mois d'abonnement HT).",
        },
        {
          title: "Article 21. Hébergement, sauvegardes et disponibilité",
          anchor: "article-21",
          body: "21.1 Les données hébergées par Axion-IA sont stockées dans l'Union européenne. Le transit (réseau de distribution et de sécurité) et certains traitements par les fournisseurs d'IA peuvent avoir lieu hors de l'Union, avec les garanties indiquées à l'annexe 3.\n21.2 Axion-IA réalise une sauvegarde quotidienne chiffrée, conservée 30 jours sur un site distinct, et teste la restauration chaque trimestre. Perte de données maximale visée : 24 heures. Reprise visée après incident majeur : 1 jour ouvré.\n21.3 Les interventions programmées sont annoncées 48 heures à l'avance, sauf urgence de sécurité, et limitées à 8 heures par mois, si possible hors Heures ouvrées.\n21.4 Engagement de disponibilité. Axion-IA s'engage sur une disponibilité mensuelle de (taux : valeur fixée au devis ; à défaut : 99 %) des services qu'elle héberge, mesurée par une sonde externe, hors interventions programmées, force majeure et causes imputables au Client ou à ses Services extérieurs. Si cet engagement n'est pas tenu, le Client reçoit, sur demande écrite dans les 30 jours suivant la fin du mois, un avoir sur l'abonnement du service concerné : 5 % entre l'engagement et 98 %, 10 % entre 98 % et 95 %, 25 % sous 95 %. Les avoirs sont plafonnés à 25 % par mois et constituent la seule compensation de l'indisponibilité, sauf faute lourde ou dol. Si la disponibilité est inférieure à 95 % deux mois de suite, le Client peut résilier le service sans frais ni indemnité de sortie.\n21.5 Le stockage au-delà du volume prévu au niveau choisi est facturé au prix du devis, après information préalable.",
        },
        {
          title: "Article 22. Maintenance et support",
          anchor: "article-22",
          body: "22.1 La maintenance comprend : la maintenance corrective (correction des anomalies reproductibles) ; la maintenance adaptative mineure (adaptation aux changements mineurs des services tiers et des modèles, jusqu'à (durée : valeur fixée au devis ; à défaut : 1 jour de travail) par évolution) ; la surveillance et les mises à jour de sécurité. Les nouvelles fonctions et le remplacement d'un service tiers arrêté font l'objet d'un devis.\n22.2 Le support est joignable par (canal : valeur fixée au devis ; à défaut : courriel et espace client) aux Heures ouvrées. Délais de prise en charge visés : service à l'arrêt, 4 Heures ouvrées ; fonctionnement dégradé, 1 Jour ouvré ; autre demande, 2 Jours ouvrés. La prise en charge est le début du diagnostic, pas la résolution.",
        },
        {
          title: "Article 23. Utilisation de l'IA et Crédits IA",
          anchor: "article-23",
          body: "23.1 IA intégrée. L'utilisation de l'IA est fournie comme une fonction intégrée des services d'Axion-IA. Le Client n'acquiert aucun accès direct aux services des fournisseurs d'IA, aucune clé d'accès ni aucun compte chez eux.\n23.2 Crédits IA. Chaque niveau comprend un nombre mensuel de Crédits IA. La table de correspondance entre opérations et crédits (par exemple un document traité, une réponse produite) figure à l'annexe 7. Axion-IA peut l'ajuster pour tenir compte des fournisseurs, sans réduire le volume d'opérations compris dans le niveau, sauf application de l'article 25. Les crédits non utilisés d'un mois ne sont pas reportés.\n23.3 Compteur. La consommation est mesurée par les systèmes d'Axion-IA et consultable dans l'espace client ; ces relevés font foi (article 6.4).\n23.4 Coupe-circuit. Axion-IA fixe des plafonds techniques (par heure, par jour, par Automatisation) et peut arrêter automatiquement un traitement dont la consommation est anormale (boucle, répétition, appels massifs, accès compromis). Une consommation anormale due à Axion-IA est à sa charge. Celle due au Client, à ses utilisateurs, à ses identifiants, à ses données ou à un outil qu'il a connecté est décomptée de son niveau, puis facturée au prix des crédits supplémentaires du devis, dans la limite de (plafond : valeur fixée au devis ; à défaut : un mois d'abonnement) ; au-delà, le traitement est arrêté.\n23.5 Règles des fournisseurs. Le Client et ses utilisateurs respectent les politiques d'usage des fournisseurs d'IA utilisés, listées à l'annexe 3. Le Client garantit Axion-IA de toute conséquence de leur violation, y compris la suspension du compte d'Axion-IA par un fournisseur.\n23.6 Compte IA du Client. Sur demande et si le devis le prévoit, l'Automatisation peut utiliser un compte que le Client ouvre et paie lui-même chez un fournisseur compatible. Ce fournisseur agit alors pour le Client, qui choisit une offre professionnelle excluant l'entraînement sur ses données ; Axion-IA lui indique par écrit les réglages recommandés et peut refuser de connecter un compte non conforme.\n23.7 Les documents remis au Client n'indiquent ni les prix d'achat d'Axion-IA ni sa marge.",
        },
        {
          title: "Article 24. Niveaux et passage automatique au niveau supérieur",
          anchor: "article-24",
          body: "24.1 Grille. Le devis contient la grille complète des niveaux (volume, prix mensuel), acceptée par la signature, et un encadré « Passage automatique au niveau supérieur : (valeur fixée au devis ; à défaut : OUI) – niveau maximal automatique : (niveau : valeur fixée au devis ; à défaut : niveau immédiatement supérieur) ».\n24.2 Alertes. Le Client est alerté à 80 % puis à 100 % de son volume mensuel.\n24.3 Déclenchement. Si le volume est dépassé deux mois sur trois consécutifs, ou de plus de 30 % sur un seul mois, Axion-IA notifie par écrit le passage au niveau supérieur, avec le nouveau prix et sa date d'effet.\n24.4 Droit de refus. Le Client peut refuser par écrit dans les 8 jours suivant la notification. À défaut, le passage s'applique au premier jour de la période mensuelle suivante et vaut accord du Client au sens de l'article 1120 du Code civil ; le supplément de la période en cours est facturé au prorata. En cas de refus, le service est limité au volume souscrit jusqu'à la fin de la période, sans autre conséquence.\n24.5 Mois de dépassement. Les opérations au-delà du volume sont exécutées dans la limite de 20 % du volume et facturées au prix des crédits supplémentaires du devis ; au-delà, le service est limité.\n24.6 Plafond. Le passage automatique ne dépasse ni le niveau maximal indiqué au devis ni un niveau par mois ; au-delà, un accord écrit est nécessaire.\n24.7 Retour. Si la consommation reste inférieure au niveau précédent pendant 2 mois consécutifs, le Client peut demander à y revenir à la fin de la période en cours. L'engagement minimum reste inchangé.",
        },
        {
          title: "Article 25. Évolution des fournisseurs et des modèles d'IA",
          anchor: "article-25",
          body: "25.1 Si le prix public d'un fournisseur d'IA utilisé augmente de plus de 20 % par rapport à celui de la signature, ou si un modèle est remplacé par un modèle plus coûteux, Axion-IA peut, avec un préavis écrit de 30 jours, augmenter le prix du niveau ou réduire le nombre d'opérations par crédit, pour les périodes non encore payées, y compris pendant l'engagement, dans une proportion au plus égale à l'impact de cette hausse sur son coût. Le préavis indique le fournisseur et l'ancien et le nouveau prix public. Le Client peut résilier le niveau concerné sans frais ni indemnité de sortie avant l'entrée en vigueur.\n25.2 Si un fournisseur modifie ou arrête un modèle, Axion-IA en informe le Client et adapte l'Automatisation à un modèle équivalent, dans le cadre de la maintenance si l'adaptation est mineure, sur devis sinon. Un changement de modèle qui laisse l'Automatisation utilisable pour l'usage prévu n'est pas un manquement. Si aucun modèle permettant l'usage prévu n'est disponible et que le Client refuse le devis d'adaptation, chaque partie peut résilier l'Automatisation concernée sans indemnité ; la période payée d'avance non utilisée est remboursée.\n25.3 Ces règles organisent le traitement des évolutions des fournisseurs d'IA. Pour les autres changements de circonstances imprévisibles au sens de l'article 1195 du Code civil, les parties renégocient de bonne foi pendant 30 jours ; à défaut d'accord, chacune peut résilier sans frais la partie concernée avec un préavis de 30 jours.",
        },
        {
          title: "Article 26. Résultats de l'IA et supervision humaine",
          anchor: "article-26",
          body: "26.1 L'intelligence artificielle fonctionne par probabilités : elle peut produire des résultats inexacts, incomplets ou inadaptés, et deux demandes identiques peuvent donner des réponses différentes.\n26.2 Fiche du système. Avant la signature, Axion-IA remet pour chaque Automatisation utilisant l'IA une fiche (annexe 5) : destination et usages exclus, modèle et région de traitement, limites connues, vérifications humaines requises, mentions de transparence, procédure d'arrêt d'urgence. Le Client la valide avec le devis.\n26.3 Mode de supervision. Le devis fixe pour chaque Automatisation : soit une validation humaine avant chaque envoi ou décision ; soit un fonctionnement automatique dans un périmètre défini (types de messages, destinataires, plafond quotidien), choisi par le Client après l'avertissement écrit d'Axion-IA, avec les garde-fous listés (journalisation, liste blanche, plafond d'envois, arrêt d'urgence).\n26.4 Le Client reste seul responsable de l'usage des résultats et des décisions prises sur leur base, des contenus qu'il fournit, des listes de destinataires et du respect des règles de son secteur. Il fait vérifier par une personne compétente tout résultat touchant une personne (embauche, crédit, santé, droit, sécurité).\n26.5 Axion-IA ne répond pas de l'inexactitude ponctuelle d'un résultat produit par une Automatisation conforme au devis, à la fiche du système et au mode de supervision. Elle reste responsable, dans les limites de l'article 38, d'un défaut de conception, de paramétrage ou de garde-fous contraire au devis ou aux règles de l'art.\n26.6 Axion-IA n'utilise que des offres professionnelles de fournisseurs d'IA dont les conditions excluent l'entraînement de leurs modèles sur les données du Client, ou dont elle a désactivé cet usage. Ces fournisseurs peuvent conserver temporairement les données pour la sécurité et la prévention des abus (annexe 3). Axion-IA n'entraîne ni n'ajuste aucun modèle avec les Données du Client, sauf ajustement réservé au seul Client et prévu au devis.",
        },
        {
          title: "Article 27. Règlement européen sur l'intelligence artificielle",
          anchor: "article-27",
          body: "27.1 Rôles. Pour chaque Automatisation utilisant l'IA, Axion-IA agit comme fournisseur au sens du règlement (UE) 2024/1689 pour la conception du système tel que livré ; le Client agit comme déployeur. En formule A, après la Livraison finale, le Client devient seul fournisseur de toute version qu'il modifie substantiellement, qu'il exploite sous son propre nom auprès de tiers ou dont il change la destination décrite à la fiche du système, et en supporte seul les obligations.\n27.2 Transparence. Axion-IA conçoit toute Automatisation qui dialogue avec des personnes pour qu'elles soient informées, dès la première interaction, qu'elles échangent avec une IA, et met en place le marquage des contenus de synthèse quand le règlement l'exige. Le Client ne supprime ni ne masque ces mentions. En qualité de déployeur, il signale les hypertrucages et les textes générés par IA qu'il publie pour informer le public sur des questions d'intérêt public, sauf relecture humaine sous sa responsabilité éditoriale.\n27.3 Usages exclus. Sauf devis spécifique les désignant expressément, aucune Automatisation n'est conçue ni fournie pour un usage interdit par l'article 5 du règlement ou à haut risque au sens de son article 6 et de son annexe III, notamment : tri, classement ou évaluation de candidats ou de salariés, surveillance de leur performance, évaluation de la solvabilité de personnes physiques, tarification d'assurance vie ou santé, reconnaissance des émotions sur le lieu de travail. Le Client s'interdit d'y affecter une Automatisation ; s'il le fait, il en devient le fournisseur, Axion-IA peut la suspendre (article 28) et le Client garantit Axion-IA des conséquences civiles de cet usage, y compris les frais de défense, dans la mesure permise par la loi.\n27.4 Maîtrise de l'IA. Chaque partie prend, pour son personnel et les personnes agissant pour son compte, des mesures pour favoriser la maîtrise de l'IA. Axion-IA remet un guide d'utilisation à la Mise en service.\n27.5 Incidents et coopération. Chaque partie informe l'autre sans délai de tout comportement d'une Automatisation susceptible de causer un dommage ou de méconnaître le règlement ; la désactivation immédiate de la fonction concernée n'est pas un manquement. Chaque partie fournit à l'autre les informations nécessaires pour répondre à une autorité et supporte les conséquences des manquements relevant de son rôle.",
        },
        {
          title: "Article 28. Mesures graduées : limitation, suspension",
          anchor: "article-28",
          body: "28.1 Axion-IA peut appliquer, en commençant par la moins contraignante adaptée à la situation : (a) une alerte écrite ; (b) une limitation des volumes, du débit ou de certaines fonctions ; (c) un mode restreint, l'Automatisation ou le site cessant ses traitements mais le Client gardant l'accès en lecture et l'export de ses données ; (d) une suspension totale du service concerné, données conservées et export possible sur demande ; (e) la résiliation (articles 10.5 et 43).\n28.2 Cas et délais : impayé, article 10 ; dépassement de volume, article 24 ; usage interdit sans urgence, mise en demeure de 8 jours puis (b) à (d) ; risque grave et immédiat pour la sécurité, usage manifestement illicite, consommation anormale, demande d'une autorité ou suspension par un fournisseur d'IA, (b) à (d) sans préavis, sur la seule partie concernée, avec une information motivée sans délai ; fin du contrat, maintien du service ou du mode restreint pendant la période de restitution de l'article 35.\n28.3 Une mesure prise conformément au présent article est une exception d'inexécution (articles 1219 et 1220 du Code civil) : elle n'ouvre droit à aucune indemnité ni avoir et ne suspend pas les paiements. Aucune donnée n'est supprimée. Le service reprend dans les 2 Jours ouvrés suivant la disparition de la cause.\n28.4 Aucune mesure n'est prise à raison de l'ouverture d'une procédure de prévention ou d'une procédure collective du Client, ni pour des sommes nées avant son jugement d'ouverture (article 45).",
        },
        {
          title: "Article 29. Services extérieurs",
          anchor: "article-29",
          body: "29.1 Principe. Le fonctionnement d'une Automatisation, d'un site ou d'un hébergement chez le Client peut nécessiter des Services extérieurs : serveur quand l'hébergement n'est pas assuré par Axion-IA, nom de domaine, messagerie, logiciels ou abonnements à des outils tiers essentiels, connecteurs, comptes chez des éditeurs. Le Client les souscrit à son nom, accepte les conditions des tiers et les paie directement à ces tiers ; leurs prix ne font pas partie du prix d'Axion-IA.\n29.2 Services connus et budget estimé. Le devis liste les Services extérieurs déjà identifiés, chacun marqué obligatoire ou facultatif, avec un prix indicatif et son rythme. Comme certains ne peuvent être connus qu'au cours de la conception ou du développement, le devis indique aussi un budget mensuel estimé des Services extérieurs (montant : valeur fixée au devis), que le Client reconnaît comme une estimation.\n29.3 Engagement du Client. Le Client s'engage à souscrire et à maintenir actifs pendant toute la durée d'utilisation les Services extérieurs obligatoires, y compris ceux identifiés en cours de projet, dès lors que leur coût cumulé reste dans le budget estimé majoré de (marge : valeur fixée au devis ; à défaut : 20 %).\n29.4 Service découvert en cours de projet. Quand Axion-IA identifie un Service extérieur nécessaire non prévu au devis, elle le notifie par écrit au Client avant toute dépense : le service, la raison pour laquelle il est nécessaire, son coût indicatif et, si elles existent, les solutions de remplacement avec leurs limites. Le Client souscrit ce service ou retient une solution de remplacement dans les (délai : valeur fixée au devis ; à défaut : 10 jours ouvrés). Pendant ce délai, les délais du projet sont suspendus.\n29.5 Refus ou silence du Client.\n• (a) Si une solution de remplacement existe, Axion-IA la met en œuvre ; un éventuel surcroît de travail fait l'objet d'un avenant, et la perte de fonctionnalité qui en résulte n'est pas un manquement d'Axion-IA.\n• (b) Sans solution de remplacement, les parties réduisent le périmètre par avenant aux fonctions réalisables sans ce service ; le prix des fonctions abandonnées non commencées n'est pas dû, le travail réalisé reste dû.\n• (c) Si le service se situe dans le budget estimé majoré et que son refus rend le projet impossible, le Client est réputé avoir exercé la faculté de dédit de l'article 42 à la date de son refus ou à l'expiration du délai de 29.4.\n• (d) Si le service fait dépasser le budget estimé majoré, le Client peut le refuser sans indemnité de dédit : il ne paie alors que le travail réalisé et les dépenses engagées avec son accord.\n29.6 Pendant l'exploitation. Si le Client résilie, laisse expirer ou ne paie pas un Service extérieur obligatoire, l'Automatisation peut cesser de fonctionner en tout ou partie ; ce n'est pas un manquement d'Axion-IA, et l'abonnement ou la maintenance restent dus. Axion-IA n'est tenue à aucune intervention pour rétablir le service avant sa réactivation par le Client ; l'intervention est alors facturée au taux du devis.\n29.7 Aide d'Axion-IA. Axion-IA peut aider le Client à souscrire ; elle ne souscrit rien en son nom ni pour son compte sans mandat écrit. Une dépense qu'elle avance sur mandat est refacturée selon l'article 7.4. Elle ne répond ni de la disponibilité, ni des changements de prix ou de conditions, ni de l'arrêt d'un Service extérieur ; si un service obligatoire devient indisponible, elle propose si possible une solution de remplacement, sur devis.\n29.8 Tout retard du Client à souscrire un Service extérieur obligatoire prolonge les délais d'autant.",
        },
        {
          title:
            "TITRE V – PROPRIÉTÉ, DONNÉES ET CONFIDENTIALITÉ · Article 30. Propriété intellectuelle : règles communes",
          anchor: "article-30",
          body: "30.1 Axion-IA reste titulaire des droits sur ses Briques, y compris intégrées à un livrable, et sur leurs améliorations générales. Elle conserve la libre disposition de son savoir-faire, protégé comme secret des affaires.\n30.2 Le Registre des briques (annexe 6) est remis avec le devis et mis à jour à chaque livraison. L'Inventaire de livraison, signé à la réception, liste les Éléments spécifiques. Tout élément remis qui n'est ni inscrit au Registre des briques ni un composant tiers est un Élément spécifique.\n30.3 Le Client reste titulaire de ses Données, contenus, marques et documents, et accorde à Axion-IA le droit de les utiliser pour la seule exécution du contrat.\n30.4 Composants tiers. Axion-IA tient un inventaire des composants tiers (nom, version, licence), remis à la Livraison finale et mis à jour à chaque évolution. Sauf accord écrit au devis, elle n'intègre aucun composant dont la licence imposerait la divulgation des Éléments spécifiques, des Briques ou des Données du Client (notamment GPL, AGPL, SSPL), ni aucun composant dont la licence interdit l'usage prévu ; en cas de non-conformité, elle remplace le composant, obtient la licence nécessaire ou modifie l'Automatisation, à ses frais.\n30.5 Code produit avec l'IA. Axion-IA peut utiliser des outils d'IA pour produire du code ; elle le relit, en vérifie les licences et en reste responsable comme de son propre travail.\n30.6 Les supports de formation, rapports d'audit et produits numériques suivent les règles du Titre VIII.",
        },
        {
          title: "Article 31. Formule A et sites web : cession et licences",
          anchor: "article-31",
          body: "31.1 Cession. Sous la condition suspensive du paiement complet du prix, Axion-IA cède au Client, à titre exclusif, les droits patrimoniaux d'auteur sur les Éléments spécifiques (code source et objet propres à l'Automatisation ou au site, flux, paramétrages, consignes rédigées pour le Client, documentation, maquettes et contenus créés pour lui) :\n• droits cédés : reproduction permanente ou provisoire, par tout moyen et sur tout support, y compris pour le chargement, l'affichage, l'exécution, la transmission et le stockage ; traduction, adaptation, modification, correction, évolution, intégration à d'autres logiciels ; mise sur le marché à titre gratuit ou onéreux (avec ou sans droit de commercialiser auprès de tiers : valeur fixée au devis ; à défaut : sans) ; représentation et communication au public. Le Client les exerce lui-même ou par tout tiers de son choix ;\n• destination : (valeur fixée au devis ; à défaut : les besoins de l'activité du Client et de ses sociétés liées) ;\n• territoire : monde entier ; durée : toute la durée légale de protection ;\n• rémunération : la part du prix indiquée au devis rémunère forfaitairement la cession (article L131-4 du Code de la propriété intellectuelle).\nChaque correction ou évolution d'un Élément spécifique, livrée et payée, est cédée aux mêmes conditions à sa livraison. Pour un élément non protégeable, notamment généré par un outil d'IA, Axion-IA remet les fichiers et renonce à opposer au Client tout droit sur cet élément, sans garantir sa protection contre les tiers.\n31.2 Licence des Briques. Sous la même condition, Axion-IA concède au Client une licence non exclusive, mondiale, pour toute la durée de protection, irrévocable sauf défaut de paiement, de reproduction, d'adaptation, de modification et de correction des Briques intégrées, aux seules fins d'exploiter, maintenir, corriger et faire évoluer l'Automatisation ou le site. Le Client peut la faire exercer par un prestataire tenu à la confidentialité. Elle se transmet avec l'Automatisation, sur information écrite, à une société liée ou à toute entité qui reprend tout ou partie de l'activité du Client. Le Client s'interdit d'extraire les Briques pour les exploiter ou les mettre à disposition de tiers indépendamment de l'Automatisation. Rien ne restreint les droits que le Client tient de l'article L122-6-1 du Code de la propriété intellectuelle.\n31.3 Licence en retour. Sauf case contraire au devis, le Client concède à Axion-IA une licence gratuite, non exclusive, mondiale et pour la durée des droits, sur les parties techniques génériques des Éléments spécifiques, à l'exclusion de toute Donnée, information confidentielle ou élément distinctif du Client.\n31.4 Droit moral. L'auteur d'un logiciel ne peut s'opposer à sa modification par le Client, sauf atteinte à son honneur ou à sa réputation. Le Client peut adapter maquettes et contenus graphiques pour les besoins de son activité, sans les dénaturer.\n31.5 La Livraison finale en formule A comprend le code source, la documentation d'installation et l'inventaire des composants tiers. Si le Client modifie l'Automatisation, Axion-IA n'est plus responsable des parties modifiées.",
        },
        {
          title: "Article 32. Formule B : usage et sorties",
          anchor: "article-32",
          body: "32.1 Axion-IA reste titulaire de l'Automatisation et des Briques ; le Client en a l'usage défini à l'article 20.3.\n32.2 Les contenus produits pour le Client par l'Automatisation lui appartiennent dans la mesure où des droits existent sur eux. Axion-IA ne garantit pas l'existence de droits sur les contenus générés par IA.\n32.3 À la fin de l'abonnement, en plus des Données du Client, Axion-IA remet une documentation fonctionnelle des Automatisations (déclencheurs, règles, enchaînements, consignes rédigées pour le Client) qui permet de les reconstruire ailleurs.",
        },
        {
          title: "Article 33. Garanties de propriété intellectuelle",
          anchor: "article-33",
          body: "33.1 Le Client garantit qu'il a le droit de fournir et de faire traiter ce qu'il confie à Axion-IA et vérifie les droits disponibles sur les contenus produits avec l'IA avant de les publier.\n33.2 Axion-IA garantit le Client contre toute action d'un tiers prétendant qu'un Élément spécifique ou une Brique, utilisé conformément au contrat, porte atteinte à ses droits. Le Client notifie la réclamation sans délai, laisse à Axion-IA la conduite de la défense et lui apporte son concours. Axion-IA prend en charge les frais de défense et les condamnations définitives, ou la transaction qu'elle a acceptée ; elle peut aussi obtenir le droit de continuer l'usage, modifier ou remplacer l'élément, ou à défaut rembourser son prix, amorti sur 36 mois.\n33.3 Sont exclus de cette garantie : les modifications par le Client ou un tiers, la combinaison avec des éléments non fournis par Axion-IA, les instructions ou contenus du Client, les composants tiers et les résultats générés par l'IA. Pour ces derniers, Axion-IA fait bénéficier le Client, dans la mesure permise, des garanties que le fournisseur d'IA lui consent.\n33.4 Le Client garantit Axion-IA contre toute réclamation d'un tiers fondée sur ce qu'il a fourni ou sur un usage contraire au contrat.\n33.5 Les garanties des articles 33.2 et 33.4 sont plafonnées, pour chaque partie, à (plafond : valeur fixée au devis ; à défaut : deux fois le prix HT du devis), sauf faute lourde ou dol.",
        },
        {
          title: "Article 34. Données personnelles",
          anchor: "article-34",
          body: "34.1 Pour ses propres fichiers (clients, prospects, facturation, support, journaux de sécurité, comptage des volumes), Axion-IA est responsable de traitement ; sa politique de confidentialité s'applique. Elle ne réutilise ni les Données du Client ni les contenus produits pour lui dans ses Briques.\n34.2 Quand Axion-IA traite des données personnelles pour le compte du Client (hébergement, Automatisation, site, audit, intervention sur ses systèmes), elle est sous-traitant au sens de l'article 28 du RGPD. Ce traitement est régi par l'accord de traitement des données (annexe 1), fondé sur les clauses contractuelles types de la Commission européenne (décision 2021/915), annexé au devis et accepté par la même signature.\n34.3 Axion-IA ne traite ces données que sur instruction documentée du Client. Elle tient le registre de l'article 30.2 du RGPD. Elle n'utilise pas de données personnelles réelles dans ses environnements de développement ou de test sans instruction écrite et supprime les copies faites pour une intervention à la fin de celle-ci.\n34.4 Les transferts hors de l'Union européenne n'ont lieu que vers les sous-traitants de l'annexe 3, avec la garantie indiquée pour chacun ; l'acceptation de l'annexe 3 vaut instruction documentée. Si une décision d'adéquation est invalidée, Axion-IA met en place une autre garantie ou un fournisseur établi dans l'Union dans les meilleurs délais ; le Client peut suspendre sans frais les fonctions concernées.\n34.5 Axion-IA notifie au Client toute violation de données dans les meilleurs délais et au plus tard 48 heures après en avoir eu connaissance (24 heures si le Client a souscrit l'option de sécurité renforcée), puis complète les informations par étapes.\n34.6 Axion-IA aide le Client à répondre aux demandes des personnes concernées et lui remet, pour chaque Automatisation traitant des données personnelles, une fiche qui l'aide à décider s'il doit réaliser une analyse d'impact.\n34.7 Le Client peut vérifier le respect de ces règles une fois par an, avec un préavis de 30 jours, sauf violation ou injonction d'une autorité : d'abord sur documents, puis sur place par un auditeur tenu au secret et non concurrent, à ses frais sauf manquement avéré.\n34.8 En formule A sur le serveur du Client, Axion-IA n'est sous-traitant que pendant ses interventions.",
        },
        {
          title: "Article 35. Restitution, changement de fournisseur et sort des données",
          anchor: "article-35",
          body: "35.1 Export. Le Client peut obtenir à tout moment un export de ses Données dans un format courant et lisible par machine. À la fin du contrat, quelle qu'en soit la cause, Axion-IA le lui remet sans qu'il ait à le demander, avec, en formule A hébergée, l'Automatisation (code, configuration, documentation) et, pour un site, ses fichiers, sa base de données et le transfert du nom de domaine. L'export des Données n'est jamais retenu, même en cas d'impayé ; seule la remise de l'Automatisation et des fichiers du site peut attendre le paiement complet.\n35.2 Changement de fournisseur (règlement (UE) 2023/2854). Pour l'hébergement et la formule B, le Client peut demander à changer de fournisseur ou à rapatrier ses données, avec un préavis d'au plus 2 mois. Axion-IA maintient alors le service pendant une période de transition de 30 jours, prolongeable une fois par le Client, l'aide dans sa stratégie de sortie et lui laisse au moins 30 jours pour extraire ses données. La liste des données et actifs exportables figure à l'annexe 1. L'export standard est gratuit ; jusqu'au 11 janvier 2027, une aide supplémentaire au changement est facturée à son coût réel, et elle est gratuite à partir du 12 janvier 2027.\n35.3 Sort des données après l'export. Axion-IA ne détruit aucune donnée du Client à la fin du contrat. Elle remet l'export (article 35.1) puis met les données à l'écart : archivées, chiffrées, isolées et inaccessibles à tout traitement (article 35.5), pendant (durée d'archivage : valeur fixée au devis ; à défaut : illimitée tant que le Client ne demande pas l'effacement).\n35.4 Effacement uniquement sur demande écrite. Les données ne sont effacées que si le Client le demande par écrit. Axion-IA vérifie le pouvoir du demandeur, l'informe des conséquences et lui rappelle qu'il peut d'abord obtenir un nouvel export, puis un responsable d'Axion-IA exécute l'effacement et en délivre une attestation. Aucun programme automatique n'efface de données. Axion-IA peut aussi effacer lorsque la loi l'y oblige.\n35.5 Pendant l'archivage, les données sont chiffrées, isolées, inaccessibles aux traitements et soumises à l'annexe 1. Une demande d'effacement est exécutée sous 30 jours ; les sauvegardes suivent leur rotation, au plus 35 jours. Seules les données qu'une loi impose à Axion-IA de garder (facturation, preuves de signature) sont conservées, pour la durée légale.",
        },
        {
          title: "Article 36. Confidentialité et secrets des affaires",
          anchor: "article-36",
          body: "36.1 Chaque partie garde confidentielles les informations non publiques reçues de l'autre, y compris celles vues ou entendues sur place, et ne les utilise que pour le contrat. Elle impose la même obligation à son personnel et à ses prestataires.\n36.2 Ne sont pas confidentielles les informations publiques, déjà connues, reçues légalement d'un tiers ou dont la loi ou une autorité impose la communication.\n36.3 Chaque partie protège les secrets des affaires de l'autre par des mesures raisonnables. Les consignes, flux, paramétrages et méthodes d'Axion-IA sont des secrets des affaires. Aucune information confidentielle n'est transmise à un fournisseur d'IA dont les conditions en permettent la réutilisation pour l'entraînement.\n36.4 Cette obligation dure pendant le contrat et (durée : valeur fixée au devis ; à défaut : 3 ans) après sa fin, sans limite pour les données personnelles et les secrets des affaires.",
        },
        {
          title: "Article 37. Références commerciales",
          anchor: "article-37",
          body: "37.1 Axion-IA ne cite le nom, le logo ou le projet du Client comme référence qu'avec son accord écrit, donné par une case distincte du devis. Cet accord couvre le nom, le logo et une description du projet sans information confidentielle, y compris dans une liste de références non publique remise à un prospect.\n37.2 Le Client peut retirer cet accord à tout moment ; Axion-IA retire alors la référence de ses supports dans un délai raisonnable.",
        },
        {
          title: "TITRE VI – RESPONSABILITÉ · Article 38. Responsabilité",
          anchor: "article-38",
          body: "38.1 Chaque partie répond des dommages directs causés par sa faute prouvée.\n38.2 Plafond. La responsabilité totale d'Axion-IA, toutes causes confondues, est plafonnée : pour une prestation ponctuelle, au prix HT payé ou dû pour cette prestation ; pour un abonnement, un hébergement ou une maintenance, au montant HT payé ou dû au cours des 12 mois précédant le fait générateur ou, si le fait survient après la fin du contrat, des 12 derniers mois du contrat. Ce plafond ne peut être inférieur à (plancher : valeur fixée au devis ; à défaut : 5 000 euros).\n38.3 Chaque partie renonce à demander à l'autre la réparation des dommages indirects : perte de chiffre d'affaires, de bénéfice, de clientèle ou de chance, perte d'exploitation, atteinte à l'image.\n38.4 La perte ou l'altération de données n'est réparée que dans la limite du coût de leur restauration à partir de la dernière sauvegarde que la partie responsable devait réaliser.\n38.5 Axion-IA ne répond pas : de l'inexactitude ponctuelle d'un résultat d'IA dans les conditions de l'article 26.5 ; des Services extérieurs souscrits par le Client ; de ce que le Client a fourni ; d'une modification faite par le Client ou un tiers ; du serveur et des systèmes du Client. Elle répond de ses propres sous-traitants comme d'elle-même, dans la limite du plafond.\n38.6 Ces limites ne s'appliquent pas en cas de faute lourde ou de dol, de dommage corporel, ni à la responsabilité d'ordre public du fait des produits défectueux envers les personnes lésées. Entre les parties, chacune supporte la charge finale de cette dernière à proportion de sa contribution au défaut ; le Client garantit Axion-IA lorsque le défaut résulte d'une modification, d'une configuration ou d'un usage qui lui est imputable, ou du refus d'installer une mise à jour de sécurité proposée par écrit.\n38.7 Lorsque le Client intègre une Automatisation dans un produit qu'il met lui-même sur le marché, il renonce à tout recours contre Axion-IA au titre de l'article 12.2 de la directive (UE) 2024/2853, Axion-IA déclarant être une micro ou petite entreprise, dans la mesure permise par la loi applicable.\n38.8 Les limites des articles 38, 58 et 59 s'appliquent quel que soit le fondement de l'action, contractuel ou délictuel. Le prix tient compte de cette répartition des risques.",
        },
        {
          title: "Article 39. Force majeure",
          anchor: "article-39",
          body: "39.1 Aucune partie n'est responsable d'un manquement causé par un cas de force majeure au sens de l'article 1218 du Code civil. La partie empêchée prévient l'autre sans délai ; les obligations sont suspendues pendant l'empêchement, sauf l'obligation de payer une prestation déjà réalisée.\n39.2 Si l'empêchement dure plus de 60 jours, chaque partie peut résilier par écrit sans indemnité ; le travail réalisé reste dû au prorata.\n39.3 L'évolution d'un modèle d'IA ou la hausse de prix d'un fournisseur ne constituent pas à elles seules un cas de force majeure : elles relèvent de l'article 25.",
        },
        {
          title: "Article 40. Assurance du Client",
          anchor: "article-40",
          body: "40.1 Le Client est assuré pour les risques liés à son activité et à l'usage des livrables.",
        },
        {
          title:
            "TITRE VII – DURÉE ET FIN DU CONTRAT · Article 41. Abonnements : durée, reconduction et sortie",
          anchor: "article-41",
          body: "41.1 Durée. Un abonnement, un hébergement ou une maintenance commence à la Mise en service (ou à la fin des mois offerts) pour l'engagement minimum du devis (0, 3, 6, 12 ou 24 mois : valeur fixée au devis ; à défaut : 12 mois). À son terme, il est (reconduit par mois, reconduit par périodes de 12 mois, ou arrêté : valeur fixée au devis ; à défaut : reconduit par mois). Le Client peut mettre fin à la reconduction avec un préavis de (1, 2 ou 3 mois : valeur fixée au devis ; à défaut : 1 mois) ; Axion-IA, avec un préavis de 3 mois, en assurant la restitution de l'article 35.\n41.2 Sortie anticipée. Le Client peut résilier à tout moment, y compris pendant l'engagement minimum, avec le préavis du devis (3 mois au plus). Pendant l'engagement minimum, il verse une indemnité de sortie anticipée égale à (taux : valeur fixée au devis ; à défaut : 50 %) des mensualités restant à courir jusqu'au terme de l'engagement, hors utilisation de l'IA, majorée, si les frais de mise en service ont été remisés en contrepartie de l'engagement, du remboursement de cette remise au prorata de la durée restante. Le devis indique en clair, en euros, le montant maximal de cette indemnité (au début de l'engagement) et son mode de calcul ; le Client le reconnaît en cochant la case prévue à cet effet. Les périodes payées d'avance ne sont pas remboursées ; le service continue jusqu'à leur terme.\n41.3 Sorties sans frais. L'indemnité n'est pas due quand le Client résilie sur le fondement des articles 5.3 (modification des conditions), 8.3 (hausse hors indice), 17.3 (nouveau sous-traitant), 21.4 (disponibilité), 25 (fournisseurs d'IA), 43 (manquement d'Axion-IA) ou 55.2 (cession par Axion-IA). La période payée et non consommée lui est alors remboursée au prorata.\n41.4 Rappel. Axion-IA rappelle au Client par un courriel dédié, entre 3 mois et 1 mois avant la date limite de résiliation de chaque période, cette date et ses conséquences.\n41.5 Un changement de niveau suit l'article 24 ; une baisse de niveau demandée par le Client prend effet à la fin de la période payée et ne donne lieu à aucun avoir sur la période en cours.",
        },
        {
          title: "Article 42. Prestations ponctuelles : faculté de dédit et projet en sommeil",
          anchor: "article-42",
          body: "42.1 Faculté de dédit. Le Client peut à tout moment renoncer à une prestation ponctuelle en cours. Il paie alors : (i) le travail réalisé, au temps passé et au taux journalier du devis, et au minimum les phases réceptionnées ; (ii) les dépenses engagées avec son accord ; (iii) une indemnité de dédit égale à (taux : valeur fixée au devis ; à défaut : 25 %) du prix HT des phases non commencées et de la partie non réalisée de la phase en cours. Cette indemnité est le prix de la faculté de renoncer : elle rémunère la capacité réservée par Axion-IA, qui a refusé ou décalé d'autres missions, et les frais de préparation non amortis. Les sommes déjà versées s'imputent sur ce total ; seul l'excédent est remboursé.\n42.2 Projet en sommeil. Si le Client ne fournit pas un élément indispensable, ne valide pas ou ne répond pas pendant 60 jours malgré deux relances écrites, puis une mise en demeure visant le présent article restée sans effet 15 jours, il est réputé avoir exercé la faculté de l'article 42.1 à la date de la mise en demeure. Il peut l'éviter en relançant le projet dans ce délai.\n42.3 Une reprise après 6 mois de sommeil fait l'objet d'un nouveau devis (prix, outils, planning). Pendant le sommeil, l'environnement de test peut être arrêté ; il ne doit jamais servir en production.\n42.4 Les prestations à date fixe suivent l'article 46 et les formations l'article 49.",
        },
        {
          title: "Article 43. Résiliation pour manquement",
          anchor: "article-43",
          body: "43.1 Si une partie manque gravement à une obligation essentielle et n'y remédie pas dans les 30 jours d'une mise en demeure visant le présent article, l'autre partie peut résilier tout ou partie du contrat par écrit, sans préjudice de dommages et intérêts dans les limites de l'article 38. L'impayé suit l'article 10.\n43.2 Sont notamment des manquements graves du Client : l'impayé, l'usage interdit (articles 20.3, 23.5 et 27.3), la violation des droits d'Axion-IA. Sont notamment des manquements graves d'Axion-IA : la non-conformité persistante des livrables, le non-respect des sauvegardes, une disponibilité inférieure à 95 % deux mois de suite, le refus de restituer les Données du Client.\n43.3 Si Axion-IA résilie pour manquement du Client pendant l'engagement minimum, l'indemnité de l'article 41.2 est due. Si le Client résilie pour manquement d'Axion-IA, Axion-IA rembourse au prorata la période payée d'avance non utilisée et les sommes versées pour des phases non réceptionnées, et aucune indemnité n'est due.",
        },
        {
          title: "Article 44. Effets de la fin du contrat",
          anchor: "article-44",
          body: "44.1 À la fin du contrat : les sommes dues deviennent exigibles ; le travail réalisé et les phases réceptionnées restent acquis à Axion-IA ; la restitution de l'article 35 s'applique, le service ou le mode restreint étant maintenu pendant la période de restitution ; en formule B, le droit d'utilisation prend fin ; en formule A payée en entier, le Client garde les Éléments spécifiques et la licence des Briques.\n44.2 Restent en vigueur après la fin : la confidentialité, la propriété intellectuelle, la responsabilité, la protection des données, la non-sollicitation et le règlement des litiges.",
        },
        {
          title: "Article 45. Procédure collective et changement de contrôle du Client",
          anchor: "article-45",
          body: "45.1 L'ouverture d'une procédure de sauvegarde, de redressement ou de liquidation judiciaire du Client ne modifie pas le contrat par elle-même. Les prestations postérieures au jugement d'ouverture sont payables à leur échéance ; à défaut, les articles 10 et 28 s'appliquent à ces seules sommes. Le Client ou son administrateur informe Axion-IA dans les 8 jours de l'ouverture.\n45.2 Un changement de contrôle du Client est notifié à Axion-IA sous 30 jours. Le contrat se poursuit et la confidentialité et la non-sollicitation lient le nouvel ensemble. Axion-IA peut résilier sans indemnité, avec un préavis d'un mois, si le repreneur exerce une activité directement concurrente de la sienne.",
        },
        {
          title:
            "TITRE VIII – RÈGLES PROPRES À CHAQUE ACTIVITÉ · Article 46. Prestations à date fixe",
          anchor: "article-46",
          body: "46.1 Cet article vise les prestations à date convenue : journée en entreprise, audit sur place, atelier. Les formations suivent l'article 49 et le coaching l'article 50.\n46.2 Toute annulation par le Client se calcule en Jours ouvrés avant la date de début : plus de 15 jours, aucune somme due et acomptes remboursés ; entre 8 et 15 jours, 50 % du prix HT reste dû à titre de dédit ; moins de 8 jours, 100 % du prix HT reste dû à titre de dédit, ainsi que les frais de déplacement engagés.\n46.3 La prestation peut être reportée une fois sans frais, à une date convenue dans les 3 mois.\n46.4 Si Axion-IA annule (empêchement de l'intervenant, force majeure), elle propose une nouvelle date ; si le Client la refuse, les sommes versées pour la prestation annulée sont remboursées, sans autre indemnité.",
        },
        {
          title: "Article 47. Journée en entreprise",
          anchor: "article-47",
          body: "47.1 Contenu. La journée comprend, à la date fixée au devis : (a) un audit sur place de (durée : valeur fixée au devis ; à défaut : 3 heures) ; (b) une session de formation de (durée : valeur fixée au devis ; à défaut : 3 heures) pour (nombre maximal : valeur fixée au devis ; à défaut : 12) participants ; (c) un rapport écrit de synthèse remis dans les (délai : valeur fixée au devis ; à défaut : 10 jours ouvrés). Le prix est forfaitaire ; le devis indique la part qui correspond à l'audit et celle qui correspond à la formation, qui sert à la facturation et au calcul des sommes dues en cas d'annulation ou d'inexécution partielle.\n47.2 Régimes. L'audit relève de l'article 48. La session de formation relève de l'article 49 ; la convention est signée en même temps que le devis.\n47.3 Participants et moyens. Le prix ne dépend pas du nombre de participants présents ; une absence ne donne droit à aucune réduction ni à aucun report. Le Client fournit une salle adaptée, un écran, une connexion internet et, pour l'audit, un interlocuteur qui peut décider et les personnes listées au devis. Si ces moyens manquent, la journée est exécutée au mieux, sans réduction de prix.\n47.4 Horaires. Le temps perdu à cause d'un retard du Client n'est ni rattrapé ni remboursé. Un dépassement de moins de 30 minutes n'est pas facturé ; au-delà, chaque heure commencée est facturée (taux horaire : valeur fixée au devis), seulement si le Client l'a demandé par écrit sur place.\n47.5 Déplacement. Le prix comprend le déplacement dans un rayon de (distance : valeur fixée au devis ; à défaut : 50 km) autour de Grenoble ; au-delà, le forfait de déplacement du devis s'applique.\n47.6 Annulation et événements extérieurs. Le barème de l'article 46 s'applique au prix total. Si personne n'accueille Axion-IA ou si l'accès aux locaux est refusé le jour même, le prix est dû en entier, avec les frais de déplacement. Une vigilance météorologique orange ou rouge sur le trajet ou le lieu, une grève des transports qui empêche d'arriver ou une fermeture administrative du site ouvrent droit à un report sans frais dans les 3 mois ou à une tenue à distance ; si le report est impossible, les sommes versées pour la partie non exécutée sont remboursées, sans autre indemnité.\n47.7 Passage à un projet. Si le Client signe, dans les (délai : valeur fixée au devis ; à défaut : 90 jours) suivant la remise du rapport, un devis de mise en place d'une Automatisation recommandée dans ce rapport, (montant déduit : valeur fixée au devis ; à défaut : 0 euro) du prix de la journée est déduit de ce devis, une seule fois ; cette déduction n'est ni remboursable ni cessible.\n47.8 Sécurité sur place. Le Client communique ses consignes de sécurité et ses règles d'accès et organise, si elles s'imposent, les mesures de prévention prévues pour l'intervention d'une entreprise extérieure (articles R4512-2 et suivants du Code du travail). Axion-IA n'utilise aucune machine, aucun équipement de production ni aucun véhicule du Client et ne circule que dans les zones désignées.\n47.9 Signature. Le devis est signé à distance, de préférence après la visite. S'il est signé dans les locaux du Client ou juste après une sollicitation dans ces locaux, l'article 53 s'applique.",
        },
        {
          title: "Article 48. Audit",
          anchor: "article-48",
          body: "48.1 Nature. L'audit est une prestation de conseil soumise à une obligation de moyens. Le devis fixe son périmètre, sa durée et sa méthode. Le rapport décrit la situation à la date de l'audit, d'après ce qui a été montré et dit à Axion-IA ; il ne vaut ni certification, ni audit de sécurité, ni vérification de conformité.\n48.2 Points juridiques. Quand l'audit fait apparaître une question juridique (données personnelles, réglementation de l'IA, droit du travail, contrats), Axion-IA la signale comme point d'attention à faire examiner par un professionnel du droit habilité ; elle ne donne pas de consultation juridique.\n48.3 Chiffres. Tout chiffre du rapport (temps gagné, coût, retour sur investissement) est présenté avec ses hypothèses : c'est un scénario, ni un objectif ni un engagement.\n48.4 Usage du rapport. Le rapport sert à l'usage interne et aux décisions du Client, qui reste seul responsable de ses choix. Le Client peut le communiquer, sous confidentialité et après en avoir informé Axion-IA par écrit, à ses conseils, à son expert-comptable, à ses financeurs ou à un acquéreur, en leur indiquant qu'il ne leur est pas destiné. Aucun tiers ne peut s'en prévaloir contre Axion-IA. Toute autre diffusion, avec ou sans mention d'Axion-IA, demande son accord écrit. Le Client garantit Axion-IA contre la réclamation d'un tiers à qui il a communiqué le rapport, pour la part qui dépasse ce qu'Axion-IA devrait au Client lui-même.\n48.5 Accès et données vues sur place. Axion-IA n'utilise les accès aux locaux, outils et documents que pour l'audit, privilégie les démonstrations faites par le personnel du Client et ne copie aucune donnée sans accord écrit. Si des identifiants lui sont confiés, le Client les modifie après l'audit. Pour les données personnelles vues pendant l'audit, Axion-IA agit comme sous-traitant (article 34). Le Client informe à l'avance ses salariés concernés ; le rapport ne nomme aucun salarié.\n48.6 Réutilisation anonymisée. Par exception à l'article 30.3, Axion-IA peut réutiliser des constats agrégés et anonymisés, sans donnée personnelle ni secret des affaires, qui ne permettent d'identifier ni le Client, ni son personnel, ni ses clients, pour ses méthodes, statistiques, publications et formations. Le Client peut s'y opposer par une case du devis.\n48.7 Propriété. Axion-IA reste titulaire des droits sur le rapport, ses grilles et sa méthode. Après paiement complet, le Client reçoit une licence non exclusive, gratuite et sans limite de durée, pour ses besoins internes et les communications prévues à l'article 48.4.",
        },
        {
          title: "Article 49. Formation professionnelle",
          anchor: "article-49",
          body: "49.1 Les actions de formation relèvent des articles L6313-1 et suivants du Code du travail. Une convention de formation conforme à l'article D6353-1 est conclue avec l'entreprise cliente ; elle est annexée au devis et acceptée par la même signature. Pour une formation, la convention l'emporte sur les présentes conditions, et les articles 6.5, 14, 15 et 42 ne s'appliquent pas : le prix est dû au vu des heures réalisées.\n49.2 Personne physique qui paie elle-même. Axion-IA ne conclut pas de contrat de formation avec une personne physique qui suit la formation pour elle-même et la paie sur ses propres fonds : la formation est commandée et payée par une entreprise, ou financée par un tiers. Si une telle commande est exceptionnellement acceptée, un contrat de formation conforme aux articles L6353-3 à L6353-7 du Code du travail est conclu avant toute inscription définitive et la personne dispose, comme la loi l'impose, de 10 jours à compter de la signature pour se rétracter par lettre recommandée avec accusé de réception ; aucune somme n'est exigible pendant ce délai ; ensuite, le premier versement ne dépasse pas 30 % du prix et le solde est échelonné au fur et à mesure de la formation.\n49.3 Information du stagiaire. Avant l'inscription définitive, chaque stagiaire reçoit le programme, les objectifs, la liste des formateurs avec leurs titres et qualités, les horaires, les modalités d'évaluation, le règlement intérieur et le contact de la personne chargée des relations avec les stagiaires.\n49.4 Assiduité. Chaque stagiaire signe une feuille d'émargement par demi-journée, contresignée par le formateur ; à distance, la présence est prouvée par les relevés de connexion et les travaux d'évaluation. Une attestation de fin de formation est remise au stagiaire.\n49.5 Dédit. En cas d'annulation par le Client moins de 15 Jours ouvrés avant le début, ou d'absence non justifiée par la force majeure, le Client verse à Axion-IA, à titre de dédit, une indemnité de 50 % (entre 8 et 15 Jours ouvrés) ou de 100 % (moins de 8 Jours ouvrés) du prix des heures non réalisées. Cette indemnité n'est pas le prix d'une action de formation : elle fait l'objet d'une facture distincte portant la mention « Indemnité de dédit – ne constitue pas une dépense de formation professionnelle ». Le Client peut remplacer sans frais un stagiaire par une personne de même profil jusqu'à la veille du début. Le report suit l'article 46.3.\n49.6 Abandon en cours de formation. Les heures réalisées restent dues au prorata. Les sommes versées pour des heures non réalisées et non couvertes par l'indemnité de dédit sont remboursées (article L6354-1 du Code du travail).\n49.7 Réclamations. Toute réclamation peut être adressée à contact@axion-ia.com. Axion-IA en accuse réception sous 5 Jours ouvrés et répond sous 30 jours. L'article 59 ne fait pas obstacle aux réclamations des stagiaires.\n49.8 Supports. Les supports de formation restent la propriété d'Axion-IA. Ils sont réservés à l'usage personnel des stagiaires et à l'usage interne du Client, sans revente ni diffusion à l'extérieur.\n49.9 Une formation peut contribuer aux mesures prises par le Client pour favoriser la maîtrise de l'IA de ses équipes ; elle ne vaut ni certification ni attestation de conformité à une réglementation.",
        },
        {
          title: "Article 50. Coaching",
          anchor: "article-50",
          body: "50.1 Qualification. Le devis qualifie chaque accompagnement individuel, sans changement possible ensuite : « Coaching » (prestation de conseil personnalisé, soumise à la TVA) ou « Accompagnement individuel de formation » (programme écrit, objectifs professionnels évaluables, émargement de chaque séance, évaluation), qui relève alors aussi de l'article 49.\n50.2 Coach désigné. Le coaching est conclu en considération du coach nommé au devis, qui n'est remplacé qu'avec l'accord écrit du Client. S'il est empêché plus de 30 jours, le Client choisit entre le report des séances, un coach de remplacement proposé par Axion-IA ou la fin du coaching avec remboursement des séances non réalisées, sans autre indemnité.\n50.3 Confidentialité. Le contenu des séances est confidentiel, y compris envers l'entreprise qui paie. Axion-IA ne lui communique que les dates et le nombre de séances réalisées et, avec l'accord du bénéficiaire, une synthèse qu'il a validée, sauf risque grave et imminent pour le bénéficiaire ou pour autrui, ou obligation légale.\n50.4 Limites. Le coaching n'est ni une thérapie, ni un conseil médical, psychologique, juridique, fiscal ou financier ; le coach peut orienter le bénéficiaire vers un professionnel. Le bénéficiaire décide seul et reste responsable de ses décisions. Aucun résultat n'est garanti.\n50.5 Indépendance. Le coach signale tout conflit d'intérêts. Axion-IA peut accompagner d'autres dirigeants, y compris du même secteur, sans jamais leur transmettre d'information.\n50.6 Séances. Par dérogation à l'article 46, une séance annulée moins de 48 heures avant est due, sauf force majeure ; un retard de plus de 15 minutes réduit d'autant la séance. Les séances sont valables (durée : valeur fixée au devis ; à défaut : 6 mois) à compter de la première ; Axion-IA rappelle par écrit leur date de fin 30 jours avant et le Client peut obtenir une prolongation unique de 3 mois. Une séance non réalisée du fait d'Axion-IA n'est jamais perdue.\n50.7 Visio et notes. Aucune séance n'est enregistrée sans l'accord écrit préalable des deux parties. Les notes du coach ne sont communiquées à personne ; Axion-IA en est responsable de traitement et les conserve pendant la durée du coaching et un an après, puis les supprime.",
        },
        {
          title: "Article 51. Sites web",
          anchor: "article-51",
          body: "51.1 Périmètre. Le cahier des charges annexé au devis fixe le nombre de pages et de gabarits, les langues, les fonctions (formulaire, réservation, paiement, agent conversationnel), la technologie et les intégrations ; ce qui n'y figure pas est exclu.\n51.2 Maquettes. Sont inclus (nombre : valeur fixée au devis ; à défaut : 2) propositions de maquette et (nombre : valeur fixée au devis ; à défaut : 2) séries de retours par phase, chacune envoyée en une liste écrite unique ; au-delà, un avenant est nécessaire.\n51.3 Contenus. Le Client fournit ses textes, images, logos et informations légales. Faute de contenus remis à la date prévue, Axion-IA intègre des éléments provisoires signalés comme tels ; le site n'est mis en ligne avec eux qu'à la demande écrite du Client et sous sa responsabilité. Les contenus produits avec l'IA sont remis comme projets que le Client valide. Les polices, images et vidéos de tiers sont acquises au nom du Client ou sous une licence qui couvre son usage ; leur liste et les crédits à afficher sont remis à la livraison.\n51.4 Compatibilité. Le site est compatible avec les deux dernières versions majeures de Chrome, Edge, Firefox et Safari à la date de livraison, sur ordinateur et sur mobile.\n51.5 Mise en ligne. La recette a lieu sur un environnement de préproduction (article 14) ; la réception rend le solde exigible ; la mise en ligne a lieu après le paiement du solde. Le nom de domaine est enregistré au nom du Client.\n51.6 Référencement. Seules les optimisations techniques de base listées au devis sont incluses. Axion-IA ne promet aucune position dans les moteurs de recherche ni aucun volume de visites.\n51.7 Données, cookies et agent conversationnel. Le Client, éditeur du site, est responsable de traitement pour les données qu'il collecte (formulaires, traceurs, mesure d'audience, agent conversationnel) et de ses mentions légales ; il fournit les informations légales exigées, que Axion-IA intègre. Axion-IA n'installe que les traceurs listés au devis et, si le devis le prévoit, un bandeau de consentement que le Client valide. Pour un agent conversationnel, le Client décide de son déploiement et des documents qui l'alimentent et répond de ses réponses envers les visiteurs ; Axion-IA configure la mention indiquant qu'ils échangent avec une IA.\n51.8 Accessibilité. Le devis indique le niveau d'accessibilité visé (aucun engagement, bonnes pratiques ou conformité au référentiel en vigueur : valeur fixée au devis ; à défaut : bonnes pratiques). Avant le devis, Axion-IA signale au Client si son site paraît soumis à une obligation légale d'accessibilité.\n51.9 Hébergement et après livraison. Le site est hébergé par le Client ou par Axion-IA (article 21) (choix : valeur fixée au devis). Quand Axion-IA l'héberge, le Client la mentionne comme hébergeur, et Axion-IA peut retirer un contenu manifestement illicite qui lui est notifié, en informant le Client. Sans maintenance, à la fin de la garantie, le Client assure les mises à jour et les sauvegardes ; Axion-IA ne répond pas d'une faille rendue publique après la livraison.\n51.10 Crédit. Avec l'accord du Client donné par une case distincte, Axion-IA peut placer en pied de page la mention « Site réalisé par Axion-IA » ; le Client peut retirer cet accord à tout moment.",
        },
        {
          title: "Article 52. Produits numériques",
          anchor: "article-52",
          body: "52.1 Objet. La fiche produit décrit le produit (modèles de documents, bibliothèques de consignes pour l'IA, gabarits et flux à importer, formations en ligne, guides), son format, les outils et versions compatibles et la durée d'accès.\n52.2 Licence. Le Client reçoit une licence non exclusive et non transférable, pour ses besoins internes, réservée à (nombre : valeur fixée au devis ; à défaut : 1) utilisateur(s) nommé(s), sans limite de durée pour les fichiers téléchargés et pour (durée : valeur fixée au devis ; à défaut : 12 mois) pour les accès en ligne. Il peut adapter les modèles à son usage interne. Sont interdits la revente, la sous-licence, la publication, la mise à disposition de ses propres clients sans licence « revendeur », le partage des identifiants, la création d'un produit concurrent et l'utilisation pour entraîner un modèle d'IA.\n52.3 Usage non autorisé. Chaque utilisateur en trop est facturé au tarif public en vigueur pour toute la période d'usage ; après mise en demeure sans effet, l'accès peut être suspendu.\n52.4 Livraison. L'accès est fourni sous 24 heures après le paiement. Le Client signale dans les 7 jours tout fichier inaccessible ou défectueux ; Axion-IA le remplace ou, si c'est impossible dans les 7 jours, rembourse le prix.\n52.5 Conformité. Le produit est conforme à la fiche produit au jour de la livraison ; un changement d'un outil tiers après la livraison n'est pas un défaut. Le recours du Client professionnel se limite au remplacement ou au remboursement.\n52.6 Pas de rétractation. Le Client professionnel qui commande en ligne n'a pas de droit de rétractation ; aucun remboursement n'est dû après téléchargement ou premier accès, hors articles 52.4 et 52.5.\n52.7 Mises à jour. Aucune mise à jour n'est due, sauf annonce de la fiche produit, pour la durée qu'elle indique. Les résultats obtenus avec les modèles relèvent de l'article 26.",
        },
        {
          title:
            "TITRE IX – CLIENTS PROFESSIONNELS PROTÉGÉS PAR UNE RÈGLE PARTICULIÈRE · Article 53. Petits professionnels, non-professionnels et non-commerçants",
          anchor: "article-53",
          body: "53.1 Champ. Le devis indique le type de Client (professionnel commerçant, professionnel non commerçant ou personne morale non professionnelle : valeur fixée au devis ; à défaut : professionnel commerçant), l'effectif du Client et si le contrat est conclu dans ses locaux ou juste après une sollicitation dans ses locaux. Le présent article l'emporte sur toute clause contraire.\n53.2 Petit professionnel démarché hors des locaux d'Axion-IA. Si le devis est signé dans les locaux du Client, ou juste après une sollicitation dans ces locaux, et que le Client emploie cinq salariés au plus, Axion-IA applique d'office, sans rechercher si la prestation entre dans l'activité principale du Client : la remise sur papier ou sur support durable de l'information précontractuelle et du formulaire de rétractation (annexe 4) ; un délai de rétractation de 14 jours à compter de la formation du contrat (article 6.2) ; aucun paiement ni acompte dans les 7 jours suivant la signature ; une exécution avant la fin du délai seulement sur demande expresse du Client sur support durable, avec reconnaissance écrite qu'il perd son droit de rétractation une fois la prestation entièrement exécutée ; en cas de rétractation après le début de l'exécution, le paiement de la part réalisée, au prorata du prix.\n53.3 Personne morale non professionnelle (association sans activité économique, comité social et économique, syndicat de copropriété, société civile patrimoniale, agissant hors de toute activité professionnelle). Les formules A et B et les abonnements ne lui sont pas proposés. Pour les autres prestations, ne s'appliquent pas à elle : le plafond et les exclusions de responsabilité (article 38.2 à 38.5), la réception par silence ou par usage (article 14.3), la modification des conditions et des prix (articles 5.3 et 8.3), l'écart des articles 1222 et 1223 (article 11.3) et la clause de tribunal (article 60.2). Le rappel de l'article 41.4 lui est adressé à chaque reconduction.\n53.4 Professionnel non commerçant (profession libérale, artisan, association, société civile). La clause de tribunal de l'article 60.2 ne s'applique pas (article 60.3).\n53.5 Formation payée par une personne physique : article 49.2.\n53.6 Signature à distance par défaut. Pour ne pas ouvrir de droit de rétractation que la loi n'impose pas, Axion-IA fait signer ses devis à distance, par le lien personnel de l'article 6.3, et non dans les locaux du Client ni juste après une sollicitation dans ces locaux. Le Client s'interdit de faire signer le devis par un tiers non habilité.",
        },
        {
          title: "TITRE X – DISPOSITIONS GÉNÉRALES ET LITIGES · Article 54. Non-sollicitation",
          anchor: "article-54",
          body: "54.1 Pendant le contrat et 12 mois après sa fin, le Client s'interdit de solliciter ou d'engager, directement ou par personne interposée, un salarié ou un intervenant indépendant d'Axion-IA qui a consacré au moins 5 jours à la prestation, sauf accord écrit d'Axion-IA. L'embauche d'une personne qui répond de sa propre initiative à une offre d'emploi publique du Client n'est pas un manquement.\n54.2 En cas de manquement, le Client verse une indemnité égale à 3 mois de la rémunération brute ou des honoraires facturés par la personne concernée, qui représente les frais de recrutement et de formation d'Axion-IA.",
        },
        {
          title: "Article 55. Cession du contrat",
          anchor: "article-55",
          body: "55.1 Le Client ne peut céder le contrat sans l'accord écrit d'Axion-IA, qui ne peut le refuser sans motif légitime.\n55.2 Axion-IA peut céder le contrat à une société établie dans l'Union européenne qui reprend l'activité concernée et toutes les obligations du contrat. Le Client y consent dès à présent et expressément, ce qui libère Axion-IA pour l'avenir. Il peut résilier sans frais ni motif dans les 30 jours de l'information.",
        },
        {
          title: "Article 56. Communications et notifications",
          anchor: "article-56",
          body: "56.1 Les échanges courants se font par courriel ou dans l'espace client.\n56.2 Une mise en demeure, une résiliation ou une notification de litige se fait par lettre recommandée avec accusé de réception, papier ou électronique, aux adresses indiquées au devis. Chaque partie signale par écrit tout changement d'adresse ; à défaut, l'envoi à la dernière adresse connue est valable.",
        },
        {
          title: "Article 57. Dispositions diverses",
          anchor: "article-57",
          body: "57.1 Le contrat exprime l'accord complet des parties et remplace les échanges et propositions antérieurs sur le même objet. Les estimations données avant la commande ne valent que si elles sont reprises au devis, comme hypothèses.\n57.2 Si une clause, ou une partie de clause, des présentes conditions, d'une annexe ou du devis est jugée nulle, réputée non écrite ou inapplicable, cette décision n'affecte ni la validité des autres clauses, ni celle des présentes conditions, ni celle du contrat, qui restent pleinement applicables. Les parties remplacent la clause concernée, de bonne foi, par une clause valable dont l'effet est le plus proche de celui recherché ; à défaut, la règle légale correspondante s'applique pour ce seul point.\n57.3 Ne pas exiger l'application d'une clause ne vaut pas renonciation à l'appliquer plus tard.\n57.4 Les titres des articles servent à la lecture. Les parties sont indépendantes ; aucune n'agit au nom de l'autre.\n57.5 Les présentes conditions sont rédigées en français ; seule la version française fait foi.",
        },
        {
          title: "Article 58. Réclamations et prescription",
          anchor: "article-58",
          body: "58.1 Le Client signale par écrit et de façon motivée toute anomalie dans les 90 jours suivant le jour où il l'a connue ou aurait dû la connaître. Ce délai conditionne le bénéfice de la garantie de l'article 15 et des avoirs de l'article 21.4 ; il ne prive le Client d'aucune action.\n58.2 Entre professionnels, toute action relative au contrat se prescrit par un an à compter du jour où le demandeur a connu ou aurait dû connaître les faits (article 2254 du Code civil). Ce délai s'applique aux deux parties, y compris aux actions en paiement d'Axion-IA, dont le délai court à compter de l'échéance de la facture. Il ne s'applique pas en cas de dol ou de faute lourde.",
        },
        {
          title: "Article 59. Règlement amiable préalable",
          anchor: "article-59",
          body: "59.1 Réclamation. La partie qui veut se plaindre adresse à l'autre une notification écrite qui décrit le problème, ce qu'elle demande et vise le présent article.\n59.2 Négociation. Les parties disposent de 30 jours à compter de sa réception pour trouver une solution ; chacune désigne une personne qui peut décider.\n59.3 Médiation. À défaut d'accord, et avant toute action en justice, les parties recourent à une médiation conventionnelle (articles 1528 et suivants du Code de procédure civile) auprès de [CENTRE DE MÉDIATION À DÉSIGNER], ou d'un médiateur qu'elles choisissent ensemble. La médiation dure au plus 60 jours, sauf prolongation d'un commun accord ; ses frais sont partagés par moitié.\n59.4 Une action engagée sans respecter ces étapes est irrecevable, sauf : mesure urgente ou conservatoire ; toute action en paiement d'une facture (injonction de payer, référé-provision, procédure de recouvrement des créances commerciales incontestées ou de petites créances) ; demande de restitution des Données du Client ; risque de prescription.\n59.5 La prescription est suspendue de la réception de la notification de l'article 59.1 jusqu'à la fin de la médiation.",
        },
        {
          title: "Article 60. Droit applicable et tribunal compétent",
          anchor: "article-60",
          body: "60.1 Le contrat est soumis au droit français.\n60.2 LORSQUE LE CLIENT A LA QUALITÉ DE COMMERÇANT, TOUT LITIGE RELATIF À LA FORMATION, À L'EXÉCUTION, À L'INTERPRÉTATION OU À LA FIN DU CONTRAT RELÈVE DE LA COMPÉTENCE EXCLUSIVE DU TRIBUNAL DE COMMERCE DE GRENOBLE, OU DE LA JURIDICTION QUI LUI SUCCÉDERAIT, MÊME EN CAS DE PLURALITÉ DE DÉFENDEURS, D'APPEL EN GARANTIE OU DE RÉFÉRÉ, sous réserve des règles de compétence d'ordre public.\n60.3 Lorsque le Client n'a pas la qualité de commerçant, les règles de compétence du Code de procédure civile s'appliquent ; les prestations sont réputées exécutées au lieu d'où Axion-IA les réalise, sauf intervention sur place.",
        },
        {
          title: "Annexes",
          anchor: "annexes",
          body: "Les annexes suivantes font partie du Contrat lorsqu'elles sont jointes au devis :\n• 1. Accord de traitement des données : Clauses contractuelles types de la Commission (décision 2021/915) : description du traitement, mesures de sécurité, sous-traitants, archivage sans effacement automatique (articles 35.3 à 35.5), liste des données et actifs exportables\n• 2. Niveaux de service et continuité : Disponibilité, prise en charge, sauvegardes, perte et reprise visées, interventions programmées, personne de secours, page d'état\n• 3. Sous-traitants et fournisseurs : Nom, service, pays, garantie de transfert, politiques d'usage des fournisseurs d'IA ; publiée en ligne avec historique\n• 4. Formulaire de rétractation : Pour l'article 53.2\n• 5. Fiche du système IA : Une par Automatisation (article 26.2)\n• 6. Registre des briques : Liste datée des Briques (article 30.2)\n• 7. Table des Crédits IA : Correspondance entre opérations et crédits (article 23.2)\n• Option. Sécurité renforcée : Notification en 24 heures, questionnaire annuel, mesures renforcées, pour les clients soumis à des exigences de cybersécurité",
        },
      ],
      metaSeo: {
        title: "Conditions générales · Axion-IA",
        description:
          "Conditions générales de vente et de service d'Axion-IA (version du 5 novembre 2026) : commande, prix, paiement, automatisations, données, responsabilité, durée et fin du contrat. Réservées aux professionnels. Droit français.",
      },
    },
    en: {
      title: "Terms &",
      titleEm: "conditions",
      intro:
        "The English version of Axion-IA's general terms of sale and service is not available. Only the French text, which applies to quotes signed from November 5, 2026, is binding. It is published at /conditions-generales.",
      sections: [
        {
          title: "French text only",
          anchor: "french-text-only",
          body: "Axion-IA contracts exclusively with professionals. The general terms of sale and service are published in French at /conditions-generales; that French text alone governs the contract. For any question, write to contact@axion-ia.com.",
        },
      ],
      metaSeo: {
        title: "Terms & conditions · Axion-IA",
        description:
          "Axion-IA general terms of sale and service: the binding text is the French version, published at /conditions-generales. Professional customers only. French law applies.",
      },
    },
  },
  {
    slug: "politique-confidentialite",
    pathFr: "/politique-confidentialite",
    pathEn: "/privacy-policy",
    fr: {
      title: "Politique de",
      titleEm: "confidentialité",
      intro:
        "Comment Axion-IA collecte, traite et protège vos données personnelles, conformément au RGPD (UE) 2016/679.",
      sections: [
        {
          title: "Responsable du traitement",
          body: "Axion-IA, société française, agit en qualité de responsable du traitement. Contact RGPD : contact@axion-ia.com (aucun délégué à la protection des données — DPO — n'est désigné, la désignation n'étant pas obligatoire au regard de l'activité). Autorité de contrôle compétente : CNIL (Commission Nationale de l'Informatique et des Libertés).",
        },
        {
          title: "Données collectées",
          body:
            "Email, nom, raison sociale, contenu des messages, métadonnées techniques (user-agent, langue), pages visitées (Plausible self-hosted, anonymisé). Aucun cookie publicitaire, aucun tracker cross-site. Deux services tiers peuvent déposer des cookies, chacun uniquement après une action explicite de votre part : Microsoft Clarity (bandeau cookies) et le calendrier de réservation Calendly sur la page /appel." +
            CN_FR.donnees,
        },
        {
          title: "Finalités",
          body:
            "Réponse aux demandes commerciales, suivi des prestations, envoi du guide IA entreprise à qui le demande, lettre d'information aux personnes inscrites, sécurité du site, statistiques d'audience anonymes. Pas de profilage, pas de revente de données." +
            CN_FR.finalites,
        },
        {
          title: "Base légale",
          body:
            "Exécution contractuelle (RGPD art. 6.1.b) pour les clients et pour l'envoi du guide que vous demandez ; intérêt légitime (RGPD art. 6.1.f) pour la sécurité, le suivi de la relation et la lettre d'information adressée aux adresses professionnelles ; consentement (RGPD art. 6.1.a) pour la lettre d'information adressée aux adresses personnelles." +
            CN_FR.baseLegale,
        },
        {
          title: "Durée de conservation",
          body:
            "Données clients : conservées tant que la relation dure, puis le temps des délais légaux de réclamation ; les pièces comptables (factures et pièces justificatives) sont conservées dix ans (article L.123-22 du code de commerce). Demandes commerciales : conservées pour garder la trace de nos échanges ; elles ne sont pas supprimées automatiquement, et vous pouvez en demander l'effacement à tout moment. Les pièces jointes envoyées avec le formulaire de contact sont conservées avec la demande, pour la même durée, dans un espace de stockage privé accessible à la seule équipe Axion-IA ; elles sont effacées avec elle. Journaux techniques : conservés sans suppression automatique, à l'exception des mesures de performance et d'audience du site, effacées au plus tard 12 mois après leur collecte. Les candidatures adressées via la page /carrieres relèvent d'un régime distinct, détaillé dans la section « Conservation des candidatures » ci-dessous." +
            CN_FR.conservation,
        },
        {
          title: "Rendez-vous de découverte",
          body: sectionRendezVousDecouverte("fr"),
        },
        {
          // Lot L2 (2026-09-24) — publiée AVEC le nouveau formulaire du guide :
          // l'information précède la collecte. Deux bases pour la lettre
          // (amendement de Will du 24/09) et durées, gardées par
          // `src/content/__tests__/la-notice-dit-vrai-sur-le-guide.spec.ts`.
          title: "Guide IA entreprise et lettre d'information",
          body: "Lorsque vous demandez le guide IA entreprise — depuis la page /guide-ia ou depuis l'encart en fin d'article —, nous collectons votre adresse e-mail, la page d'où vient la demande et la langue du site. Le guide vous est envoyé tout de suite par e-mail : c'est l'exécution de votre demande (RGPD art. 6.1.b). La lettre d'information d'Axion-IA — 1 à 2 e-mails par mois, à chaque nouveauté utile — dépend de la nature de votre adresse. Adresse professionnelle : vous la recevez aussi, sur la base de notre intérêt légitime à tenir informés les professionnels qui s'intéressent à nos services (art. 6.1.f), après l'information donnée sous le formulaire. Adresse personnelle (messagerie grand public) : vous ne la recevez que si vous avez coché la case prévue à cet effet (consentement, art. 6.1.a), et vous pouvez retirer votre consentement à tout moment ; sans cette case, vous recevez le guide seul. Comme preuve, nous conservons la version du texte qui vous a été présenté (la mention d'information, ou le texte de la case), la date de votre demande, une empreinte de votre adresse e-mail et une empreinte de votre adresse IP ; ni l'une ni l'autre n'est gardée en clair. L'e-mail qui vous envoie le guide, comme chaque lettre, comporte un lien de désinscription en un clic ; votre désinscription vaut partout, y compris dans notre outil de suivi de la relation client. Votre inscription à la lettre y est aussi reportée, lorsque vous ouvrez le guide ou confirmez votre inscription par le bouton prévu. Après une désinscription, une nouvelle demande du guide ne vous réinscrit pas : l'e-mail peut seulement vous proposer de revenir, et seul votre clic vous réinscrit ; en cas d'opposition à nos envois, il ne vous le propose pas. Nous enregistrons aussi la date d'envoi du guide et, lorsque vous cliquez sur le bouton de téléchargement, la date de ce clic ; les statistiques d'audience associées sont anonymes. Suivi de la relation : lorsque vous ouvrez le guide depuis l'e-mail, votre adresse est enregistrée dans notre logiciel interne de gestion de la relation client (CRM), sur la base de notre intérêt légitime (art. 6.1.f) à suivre les échanges avec les personnes qui ont demandé le guide ; vous pouvez vous y opposer à tout moment. Aucune prospection commerciale n'est adressée à une adresse personnelle sans votre consentement. Destinataires : notre prestataire d'envoi d'e-mails ZeptoMail, qui achemine l'e-mail du guide ; la messagerie interne Telegram de l'équipe, qui est avertie de la demande sans recevoir votre adresse. Vos données ne sont ni vendues ni cédées. Conservation : votre demande du guide, votre inscription à la lettre et la preuve de l'information ou de votre consentement sont conservées pour garder la trace de nos échanges ; elles ne sont pas supprimées automatiquement. Après une désinscription, votre adresse reste conservée pour qu'aucun envoi ne vous parvienne. Vous pouvez à tout moment en demander l'effacement. Vous disposez des droits d'accès, de rectification, d'effacement, d'opposition, de limitation et de portabilité, en écrivant à contact@axion-ia.com, et du droit d'introduire une réclamation auprès de la CNIL.",
        },
        {
          title: "Candidatures et recrutement",
          body: "Lorsque vous postulez à une offre publiée sur /carrieres, nous collectons ce que vous saisissez : civilité (facultative), nom, prénom, adresse e-mail, téléphone, ville, poste actuel, expérience, disponibilité, profil LinkedIn, un mot de motivation et vos réponses aux questions propres à l'offre. Le CV et la photographie sont facultatifs : leur absence n'empêche pas l'examen de votre candidature. Le permis de conduire et le véhicule ne vous sont demandés que lorsque l'offre l'exige. Nous pouvons vous demander la rémunération que vous souhaitez ; nous ne demandons jamais votre historique de rémunération (directive (UE) 2023/970). Aucune information relative au sexe, à l'âge, à l'origine, à l'état de santé ou à la situation de famille n'est collectée. Base légale : mesures précontractuelles prises à votre demande (RGPD art. 6.1.b) ; seule la conservation en vivier, décrite ci-dessous, repose sur votre consentement (art. 6.1.a). Vos nom, prénom, adresse e-mail et numéro de téléphone sont chiffrés dans notre base ; le CV et la photographie sont stockés hors base et hors du site public. Si vous répondez par e-mail à l'un de nos messages, votre réponse, reçue dans notre messagerie Zoho Mail, est lue automatiquement et rattachée à votre dossier : nous en conservons la date, l'objet et un court extrait, chiffré, jamais le message entier ni ses pièces jointes, et la messagerie interne Telegram de l'équipe en est avertie avec le seul intitulé du poste, sans votre nom ni l'objet du message. L'accès à un dossier de candidature est réservé aux personnes habilitées, et chaque ouverture d'un dossier nominatif est journalisée. Vos données de candidature ne sont ni vendues, ni transmises à un tiers à des fins de recrutement.",
        },
        {
          title: "Conservation des candidatures",
          body: "Votre dossier de candidature — CV, photographie, vidéos et historique de nos échanges compris — est conservé deux ans après notre dernier échange, puis effacé automatiquement. Vous pouvez demander son effacement plus tôt, à tout moment, en écrivant à contact@axion-ia.com, ou l'effacer vous-même en un clic depuis le lien « Supprimer ma candidature » présent dans nos messages, après avoir confirmé votre demande sur la page qui s'ouvre. Si vous êtes recruté ou recrutée, il devient une pièce de votre dossier du personnel et n'est pas concerné par cet effacement. Conservation en vivier : facultative, et distincte de la candidature elle-même. Elle n'a lieu que si vous l'avez expressément acceptée — la case est décochée par défaut — et sert à vous recontacter pour d'autres postes, pendant cette même durée de deux ans. Vous pouvez vous y opposer à tout moment, en un clic, depuis le lien figurant dans nos messages, sans créer de compte ni justifier votre demande. Sans cet accord, votre candidature n'est utilisée que pour l'offre à laquelle vous avez postulé.",
        },
        {
          // 2026-09-19 — le tunnel des apporteurs d'affaires n'était décrit
          // nulle part. Uniquement des faits vérifiables dans le code, gardés par
          // `src/content/__tests__/la-notice-dit-vrai-sur-les-apporteurs.spec.ts`
          // (conservation : aucune suppression automatique, décision de Will du
          // 2026-10-07 — le worker de purge ne touche plus aux dossiers). L'invitation
          // envoyée à une personne recommandée renvoie à cette section : ne pas
          // renommer son titre sans mettre à jour l'ancre du gabarit
          // `apporteur-invitation-appel.tsx`.
          title: "Réseau d'apporteurs d'affaires",
          body: "Lorsque vous vous intéressez à notre réseau d'apporteurs d'affaires — depuis les pages /apporteur-affaires (dont sa page vidéo /apporteur-affaires/video), /devenir-commercial-ia/candidature, /indeed, /leboncoin ou /memo-isere —, nous collectons vos prénom, nom, adresse e-mail, téléphone et ville ; si vous complétez le dossier, s'y ajoutent les réponses que vous y apportez. Sur la page vidéo, l'inscription se fait en deux temps : dès que vous validez le premier (prénom et adresse e-mail), ces informations sont conservées, et si vous ne terminez pas nous pouvons vous écrire pour vous le rappeler ; le second temps ajoute votre téléphone et la réponse à une question sur le nombre de dirigeants que vous connaissez. Votre réponse au bandeau cookies (acceptée ou refusée) est conservée avec votre fiche, pour savoir si la mesure publicitaire de Meta est permise lorsque vous réservez un échange. Finalités et bases légales : l'étude de votre candidature et l'envoi des documents d'information que vous demandez reposent sur des mesures précontractuelles prises à votre demande (RGPD art. 6.1.b). Lorsque votre adresse nous a été transmise par une personne qui vous recommande, le traitement repose sur notre intérêt légitime (art. 6.1.f), et vous en êtes informé dès notre premier message (art. 14), qui indique d'où vient votre adresse. Si vous avez postulé à l'une de nos offres d'emploi, nous pouvons aussi vous proposer de rejoindre ce réseau, à partir des coordonnées de votre candidature : ce traitement repose sur notre intérêt légitime (art. 6.1.f), notre premier message vous l'indique, et votre candidature au poste n'en est pas affectée. Envois automatiques : si vous commencez le dossier sans le terminer, le catalogue de nos prestations vous est envoyé 30 minutes après le premier écran ; des relances vous sont ensuite adressées à J+2 et J+7 tant que le dossier n'est pas complet. Le même schéma s'applique à la page vidéo : un e-mail 30 minutes après le premier temps de l'inscription, puis des rappels à J+2 et J+7, tant que le second temps n'est pas validé, qu'aucun échange n'est réservé et que le dossier n'est pas complet. Si nous vous invitons à réserver un échange, deux rappels au plus vous sont adressés trois et sept jours après l'invitation, tant qu'aucun échange n'est réservé et que vous n'y avez pas répondu. Si vous répondez par e-mail à cette invitation, votre réponse, reçue dans notre messagerie Zoho Mail, arrête ces rappels : nous en conservons la date, l'objet et un court extrait dans votre dossier, jamais le message entier ni ses pièces jointes. Chaque message comporte un lien d'opposition : un clic suffit, et il arrête aussi les relances et les envois déjà programmés. Destinataires : notre prestataire d'envoi d'e-mails ZeptoMail, qui achemine ces messages ; Calendly, si vous réservez un échange ; la messagerie interne Telegram de l'équipe, qui reçoit seulement votre prénom, l'initiale de votre nom et, le cas échéant, votre ville ; en cas d'opposition, notre logiciel interne de gestion de la relation client (CRM), qui reçoit votre adresse e-mail et le motif « opposition » pour qu'aucune sollicitation ne vous soit adressée. Vos données ne sont ni vendues ni cédées. Conservation : votre dossier est conservé pour garder la trace de nos échanges ; il n'est pas supprimé automatiquement, et vous pouvez à tout moment en demander l'effacement. Vous disposez des droits d'accès, de rectification, d'effacement, d'opposition, de limitation et de portabilité, en écrivant à contact@axion-ia.com, et du droit d'introduire une réclamation auprès de la CNIL.",
        },
        {
          // 2026-10-09 (analyse du contrat d'apporteur, point 19) — information art. 14 des
          // PERSONNES PRÉSENTÉES par un apporteur : le premier message qu'elles reçoivent
          // (`entreprise-prise-de-contact-apporteur`) renvoie à cette ancre STABLE. Aucune
          // suppression automatique (décision de Will) : la durée est donnée par critères.
          title: "Personnes présentées par un apporteur d'affaires",
          anchor: "personnes-presentees-par-un-apporteur",
          body: "Lorsqu'un apporteur d'affaires indépendant de notre réseau nous indique qu'il vous a parlé d'Axion-IA, il nous transmet le nom de votre entreprise et le numéro SIRET de votre établissement, vos nom, prénom et fonction, votre adresse e-mail et votre téléphone professionnels, ainsi que la date de votre échange. Nous vous écrivons alors de sa part ; notre premier message vous indique d'où viennent vos coordonnées et comment vous y opposer. Finalités : vous présenter nos services, suivre notre relation avec votre entreprise et calculer la rémunération de l'apporteur. Base légale : notre intérêt légitime (RGPD art. 6.1.f) à présenter nos services aux professionnels, le message portant sur votre activité professionnelle. Destinataires : l'équipe d'Axion-IA ; notre logiciel interne de gestion de la relation client (CRM) ; le prestataire qui achemine nos e-mails ; Calendly, si vous réservez un échange. L'apporteur qui vous a présenté n'est informé que des suites utiles à sa rémunération (prise de contact, commande, commission), jamais du contenu de nos échanges. Vos données ne sont ni vendues ni cédées. Conservation : elles sont conservées tant qu'elles restent exactes et que vous exercez la fonction pour laquelle elles ont été recueillies, et jusqu'à votre opposition ou votre demande d'effacement ; elles ne sont pas supprimées automatiquement, et sont mises à jour ou effacées dès que nous apprenons qu'elles ne sont plus exactes. Chaque message comporte un lien d'opposition : un clic suffit, et votre opposition est conservée pour être respectée. Vous disposez des droits d'accès, de rectification, d'effacement, d'opposition et de limitation, en écrivant à contact@axion-ia.com, et du droit d'introduire une réclamation auprès de la CNIL.",
        },
        {
          // 2026-10-11 (lot L16b-1, ADR 0066) — formateurs indépendants. Le premier écran
          // du dossier en ligne renvoie à cette ancre STABLE. Faits vérifiables, gardés par
          // `src/content/__tests__/la-notice-dit-vrai-sur-les-formateurs-independants.spec.ts`.
          // Aucune suppression automatique : la durée est donnée par critères.
          // Lot L16b-2 : chaque phrase est prouvée par le code, y compris les fonctions
          // livrées éteintes (décrites au présent, sans date). Aucun logiciel de
          // comptabilité ni plateforme de facturation électronique n'est nommé : aucun
          // flux n'existe dans le code.
          title: "Formateurs indépendants",
          anchor: "formateurs-independants",
          body: "Lorsque vous intervenez, ou envisagez d'intervenir, pour Axion-IA comme formateur indépendant ou comme intervenant d'un organisme sous-traitant, nous traitons des données personnelles vous concernant, y compris si vous exercez en entreprise individuelle : vos nom, prénom, adresse e-mail, téléphone, adresse professionnelle, code postal et commune d'exercice ; les numéros de votre entreprise (SIREN, SIRET), votre numéro de déclaration d'activité de formation et votre régime de TVA ; votre IBAN ; les pièces que vous nous transmettez (attestation de vigilance URSSAF et son code de vérification, attestation d'assurance, CV, justificatifs de compétences, récépissé de déclaration) ; les formations que vous animez, vos missions, les feuilles d'émargement et les factures établies pour vos honoraires. Dossier en ligne : il s'ouvre par un lien personnel, valable 30 jours ; quand l'équipe vous renvoie un nouveau lien, ou quand vous envoyez votre dossier, les liens précédents cessent de fonctionner. Quand vous déposez une pièce, elle est analysée par un antivirus avant d'être acceptée, puis stockée chiffrée ; une personne de l'équipe la vérifie. Les déclarations que vous faites en envoyant votre dossier sont enregistrées avec leur date et leur heure. Pour signer un document en ligne, vous recevez par e-mail un code à usage unique, valable 15 minutes. Registre public : nous interrogeons l'annuaire des entreprises de l'État (recherche-entreprises.api.gouv.fr), qui reprend la liste publique des organismes de formation, pour vérifier que votre entreprise est active et que votre numéro de déclaration lui est bien attribué ; nous conservons une preuve datée de chaque vérification, qui n'est jamais modifiée. Finalités et bases légales : conclure et exécuter le contrat-cadre de sous-traitance et chaque mission (RGPD art. 6.1.b) ; respecter nos obligations légales, notamment l'obligation de vigilance du donneur d'ordre (art. L.8222-1 du code du travail), la tenue de la comptabilité et des factures (art. 6.1.c) ; vérifier le sérieux des entreprises avec lesquelles nous travaillons et choisir le formateur le mieux placé pour une mission (art. 6.1.f). Pour ce choix, l'équipe consulte une liste interne, jamais publiée ni montrée aux formateurs : la distance entre le lieu de la formation et le centre de votre commune d'exercice (jamais votre adresse), le nombre de formations que vous avez animées sur les trois dernières années et la note moyenne de satisfaction donnée par les stagiaires de ces sessions, affichée seulement à partir de cinq avis ; une mission que vous avez refusée n'y est jamais comptée. Des contrôles automatiques peuvent suspendre une affectation ou un virement (par exemple une attestation périmée) ; ils ne concluent jamais seuls : l'activation de votre espace, le choix d'un formateur pour une mission et toute suite à un contrôle sont décidés par une personne de l'équipe. Sécurité : votre IBAN est enregistré chiffré, et tout changement est vérifié par une personne avant un virement. Destinataires : l'équipe d'Axion-IA ; ZeptoMail, le prestataire qui achemine nos e-mails ; notre messagerie Zoho Mail, qui reçoit vos réponses ; la messagerie interne Telegram de l'équipe, avertie de l'envoi de votre dossier par un identifiant court et le résultat de la vérification au registre, sans votre nom ; Calendly, si vous réservez un échange ; les entreprises clientes et, lorsque la formation est financée, son financeur, qui reçoivent votre nom, votre qualité et les justificatifs de réalisation de la formation. Vos données ne sont ni vendues ni cédées. Conservation : votre candidature (CV, vidéos et échanges compris) est effacée automatiquement deux ans après notre dernier échange, comme toute candidature ; si aucune relation n'est engagée, votre dossier est conservé jusqu'à deux ans après notre dernier échange. À la fin de notre collaboration, l'accès à votre espace en ligne est fermé, et les durées suivantes partent de cette date : le contrat et les preuves de vigilance (attestations et vérifications) sont conservés cinq ans ; les factures et les pièces comptables, dix ans (art. L.123-22 du code de commerce). Hors candidature, vos données ne sont pas supprimées automatiquement à ce jour : elles sont effacées à l'issue de ces durées lors d'une revue, et vous pouvez en demander l'effacement à tout moment, sous réserve des pièces que la loi nous impose de garder. Vous disposez des droits d'accès, de rectification, d'effacement, d'opposition, de limitation et de portabilité, en écrivant à contact@axion-ia.com, et du droit d'introduire une réclamation auprès de la CNIL. Si vous demandez l'accès à vos données, la copie des données de votre dossier en ligne montre votre IBAN masqué (seuls ses quatre premiers et ses quatre derniers caractères apparaissent) et la liste de vos pièces, sans leur contenu. Une demande d'effacement des données de votre dossier en ligne est traitée par une personne de l'équipe, par pseudonymisation, et l'accès à votre espace est fermé : si aucune collaboration n'a été engagée, votre nom et vos coordonnées sont remplacés par une mention d'effacement, et votre IBAN et les numéros de votre entreprise sont effacés ; si une collaboration a été engagée, votre identité est gardée pour la facturation et seul votre téléphone est retiré. Les pièces que la loi impose de conserver restent intactes : contrats, preuves de vigilance, extrait Kbis ou avis de situation Sirene, justificatif de votre numéro de déclaration d'activité, récépissé de déclaration, attestation d'assurance et, si une collaboration a été engagée, justificatifs de compétences et RIB ; les autres, comme le CV, sont masquées.",
        },
        {
          // 2026-09-27 (Will) — information art. 14 des organisateurs
          // d'événements professionnels dont les coordonnées ont été
          // collectées sur des pages publiques. `anchor` est un identifiant
          // STABLE (#organisateurs-evenements, FR et EN) : les premiers
          // messages y renvoient — ne pas le changer sans mettre à jour ces
          // e-mails. Aucune durée chiffrée de conservation (décision du
          // responsable de traitement), aucun prestataire d'envoi nommé.
          title: "Organisateurs d'événements professionnels",
          anchor: "organisateurs-evenements",
          body: "Axion-IA repère des événements professionnels (salons, conférences, clubs et réseaux d'entrepreneurs, cafés-débats, rencontres d'affaires…) et leurs organisateurs, afin de leur proposer des interventions de Williams Jullin, fondateur d'Axion-IA, et de leur faire connaître nos services. Données collectées : le nom de l'organisation ; les nom, prénom et fonction de la personne présentée comme contact ; son adresse e-mail et son téléphone professionnels ; l'adresse du formulaire de contact ; les informations sur l'événement (nom, dates, lieu, public). Source : uniquement des pages publiques — site de l'événement ou de l'organisation, agendas en ligne, annuaires professionnels publics. Aucune donnée n'est achetée. Base légale : notre intérêt légitime (RGPD art. 6.1.f) à proposer nos interventions et nos services aux organisateurs d'événements professionnels, dans le cadre de leur fonction. Information : chaque premier message que nous vous adressons indique d'où viennent vos coordonnées et comment vous y opposer (art. 14). Destinataires : l'équipe d'Axion-IA ; notre logiciel interne de gestion de la relation client (CRM), hébergé dans l'Union européenne ; le prestataire qui achemine nos e-mails. Vos données ne sont ni vendues ni cédées. Conservation : pendant la durée de nos échanges avec les organisateurs d'événements professionnels ; vous pouvez en demander l'effacement à tout moment. En cas d'opposition, nous ne conservons qu'une empreinte de votre adresse, pour ne plus jamais vous écrire. Vous disposez des droits d'accès, de rectification, d'effacement, d'opposition — à tout moment et sans avoir à vous justifier, en répondant « STOP » à l'un de nos messages ou en écrivant à contact@axion-ia.com —, de limitation et de portabilité, ainsi que du droit d'introduire une réclamation auprès de la CNIL.",
        },
        {
          title: "Vos droits",
          body: "Accès, rectification, effacement, opposition, portabilité, limitation. Contactez contact@axion-ia.com. Vous avez également le droit d'introduire une réclamation auprès de la CNIL.",
        },
        {
          title: "Hébergement et transferts",
          body:
            "Hébergement principal dans l'Union européenne (Allemagne) et services edge à présence européenne prioritaire. Plusieurs sous-traitants sont toutefois établis hors UE, ou y traitent des données : notamment des modèles d'IA américains lorsqu'un contenu éditorial est généré ou vérifié, et le service tiers de prise de rendez-vous embarqué sur la page /appel. La liste complète, avec pour chacun sa localisation et son cadre de transfert (Clauses Contractuelles Types, décision d'adéquation), est publiée et tenue à jour sur /sous-processeurs. Cette politique n'en donne volontairement aucune énumération nominative : /sous-processeurs est la source unique de vérité, et une prose qui n'énumère pas ne peut pas diverger d'elle." +
            CN_FR.hebergementIA,
        },
        {
          title: "Sous-processeurs et destinataires des données",
          body:
            "Conformément à l'article 13.1.e du RGPD, Axion-IA tient une liste exhaustive et publique de ses sous-processeurs sur la page /sous-processeurs (catégories : " +
            CN_FR.categories +
            "). Cette page indique pour chaque sous-processeur sa finalité, les catégories de données traitées, la localisation des serveurs, la base légale, le statut du DPA et le cadre de transfert international. Toute évolution est notifiée par email aux clients actifs au moins 30 jours avant prise d'effet. Aucune donnée n'est vendue ni partagée à des fins publicitaires. Lorsque vous nous adressez une demande (formulaire, assistant du site, réservation d'un rendez-vous), la messagerie interne Telegram de l'équipe reçoit le contenu complet de votre demande, afin d'y répondre rapidement.",
        },
        {
          title: "IA générative et transparence (AI Act EU)",
          body:
            "Certains contenus éditoriaux du site (Articles signés Manon, fiches de villes, FAQ) sont rédigés par des modèles d'IA générative (OpenAI GPT-4o pour la rédaction, Perplexity Sonar pour la vérification factuelle) puis soumis à des contrôles automatisés avant publication — vérification factuelle, contrôle éditorial et alignement doctrine. La relecture humaine n'est pas systématique. Conformément à l'article 50 du Règlement européen sur l'IA (AI Act 2024/1689), la nature IA-assistée de ces contenus est divulguée publiquement — voir la fiche transparence sur /equipe/manon." +
            CN_FR.iaGenerativeIA +
            " Vous pouvez vous opposer à tout traitement de vos données par un modèle IA (RGPD art. 21) en écrivant à contact@axion-ia.com.",
        },
      ],
      metaSeo: {
        title: "Politique de confidentialité · Axion-IA",
        description:
          "RGPD + AI Act, données personnelles, droits, CNIL. Hébergement UE Hetzner Frankfurt + sous-processeurs publiés.",
      },
    },
    en: {
      title: "Privacy",
      titleEm: "policy",
      intro:
        "How Axion-IA collects, processes and protects your personal data under GDPR (EU) 2016/679.",
      sections: [
        {
          title: "Data controller",
          body: "Axion-IA, a French company, acts as data controller. GDPR contact: contact@axion-ia.com (no Data Protection Officer — DPO — has been appointed, as appointment is not mandatory given the activity). Competent supervisory authority: CNIL (Commission Nationale de l'Informatique et des Libertés).",
        },
        {
          title: "Data collected",
          body:
            "Email, name, company name, message content, technical metadata (user-agent, language), pages visited (self-hosted Plausible, anonymized). No advertising cookies, no cross-site trackers. Two third-party services may set cookies, each only after an explicit action on your part: Microsoft Clarity (cookie banner) and the Calendly booking calendar on the /appel page." +
            CN_EN.donnees,
        },
        {
          title: "Purposes",
          body:
            "Reply to commercial requests, service follow-up, sending the enterprise AI guide to those who request it, newsletter to subscribers, site security, anonymous audience statistics. No profiling, no data resale." +
            CN_EN.finalites,
        },
        {
          title: "Legal basis",
          body:
            "Contractual performance (GDPR art. 6.1.b) for clients and for sending the guide you request; legitimate interest (GDPR art. 6.1.f) for security, relationship follow-up and the newsletter sent to business addresses; consent (GDPR art. 6.1.a) for the newsletter sent to personal addresses." +
            CN_EN.baseLegale,
        },
        {
          title: "Retention period",
          body:
            "Client data: kept for as long as the relationship lasts, then for the statutory limitation periods for claims; accounting records (invoices and supporting documents) are kept for ten years (article L.123-22 of the French Commercial Code). Commercial requests: kept to preserve a record of our exchanges; they are not deleted automatically, and you may ask for them to be erased at any time. Attachments sent with the contact form are kept with the request, for the same period, in private storage accessible only to the Axion-IA team; they are erased with it. Technical logs: kept with no automatic deletion, except the site's performance and audience measurements, deleted at most 12 months after collection. Applications submitted through the /carrieres page follow a distinct regime, detailed in the « Retention of job applications » section below." +
            CN_EN.conservation,
        },
        {
          // Chantier visio (PR 8, T2) — pendant anglais de « Rendez-vous de
          // découverte », absent jusqu'ici. Même interrupteur, même garde.
          title: "Discovery appointments",
          body: sectionRendezVousDecouverte("en"),
        },
        {
          title: "Enterprise AI guide and newsletter",
          body: "When you request the enterprise AI guide — from the /guide-ia page or from the box at the end of an article —, we collect your email address, the page the request comes from and the site language. The guide is sent to you straight away by email: this is the performance of your request (GDPR art. 6.1.b). Axion-IA's newsletter — 1 to 2 emails a month, only when there is something new and useful — depends on the nature of your address. Business address: you receive it too, on the basis of our legitimate interest in keeping professionals interested in our services informed (art. 6.1.f), after being informed of it below the form. Personal address (consumer webmail): you only receive it if you ticked the dedicated box (consent, art. 6.1.a), and you can withdraw your consent at any time; without that box, you receive the guide only. As proof, we keep the version of the text you were shown (the information notice, or the text of the box), the date of your request, a fingerprint of your email address and a fingerprint of your IP address; neither is kept in clear. The email that sends you the guide, like every newsletter, carries a one-click unsubscribe link; your unsubscription applies everywhere, including in our customer relationship tool. Your subscription to the letter is also recorded there when you open the guide or confirm your subscription with the button provided. If you had unsubscribed, a new guide request does not resubscribe you: the email can only offer you to come back, and only your click resubscribes you; if you have objected to our emails, it does not offer it. We also record the date the guide was sent and, when you click the download button, the date of that click; the related audience statistics are anonymous. Relationship follow-up: when you open the guide from the email, your address is recorded in our internal customer relationship management software (CRM), on the basis of our legitimate interest (art. 6.1.f) in following up with people who requested the guide; you can object at any time. No commercial prospecting is sent to a personal address without your consent. Recipients: our email delivery provider ZeptoMail, which carries the guide email; the team's internal Telegram messaging, which is notified of the request without receiving your address. Your data is neither sold nor transferred. Retention: your guide request, your newsletter subscription and the proof of information or of your consent are kept to preserve a record of our exchanges; they are not deleted automatically. After an unsubscription, your address remains kept so that nothing reaches you. You may ask for them to be erased at any time. You have the rights of access, rectification, erasure, objection, limitation and portability, by writing to contact@axion-ia.com, and the right to lodge a complaint with the CNIL.",
        },
        {
          title: "Job applications and recruitment",
          body: "When you apply to a role published on /carrieres, we collect what you enter: title (optional), first and last name, email address, phone number, city, current role, experience, availability, LinkedIn profile, a short motivation note and your answers to the questions specific to that role. A CV and a photograph are optional: their absence does not prevent your application from being reviewed. Driving licence and vehicle are only asked for when the role requires them. We may ask for the compensation you are seeking; we never ask for your compensation history (EU Directive 2023/970). No information about sex, age, origin, health or family situation is collected. Legal basis: pre-contractual measures taken at your request (GDPR art. 6.1.b); only the talent-pool retention described below rests on your consent (art. 6.1.a). Your name, email address and phone number are encrypted in our database; the CV and photograph are stored outside the database and outside the public site. If you reply by email to one of our messages, your reply, received in our Zoho Mail mailbox, is read automatically and attached to your file: we keep its date, subject and a short excerpt, encrypted, never the whole message or its attachments, and the team's internal Telegram messaging is notified with the title of the role only, without your name or the subject of the message. Access to an application file is restricted to authorised staff, and every opening of a named file is logged. Your application data is neither sold nor passed to any third party for recruitment purposes.",
        },
        {
          title: "Retention of job applications",
          body: "Your application file — CV, photograph, videos and the record of our exchanges included — is kept for two years after our last exchange, then deleted automatically. You may ask for it to be erased earlier, at any time, by writing to contact@axion-ia.com, or erase it yourself in one click from the “Delete my application” link in our messages, after confirming your request on the page that opens. If you are hired, it becomes part of your personnel file and is not covered by this deletion. Talent-pool retention: optional, and separate from the application itself. It only happens if you have expressly agreed to it — the box is unticked by default — and serves to contact you about other roles, for that same two-year period. You may object at any time, in one click, from the link in our messages, without creating an account or giving a reason. Without that agreement, your application is used only for the role you applied to.",
        },
        {
          // 2026-09-19 — mirror of the French section « Réseau d'apporteurs
          // d'affaires ». Same facts, same guard.
          title: "Business introducer network",
          body: "When you show interest in our business introducer network — from the pages /apporteur-affaires (including its video page /apporteur-affaires/video), /devenir-commercial-ia/candidature, /indeed, /leboncoin or /memo-isere — we collect your first name, last name, email address, phone number and city; if you complete the application file, the answers you give there are added. On the video page, registration takes two steps: as soon as you complete the first (first name and email address), that information is kept, and if you do not finish we may write to remind you; the second step adds your phone number and the answer to a question about how many business owners you know. Your answer to the cookie banner (accepted or declined) is kept with your record, to know whether Meta advertising measurement is allowed when you book a call. Purposes and legal bases: reviewing your application and sending the information documents you request rest on pre-contractual measures taken at your request (GDPR art. 6.1.b). When your address was passed to us by someone who recommends you, the processing rests on our legitimate interest (art. 6.1.f), and you are informed of it in our very first message (art. 14), which states where your address comes from. Automatic messages: if you start the application file without finishing it, our catalogue of services is sent to you 30 minutes after the first screen; reminders then follow 2 days and 7 days later as long as the file is not complete. The same scheme applies to the video page: an email 30 minutes after the first step of the registration, then reminders 2 days and 7 days later, as long as the second step is not completed, no call is booked and the file is not complete. If we invite you to book a call, at most two reminders follow, 3 days and 7 days after the invitation, as long as no call is booked and you have not replied. If you reply to that invitation by email, your reply, received in our Zoho Mail mailbox, stops these reminders: we keep its date, subject and a short excerpt in your file, never the whole message or its attachments. Every message carries an objection link: one click is enough, and it also stops the reminders and any message already scheduled. Recipients: our email delivery provider ZeptoMail, which carries these messages; Calendly, if you book a call; the team's internal Telegram messaging, which only receives your first name, the initial of your last name and, where applicable, your city; in case of objection, our internal customer relationship management software (CRM), which receives your email address and the reason « objection » so that no solicitation is sent to you. Your data is neither sold nor transferred. Retention: your file is kept to preserve a record of our exchanges; it is not deleted automatically, and you may ask for it to be erased at any time. You have the rights of access, rectification, erasure, objection, limitation and portability, by writing to contact@axion-ia.com, and the right to lodge a complaint with the CNIL.",
        },
        {
          // 2026-10-09 — mirror of « Personnes présentées par un apporteur d'affaires ».
          title: "People introduced by a business introducer",
          anchor: "personnes-presentees-par-un-apporteur",
          body: "When an independent business introducer from our network tells us that they spoke to you about Axion-IA, they send us your company name and the SIRET number of your establishment, your name and position, your professional e-mail address and phone number, and the date of your conversation. We then write to you on their behalf; our first message tells you where your details come from and how to object. Purposes: presenting our services, following our relationship with your company and calculating the introducer's fee. Legal basis: our legitimate interest (GDPR art. 6.1.f) in presenting our services to professionals, the message relating to your professional activity. Recipients: the Axion-IA team; our internal customer relationship management software (CRM); the provider that delivers our e-mails; Calendly, if you book a call. The introducer who referred you is only told what is needed for their fee (contact, order, commission), never the content of our exchanges. Your data is neither sold nor transferred. Retention: it is kept as long as it remains accurate and you hold the position for which it was collected, and until you object or ask for erasure; it is not deleted automatically, and is updated or erased as soon as we learn it is no longer accurate. Every message includes an opt-out link: one click is enough, and your objection is kept so that it is respected. You have the rights of access, rectification, erasure, objection and restriction, by writing to contact@axion-ia.com, and the right to lodge a complaint with the CNIL.",
        },
        {
          // 2026-10-11 — mirror of « Formateurs indépendants » (lot L16b-1).
          title: "Independent trainers",
          anchor: "formateurs-independants",
          body: "When you work, or consider working, for Axion-IA as an independent trainer or as a speaker provided by a subcontracting training organisation, we process personal data about you, including if you operate as a sole trader: your last name, first name, email address, phone number, business address, postcode and town of practice; your company numbers (SIREN, SIRET), your training activity declaration number and your VAT regime; your IBAN; the documents you send us (URSSAF due-diligence certificate and its verification code, insurance certificate, CV, proofs of skills, declaration receipt); the courses you deliver, your assignments, attendance sheets and the invoices issued for your fees. Online file: it opens through a personal link, valid for 30 days; when the team sends you a new link, or when you send your file, the previous links stop working. When you upload a document, it is scanned by an antivirus before being accepted, then stored encrypted; a member of the team checks it. The declarations you make when sending your file are recorded with their date and time. To sign a document online, you receive by email a one-time code, valid for 15 minutes. Public register: we query the French State business directory (recherche-entreprises.api.gouv.fr), which includes the public list of training organisations, to check that your company is active and that your declaration number is indeed assigned to it; we keep a dated proof of each check, which is never altered. Purposes and legal bases: entering into and performing the subcontracting framework agreement and each assignment (GDPR art. 6.1.b); complying with our legal obligations, in particular the principal's due-diligence obligation (art. L.8222-1 of the French Labour Code), bookkeeping and invoicing (art. 6.1.c); checking the reliability of the companies we work with and choosing the best-placed trainer for an assignment (art. 6.1.f). For that choice, the team looks at an internal list, never published nor shown to trainers: the distance between the training venue and the centre of your town of practice (never your address), the number of courses you have delivered over the last three years and the average satisfaction score given by the trainees of those sessions, shown only from five reviews; an assignment you declined is never counted. Automatic checks may suspend an assignment or a transfer (for instance an expired certificate); they never conclude on their own: opening your space, choosing a trainer for an assignment and any follow-up to a check are decided by a member of the team. Security: your IBAN is stored encrypted, and any change is checked by a person before a transfer. Recipients: the Axion-IA team; ZeptoMail, the provider that delivers our emails; our Zoho Mail mailbox, which receives your replies; the team's internal Telegram messaging, notified that your file was sent with a short identifier and the result of the register check, without your name; Calendly, if you book a call; client companies and, when the training is funded, its funder, which receive your name, your role and the proofs that the training took place. Your data is neither sold nor transferred. Retention: your application (CV, videos and exchanges included) is erased automatically two years after our last exchange, like any application; if no working relationship begins, your file is kept for up to two years after our last exchange. When our collaboration ends, access to your online space is closed, and the following periods run from that date: the agreement and due-diligence proofs (certificates and checks) are kept for five years; invoices and accounting records, for ten years (art. L.123-22 of the French Commercial Code). Apart from the application, your data is not deleted automatically at present: it is erased at the end of these periods during a review, and you may ask for it to be erased at any time, subject to the documents the law requires us to keep. You have the rights of access, rectification, erasure, objection, restriction and portability, by writing to contact@axion-ia.com, and the right to lodge a complaint with the CNIL. If you ask for access to your data, the copy of your online file data shows your IBAN masked (only its first four and last four characters appear) and the list of your documents, without their content. A request to erase your online file data is handled by a member of the team, by pseudonymisation, and access to your space is closed: if no collaboration has begun, your name and contact details are replaced by an erasure notice, and your IBAN and your company numbers are erased; if a collaboration has begun, your identity is kept for invoicing and only your phone number is removed. Documents the law requires us to keep remain intact: agreements, due-diligence proofs, Kbis extract or Sirene status notice, proof of your training declaration number, declaration receipt, insurance certificate and, if a collaboration has begun, proofs of skills and bank details; the others, such as the CV, are hidden.",
        },
        {
          title: "Professional event organisers",
          anchor: "organisateurs-evenements",
          body: "Axion-IA identifies professional events (trade fairs, conferences, entrepreneur clubs and networks, discussion cafés, business meetings…) and their organisers, in order to offer them talks by Williams Jullin, founder of Axion-IA, and to introduce our services to them. Data collected: the name of the organisation; the surname, first name and job title of the person presented as the contact; their business e-mail address and telephone number; the address of the contact form; information about the event (name, dates, venue, audience). Source: public pages only — the website of the event or of the organisation, online event calendars, public business directories. No data is purchased. Legal basis: our legitimate interest (GDPR art. 6.1.f) in offering our talks and services to organisers of professional events, in the context of their professional role. Information: every first message we send you states where your contact details come from and how to object (art. 14). Recipients: the Axion-IA team; our internal customer relationship management software (CRM), hosted in the European Union; the provider that delivers our e-mails. Your data is neither sold nor transferred. Retention: for the duration of our exchanges with professional event organisers; you may request its erasure at any time. If you object, we keep only a fingerprint (hash) of your address, so that we never write to you again. You have the rights of access, rectification, erasure and objection — at any time and without having to give a reason, by replying “STOP” to any of our messages or by writing to contact@axion-ia.com —, restriction and portability, as well as the right to lodge a complaint with the CNIL (French data protection authority).",
        },
        {
          title: "Your rights",
          body: "Access, rectification, erasure, objection, portability, limitation. Contact contact@axion-ia.com. You also have the right to lodge a complaint with the CNIL.",
        },
        {
          title: "Hosting and transfers",
          body:
            "Primary hosting in the European Union (Germany) and edge services with EU presence prioritized. Several sub-processors are however established outside the EU, or process data there: notably US AI models when editorial content is generated or fact-checked, and the third-party appointment booking service embedded on the /appel page. The complete list, with each one's location and transfer framework (Standard Contractual Clauses, adequacy decision), is published and kept up to date at /subprocessors. This policy deliberately gives no nominative enumeration: /subprocessors is the single source of truth, and prose that does not enumerate cannot diverge from it." +
            CN_EN.hebergementIA,
        },
        {
          title: "Sub-processors and data recipients",
          body:
            "In accordance with GDPR article 13.1.e, Axion-IA maintains an exhaustive public list of its sub-processors at /subprocessors (categories: " +
            CN_EN.categories +
            "). That page specifies for each sub-processor its purpose, the categories of data processed, server location, legal basis, DPA status and international transfer framework. Any change is notified by email to active clients at least 30 days before taking effect. No data is ever sold or shared for advertising purposes. When you send us a request (form, site assistant, appointment booking), the team's internal Telegram messaging receives the full content of your request, so that it can be answered quickly.",
        },
        {
          title: "Generative AI and transparency (EU AI Act)",
          body:
            "Certain editorial content on the site (articles signed by Manon, city pages, FAQs) is written by generative AI models (OpenAI GPT-4o for drafting, Perplexity Sonar for fact-checking) and then subjected to automated checks before publication — fact-checking, editorial control and doctrine alignment. Human review is not systematic. In accordance with article 50 of the EU AI Act (2024/1689), the AI-assisted nature of this content is publicly disclosed — see the transparency notice at /equipe/manon." +
            CN_EN.iaGenerativeIA +
            " You may object to any processing of your data by an AI model (GDPR art. 21) by writing to contact@axion-ia.com.",
        },
      ],
      metaSeo: {
        title: "Privacy policy · Axion-IA",
        description:
          "GDPR + AI Act, personal data, rights, CNIL. EU Hetzner Frankfurt hosting + published sub-processors.",
      },
    },
  },
  {
    slug: "cookies",
    pathFr: "/cookies",
    pathEn: "/cookies",
    fr: {
      title: "Politique de cookies",
      intro:
        "Cookies utilisés sur axion-ia.com — minimum strict, aucun cookie publicitaire ni cookie de profilage.",
      sections: [
        {
          title: "Cookies strictement nécessaires",
          body: "Cookies de session pour l'authentification admin (durée de session) et préférence de langue (12 mois). Ces cookies sont strictement nécessaires au service demandé : aucun consentement requis (RGPD art. 5.3 exception). Le cookie de provenance de campagne axion_utm n'en fait pas partie : il est décrit dans la section suivante.",
        },
        {
          title: "Cookie de provenance de campagne (axion_utm)",
          body: "Le cookie axion_utm n'est déposé qu'après votre accord dans la bannière cookies (bouton « Accepter »), et seulement si l'adresse de la page sur laquelle vous donnez cet accord porte des paramètres de campagne (utm_*). Il est conservé 30 jours ; il est HttpOnly, Secure et SameSite Lax. Il sert à rattacher votre visite à une campagne (source, support, nom, terme et contenu). Si vous prenez ensuite un rendez-vous, sa source, son support, son nom et son contenu sont enregistrés avec votre rendez-vous, qui est nominatif : ce cookie n'est donc pas un cookie strictement nécessaire. Pour vous y opposer, cliquez sur « Refuser » dans la bannière : le cookie est alors supprimé s'il avait déjà été déposé. Si vous avez déjà répondu, le bouton « Réinitialiser mon choix » de la page Préférences cookies supprime aussi ce cookie et vous propose de nouveau la bannière. Vous pouvez également le supprimer dans les réglages de votre navigateur, ou écrire à contact@axion-ia.com. Sans ce cookie, le site et la prise de rendez-vous fonctionnent normalement ; seule l'origine de la campagne peut ne plus être rattachée à votre rendez-vous.",
        },
        {
          title: "Statistiques anonymes",
          body: "Plausible self-hosted (Hetzner Frankfurt, UE), sans cookie persistant, sans empreinte numérique, conforme à l'avis CNIL 2022. Aucun consentement requis car aucune donnée personnelle.",
        },
        {
          title: "Analytics qualitatifs avec consentement (Microsoft Clarity)",
          body: "Microsoft Clarity est proposé en complément de Plausible pour les heatmaps de clic/scroll et le session replay anonymisé (masquage automatique des champs de formulaire). Il dépose 2 cookies : `_clck` (1 an, identifiant visiteur) et `_clsk` (1 jour, identifiant session). Le transfert UE → USA est encadré par les Clauses Contractuelles Types (SCC). Aucun cookie déposé sans votre consentement explicite via le bandeau cookies (CNIL art. 82 + RGPD art. 7) ; vous pouvez refuser ou retirer votre consentement à tout moment depuis /preferences-cookies. Durée de conservation du choix : 13 mois maximum (recommandation CNIL).",
        },
        {
          title: "Pixel publicitaire Meta (Facebook / Instagram), avec consentement",
          body: "Sur les seules pages du tunnel de candidature des apporteurs d'affaires venus de Facebook (/apporteur-affaires et /apporteur-affaires/merci, ainsi que la page vidéo /apporteur-affaires/video et sa page de remerciement), le pixel Meta est proposé pour mesurer les candidatures issues de la campagne, optimiser sa diffusion et recibler les visiteurs de cette page. Il dépose 2 cookies : `_fbp` (90 jours, identifiant navigateur) et `_fbc` (90 jours, présent si vous êtes arrivé par un lien Facebook). Il n'est chargé nulle part ailleurs sur le site, et jamais sans votre consentement explicite via le bandeau, qui le nomme sur ces pages. Lorsque vous envoyez le formulaire de cette page et que vous avez accepté le bandeau, notre serveur transmet aussi à Meta votre e-mail, votre téléphone, votre prénom et votre ville sous forme HACHÉE (SHA-256, irréversible), pour que la conversion soit comptée une seule fois. Sur la page vidéo, ces envois portent sur deux moments : la validation du premier temps du formulaire, puis la réservation de votre échange ; votre réponse au bandeau est conservée sur votre fiche pour que le second envoi ne parte que si vous aviez accepté. Le transfert UE → USA est encadré par les Clauses Contractuelles Types. Vous pouvez refuser ou retirer votre consentement à tout moment depuis /preferences-cookies.",
        },
        {
          title: "Calendrier de réservation (Calendly)",
          body: "La page /appel affiche les créneaux disponibles SANS que votre navigateur contacte Calendly. C'est notre serveur qui les demande à Calendly LLC (Atlanta, États-Unis) et qui vous les envoie en HTML : tant que vous ne cliquez pas un horaire, aucune requête n'est adressée à Calendly depuis votre appareil, votre adresse IP ne lui est pas transmise, et aucun cookie tiers n'est déposé. C'est aussi pour cela qu'aucun consentement ne vous est demandé pour afficher ce calendrier : l'article 82 de la loi Informatique et Libertés vise l'accès à votre terminal, et il n'y en a pas pour ce calendrier (hors le cookie de provenance de campagne axion_utm décrit dans sa section dédiée, et la page de rendez-vous du Tour France IA).\n\nQuand vous cliquez un horaire, vous quittez notre site pour calendly.com, où vous saisissez vos nom, adresse e-mail, numéro de téléphone et vos réponses aux questions du formulaire. À partir de là, Calendly reçoit votre adresse IP, dépose ses cookies sur son propre domaine et traite ces données pour ses finalités propres, décrites sur calendly.com/privacy. Notre serveur récupère ensuite ces informations auprès de Calendly pour enregistrer le rendez-vous et vous recontacter. Si vous êtes arrivé par un lien de campagne, cette campagne (source, support, nom et contenu) est enregistrée avec votre rendez-vous lorsqu'elle figure dans l'adresse de la page de rendez-vous ou dans le cookie axion_utm déposé avec votre accord. L'emplacement du bouton sur lequel vous avez cliqué sur notre site est aussi enregistré avec votre rendez-vous. Le transfert vers les États-Unis est encadré par les Clauses Contractuelles Types.\n\nEn cas d'indisponibilité de Calendly — et pendant les premières minutes qui suivent chaque mise en ligne du site — la page affiche à la place un bouton « Afficher le calendrier ». Le calendrier n'est alors chargé qu'après ce clic, et il dépose les cookies de calendly.com sur votre appareil : ce clic vaut consentement, et un lien « Ouvrir Calendly dans un nouvel onglet » reste disponible sans rien charger sur notre page.\n\nLa page du Tour France IA (/tour-france-ia) mène à ce même parcours de rendez-vous : elle ne fait elle-même aucune mesure et n'enregistre rien. Comme sur toute page du site, le cookie de provenance de campagne axion_utm (conservé 30 jours, décrit dans la politique de cookies) ne peut y être déposé qu'après votre accord dans la bannière cookies, lorsque l'adresse porte des paramètres de campagne (utm_*).\n\nException : la page de rendez-vous du Tour France IA (/appel/tour-france-ia) enregistre son affichage, sans vous identifier : type d'appareil, langue, bouton d'origine et, si vous êtes arrivé par un lien de campagne, l'origine de cette campagne (source, support et nom, lus dans le cookie de provenance de campagne axion_utm, conservé 30 jours et décrit dans sa section dédiée), ainsi que l'adresse de la page (route). Un identifiant d'onglet et un témoin d'affichage sont gardés dans le stockage de session de votre navigateur et effacés à la fermeture de l'onglet ; cette mesure ne dépose elle-même aucun cookie et votre adresse IP n'est pas conservée en base de données (elle ne sert qu'à limiter temporairement le nombre de requêtes). Le cookie axion_utm qu'elle lit n'est déposé qu'avec votre accord : voir sa section dédiée.",
        },
        {
          title: "Cookies tiers",
          body: "Aucun cookie de tracking cross-site sur le site. Deux tiers seulement peuvent déposer un cookie, et uniquement après acceptation du bandeau : Microsoft Clarity, et le pixel Meta sur les seules pages /apporteur-affaires, /apporteur-affaires/video et leurs pages de remerciement. Sur la page /appel, Calendly n'en dépose que dans le mode de secours décrit ci-dessus, et seulement après votre clic sur « Afficher le calendrier » — en fonctionnement normal, votre navigateur ne contacte jamais Calendly.",
        },
        {
          title: "Gérer vos cookies",
          body: "Le bandeau cookies vous permet d'accepter ou refuser les analytics Microsoft Clarity et la mesure de la provenance des campagnes (cookie axion_utm), ainsi que le pixel Meta sur les seules pages qui le nomment. Votre choix est conservé 13 mois maximum (recommandation CNIL). Tous les navigateurs modernes permettent en plus de bloquer les cookies globalement — le blocage des cookies strictement nécessaires peut empêcher l'usage de la console admin.",
        },
      ],
      metaSeo: {
        title: "Politique de cookies · Axion-IA",
        description:
          "Cookies Axion-IA : strictement nécessaires + Plausible anonyme. Aucun cookie publicitaire.",
      },
    },
    en: {
      title: "Cookie policy",
      intro:
        "Cookies used on axion-ia.com — strict minimum, no advertising cookies, no profiling cookies.",
      sections: [
        {
          title: "Strictly necessary cookies",
          body: "Session cookies for admin authentication (session duration) and language preference (12 months). These cookies are strictly necessary for the service requested: no consent required (GDPR art. 5.3 exception). The axion_utm campaign-origin cookie is not one of them: it is described in the next section.",
        },
        {
          title: "Campaign-origin cookie (axion_utm)",
          body: "The axion_utm cookie is set only after you agree in the cookie banner (“Accept” button), and only if the address of the page on which you agree carries campaign parameters (utm_*). It is kept for 30 days; it is HttpOnly, Secure and SameSite Lax. It ties your visit to a campaign (source, medium, name, term and content). If you then book an appointment, its source, medium, name and content are recorded with your appointment, which is in your name: this cookie is therefore not a strictly necessary cookie. To object, click “Decline” in the banner: the cookie is then deleted if it had already been set. If you have already answered, the “Reset my choice” button on the Cookie preferences page also deletes this cookie and shows you the banner again. You may also delete it in your browser settings, or write to contact@axion-ia.com. Without this cookie, the site and the booking flow work normally; only the campaign origin may no longer be attached to your appointment.",
        },
        {
          title: "Anonymous statistics",
          body: "Self-hosted Plausible (Hetzner Frankfurt, EU), without persistent cookies, without digital fingerprinting, compliant with the 2022 CNIL guidance. No consent required as no personal data.",
        },
        {
          title: "Consent-gated qualitative analytics (Microsoft Clarity)",
          body: "Microsoft Clarity is offered alongside Plausible for click/scroll heatmaps and anonymised session replay (automatic form field masking). It drops 2 cookies: `_clck` (1 year, visitor identifier) and `_clsk` (1 day, session identifier). The EU → US transfer is covered by Standard Contractual Clauses (SCC). No cookie is dropped without your explicit consent via the cookie banner (CNIL art. 82 + GDPR art. 7); you may decline or withdraw your consent at any time from /cookie-preferences. Consent retention: 13 months maximum (CNIL recommendation).",
        },
        {
          title: "Meta advertising pixel (Facebook / Instagram), with consent",
          body: "On the application funnel pages for business introducers coming from Facebook only (/apporteur-affaires and /apporteur-affaires/merci, as well as the video page /apporteur-affaires/video and its thank-you page), the Meta pixel is offered to measure applications coming from the campaign, optimise its delivery and retarget visitors of that page. It sets 2 cookies: `_fbp` (90 days, browser identifier) and `_fbc` (90 days, present if you arrived through a Facebook link). It is loaded nowhere else on the site, and never without your explicit consent via the banner, which names it on those pages. When you submit that page's form and have accepted the banner, our server also sends Meta your email, phone, first name and city in HASHED form (SHA-256, irreversible), so the conversion is counted once. On the video page these transmissions cover two moments: the completion of the first step of the form, then the booking of your call; your answer to the banner is kept on your record so that the second transmission only happens if you had accepted. The EU → US transfer is covered by Standard Contractual Clauses. You may decline or withdraw your consent at any time from /cookie-preferences.",
        },
        {
          title: "Booking calendar (Calendly)",
          body: "The /appel page shows the available time slots WITHOUT your browser contacting Calendly. Our server requests them from Calendly LLC (Atlanta, USA) and sends them to you as plain HTML: until you click a slot, no request is sent to Calendly from your device, your IP address is not disclosed to it, and no third-party cookie is set. That is also why no consent is requested to display this calendar: article 82 of the French Data Protection Act covers access to your terminal, and there is none for this calendar (apart from the axion_utm campaign-origin cookie described in its own section, and the Tour France IA booking page).\n\nWhen you click a slot, you leave our site for calendly.com, where you enter your name, email address, phone number and answers to the form questions. From that point on, Calendly receives your IP address, sets its cookies on its own domain and processes that data for its own purposes, described at calendly.com/privacy. Our server then retrieves those details from Calendly to record the appointment and get back to you. If you arrived through a campaign link, that campaign (source, medium, name and content) is recorded with your booking when it appears in the address of the booking page or in the axion_utm cookie set with your consent. The position of the button you clicked on our site is also recorded with your booking. The transfer to the United States is covered by Standard Contractual Clauses.\n\nIf Calendly is unavailable — and during the first few minutes after each site release — the page shows a “Show the calendar” button instead. The calendar is then loaded only after that click, and it does set calendly.com cookies on your device: the click stands as consent, and an “Open Calendly in a new tab” link remains available without loading anything on our page.\n\nThe Tour France IA page (/tour-france-ia) leads to this same booking flow: it performs no measurement itself and records nothing. As on any page of the site, the axion_utm campaign-origin cookie (kept for 30 days, described in the cookie policy) can only be set there after you agree in the cookie banner, when the address carries campaign parameters (utm_*).\n\nException: the Tour France IA booking page (/appel/tour-france-ia) records its display without identifying you: device type, language, originating button and, if you arrived through a campaign link, that campaign's source, medium and name (read from the axion_utm campaign-origin cookie, kept for 30 days and described in its own section), as well as the page address (route). A tab identifier and a display marker are kept in your browser's session storage and erased when the tab is closed; this measurement sets no cookie itself and your IP address is not stored in the database (it is only used to temporarily limit the number of requests). The axion_utm cookie it reads is only set with your consent: see its own section.",
        },
        {
          title: "Third-party cookies",
          body: "No cross-site tracking cookies on the site. Only two third parties may set a cookie, and only after the banner is accepted: Microsoft Clarity, and the Meta pixel on the /apporteur-affaires and /apporteur-affaires/video pages and their thank-you pages only. On the /appel page, Calendly only sets cookies in the fallback mode described above, and only after you click “Show the calendar” — in normal operation your browser never contacts Calendly.",
        },
        {
          title: "Manage your cookies",
          body: "The cookie banner lets you accept or decline Microsoft Clarity analytics and campaign-origin measurement (axion_utm cookie), as well as the Meta pixel on the only pages that name it. Your choice is kept for 13 months maximum (CNIL recommendation). All modern browsers additionally allow blocking cookies globally — blocking strictly necessary cookies may prevent use of the admin console.",
        },
      ],
      metaSeo: {
        title: "Cookie policy · Axion-IA",
        description:
          "Axion-IA cookies: strictly necessary + anonymous Plausible. No advertising cookies.",
      },
    },
  },
  {
    slug: "rgpd",
    pathFr: "/rgpd",
    pathEn: "/rgpd",
    fr: {
      title: "RGPD · droits utilisateurs",
      intro:
        "Récapitulatif de vos droits RGPD applicables aux données traitées par Axion-IA. Réponse sous 30 jours par notre contact RGPD.",
      sections: [
        {
          title: "Droit d'accès (art. 15)",
          body: "Obtenir la confirmation que vos données sont traitées et en recevoir une copie.",
        },
        {
          title: "Droit de rectification (art. 16)",
          body: "Faire corriger des données inexactes ou incomplètes vous concernant.",
        },
        {
          title: "Droit à l'effacement (art. 17)",
          body: "Demander la suppression de vos données, sous réserve des obligations légales (pièces comptables : dix ans, article L.123-22 du code de commerce).",
        },
        {
          title: "Droit d'opposition (art. 21)",
          body: "Vous opposer au traitement basé sur l'intérêt légitime ou aux fins de prospection.",
        },
        {
          title: "Droit à la portabilité (art. 20)",
          body: "Recevoir vos données dans un format structuré (JSON) ou demander leur transmission directe à un autre responsable.",
        },
        {
          title: "Droit à la limitation (art. 18)",
          body: "Faire suspendre le traitement de vos données dans des cas spécifiques (contestation d'exactitude, etc.).",
        },
        {
          title: "Comment exercer vos droits",
          body: "Email : contact@axion-ia.com. Réponse sous 30 jours. En cas d'insatisfaction, vous pouvez saisir la CNIL (Commission Nationale de l'Informatique et des Libertés) — www.cnil.fr.",
        },
      ],
      metaSeo: {
        title: "RGPD · droits utilisateurs · Axion-IA",
        description:
          "Vos 6 droits RGPD chez Axion-IA : accès, rectification, effacement, opposition, portabilité, limitation.",
      },
    },
    en: {
      title: "GDPR · user rights",
      intro:
        "Summary of your GDPR rights applicable to data processed by Axion-IA. GDPR contact reply within 30 days.",
      sections: [
        {
          title: "Right of access (art. 15)",
          body: "Confirm that your data is being processed and receive a copy.",
        },
        {
          title: "Right to rectification (art. 16)",
          body: "Have inaccurate or incomplete data about you corrected.",
        },
        {
          title: "Right to erasure (art. 17)",
          body: "Request deletion of your data, subject to legal obligations (accounting records: ten years, article L.123-22 of the French Commercial Code).",
        },
        {
          title: "Right to object (art. 21)",
          body: "Object to processing based on legitimate interest or for direct marketing purposes.",
        },
        {
          title: "Right to portability (art. 20)",
          body: "Receive your data in a structured format (JSON) or have it transmitted directly to another controller.",
        },
        {
          title: "Right to restriction (art. 18)",
          body: "Have processing suspended in specific cases (dispute over accuracy, etc.).",
        },
        {
          title: "How to exercise your rights",
          body: "Email: contact@axion-ia.com. Reply within 30 days. If unsatisfied, you may file a complaint with the CNIL (French DPA) — www.cnil.fr.",
        },
      ],
      metaSeo: {
        title: "GDPR · user rights · Axion-IA",
        description:
          "Your 6 GDPR rights at Axion-IA: access, rectification, erasure, objection, portability, restriction.",
      },
    },
  },
  {
    slug: "politique-deplacement",
    pathFr: "/politique-deplacement",
    pathEn: "/travel-policy",
    fr: {
      title: "Politique de",
      titleEm: "déplacement",
      intro:
        "Conditions et modalités de déplacement pour les interventions sur site (Module 1) et les audits sur site (Module 2).",
      sections: [
        {
          title: "Périmètre d'intervention",
          body: "France métropolitaine, Belgique, Luxembourg, Suisse romande. Au-delà, modalités définies ensemble au devis.",
        },
        {
          title: "Validation préalable",
          body: "Tout déplacement hors périmètre standard est défini et accepté par le client avant départ, dans le cadre du devis.",
        },
        {
          title: "Annulation pour cas de force majeure",
          body: "Grève transports, conditions météo extrêmes, pandémie : réorganisation à distance ou report sur un nouveau créneau.",
        },
      ],
      metaSeo: {
        title: "Politique de déplacement · Axion-IA",
        description:
          "Conditions et modalités de déplacement Axion-IA pour les interventions sur site. Périmètre France/BE/LU/CH.",
      },
    },
    en: {
      title: "Travel",
      titleEm: "policy",
      intro:
        "Travel conditions and arrangements for on-site sessions (Module 1) and on-site audits (Module 2).",
      sections: [
        {
          title: "Coverage area",
          body: "France, Belgium, Luxembourg, French-speaking Switzerland. Beyond, arrangements defined together in the quote.",
        },
        {
          title: "Prior validation",
          body: "Any travel outside the standard area is defined and accepted by the client before departure, as part of the quote.",
        },
        {
          title: "Force majeure cancellation",
          body: "Transport strikes, extreme weather, pandemic: remote rescheduling or a new slot.",
        },
      ],
      metaSeo: {
        title: "Travel policy · Axion-IA",
        description:
          "Axion-IA travel conditions and arrangements for on-site sessions. France/BE/LU/CH coverage area.",
      },
    },
  },
  {
    slug: "reclamations",
    pathFr: "/reclamations",
    pathEn: "/reclamations",
    fr: {
      title: "Procédure de",
      titleEm: "réclamation",
      intro:
        "Procédure de traitement des difficultés, des réclamations et des aléas survenus en cours de prestation chez Axion-IA : qui peut signaler, comment déposer une réclamation, délais de réponse, traitement et actions correctives, enregistrement au registre des incidents, voies de recours internes et externes.",
      sections: [
        {
          // 🔴 Audit blanc Qualiopi 2026-08-15 — écart sur l'indicateur 31.
          // Le RNQ V9 nomme TROIS objets : « les difficultés, réclamations et
          // ALÉAS survenus en cours de prestation ». Le champ d'application
          // publié n'en couvrait qu'un — la réclamation — et le mot « aléa »
          // n'apparaissait dans aucun texte publié.
          //
          // Le dispositif, lui, existait déjà : le registre des incidents est
          // opérationnel (`src/server/qualiopi/registres/incidents-service.ts`,
          // modèle Prisma `Incident` : type, gravité, action corrective, statut,
          // export PDF). L'écart était purement rédactionnel — mais un auditeur
          // COFRAC cherche littéralement les trois mots du libellé officiel, et
          // un dispositif non décrit est un dispositif qu'il ne peut pas coter.
          //
          // ⚠️ Les définitions ci-dessous sont alignées sur les énumérations
          // RÉELLES de la base (IncidentType, IncidentGravite, IncidentStatut).
          // Si ces enums évoluent, ce texte doit suivre : décrire un registre
          // autrement qu'il n'est tenu vaut moins que ne pas le décrire.
          title: "Objet et champ d'application",
          body: "La présente procédure décrit les modalités de signalement et de traitement des difficultés, des réclamations et des aléas survenus en cours de prestation. Elle s'applique à l'ensemble des actions de formation d'Axion-IA, en présentiel comme à distance, ainsi qu'aux prestations d'accompagnement qui les prolongent. Peut la mettre en œuvre toute personne concernée par une prestation : le stagiaire, l'entreprise cliente qui la commande, le financeur (OPCO, France Travail ou tout autre organisme prenant en charge le coût), ainsi que le formateur ou l'intervenant qui la réalise. Les trois objets se distinguent par leur nature. Une difficulté est un obstacle rencontré pendant le déroulement de la prestation et signalé afin d'être levé sans attendre : rythme inadapté, prérequis manquant, défaut d'accessibilité, accès à un outil ou à une salle. Une réclamation s'entend de toute expression écrite d'insatisfaction relative à l'organisation, au contenu, au déroulement, aux moyens pédagogiques ou aux conditions administratives d'une prestation. Un aléa est un événement imprévu qui affecte l'exécution de la prestation telle qu'elle était prévue : indisponibilité d'un formateur, défaillance technique, indisponibilité des locaux, absence collective, cas de force majeure.",
        },
        {
          // 🔴 2026-08-15 — AUCUN DÉLAI DE DÉPÔT. Le livret d'accueil imposait
          // « dans un délai de 10 jours ouvrés suivant la situation litigieuse »
          // (clause retirée le même jour). Un délai de forclusion sur le dépôt
          // d'une réclamation qualité est un non-sens au regard de l'indicateur
          // 31 : il rend irrecevable la réclamation qui arrive après le solde de
          // la formation, c'est-à-dire précisément celle que l'auditeur cherche.
          //
          // ⚠️ La dernière phrase n'est PAS un renoncement au délai de
          // forclusion de 90 jours des CGV (section « Délai de réclamation sur
          // une prestation ») : elle sépare la recevabilité au titre de la
          // présente procédure QUALITÉ de la mise en jeu de la responsabilité
          // CONTRACTUELLE. Sans cette phrase, les deux textes se démentaient.
          title: "Comment signaler une difficulté ou déposer une réclamation",
          body: "Une difficulté peut être signalée à tout moment, oralement au formateur pendant la séquence ou par écrit à contact@axion-ia.com. Le formateur y répond immédiatement lorsque sa levée relève de lui et la transmet au référent pédagogique dans le cas contraire. Une réclamation est formulée par écrit, afin d'en garantir la traçabilité : par email à contact@axion-ia.com ou par courrier au siège de l'organisme. Pour permettre un traitement efficace, elle précise l'identité du réclamant, la prestation concernée (intitulé et dates), une description factuelle de la situation et, le cas échéant, les attentes du réclamant. Aucun délai de dépôt n'est opposé au réclamant : une réclamation est recevable pendant le déroulement de la prestation comme après son terme. Les délais de réclamation prévus par les conditions générales de vente concernent la mise en jeu de la responsabilité contractuelle d'Axion-IA ; ils sont sans effet sur la recevabilité d'une réclamation au titre de la présente procédure.",
        },
        {
          title: "Délais de traitement",
          body: "Axion-IA accuse réception de la réclamation dans un délai de 5 jours ouvrés à compter de sa réception. Une réponse circonstanciée est apportée dans un délai maximum de 15 jours ouvrés à compter de la réception de la réclamation. Lorsque l'analyse nécessite un délai supplémentaire, le réclamant en est informé, avec l'indication d'un nouveau délai prévisionnel.",
        },
        {
          title: "Traitement et actions correctives",
          body: "Chaque réclamation est enregistrée puis instruite par le référent pédagogique. L'instruction consiste à analyser les faits, à recueillir si nécessaire le point de vue du formateur et des parties concernées, et à déterminer les suites appropriées. Lorsqu'un dysfonctionnement est avéré, une ou plusieurs actions correctives sont définies et mises en œuvre afin d'éviter son renouvellement. Le responsable qualité est propriétaire de la présente procédure : il s'assure de son application, du respect des délais annoncés et de la clôture effective de chaque dossier.",
        },
        {
          // 🔴 2026-08-15 — SECTION AJOUTÉE. C'est le cœur de la correction :
          // l'indicateur 31 attend un traitement décrit des aléas, distinct de
          // celui des réclamations (un aléa n'a pas de réclamant, personne ne
          // se plaint, et pourtant la prestation dévie de ce qui était prévu).
          //
          // Les mesures de remédiation énumérées sont limitatives et doivent le
          // rester : chacune est réellement praticable et sans surcoût pour le
          // client. N'ajouter une mesure ici que si elle est effectivement
          // tenable — un engagement publié se constate le jour de l'audit.
          //
          // 🔴 2026-10-16 (L16, NC) — « remplacement du formateur par un intervenant
          // de compétences équivalentes » RETIRÉ sur décision de Will : la promesse
          // n'est pas tenable. Ne pas la réintroduire sans une nouvelle décision.
          //
          // ⚠️ Le délai de 24 heures ouvrées est un ENGAGEMENT PUBLIÉ : il
          // suppose que le registre des incidents soit alimenté au fil de l'eau
          // et non reconstitué avant l'audit. `dateIncident` et `createdAt` du
          // modèle `Incident` sont deux champs distincts ; un écart systématique
          // entre les deux est exactement ce qu'un auditeur regarde.
          title: "Aléas survenus en cours de prestation",
          body: "Tout aléa survenu en cours de prestation est déclaré au responsable qualité dans un délai de 24 heures ouvrées à compter de sa survenance ou, s'il est constaté plus tard, de sa découverte. La déclaration incombe au formateur ou à l'intervenant qui constate l'aléa ; le stagiaire, l'entreprise cliente et le financeur peuvent également le signaler, par les mêmes voies qu'une réclamation. Chaque aléa est systématiquement enregistré au registre des incidents, qui mentionne sa date, son type (pédagogique, administratif, technique ou autre), sa gravité (mineure, majeure ou critique), la session concernée le cas échéant, l'action corrective décidée et son statut de traitement (ouvert, en cours, résolu) jusqu'à la clôture du dossier. Selon la nature de l'aléa, les mesures de remédiation admises sont le report de la séquence ou de la session sans frais pour le client, ou l'organisation d'une séquence de rattrapage permettant d'atteindre les objectifs pédagogiques prévus. Le stagiaire, l'entreprise cliente et, lorsque la prestation est financée, le financeur sont informés de l'aléa, de la mesure retenue et de ses conséquences éventuelles sur le calendrier, sur les modalités ou sur la durée de la prestation.",
        },
        {
          title: "Suivi, registres et amélioration continue",
          body: "Les réclamations sont consignées au registre des réclamations, les aléas au registre des incidents. L'un et l'autre sont tenus à jour, exportables et tenus à la disposition du client, du financeur et de l'organisme certificateur. Les actions correctives associées, leur mise en œuvre et leur efficacité font l'objet d'un suivi et d'une analyse périodique en revue de direction, qui alimentent la démarche d'amélioration continue de la qualité des prestations.",
        },
        {
          title: "Voies de recours internes",
          body: "Si la réponse apportée ne satisfait pas le réclamant, celui-ci peut demander un réexamen de sa situation auprès de la direction d'Axion-IA, en exposant les motifs de sa contestation. Le réexamen donne lieu à une réponse écrite. Lorsque la prestation fait l'objet d'un financement, le financeur (OPCO, France Travail ou autre) peut être informé à tout moment de la réclamation et des suites qui lui ont été données.",
        },
        {
          // 🔴 2026-08-15 — SECTION AJOUTÉE. Aucune voie de recours EXTERNE
          // n'était publiée : la procédure se refermait sur « les dispositions
          // prévues par les conditions générales », ce qu'un auditeur lit comme
          // une absence de recours indépendant.
          //
          // ⚠️⚠️ NE PAS NOMMER DE MÉDIATEUR ICI. Axion-IA n'a adhéré à AUCUN
          // dispositif de médiation de la consommation à ce jour — c'est déjà
          // constaté aux mentions légales (« Médiation de la consommation ») et
          // aux CGV (« Particulier — médiation de la consommation »). Écrire un
          // nom de médiateur sur une page publique alors qu'aucune adhésion
          // n'existe est une affirmation fausse sur un support opposable : le
          // silence est moins grave que le mensonge.
          //
          // 📍 EMPLACEMENT RÉSERVÉ — le jour de l'adhésion à un médiateur agréé
          // CECMC (obligation de l'art. L.612-1 dès la première vente à un
          // consommateur), insérer ICI une phrase du type : « Conformément aux
          // articles L.611-1 et suivants du Code de la consommation, le client
          // consommateur peut recourir gratuitement au médiateur <NOM>,
          // <ADRESSE POSTALE>, <URL>, après avoir adressé une réclamation
          // écrite à Axion-IA. » Et dans le MÊME patch : renseigner les clés
          // `mediateur_consommation_nom` / `mediateur_consommation_url` en
          // configuration Qualiopi, remplacer le constat des CGV et des
          // mentions légales, et compléter `contrat-formation.tsx` qui
          // n'imprime aucune clause de médiation.
          title: "Voies de recours externes",
          body: "Lorsque le désaccord persiste à l'issue du réexamen interne, le client conserve l'intégralité des voies de recours de droit commun. Les prestations d'Axion-IA étant commercialisées auprès d'une clientèle professionnelle, le dispositif de médiation de la consommation prévu aux articles L.611-1 et suivants du Code de la consommation n'est pas applicable à ces relations et Axion-IA n'a, à ce jour, adhéré à aucun dispositif de médiation ; toute vente à un consommateur suppose l'adhésion préalable à un médiateur agréé, dont les coordonnées seront alors publiées dans la présente section. À défaut de résolution amiable, le litige relève du tribunal compétent désigné par les conditions générales de vente, soit celui du ressort du siège social d'Axion-IA. Lorsque la prestation bénéficie d'un financement public ou mutualisé, le financeur peut être saisi au titre du contrôle qu'il exerce sur les actions qu'il prend en charge. Les services régionaux de contrôle de la formation professionnelle (DREETS) exercent le contrôle des organismes de formation en application des articles L.6361-1 et suivants du Code du travail et peuvent être saisis à ce titre.",
        },
      ],
      metaSeo: {
        title: "Difficultés, réclamations et aléas · Axion-IA",
        description:
          "Procédure Axion-IA de traitement des difficultés, réclamations et aléas : dépôt écrit sans délai opposable, accusé de réception sous 5 jours ouvrés, réponse sous 15 jours ouvrés, registre des incidents et voies de recours.",
      },
    },
    // ⚠️ 2026-08-15 — DIVERGENCE FR/EN ASSUMÉE. Le bloc `en` ci-dessous n'a PAS
    // été mis à jour : il décrit encore la procédure d'avant la correction de
    // l'indicateur 31 (pas d'aléas, pas de voie de recours externe, champ
    // d'application borné à la réclamation). Motif : décision Will du
    // 2026-08-12 — site français uniquement, ne rien produire de nouveau en
    // anglais ; le locale EN est par ailleurs intercepté en 301 vers le FR par
    // `src/proxy.ts`, la page anglaise n'est donc pas servie.
    // 🔴 SI EN EST RÉACTIVÉ (`EN_LOCALE_ENABLED=true`), ce bloc redevient
    // public et RÉINTRODUIT l'écart d'audit : le traduire AVANT de basculer le
    // drapeau, ou retirer la page EN de l'index.
    en: {
      title: "Complaints",
      titleEm: "procedure",
      intro:
        "Procedure for handling complaints relating to Axion-IA's training services: who may complain, how to file a complaint, response times, handling and remedies.",
      sections: [
        {
          title: "Purpose and scope",
          body: "This procedure describes how complaints relating to Axion-IA's training services are filed and handled. A complaint may be filed by anyone concerned by a training action: the trainee, the client company ordering the training, and the funder (OPCO, France Travail or any other body covering the cost). A complaint means any written expression of dissatisfaction relating to the organisation, content, delivery, teaching resources or administrative conditions of a training action.",
        },
        {
          title: "How to file a complaint",
          body: "Any complaint is submitted in writing, to ensure traceability. It may be sent by email to contact@axion-ia.com or by post to the organisation's registered office. For efficient handling, the complaint states the complainant's identity, the training concerned (title and dates), a factual description of the situation and, where applicable, the complainant's expectations.",
        },
        {
          title: "Handling times",
          body: "Axion-IA acknowledges receipt of the complaint within 5 working days of receiving it. A reasoned response is provided within a maximum of 15 working days from receipt of the complaint. Where the analysis requires additional time, the complainant is informed, with an indication of a new expected timeframe.",
        },
        {
          title: "Handling and corrective actions",
          body: "Each complaint is recorded and then examined by the teaching coordinator. The examination consists of analysing the facts, gathering where necessary the views of the trainer and the parties concerned, and determining the appropriate follow-up. Where a shortcoming is established, one or more corrective actions are defined and implemented to prevent it from recurring.",
        },
        {
          title: "Monitoring and continuous improvement",
          body: "Complaints and the associated corrective actions are recorded in an internal register. They are monitored and periodically analysed, feeding the continuous improvement of the quality of services.",
        },
        {
          title: "Remedies",
          body: "If the response provided does not satisfy the complainant, they may request a review of their situation. Where the training is funded, the funder (OPCO, France Travail or other) may also be informed. Disputes that cannot be resolved amicably are subject to the provisions set out in the general terms and conditions.",
        },
      ],
      metaSeo: {
        title: "Complaints procedure · Axion-IA",
        description:
          "Axion-IA training complaints procedure: written submission, acknowledgement within 5 working days, reasoned response within 15 working days, corrective actions and remedies.",
      },
    },
  },
  {
    slug: "reglement-interieur",
    pathFr: "/reglement-interieur",
    pathEn: "/reglement-interieur",
    fr: {
      title: "Règlement",
      titleEm: "intérieur",
      intro:
        "Règlement intérieur applicable aux stagiaires des formations Axion-IA. Établi conformément aux articles L.6352-3 et suivants du Code du travail.",
      sections: [
        {
          title: "Article 1 — Accès et identification",
          body: "Tout stagiaire doit se présenter en début de formation avec une pièce d'identité valide. Pour les formations en distanciel, le stagiaire accède à la session via son compte personnel et s'assure que son identité est vérifiable par le formateur. L'accès à la salle de formation, ou à l'espace numérique, est interdit à toute personne ne figurant pas sur la liste des stagiaires inscrits.",
        },
        {
          title: "Article 2 — Assiduité et ponctualité",
          body: "Le stagiaire s'engage à être présent et ponctuel à toutes les sessions de formation. Toute absence ou tout retard doit être signalé le plus tôt possible à l'organisme de formation. En formation distancielle, la caméra doit rester activée pendant les séquences synchrones, sauf autorisation explicite du formateur ; une absence de caméra non justifiée peut entraîner la non-validation de la présence pour la demi-journée concernée. La feuille d'émargement se signe pendant chaque demi-journée, en présentiel comme en distanciel ; le relevé de connexion ne la remplace pas.",
        },
        {
          // ── Remise du règlement (art. L.6352-3 et R.6352-1) — reportée du
          //    gabarit PDF. Un règlement qui n'est pas porté à la connaissance du
          //    stagiaire AVANT son entrée ne lui est pas opposable.
          title: "Article 2 bis — Remise du règlement",
          body: "Le présent règlement intérieur est porté à la connaissance de chaque stagiaire avant son entrée en formation, conformément aux articles L.6352-3 et R.6352-1 du code du travail.",
        },
        {
          title: "Article 3 — Discipline et comportement",
          body: "Sont notamment interdits : tout comportement irrespectueux envers le formateur ou les autres stagiaires ; l'enregistrement audio ou vidéo des sessions sans accord écrit préalable de l'organisme ; l'usage de téléphones portables ou d'appareils personnels à des fins non pédagogiques pendant les séquences synchrones ; la consommation d'alcool ou de substances illicites. Tout manquement aux règles de discipline peut donner lieu à l'une des sanctions de l'article 3 bis, prononcée selon la procédure de l'article 3 ter. L'issue financière d'une exclusion relève des seules conditions contractuelles convenues avec le financeur ou l'entreprise — seules les prestations effectivement réalisées sont dues, au prorata (conditions générales de vente, « Dédit et abandon en cours d'exécution ») — et non d'une sanction disciplinaire : les amendes et autres sanctions pécuniaires sont interdites (art. R6352-3 du code du travail).",
        },
        {
          // 🔴 2026-08-24 — CET ARTICLE MANQUAIT À LA PAGE PUBLIQUE.
          //
          // La page annonçait l'exclusion définitive SANS échelle des sanctions
          // ni droits de la défense — zéro citation des art. R.6352-3 à -8.
          // Le gabarit PDF remis au stagiaire, lui, les contenait déjà
          // (`documents/templates/reglement-interieur.tsx`, « Article 3 bis »).
          // La correction n'avait été appliquée qu'à une des deux versions.
          //
          // ⚠️ Le critère 1 du RNQ porte sur l'INFORMATION DU PUBLIC : c'est
          // cette page-ci que le certificateur lira. Texte reporté VERBATIM du
          // gabarit — rien n'a été inventé ni reformulé. Le cliquet
          // `reglement-interieur-publie-vaut-le-pdf.spec.ts` interdit désormais
          // que les deux versions divergent de nouveau.
          // ── Échelle des sanctions (art. R6352-3) — reportée VERBATIM du gabarit.
          //    Elle manquait à la page publique, qui annonçait pourtant la sanction
          //    la plus lourde. Annoncer l'exclusion sans dire ce qu'est une sanction
          //    ni ce qui la précède est précisément ce que la loi interdit.
          title: "Article 3 bis — Échelle des sanctions",
          body: "Constitue une sanction toute mesure, autre que les observations verbales, prise à la suite d'un agissement du stagiaire considéré comme fautif, qu'elle affecte ou non immédiatement sa présence dans la formation (art. R6352-3 du code du travail). Échelle des sanctions applicables, par ordre de gravité croissante : l'avertissement écrit ; le blâme, notifié par écrit et versé au dossier du stagiaire ; l'exclusion temporaire de la formation ; l'exclusion définitive de la formation. Les amendes et autres sanctions pécuniaires sont interdites (art. R6352-3).",
        },
        {
          title: "Article 3 ter — Procédure disciplinaire et droits de la défense",
          body: "Aucune sanction ne peut être infligée au stagiaire sans qu'il ait été informé au préalable des griefs retenus contre lui (art. R6352-4 du code du travail). Lorsqu'une sanction susceptible d'avoir une incidence, immédiate ou non, sur sa présence dans la formation est envisagée, la procédure suivante s'applique : le directeur de l'organisme ou son représentant convoque le stagiaire par écrit, par lettre recommandée ou remise contre décharge ; la convocation indique son objet, précise la date, l'heure et le lieu de l'entretien, et fait état de la faculté de se faire assister (art. R6352-5) ; au cours de l'entretien, le directeur ou son représentant indique le motif de la sanction envisagée et recueille les explications du stagiaire, qui peut se faire assister par la personne de son choix ; la sanction ne peut intervenir moins d'un jour franc ni plus de quinze jours après l'entretien (art. R6352-6) ; elle fait l'objet d'une décision écrite et motivée, notifiée au stagiaire par lettre recommandée ou remise contre récépissé (art. R6352-6). Lorsqu'un agissement rend indispensable une mesure conservatoire d'exclusion temporaire à effet immédiat, aucune sanction définitive ne peut être prise sans que cette procédure ait été observée (art. R6352-7). Lorsque le stagiaire est un salarié envoyé par son employeur ou que la formation est financée par un tiers, l'organisme informe l'employeur et, le cas échéant, le financeur de la sanction prise (art. R6352-8).",
        },
        {
          // ── Prévention des violences (décret n° 2026-728, en vigueur au
          //    1er novembre 2026) — reportée VERBATIM du gabarit remis au
          //    stagiaire (numéroté « 3 ter » dans le PDF jusqu'au 2026-10-02).
          //
          // 🔴 Mesuré le 2026-09-13, avant cet article : « harcèlement »,
          // « violence », « discrimination », « sexiste », « sexuel » rendaient
          // ZÉRO occurrence — ici comme dans le gabarit PDF. L'indicateur 12 du
          // RNQ (critère 3), renforcé, exige la prévention ET le traitement de
          // toute situation de violence, de harcèlement ou de discrimination.
          //
          // ⚠️ C'est la page PUBLIQUE que le certificateur lira, pas le PDF d'un
          // dossier particulier. Le cliquet `reglement-interieur-publie-vaut-le-pdf`
          // exige que les mêmes articles de loi soient nommés des deux côtés.
          //
          // 🔴 2026-10-02 (indicateur 12, décret 2026-728) — titre et procédure
          // (signaler, traiter, suites, recours) viennent de
          // `src/content/prevention-violences.ts`, lu AUSSI par le PDF remis :
          // même numéro (le PDF disait « 3 ter »), plus d'« article 40 du code
          // de procédure pénale », canal et délais du registre des signalements,
          // Défenseur des droits et 3919.
          title: TITRE_ARTICLE_VIOLENCES,
          body: `L'organisme ne tolère aucune violence, aucun harcèlement et aucune discrimination, qu'ils émanent d'un stagiaire, d'un formateur, d'un intervenant ou d'un membre de l'organisme, en présentiel comme à distance, y compris dans les échanges écrits liés à la formation. Sont notamment prohibés : le harcèlement sexuel, défini comme le fait d'imposer à une personne, de façon répétée, des propos ou comportements à connotation sexuelle qui portent atteinte à sa dignité ou créent une situation intimidante, hostile ou offensante, étant assimilé au harcèlement sexuel le fait, même non répété, d'user d'une pression grave dans le but réel ou apparent d'obtenir un acte de nature sexuelle (art. 222-33 du code pénal) ; les agissements et outrages sexistes, soit tout propos ou comportement lié au sexe d'une personne ayant pour objet ou pour effet de porter atteinte à sa dignité ou de créer un environnement dégradant ; le harcèlement moral, soit les propos ou comportements répétés ayant pour objet ou pour effet une dégradation des conditions de vie de la personne se traduisant par une altération de sa santé physique ou mentale (art. 222-33-2-2 du code pénal) ; toute discrimination, soit toute distinction opérée entre les personnes à raison notamment de leur origine, leur sexe, leur situation de famille, leur apparence physique, leur état de santé, leur handicap, leurs moeurs, leur orientation sexuelle, leur identité de genre, leur âge, leurs opinions politiques, leurs activités syndicales ou leur appartenance, vraie ou supposée, à une ethnie, une nation ou une religion déterminée (art. 225-1 du code pénal). ${VIOLENCES_PROCEDURE.join(" ")}`,
        },
        {
          title: "Article 4 — Propriété intellectuelle",
          body: "Les supports de formation (présentations, documents, exercices, outils numériques) remis ou présentés pendant la formation sont la propriété exclusive de l'organisme de formation et/ou de ses formateurs. Ils sont mis à la disposition du stagiaire à titre personnel et strictement non cessible. Toute reproduction, diffusion, revente ou exploitation commerciale des supports sans autorisation écrite est interdite et susceptible d'engager la responsabilité civile et pénale du stagiaire.",
        },
        {
          title: "Article 5 — Confidentialité",
          body: "Le stagiaire s'engage à traiter comme confidentiels tous les éléments relatifs aux autres stagiaires, aux formateurs, aux méthodes pédagogiques et aux contenus de formation auxquels il a accès dans le cadre du programme.",
        },
        {
          // 🔴 2026-09-30 — aligné sur le gabarit PDF (article 6) : hygiène,
          // tabac et vapotage, consignes d'incendie, règle de R.6352-1 pour une
          // formation dans une entreprise dotée d'un règlement intérieur.
          title: "Article 6 — Santé, hygiène et sécurité",
          body: "Chaque stagiaire veille à sa sécurité et à celle des autres en respectant les consignes générales et particulières de santé, d'hygiène et de sécurité en vigueur sur le lieu de formation. Il respecte la propreté des salles, des sanitaires et du matériel mis à sa disposition, et signale au formateur toute situation présentant un risque pour la santé ou la sécurité. Il est interdit de fumer et de vapoter dans les locaux de formation, conformément au Code de la santé publique. Les consignes d'incendie et d'évacuation, notamment le plan de localisation des extincteurs et des issues de secours et le point de rassemblement, sont affichées dans les locaux ; le stagiaire en prend connaissance et, en cas d'alerte, suit sans délai les instructions du formateur ou du responsable des locaux. Tout accident ou incident survenu pendant la formation est signalé immédiatement au formateur ou au responsable des locaux. Lorsque la formation se déroule dans une entreprise ou un établissement déjà doté d'un règlement intérieur, notamment dans les locaux du client, les mesures de santé et de sécurité applicables aux stagiaires sont celles de ce dernier règlement (art. R6352-1 du code du travail). En distanciel, le stagiaire est responsable de la sécurité de son environnement de travail (connexion sécurisée, confidentialité de son écran en espace partagé).",
        },
        {
          title: "Article 7 — Évaluation et attestation de formation",
          body: "Des évaluations des acquis sont réalisées en cours et en fin de formation. À l'issue de la formation, une attestation de fin de formation est remise à tout stagiaire. Elle mentionne les objectifs, la nature et la durée de l'action, les heures effectivement suivies et les résultats de l'évaluation des acquis, ou l'absence d'évaluation.",
        },
        {
          title: "Article 8 — Réclamations",
          body: "Toute réclamation relative au déroulement de la formation est formulée par écrit (courrier ou email) auprès du référent pédagogique de l'organisme. L'organisme accuse réception de la réclamation dans un délai de 5 jours ouvrés et y répond de manière circonstanciée dans un délai maximum de 15 jours ouvrés à compter de sa réception. Les modalités détaillées de dépôt, de traitement et de recours figurent dans la procédure de réclamation publiée sur /reclamations.",
        },
        {
          title: "Article 9 — Protection des données personnelles (RGPD)",
          body: "Conformément au Règlement (UE) 2016/679 (RGPD) et à la loi Informatique et Libertés, les données personnelles du stagiaire (nom, prénom, coordonnées, données de connexion, évaluations) sont collectées aux fins de gestion administrative et pédagogique de la formation. Elles sont conservées pendant cinq (5) ans à compter de la fin de la formation, conformément aux obligations légales de l'organisme de formation. Le stagiaire dispose des droits d'accès, de rectification, d'effacement, de limitation et de portabilité de ses données, ainsi que du droit de s'opposer à leur traitement ; ces droits s'exercent auprès de l'organisme de formation à l'adresse contact@axion-ia.com.",
        },
        {
          // 🔴 2026-09-30 — clause de représentation (R.6352-9 et suivants),
          // reportée du gabarit PDF (article 10).
          title: "Article 10 — Représentation des stagiaires",
          body: "Pour les actions de formation organisées en sessions d'une durée totale supérieure à cinq cents heures, un délégué titulaire et un délégué suppléant sont élus par les stagiaires (art. R6352-9 et suivants du code du travail). Aucune action de formation dispensée par l'organisme n'atteignant cette durée, aucune élection n'est organisée.",
        },
      ],
      metaSeo: {
        title: "Règlement intérieur des stagiaires · Axion-IA",
        description:
          "Règlement intérieur des stagiaires Axion-IA (art. L.6352-3 du Code du travail) : accès, assiduité, discipline, propriété intellectuelle, confidentialité, sécurité, évaluation, réclamations, RGPD.",
      },
    },
    en: {
      title: "Internal",
      titleEm: "regulations",
      intro:
        "Internal regulations applicable to trainees of Axion-IA's training courses. Established in accordance with articles L.6352-3 et seq. of the French Labour Code.",
      sections: [
        {
          title: "Article 1 — Access and identification",
          body: "Every trainee must attend the start of the training with valid identification. For distance learning, the trainee accesses the session via their personal account and ensures that their identity can be verified by the trainer. Access to the training room, or to the online space, is prohibited to anyone not on the list of registered trainees.",
        },
        {
          title: "Article 2 — Attendance and punctuality",
          body: "The trainee undertakes to be present and punctual at all training sessions. Any absence or lateness must be reported to the training organisation as soon as possible. In distance learning, the camera must remain on during synchronous sessions, unless the trainer explicitly authorises otherwise; an unjustified absence of camera may lead to the half-day's attendance not being validated. The attendance sheet is signed during each half-day, on site or at a distance; the connection log does not replace it.",
        },
        {
          title: "Article 3 — Discipline and conduct",
          body: "The following are notably prohibited: any disrespectful behaviour towards the trainer or other trainees; audio or video recording of sessions without the organisation's prior written consent; the use of mobile phones or personal devices for non-educational purposes during synchronous sessions; the consumption of alcohol or illicit substances. Any breach of the discipline rules may lead to a disciplinary sanction, following the procedure set out in articles R6352-4 to R6352-8 of the French Labour Code. The financial consequences of an exclusion are governed solely by the contractual terms agreed with the funder or the company — only the services actually delivered are due, pro rata — and not by a disciplinary sanction: fines and other financial penalties are prohibited (art. R6352-3).",
        },
        {
          title: "Article 4 — Intellectual property",
          body: "The training materials (presentations, documents, exercises, digital tools) provided or shown during the training are the exclusive property of the training organisation and/or its trainers. They are made available to the trainee on a personal and strictly non-transferable basis. Any reproduction, distribution, resale or commercial exploitation of the materials without written authorisation is prohibited and may engage the trainee's civil and criminal liability.",
        },
        {
          title: "Article 5 — Confidentiality",
          body: "The trainee undertakes to treat as confidential all information relating to other trainees, trainers, teaching methods and training content to which they have access as part of the programme.",
        },
        {
          title: "Article 6 — Health, hygiene and safety",
          body: "Each trainee looks after their own safety and that of others by complying with the general and specific health, hygiene and safety instructions in force at the training venue, keeps the rooms, sanitary facilities and equipment clean, and reports any situation presenting a health or safety risk to the trainer. Smoking and vaping are prohibited on the training premises, in accordance with the French Public Health Code. Fire and evacuation instructions, including the location of extinguishers, emergency exits and the assembly point, are posted on the premises; the trainee reads them and, in the event of an alert, immediately follows the instructions of the trainer or the person in charge of the premises. Any accident or incident during the training is reported immediately. Where the training takes place in a company or establishment that already has internal regulations, notably on the client's premises, the health and safety measures applicable to trainees are those of those regulations (art. R6352-1 of the French Labour Code). In distance learning, the trainee is responsible for the security of their working environment (secure connection, screen confidentiality in a shared space).",
        },
        {
          title: "Article 7 — Assessment and certificate of completion",
          body: "Assessments of learning are carried out during and at the end of the training. At the end of the training, a certificate of completion is issued to every trainee. It states the objectives, nature and duration of the course, the hours actually attended and the results of the assessment of learning, or the absence of assessment.",
        },
        {
          title: "Article 8 — Complaints",
          body: "Any complaint relating to the delivery of the training is submitted in writing (post or email) to the organisation's teaching coordinator. The organisation acknowledges receipt of the complaint within 5 working days and provides a reasoned response within a maximum of 15 working days from receipt. The detailed procedures for filing, handling and remedies are set out in the complaints procedure published at /reclamations.",
        },
        {
          title: "Article 9 — Personal data protection (GDPR)",
          body: "In accordance with Regulation (EU) 2016/679 (GDPR) and the French Data Protection Act, the trainee's personal data (surname, first name, contact details, connection data, assessments) are collected for the administrative and educational management of the training. They are kept for five (5) years from the end of the training, in accordance with the training organisation's legal obligations. The trainee has the rights of access, rectification, erasure, restriction and portability of their data, as well as the right to object to their processing; these rights are exercised with the training organisation at contact@axion-ia.com.",
        },
      ],
      metaSeo: {
        title: "Internal regulations for trainees · Axion-IA",
        description:
          "Axion-IA trainee internal regulations (art. L.6352-3 of the French Labour Code): access, attendance, discipline, intellectual property, confidentiality, safety, assessment, complaints, GDPR.",
      },
    },
  },
];

export function getLegal(slug: LegalSlug): LegalContent {
  const found = LEGAL_PAGES.find((p) => p.slug === slug);
  if (!found) throw new Error(`Unknown legal slug: ${slug}`);
  return found;
}
