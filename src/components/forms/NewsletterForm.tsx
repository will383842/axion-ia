"use client";
// use-client: react-hook-form needs client runtime for register/handleSubmit.

// Formulaire du GUIDE IA — page du guide et encarts d'articles (lot L2, 2026-09-24).
//
// Le nom du fichier est historique (il n'inscrivait qu'à la lettre) ; son contrat
// a changé : l'adresse suffit pour recevoir le guide TOUT DE SUITE par e-mail.
// La lettre suit la nature de l'adresse (amendement de Will du 24/09) : pour
// une adresse PERSONNELLE (webmail grand public), une case FACULTATIVE,
// DÉCOCHÉE, apparaît ; pour une adresse professionnelle, la mention sous le
// bouton informe de l'inscription. ⚠️ Ce calcul ne sert qu'à l'AFFICHAGE : le
// serveur refait le sien, et c'est le sien qui décide.
//
// Lot L1 (2026-09-25) — refonte mobile d'abord : bouton terracotta pleine
// largeur de 48 px (le bleu `primary` détonnait sur une charte terracotta),
// clavier e-mail et touche « Envoyer » sur mobile, erreur reliée au champ,
// état de succès qui rappelle l'adresse saisie (une faute de frappe se voit
// et se corrige), événement Plausible « Guide Requested » sans aucune donnée
// personnelle (la provenance seulement).
//
// Corrections de relecture L1 (2026-09-25) :
//   · CLS = 0 à la réponse du serveur : le formulaire et l'encadré « envoyé »
//     partagent la MÊME case de grille ; le formulaire reste monté, invisible
//     et `inert`, donc la hauteur ne bouge pas. La place de l'alerte d'erreur
//     est réservée ;
//   · focus : l'encadré « envoyé » le reçoit ; « saisir la bonne adresse » le
//     rend au champ ;
//   · Turnstile ne se monte qu'à la première interaction (deux formulaires sur
//     la page du guide = deux défis au chargement, pour rien) ; l'envoi ATTEND
//     un jeton frais (D3 : sans jeton, le serveur refuse) ; le jeton consommé
//     par une demande acceptée est jeté aussitôt.
//
// Tous les textes arrivent par `libelles`, calculés côté serveur depuis
// `content/guide-ia-formulaire.ts` — l'archive de preuve des textes affichés.

import * as React from "react";
import { useForm } from "react-hook-form";
import { useLocale } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { demandeGuideSchema, type DemandeGuideInput } from "@/lib/schemas/forms";
import { demanderGuideAction } from "@/features/guide-ia/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";
import { HoneypotField } from "@/components/forms/HoneypotField";
import { isStaleServerActionError } from "@/lib/forms/form-errors";
import type { LibellesFormulaireGuide, SourceGuide } from "@/content/guide-ia-formulaire";
import { natureAdresse } from "@/lib/email/nature-adresse";
import { trackEvent } from "@/lib/analytics/plausible-tracker";
import { EVENEMENT_GUIDE_DEMANDE } from "@/lib/analytics/evenement-guide";
import { EVENEMENT_GUIDE_ENVOYE } from "@/components/guide-ia/attribut-formulaire";
import { cn } from "@/lib/utils";

/** Un domaine est-il saisi ? Avant, on ne sait rien de l'adresse : pas de case. */
const DOMAINE_SAISI = /@[^@\s]+\.[^@\s]{2,}$/;

/** Turnstile configuré ? Sans clé de site (dev, tests), aucun jeton n'arrivera jamais. */
const CLE_TURNSTILE = process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"];
/** Attente maximale d'un jeton Turnstile au moment de l'envoi. */
const ATTENTE_JETON_MS = 8000;

interface NewsletterFormProps {
  libelles: LibellesFormulaireGuide;
  /** Point de collecte, transmis tel quel au serveur (liste fermée). */
  source: SourceGuide;
  variant?: "inline" | "stacked";
}

export function NewsletterForm({ libelles, source, variant = "stacked" }: NewsletterFormProps) {
  const locale = useLocale();
  const idBase = React.useId();
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DemandeGuideInput>({
    // Same TS drift workaround as the other forms (zodResolver + exactOptionalPropertyTypes).
    resolver: zodResolver(demandeGuideSchema as never) as never,
    defaultValues: { email: "", lettre: false },
  });
  const lettre = watch("lettre");
  const emailSaisi = watch("email") ?? "";
  const perso = DOMAINE_SAISI.test(emailSaisi.trim()) && natureAdresse(emailSaisi) === "perso";
  const {
    token: turnstileToken,
    widget: turnstileWidget,
    reset: resetTurnstile,
    blocked: turnstileBloque,
  } = useTurnstileToken("newsletter");
  // Monté à la première interaction seulement (focus, toucher, envoi).
  const [turnstileActif, setTurnstileActif] = React.useState(false);
  const activerTurnstile = React.useCallback(() => setTurnstileActif(true), []);
  // Lus par l'attente du jeton, qui court hors du cycle de rendu.
  const jetonRef = React.useRef("");
  const bloqueRef = React.useRef(false);
  React.useEffect(() => {
    jetonRef.current = turnstileToken;
    bloqueRef.current = !!turnstileBloque;
  }, [turnstileToken, turnstileBloque]);
  const [serverError, setServerError] = React.useState<string | null>(null);
  // Adresse de la dernière demande ACCEPTÉE. L'état « envoyé » en dépend, et
  // non de `isSubmitSuccessful` : celui-ci obligeait à LEVER une erreur à
  // chaque refus (une rejection non gérée par envoi refusé, remontée par
  // Sentry) et laissait l'état « envoyé » clignoter au renvoi suivant.
  const [envoye, setEnvoye] = React.useState<string | null>(null);
  const encadreRef = React.useRef<HTMLDivElement | null>(null);
  const retourAuChamp = React.useRef(false);
  React.useEffect(() => {
    if (envoye !== null) encadreRef.current?.focus();
    else if (retourAuChamp.current) {
      retourAuChamp.current = false;
      setFocus("email");
    }
  }, [envoye, setFocus]);

  const isFr = locale === "fr";
  const pageOutdatedMsg = isFr
    ? "Cette page a expiré suite à une mise à jour du site. Rechargez la page (Ctrl+R / ⌘+R) puis réessayez."
    : "This page expired after a site update. Reload the page (Ctrl+R / ⌘+R) and try again.";

  /** Jeton Turnstile frais : attend qu'il arrive (widget tout juste monté ou remis à zéro). */
  async function attendreJeton(): Promise<string> {
    if (!CLE_TURNSTILE) return jetonRef.current;
    const limite = Date.now() + ATTENTE_JETON_MS;
    while (!jetonRef.current && !bloqueRef.current && Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return jetonRef.current;
  }

  async function onSubmit(values: DemandeGuideInput) {
    setServerError(null);
    activerTurnstile();
    try {
      const jeton = await attendreJeton();
      const fd = new FormData();
      fd.set("email", values.email);
      // Case cachée (adresse pro) = case non cochée : on n'envoie jamais un
      // accord que la personne n'a pas pu voir.
      fd.set("lettre", perso && values.lettre ? "true" : "false");
      fd.set("locale", locale);
      fd.set("source", source);
      // Turnstile est BLOQUANT (D3) : sans jeton, le serveur refuse et le dit.
      if (jeton) fd.set("cf-turnstile-response", jeton);

      const result = await demanderGuideAction({ ok: false, error: "" }, fd);
      if (!result.ok) {
        // Le message précis du serveur (MX, Turnstile, débit) est affiché tel quel.
        resetTurnstile();
        setServerError(result.error || libelles.failure);
        return;
      }
      // Le jeton vient d'être CONSOMMÉ par le serveur : on le jette, pour qu'une
      // nouvelle demande (« saisir la bonne adresse ») attende un jeton frais.
      jetonRef.current = "";
      resetTurnstile();
      setEnvoye(values.email);
      window.dispatchEvent(new Event(EVENEMENT_GUIDE_ENVOYE));
      // Mesure de conversion : le NOM de l'événement et la provenance, jamais
      // l'adresse ni sa nature (données personnelles).
      trackEvent(EVENEMENT_GUIDE_DEMANDE, { props: { source } });
    } catch (err) {
      // Deploy-skew (Server Action introuvable, page chargée avant un déploiement).
      resetTurnstile();
      setServerError(isStaleServerActionError(err) ? pageOutdatedMsg : libelles.failure);
    }
  }

  const inline = variant === "inline";
  const idEmail = `${idBase}-email`;
  const idLettre = `${idBase}-lettre`;
  const idErreur = `${idBase}-erreur`;

  // 🔴 2026-09-24 (PR 1156) — LA CASE ÉTAIT SOUS LE BOUTON. On lisait « Recevoir
  //    le guide » AVANT de voir ce qu'on acceptait. En variante EMPILÉE (page
  //    du guide), la case précède donc le bouton. En variante « en ligne »
  //    (encart de fin d'article), la rangée flex sans retour ne supporte pas
  //    un bloc pleine largeur avant le bouton : la case y reste après.
  //    Gardé par `le-consentement-precede-le-bouton.spec.ts`.
  //
  // Adresse PERSONNELLE seulement : case FACULTATIVE, DÉCOCHÉE par défaut. Le
  // guide ne dépend jamais d'elle. La MENTION, elle, reste sous le bouton
  // (amendement de Will du 24/09).
  const blocConsentement = perso ? (
    <div className="flex items-start gap-2.5 sm:basis-full">
      <Checkbox
        id={idLettre}
        checked={!!lettre}
        onCheckedChange={(c) => setValue("lettre", c === true)}
      />
      <Label htmlFor={idLettre} className="text-fg-soft py-0.5 text-sm leading-snug">
        {libelles.lettre}
      </Label>
    </div>
  ) : null;

  const estEnvoye = envoye !== null;

  // Formulaire et encadré « envoyé » dans la MÊME case de grille : l'un
  // remplace l'autre sans que la hauteur change (CLS = 0 à la réponse du
  // serveur). Le formulaire reste monté — la valeur saisie aussi.
  return (
    <div className="grid">
      <form
        onSubmit={handleSubmit(onSubmit)}
        onFocus={activerTurnstile}
        onPointerDown={activerTurnstile}
        noValidate
        inert={estEnvoye}
        className={cn(
          "[grid-area:1/1]",
          inline ? "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" : "space-y-3",
          estEnvoye && "invisible",
        )}
      >
        <HoneypotField />
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor={idEmail}>{libelles.email}</Label>
          <Input
            id={idEmail}
            type="email"
            autoComplete="email"
            inputMode="email"
            enterKeyHint="send"
            autoCapitalize="none"
            spellCheck={false}
            {...register("email")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? idErreur : undefined}
          />
          {errors.email ? (
            <p id={idErreur} role="alert" className="text-error text-xs">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        {inline ? null : blocConsentement}

        <Button
          type="submit"
          variant="terracotta"
          size="lg"
          loading={isSubmitting}
          className={inline ? "w-full sm:w-auto sm:self-end" : "w-full"}
        >
          {isSubmitting ? libelles.sending : libelles.submit}
        </Button>

        {inline ? blocConsentement : null}

        <p className="text-fg-muted text-xs leading-normal sm:basis-full" aria-live="polite">
          {perso ? libelles.mention.perso : libelles.mention.pro}{" "}
          <a className="underline" href={libelles.politique.href}>
            {libelles.politique.libelle}
          </a>
          .
        </p>

        {/* Place RÉSERVÉE : une alerte qui arrive avec la réponse du serveur ne
            pousse pas la page (CLS = 0). */}
        <div className="min-h-18 sm:basis-full">
          {serverError ? (
            <Alert variant="danger" role="alert">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <div className="sm:basis-full">{turnstileActif ? turnstileWidget : null}</div>
      </form>

      {/* Région vivante TOUJOURS présente : un `role="status"` inséré déjà
          rempli n'est pas annoncé de façon fiable. */}
      <div role="status" className="self-start [grid-area:1/1]">
        {estEnvoye ? (
          <div
            ref={encadreRef}
            tabIndex={-1}
            className="border-accent-green/30 bg-accent-green/10 rounded-lg border p-4 outline-none"
          >
            <p className="text-fg font-semibold">{libelles.successTitre}</p>
            <p className="text-fg-soft mt-1 text-sm leading-relaxed">{libelles.success}</p>
            {envoye ? (
              <>
                <p className="text-fg-soft mt-2 text-sm break-all">
                  {libelles.envoyeA} <strong className="text-fg">{envoye}</strong>
                </p>
                {/* L'adresse est rappelée : une faute de frappe se repère ICI.
                    Le bouton rouvre le formulaire, pré-rempli ; la première
                    demande n'est PAS annulée, d'où son libellé. */}
                <button
                  type="button"
                  className="text-fg -ml-1 inline-flex min-h-11 items-center px-1 text-sm underline underline-offset-2"
                  onClick={() => {
                    retourAuChamp.current = true;
                    setEnvoye(null);
                  }}
                >
                  {libelles.corriger}
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
