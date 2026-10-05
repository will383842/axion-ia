"use client";
// use-client: deux étapes sur la même page — état du formulaire, historique du navigateur, focus et annonces d'accessibilité, appels d'actions serveur.

// Formulaire en DEUX ÉTAPES de la page VSL apporteurs (`/apporteur-affaires/video`).
//
//   Étape 1 : prénom + e-mail + consentement  → `capturer`  (lead partiel, jeton)
//   Étape 2 : téléphone + « combien de dirigeants connaissez-vous ? » → `completer`
//   puis navigation vers la page de merci (le choix du créneau Calendly).
//
// ── Ce que cette île tient, et pourquoi ─────────────────────────────────────
//  · Les DEUX actions serveur arrivent PAR PROPS : l'île n'importe aucun
//    serveur, elle se teste avec une doublure et se livre avant la capture
//    (contrat : `lead-vsl-contrat.ts`).
//  · Pas de rechargement entre les étapes (réaction immédiate, bon pour l'INP) ;
//    `history.pushState` fait que « Retour » du téléphone ramène à l'étape 1.
//  · État en mémoire + `sessionStorage` (`vsl-etat.ts`) : un rechargement ou un
//    aller-retour ne fait pas tout resaisir. Jamais le téléphone.
//  · CLS = 0 : les deux étapes ont la MÊME hauteur minimale, la zone d'erreur du
//    serveur est réservée.
//  · Validation légère SANS zod (`vsl-validation.ts`) : le schéma fait foi côté
//    serveur, le navigateur ne fait qu'éviter un aller-retour.
//  · Accessibilité : étiquettes visibles, erreurs reliées au champ
//    (`aria-describedby`) et annoncées (`role="alert"`), focus sur le titre de
//    l'étape à chaque passage, annonce polie « étape 2 sur 2 ».
//  · Terracotta partout, jamais le bleu du bouton par défaut (`PrimaryButton`).

import * as React from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { trackFunnel } from "@/lib/tracking";
import { trackVsl } from "@/lib/analytics/vsl-apporteur-events";
import { isStaleServerActionError } from "@/lib/forms/form-errors";
import { lireCookieFbp } from "@/lib/analytics/meta-pixel";
import { readAnalyticsConsent } from "@/components/analytics/CookieConsent";
import { HoneypotField } from "@/components/forms/HoneypotField";
import {
  ChipGroup,
  Chip,
  PrimaryButton,
  TextField,
} from "@/components/forms/commercial-application/ui";
import {
  VSL_ERREURS,
  VSL_FORMULAIRE,
  VSL_MERCI_PATH,
  VSL_REPONSES,
  VSL_SLUG,
} from "@/content/recrutement/vsl-apporteur";
import type {
  CapturerLeadVslAction,
  CompleterLeadVslAction,
  ReponseNombreDirigeants,
} from "@/features/commercial-application/lead-vsl-contrat";
import {
  abonnerEtatVsl,
  type EtatVsl,
  lireEtatVsl,
  lireEtatVslServeur,
  majEtatVsl,
} from "@/lib/recrutement/vsl-etat";
import { lireFbclid } from "@/lib/recrutement/vsl-attribution";
import {
  canalDepuisQuery,
  cheminDeMerci,
  validerEtape1,
  validerEtape2,
  type ErreursEtape1,
  type ErreursEtape2,
} from "@/lib/recrutement/vsl-validation";

/** Pose ou retire l'erreur d'un champ (jamais une clé à `undefined` : `exactOptionalPropertyTypes`). */
function avecErreur<T extends Partial<Record<string, string>>>(
  anc: T,
  cle: keyof T & string,
  message: string | undefined,
): T {
  const n = { ...anc };
  if (message) (n as Record<string, string | undefined>)[cle] = message;
  else delete (n as Record<string, string | undefined>)[cle];
  return n;
}

interface VslFormulaireProps {
  /** Étape 1 — enregistre prénom + e-mail, rend un jeton. */
  capturer: CapturerLeadVslAction;
  /** Étape 2 — complète la même ligne, rend l'adresse de la page de merci. */
  completer: CompleterLeadVslAction;
}

/** Hauteur MINIMALE commune aux deux étapes : passer de l'une à l'autre ne déplace rien. */
const HAUTEUR_MIN = "min-h-[34rem] sm:min-h-[31rem]";

const BOUTON_TERRACOTTA =
  "bg-terracotta text-paper hover:bg-terracotta-deep focus-visible:ring-terracotta-deep shadow-none";

const MESSAGES_SERVEUR = {
  invalid: VSL_ERREURS.invalide,
  rate: VSL_ERREURS.rate,
  jeton: VSL_ERREURS.jeton,
  unknown: VSL_ERREURS.inconnue,
} as const;

export function VslFormulaire({ capturer, completer }: VslFormulaireProps) {
  const router = useRouter();
  const etat = React.useSyncExternalStore(abonnerEtatVsl, lireEtatVsl, lireEtatVslServeur);
  const { etape } = etat;

  const [erreurs1, setErreurs1] = React.useState<ErreursEtape1>({});
  const [erreurs2, setErreurs2] = React.useState<ErreursEtape2>({});
  const [envoi, setEnvoi] = React.useState(false);
  const [erreurServeur, setErreurServeur] = React.useState<string | null>(null);

  const formRef = React.useRef<HTMLFormElement>(null);
  const titreRef = React.useRef<HTMLHeadingElement>(null);
  const affichageDeLaPage = React.useRef(0);
  const etapeVue = React.useRef<number | null>(null);
  const focusAuChangement = React.useRef(false);

  // Heure d'affichage (base du délai minimal anti-robot côté serveur) + première
  // étape vue. Une seule fois par visite.
  React.useEffect(() => {
    affichageDeLaPage.current = Date.now();
  }, []);

  // « Étape N vue » : une fois par étape affichée.
  React.useEffect(() => {
    if (etapeVue.current === etape) return;
    etapeVue.current = etape;
    trackVsl("Lead Step Viewed", {
      landing: VSL_SLUG,
      step: String(etape),
      stepIndex: etape,
      stepTotal: 2,
    });
    // Le focus ne bouge qu'après un changement d'étape voulu, jamais à l'arrivée sur la page.
    if (focusAuChangement.current) {
      focusAuChangement.current = false;
      titreRef.current?.focus();
    }
  }, [etape]);

  // Bouton « Retour » du téléphone : l'étape 2 est une entrée d'historique.
  React.useEffect(() => {
    const surPopstate = (ev: PopStateEvent) => {
      const voulue = (ev.state as { vslEtape?: number } | null)?.vslEtape === 2 ? 2 : 1;
      if (voulue === 2 && !lireEtatVsl().jeton) return;
      if (lireEtatVsl().etape !== voulue) {
        focusAuChangement.current = true;
        majEtatVsl({ etape: voulue });
      }
    };
    window.addEventListener("popstate", surPopstate);
    return () => window.removeEventListener("popstate", surPopstate);
  }, []);

  const allerEtape2 = () => {
    focusAuChangement.current = true;
    try {
      window.history.pushState({ vslEtape: 2 }, "");
    } catch {
      // Historique indisponible : on passe quand même à l'étape 2.
    }
    majEtatVsl({ etape: 2 });
  };

  const retourEtape1 = () => {
    setErreurServeur(null);
    if ((window.history.state as { vslEtape?: number } | null)?.vslEtape === 2) {
      window.history.back(); // `popstate` ramène à l'étape 1
    } else {
      focusAuChangement.current = true;
      majEtatVsl({ etape: 1 });
    }
  };

  const messageServeur = (code: keyof typeof MESSAGES_SERVEUR) => MESSAGES_SERVEUR[code];
  const erreurReseau = (err: unknown) =>
    isStaleServerActionError(err) ? VSL_ERREURS.perime : VSL_ERREURS.inconnue;

  // ── Étape 1 ────────────────────────────────────────────────────────────────
  const envoyerEtape1 = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (envoi) return;
    const e = validerEtape1(etat);
    setErreurs1(e);
    const premier = (["prenom", "email", "consent"] as const).find((k) => e[k]);
    if (premier) {
      formRef.current?.querySelector<HTMLElement>(`#vsl-${premier}`)?.focus();
      return;
    }
    setErreurServeur(null);

    // Jeton déjà reçu et identité inchangée (`set` efface le jeton dès qu'on la
    // modifie) : on retourne à l'étape 2 sans nouvel appel au serveur.
    if (etat.jeton) {
      allerEtape2();
      return;
    }

    setEnvoi(true);
    const fbclid = lireFbclid();
    const fbp = lireCookieFbp();
    const honeypot = new FormData(formRef.current ?? undefined).get("website");
    try {
      const r = await capturer({
        prenom: etat.prenom.trim(),
        email: etat.email.trim(),
        consent: true,
        consentPub: readAnalyticsConsent() === "accepted",
        ...(typeof honeypot === "string" && honeypot ? { honeypot } : {}),
        ctx: {
          query: window.location.search.slice(0, 2000),
          ...(fbp ? { fbp } : {}),
          ...(document.referrer ? { referrer: document.referrer.slice(0, 300) } : {}),
          ...(fbclid ? { fbclid: fbclid.fbclid, fbclidAt: fbclid.at } : {}),
          renderedAt: affichageDeLaPage.current || Date.now(),
        },
      });
      if (!r.ok) {
        setErreurServeur(messageServeur(r.error));
        setEnvoi(false);
        return;
      }
      majEtatVsl({ jeton: r.jeton, leadId: r.leadId });
      trackVsl("Lead Email Captured", { landing: canalDepuisQuery(window.location.search) });
      setEnvoi(false);
      allerEtape2();
    } catch (err) {
      setErreurServeur(erreurReseau(err));
      setEnvoi(false);
    }
  };

  // ── Étape 2 ────────────────────────────────────────────────────────────────
  const envoyerEtape2 = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (envoi) return;
    const e = validerEtape2(etat);
    setErreurs2(e);
    if (e.telephone) {
      formRef.current?.querySelector<HTMLElement>("#vsl-telephone")?.focus();
      return;
    }
    if (e.reponse) {
      formRef.current?.querySelector<HTMLElement>('input[name="reponse"]')?.focus();
      return;
    }
    setErreurServeur(null);
    setEnvoi(true);
    try {
      const r = await completer({
        jeton: etat.jeton,
        telephone: etat.telephone.trim(),
        reponseId: etat.reponse as ReponseNombreDirigeants,
        // Le consentement donné à l'étape 1 (case cochée), rappelé au serveur.
        consent: etat.consent,
      });
      if (!r.ok) {
        // Jeton périmé : on ramène à l'étape 1 pour la refaire (très rapide).
        if (r.error === "jeton") majEtatVsl({ jeton: "", leadId: "", etape: 1 });
        setErreurServeur(messageServeur(r.error));
        setEnvoi(false);
        return;
      }
      // Même nom d'événement que l'ancienne page : l'historique reste comparable.
      trackFunnel("Lead Apporteur Submitted", {
        landing: canalDepuisQuery(window.location.search),
      });
      router.push(cheminDeMerci(r.merciUrl, VSL_MERCI_PATH, window.location.origin) as never);
    } catch (err) {
      setErreurServeur(erreurReseau(err));
      setEnvoi(false);
    }
  };

  const f1 = VSL_FORMULAIRE.etape1;
  const f2 = VSL_FORMULAIRE.etape2;

  const set = (patch: Partial<Pick<EtatVsl, "prenom" | "email" | "consent">>) => {
    // Modifier l'identité après la capture invalide le jeton : l'étape 1 sera renvoyée.
    const identiteChange = "prenom" in patch || "email" in patch;
    majEtatVsl(identiteChange ? { ...patch, jeton: "", leadId: "" } : patch);
    // Efface l'erreur d'un champ dès qu'il est réparé ; n'en AJOUTE jamais en direct.
    const suivant = validerEtape1({ ...etat, ...patch });
    setErreurs1((anc) => {
      const n = { ...anc };
      for (const cle of Object.keys(patch) as (keyof ErreursEtape1)[]) {
        if (n[cle] && !suivant[cle]) delete n[cle];
      }
      return n;
    });
  };

  const validerAuBlur1 = (cle: "prenom" | "email") => {
    const e = validerEtape1(etat);
    setErreurs1((anc) => avecErreur(anc, cle, e[cle]));
  };

  return (
    <div id="vsl-formulaire" className={HAUTEUR_MIN}>
      {/* Annonce polie à chaque changement d'étape (lecteurs d'écran). */}
      <p role="status" aria-live="polite" className="sr-only">
        {VSL_FORMULAIRE.annonceEtape(etape)}
      </p>

      {etape === 1 ? (
        <form ref={formRef} onSubmit={envoyerEtape1} noValidate aria-labelledby="vsl-titre-etape">
          <HoneypotField />
          <p className="text-terracotta-deep text-[12px] font-semibold tracking-[0.16em] uppercase">
            {f1.eyebrow}
          </p>
          <h3
            id="vsl-titre-etape"
            ref={titreRef}
            tabIndex={-1}
            className="text-fg mt-2 font-serif text-2xl leading-tight font-semibold outline-none"
          >
            {f1.titre}{" "}
            <span className="text-fg-muted font-sans text-base font-normal">· {f1.micro}</span>
          </h3>

          <div className="mt-5 grid gap-4">
            <div>
              <TextField
                label={f1.prenom}
                fieldId="vsl-prenom"
                name="prenom"
                requiredField
                value={etat.prenom}
                onChange={(e) => set({ prenom: e.target.value })}
                onBlur={() => validerAuBlur1("prenom")}
                autoComplete="given-name"
                maxLength={60}
                error={erreurs1.prenom}
              />
              <p className="text-fg-muted mt-1 text-[13px]">{f1.prenomAide}</p>
            </div>
            <div>
              <TextField
                label={f1.email}
                fieldId="vsl-email"
                name="email"
                type="email"
                inputMode="email"
                requiredField
                value={etat.email}
                onChange={(e) => set({ email: e.target.value })}
                onBlur={() => validerAuBlur1("email")}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={180}
                error={erreurs1.email}
              />
              <p className="text-fg-muted mt-1 text-[13px]">{f1.emailAide}</p>
            </div>
          </div>

          <div className="mt-5">
            <label className="flex cursor-pointer gap-3">
              <input
                id="vsl-consent"
                type="checkbox"
                name="consent"
                checked={etat.consent}
                onChange={(e) => set({ consent: e.target.checked })}
                aria-invalid={erreurs1.consent ? true : undefined}
                aria-describedby={erreurs1.consent ? "vsl-consent-erreur" : undefined}
                className="accent-terracotta mt-1 h-5 w-5 shrink-0"
              />
              <span className="text-fg-soft text-sm leading-relaxed">{f1.consent}</span>
            </label>
            {erreurs1.consent ? (
              <p
                id="vsl-consent-erreur"
                role="alert"
                className="text-terracotta-deep mt-1.5 text-sm"
              >
                {erreurs1.consent}
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
            className={`mt-6 ${BOUTON_TERRACOTTA}`}
            data-cta="vsl-etape1-continuer"
          >
            {envoi ? "Envoi…" : `${f1.bouton} →`}
          </PrimaryButton>
          <p className="text-fg-muted mt-3 text-center text-[13px] leading-snug">
            {f1.legal}{" "}
            <Link
              href={ROUTES.privacy as never}
              className="text-terracotta-deep underline underline-offset-2"
            >
              {f1.legalLien}
            </Link>
            .
          </p>
        </form>
      ) : (
        <form ref={formRef} onSubmit={envoyerEtape2} noValidate aria-labelledby="vsl-titre-etape">
          <p className="text-terracotta-deep text-[12px] font-semibold tracking-[0.16em] uppercase">
            {f2.eyebrow}
          </p>
          <h3
            id="vsl-titre-etape"
            ref={titreRef}
            tabIndex={-1}
            className="text-fg mt-2 font-serif text-2xl leading-tight font-semibold outline-none"
          >
            {f2.titre}
          </h3>

          <div className="mt-5 grid gap-5">
            <div>
              <TextField
                label={f2.telephone}
                fieldId="vsl-telephone"
                name="telephone"
                type="tel"
                inputMode="tel"
                requiredField
                value={etat.telephone}
                onChange={(e) => {
                  majEtatVsl({ telephone: e.target.value });
                  if (
                    erreurs2.telephone &&
                    !validerEtape2({ ...etat, telephone: e.target.value }).telephone
                  )
                    setErreurs2((anc) => avecErreur(anc, "telephone", undefined));
                }}
                onBlur={() =>
                  setErreurs2((anc) => avecErreur(anc, "telephone", validerEtape2(etat).telephone))
                }
                autoComplete="tel"
                maxLength={40}
                error={erreurs2.telephone}
              />
              <p className="text-fg-muted mt-1 text-[13px]">{f2.telephoneAide}</p>
            </div>

            <ChipGroup legend={f2.question} requiredField error={erreurs2.reponse}>
              {VSL_REPONSES.map((r) => (
                <Chip
                  key={r.id}
                  name="reponse"
                  value={r.id}
                  label={r.libelle}
                  checked={etat.reponse === r.id}
                  onToggle={(v) => {
                    majEtatVsl({ reponse: v as ReponseNombreDirigeants });
                    setErreurs2((anc) => avecErreur(anc, "reponse", undefined));
                  }}
                />
              ))}
            </ChipGroup>
          </div>

          {erreurServeur ? (
            <p role="alert" className="text-terracotta-deep mt-4 text-sm font-medium">
              {erreurServeur}
            </p>
          ) : null}

          <PrimaryButton
            type="submit"
            disabled={envoi}
            className={`mt-6 ${BOUTON_TERRACOTTA}`}
            data-cta="vsl-etape2-envoyer"
          >
            {envoi ? "Envoi…" : `${f2.bouton} →`}
          </PrimaryButton>
          <p className="text-fg-muted mt-3 text-center text-[13px]">{f2.micro}</p>
          <p className="mt-2 text-center">
            <button
              type="button"
              onClick={retourEtape1}
              className="text-terracotta-deep text-[13px] underline underline-offset-2"
            >
              {f2.retour}
            </button>
          </p>
        </form>
      )}
    </div>
  );
}
