import { useState, type FormEvent } from 'react';
import { errorMessageFromUnknown } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { Banner } from './Banner';
import { Modal } from './Modal';

const KINSHIP_OPTIONS = [
  'O próprio atleta',
  'Mãe',
  'Pai',
  'Responsável legal / Tutor',
  'Outro',
] as const;

/**
 * Modal exibido no 1º login da conta-atleta (RN-201). Adultos operando a
 * conta declaram o grau de parentesco; o backend registra `termsAcceptedAt`
 * e `termsKinship` (auditável para LGPD).
 */
export function TermsAcceptModal() {
  const { user, acceptTerms, logout } = useAuth();
  const [kinshipChoice, setKinshipChoice] = useState<string>(KINSHIP_OPTIONS[0]);
  const [kinshipOther, setKinshipOther] = useState('');
  const [acknowledge, setAcknowledge] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!user) return null;
  if (user.role !== 'ATLETA') return null;
  if (user.termsAcceptedAt) return null;

  const finalKinship =
    kinshipChoice === 'Outro' ? kinshipOther.trim() : kinshipChoice;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!finalKinship || finalKinship.length < 2) {
      setErr('Informe quem está usando esta conta.');
      return;
    }
    if (!acknowledge) {
      setErr('Confirme o aceite dos termos para continuar.');
      return;
    }
    setSubmitting(true);
    try {
      await acceptTerms(finalKinship);
    } catch (e2) {
      setErr(errorMessageFromUnknown(e2, 'Não foi possível registrar o aceite.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      title="Bem-vindo(a)! Aceite de termos"
      onClose={() => logout()}
      closeOnBackdrop={false}
      closeOnEscape={false}
    >
      <p style={{ margin: 0 }}>
        Olá, <strong>{user.fullName}</strong>. Para começar a usar o app é preciso
        confirmar quem está operando esta conta-atleta e aceitar os termos de uso e
        a política de privacidade (LGPD).
      </p>
      <form className="stack" style={{ gap: 'var(--space-4)' }} onSubmit={onSubmit}>
        <label className="stack">
          <span className="muted">Quem está usando esta conta?</span>
          <select
            value={kinshipChoice}
            onChange={(e) => setKinshipChoice(e.target.value)}
          >
            {KINSHIP_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        {kinshipChoice === 'Outro' ? (
          <label className="stack">
            <span className="muted">Descreva (ex.: Avó, Padrasto…)</span>
            <input
              value={kinshipOther}
              onChange={(e) => setKinshipOther(e.target.value)}
              minLength={2}
              maxLength={40}
              required
            />
          </label>
        ) : null}
        <label className="field-check">
          <input
            type="checkbox"
            checked={acknowledge}
            onChange={(e) => setAcknowledge(e.target.checked)}
          />
          <span>
            Li e concordo com os termos de uso e o tratamento de dados pessoais
            descritos na política de privacidade da escolinha.
          </span>
        </label>
        {err ? <Banner variant="danger">{err}</Banner> : null}
        <div className="row" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? 'Registrando…' : 'Aceitar e continuar'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => logout()}
          >
            Sair
          </button>
        </div>
      </form>
    </Modal>
  );
}
