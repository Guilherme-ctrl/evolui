import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { formatDateBR } from '../lib/format-date';
import EvolutionList from '../components/EvolutionList';

type St = { id: string; fullName: string };
type Ch = {
  id: string;
  amountCents: number;
  dueDate: string;
  status: string;
};

function financeStatusHint(status: string): string {
  if (status === 'PAGO') return 'Pagamento confirmado pela escolinha.';
  if (status === 'ATRASADO') return 'Vencimento passou — regularize com a administração.';
  return 'Aguardando pagamento até a data de vencimento.';
}

export default function Filhos() {
  const [kids, setKids] = useState<St[]>([]);
  const [sel, setSel] = useState<string>('');
  const [charges, setCharges] = useState<Ch[]>([]);

  useEffect(() => {
    void apiFetch<St[]>('/students').then((s) => {
      setKids(s);
      if (s[0]) setSel(s[0].id);
    });
  }, []);

  useEffect(() => {
    if (!sel) return;
    void apiFetch<Ch[]>(`/finance/students/${sel}/extrato`).then(setCharges);
  }, [sel]);

  return (
    <div className="page stack field-mode">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Meus filhos</h1>
          <p className="page-header__subtitle">
            Extrato e status por atleta.{' '}
            <Link to="/avisos" className="text-caption">
              Ver avisos da escolinha
            </Link>
          </p>
        </div>
      </header>
      <label className="stack">
        <span className="muted">Atleta</span>
        <select value={sel} onChange={(e) => setSel(e.target.value)}>
          {kids.map((k) => (
            <option key={k.id} value={k.id}>
              {k.fullName}
            </option>
          ))}
        </select>
      </label>
      {sel ? (
        <p className="text-caption row" style={{ gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <Link to={`/filhos/${sel}`}>Abrir página do atleta (extrato + evolução)</Link>
          <Link to={`/filhos/${sel}/relatorios`}>Relatórios publicados</Link>
          <Link to="/midia">Mídia da escolinha</Link>
        </p>
      ) : null}
      <div className="card stack card--lg">
        <h2 className="text-h3">Extrato</h2>
        <ul className="plain">
          {charges.map((c) => (
            <li key={c.id} className="list-row">
              <p className="tabular-nums text-body" style={{ margin: 0 }}>
                R$ {(c.amountCents / 100).toFixed(2)} · venc. {formatDateBR(c.dueDate)}
              </p>
              <span
                className={`badge ${c.status === 'PAGO' ? 'badge--ok' : c.status === 'ATRASADO' ? 'badge--danger' : 'badge--warning'}`}
                style={{ marginTop: 'var(--space-2)' }}
              >
                {c.status === 'PAGO'
                  ? 'Pago'
                  : c.status === 'ATRASADO'
                    ? 'Atrasado'
                    : 'Pendente'}
              </span>
              <span className="text-caption muted" style={{ display: 'block' }}>
                {financeStatusHint(c.status)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {sel ? (
        <div className="card stack card--lg">
          <h2 className="text-h3">Evolução</h2>
          <EvolutionList studentId={sel} />
        </div>
      ) : null}
    </div>
  );
}
