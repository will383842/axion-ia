/**
 * Politique de validation des emails avant envoi (audit certification 2026-07-26).
 *
 * ## Pourquoi cette couche existe
 *
 * Will veut relire les emails commerciaux avant qu'ils ne partent — une relance
 * d'impayé mal calibrée coûte un client. Mais retenir TOUS les emails aurait un
 * effet de bord grave : la chaîne Qualiopi est automatique par conception
 * (convocation, rappel J-7, satisfaction J+1, suivi J+30, attestation). La
 * suspendre à une validation humaine expose un stagiaire à ne jamais recevoir sa
 * convocation — et les indicateurs 4, 9, 11, 30 et 32 reposent dessus.
 *
 * D'où la règle par défaut : **commercial → validation, Qualiopi → automatique**,
 * modifiable dans les deux sens, globalement ou par client.
 *
 * Logique PURE — aucun accès Prisma ici. La résolution en base vit dans
 * `outbox-service.ts`, ce qui rend cette politique testable sans infrastructure.
 */

/**
 * Emails soumis à validation par défaut : ceux qui engagent la relation
 * commerciale ou l'argent.
 *
 * 🔴 Audit certification 2026-07-26 (contre-vérification). Cette liste portait
 * « devis-envoye » et « facture-envoyee » ; les vrais noms de jobs sont
 * « devis-envoi » et « facture-envoi ». Deux caractères — et la corbeille ne
 * pouvait littéralement JAMAIS se remplir pour les deux envois qu'elle existe
 * pour faire relire. Une liste explicite protège d'un motif trop large ; elle
 * ne protège pas d'une faute de frappe. D'où le test qui suit, qui confronte
 * désormais chaque entrée à l'union `EmailJobName`.
 *
 * ⚠️ Liste volontairement EXPLICITE plutôt qu'un motif sur le nom. Un template
 * ajouté demain doit être classé sciemment : le défaut silencieux serait soit de
 * bloquer une convocation, soit de laisser partir une relance non relue.
 */
export const EMAILS_A_VALIDER_PAR_DEFAUT: readonly string[] = [
  // 🔴 2026-08-02 — `qualiopi-relance-impayee` a été RETIRÉ de cette liste, et
  // ce n'est pas un relâchement du contrôle : c'est un DÉPLACEMENT du contrôle.
  //
  // La validation d'une relance a désormais lieu EN AMONT, dans la boîte de
  // dialogue du hub facturation : l'admin y voit le reste dû net, l'échéance, le
  // palier, la fraîcheur de son pointage bancaire, et doit cocher « j'ai vérifié
  // mon relevé : ce règlement n'a pas été reçu » avant que le bouton d'envoi ne
  // s'active. C'est une double validation, plus stricte que la relecture en
  // corbeille — laquelle ne montrait ni le solde réel ni l'état du pointage.
  //
  // Le garer une seconde fois après cette confirmation avait un effet pervers
  // mesuré : l'e-mail ne partait jamais, la relance était pourtant marquée
  // `envoyee`, et l'impayé vieillissait derrière un statut rassurant.
  //
  // ⚠️ NE PAS remettre ce template ici sans supprimer la confirmation en amont :
  // deux garages successifs sur un même envoi, c'est un envoi qui n'a pas lieu.
  "devis-envoi",
  "convention-envoi",
  "facture-envoi",
  "contract-sent",
  "contract-reminder",
] as const;

/**
 * Emails qui partent TOUJOURS seuls par défaut, parce qu'un retard leur retire
 * leur raison d'être ou casse une obligation Qualiopi.
 */
export const EMAILS_AUTOMATIQUES_PAR_DEFAUT: readonly string[] = [
  "qualiopi-convocation",
  "qualiopi-rappel-j7",
  "qualiopi-satisfaction-j1",
  "qualiopi-suivi-j30",
  // Un positionnement retenu en validation manque la formation qu'il devait
  // préparer : il n'a de valeur qu'AVANT, donc il part seul.
  "qualiopi-positionnement",
  "qualiopi-questionnaire-relance",
  "qualiopi-enquete-entreprise",
  "qualiopi-attestation-disponible",
  "qualiopi-portail-acces",
  "qualiopi-alerte-interne",
] as const;

/**
 * 🔴 CES IDENTIFIANTS S'AFFICHAIENT TELS QUELS, à trois endroits : le menu
 * « Nature d'email » des réglages, la liste des règles enregistrées, et la
 * phrase d'explication de la page — en monospace, comme pour assumer. Deux
 * d'entre eux sont même en anglais (`contract-sent`, `contract-reminder`).
 *
 * Les libellés vivent ici, avec les listes qu'ils décrivent : un template
 * ajouté plus haut sans libellé se verra à l'écran entre guillemets plutôt
 * que de passer pour un nom de code assumé.
 */
export const LIBELLE_TEMPLATE_EMAIL: Record<string, string> = {
  "devis-envoi": "Envoi d'un devis",
  "convention-envoi": "Envoi d'une convention",
  "facture-envoi": "Envoi d'une facture",
  "contract-sent": "Envoi d'un contrat à signer",
  "contract-reminder": "Relance de signature d'un contrat",
  "qualiopi-convocation": "Convocation à une session",
  "qualiopi-rappel-j7": "Rappel à J-7",
  "qualiopi-satisfaction-j1": "Questionnaire de satisfaction (J+1)",
  "qualiopi-suivi-j30": "Suivi à J+30",
  "qualiopi-positionnement": "Questionnaire de positionnement (avant la formation)",
  "qualiopi-questionnaire-relance": "Relance de questionnaire sans réponse",
  "qualiopi-enquete-entreprise": "Enquête de satisfaction entreprise",
  "qualiopi-attestation-disponible": "Attestation disponible",
  "qualiopi-portail-acces": "Accès au portail",
  "qualiopi-alerte-interne": "Alerte interne",
  "qualiopi-relance-impayee": "Relance d'impayé",
};

export function libelleTemplateEmail(template: string | null): string {
  if (template === null || template === "") return "Sans nature";
  return LIBELLE_TEMPLATE_EMAIL[template] ?? `« ${template} »`;
}

export type ModeEnvoi = "auto" | "validation";

/** Règle telle que lue en base, réduite à ce qui sert à la résolution. */
export interface RegleAutomatisation {
  scope: "global" | "client";
  /** `null` = la règle vaut pour toutes les natures d'email de cette portée. */
  template: string | null;
  mode: ModeEnvoi;
}

/**
 * Mode d'envoi retenu pour un email donné.
 *
 * Résolution du PLUS SPÉCIFIQUE au plus général :
 *   1. client + template exact
 *   2. client + tous templates
 *   3. global + template exact
 *   4. global + tous templates
 *   5. défaut par nature d'email
 *
 * `regles` ne doit contenir que des règles applicables au destinataire : c'est
 * à l'appelant de filtrer sur le bon `clientId`. Mélanger les clients ici
 * produirait une résolution silencieusement fausse.
 *
 * 🔴 Audit du 2026-08-16 — LA GARDE QUALIOPI N'EXISTAIT PAS.
 *
 * L'en-tête de ce fichier pose depuis le premier jour la règle fondatrice :
 * « commercial → validation, Qualiopi → automatique », au motif que retenir une
 * convocation exposerait un stagiaire à ne jamais la recevoir. Seule la
 * première moitié était appliquée. `EMAILS_AUTOMATIQUES_PAR_DEFAUT` et
 * `estEmailQualiopiAutomatique()` étaient exportés et testés, mais n'avaient
 * AUCUN appelant en production : la liste ne servait qu'à peupler le menu
 * déroulant de la page de réglages.
 *
 * Conséquence mesurée à la lecture : une seule règle enregistrée depuis la
 * console — portée `global`, nature « toutes », mode `validation` — garait
 * l'intégralité de la chaîne réglementaire. Convocations, rappels J-7,
 * satisfaction J+1, suivi J+30, attestations, alertes internes.
 *
 * La garde ci-dessous ne supprime pas la liberté de réglage, elle en retire
 * l'angle mort : une règle qui NOMME `qualiopi-convocation` reste souveraine
 * (on peut vouloir relire une convocation précise, c'est un choix conscient) ;
 * une règle attrape-tout ne peut plus emporter la chaîne réglementaire au
 * passage, parce que personne ne l'a jamais voulu explicitement.
 */
export function resoudreModeEnvoi(
  template: string,
  regles: readonly RegleAutomatisation[],
): ModeEnvoi {
  const trouve = (scope: "global" | "client", exact: boolean): ModeEnvoi | null => {
    const r = regles.find(
      (x) => x.scope === scope && (exact ? x.template === template : x.template === null),
    );
    return r ? r.mode : null;
  };

  // ⚠️ L'ORDRE des quatre niveaux est celui documenté ci-dessus et ne change
  // pas : le passage en boucle sert uniquement à distinguer, à chaque niveau,
  // une règle qui NOMME le template d'une règle attrape-tout. Résoudre par une
  // cascade de `??` obligerait à réordonner, et une règle client générale
  // cesserait de primer sur une règle globale nominative.
  const niveaux = [
    { mode: trouve("client", true), attrapeTout: false },
    { mode: trouve("client", false), attrapeTout: true },
    { mode: trouve("global", true), attrapeTout: false },
    { mode: trouve("global", false), attrapeTout: true },
  ];

  for (const niveau of niveaux) {
    if (niveau.mode === null) continue;
    // La garde : une règle qui ne nomme pas le template ne peut pas retenir un
    // envoi dont le retard casse une obligation réglementaire.
    if (
      niveau.attrapeTout &&
      niveau.mode === "validation" &&
      estEmailQualiopiAutomatique(template)
    ) {
      return "auto";
    }
    return niveau.mode;
  }

  return modeParDefaut(template);
}

/**
 * Mode retenu quand aucune règle ne s'applique.
 *
 * Un template inconnu des deux listes part en `auto` : c'est le comportement
 * historique, et le préserver évite qu'un email transactionnel existant se
 * retrouve bloqué sans que personne ne l'ait décidé.
 */
export function modeParDefaut(template: string): ModeEnvoi {
  if (EMAILS_A_VALIDER_PAR_DEFAUT.includes(template)) return "validation";
  return "auto";
}

/** Vrai si ce template relève de la chaîne Qualiopi automatique. */
export function estEmailQualiopiAutomatique(template: string): boolean {
  return EMAILS_AUTOMATIQUES_PAR_DEFAUT.includes(template);
}
