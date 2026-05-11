import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { useToast } from '../components/useToast';
import { apiFetch, apiUrl, errorMessageFromUnknown, getToken } from '../lib/api';
import { runDeferredEffect } from '../lib/run-deferred';
import { formatDateBR, formatDateTimeBR } from '../lib/format-date';

type DelRow = {
  id: string;
  amountCents: number;
  dueDate: string;
  status: string;
  student: { id: string; fullName: string };
};

type Charge = {
  id: string;
  amountCents: number;
  dueDate: string;
  status: string;
  paidAt: string | null;
  paymentMethod: string | null;
  notes: string | null;
};

type St = { id: string; fullName: string };

function chargeBadgeClass(status: string) {
  if (status === 'PAGO') return 'badge badge--ok';
  if (status === 'ATRASADO') return 'badge badge--danger';
  return 'badge badge--warning';
}

/** Recibo sem popup: iframe oculto + print (evita document.write, bloqueador e políticas de janela em branco). */
function openReceipt(c: {
  studentName: string;
  amountCents: number;
  dueDate: string;
  paidAt: string;
  paymentMethod: string;
  chargeId: string;
}) {
  const ref = c.chargeId.length >= 8 ? `${c.chargeId.slice(0, 8)}…` : `${c.chargeId}…`;
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Recibo</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:28rem;margin:2rem auto;padding:1rem;border:1px solid #ccc;color:#111;background:#fff}
    h1{font-size:1.25rem} .muted{color:#555} .amt{font-size:1.5rem;font-weight:700}
    @media print{body{border:none;margin:0;padding:1rem}}
  </style></head><body>
  <h1>Recibo de pagamento</h1>
  <p class="muted">Escolinha — referência interna ${escapeHtml(ref)}</p>
  <p><strong>Aluno:</strong> ${escapeHtml(c.studentName)}</p>
  <p><strong>Vencimento:</strong> ${escapeHtml(c.dueDate)}</p>
  <p class="amt">R$ ${(c.amountCents / 100).toFixed(2)}</p>
  <p><strong>Pago em:</strong> ${escapeHtml(c.paidAt)}</p>
  <p><strong>Forma:</strong> ${escapeHtml(c.paymentMethod)}</p>
  <p class="muted" style="margin-top:2rem">Documento gerado pelo sistema. Use o diálogo do navegador para imprimir ou salvar em PDF.</p>
  </body></html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Recibo de pagamento');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
  iframe.srcdoc = html;

  const cleanup = () => {
    try {
      iframe.remove();
    } catch {
      /* ignore */
    }
  };

  let printed = false;
  const runPrint = () => {
    if (printed) return;
    printed = true;
    try {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        return;
      }
      win.focus();
      win.print();
    } catch (e) {
      console.warn('Recibo: impressão indisponível neste navegador.', e);
    } finally {
      window.setTimeout(cleanup, 2500);
    }
  };

  iframe.onload = () => {
    window.setTimeout(runPrint, 150);
  };

  document.body.appendChild(iframe);

  /* Se onload não disparar (edge cases), tenta uma vez após carregar o srcdoc. */
  window.setTimeout(() => {
    if (!printed) runPrint();
  }, 800);
}

type BulkReceiptItem = { studentName: string; amountCents: number; dueDate: string };

function openBulkReceipt(c: {
  items: BulkReceiptItem[];
  paymentMethod: string;
  paidAt: string;
}) {
  const total = c.items.reduce((acc, x) => acc + x.amountCents, 0);
  const rows = c.items
    .map(
      (x) =>
        `<tr><td>${escapeHtml(x.studentName)}</td><td>${escapeHtml(formatDateBR(x.dueDate))}</td><td class="tabular-nums">R$ ${(x.amountCents / 100).toFixed(2)}</td></tr>`,
    )
    .join('');
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Recibo — lote</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:36rem;margin:2rem auto;padding:1rem;color:#111;background:#fff}
    h1{font-size:1.25rem} .muted{color:#555} table{width:100%;border-collapse:collapse;margin-top:1rem}
    th,td{border:1px solid #ccc;padding:0.5rem;text-align:left;font-size:0.9rem}
    th{background:#f3f4f6} .total{font-size:1.25rem;font-weight:700;margin-top:1rem}
    @media print{body{border:none;margin:0}}
  </style></head><body>
  <h1>Recibo — baixa em lote</h1>
  <p class="muted">Pago em ${escapeHtml(c.paidAt)} · Forma: ${escapeHtml(c.paymentMethod)}</p>
  <table><thead><tr><th>Aluno</th><th>Vencimento</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="total tabular-nums">Total: R$ ${(total / 100).toFixed(2)}</p>
  <p class="muted" style="margin-top:1.5rem">Documento gerado pelo sistema.</p>
  </body></html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Recibo em lote');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
  iframe.srcdoc = html;
  let printed = false;
  const cleanup = () => {
    try {
      iframe.remove();
    } catch {
      /* ignore */
    }
  };
  const runPrint = () => {
    if (printed) return;
    printed = true;
    try {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        return;
      }
      win.focus();
      win.print();
    } catch (e) {
      console.warn('Recibo lote:', e);
    } finally {
      window.setTimeout(cleanup, 2500);
    }
  };
  iframe.onload = () => window.setTimeout(runPrint, 150);
  document.body.appendChild(iframe);
  window.setTimeout(() => {
    if (!printed) runPrint();
  }, 800);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type Tab = 'inadimplencia' | 'cobrancas' | 'historico';

export default function Finance() {
  const toast = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('inadimplencia');
  const [delRows, setDelRows] = useState<DelRow[]>([]);
  const [students, setStudents] = useState<St[]>([]);
  const [histStudent, setHistStudent] = useState('');
  const [histCharges, setHistCharges] = useState<Charge[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const reportFinanceErr = useCallback(
    (e: unknown, fallback: string) => {
      const msg = errorMessageFromUnknown(e, fallback);
      setErr(msg);
      toast.error(msg);
    },
    [toast],
  );

  const [singleStudent, setSingleStudent] = useState('');
  const [singleAmountReais, setSingleAmountReais] = useState('');
  const [singleDue, setSingleDue] = useState('');
  const [singleNotes, setSingleNotes] = useState('');

  const [bulkStudent, setBulkStudent] = useState('');
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkDay, setBulkDay] = useState(10);
  const [bulkMonths, setBulkMonths] = useState(6);
  const [bulkStart, setBulkStart] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<{
    id: string;
    studentName: string;
    amountCents: number;
    dueDate: string;
  } | null>(null);
  const [payMethod, setPayMethod] = useState('PIX');
  const [payNotes, setPayNotes] = useState('');

  const [selectedDelIds, setSelectedDelIds] = useState<string[]>([]);
  const [selectedHistIds, setSelectedHistIds] = useState<string[]>([]);
  const [payBulkOpen, setPayBulkOpen] = useState(false);
  const [payBulkRows, setPayBulkRows] = useState<DelRow[]>([]);

  const [revOpen, setRevOpen] = useState(false);
  const [revTarget, setRevTarget] = useState<Charge & { studentName: string } | null>(
    null,
  );
  const [revReason, setRevReason] = useState('');

  const loadDelinquency = useCallback(async () => {
    const rows = await apiFetch<DelRow[]>('/finance/delinquency');
    const list = Array.isArray(rows) ? rows : [];
    setDelRows(list);
    setSelectedDelIds((ids) => ids.filter((id) => list.some((r) => r.id === id)));
  }, []);

  const loadStudents = useCallback(async () => {
    const raw = await apiFetch<Record<string, unknown>[]>('/students?take=200');
    const arr = Array.isArray(raw) ? raw : [];
    const list = arr.map((r) => ({
      id: r.id as string,
      fullName: r.fullName as string,
    }));
    setStudents(list);
    setSingleStudent((s) => s || list[0]?.id || '');
    setBulkStudent((s) => s || list[0]?.id || '');
    setHistStudent((s) => s || list[0]?.id || '');
  }, []);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    return runDeferredEffect(() => {
      void loadStudents().catch((e) => reportFinanceErr(e, 'Erro ao carregar alunos.'));
    });
  }, [user?.role, loadStudents, reportFinanceErr]);

  useEffect(() => {
    if (user?.role !== 'ADMIN' || tab !== 'inadimplencia') return;
    return runDeferredEffect(() => {
      void loadDelinquency().catch((e) => reportFinanceErr(e, 'Erro ao carregar inadimplência.'));
    });
  }, [user?.role, tab, loadDelinquency, reportFinanceErr]);

  useEffect(() => {
    if (user?.role !== 'ADMIN' || tab !== 'historico' || !histStudent) return;
    return runDeferredEffect(() => {
      void apiFetch<Charge[]>(`/finance/students/${histStudent}/extrato`)
        .then((rows) => {
          const list = Array.isArray(rows) ? rows : [];
          setHistCharges(list);
          setSelectedHistIds((ids) => ids.filter((id) => list.some((c) => c.id === id)));
        })
        .catch((e) => reportFinanceErr(e, 'Erro ao carregar extrato.'));
    });
  }, [user?.role, tab, histStudent, reportFinanceErr]);

  const selectTab = (t: Tab) => {
    setTab(t);
    setErr(null);
    setSelectedDelIds([]);
    setSelectedHistIds([]);
    setPayBulkOpen(false);
    setPayBulkRows([]);
  };

  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;

  const studentName = (id: string) =>
    students.find((s) => s.id === id)?.fullName ?? '—';

  const exportCsv = async () => {
    setErr(null);
    try {
      const token = getToken();
      const res = await fetch(apiUrl('/finance/delinquency/export.csv'), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Falha ao exportar CSV');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inadimplencia-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV baixado.');
    } catch (e) {
      reportFinanceErr(e, 'Falha ao exportar CSV.');
    }
  };

  const syncOverdue = async () => {
    setErr(null);
    try {
      await apiFetch('/finance/sync-overdue', { method: 'POST' });
      toast.success('Status de atraso atualizado.');
      await loadDelinquency();
    } catch (e) {
      reportFinanceErr(e, 'Não foi possível atualizar atrasos.');
    }
  };

  const submitSingle = async () => {
    setErr(null);
    const reais = Number(singleAmountReais.replace(',', '.'));
    if (!singleStudent || !singleDue || Number.isNaN(reais) || reais <= 0) {
      setErr('Preencha aluno, valor e vencimento.');
      return;
    }
    const amountCents = Math.round(reais * 100);
    try {
      await apiFetch('/finance/charges', {
        method: 'POST',
        body: JSON.stringify({
          studentId: singleStudent,
          amountCents,
          dueDate: singleDue,
          notes: singleNotes.trim() || undefined,
        }),
      });
      toast.success('Cobrança criada.');
      setSingleAmountReais('');
      setSingleNotes('');
      await loadDelinquency();
    } catch (e) {
      reportFinanceErr(e, 'Não foi possível criar a cobrança.');
    }
  };

  const submitBulk = async () => {
    setErr(null);
    const reais = Number(bulkAmount.replace(',', '.'));
    if (!bulkStudent || Number.isNaN(reais) || reais <= 0) {
      setErr('Preencha aluno e valor da mensalidade.');
      return;
    }
    try {
      await apiFetch('/finance/charges/bulk', {
        method: 'POST',
        body: JSON.stringify({
          studentId: bulkStudent,
          amountCents: Math.round(reais * 100),
          dueDayOfMonth: bulkDay,
          months: bulkMonths,
          startMonth: bulkStart,
        }),
      });
      toast.success('Parcelas geradas.');
      await loadDelinquency();
    } catch (e) {
      reportFinanceErr(e, 'Não foi possível gerar as parcelas.');
    }
  };

  const submitPay = async () => {
    if (!payTarget) return;
    setErr(null);
    const snapshot = { ...payTarget };
    try {
      const updated = await apiFetch<Charge>(`/finance/charges/${snapshot.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod: payMethod,
          notes: payNotes.trim() || undefined,
        }),
      });
      setPayOpen(false);
      setPayTarget(null);
      toast.success('Pagamento registrado.');
      await loadDelinquency();
      if (histStudent) {
        try {
          setHistCharges(await apiFetch<Charge[]>(`/finance/students/${histStudent}/extrato`));
        } catch {
          /* extrato é secundário; não quebra o fluxo */
        }
      }
      if (updated?.paidAt) {
        try {
          openReceipt({
            studentName: snapshot.studentName,
            amountCents: snapshot.amountCents,
            dueDate: formatDateBR(snapshot.dueDate),
            paidAt: formatDateTimeBR(updated.paidAt),
            paymentMethod: payMethod,
            chargeId: snapshot.id,
          });
        } catch (e) {
          console.warn('Recibo:', e);
        }
      }
    } catch (e) {
      reportFinanceErr(e, 'Não foi possível registrar o pagamento.');
    }
  };

  const toggleDelSelected = (id: string) => {
    setSelectedDelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAllDel = () => {
    setSelectedDelIds(delRows.map((r) => r.id));
  };

  const clearDelSelection = () => {
    setSelectedDelIds([]);
  };

  const selectAllHistPending = () => {
    setSelectedHistIds(
      histCharges
        .filter((c) => c.status === 'PENDENTE' || c.status === 'ATRASADO')
        .map((c) => c.id),
    );
  };

  const clearHistSelection = () => {
    setSelectedHistIds([]);
  };

  const toggleHistSelected = (id: string) => {
    setSelectedHistIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const openBulkPayFromDel = () => {
    const rows = delRows.filter((r) => selectedDelIds.includes(r.id));
    if (rows.length === 0) return;
    setPayBulkRows(rows);
    setPayNotes('');
    setPayBulkOpen(true);
  };

  const openBulkPayFromHist = () => {
    const name = studentName(histStudent);
    const rows: DelRow[] = histCharges
      .filter(
        (c) =>
          selectedHistIds.includes(c.id) &&
          (c.status === 'PENDENTE' || c.status === 'ATRASADO'),
      )
      .map((c) => ({
        id: c.id,
        amountCents: c.amountCents,
        dueDate: c.dueDate,
        status: c.status,
        student: { id: histStudent, fullName: name },
      }));
    if (rows.length === 0) return;
    setPayBulkRows(rows);
    setPayNotes('');
    setPayBulkOpen(true);
  };

  const submitPayBulk = async () => {
    if (payBulkRows.length === 0) return;
    setErr(null);
    const snapshot = [...payBulkRows];
    const ids = snapshot.map((r) => r.id);
    try {
      const res = await apiFetch<{ count: number; paidAt: string }>(
        '/finance/charges/pay-bulk',
        {
          method: 'POST',
          body: JSON.stringify({
            chargeIds: ids,
            paymentMethod: payMethod,
            notes: payNotes.trim() || undefined,
          }),
        },
      );
      setPayBulkOpen(false);
      setPayBulkRows([]);
      setSelectedDelIds([]);
      setSelectedHistIds([]);
      toast.success(`${res.count} pagamento(s) registrado(s).`);
      await loadDelinquency();
      if (histStudent) {
        try {
          setHistCharges(await apiFetch<Charge[]>(`/finance/students/${histStudent}/extrato`));
        } catch {
          /* ignore */
        }
      }
      try {
        openBulkReceipt({
          items: snapshot.map((r) => ({
            studentName: r.student?.fullName ?? 'Aluno',
            amountCents: r.amountCents,
            dueDate: r.dueDate,
          })),
          paymentMethod: payMethod,
          paidAt: formatDateTimeBR(res.paidAt),
        });
      } catch (e) {
        console.warn('Recibo lote:', e);
      }
    } catch (e) {
      reportFinanceErr(e, 'Não foi possível registrar os pagamentos em lote.');
    }
  };

  const submitRevert = async () => {
    if (!revTarget || !revReason.trim()) {
      setErr('Informe o motivo da reversão.');
      return;
    }
    setErr(null);
    try {
      await apiFetch(`/finance/charges/${revTarget.id}/revert`, {
        method: 'POST',
        body: JSON.stringify({ reason: revReason.trim() }),
      });
      setRevOpen(false);
      setRevTarget(null);
      setRevReason('');
      toast.success('Cobrança revertida (auditoria registrada).');
      await loadDelinquency();
      if (histStudent) {
        try {
          setHistCharges(await apiFetch<Charge[]>(`/finance/students/${histStudent}/extrato`));
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      reportFinanceErr(e, 'Não foi possível reverter a cobrança.');
    }
  };

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Financeiro</h1>
          <p className="page-header__subtitle">
            Valores em reais na tela; API trabalha em centavos (CA-12.03).
          </p>
        </div>
      </header>

      <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {(['inadimplencia', 'cobrancas', 'historico'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => selectTab(t)}
          >
            {t === 'inadimplencia'
              ? 'Inadimplência'
              : t === 'cobrancas'
                ? 'Cobranças'
                : 'Histórico por aluno'}
          </button>
        ))}
      </div>

      {err ? (
        <Banner variant="danger" onDismiss={() => setErr(null)}>
          {err}
        </Banner>
      ) : null}

      {tab === 'inadimplencia' ? (
        <>
          <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={() => void exportCsv()}>
              Exportar CSV
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void syncOverdue()}>
              Atualizar atrasos (sync)
            </button>
            <Link to="/gestao" className="btn btn-ghost">
              Gestão de alunos
            </Link>
            {delRows.length > 0 ? (
              <>
                <span className="muted text-caption" style={{ width: '100%', flexBasis: '100%' }}>
                  Selecione várias cobranças e use baixa em lote com a mesma forma de pagamento.
                </span>
                <button type="button" className="btn btn-secondary" onClick={() => selectAllDel()}>
                  Selecionar todas
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => clearDelSelection()}>
                  Limpar seleção
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={selectedDelIds.length === 0}
                  onClick={() => openBulkPayFromDel()}
                >
                  Baixa em lote ({selectedDelIds.length})
                </button>
              </>
            ) : null}
          </div>
          {delRows.length === 0 ? (
            <p className="muted card card--lg">
              Nenhuma cobrança pendente ou atrasada no momento. Ótimo sinal — ou ainda não há
              competências cadastradas.
            </p>
          ) : (
            <ul className="plain card card--lg stack" style={{ gap: 'var(--space-4)' }}>
              {delRows.map((r) => (
                <li
                  key={r.id}
                  className="stack card"
                  style={{
                    padding: 'var(--space-4)',
                    background: 'var(--bg-muted)',
                    borderRadius: 'var(--radius-card)',
                  }}
                >
                  <div
                    className="row finance-del-row"
                    style={{
                      alignItems: 'flex-start',
                      gap: 'var(--space-3)',
                      width: '100%',
                      flexWrap: 'nowrap',
                    }}
                  >
                    <input
                      type="checkbox"
                      className="finance-del-row__cb"
                      checked={selectedDelIds.includes(r.id)}
                      onChange={() => toggleDelSelected(r.id)}
                      aria-label={`Selecionar cobrança: ${r.student?.fullName ?? 'aluno'}`}
                    />
                    <div className="stack" style={{ flex: '1 1 auto', minWidth: 0, gap: 'var(--space-3)' }}>
                      <div
                        className="row"
                        style={{
                          justifyContent: 'space-between',
                          width: '100%',
                          flexWrap: 'wrap',
                          gap: 'var(--space-3)',
                        }}
                      >
                        <div>
                          <strong>{r.student?.fullName ?? 'Aluno'}</strong>
                          <p className="text-caption muted" style={{ margin: 0 }}>
                            {r.student?.id ? (
                              <Link to={`/alunos/${r.student.id}`}>Ficha do aluno</Link>
                            ) : null}
                          </p>
                        </div>
                        <span className={chargeBadgeClass(r.status)}>{r.status}</span>
                      </div>
                      <p className="text-body tabular-nums" style={{ margin: 0 }}>
                        R$ {(r.amountCents / 100).toFixed(2)} · venc. {formatDateBR(r.dueDate)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setPayTarget({
                        id: r.id,
                        studentName: r.student?.fullName ?? 'Aluno',
                        amountCents: r.amountCents,
                        dueDate: r.dueDate,
                      });
                      setPayOpen(true);
                    }}
                  >
                    Registrar pagamento
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {tab === 'cobrancas' ? (
        <div className="stack" style={{ gap: 'var(--space-6)' }}>
          <div className="card card--lg stack">
            <h2 className="text-h3">Nova cobrança avulsa</h2>
            <label className="stack">
              <span className="muted">Aluno</span>
              <select value={singleStudent} onChange={(e) => setSingleStudent(e.target.value)}>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack">
              <span className="muted">Valor (R$)</span>
              <input
                inputMode="decimal"
                value={singleAmountReais}
                onChange={(e) => setSingleAmountReais(e.target.value)}
                placeholder="150,00"
              />
            </label>
            <label className="stack">
              <span className="muted">Vencimento</span>
              <input
                type="date"
                lang="pt-BR"
                value={singleDue}
                onChange={(e) => setSingleDue(e.target.value)}
              />
            </label>
            <label className="stack">
              <span className="muted">Observações (opcional)</span>
              <input value={singleNotes} onChange={(e) => setSingleNotes(e.target.value)} />
            </label>
            <button type="button" className="btn btn-primary" onClick={() => void submitSingle()}>
              Criar cobrança
            </button>
          </div>

          <div className="card card--lg stack">
            <h2 className="text-h3">Mensalidades em lote</h2>
            <p className="text-caption muted" style={{ margin: 0 }}>
              Gera N parcelas com o mesmo valor, dia de vencimento no mês e competências
              consecutivas a partir do mês inicial (ROT-FIN-01 simplificado).
            </p>
            <label className="stack">
              <span className="muted">Aluno</span>
              <select value={bulkStudent} onChange={(e) => setBulkStudent(e.target.value)}>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack">
              <span className="muted">Valor mensal (R$)</span>
              <input
                inputMode="decimal"
                value={bulkAmount}
                onChange={(e) => setBulkAmount(e.target.value)}
              />
            </label>
            <div className="row" style={{ gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <label className="stack" style={{ flex: '1 1 8rem' }}>
                <span className="muted">Dia do vencimento (1–28)</span>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={bulkDay}
                  onChange={(e) => setBulkDay(Number(e.target.value))}
                />
              </label>
              <label className="stack" style={{ flex: '1 1 8rem' }}>
                <span className="muted">Quantidade de meses</span>
                <input
                  type="number"
                  min={1}
                  max={36}
                  value={bulkMonths}
                  onChange={(e) => setBulkMonths(Number(e.target.value))}
                />
              </label>
              <label className="stack" style={{ flex: '1 1 10rem' }}>
                <span className="muted">Primeiro mês (YYYY-MM)</span>
                <input
                  type="month"
                  value={bulkStart}
                  onChange={(e) => setBulkStart(e.target.value)}
                />
              </label>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => void submitBulk()}>
              Gerar parcelas
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'historico' ? (
        <div className="stack">
          <label className="stack">
            <span className="muted">Aluno</span>
            <select value={histStudent} onChange={(e) => setHistStudent(e.target.value)}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
          </label>
          {histCharges.some((c) => c.status === 'PENDENTE' || c.status === 'ATRASADO') ? (
            <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
              <button type="button" className="btn btn-secondary" onClick={() => selectAllHistPending()}>
                Selecionar pendentes
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => clearHistSelection()}>
                Limpar seleção
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={selectedHistIds.length === 0}
                onClick={() => openBulkPayFromHist()}
              >
                Baixa em lote ({selectedHistIds.length})
              </button>
            </div>
          ) : null}
          {histCharges.length === 0 ? (
            <p className="muted card card--lg">Sem cobranças para este aluno ainda.</p>
          ) : (
            <ul className="plain card card--lg stack" style={{ gap: 'var(--space-4)' }}>
              {histCharges.map((c) => (
                <li key={c.id} className="list-row stack" style={{ gap: 'var(--space-2)' }}>
                  <div
                    className="row finance-del-row"
                    style={{ alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'nowrap' }}
                  >
                    {c.status === 'PENDENTE' || c.status === 'ATRASADO' ? (
                      <input
                        type="checkbox"
                        className="finance-del-row__cb"
                        checked={selectedHistIds.includes(c.id)}
                        onChange={() => toggleHistSelected(c.id)}
                        aria-label={`Selecionar cobrança venc. ${formatDateBR(c.dueDate)}`}
                      />
                    ) : (
                      <span className="finance-del-row__spacer" aria-hidden />
                    )}
                    <div className="stack" style={{ flex: '1 1 auto', minWidth: 0, gap: 'var(--space-2)' }}>
                      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <span className="tabular-nums text-body">
                          R$ {(c.amountCents / 100).toFixed(2)} · venc. {formatDateBR(c.dueDate)}
                        </span>
                        <span className={chargeBadgeClass(c.status)}>{c.status}</span>
                      </div>
                      {c.paidAt ? (
                        <span className="text-caption muted">
                          Pago em {formatDateTimeBR(c.paidAt)}
                          {c.paymentMethod ? ` · ${c.paymentMethod}` : ''}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    {c.status === 'PENDENTE' || c.status === 'ATRASADO' ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          setPayTarget({
                            id: c.id,
                            studentName: studentName(histStudent),
                            amountCents: c.amountCents,
                            dueDate: c.dueDate,
                          });
                          setPayOpen(true);
                        }}
                      >
                        Registrar pagamento
                      </button>
                    ) : null}
                    {c.status === 'PAGO' ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            if (!c.paidAt) return;
                            openReceipt({
                              studentName: studentName(histStudent),
                              amountCents: c.amountCents,
                              dueDate: formatDateBR(c.dueDate),
                              paidAt: formatDateTimeBR(c.paidAt),
                              paymentMethod: c.paymentMethod ?? '—',
                              chargeId: c.id,
                            });
                          }}
                        >
                          Recibo (imprimir)
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            setRevTarget({ ...c, studentName: studentName(histStudent) });
                            setRevOpen(true);
                          }}
                        >
                          Reverter para pendente
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {payOpen && payTarget ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 200,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 'var(--space-4)',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pay-title"
        >
          <div className="card card--lg stack" style={{ maxWidth: '24rem', width: '100%' }}>
            <h2 id="pay-title" className="text-h3">
              Registrar pagamento
            </h2>
            <p className="text-caption">
              {payTarget.studentName} · R$ {(payTarget.amountCents / 100).toFixed(2)} · venc.{' '}
              {formatDateBR(payTarget.dueDate)}
            </p>
            <label className="stack">
              <span className="muted">Forma de pagamento</span>
              <input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} />
            </label>
            <label className="stack">
              <span className="muted">Observações (opcional)</span>
              <input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
            </label>
            <div className="row" style={{ gap: 'var(--space-3)' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setPayOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void submitPay()}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {payBulkOpen && payBulkRows.length > 0 ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 200,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 'var(--space-4)',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pay-bulk-title"
        >
          <div
            className="card card--lg stack"
            style={{ maxWidth: '28rem', width: '100%', maxHeight: '90vh', overflow: 'auto' }}
          >
            <h2 id="pay-bulk-title" className="text-h3">
              Baixa em lote
            </h2>
            <p className="text-caption">
              {payBulkRows.length} cobrança(s) · total{' '}
              <strong className="tabular-nums">
                R${' '}
                {(payBulkRows.reduce((sum, r) => sum + r.amountCents, 0) / 100).toFixed(2)}
              </strong>
            </p>
            <ul
              className="plain stack text-caption muted"
              style={{
                gap: 'var(--space-2)',
                maxHeight: '12rem',
                overflow: 'auto',
                padding: 'var(--space-2)',
                border: '1px solid var(--border-subtle, #e5e5e5)',
                borderRadius: 'var(--radius-md, 8px)',
              }}
            >
              {payBulkRows.map((r) => (
                <li key={r.id} className="tabular-nums">
                  {r.student?.fullName ?? '—'} · R$ {(r.amountCents / 100).toFixed(2)} · venc.{' '}
                  {formatDateBR(r.dueDate)}
                </li>
              ))}
            </ul>
            <label className="stack">
              <span className="muted">Forma de pagamento (todas)</span>
              <input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} />
            </label>
            <label className="stack">
              <span className="muted">Observações (opcional, comum a todas)</span>
              <input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
            </label>
            <div className="row" style={{ gap: 'var(--space-3)' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setPayBulkOpen(false);
                  setPayBulkRows([]);
                }}
              >
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void submitPayBulk()}>
                Confirmar baixa
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {revOpen && revTarget ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 200,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 'var(--space-4)',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="card card--lg stack" style={{ maxWidth: '24rem', width: '100%' }}>
            <h2 className="text-h3">Reverter pagamento</h2>
            <p className="text-caption">
              {revTarget.studentName} · o status voltará para pendente ou atrasado conforme o
              vencimento. O motivo fica na auditoria.
            </p>
            <label className="stack">
              <span className="muted">Motivo (obrigatório)</span>
              <textarea
                rows={4}
                value={revReason}
                onChange={(e) => setRevReason(e.target.value)}
                placeholder="Ex.: lançamento duplicado, estorno acordado com a família…"
              />
            </label>
            <div className="row" style={{ gap: 'var(--space-3)' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setRevOpen(false);
                  setRevReason('');
                }}
              >
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={() => void submitRevert()}>
                Reverter
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
