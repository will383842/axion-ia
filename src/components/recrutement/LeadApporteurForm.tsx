"use client";
// use-client: état du formulaire, validation à la volée, soumission async, brouillon localStorage — intrinsèquement client.
//
// Formulaire COURT du tunnel Facebook — quatre champs, une action.
//
// ── Pourquoi QUATRE et pas cinq (2026-09-03) ────────────────────────────────
// Il portait en plus « Ta situation aujourd'hui » : cinq puces, facultatives.
// Mesuré sur iPhone : 11 éléments interactifs, 957 px de haut. Or le DOSSIER
// COMPLET pose déjà exactement cette question (`STATUT_OPTIONS`, écran 9 du
// wizard). On la demandait donc deux fois, la première fois à quelqu'un qui
// n'a encore rien demandé — et c'était le plus gros bloc du formulaire.
// Retirée : la donnée n'est pas perdue, elle arrive au dossier.
//
// ── Ce qu'il fait au succès, dans l'ordre ───────────────────────────────────
//  1. pose le BROUILLON du wizard (`saveDraft`) avec prénom, e-mail, téléphone,
//     ville, statut et la source « facebook » : quand la personne ouvrira le
//     dossier complet depuis l'e-mail, ses coordonnées seront déjà là — et la
//     candidature complète sera attribuée à Facebook sans qu'on le lui demande.
//     Aucune donnée personnelle ne transite dans une URL.
//  2. envoie l'événement Plausible « Lead Apporteur Submitted » (sans cookie,
//     sans consentement) ;
//  3. navigue vers `/apporteur-affaires/merci?c=<id>` — la page qui tire l'événement
//     `Lead` du pixel Meta avec cet identifiant, dédoublonné avec l'envoi
//     serveur fait par l'action.
//
// ── Contexte d'attribution posté avec le formulaire ─────────────────────────
// `location.search` (utm_* et fbclid), le cookie `_fbp` s'il existe (donc
// seulement si le pixel a été accepté), et la réponse à la bannière. Le
// serveur ne lit ce bloc que pour l'attribution ; il ne décide de rien avec.
//
// Mobile d'abord : champs de 52 px, texte 16 px (sinon iOS zoome), bouton
// pleine largeur, `autoComplete` sur chaque champ pour que le téléphone
// remplisse tout seul.

import * as React from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { submitLeadApporteurAction } from "@/features/commercial-application/lead-actions";
import { trackFunnel } from "@/lib/tracking";
import { isStaleServerActionError } from "@/lib/forms/form-errors";
import { lireCookieFbp } from "@/lib/analytics/meta-pixel";
import { readAnalyticsConsent } from "@/components/analytics/CookieConsent";
import { HoneypotField } from "@/components/forms/HoneypotField";
import {
  LEAD_APPORTEUR_SOURCE,
  TUNNEL_FACEBOOK_MERCI_PATH,
  type LeadApporteurInput,
} from "@/lib/commercial-application/lead-apporteur";
import { emptyAnswers, saveDraft } from "@/components/forms/commercial-application/wizard-state";
import { PrimaryButton, TextField } from "@/components/forms/commercial-application/ui";
import { FORMULAIRE } from "@/content/recrutement/tunnel-facebook";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";

interface Champs {
  prenom: string;
  telephone: string;
  email: string;
  ville: string;
  consent: boolean;
}

type Erreurs = Partial<Record<keyof Champs, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEPHONE_RE = /^\+?[\d\s().-]{6,}$/;

function valider(c: Champs): Erreurs {
  const e: Erreurs = {};
  if (!c.prenom.trim()) e.prenom = "Ton prénom, pour qu'on sache qui appeler.";
  if (!c.telephone.trim()) e.telephone = "Ton numéro, c'est lui qu'on appelle.";
  else if (!TELEPHONE_RE.test(c.telephone.trim()))
    e.telephone = "Ce numéro ne ressemble pas à un téléphone.";
  if (!c.email.trim()) e.email = "Ton e-mail, pour t'envoyer le lien du dossier.";
  else if (!EMAIL_RE.test(c.email.trim())) e.email = "Cet e-mail ne ressemble pas à une adresse.";
  if (!c.ville.trim()) e.ville = "Ta ville, pour savoir où tu es.";
  if (!c.consent) e.consent = "Coche la case pour qu'on puisse te rappeler.";
  return e;
}

export function LeadApporteurForm() {
  const locale = useLocale();
  const router = useRouter();
  const [c, setC] = React.useState<Champs>({
    prenom: "",
    telephone: "",
    email: "",
    ville: "",
    consent: false,
  });
  const [erreurs, setErreurs] = React.useState<Erreurs>({});
  const [envoi, setEnvoi] = React.useState(false);
  const [erreurServeur, setErreurServeur] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  /**
   * Écrit la saisie, et EFFACE l'erreur d'un champ dès qu'elle est réparée.
   *
   * Sans cela, le message rouge posé au blur restait sous les yeux pendant toute
   * la correction : on tape la bonne valeur et on lit encore « ce numéro ne
   * ressemble pas à un téléphone ». On n'AJOUTE jamais d'erreur ici — corriger
   * en direct ne doit pas gronder quelqu'un au deuxième caractère.
   */
  const set = (patch: Partial<Champs>) => {
    const suivant = { ...c, ...patch };
    setC(suivant);
    setErreurs((e) => {
      const tous = valider(suivant);
      let modifie = false;
      const n = { ...e };
      for (const cle of Object.keys(patch) as (keyof Champs)[]) {
        if (n[cle] && !tous[cle]) {
          delete n[cle];
          modifie = true;
        }
      }
      return modifie ? n : e;
    });
  };

  /**
   * Validation À LA VOLÉE, au blur d'un champ et de lui seul.
   *
   * Tout valider au seul envoi fait découvrir quatre erreurs d'un coup, en bas
   * de page, après un clic — c'est le moment où l'on abandonne. Ici chaque champ
   * se signale en le quittant, et rien ne s'affiche sur les champs pas encore
   * touchés.
   */
  const validerAuBlur = (cle: keyof Champs) => {
    const tous = valider(c);
    setErreurs((e) => {
      const n = { ...e };
      if (tous[cle]) n[cle] = tous[cle];
      else delete n[cle];
      return n;
    });
  };

  const onSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (envoi) return;
    const e = valider(c);
    setErreurs(e);
    if (Object.keys(e).length > 0) {
      const premier = Object.keys(e)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${premier}"], #lead-${premier}`)?.focus();
      return;
    }
    setEnvoi(true);
    setErreurServeur(null);

    const payload: LeadApporteurInput = {
      prenom: c.prenom.trim(),
      email: c.email.trim(),
      telephone: c.telephone.trim(),
      ville: c.ville.trim(),
      consent: true,
      contexte: {
        query: window.location.search.slice(0, 2000),
        ...(lireCookieFbp() ? { fbp: lireCookieFbp() } : {}),
        consentPub: readAnalyticsConsent(),
        ...(document.referrer ? { referrer: document.referrer.slice(0, 300) } : {}),
      },
    };

    const fd = new FormData(formRef.current ?? undefined);
    fd.set("payload", JSON.stringify(payload));
    fd.set("locale", locale);

    try {
      const result = await submitLeadApporteurAction({ ok: false, error: "" }, fd);
      if (!result.ok) {
        setErreurServeur(result.error);
        setEnvoi(false);
        return;
      }
      // Brouillon du dossier complet : coordonnées + source, jamais dans l'URL.
      saveDraft(0, {
        ...emptyAnswers(),
        prenom: payload.prenom,
        email: payload.email,
        telephone: payload.telephone,
        ville: payload.ville,
        sourceConnaissance: LEAD_APPORTEUR_SOURCE,
      });
      trackFunnel("Lead Apporteur Submitted", { landing: "facebook" });
      router.push(
        `${TUNNEL_FACEBOOK_MERCI_PATH}?c=${encodeURIComponent(result.submissionId)}` as never,
      );
    } catch (err) {
      setErreurServeur(
        isStaleServerActionError(err)
          ? "Le site vient d'être mis à jour. Recharge la page et renvoie le formulaire."
          : "Une erreur est survenue. Réessaie ou écris-nous à contact@axion-ia.com.",
      );
      setEnvoi(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="mt-6"
      aria-describedby="lead-micro"
    >
      <HoneypotField />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Prénom"
          fieldId="lead-prenom"
          name="prenom"
          requiredField
          value={c.prenom}
          onChange={(e) => set({ prenom: e.target.value })}
          onBlur={() => validerAuBlur("prenom")}
          autoComplete="given-name"
          maxLength={60}
          error={erreurs.prenom}
        />
        <TextField
          label="Téléphone"
          fieldId="lead-telephone"
          name="telephone"
          type="tel"
          inputMode="tel"
          requiredField
          value={c.telephone}
          onChange={(e) => set({ telephone: e.target.value })}
          onBlur={() => validerAuBlur("telephone")}
          autoComplete="tel"
          maxLength={40}
          error={erreurs.telephone}
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField
          label="E-mail"
          fieldId="lead-email"
          name="email"
          type="email"
          inputMode="email"
          requiredField
          value={c.email}
          onChange={(e) => set({ email: e.target.value })}
          onBlur={() => validerAuBlur("email")}
          autoComplete="email"
          maxLength={180}
          error={erreurs.email}
        />
        <TextField
          label="Ville"
          fieldId="lead-ville"
          name="ville"
          requiredField
          value={c.ville}
          onChange={(e) => set({ ville: e.target.value })}
          onBlur={() => validerAuBlur("ville")}
          autoComplete="address-level2"
          // Dernier champ : ici Entrée ENVOIE vraiment (soumission implicite du
          // formulaire). Le défaut « next » de `TextField` est calibré pour le
          // wizard, où Entrée ne soumet rien — l'y laisser promettrait un écran
          // suivant qui n'existe pas.
          enterKeyHint="send"
          maxLength={120}
          error={erreurs.ville}
        />
      </div>

      <div className="mt-5">
        <label className="flex cursor-pointer gap-3">
          <input
            type="checkbox"
            name="consent"
            checked={c.consent}
            onChange={(e) => set({ consent: e.target.checked })}
            aria-invalid={erreurs.consent ? true : undefined}
            aria-describedby={erreurs.consent ? "lead-consent-error" : undefined}
            className="accent-terracotta mt-1 h-5 w-5 shrink-0"
          />
          <span className="text-fg-soft text-sm leading-relaxed">
            {FORMULAIRE.consent}{" "}
            <Link
              href={ROUTES.privacy as never}
              className="text-terracotta-deep underline underline-offset-2"
            >
              Politique de confidentialité
            </Link>
          </span>
        </label>
        {erreurs.consent ? (
          <p id="lead-consent-error" className="text-terracotta-deep mt-1.5 text-sm" role="alert">
            {erreurs.consent}
          </p>
        ) : null}
      </div>

      {erreurServeur ? (
        <p role="alert" className="text-terracotta-deep mt-4 text-sm font-medium">
          {erreurServeur}
        </p>
      ) : null}

      <PrimaryButton
        type="submit"
        disabled={envoi}
        className="mt-6"
        data-cta="facebook-lead-submit"
      >
        {envoi ? "Envoi…" : `${FORMULAIRE.bouton} →`}
      </PrimaryButton>
      <p id="lead-micro" className="text-fg-muted mt-3 text-center text-sm">
        {FORMULAIRE.micro}
      </p>
    </form>
  );
}
