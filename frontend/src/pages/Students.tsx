import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { useToast } from '../components/useToast';
import { apiFetch, errorMessageFromUnknown } from '../lib/api';
import { runDeferredEffect } from '../lib/run-deferred';

type Row = {
  id: string;
  fullName: string;
  active: boolean;
  _count?: { enrollments: number };
};

type SortKey = 'fullName' | 'active' | 'enrollments';
type SortDir = 'asc' | 'desc';

export default function Students() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [sortKey, setSortKey] = useState<SortKey>('fullName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const load = useCallback(async () => {
    setErr(null);
    const data = await apiFetch<Row[]>('/students?take=500');
    setRows(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    return runDeferredEffect(() => {
      void load().catch((e) => {
        const msg = errorMessageFromUnknown(e, 'Erro ao carregar alunos.');
        setErr(msg);
        toast.error(msg);
      });
    });
  }, [load, toast]);

  const filtered = useMemo(() => {
    let list = rows;

    if (statusFilter === 'active') list = list.filter((r) => r.active);
    else if (statusFilter === 'inactive') list = list.filter((r) => !r.active);

    const q = search.trim().toLowerCase();
    if (q) list = list.filter((r) => r.fullName.toLowerCase().includes(q));

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'fullName') {
        cmp = a.fullName.localeCompare(b.fullName, 'pt-BR');
      } else if (sortKey === 'active') {
        cmp = Number(b.active) - Number(a.active);
      } else if (sortKey === 'enrollments') {
        cmp = (b._count?.enrollments ?? 0) - (a._count?.enrollments ?? 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, search, statusFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={13} strokeWidth={2} aria-hidden style={{ opacity: 0.35 }} />;
    return sortDir === 'asc'
      ? <ArrowUp size={13} strokeWidth={2} aria-hidden />
      : <ArrowDown size={13} strokeWidth={2} aria-hidden />;
  };

  const activeCount = rows.filter((r) => r.active).length;
  const inactiveCount = rows.filter((r) => !r.active).length;

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Alunos</h1>
          <p className="page-header__subtitle">
            {activeCount} ativos · {inactiveCount} inativos
          </p>
        </div>
        {isAdmin ? (
          <Link to="/gestao" className="btn btn-secondary">
            Gerenciar cadastros
          </Link>
        ) : null}
      </header>

      {err ? (
        <Banner variant="danger" onDismiss={() => setErr(null)}>
          {err}
        </Banner>
      ) : null}

      {/* Filtros */}
      <div className="students-toolbar">
        <div className="students-search">
          <Search size={16} strokeWidth={2} aria-hidden className="students-search__icon" />
          <input
            className="students-search__input"
            type="search"
            placeholder="Buscar por nome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar aluno"
          />
        </div>
        <div className="students-filter-group" role="group" aria-label="Filtrar por status">
          {(['all', 'active', 'inactive'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`students-filter-btn${statusFilter === v ? ' students-filter-btn--active' : ''}`}
              onClick={() => setStatusFilter(v)}
            >
              {v === 'all' ? `Todos (${rows.length})` : v === 'active' ? `Ativos (${activeCount})` : `Inativos (${inactiveCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <p className="muted card card--lg">
          {search ? `Nenhum aluno encontrado para "${search}".` : 'Nenhum aluno nesta lista.'}
        </p>
      ) : (
        <div className="card card--lg" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    className="data-table__sort-btn"
                    onClick={() => toggleSort('fullName')}
                    aria-label="Ordenar por nome"
                  >
                    Nome <SortIcon col="fullName" />
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="data-table__sort-btn"
                    onClick={() => toggleSort('active')}
                    aria-label="Ordenar por status"
                  >
                    Status <SortIcon col="active" />
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="data-table__sort-btn"
                    onClick={() => toggleSort('enrollments')}
                    aria-label="Ordenar por turmas"
                  >
                    Turmas <SortIcon col="enrollments" />
                  </button>
                </th>
                <th style={{ width: '5rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link
                      to={`/alunos/${s.id}`}
                      style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', textDecoration: 'none' }}
                    >
                      {s.fullName}
                    </Link>
                  </td>
                  <td>
                    <span className={`badge ${s.active ? 'badge--ok' : 'badge--neutral'}`}>
                      {s.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="tabular-nums text-caption">
                    {s._count?.enrollments ?? 0} turma{(s._count?.enrollments ?? 0) !== 1 ? 's' : ''}
                  </td>
                  <td>
                    <Link
                      to={`/alunos/${s.id}`}
                      className="text-caption"
                      style={{ color: 'var(--accent-secondary)' }}
                    >
                      Ver ficha →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="data-table__footer">
            {filtered.length} aluno{filtered.length !== 1 ? 's' : ''} exibido{filtered.length !== 1 ? 's' : ''}
            {search || statusFilter !== 'all' ? ` (de ${rows.length} no total)` : ''}
          </div>
        </div>
      )}
    </div>
  );
}
