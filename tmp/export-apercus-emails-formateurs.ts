/**
 * Script ponctuel — exporte l'aperçu rendu de tous les e-mails aux formateurs freelance
 * (ceux que contrôle `textes_valides`) vers `tmp/apercus-emails-formateurs.json`.
 *
 * Même rendu que l'écran console « Gabarits d'e-mail » : `renderEmailTemplate` avec
 * `PAYLOAD_EXEMPLE` (+ `VARIANTES_EXEMPLE`). Données fictives uniquement.
 * Lancer : pnpm dlx tsx tmp/export-apercus-emails-formateurs.ts
 */
process.env.DATABASE_URL = "postgresql://stub:stub@stub.invalid:5432/stub";
process.env.REDIS_URL = "redis://stub.invalid:6379";
process.env.SKIP_ENV_VALIDATION = "true";
process.env.NEXT_PUBLIC_SITE_URL ??= "https://axion-ia.com";
process.env.BULLMQ_DISABLED = "true";

import { writeFileSync } from "node:fs";
import { join } from "node:path";

interface Meta {
  readonly interrupteur: string;
  readonly bloc: number;
}
const f = (c: string) => `formateurs.${c}`;
// Interrupteur déclencheur + bloc (docs/formateurs/ordre-d-allumage.md), lus dans le code des envois.
const META: Record<string, Meta> = {
  "candidature-recue": { interrupteur: `${f("formulaire_freelance")} + ${f("textes_valides")}`, bloc: 1 },
  "formateur-invitation-echange": { interrupteur: f("invitation_auto"), bloc: 1 },
  "formateur-invitation-relance": { interrupteur: f("invitation_auto"), bloc: 1 },
  "formateur-invitation-rattrapage": { interrupteur: f("invitation_auto"), bloc: 1 },
  "formateur-echange-confirme": { interrupteur: f("suivi_echange"), bloc: 1 },
  "formateur-echange-rappel": { interrupteur: f("suivi_echange"), bloc: 1 },
  "formateur-issue-retenu": { interrupteur: `${f("suivi_echange")} + ${f("dossier_en_ligne")}`, bloc: 1 },
  "formateur-issue-non-retenu": { interrupteur: f("suivi_echange"), bloc: 1 },
  "formateur-issue-absent": { interrupteur: f("suivi_echange"), bloc: 1 },
  "formateur-dossier-lien": { interrupteur: f("dossier_en_ligne"), bloc: 2 },
  "formateur-dossier-relance": { interrupteur: f("relances_auto"), bloc: 2 },
  "formateur-dossier-recu": { interrupteur: f("dossier_en_ligne"), bloc: 2 },
  "formateur-dossier-a-verifier": { interrupteur: f("dossier_en_ligne"), bloc: 2 },
  "formateur-dossier-a-completer": { interrupteur: f("dossier_en_ligne"), bloc: 2 },
  "formateur-dossier-refuse": { interrupteur: f("dossier_en_ligne"), bloc: 2 },
  "formateur-lien-espace": { interrupteur: f("dossier_en_ligne"), bloc: 2 },
  "formateur-statut-non-ouvert": { interrupteur: f("dossier_en_ligne"), bloc: 2 },
  "formateur-vigilance": { interrupteur: f("pieces_cron"), bloc: 2 },
  "formateur-piece-a-renouveler": { interrupteur: f("pieces_cron"), bloc: 2 },
  "formateur-piece-deposee": { interrupteur: f("dossier_en_ligne"), bloc: 2 },
  "formateur-dossier-a-jour": { interrupteur: f("pieces_cron"), bloc: 2 },
  "formateur-contrat-a-signer": { interrupteur: f("contrat_cadre_emission"), bloc: 3 },
  "formateur-code-signature": { interrupteur: f("contrat_cadre_emission"), bloc: 3 },
  "formateur-contrat-relance": { interrupteur: f("relances_auto"), bloc: 3 },
  "formateur-espace-ouvert": { interrupteur: f("suite_contrat_cadre"), bloc: 3 },
  "formateur-nda-a-transmettre": { interrupteur: f("relances_auto"), bloc: 3 },
  "formateur-contrat-nouvelle-version": { interrupteur: f("nouvelle_version_contrat"), bloc: 3 },
  "formateur-mission-proposee": { interrupteur: f("choix_cartes"), bloc: 4 },
  "formateur-proposition-close": { interrupteur: f("lettre_auto"), bloc: 4 },
  "formateur-accord-enregistre": { interrupteur: f("lettre_auto"), bloc: 4 },
  "formateur-lettre-a-signer": { interrupteur: f("lettre_auto"), bloc: 4 },
  "formateur-lettre-relance": { interrupteur: `${f("lettre_auto")} + ${f("relances_auto")}`, bloc: 4 },
  "formateur-lettre-copie-signature": { interrupteur: "signature.copie_partielle", bloc: 4 },
  "formateur-lettre-rectifiee": { interrupteur: f("lettre_auto"), bloc: 4 },
  "formateur-mission-retiree": { interrupteur: f("affectation_sure"), bloc: 4 },
  "formateur-formation-annulee": { interrupteur: f("affectation_sure"), bloc: 4 },
  "formateur-mission-en-attente": { interrupteur: f("lettre_auto"), bloc: 4 },
  "formateur-desistement-recu": { interrupteur: f("rang_suivant"), bloc: 4 },
  "formateur-fin-autofacturation": { interrupteur: f("fin_collaboration"), bloc: 4 },
  "formateur-fin-collaboration": { interrupteur: f("fin_collaboration"), bloc: 4 },
  "formateur-avertissement": { interrupteur: f("fin_collaboration"), bloc: 4 },
  "formateur-presentation-methode": { interrupteur: f("presentation_payee"), bloc: 5 },
  "formateur-feuilles-manquantes": { interrupteur: f("passage_paiement"), bloc: 5 },
  "formateur-bilan-fin-formation": { interrupteur: f("bilan_fin_formation"), bloc: 5 },
  "formateur-virement-fait": { interrupteur: f("passage_paiement"), bloc: 5 },
  "formateur-virement-en-attente": { interrupteur: f("passage_paiement"), bloc: 5 },
  "formateur-facture-rectifiee": { interrupteur: f("passage_paiement"), bloc: 5 },
  "formateur-trop-percu": { interrupteur: f("passage_paiement"), bloc: 5 },
  "formateur-facture-deposee": { interrupteur: f("passage_paiement"), bloc: 5 },
  "formateur-desaccord-recu": { interrupteur: f("passage_paiement"), bloc: 5 },
  "formateur-desaccord-non-retenu": { interrupteur: f("passage_paiement"), bloc: 5 },
  "formateur-iban-changement": { interrupteur: f("changement_coordonnees"), bloc: 5 },
  "formateur-iban-valide": { interrupteur: f("changement_coordonnees"), bloc: 5 },
};
// Aucun interrupteur propre repéré dans le code : seul `textes_valides` (bloc 0) les commande.
const SANS_INTERRUPTEUR_PROPRE: Meta = { interrupteur: f("textes_valides"), bloc: 0 };

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\+/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

interface Entree {
  cle: string;
  nom: string;
  destinataire_et_moment: string;
  interrupteur: string;
  bloc: number;
  envoi: "automatique" | "après aperçu humain";
  objet: string;
  html: string;
  texte: string | null;
  etat_validation_actuel: null;
}

async function main(): Promise<void> {
  const { renderEmailTemplate } = await import("@/lib/email/templates");
  const { PAYLOAD_EXEMPLE, VARIANTES_EXEMPLE } = await import("@/server/email/apercu/payloads-exemple");
  const { TEXTES_FORMATEUR } = await import("@/lib/email/templates/formateur-independant-textes");
  const { VARIANTES_VALIDEES_A_PART } = await import("@/server/email/textes-formateurs-a-valider");
  type G = keyof typeof TEXTES_FORMATEUR;

  const brut: Array<Entree & { _code: string; _gabarit: string }> = [];
  const rendre = async (gabarit: string, extra: Record<string, unknown>) => {
    const r = await renderEmailTemplate(gabarit as never, "fr", { ...PAYLOAD_EXEMPLE, ...extra });
    return { subject: r.subject, html: r.html, text: r.text as string | undefined };
  };
  const envoiDe = (quand: string, apresApercuForce = false) =>
    apresApercuForce || /aperçu/i.test(quand) ? ("après aperçu humain" as const) : ("automatique" as const);

  // F0 — accusé « mission » (gabarit `candidature-recue`, variante `mission`).
  {
    const r = await rendre("candidature-recue", { mission: true });
    const m = META["candidature-recue"]!;
    brut.push({
      _code: "F0",
      _gabarit: "candidature-recue",
      cle: "F0",
      nom: "F0 — Accusé de candidature (variante « mission »)",
      destinataire_et_moment:
        "Au candidat formateur indépendant, juste après le dépôt de sa candidature.",
      ...m,
      envoi: "automatique",
      objet: r.subject,
      html: r.html,
      texte: r.text ?? null,
      etat_validation_actuel: null,
    });
  }

  for (const [gabarit, fiche] of Object.entries(TEXTES_FORMATEUR) as Array<[G, (typeof TEXTES_FORMATEUR)[G]]>) {
    const aPart = (VARIANTES_VALIDEES_A_PART[gabarit] ?? {}) as Record<number, string>;
    const m = META[gabarit] ?? SANS_INTERRUPTEUR_PROPRE;
    const qui = fiche.interne
      ? "À Will seul (message interne)"
      : m.bloc === 1
        ? "Au candidat formateur"
        : "Au formateur indépendant";
    const quand = fiche.quand.replace(/^./, (c) => c.toLowerCase());
    const total = fiche.variantes.length;
    for (let i = 0; i < total; i++) {
      const etape = i + 1;
      const v = fiche.variantes[i]!;
      const variante = aPart[etape];
      const extra: Record<string, unknown> = total > 1 ? { etape } : {};
      let cle = fiche.code;
      let nom = `${fiche.code} — ${fiche.titre}`;
      if (variante !== undefined) {
        Object.assign(extra, VARIANTES_EXEMPLE[gabarit]?.[variante] ?? {});
        cle += `-${variante.replace(/-seuil$/, "")}`;
        nom += ` — variante « ${variante} » (validée à part)`;
      } else if (v.etape === null && Object.keys(aPart).length > 0) {
        // Texte de base d'un gabarit dont les autres étapes sont des variantes validées à part.
      } else if (total > 1 || v.etape !== null) {
        const e = v.etape !== null ? slug(v.etape) : "envoi";
        cle += `-${e}`;
        nom += ` — ${v.etape ?? `étape ${etape}`}`;
      }
      const r = await rendre(gabarit, extra);
      brut.push({
        _code: fiche.code,
        _gabarit: gabarit,
        cle,
        nom,
        destinataire_et_moment: `${qui}, ${quand}`,
        ...m,
        envoi: envoiDe(fiche.quand, gabarit === "formateur-invitation-rattrapage"),
        objet: r.subject,
        html: r.html,
        texte: r.text ?? null,
        etat_validation_actuel: null,
      });
    }
  }

  // F23 chiffrée — seule variante de `formateur-mission-proposee` soumise à validation.
  {
    const r = await rendre("formateur-mission-proposee", VARIANTES_EXEMPLE["formateur-mission-proposee"]!.honoraires!);
    const m = META["formateur-mission-proposee"]!;
    brut.push({
      _code: "F23",
      _gabarit: "formateur-mission-proposee",
      cle: "F23-honoraires",
      nom: "F23 — Proposition de mission chiffrée (variante « honoraires », validée à part)",
      destinataire_et_moment:
        "Au formateur indépendant, quand une mission lui est proposée aux conditions figées (carte de choix) ; rappel 3 jours plus tard sans réponse.",
      ...m,
      envoi: "automatique",
      objet: r.subject,
      html: r.html,
      texte: r.text ?? null,
      etat_validation_actuel: null,
    });
  }

  // Un code partagé par deux gabarits (F61) : on suffixe le gabarit pour garder des clés uniques.
  const parCle = new Map<string, number>();
  for (const e of brut) parCle.set(e.cle, (parCle.get(e.cle) ?? 0) + 1);
  for (const e of brut) {
    const ambigue = [...brut].filter((x) => x._code === e._code && x._gabarit !== e._gabarit).length > 0;
    if (ambigue && e._gabarit === "formateur-email-modifie") {
      e.cle = `${e.cle}-email-modifie`;
    }
  }
  const doublons = [...new Set(brut.map((e) => e.cle))].length !== brut.length;
  if (doublons) throw new Error("clés dupliquées");

  const num = (c: string) => Number(/^F(\d+)/.exec(c)?.[1] ?? 0);
  brut.sort((a, b) => a.bloc - b.bloc || num(a.cle) - num(b.cle) || a.cle.localeCompare(b.cle));
  const sortie: Entree[] = brut.map(({ _code, _gabarit, ...e }) => e);
  writeFileSync(join(process.cwd(), "tmp", "apercus-emails-formateurs.json"), JSON.stringify(sortie, null, 2) + "\n");
  const sansTexte = sortie.filter((e) => !e.texte).map((e) => e.cle);
  console.log(`exportés : ${sortie.length} ; sans texte : ${sansTexte.join(", ") || "aucun"}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
