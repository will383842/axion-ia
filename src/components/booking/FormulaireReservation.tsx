// Formulaire de réservation — Server Component, aucun JavaScript envoyé.
//
// POURQUOI CE FORMULAIRE EXISTE
// -----------------------------
// Jusqu'ici, cliquer un créneau sur `/appel` envoyait le visiteur sur
// calendly.com : notre design s'arrêtait au calendrier, et les trois écrans
// suivants (saisie, confirmation, annulation) étaient les leurs. Calendly
// n'accepte que trois réglages d'apparence — deux couleurs et un logo — et son
// formulaire vit dans une iframe qu'aucune feuille de style extérieure
// n'atteint. Il n'y avait donc pas de version « mieux habillée » à obtenir : il
// fallait le refaire.
//
// ZÉRO JAVASCRIPT, ET CE N'EST PAS UNE COQUETTERIE
// ------------------------------------------------
// Ce fichier ne porte pas `use client`, n'a pas d'état, et ne charge aucune
// bibliothèque. Trois conséquences, dans l'ordre où elles comptent :
//
//   1. MOBILE — rien à hydrater, donc rien à attendre. Le formulaire fonctionne
//      dès que le HTML arrive, y compris sur un réseau qui vacille dans un
//      train. C'est la moitié du travail « mobile d'abord » ; l'autre moitié
//      est dans les attributs ci-dessous.
//   2. ROBUSTESSE — un formulaire natif ne peut pas rester inerte parce qu'un
//      script a échoué. C'est exactement la régression qu'ADR 0034 assumait sur
//      l'ancien bouton, et qu'ADR 0038 a supprimée pour le calendrier.
//   3. BUDGET — `/appel/**` partage un plafond de 110 KB gz avec la page
//      principale, et ce plafond BLOQUE les PR depuis le 2026-08-24. Un
//      formulaire client-side y aurait tenu, mais en mangeant la marge.
//
// 🔴 LA LONGUEUR PERÇUE EST LE PREMIER FACTEUR D'ABANDON (refonte 2026-09-02)
// ---------------------------------------------------------------------------
// Will, en regardant la version précédente : « cette page donne une connotation
// de beaucoup de choses à remplir ». Il avait raison, et le compte le prouve —
// l'écran affichait NEUF blocs de saisie empilés en une seule colonne : nom,
// e-mail, format, téléphone, besoin, entreprise, ville, invités, fuseau, plus
// le consentement. Aucun n'était de trop pris isolément ; leur EMPILEMENT
// l'était. Un formulaire de réservation ne se lit pas champ par champ, il se
// juge d'un coup d'œil au moment où il s'affiche, et ce jugement décide de tout
// le reste.
//
// Quatre gestes, dans l'ordre de ce qu'ils retirent :
//
//   ① LE FUSEAU HORAIRE EST SUPPRIMÉ (voir `formulaire-reservation.ts`). Il
//     servait un visiteur sur cent et coûtait une étiquette, une aide et une
//     ligne de 48 px à tous les autres. Le validateur retombe sur Paris, et
//     chaque surface écrit « heure de Paris » à côté de l'heure.
//   ② « VILLE DE L'ENTREPRISE » EST MASQUÉE (voir `questions.ts`). Une donnée
//     qu'on obtient en trois secondes pendant l'appel.
//   ③ LES INVITÉS PASSENT DERRIÈRE UN BOUTON qui les DÉPLIE — demande explicite
//     de Will. Un champ que neuf visiteurs sur dix laissent vide n'a rien à
//     faire dans la colonne principale. `<details>`/`<summary>` natif : le
//     dépliage marche sans une ligne de JavaScript.
//   ④ LE TÉLÉPHONE DISPARAISSAIT QUAND LA VISIO ÉTAIT CHOISIE, en CSS pur
//     (`group-has-[#format-visio:checked]:hidden`). ⚠️ RETIRÉ LE 2026-09-03 :
//     Will a rendu le numéro OBLIGATOIRE dans les deux formats, et un contrôle
//     `required` masqué en `display:none` bloque la soumission native sans
//     afficher le moindre message. Le détail est au bloc concerné ; l'écran
//     regagne donc une ligne de 48 px pour qui choisit la visio, et c'est le
//     prix assumé d'un prospect joignable.
//
// Et deux gestes qui raccourcissent sans rien retirer : nom et e-mail se
// rangent côte à côte dès `sm:`, et la zone « votre besoin » passe de quatre
// lignes à deux — Will : « quel est votre besoin doit être beaucoup moins
// grand ». Le texte entre parenthèses de la question devient une aide sous
// l'étiquette au lieu d'une étiquette de deux lignes (`separerLaParenthese`).
//
// MOBILE D'ABORD — LES SEPT DÉTAILS QUI DÉCIDENT
// ----------------------------------------------
// Convention déjà appliquée dans ce dépôt : les classes de base sont celles du
// téléphone, `sm:` et `lg:` ne font qu'ajouter. Ce qui ne se voit pas dans les
// classes, et qui compte autant :
//
//   — `text-base` (16 px) sur CHAQUE champ. En dessous, iOS zoome à la mise au
//     point et décale toute la page ; le visiteur perd le champ des yeux au
//     moment précis où il commence à taper. Ce n'est pas un choix esthétique.
//   — `h-12` (48 px) : une cible qui se vise au pouce, debout, d'une main.
//   — `type` et `inputMode` justes : le clavier s'ouvre sur l'arobase pour un
//     e-mail, sur les chiffres et le « + » pour un téléphone.
//   — `autoComplete` : le téléphone propose ce qu'il connaît déjà. Sans ces
//     attributs, tout se saisit à la main — et un caractère de travers coûte le
//     rendez-vous.
//   — Le choix du format est fait de deux BLOCS entiers cliquables, pas de deux
//     petits ronds : on ne vise pas un rond de 16 px au pouce.
//   — Les erreurs sont AU-DESSUS du champ fautif, jamais seulement en haut de
//     page : sur un écran de téléphone, le haut de page est déjà hors de vue.
//   — Le bouton d'envoi est pleine largeur et suit le flux. PAS de barre fixe en
//     bas : elle recouvrirait le dernier champ, qui est justement celui qu'on
//     vient de remplir.
//
// PIÈGE — CONTRASTE. `/fr/appel` fait partie des 15 pages tenues à zéro
// violation axe serious/critical, et `color-contrast` y est classé serious. Le
// design system apparie `bg-terracotta` avec `text-mocha-fg` (cf.
// `ui/button.tsx`). NE PAS écrire `bg-terracotta text-paper`.
//
// PIÈGE — les états « sélectionné » obtenus par une opacité (`bg-terracotta/5`)
// ne se voyaient PAS : sur ivoire, cinq pour cent de terracotta est un blanc
// cassé. Will : « il manque un peu de contraste à des endroits ». On utilise
// désormais les jetons pleins de la charte (`bg-terracotta-soft`,
// `border-terracotta`), qui sont mesurés — une opacité ne se calcule pas, donc
// elle ne se vérifie pas, et le gate de contraste ne la voit pas.
//
// PIÈGE — `ui/label.tsx` PORTE `use client`. L'utiliser ici enverrait du
// JavaScript pour rendre un `<label>`. On écrit du HTML natif.

import * as React from "react";
import { CalendarCheck, Clock, ShieldCheck, UserPlus, ArrowRight } from "lucide-react";

import { CHAMPS, type Erreurs, type Valeurs } from "@/server/calendly/formulaire-reservation";
import type { QuestionEventType } from "@/server/calendly/questions";
import { MAX_INVITES } from "@/server/calendly/reservation";

/** Classes communes à tous les champs de saisie. Voir le PIÈGE `text-base`. */
const CHAMP =
  "border-border-strong bg-paper text-fg hover:border-fg/60 focus-visible:border-terracotta focus-visible:ring-terracotta/20 w-full rounded-lg border px-3 text-base transition focus-visible:ring-4 focus-visible:outline-none";

const CHAMP_HAUT = `${CHAMP} h-12`;

interface FormulaireReservationProps {
  /** Le créneau choisi, ISO 8601 UTC. */
  readonly debutIso: string;
  /** Libellé lisible du créneau, déjà formaté par la page. */
  readonly creneauLisible: string;
  readonly dureeMinutes: number;
  readonly questions: readonly QuestionEventType[];
  /** Erreurs de la tentative précédente, vides au premier affichage. */
  readonly erreurs?: Erreurs;
  /** Ce que le visiteur avait tapé, pour ne rien lui faire retaper. */
  readonly valeurs?: Valeurs;
  /** URL de repli vers Calendly, si le visiteur préfère leur formulaire. */
  readonly replidUrl?: string | undefined;
  /** L'action serveur qui traite l'envoi. */
  readonly action: (fd: FormData) => Promise<void>;
  /**
   * La locale, transportée en champ caché.
   *
   * 🔑 Une action serveur ne reçoit PAS les paramètres de route : elle n'a que
   * le `FormData`. Sans ce champ, la redirection de fin retomberait sur une
   * locale devinée, et un visiteur anglophone atterrirait sur une page
   * française après avoir réservé.
   */
  readonly locale: string;
  readonly champLocale: string;
  /** Nom du champ leurre. Voir son rendu plus bas — il n'est PAS `hidden`. */
  readonly champLeurre: string;
  /**
   * Lien de retour au calendrier, affiché AVEC l'erreur du créneau.
   *
   * 🔑 Sans lui, le message « ce créneau vient d'être réservé » laisserait le
   * visiteur devant un formulaire qu'il ne peut pas réparer : le créneau est
   * dans un champ caché, il n'a aucun moyen d'en changer depuis cette page.
   */
  readonly retourAuCalendrier?: string | undefined;
}

/**
 * Coupe le complément entre parenthèses d'un libellé de question.
 *
 * ## Le défaut, mesuré sur la question réelle
 *
 * Chez Calendly, la question s'intitule « Quel est votre besoin (formation, 1
 * to 1, audit, implémentation, plateforme web) ? ». Rendue telle quelle en
 * `<label>` gras, elle occupe deux lignes pleines au téléphone et pèse plus
 * lourd, à l'œil, que le champ qu'elle introduit. Will : « quel est votre
 * besoin doit être beaucoup moins grand ».
 *
 * On ne réécrit RIEN chez Calendly, et on n'invente aucun libellé : la question
 * envoyée dans `questions_and_answers` reste le texte EXACT reçu de l'API
 * (`q.libelle`, cf. `validerFormulaire`). Seul l'AFFICHAGE se réorganise — la
 * question courte en étiquette, son énumération en aide sous l'étiquette.
 *
 * 🔑 Prudente par construction : elle ne coupe QUE devant une ÉNUMÉRATION —
 * une parenthèse qui contient une virgule ou un « ou ». C'est ce critère, et
 * non la seule longueur, qui distingue un complément détachable d'un morceau
 * de la question elle-même.
 *
 * 🔴 Le critère « huit caractères de chaque côté » ne suffisait PAS, et la
 * garde l'a montré immédiatement : « Effectif (salariés) » le franchissait et
 * devenait « Effectif » + « Salariés. » — une étiquette amputée de ce qu'elle
 * demandait. Mieux vaut une étiquette longue qu'une étiquette fausse ; les
 * deux critères sont donc cumulés.
 */
export function separerLaParenthese(libelle: string): {
  readonly label: string;
  readonly aide?: string;
} {
  const m = /^(.+?)\s*\(([^()]+)\)\s*([?!:.]*)$/.exec(libelle.trim());
  if (!m) return { label: libelle };
  const [, avant = "", dedans = "", ponctuation = ""] = m;
  if (avant.trim().length < 8 || dedans.trim().length < 8) return { label: libelle };
  // Une énumération, et rien d'autre : « a, b, c » ou « a ou b ». Une
  // parenthèse d'un seul tenant (« salariés », « obligatoire », « € ») fait
  // partie de la question et reste dans l'étiquette.
  if (!/,|ou/i.test(dedans)) return { label: libelle };
  const dedansPropre = dedans.trim();
  return {
    label: `${avant.trim()}${ponctuation ? ` ${ponctuation}` : ""}`.trim(),
    // Majuscule initiale et point final : c'est une phrase d'aide, plus un
    // fragment de parenthèse.
    aide: `${dedansPropre.charAt(0).toUpperCase()}${dedansPropre.slice(1)}.`,
  };
}

/**
 * Le message d'erreur d'un champ, rendu AU-DESSUS de lui.
 *
 * `role="alert"` le fait annoncer par les lecteurs d'écran au re-rendu, sans
 * quoi un utilisateur non voyant devrait parcourir le formulaire pour découvrir
 * ce qui a été refusé.
 */
function Erreur({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-terracotta-deep mb-1.5 text-sm font-medium">
      {message}
    </p>
  );
}

/** Un champ complet : étiquette, erreur, saisie — dans cet ordre à l'écran. */
function Champ({
  nom,
  label,
  children,
  erreur,
  aide,
  requis,
}: {
  nom: string;
  label: string;
  children: React.ReactNode;
  erreur?: string | undefined;
  aide?: string | undefined;
  requis?: boolean;
}) {
  return (
    <div>
      <label htmlFor={nom} className="text-fg mb-1.5 block text-sm font-semibold">
        {label}
        {requis ? (
          <span className="text-terracotta-deep ml-1" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="text-fg-muted ml-1.5 text-[13px] font-normal">facultatif</span>
        )}
      </label>
      {aide ? (
        <p id={`${nom}-aide`} className="text-fg-soft mt-0.5 mb-1.5 text-[13px] leading-snug">
          {aide}
        </p>
      ) : null}
      <Erreur id={`${nom}-erreur`} message={erreur} />
      {children}
    </div>
  );
}

export function FormulaireReservation({
  debutIso,
  creneauLisible,
  dureeMinutes,
  questions,
  erreurs = {},
  valeurs = {},
  replidUrl,
  action,
  locale,
  champLocale,
  champLeurre,
  retourAuCalendrier,
}: FormulaireReservationProps) {
  const v = (nom: string): string => valeurs[nom] ?? "";
  const e = (nom: string): string | undefined => erreurs[nom];
  /** `aria-describedby` ne doit citer que des éléments qui existent vraiment. */
  const decrit = (nom: string, avecAide = false): string | undefined => {
    const ids = [e(nom) ? `${nom}-erreur` : null, avecAide ? `${nom}-aide` : null].filter(Boolean);
    return ids.length > 0 ? ids.join(" ") : undefined;
  };

  // Le format pré-coché : ce que le visiteur avait choisi, sinon rien.
  // ⚠️ AUCUN des deux n'est coché par défaut au PREMIER affichage — pré-cocher
  // ferait réserver une visio à qui n'a rien choisi, et le champ passerait la
  // validation sans que personne n'ait décidé.
  const formatChoisi = v(CHAMPS.format);

  const nbErreurs = Object.keys(erreurs).length;

  /**
   * Le volet « inviter des collègues » s'ouvre-t-il d'emblée ?
   *
   * 🔴 OUI DÈS QU'IL PORTE QUELQUE CHOSE — une saisie conservée après un refus,
   * ou une erreur sur ces adresses. Un message « cette adresse semble
   * incomplète » replié dans un volet fermé serait annoncé par le récapitulatif
   * d'erreurs sans être atteignable : le visiteur lirait « 1 point à corriger »
   * et ne trouverait aucun champ marqué. C'est exactement la boucle sans sortie
   * que le bandeau du créneau a déjà coûtée une fois.
   */
  const invitesOuverts = v(CHAMPS.invites).trim() !== "" || e(CHAMPS.invites) !== undefined;

  return (
    <form action={action} noValidate className="relative space-y-5">
      {/* Le créneau voyage en champ caché : c'est la seule donnée que le
          visiteur ne peut pas retaper, et il ne doit jamais la perdre. */}
      <input type="hidden" name={CHAMPS.debut} value={debutIso} />
      <input type="hidden" name={champLocale} value={locale} />

      {/* LEURRE — un champ que rien n'invite à remplir, et qu'un robot remplit
          quand même. Même nom que sur `/contact`, pour la même raison.

          ⚠️ IL N'EST PAS `type="hidden"`, ET C'EST VOULU : un robot un peu
          soigneux ignore les champs cachés. On le retire de la VUE et de
          l'arbre d'accessibilité, mais il reste un champ ordinaire dans le HTML.

          Les quatre attributs comptent, et aucun n'est décoratif :
          — `aria-hidden` : jamais annoncé par un lecteur d'écran ;
          — `tabIndex={-1}` : jamais atteint par la touche de tabulation, sinon
            un utilisateur au clavier tomberait dedans et se ferait prendre pour
            un robot ;
          — `autoComplete="off"` : sinon le navigateur pourrait le pré-remplir
            tout seul, et condamner un visiteur parfaitement légitime ;
          — la position hors écran plutôt que `display:none`, que certains
            robots savent lire. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor={champLeurre}>Ne remplissez pas ce champ</label>
        <input
          id={champLeurre}
          name={champLeurre}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      {/* 🔴 L'ERREUR DU CRÉNEAU, ET ELLE N'EST PAS DÉCORATIVE.

          Ce message a été INVISIBLE pendant toute la première version, et c'était
          le défaut le plus grave du lot. `debut` n'existait dans ce composant
          que comme champ caché ; or SIX chemins de refus sur sept écrivent leur
          message dans cette clé — créneau pris entre-temps, quota atteint,
          leurre déclenché, jeton sans droit d'écrire, refus de l'API.

          Ce que voyait le visiteur : le bandeau « un point à corriger avant
          d'envoyer », aucun champ marqué, et rien à corriger. Il renvoyait le
          même formulaire, avec le même créneau caché, et obtenait le même
          résultat. Une boucle sans sortie, sur le cas que le code lui-même
          désigne comme le plus fréquent.

          Il est rendu ICI, contre le récapitulatif du créneau, parce que c'est
          de LUI que le message parle. */}
      {e(CHAMPS.debut) ? (
        <div
          role="alert"
          className="border-terracotta bg-terracotta-soft rounded-xl border px-4 py-3"
        >
          <p className="text-terracotta-deep text-sm font-semibold">{e(CHAMPS.debut)}</p>
          {retourAuCalendrier ? (
            <a
              href={retourAuCalendrier}
              className="text-terracotta-deep mt-1.5 inline-block text-sm font-semibold underline underline-offset-2"
            >
              Choisir un autre créneau
            </a>
          ) : null}
        </div>
      ) : null}

      {/* RÉCAPITULATIF DU CRÉNEAU — en tête, parce que c'est la première chose
          qu'on vérifie en arrivant, et qu'il doit être lisible sans défiler.

          🔑 Il porte désormais l'accent de la marque au lieu du sable neutre.
          Sur ivoire, `bg-sand` se distinguait à peine du fond : le seul élément
          qui donne au visiteur la certitude d'être au bon endroit ressemblait à
          un espacement. C'est le point où « ça manque de punch » se mesure. */}
      <div className="border-terracotta/35 bg-terracotta-soft rounded-2xl border p-4 sm:p-5">
        <p className="text-terracotta-deep flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase">
          <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Votre créneau
        </p>
        <p
          className="text-fg mt-1.5 text-xl leading-tight font-semibold sm:text-2xl"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {creneauLisible}
        </p>
        <p className="text-fg-soft mt-1.5 flex items-center gap-1.5 text-sm font-medium">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {dureeMinutes} minutes · heure de Paris
        </p>
      </div>

      {/* Le récapitulatif d'erreurs ne REMPLACE pas les messages par champ : il
          s'y ajoute. Seul, il obligerait à chercher ; absent, un lecteur
          d'écran n'apprendrait qu'au fil du parcours que l'envoi a échoué. */}
      {nbErreurs > 0 ? (
        <div
          role="alert"
          className="border-terracotta bg-terracotta-soft text-fg rounded-xl border px-4 py-3 text-sm"
        >
          <p className="font-semibold">
            {nbErreurs === 1
              ? "Un point à corriger avant d'envoyer."
              : `${nbErreurs} points à corriger avant d'envoyer.`}
          </p>
          <p className="text-fg-soft mt-1">
            Ce que vous avez déjà saisi est conservé — rien n&apos;est à retaper.
          </p>
        </div>
      ) : null}

      {/* IDENTITÉ — deux champs côte à côte dès `sm:`.
          🔑 Ce n'est pas de la mise en page pour la mise en page : sur un écran
          d'ordinateur, deux champs empilés font paraître le formulaire deux
          fois plus long qu'il n'est. Au téléphone la grille retombe à une
          colonne, où l'empilement est le seul rangement lisible. */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Champ nom={CHAMPS.nom} label="Votre nom" erreur={e(CHAMPS.nom)} requis>
          <input
            id={CHAMPS.nom}
            name={CHAMPS.nom}
            type="text"
            defaultValue={v(CHAMPS.nom)}
            autoComplete="name"
            maxLength={80}
            required
            aria-invalid={e(CHAMPS.nom) ? true : undefined}
            aria-describedby={decrit(CHAMPS.nom)}
            className={CHAMP_HAUT}
          />
        </Champ>

        <Champ nom={CHAMPS.email} label="Votre e-mail" erreur={e(CHAMPS.email)} requis>
          <input
            id={CHAMPS.email}
            name={CHAMPS.email}
            // `type="email"` ouvre le clavier avec l'arobase et le point. Le
            // chercher dans un clavier alphabétique fait abandonner.
            type="email"
            inputMode="email"
            defaultValue={v(CHAMPS.email)}
            autoComplete="email"
            maxLength={254}
            required
            aria-invalid={e(CHAMPS.email) ? true : undefined}
            aria-describedby={decrit(CHAMPS.email)}
            className={CHAMP_HAUT}
          />
        </Champ>
      </div>

      {/* FORMAT + TÉLÉPHONE — un seul groupe, parce qu'on les lit ensemble :
          « comment vous joindre » puis « à quel numéro ». Le téléphone ne
          dépend PLUS du format depuis qu'il est obligatoire dans les deux (voir
          la note du champ). */}
      <div className="space-y-5">
        {/* FORMAT — deux blocs entiers cliquables. Le `<label>` enveloppe le
            bouton radio, donc toute la surface répond, pas seulement le rond. */}
        <fieldset>
          <legend className="text-fg mb-2 text-sm font-semibold">
            Comment préférez-vous échanger&nbsp;?
            <span className="text-terracotta-deep ml-1" aria-hidden="true">
              *
            </span>
          </legend>
          <Erreur id={`${CHAMPS.format}-erreur`} message={e(CHAMPS.format)} />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {[
              {
                valeur: "visio",
                titre: "En visioconférence",
                detail: "Lien Google Meet envoyé avec la confirmation. Rien à installer.",
              },
              {
                valeur: "telephone",
                titre: "Par téléphone",
                detail: "Nous vous appelons au numéro que vous indiquez.",
              },
            ].map((opt) => (
              <label
                key={opt.valeur}
                // `has-[:checked]` donne l'état sélectionné SANS JavaScript, et
                // `has-[:focus-visible]` rend le parcours au clavier visible sur
                // le bloc entier plutôt que sur le rond seul.
                //
                // 🔑 L'état coché est marqué par des JETONS PLEINS et un anneau,
                // pas par une opacité de 5 % qui ne se voyait pas sur ivoire.
                className="border-border-strong bg-paper hover:border-fg/40 has-[:checked]:border-terracotta has-[:checked]:bg-terracotta-soft has-[:checked]:ring-terracotta has-[:focus-visible]:ring-terracotta flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition has-[:checked]:ring-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2"
              >
                <input
                  id={`format-${opt.valeur}`}
                  type="radio"
                  name={CHAMPS.format}
                  value={opt.valeur}
                  defaultChecked={formatChoisi === opt.valeur}
                  required
                  aria-describedby={e(CHAMPS.format) ? `${CHAMPS.format}-erreur` : undefined}
                  className="accent-terracotta mt-0.5 h-5 w-5 shrink-0"
                />
                <span>
                  <span className="text-fg block text-[15px] font-semibold">{opt.titre}</span>
                  <span className="text-fg-soft mt-0.5 block text-[13px] leading-snug">
                    {opt.detail}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* TÉLÉPHONE — OBLIGATOIRE, ET TOUJOURS VISIBLE (Will, 2026-09-03).

            🔴 LE MASQUAGE CONDITIONNEL A ÉTÉ RETIRÉ, ET CE N'EST PAS UN CHOIX
            D'ESTHÉTIQUE : IL EST INCOMPATIBLE AVEC `required`.

            Ce champ vivait dans `group-has-[#format-visio:checked]:hidden` —
            masqué en `display:none` dès que la visio était cochée. Le rendre
            obligatoire SANS retirer ce masquage produirait la pire panne que ce
            formulaire puisse avoir : un contrôle invalide et non affichable
            bloque la soumission NATIVE du navigateur, qui refuse d'envoyer et
            ne peut afficher son message nulle part (« An invalid form control
            is not focusable »). Le visiteur cliquerait « Réserver » et il ne se
            passerait RIEN — sans un mot, sans une erreur, sans recours, et sur
            la moitié du trafic qui choisit la visio.

            Le champ reste donc affiché dans les deux formats, ce que son
            étiquette assume : on demande un numéro même pour une visio, et on
            dit pourquoi juste en dessous.

            ⚠️ L'ancien commentaire expliquait longuement pourquoi le masquage
            visait « la visio cochée » plutôt que « le téléphone non coché » —
            pour échouer ouvert sur un navigateur sans `:has()`. Ce raisonnement
            reste juste, et c'est pour cela qu'il est consigné ici : il ne
            s'applique simplement plus, puisqu'il n'y a plus rien à masquer. */}
        <div>
          <Champ
            nom={CHAMPS.telephone}
            label="Votre téléphone"
            requis
            aide="Pour vous joindre en cas d'imprévu, et c'est le numéro que nous composerons si vous choisissez l'appel. Indicatif pays compris."
            erreur={e(CHAMPS.telephone)}
          >
            <input
              id={CHAMPS.telephone}
              name={CHAMPS.telephone}
              type="tel"
              required
              // `inputMode="tel"` ouvre le pavé numérique AVEC le « + ». Sans lui,
              // l'indicatif pays qu'on exige est introuvable au pouce.
              inputMode="tel"
              defaultValue={v(CHAMPS.telephone)}
              autoComplete="tel"
              placeholder="+33 6 12 34 56 78"
              // 🔑 33, PAS 30. La regex du serveur accepte 2 + 3 + 28 = 33
              // caractères ; couper à 30 dans le navigateur amputait en SILENCE un
              // numéro international formaté collé depuis un carnet d'adresses. Le
              // reste passait encore la validation — et c'est ce numéro tronqué
              // qu'on aurait composé le jour du rendez-vous.
              maxLength={33}
              aria-invalid={e(CHAMPS.telephone) ? true : undefined}
              aria-describedby={decrit(CHAMPS.telephone, true)}
              className={CHAMP_HAUT}
            />
          </Champ>
        </div>
      </div>

      {/* QUESTIONS — lues chez Calendly, jamais recopiées ici. Voir
          `server/calendly/questions.ts` : une question ajoutée là-bas apparaît
          ici toute seule, une question qu'on ne sait pas rendre empêche ce
          formulaire d'exister plutôt que de le rendre amputé, et une question
          que Will ne veut plus poser y est masquée à un seul endroit. */}
      {questions.map((q) => {
        const { label, aide } = separerLaParenthese(q.libelle);
        return (
          <Champ
            key={q.champ}
            nom={q.champ}
            label={label}
            aide={aide}
            erreur={e(q.champ)}
            requis={q.requise}
          >
            {q.type === "single_select" ? (
              <select
                id={q.champ}
                name={q.champ}
                defaultValue={v(q.champ)}
                required={q.requise}
                aria-invalid={e(q.champ) ? true : undefined}
                aria-describedby={decrit(q.champ, aide !== undefined)}
                className={CHAMP_HAUT}
              >
                <option value="">— Choisissez —</option>
                {q.choix.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : q.type === "text" ? (
              // 🔑 DEUX lignes, pas quatre. Une zone de texte haute LIT comme
              // une obligation d'écrire long : elle décourage la réponse d'une
              // ligne, qui est celle qu'on obtient réellement, et allonge la
              // page de 96 px pour tout le monde. Demande explicite de Will.
              // Le champ reste extensible par la poignée du navigateur, et rien
              // n'est tronqué : `maxLength` est inchangé.
              <textarea
                id={q.champ}
                name={q.champ}
                defaultValue={v(q.champ)}
                rows={2}
                maxLength={10_000}
                required={q.requise}
                aria-invalid={e(q.champ) ? true : undefined}
                aria-describedby={decrit(q.champ, aide !== undefined)}
                className={`${CHAMP} py-3`}
              />
            ) : (
              <input
                id={q.champ}
                name={q.champ}
                type={q.type === "phone_number" ? "tel" : "text"}
                inputMode={q.type === "phone_number" ? "tel" : undefined}
                defaultValue={v(q.champ)}
                maxLength={2_000}
                required={q.requise}
                aria-invalid={e(q.champ) ? true : undefined}
                aria-describedby={decrit(q.champ, aide !== undefined)}
                className={CHAMP_HAUT}
              />
            )}
          </Champ>
        );
      })}

      {/* INVITÉS — repliés derrière un bouton qui les déplie.

          Demande de Will : « inviter des amis, il faut un bouton pour
          développer s'ils en ont besoin ». Neuf visiteurs sur dix réservent
          seuls ; leur imposer une zone de texte de deux lignes avec son
          étiquette et son aide, c'est allonger l'écran pour une minorité.

          🔑 `<details>`/`<summary>` NATIF, donc zéro JavaScript : le dépliage
          marche même si tout le reste échoue, et le contenu replié est bien
          dans le DOM — il est posté normalement, et les lecteurs d'écran
          annoncent le volet comme un bouton d'expansion sans qu'on écrive un
          seul attribut ARIA. Une version « maison » en JavaScript aurait coûté
          l'hydratation de toute la page. */}
      <details
        open={invitesOuverts}
        className="group/invites border-border-strong bg-paper rounded-xl border"
      >
        <summary className="text-fg hover:bg-sand flex cursor-pointer list-none items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold transition select-none marker:content-none [&::-webkit-details-marker]:hidden">
          <UserPlus className="text-terracotta-deep h-4 w-4 shrink-0" aria-hidden="true" />
          Inviter des collègues à ce rendez-vous
          <span className="text-fg-muted ml-auto text-[13px] font-normal">
            {/* Le libellé change avec l'état, sans JavaScript : deux textes, un
                seul visible selon que le volet est ouvert. */}
            <span className="group-open/invites:hidden">Ajouter</span>
            <span className="hidden group-open/invites:inline">Masquer</span>
          </span>
        </summary>
        <div className="px-4 pt-1 pb-4">
          <p id={`${CHAMPS.invites}-aide`} className="text-fg-soft mb-1.5 text-[13px] leading-snug">
            Une adresse par ligne, ou séparées par des virgules. {MAX_INVITES} au maximum. Ils
            recevront la même invitation que vous.
          </p>
          <Erreur id={`${CHAMPS.invites}-erreur`} message={e(CHAMPS.invites)} />
          <textarea
            id={CHAMPS.invites}
            name={CHAMPS.invites}
            defaultValue={v(CHAMPS.invites)}
            rows={2}
            inputMode="email"
            autoComplete="off"
            aria-label="Adresses e-mail des collègues à inviter"
            aria-invalid={e(CHAMPS.invites) ? true : undefined}
            aria-describedby={decrit(CHAMPS.invites, true)}
            className={`${CHAMP} py-3`}
          />
        </div>
      </details>

      {/* CONSENTEMENT */}
      <div>
        <Erreur id={`${CHAMPS.consent}-erreur`} message={e(CHAMPS.consent)} />
        <label className="text-fg-soft flex cursor-pointer items-start gap-3 text-[13.5px] leading-snug">
          <input
            type="checkbox"
            id={CHAMPS.consent}
            name={CHAMPS.consent}
            defaultChecked={v(CHAMPS.consent) === "on"}
            required
            aria-invalid={e(CHAMPS.consent) ? true : undefined}
            aria-describedby={e(CHAMPS.consent) ? `${CHAMPS.consent}-erreur` : undefined}
            className="accent-terracotta mt-0.5 h-5 w-5 shrink-0"
          />
          <span>
            J&apos;accepte qu&apos;Axion-IA enregistre ces informations pour organiser ce
            rendez-vous et me recontacter à ce sujet.
          </span>
        </label>
      </div>

      {/* ENVOI — pleine largeur, dans le flux.
          ⚠️ PAS de barre fixe en bas d'écran : elle recouvrirait la case à
          cocher ci-dessus, qui est le dernier champ et le plus facile à oublier. */}
      <div className="space-y-3 pt-1">
        <button
          type="submit"
          data-cta="appel_reserver_envoyer"
          // 🔑 `text-mocha-fg` et NON `text-paper` : c'est l'appariement mesuré
          // du design system pour `bg-terracotta` (5,24:1). Voir le PIÈGE
          // CONTRASTE en tête de fichier.
          className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep focus-visible:ring-terracotta shadow-cta-terracotta flex h-12 w-full items-center justify-center gap-2 rounded-lg text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Confirmer ce rendez-vous
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* La dernière objection se lève ICI, sous le bouton — c'est le point
            exact où l'on hésite. Trois promesses, aucune qui ne soit tenue
            ailleurs dans le code : l'e-mail part dans la minute
            (`rappels-appel.ts`), il porte le lien d'annulation
            (`liens-rendez-vous.ts`), et rien n'est facturé. */}
        <p className="text-fg-soft flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[13px]">
          <ShieldCheck className="text-sage h-4 w-4 shrink-0" aria-hidden="true" />
          Sans engagement · Confirmation immédiate · Annulable en un clic
        </p>

        {replidUrl ? (
          <p className="text-fg-muted text-center text-[13px]">
            Un problème avec ce formulaire&nbsp;?{" "}
            <a
              href={replidUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-terracotta-deep font-medium underline underline-offset-2"
            >
              Réserver sur Calendly
            </a>
          </p>
        ) : null}
      </div>
    </form>
  );
}
