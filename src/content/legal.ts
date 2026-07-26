// Legal content — 6 pages. Droit français.
// CLAUDE.md v6 §1 + §5 + §22. Source: docs 28 + 31.
//
// IDENTITÉ LÉGALE : les sections « Éditeur » + « Directeur de la publication »
// des mentions légales ne figurent PLUS ici — elles sont résolues au runtime
// depuis le SiteSetting `legal_overrides` via `@/lib/legal-identity` (SSOT
// partagée avec les factures). Will renseigne SIREN/SIRET/capital/adresse/TVA
// une seule fois en console admin → page (ISR) + factures se synchronisent.

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
  sections: ReadonlyArray<{ title: string; body: string }>;
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
          title: "Médiation de la consommation",
          body: "Les prestations d'Axion-IA s'adressent exclusivement à une clientèle professionnelle (B2B), dans le cadre de l'activité de ses clients. En l'absence de relation avec des consommateurs, Axion-IA n'est pas tenue d'adhérer à un dispositif de médiation de la consommation au sens des articles L611-1 et L612-1 du Code de la consommation.",
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
        "Conditions générales de vente et d'utilisation (CGV/CGU) régissant les services d'Axion-IA SAS : formations et interventions IA sur site, audits IA, implémentations IA, coaching individuel 1-to-1, et conception de sites web et plateformes SaaS augmentés par l'IA. Prestations principalement destinées aux clients professionnels ; les dispositions propres aux particuliers figurent dans une section dédiée. Elles intègrent les dispositions propres aux actions de formation professionnelle (articles L.6313-1 et suivants du Code du travail). La version applicable est celle en vigueur à la date de dernière mise à jour indiquée ci-dessous.",
      sections: [
        {
          title: "Objet et champ d'application",
          body: "Les présentes conditions générales régissent la vente et la fourniture de l'ensemble des prestations d'Axion-IA : formations et interventions IA sur site (collectives et individuelles), audits IA, implémentations IA, coaching individuel 1-to-1, et conception de sites web et plateformes SaaS augmentés par l'IA. Elles s'appliquent à toute commande, à l'exclusion de tout autre document. Les prestations s'adressent principalement à des clients professionnels agissant dans le cadre de leur activité. Lorsqu'une formation est souscrite par une personne physique pour son propre compte, les dispositions de la section « Dispositions applicables au particulier (consommateur) » s'appliquent et prévalent sur toute clause contraire.",
        },
        {
          title: "Dispositions propres à la formation professionnelle",
          body: "Lorsque les prestations d'Axion-IA prennent la forme d'actions de formation, elles relèvent des articles L.6313-1 et suivants du Code du travail. Les formations dispensées à des personnes morales font l'objet d'une convention de formation conforme aux articles L.6353-1 et L.6353-2 du Code du travail. Les formations souscrites par un particulier à titre individuel font l'objet d'un contrat de formation conforme aux articles L.6353-3 à L.6353-7 du Code du travail, incluant le délai de rétractation de dix jours prévu à l'article L.6353-5. À l'issue de la formation, une attestation de fin de formation est délivrée conformément aux articles L.6353-1 et D.6353-1 du Code du travail. Les modalités de dépôt et de traitement des réclamations relatives aux formations sont décrites dans la procédure de réclamation publiée sur /reclamations, et les règles applicables aux stagiaires figurent dans le règlement intérieur publié sur /reglement-interieur.",
        },
        {
          title: "Définitions",
          body: "« Axion-IA » désigne le prestataire ; « Client » le professionnel qui signe le devis ou passe commande ; « Prestations » les services commandés ; « Livrables » les éléments remis au Client (rapports, supports, code, configurations, documents) ; « Devis » la proposition chiffrée détaillant le périmètre, le prix et les délais.",
        },
        {
          title: "Acceptation et opposabilité des CGV",
          body: "Conformément à l'article L441-1 du Code de commerce, les présentes CGV constituent le socle unique de la relation commerciale et sont communiquées à tout acheteur professionnel qui en fait la demande. Toute commande emporte acceptation pleine et entière des présentes conditions, qui prévalent sur toutes conditions d'achat du Client, sauf dérogation écrite et signée des deux parties. Axion-IA peut faire évoluer ses CGV ; la version applicable est celle en vigueur à la date de la commande.",
        },
        {
          title: "Devis et commande",
          body: "Toute prestation fait l'objet d'un devis chiffré, valable 30 jours à compter de son émission. La commande devient ferme et définitive à réception du devis signé et, le cas échéant, de l'acompte convenu. Aucun abonnement ni engagement de durée n'est imposé, sauf stipulation contraire au devis.",
        },
        {
          title: "Prix",
          body: "Les prix sont exprimés en euros et hors taxes (HT) ; ils sont ceux du devis accepté. Tout déplacement, prestation ou livrable hors du périmètre du devis fait l'objet d'un avenant chiffré accepté au préalable. La TVA française au taux en vigueur (20 % à ce jour) s'applique selon le régime fiscal d'Axion-IA et le statut du Client ; le détail figure sur le devis et sur la facture. Pour un client professionnel établi dans un autre État membre de l'Union européenne et disposant d'un numéro de TVA intracommunautaire valide, l'autoliquidation s'applique le cas échéant.",
        },
        {
          title: "Conditions de paiement",
          body: "Sauf échéancier convenu au devis, le règlement s'effectue par virement bancaire. Pour les prestations inférieures à 5 000 € HT, le paiement intervient à la commande ; au-delà, un échelonnement (acompte à la commande puis solde à l'avancement ou à la livraison) peut être convenu. Aucun escompte n'est accordé en cas de paiement anticipé.",
        },
        {
          title: "Retard de paiement — pénalités et indemnité de recouvrement",
          body: "Le délai de paiement convenu ne peut excéder les plafonds de l'article L441-10 du Code de commerce (60 jours à compter de l'émission de la facture, ou 45 jours fin de mois). Tout retard entraîne de plein droit, sans rappel préalable et dès le jour suivant la date d'échéance : (i) des pénalités de retard calculées au taux d'intérêt appliqué par la Banque centrale européenne à son opération de refinancement la plus récente, majoré de 10 points de pourcentage ; (ii) une indemnité forfaitaire pour frais de recouvrement de 40 € par facture (art. L441-10 II et D441-5 du Code de commerce), sans préjudice d'une indemnisation complémentaire sur justificatifs si les frais réellement exposés sont supérieurs. En cas de retard, Axion-IA peut suspendre les prestations en cours jusqu'au complet paiement.",
        },
        {
          title: "Exécution des prestations et délais",
          body: "Les délais figurent au devis ; ils constituent un engagement de moyens et courent à compter de la réunion des conditions de démarrage (acompte, accès, informations et disponibilités nécessaires). Axion-IA ne saurait être tenue responsable d'un retard imputable au Client (défaut d'accès aux données, indisponibilité des équipes, validations tardives) ou à un cas de force majeure.",
        },
        {
          title: "Obligations et collaboration du Client",
          body: "Le Client s'engage à collaborer activement et de bonne foi : fournir en temps utile les informations, accès, environnements et moyens nécessaires, désigner un interlocuteur décisionnaire, et garantir qu'il dispose des droits sur les données et systèmes confiés à Axion-IA. Le Client demeure responsable de l'usage qu'il fait des Livrables et des décisions qu'il prend sur leur fondement.",
        },
        {
          title: "Propriété intellectuelle des livrables",
          body: "Les méthodes, savoir-faire, outils, modèles et éléments préexistants mobilisés par Axion-IA demeurent sa propriété exclusive. Sauf stipulation contraire au devis, les droits d'exploitation sur les Livrables spécifiquement réalisés pour le Client lui sont cédés, dans les limites précisées au devis, après paiement intégral du prix, conformément à l'article L131-3 du Code de la propriété intellectuelle. Axion-IA conserve le droit de réutiliser les compétences, connaissances et savoir-faire génériques acquis à l'occasion de la prestation.",
        },
        {
          title: "Confidentialité",
          body: "Chaque partie préserve la confidentialité des informations non publiques échangées dans le cadre des prestations et ne les utilise que pour leur exécution. Cet engagement vaut pendant toute la durée de la relation et pendant 3 ans après son terme, sous réserve des obligations légales de divulgation.",
        },
        {
          title: "Protection des données personnelles",
          body: "Chaque partie respecte la réglementation applicable aux données personnelles (RGPD, UE 2016/679). Lorsque, dans le cadre d'une prestation, Axion-IA traite des données personnelles pour le compte du Client, les parties concluent un accord de sous-traitance conforme à l'article 28 du RGPD précisant l'objet, la durée, la nature et les finalités du traitement, les mesures de sécurité et de confidentialité, ainsi que le sort des données en fin de prestation. Le traitement des données collectées via le site est décrit dans la Politique de confidentialité.",
        },
        {
          title: "Recours à l'intelligence artificielle et transparence",
          body: "Certaines prestations recourent à des systèmes d'intelligence artificielle, y compris générative. Axion-IA en informe le Client et, le cas échéant, signale les contenus générés ou assistés par IA, conformément à l'article 50 du Règlement européen sur l'intelligence artificielle (UE 2024/1689). Le Client reste responsable de la validation et de l'usage final des résultats produits avec l'assistance de l'IA.",
        },
        {
          title: "Garanties et responsabilité",
          body: "Axion-IA exécute ses prestations selon les règles de l'art, dans le cadre d'une obligation de moyens. Aucune garantie de résultat n'est donnée ; les gains, ROI ou performances évoqués sont indicatifs et dépendent de facteurs propres au Client. La responsabilité d'Axion-IA, toutes causes confondues, est limitée aux dommages directs et plafonnée au montant HT effectivement perçu au titre de la prestation à l'origine du dommage. Sont exclus les dommages indirects (perte d'exploitation, de données, de chiffre d'affaires ou d'image). Ces limitations ne s'appliquent ni en cas de faute lourde ou dolosive, ni dans les cas où la loi les prohibe.",
        },
        {
          title: "Assurance",
          body: "Axion-IA déclare être titulaire d'une assurance de responsabilité civile professionnelle couvrant les conséquences pécuniaires de sa responsabilité dans le cadre de ses prestations. Les coordonnées de l'assureur sont communiquées sur demande.",
        },
        {
          title: "Force majeure",
          body: "Aucune partie ne peut être tenue responsable d'un manquement résultant d'un cas de force majeure au sens de l'article 1218 du Code civil et de la jurisprudence française (notamment grève, panne majeure, catastrophe, épidémie, défaillance d'un fournisseur essentiel). La partie empêchée en informe l'autre sans délai ; les obligations sont suspendues pendant la durée de l'empêchement, et le contrat peut être résolu si l'empêchement devient définitif.",
        },
        {
          // 🔴 Audit certification 2026-07-26 (F51). Le barème des CGV (7 j / 2 j
          // calendaires) contredisait celui des conventions de formation
          // (15 j / 8 j OUVRÉS). Les deux documents sont signés ensemble — la
          // convention liste les CGV en annexe — et donnaient donc deux chiffres
          // différents sur le même fait : une annulation à 10 jours coûtait 0 %
          // d'un côté, 50 % de l'autre. En cas de litige, l'ambiguïté
          // s'interprète contre le rédacteur (art. 1190 C. civ.).
          // Aligné sur la convention, qui est le document signé par action et
          // celui que lit un financeur. Le report gratuit, promesse publique des
          // CGV, est conservé et repris dans la convention.
          title: "Annulation, report et remboursement",
          body: "Toute annulation à l'initiative du Client s'apprécie en jours ouvrés avant la date de début de la prestation : à plus de 15 jours ouvrés, aucune somme n'est due et les acomptes versés sont intégralement remboursés ; entre 8 et 15 jours ouvrés, 50 % du prix HT restent dus ; à moins de 8 jours ouvrés, le prix HT reste dû en totalité. Dans tous les cas, la prestation est reportable une fois sans frais à une date convenue entre les parties, le report se substituant alors à l'annulation. Ce barème est identique à celui figurant dans la convention et dans le contrat de formation. Les conditions de dédit et d'abandon en cours d'exécution sont précisées ci-après.",
        },
        {
          // F53 — le renvoi « conditions de dédit et d'abandon précisées dans la
          // convention » pointait vers une convention qui n'en contenait aucune :
          // un abandon en cours de session n'était régi par aucun texte.
          title: "Dédit et abandon en cours d'exécution",
          body: "En cas d'abandon en cours d'exécution à l'initiative du Client ou du bénéficiaire, les prestations effectivement réalisées à la date de l'abandon restent dues au prorata. Lorsque l'action est financée par un tiers (OPCO, France Travail, autre financeur), la part non réalisée n'est pas facturée au financeur et ne peut être réclamée au Client au-delà de ce prorata. Lorsque l'abandon résulte d'un cas de force majeure dûment constaté, le contrat est résilié et seules les prestations effectivement dispensées sont dues, conformément à l'article L.6353-7 du Code du travail.",
        },
        {
          // F53 — aucune clause de sous-traitance n'existait, alors que
          // l'indicateur Qualiopi 27 en fait un point d'audit et que le dépôt
          // génère déjà des contrats de sous-traitance.
          title: "Sous-traitance",
          body: "Axion-IA peut confier tout ou partie de l'exécution d'une prestation à un intervenant externe qualifié, sous-traitant au sens de l'article 1er de la loi n° 75-1334 du 31 décembre 1975. Axion-IA demeure seule responsable de la bonne exécution de la prestation vis-à-vis du Client et se porte garante du respect, par ses sous-traitants, des engagements de confidentialité, de protection des données personnelles et de qualité applicables. Le Client est informé de l'identité de l'intervenant avant le début de l'action.",
        },
        {
          title: "Réversibilité et restitution",
          body: "À la fin de la prestation, Axion-IA restitue au Client, sur demande et dans un format exploitable, les données et configurations qui lui appartiennent, et supprime les copies de travail dans un délai raisonnable, sous réserve des obligations légales de conservation.",
        },
        {
          title: "Non-sollicitation du personnel",
          body: "Pendant l'exécution des prestations et durant 12 mois après leur terme, le Client s'engage à ne pas solliciter ni recruter directement les intervenants d'Axion-IA ayant participé à la prestation, sauf accord écrit préalable d'Axion-IA.",
        },
        {
          title: "Références commerciales",
          body: "Sauf opposition écrite du Client, Axion-IA peut mentionner le nom et le logo du Client ainsi qu'une description générale de la prestation à titre de référence commerciale, dans le respect de la confidentialité des informations sensibles.",
        },
        {
          title: "Rétractation du Client professionnel",
          body: "Les prestations conclues entre professionnels ne relèvent pas du droit de rétractation prévu par le Code de la consommation. Par exception, le Client professionnel employant cinq salariés au plus bénéficie d'un délai de rétractation de 14 jours pour les contrats conclus hors établissement dont l'objet n'entre pas dans le champ de son activité principale (art. L221-3 du Code de la consommation).",
        },
        {
          // 🔴 Audit certification 2026-07-26 (F50). Les CGV affirmaient être
          // réservées aux professionnels, tout en prévoyant six lignes plus haut
          // le contrat de formation pour « un particulier à titre individuel » —
          // que le code génère effectivement (genererContratFormationAction).
          // Un particulier se voyait donc opposer des CGV qui n'énonçaient ni
          // l'interdiction de paiement avant rétractation, ni le plafond de 30 %
          // (L6353-6), qui ÉCARTAIENT la médiation de la consommation — laquelle
          // est une obligation d'adhésion (L612-1, amende jusqu'à 15 000 € pour
          // une personne morale) — et qui imposaient une clause attributive de
          // juridiction inopposable à un consommateur (R631-3 C. conso).
          title: "Dispositions applicables au particulier (consommateur)",
          body: "Lorsqu'une formation est souscrite par une personne physique pour son propre compte, en dehors de toute activité professionnelle, les dispositions suivantes s'appliquent et prévalent sur toute clause contraire des présentes. La relation est régie par un contrat de formation professionnelle conforme aux articles L.6353-3 à L.6353-7 du Code du travail. Ce contrat mentionne l'objet, la nature, la durée, les effectifs, le prix et les modalités de règlement, ainsi que les sanctions applicables et les titres des intervenants.",
        },
        {
          title: "Particulier — délai de rétractation et interdiction de paiement",
          body: "Le particulier dispose d'un délai de dix jours à compter de la signature du contrat pour se rétracter, par lettre recommandée avec accusé de réception (art. L.6353-5 du Code du travail). Aucune somme ne peut être exigée ni versée avant l'expiration de ce délai de dix jours (art. L.6353-6). À l'issue de ce délai, il ne peut être exigé plus de 30 % du prix convenu ; le solde est échelonné au fur et à mesure du déroulement de l'action. Lorsque le contrat est en outre conclu à distance ou hors établissement, le particulier bénéficie du délai de quatorze jours prévu à l'article L.221-18 du Code de la consommation ; en cas de concours des deux régimes, le délai le plus favorable au particulier s'applique.",
        },
        {
          title: "Particulier — abandon et force majeure",
          body: "Si le particulier est empêché de suivre la formation par un cas de force majeure dûment reconnu, le contrat est résilié de plein droit et seules les prestations effectivement dispensées sont dues, à due proportion de leur valeur prévue au contrat (art. L.6353-7 du Code du travail). Aucune pénalité ni indemnité de dédit ne peut lui être réclamée à ce titre.",
        },
        {
          // ⚠️ BLOQUANT AVANT TOUTE VENTE À UN PARTICULIER — l'adhésion à un
          // médiateur agréé est une obligation légale (L612-1), pas une option.
          // Le nom et l'adresse du médiateur doivent figurer ici et sur le site
          // dès qu'un particulier peut contracter. Tant qu'Axion-IA n'a pas
          // adhéré, la vente à un particulier n'est pas conforme.
          title: "Particulier — médiation de la consommation",
          body: "Conformément aux articles L.612-1 et suivants du Code de la consommation, le particulier a le droit de recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable d'un litige qui l'opposerait à Axion-IA, après avoir tenté de le résoudre directement par une réclamation écrite. Les coordonnées du médiateur compétent lui sont communiquées avec la confirmation d'inscription et figurent au contrat de formation. Le particulier conserve la faculté de saisir la plateforme européenne de règlement en ligne des litiges.",
        },
        {
          title: "Particulier — juridiction compétente",
          body: "La clause attributive de compétence prévue aux présentes n'est pas opposable au particulier. Celui-ci peut saisir, à son choix, la juridiction du lieu où il demeurait au moment de la conclusion du contrat, celle du lieu de survenance du fait dommageable, ou l'une des juridictions territorialement compétentes en application du Code de procédure civile (art. R.631-3 du Code de la consommation).",
        },
        {
          title: "Réclamations et règlement des litiges",
          body: "Toute réclamation est adressée à contact@axion-ia.com ; les parties s'efforcent de résoudre amiablement tout différend avant toute action contentieuse. Entre professionnels, le dispositif de médiation de la consommation n'est pas applicable. Lorsque le Client est un particulier, la médiation de la consommation s'applique dans les conditions énoncées à la section qui lui est consacrée.",
        },
        {
          title: "Indépendance des clauses",
          body: "Si une stipulation des présentes conditions est jugée nulle ou inapplicable, les autres stipulations conservent leur pleine valeur. La clause concernée est, le cas échéant, remplacée par une stipulation valide d'effet équivalent.",
        },
        {
          title: "Droit applicable et juridiction",
          body: "Les présentes conditions sont régies par le droit français. À défaut de résolution amiable, tout litige relève de la compétence exclusive du tribunal compétent du ressort du siège social d'Axion-IA, y compris en cas de pluralité de défendeurs ou d'appel en garantie.",
        },
      ],
      metaSeo: {
        title: "Conditions générales · Axion-IA",
        description:
          "CGV/CGU B2B d'Axion-IA SAS : commande, prix, paiement et pénalités L441-10, propriété intellectuelle, responsabilité, RGPD, IA Act, formation professionnelle (L.6313-1). Droit français.",
      },
    },
    en: {
      title: "Terms &",
      titleEm: "conditions",
      intro:
        "Terms of sale and use (T&Cs) governing the services of Axion-IA SAS: on-site AI trainings and sessions, AI audits, AI implementations, one-to-one individual coaching, and design of AI-augmented websites and SaaS platforms. Services reserved for professional (B2B) clients. They include the provisions specific to professional training actions (articles L.6313-1 et seq. of the French Labour Code). The applicable version is the one in force on the last-updated date shown below.",
      sections: [
        {
          title: "Purpose and scope",
          body: "These terms govern the sale and provision of all Axion-IA services: on-site AI trainings and sessions (group and individual), AI audits, AI implementations, one-to-one individual coaching, and design of AI-augmented websites and SaaS platforms. They apply to any order, to the exclusion of any other document. The services are intended exclusively for professional (B2B) clients acting within their business activity; they do not constitute a sale to consumers.",
        },
        {
          title: "Provisions specific to professional training",
          body: "Where Axion-IA's services take the form of training actions, they fall under articles L.6313-1 et seq. of the French Labour Code. Training delivered to legal entities is covered by a training agreement compliant with articles L.6353-1 and L.6353-2 of the Labour Code. Training taken out by an individual in a personal capacity is covered by a training contract compliant with articles L.6353-3 to L.6353-7 of the Labour Code, including the ten-day withdrawal period provided for in article L.6353-5. On completion of the training, a certificate of completion is issued in accordance with articles L.6353-1 and D.6353-1 of the Labour Code. The procedures for filing and handling complaints relating to training are described in the complaints procedure published at /reclamations, and the rules applicable to trainees are set out in the internal regulations published at /reglement-interieur.",
        },
        {
          title: "Definitions",
          body: "« Axion-IA » means the provider; « Client » the professional signing the quote or placing an order; « Services » the ordered services; « Deliverables » the items handed over to the Client (reports, materials, code, configurations, documents); « Quote » the costed proposal detailing scope, price and lead times.",
        },
        {
          title: "Acceptance and enforceability of the T&Cs",
          body: "In accordance with article L441-1 of the French Commercial Code, these T&Cs form the sole basis of the commercial relationship and are provided to any professional buyer who requests them. Any order entails full acceptance of these terms, which prevail over any purchasing conditions of the Client, unless otherwise agreed in writing and signed by both parties. Axion-IA may amend its T&Cs; the applicable version is the one in force on the order date.",
        },
        {
          title: "Quote and order",
          body: "Each service is subject to a costed quote, valid 30 days from issuance. The order becomes firm and final upon receipt of the signed quote and, where applicable, the agreed deposit. No subscription or minimum term is imposed, unless otherwise stated in the quote.",
        },
        {
          title: "Pricing",
          body: "Prices are stated in euros excluding tax (excl. VAT) and are those of the accepted quote. Any travel, service or deliverable outside the quote scope is subject to a costed amendment agreed beforehand. French VAT at the rate in force (currently 20%) applies according to Axion-IA's tax regime and the Client's status; details appear on the quote and invoice. For a professional client established in another EU Member State with a valid intra-EU VAT number, reverse charge applies where relevant.",
        },
        {
          title: "Payment terms",
          body: "Unless a schedule is agreed in the quote, payment is made by bank transfer. For services under €5,000 excl. VAT, payment is due at order time; above that, staged payment (deposit at order then balance on progress or delivery) may be agreed. No early-payment discount is granted.",
        },
        {
          title: "Late payment — penalties and recovery indemnity",
          body: "The agreed payment term may not exceed the caps of article L441-10 of the French Commercial Code (60 days from invoice issuance, or 45 days end of month). Any late payment automatically triggers, without prior reminder and from the day following the due date: (i) late-payment penalties at the interest rate applied by the European Central Bank to its most recent refinancing operation, plus 10 percentage points; (ii) a fixed recovery indemnity of €40 per invoice (art. L441-10 II and D441-5 of the Commercial Code), without prejudice to additional compensation on supporting evidence where actual costs are higher. In the event of late payment, Axion-IA may suspend ongoing services until full payment.",
        },
        {
          title: "Performance and lead times",
          body: "Lead times are stated in the quote; they are a best-efforts undertaking and run from the point at which the start conditions are met (deposit, access, information and required availability). Axion-IA cannot be held liable for a delay attributable to the Client (lack of data access, team unavailability, late approvals) or to force majeure.",
        },
        {
          title: "Client obligations and cooperation",
          body: "The Client undertakes to cooperate actively and in good faith: to provide in a timely manner the information, access, environments and means required, to designate a decision-making contact, and to warrant that it holds the rights to the data and systems entrusted to Axion-IA. The Client remains responsible for its use of the Deliverables and for the decisions it makes on their basis.",
        },
        {
          title: "Intellectual property of deliverables",
          body: "The methods, know-how, tools, models and pre-existing materials used by Axion-IA remain its exclusive property. Unless otherwise stated in the quote, the exploitation rights over Deliverables specifically produced for the Client are assigned to it, within the limits set out in the quote, after full payment of the price, in accordance with article L131-3 of the French Intellectual Property Code. Axion-IA retains the right to reuse the generic skills, knowledge and know-how acquired during the engagement.",
        },
        {
          title: "Confidentiality",
          body: "Each party keeps confidential the non-public information exchanged in connection with the services and uses it solely for their performance. This undertaking applies throughout the relationship and for 3 years after its end, subject to legal disclosure obligations.",
        },
        {
          title: "Personal data protection",
          body: "Each party complies with applicable personal-data law (GDPR, EU 2016/679). Where, as part of a service, Axion-IA processes personal data on the Client's behalf, the parties enter into a processing agreement compliant with GDPR article 28 specifying the subject matter, duration, nature and purposes of the processing, the security and confidentiality measures, and the fate of the data at the end of the service. Processing of data collected via the site is described in the Privacy policy.",
        },
        {
          title: "Use of artificial intelligence and transparency",
          body: "Certain services rely on artificial intelligence systems, including generative AI. Axion-IA informs the Client and, where applicable, flags AI-generated or AI-assisted content, in accordance with article 50 of the EU Artificial Intelligence Act (EU 2024/1689). The Client remains responsible for validating and for the final use of results produced with AI assistance.",
        },
        {
          title: "Warranties and liability",
          body: "Axion-IA performs its services to professional standards, as a best-efforts undertaking. No outcome guarantee is given; any gains, ROI or performance mentioned are indicative and depend on factors specific to the Client. Axion-IA's liability, on any ground, is limited to direct damage and capped at the amount excl. VAT actually received for the service giving rise to the damage. Indirect damage is excluded (loss of operations, data, revenue or reputation). These limitations do not apply in the event of gross negligence or wilful misconduct, nor where the law prohibits them.",
        },
        {
          title: "Insurance",
          body: "Axion-IA declares that it holds professional civil liability insurance covering the financial consequences of its liability in connection with its services. The insurer's details are available on request.",
        },
        {
          title: "Force majeure",
          body: "Neither party may be held liable for a failure resulting from force majeure within the meaning of article 1218 of the French Civil Code and French case law (including strikes, major outages, disasters, epidemics, failure of an essential supplier). The prevented party informs the other without delay; obligations are suspended for the duration of the impediment, and the contract may be terminated if the impediment becomes permanent.",
        },
        {
          title: "Cancellation, rescheduling and refund",
          body: "Any cancellation by the Client: more than 7 days before the scheduled date, full refund of sums paid; between 7 and 2 days, 50% of the price remains due; less than 2 days, the full price remains due, with the slot reschedulable once at no extra charge. Where the service takes the form of a training action, the specific terms (training agreement or contract, cancellation and withdrawal conditions, any funding) are set out in the quote or applicable agreement.",
        },
        {
          title: "Reversibility and return",
          body: "At the end of the service, Axion-IA returns to the Client, on request and in a usable format, the data and configurations belonging to it, and deletes working copies within a reasonable time, subject to legal retention obligations.",
        },
        {
          title: "Non-solicitation of staff",
          body: "During performance of the services and for 12 months after their end, the Client undertakes not to directly solicit or hire the Axion-IA personnel who took part in the service, save with Axion-IA's prior written consent.",
        },
        {
          title: "Commercial references",
          body: "Unless the Client objects in writing, Axion-IA may mention the Client's name and logo and a general description of the service as a commercial reference, while respecting the confidentiality of sensitive information.",
        },
        {
          title: "No right of withdrawal",
          body: "As the services are concluded between professionals, the right of withdrawal under the French Consumer Code does not apply. By exception, a professional Client employing five staff or fewer benefits from a 14-day withdrawal period for contracts concluded away from business premises whose subject matter falls outside its main field of activity (art. L221-3 of the Consumer Code).",
        },
        {
          title: "Complaints and dispute resolution",
          body: "Any complaint is addressed to contact@axion-ia.com; the parties endeavour to resolve any dispute amicably before any litigation. As the clientele is exclusively professional, the consumer-mediation scheme does not apply.",
        },
        {
          title: "Severability",
          body: "If any provision of these terms is held void or unenforceable, the remaining provisions retain full force. The provision concerned is, where applicable, replaced by a valid provision of equivalent effect.",
        },
        {
          title: "Applicable law and jurisdiction",
          body: "These terms are governed by French law. Failing an amicable resolution, any dispute falls within the exclusive jurisdiction of the competent court for the district of Axion-IA's registered office, including in the event of multiple defendants or third-party proceedings.",
        },
      ],
      metaSeo: {
        title: "Terms & conditions · Axion-IA",
        description:
          "Axion-IA SAS B2B T&Cs: order, pricing, payment and L441-10 penalties, intellectual property, liability, GDPR, AI Act, professional training (L.6313-1). French law applies.",
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
          body: "Email, nom, raison sociale, contenu des messages, métadonnées techniques (user-agent, langue), pages visitées (Plausible self-hosted, anonymisé). Aucun cookie publicitaire, aucun tracker tiers.",
        },
        {
          title: "Finalités",
          body: "Réponse aux demandes commerciales, suivi des prestations, sécurité du site, statistiques d'audience anonymes. Pas de profilage, pas de revente de données.",
        },
        {
          title: "Base légale",
          body: "Exécution contractuelle (RGPD art. 6.1.b) pour les clients ; intérêt légitime (RGPD art. 6.1.f) pour la sécurité ; consentement (RGPD art. 6.1.a) pour la newsletter.",
        },
        {
          title: "Durée de conservation",
          body: "Données clients : 5 ans après fin de prestation (obligation comptable française). Demandes commerciales : 3 ans. Logs techniques : 12 mois maximum.",
        },
        {
          title: "Vos droits",
          body: "Accès, rectification, effacement, opposition, portabilité, limitation. Contactez contact@axion-ia.com. Vous avez également le droit d'introduire une réclamation auprès de la CNIL.",
        },
        {
          title: "Hébergement et transferts",
          body: "Hébergement principal dans l'UE (Hetzner Frankfurt, Allemagne) et services edge Cloudflare (présence UE prioritaire). Les seuls transferts hors UE concernent les sous-processeurs IA américains (OpenAI, Anthropic, Perplexity) lorsqu'un contenu éditorial est généré ou un fact-check effectué — encadrés par les Clauses Contractuelles Types (SCC) de la Commission européenne et listés exhaustivement sur /sous-processeurs avec leur cadre de transfert international (SCC + DPF le cas échéant). Aucune donnée personnelle de visiteur n'est transmise à ces modèles (helper `pii-safe` + hard gate code).",
        },
        {
          title: "Sous-processeurs et destinataires des données",
          body: "Conformément à l'article 13.1.e du RGPD, Axion-IA tient une liste exhaustive et publique de ses sous-processeurs sur la page /sous-processeurs (catégories : infrastructure principale, paiements & contrats, communications, analytics & observabilité, génération de contenu IA). Cette page indique pour chaque sous-processeur sa finalité, les catégories de données traitées, la localisation des serveurs, la base légale, le statut du DPA et le cadre de transfert international. Toute évolution est notifiée par email aux clients actifs au moins 30 jours avant prise d'effet. Aucune donnée n'est vendue ni partagée à des fins publicitaires.",
        },
        {
          title: "IA générative et transparence (AI Act EU)",
          body: "Certains contenus éditoriaux du site (Articles signés Manon, fiches de villes, FAQ) sont rédigés par des modèles d'IA générative (OpenAI GPT-4o pour la rédaction, Perplexity Sonar pour la vérification factuelle) puis soumis à des contrôles automatisés avant publication — vérification factuelle, contrôle éditorial et alignement doctrine. La relecture humaine n'est pas systématique. Conformément à l'article 50 du Règlement européen sur l'IA (AI Act 2024/1689), la nature IA-assistée de ces contenus est divulguée publiquement — voir la fiche transparence sur /equipe/manon. Les prompts envoyés à ces modèles ne contiennent aucune donnée personnelle de visiteur (helper `pii-safe` + hard gate code sur la base de connaissances). Vous pouvez vous opposer à tout traitement de vos données par un modèle IA (RGPD art. 21) en écrivant à contact@axion-ia.com.",
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
          body: "Email, name, company name, message content, technical metadata (user-agent, language), pages visited (self-hosted Plausible, anonymized). No advertising cookies, no third-party trackers.",
        },
        {
          title: "Purposes",
          body: "Reply to commercial requests, service follow-up, site security, anonymous audience statistics. No profiling, no data resale.",
        },
        {
          title: "Legal basis",
          body: "Contractual performance (GDPR art. 6.1.b) for clients; legitimate interest (GDPR art. 6.1.f) for security; consent (GDPR art. 6.1.a) for the newsletter.",
        },
        {
          title: "Retention period",
          body: "Client data: 5 years after end of service (French accounting obligation). Commercial requests: 3 years. Technical logs: 12 months maximum.",
        },
        {
          title: "Your rights",
          body: "Access, rectification, erasure, objection, portability, limitation. Contact contact@axion-ia.com. You also have the right to lodge a complaint with the CNIL.",
        },
        {
          title: "Hosting and transfers",
          body: "Primary hosting in the EU (Hetzner Frankfurt, Germany) and Cloudflare edge services (EU presence prioritized). The only transfers outside the EU concern US AI sub-processors (OpenAI, Anthropic, Perplexity) when editorial content is generated or fact-checked — covered by the European Commission Standard Contractual Clauses (SCC) and listed exhaustively on /subprocessors with their international transfer framework (SCC + DPF where applicable). No visitor personal data is sent to these models (`pii-safe` helper + code-level hard gate).",
        },
        {
          title: "Sub-processors and data recipients",
          body: "In accordance with GDPR article 13.1.e, Axion-IA maintains an exhaustive public list of its sub-processors at /subprocessors (categories: core infrastructure, payments & contracts, communications, analytics & observability, AI content generation). That page specifies for each sub-processor its purpose, the categories of data processed, server location, legal basis, DPA status and international transfer framework. Any change is notified by email to active clients at least 30 days before taking effect. No data is ever sold or shared for advertising purposes.",
        },
        {
          title: "Generative AI and transparency (EU AI Act)",
          body: "Certain editorial content on the site (articles signed by Manon, city pages, FAQs) is written by generative AI models (OpenAI GPT-4o for drafting, Perplexity Sonar for fact-checking) and then subjected to automated checks before publication — fact-checking, editorial control and doctrine alignment. Human review is not systematic. In accordance with article 50 of the EU AI Act (2024/1689), the AI-assisted nature of this content is publicly disclosed — see the transparency notice at /equipe/manon. Prompts sent to these models contain no visitor personal data (`pii-safe` helper + code-level hard gate on the knowledge base). You may object to any processing of your data by an AI model (GDPR art. 21) by writing to contact@axion-ia.com.",
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
          body: "Cookies de session pour l'authentification admin (durée de session) et préférence de langue (12 mois). Aucun consentement requis (RGPD art. 5.3 exception).",
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
          title: "Cookies tiers",
          body: "Aucun cookie publicitaire, aucun cookie réseau social, aucun cookie de tracking cross-site.",
        },
        {
          title: "Gérer vos cookies",
          body: "Le bandeau cookies vous permet d'accepter ou refuser les analytics Microsoft Clarity. Votre choix est conservé 13 mois maximum (recommandation CNIL). Tous les navigateurs modernes permettent en plus de bloquer les cookies globalement — le blocage des cookies strictement nécessaires peut empêcher l'usage de la console admin.",
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
          body: "Session cookies for admin authentication (session duration) and language preference (12 months). No consent required (GDPR art. 5.3 exception).",
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
          title: "Third-party cookies",
          body: "No advertising cookies, no social network cookies, no cross-site tracking cookies.",
        },
        {
          title: "Manage your cookies",
          body: "The cookie banner lets you accept or decline Microsoft Clarity analytics. Your choice is kept for 13 months maximum (CNIL recommendation). All modern browsers additionally allow blocking cookies globally — blocking strictly necessary cookies may prevent use of the admin console.",
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
          body: "Demander la suppression de vos données, sous réserve des obligations légales (comptabilité 5 ans).",
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
          body: "Request deletion of your data, subject to legal obligations (5-year accounting).",
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
        "Procédure de traitement des réclamations relatives aux prestations de formation d'Axion-IA : qui peut réclamer, comment déposer une réclamation, délais de réponse, traitement et voies de recours.",
      sections: [
        {
          title: "Objet et champ d'application",
          body: "La présente procédure décrit les modalités de dépôt et de traitement des réclamations relatives aux prestations de formation d'Axion-IA. Peut formuler une réclamation toute personne concernée par une action de formation : le stagiaire, l'entreprise cliente qui commande la formation, ainsi que le financeur (OPCO, France Travail ou tout autre organisme prenant en charge le coût). Une réclamation s'entend de toute expression écrite d'insatisfaction relative à l'organisation, au contenu, au déroulement, aux moyens pédagogiques ou aux conditions administratives d'une formation.",
        },
        {
          title: "Comment déposer une réclamation",
          body: "Toute réclamation est formulée par écrit, afin d'en garantir la traçabilité. Elle peut être adressée par email à contact@axion-ia.com ou par courrier au siège de l'organisme. Pour permettre un traitement efficace, la réclamation précise l'identité du réclamant, la formation concernée (intitulé et dates), une description factuelle de la situation et, le cas échéant, les attentes du réclamant.",
        },
        {
          title: "Délais de traitement",
          body: "Axion-IA accuse réception de la réclamation dans un délai de 5 jours ouvrés à compter de sa réception. Une réponse circonstanciée est apportée dans un délai maximum de 15 jours ouvrés à compter de la réception de la réclamation. Lorsque l'analyse nécessite un délai supplémentaire, le réclamant en est informé, avec l'indication d'un nouveau délai prévisionnel.",
        },
        {
          title: "Traitement et actions correctives",
          body: "Chaque réclamation est enregistrée puis instruite par le référent pédagogique. L'instruction consiste à analyser les faits, à recueillir si nécessaire le point de vue du formateur et des parties concernées, et à déterminer les suites appropriées. Lorsqu'un dysfonctionnement est avéré, une ou plusieurs actions correctives sont définies et mises en œuvre afin d'éviter son renouvellement.",
        },
        {
          title: "Suivi et amélioration continue",
          body: "Les réclamations et les actions correctives associées sont consignées dans un registre interne. Elles font l'objet d'un suivi et d'une analyse périodique qui alimentent la démarche d'amélioration continue de la qualité des prestations.",
        },
        {
          title: "Voies de recours",
          body: "Si la réponse apportée ne satisfait pas le réclamant, celui-ci peut demander un réexamen de sa situation. Lorsque la formation fait l'objet d'un financement, le financeur (OPCO, France Travail ou autre) peut également être informé. Les litiges qui ne trouveraient pas de solution amiable relèvent des dispositions prévues par les conditions générales.",
        },
      ],
      metaSeo: {
        title: "Procédure de réclamation · Axion-IA",
        description:
          "Procédure de réclamation des formations Axion-IA : dépôt par écrit, accusé de réception sous 5 jours ouvrés, réponse circonstanciée sous 15 jours ouvrés, actions correctives et voies de recours.",
      },
    },
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
          body: "Le stagiaire s'engage à être présent et ponctuel à toutes les sessions de formation. Toute absence ou tout retard doit être signalé le plus tôt possible à l'organisme de formation. En formation distancielle, la caméra doit rester activée pendant les séquences synchrones, sauf autorisation explicite du formateur ; une absence de caméra non justifiée peut entraîner la non-validation de la présence pour la demi-journée concernée. La feuille d'émargement est signée à chaque demi-journée ; en distanciel, le relevé de connexion fait office de justificatif de présence.",
        },
        {
          title: "Article 3 — Discipline et comportement",
          body: "Sont notamment interdits : tout comportement irrespectueux envers le formateur ou les autres stagiaires ; l'enregistrement audio ou vidéo des sessions sans accord écrit préalable de l'organisme ; l'usage de téléphones portables ou d'appareils personnels à des fins non pédagogiques pendant les séquences synchrones ; la consommation d'alcool ou de substances illicites. Tout manquement grave aux règles de discipline peut entraîner l'exclusion définitive du stagiaire, sans remboursement des frais de formation déjà engagés.",
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
          title: "Article 6 — Sécurité",
          body: "En présentiel, le stagiaire respecte les consignes de sécurité affichées dans les locaux (sorties de secours, points de rassemblement) et informe immédiatement le formateur ou le responsable des locaux en cas d'accident. En distanciel, le stagiaire est responsable de la sécurité de son environnement de travail (connexion sécurisée, confidentialité de son écran en espace partagé).",
        },
        {
          title: "Article 7 — Évaluation et attestation de formation",
          body: "Des évaluations des acquis sont réalisées en cours et en fin de formation. La participation active à ces évaluations conditionne la délivrance de l'attestation de fin de formation. L'attestation est remise au stagiaire ayant suivi l'intégralité du programme ou, en cas d'absence partielle justifiée, au prorata des heures effectivement réalisées.",
        },
        {
          title: "Article 8 — Réclamations",
          body: "Toute réclamation relative au déroulement de la formation est formulée par écrit (courrier ou email) auprès du référent pédagogique de l'organisme. L'organisme accuse réception de la réclamation dans un délai de 5 jours ouvrés et y répond de manière circonstanciée dans un délai maximum de 15 jours ouvrés à compter de sa réception. Les modalités détaillées de dépôt, de traitement et de recours figurent dans la procédure de réclamation publiée sur /reclamations.",
        },
        {
          title: "Article 9 — Protection des données personnelles (RGPD)",
          body: "Conformément au Règlement (UE) 2016/679 (RGPD) et à la loi Informatique et Libertés, les données personnelles du stagiaire (nom, prénom, coordonnées, données de connexion, évaluations) sont collectées aux fins de gestion administrative et pédagogique de la formation. Elles sont conservées pendant cinq (5) ans à compter de la fin de la formation, conformément aux obligations légales de l'organisme de formation. Le stagiaire dispose des droits d'accès, de rectification, d'effacement, de limitation et de portabilité de ses données, ainsi que du droit de s'opposer à leur traitement ; ces droits s'exercent auprès de l'organisme de formation à l'adresse contact@axion-ia.com.",
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
          body: "The trainee undertakes to be present and punctual at all training sessions. Any absence or lateness must be reported to the training organisation as soon as possible. In distance learning, the camera must remain on during synchronous sessions, unless the trainer explicitly authorises otherwise; an unjustified absence of camera may lead to the half-day's attendance not being validated. The attendance sheet is signed for each half-day; for distance learning, the connection log serves as proof of attendance.",
        },
        {
          title: "Article 3 — Discipline and conduct",
          body: "The following are notably prohibited: any disrespectful behaviour towards the trainer or other trainees; audio or video recording of sessions without the organisation's prior written consent; the use of mobile phones or personal devices for non-educational purposes during synchronous sessions; the consumption of alcohol or illicit substances. Any serious breach of the discipline rules may result in the trainee's permanent exclusion, without refund of training fees already incurred.",
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
          title: "Article 6 — Safety",
          body: "In person, the trainee complies with the safety instructions posted on the premises (emergency exits, assembly points) and immediately informs the trainer or the person in charge of the premises in the event of an accident. In distance learning, the trainee is responsible for the security of their working environment (secure connection, screen confidentiality in a shared space).",
        },
        {
          title: "Article 7 — Assessment and certificate of completion",
          body: "Assessments of learning are carried out during and at the end of the training. Active participation in these assessments is a condition for issuing the certificate of completion. The certificate is issued to the trainee who has completed the full programme or, in the event of a justified partial absence, in proportion to the hours actually completed.",
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
