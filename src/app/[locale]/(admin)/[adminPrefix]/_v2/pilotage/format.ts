// Tableau de bord de pilotage — helpers d'affichage purs (aucune I/O).
//
// Tous les montants arrivent en CENTIMES (convention du domaine) : la division
// par 100 se fait ICI, à l'affichage, jamais dans les couches de calcul.

const EUROS_FMT = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Centimes → « 12 345 € » (arrondi à l'euro — dashboard, pas pièce comptable). */
export function fmtEurosCents(cents: number): string {
  return EUROS_FMT.format(cents / 100);
}

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Paris",
});

/** Date courte FR (Europe/Paris), ou « — » si absente. */
export function fmtDate(d: Date | null | undefined): string {
  return d ? DATE_FMT.format(d) : "—";
}

/** Mois abrégés FR — index 0 = janvier. */
export const MOIS_COURTS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

/** Libellé court d'une clé mois « YYYY-MM » (ex. « août 25 »). */
export function labelMoisCle(cle: string): string {
  const idx = Number(cle.slice(5, 7)) - 1;
  return `${MOIS_COURTS[idx] ?? cle.slice(5, 7)} ${cle.slice(2, 4)}`;
}

/** Largeur (%) d'une barre CSS, bornée [0, 100], sur un maximum donné. */
export function largeurPct(valeur: number, max: number): number {
  if (max <= 0 || valeur <= 0) return 0;
  return Math.min(100, Math.round((valeur / max) * 100));
}

/** Rôles admin : slug technique → libellé FR métier. Repli sur le slug. */
export function libelleRole(role: string): string {
  const LABELS: Record<string, string> = {
    super_admin: "Super administrateur",
    admin: "Administrateur",
    editor: "Éditeur",
    reader: "Lecteur",
  };
  return LABELS[role] ?? role;
}

/**
 * Actions du journal d'activité : slug technique → libellé FR. Complété le
 * 2026-08-02 (finitions console) à partir de l'inventaire des `action:` écrits
 * par `src/server` + `src/features` — le journal affichait le slug brut pour
 * l'immense majorité des lignes. Repli inchangé en deux temps : verbe final
 * traduit si connu, sinon le slug brut (jamais d'erreur). Les actions du
 * pipeline de génération de contenu restent volontairement absentes (frontière
 * d'isolation § 4.1bis — leur préfixe ne doit pas apparaître ici) : elles
 * passent par le repli.
 */
const ACTION_LABELS: Record<string, string> = {
  // ── Authentification & comptes ──────────────────────────────────────────
  "auth.2fa.setup_started": "2FA — configuration démarrée",
  "auth.2fa.enabled": "2FA activée",
  "auth.2fa.disabled": "2FA désactivée",
  "auth.login.failed": "Échec de connexion",
  "user.created": "Utilisateur créé",
  "user.updated": "Utilisateur modifié",
  "user.2fa_reset_cross": "2FA réinitialisée (autre compte)",
  "user.password_reset_cross": "Mot de passe réinitialisé (autre compte)",

  // ── Contenus éditoriaux ─────────────────────────────────────────────────
  "article.archived": "Article archivé",
  "case_study.archived": "Étude de cas archivée",
  "category.archived": "Catégorie archivée",
  "faq.archived": "FAQ archivée",
  "help_article.archived": "Article d'aide archivé",
  "asset.uploaded": "Fichier téléversé",
  "setting.updated": "Paramètre modifié",
  "setting.deleted": "Paramètre supprimé",

  // ── Base de connaissances ───────────────────────────────────────────────
  "kb.created": "Base de connaissances — fiche créée",
  "kb.updated": "Base de connaissances mise à jour",
  "kb.deleted": "Base de connaissances — fiche supprimée",
  "kb.draft.saved": "Base de connaissances — brouillon enregistré",

  // ── Avis clients ────────────────────────────────────────────────────────
  "review.publish": "Publication après relecture",
  "review.approve": "Relecture approuvée",
  "review.reject": "Relecture rejetée",
  "review.hide": "Avis masqué",
  "review.reply": "Réponse à un avis",
  "review.delete": "Avis supprimé",
  "review.feature": "Avis mis en avant",
  "review.verify": "Avis vérifié",
  "review.photo_upload": "Photo d'avis ajoutée",
  "review.photo_remove": "Photo d'avis retirée",

  // ── Demandes de contact & newsletter ────────────────────────────────────
  "submission.updated": "Demande modifiée",
  "submission.exported": "Demande exportée",
  "submission.erased": "Demande effacée (RGPD)",
  "submission.purged": "Demande purgée (RGPD)",
  "newsletter.exported": "Newsletter — abonnés exportés",
  "newsletter.erased": "Newsletter — abonné effacé (RGPD)",
  "newsletter.purged": "Newsletter — purge RGPD",
  "newsletter.force_unsubscribe": "Newsletter — désabonnement forcé",
  "rgpd.image_bank.forget_ip_hash": "RGPD — IP oubliée (banque d'images)",

  // ── Rendez-vous, réservations & paiements ───────────────────────────────
  "booking.cancelled": "Réservation annulée",
  "booking.cancel_by_admin": "Réservation annulée par l'admin",
  "booking.reschedule": "Réservation reprogrammée",
  "booking_payment_schedule.override": "Échéancier de réservation modifié",
  "payment_schedule.archive": "Échéancier archivé",
  "calendar.blocked": "Créneau bloqué",
  "calendar.unblocked": "Créneau débloqué",
  "refund.trigger": "Remboursement déclenché",
  "invoice.mark_paid_manual": "Facture marquée payée (manuel)",
  "invoice.issue_credit_note": "Avoir émis",
  "option.validated": "Option validée",
  "option.refused": "Option refusée",
  "contract.send_with_deposit": "Contrat envoyé (avec acompte)",
  "contract.create_addendum": "Avenant créé",
  "contract.cancel_and_reissue": "Contrat annulé et réémis",

  // ── Chatbot ─────────────────────────────────────────────────────────────
  "chatbot.escalation.resolved": "Escalade chatbot résolue",
  "chatbot.ingestion.triggered": "Ingestion chatbot lancée",
  "chatbot.prompt.activated": "Prompt chatbot activé",
  "chatbot.prompt.created": "Prompt chatbot créé",
  "chatbot.settings.updated": "Réglages chatbot modifiés",

  // ── E-mails sortants ────────────────────────────────────────────────────
  "email.outbox.approuver": "E-mail sortant approuvé",
  "email.outbox.refuser": "E-mail sortant refusé",
  "email.reglage.definir": "Réglage e-mail défini",
  "email.reglage.supprimer": "Réglage e-mail supprimé",

  // ── Recrutement & podcast ───────────────────────────────────────────────
  "jobapplication.updated": "Candidature modifiée",
  "jobapplication.deleted": "Candidature supprimée",
  "joboffer.archived": "Offre d'emploi archivée",
  "joboffer.cloned": "Offre d'emploi dupliquée",
  "joboffer.deleted": "Offre d'emploi supprimée",
  "joboffer.filled": "Offre d'emploi pourvue",
  "podcastrequest.updated": "Demande podcast modifiée",
  "podcastrequest.deleted": "Demande podcast supprimée",

  // ── Facturation (hub) ───────────────────────────────────────────────────
  "facturation.avoir.emettre": "Avoir émis (hub facturation)",
  "facturation.brouillon.emettre": "Facture émise depuis brouillon",
  "facturation.dossier.creer": "Dossier de facturation créé",
  "facturation.dossier.transition": "Dossier de facturation — changement d'étape",
  "facturation.email.devis": "Devis envoyé par e-mail",
  "facturation.email.facture": "Facture envoyée par e-mail",
  "facturation.facture_libre.emettre": "Facture libre émise",
  "facturation.fec.exporter": "Export FEC",
  "facturation.historique.importer": "Historique de facturation importé",
  "facturation.paiement.enregistrer": "Paiement enregistré",
  "facturation.plan_recurrent.creer": "Plan récurrent créé",
  "facturation.plan_recurrent.statut": "Plan récurrent — statut modifié",
  "facturation.relance.envoyer": "Relance envoyée",

  // ── Qualiopi — CRM, clients, devis ──────────────────────────────────────
  "qualiopi.crm.convertir_entree": "Entrée CRM convertie",
  "qualiopi.client.create": "Client créé",
  "qualiopi.client.update": "Client modifié",
  "qualiopi.devis.create": "Devis créé",
  "qualiopi.devis.send": "Devis envoyé",
  "qualiopi.devis.accept": "Devis accepté",
  "qualiopi.devis.decline": "Devis refusé",
  "qualiopi.devis.revise": "Devis révisé",
  "qualiopi.devis.transform_convention": "Devis transformé en convention",

  // ── Qualiopi — formations ───────────────────────────────────────────────
  "qualiopi.formation.create": "Formation créée",
  "qualiopi.formation.update": "Formation modifiée",
  "qualiopi.formation.publish": "Formation publiée",
  "qualiopi.formation.validate": "Formation validée",
  "qualiopi.formation.archive": "Formation archivée",
  "qualiopi.formation.duplicate": "Formation dupliquée",
  "qualiopi.formation.import_catalog": "Catalogue de formations importé",
  "qualiopi.formation.certification.set": "Formation — certification définie",
  "qualiopi.formation.moyens.set": "Formation — moyens définis",
  "qualiopi.formation.indicateurs.publier": "Indicateurs de formation publiés",
  "qualiopi.formation.generation.start": "Génération de formation lancée",
  "qualiopi.formation.generation.batch": "Génération de formations (lot)",
  "qualiopi.support.generer": "Support de formation généré",
  "qualiopi.support.generer_tous": "Tous les supports générés",
  "qualiopi.support.regenerer": "Support de formation régénéré",
  "qualiopi.support.supprimer": "Support de formation supprimé",

  // ── Qualiopi — sessions & inscriptions ──────────────────────────────────
  "qualiopi.session.create": "Session créée",
  "qualiopi.session.create_recurrentes": "Sessions récurrentes créées",
  "qualiopi.session.assign_formateur": "Formateur assigné à la session",
  "qualiopi.session.inter_entreprises": "Session — inter-entreprises modifié",
  "qualiopi.session.jours.save": "Jours de session enregistrés",
  "qualiopi.session.lieu.set": "Lieu de session défini",
  "qualiopi.session.report": "Session reportée",
  "qualiopi.session.transition.planifiee": "Session repassée à planifiée",
  "qualiopi.session.transition.en_cours": "Session passée en cours",
  "qualiopi.session.transition.realisee": "Session passée à réalisée",
  "qualiopi.session.transition.annulee": "Session annulée",
  "qualiopi.session.transition.reportee": "Session reportée",
  "qualiopi.enrollment.create": "Inscription créée",
  "qualiopi.enrollment.adaptations": "Inscription — adaptations saisies",
  "qualiopi.enrollment.financement": "Inscription — financement défini",
  "qualiopi.enrollment.presence": "Inscription — présence saisie",
  "qualiopi.enrollment.fiche_adaptation.export_pdf": "Fiche d'adaptation exportée (PDF)",
  "qualiopi.trainee.create": "Stagiaire créé",
  "qualiopi.trainee.update": "Stagiaire modifié",
  "qualiopi.portail.generer_acces": "Accès portail stagiaire généré",
  "qualiopi.portail.revoquer_acces": "Accès portail stagiaire révoqué",

  // ── Qualiopi — présence & émargement ────────────────────────────────────
  "qualiopi.presence.creneau.manual": "Créneau de présence ajouté (manuel)",
  "qualiopi.presence.creneaux.generate": "Créneaux de présence générés",
  "qualiopi.presence.emargement.save": "Émargement enregistré",
  "qualiopi.presence.releve.document": "Relevé de connexion documenté",
  "qualiopi.presence.releve.import": "Relevé de connexion importé",
  "qualiopi.emargement.liens.emettre": "Liens d'émargement émis",
  "qualiopi.emargement.liens.revoquer": "Liens d'émargement révoqués",
  "qualiopi.releve.visa": "Relevé de connexion visé",

  // ── Qualiopi — documents générés ────────────────────────────────────────
  "qualiopi.document.generate": "Document généré",
  "qualiopi.document.convention.genere": "Convention générée",
  "qualiopi.document.convention_tripartite.genere": "Convention tripartite générée",
  "qualiopi.document.contrat.genere": "Contrat de formation généré",
  "qualiopi.document.contrat_sous_traitance.genere": "Contrat de sous-traitance généré",
  "qualiopi.document.convocation.genere": "Convocation générée",
  "qualiopi.document.emargement.genere": "Feuille d'émargement générée",
  "qualiopi.document.certificat_realisation.genere": "Certificat de réalisation généré",
  "qualiopi.document.grille_evaluation.genere": "Grille d'évaluation générée",
  "qualiopi.document.inventaire_moyens.genere": "Inventaire des moyens généré",
  "qualiopi.document.kit_cpf.genere": "Kit CPF généré",
  "qualiopi.document.kit_france_travail.genere": "Kit France Travail généré",
  "qualiopi.document.kit_opco.genere": "Kit OPCO généré",
  "qualiopi.document.lettre_mission.genere": "Lettre de mission générée",
  "qualiopi.document.lettre_mission_cadre.genere": "Lettre de mission-cadre générée",
  "qualiopi.document.livret_accueil.genere": "Livret d'accueil généré",
  "qualiopi.document.positionnement.genere": "Questionnaire de positionnement généré",
  "qualiopi.document.programme.genere": "Programme généré",
  "qualiopi.document.reglement_interieur.genere": "Règlement intérieur généré",
  "qualiopi.document.satisfaction.genere": "Questionnaire de satisfaction généré",

  // ── Qualiopi — signatures ───────────────────────────────────────────────
  "qualiopi.signature.revocation": "Lien de signature révoqué",
  "qualiopi.piece.contresignature": "Pièce contresignée",
  "qualiopi.piece.lien_signature": "Lien de signature émis",
  "qualiopi.piece.lien_signature.envoye": "Lien de signature envoyé",
  "qualiopi.piece.lien_signature.revocation": "Lien de signature révoqué",
  "qualiopi.lettre_mission.contresignature": "Lettre de mission contresignée",

  // ── Qualiopi — facturation & financement ────────────────────────────────
  "qualiopi.facture.generer": "Facture générée",
  "qualiopi.facture.par_inscription": "Factures par inscription générées",
  "qualiopi.facture.pdf.generer": "PDF de facture généré",
  "qualiopi.acompte.set": "Acompte défini",
  "qualiopi.financement.set": "Financement défini",
  "qualiopi.financement.opco.accord_recu": "Accord OPCO reçu",
  "qualiopi.financement.prise_en_charge.set": "Prise en charge définie",
  "qualiopi.bareme_opco.create_version": "Barème OPCO — nouvelle version",
  "qualiopi.bareme_opco.delete": "Barème OPCO supprimé",
  "qualiopi.compta.csv.export": "Export comptable (CSV)",
  "qualiopi.bpf.depense.create": "BPF — dépense ajoutée",
  "qualiopi.bpf.depense.delete": "BPF — dépense supprimée",
  "qualiopi.bpf.export_csv": "BPF exporté (CSV)",

  // ── Qualiopi — évaluations & satisfaction ───────────────────────────────
  "qualiopi.evaluation.create": "Évaluation créée",
  "qualiopi.attestation.generer": "Attestation générée",
  "qualiopi.attestation.aucune": "Attestation — aucune délivrée",
  "qualiopi.attestation.refusee_statut": "Attestation refusée (statut)",
  "qualiopi.satisfaction.generer_questionnaires": "Questionnaires de satisfaction générés",
  "qualiopi.satisfaction.saisir_reponses": "Réponses de satisfaction saisies",
  "qualiopi.appreciations.creer": "Appréciation créée",

  // ── Qualiopi — formateurs & sous-traitance ──────────────────────────────
  "qualiopi.trainer.create": "Formateur créé",
  "qualiopi.trainer.update": "Formateur modifié",
  "qualiopi.trainer.set_actif": "Formateur — statut actif modifié",
  "qualiopi.trainer.habilitations": "Formateur — habilitations modifiées",
  "qualiopi.trainer.verify_sous_traitant": "Formateur sous-traitant vérifié",
  "qualiopi.trainer.sous_traitant.verifie": "Formateur sous-traitant vérifié",
  "qualiopi.trainer.development_action.create": "Formateur — action de développement créée",
  "qualiopi.trainer.development_action.delete": "Formateur — action de développement supprimée",
  "qualiopi.trainer_availability.create": "Disponibilité formateur ajoutée",
  "qualiopi.trainer_availability.delete": "Disponibilité formateur supprimée",
  "qualiopi.trainer_document.create": "Document formateur ajouté",
  "qualiopi.trainer_document.delete": "Document formateur supprimé",
  "qualiopi.trainer_document.validate": "Document formateur validé",
  "qualiopi.formateur.cv.export_pdf": "CV formateur exporté (PDF)",
  "qualiopi.formateur.fiche.versee": "Fiche formateur versée au dossier",
  "qualiopi.sous_traitant.create": "Sous-traitant créé",
  "qualiopi.sous_traitant.verifie_data_gouv": "Sous-traitant vérifié (data.gouv)",
  "qualiopi.remuneration.run": "Run de rémunération lancé",
  "qualiopi.remuneration.statement_transition": "Relevé de rémunération — transition",
  "qualiopi.compensation_rule.create": "Règle de rémunération créée",
  "qualiopi.compensation_rule.close": "Règle de rémunération clôturée",

  // ── Qualiopi — coaching 1-to-1 / AFEST ──────────────────────────────────
  "qualiopi.coaching.afest.cadrage": "Coaching — cadrage AFEST",
  "qualiopi.coaching.certification.set": "Coaching — certification définie",
  "qualiopi.coaching.emargement.generate": "Coaching — émargement généré",
  "qualiopi.coaching.facture.generate": "Coaching — facture générée",
  "qualiopi.coaching.financement.set": "Coaching — financement défini",
  "qualiopi.coaching.protocole_afest.generate": "Coaching — protocole AFEST généré",
  "qualiopi.coaching.seance.presence_actee": "Coaching — présence actée",

  // ── Qualiopi — audits, qualité, veille ──────────────────────────────────
  "qualiopi.audit_mission.create": "Mission d'audit créée",
  "qualiopi.audit_mission.assign_formateur": "Mission d'audit — formateur assigné",
  "qualiopi.audit_mission.statut": "Mission d'audit — statut modifié",
  "qualiopi.dossier_audit.export_zip": "Dossier d'audit exporté (ZIP)",
  "qualiopi.dossier_session.export_zip": "Dossier de session exporté (ZIP)",
  "qualiopi.manifeste_audit.export": "Manifeste d'audit exporté",
  "qualiopi.pilotage.export_csv": "Pilotage exporté (CSV)",
  "qualiopi.pilotage.export_pdf": "Pilotage exporté (PDF)",
  "qualiopi.indicateurs.recompute": "Indicateurs recalculés",
  "qualiopi.incident.create": "Incident créé",
  "qualiopi.incident.update": "Incident modifié",
  "qualiopi.incident.delete": "Incident supprimé",
  "qualiopi.reclamation.create": "Réclamation créée",
  "qualiopi.reclamation.repondre": "Réclamation — réponse envoyée",
  "qualiopi.revue_direction.create": "Revue de direction créée",
  "qualiopi.revue_direction.update": "Revue de direction modifiée",
  "qualiopi.revue_direction.reporter_constat": "Revue de direction — constat reporté",
  "qualiopi.veille.create": "Veille — entrée créée",
  "qualiopi.veille.update": "Veille — entrée modifiée",
  "qualiopi.veille.delete": "Veille — entrée supprimée",
  "qualiopi.filevalidation.approve": "Pièce déposée approuvée",
  "qualiopi.filevalidation.reject": "Pièce déposée rejetée",
  "qualiopi.moyen.create": "Moyen pédagogique créé",
  "qualiopi.moyen.update": "Moyen pédagogique modifié",
  "qualiopi.moyen.set_actif": "Moyen pédagogique — statut actif modifié",
  "qualiopi.offre.update": "Offre modifiée",
  "qualiopi.offre.toggle_actif": "Offre — statut actif modifié",
  "qualiopi.offre.verify_coherence": "Offre — cohérence vérifiée",
  "qualiopi.partenariat.create": "Partenariat créé",
  "qualiopi.partenariat.update": "Partenariat modifié",
  "qualiopi.config.set": "Configuration Qualiopi modifiée",
  "qualiopi.reference_data.reseed": "Données de référence rechargées",
};

const VERBES_ACTION: Record<string, string> = {
  create: "Création",
  created: "Création",
  update: "Modification",
  updated: "Modification",
  delete: "Suppression",
  deleted: "Suppression",
  archive: "Archivage",
  archived: "Archivage",
  publish: "Publication",
  validate: "Validation",
  generate: "Génération",
  genere: "Génération",
  export: "Export",
  export_pdf: "Export PDF",
  export_csv: "Export CSV",
  export_zip: "Export ZIP",
  send: "Envoi",
  login: "Connexion",
  logout: "Déconnexion",
};

export function libelleAction(action: string): string {
  const exact = ACTION_LABELS[action];
  if (exact) return exact;
  const dernier = action.split(".").pop() ?? action;
  const verbe = VERBES_ACTION[dernier];
  if (verbe) return `${verbe} · ${action}`;
  return action;
}
