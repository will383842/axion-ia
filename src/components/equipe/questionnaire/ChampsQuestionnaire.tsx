/**
 * Champs du questionnaire collaborateur. Server Component : rendus en HTML, aucun JavaScript envoyé ;
 * l'îlot client `FormulaireQuestionnaire` ne porte que l'état de l'envoi, Turnstile et le bouton.
 * Cases de consentement SÉPARÉES et JAMAIS cochées d'avance.
 */
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HoneypotField } from "@/components/forms/HoneypotField";
import {
  QUESTIONS_COMMUNES_V1,
  TEAM_ATTESTATION_VERSION_COURANTE,
  TEAM_CONSENT_VERSION_COURANTE,
} from "@/lib/equipe/donnees";
import type { Question } from "@/lib/equipe/donnees";

const LIBELLE = "text-fg text-sm font-medium leading-none";
const L = QUESTIONS_COMMUNES_V1.libelles;

function Case({ name, texte, required }: { name: string; texte: string; required?: boolean }) {
  return (
    <label className="text-fg flex items-start gap-3 text-sm leading-relaxed">
      <input type="checkbox" name={name} required={required} className="mt-1 size-4 shrink-0" />
      <span>{texte}</span>
    </label>
  );
}

export function ChampsQuestionnaire({
  jeton,
  questions,
}: {
  jeton: string;
  questions: readonly Question[];
}) {
  const c = TEAM_CONSENT_VERSION_COURANTE;
  return (
    <>
      <HoneypotField />
      <input type="hidden" name="jeton" value={jeton} />

      <div className="flex flex-col gap-2">
        <label className={LIBELLE} htmlFor="q-prenom">
          {L.prenom}
        </label>
        <Input id="q-prenom" name="prenom" required maxLength={80} autoComplete="given-name" />
      </div>
      <div className="flex flex-col gap-2">
        <label className={LIBELLE} htmlFor="q-lieu">
          {L.lieu}
        </label>
        <Input id="q-lieu" name="lieu" required maxLength={120} />
      </div>
      <div className="flex flex-col gap-2">
        <label className={LIBELLE} htmlFor="q-intitule">
          {L.intitule}
        </label>
        <Input id="q-intitule" name="intitule" required maxLength={120} />
      </div>
      <div className="flex flex-col gap-2">
        <label className={LIBELLE} htmlFor="q-presentation">
          {L.presentation}
        </label>
        <Textarea
          id="q-presentation"
          name="presentation"
          required
          minLength={QUESTIONS_COMMUNES_V1.presentationMin}
          maxLength={QUESTIONS_COMMUNES_V1.presentationMax}
          rows={7}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className={LIBELLE} htmlFor="q-apport">
          {L.apport}
        </label>
        <Textarea id="q-apport" name="apport" required maxLength={800} rows={5} />
      </div>
      <div className="flex flex-col gap-2">
        <label className={LIBELLE} htmlFor="q-langues">
          {L.langues} (séparées par des virgules)
        </label>
        <Input id="q-langues" name="langues" maxLength={200} />
      </div>

      {questions.map((q) => (
        <div key={q.id} className="flex flex-col gap-2">
          <label className={LIBELLE} htmlFor={`q-${q.id}`}>
            {q.libelle}
            {q.obligatoire ? "" : " (facultatif)"}
            {q.indexabilite !== undefined ? " — compte pour le référencement de votre page" : ""}
          </label>
          <Textarea
            id={`q-${q.id}`}
            name={`cat_${q.id}`}
            required={q.obligatoire}
            maxLength={q.max}
            rows={3}
          />
        </div>
      ))}

      <div className="flex flex-col gap-2">
        <label className={LIBELLE} htmlFor="q-linkedin">
          {L.linkedin}
        </label>
        <Input id="q-linkedin" name="linkedin" type="url" maxLength={512} inputMode="url" />
      </div>
      <div className="flex flex-col gap-2">
        <label className={LIBELLE} htmlFor="q-photo">
          Votre photo (facultative, JPEG, PNG ou WebP, 5 Mo au plus)
        </label>
        <input
          id="q-photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-fg text-sm"
        />
      </div>

      <fieldset className="border-border flex flex-col gap-4 rounded-lg border p-4">
        <legend className="text-fg px-1 text-sm font-medium">Vos accords, un par un</legend>
        <Case name="consent_publication" texte={c.publication.texte} required />
        <Case name="consent_photo" texte={c.photo.texte} />
        <Case name="consent_linkedin" texte={c.linkedin.texte} />
        <Case
          name="souhaitCarte"
          texte={L.souhaitCarte + " (l'équipe décide de l'afficher ou non)."}
        />
        <Case name="attestation" texte={TEAM_ATTESTATION_VERSION_COURANTE.texte} required />
      </fieldset>
    </>
  );
}
