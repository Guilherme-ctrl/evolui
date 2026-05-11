import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { useToast } from '../components/useToast';
import { apiFetch, errorMessageFromUnknown } from '../lib/api';
import { formatDateBR } from '../lib/format-date';
import { formatCpfBr } from '../lib/format-cpf';
import {
  studentNeedsGuardianLink,
  useGestaoDirectoryData,
  type GuardianFull,
  type StudentListItem,
  type TurmaRow,
} from './gestao/useGestaoDirectoryData';

const STUDENT_DOC_TYPES = [
  { value: '', label: 'Sem documento' },
  { value: 'CPF', label: 'CPF' },
  { value: 'RG', label: 'RG' },
  { value: 'RNE', label: 'RNE / passaporte' },
  { value: 'OUTRO', label: 'Outro documento' },
] as const;

type EnrollResponse = {
  id: string;
  warnings?: string[];
};

const SECOES = ['cadastro', 'turma', 'matricula'] as const;
type Secao = (typeof SECOES)[number];

function isSecao(s: string | null): s is Secao {
  return s !== null && SECOES.includes(s as Secao);
}

const LEGACY_SECOES = new Set(['aluno', 'responsavel', 'vinculo']);

function birthInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function GestaoStat({
  label,
  value,
  variant,
}: {
  label: string;
  value: string | number;
  variant?: 'default' | 'warning' | 'success';
}) {
  const mod =
    variant === 'warning'
      ? ' gestao-stat--warning'
      : variant === 'success'
        ? ' gestao-stat--success'
        : '';
  return (
    <div className={`gestao-stat${mod}`}>
      <span className="gestao-stat__value tabular-nums">{value}</span>
      <span className="gestao-stat__label">{label}</span>
    </div>
  );
}

function GuardianDirectory({
  guardians,
  onEdit,
  onRequestDelete,
}: {
  guardians: GuardianFull[];
  onEdit?: (g: GuardianFull) => void;
  onRequestDelete?: (g: GuardianFull) => void;
}) {
  if (!guardians.length) {
    return (
      <div className="card card--lg stack guardian-directory">
        <h3 className="text-h3">Responsáveis cadastrados</h3>
        <p className="muted" style={{ margin: 0 }}>
          Nenhum responsável ainda. Cadastre acima para obter dados de contato e cobrança.
        </p>
      </div>
    );
  }
  return (
    <div className="card card--lg stack guardian-directory">
      <h3 className="text-h3">Responsáveis cadastrados</h3>
      <p className="muted" style={{ margin: 0 }}>
        Contato e dados para cobrança. Na inclusão completa ou ao vincular, marque quem é{' '}
        <strong>principal para cobrança</strong>.
      </p>
      <ul className="plain guardian-directory__list">
        {guardians.map((g) => (
          <li key={g.id} className="guardian-directory__row">
            <div className="gestao-directory__row-top">
              <strong className="guardian-directory__name">{g.fullName}</strong>
              <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {onEdit ? (
                  <button type="button" className="btn btn-secondary" onClick={() => onEdit(g)}>
                    Editar
                  </button>
                ) : null}
                {onRequestDelete ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ borderColor: 'var(--state-danger)', color: 'var(--state-danger)' }}
                    onClick={() => onRequestDelete(g)}
                  >
                    Excluir
                  </button>
                ) : null}
              </div>
            </div>
            <div className="guardian-directory__fields">
              {g.kinship ? (
                <span>
                  <span className="muted">Parentesco</span> {g.kinship}
                </span>
              ) : null}
              {g.phone ? (
                <span>
                  <span className="muted">Telefone</span> {g.phone}
                </span>
              ) : null}
              {g.whatsapp ? (
                <span>
                  <span className="muted">WhatsApp</span> {g.whatsapp}
                </span>
              ) : null}
              {g.email ? (
                <span>
                  <span className="muted">E-mail</span> {g.email}
                </span>
              ) : null}
              {g.cpf ? (
                <span>
                  <span className="muted">CPF</span> {g.cpf}
                </span>
              ) : null}
              {g.address ? (
                <span className="guardian-directory__full">
                  <span className="muted">Endereço</span> {g.address}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Gestao() {
  const toast = useToast();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSecao = searchParams.get('secao');
  const secao: Secao =
    rawSecao && LEGACY_SECOES.has(rawSecao)
      ? 'cadastro'
      : isSecao(rawSecao)
        ? rawSecao
        : 'cadastro';

  const { students, guardians, turmas, coaches, directoryLoading, reloadAll } = useGestaoDirectoryData();
  const newEntryFormRef = useRef<HTMLDivElement>(null);
  const vincularDetailsRef = useRef<HTMLDetailsElement>(null);
  const errPageBannerRef = useRef<HTMLDivElement>(null);
  const [vincularPanelOpen, setVincularPanelOpen] = useState(false);
  const didInitEntryFormOpen = useRef(false);
  /** Formulário longo: abre só em tenant vazio após carregar diretório; usuário pode recolher e reabrir. */
  const [entryFormOpen, setEntryFormOpen] = useState(false);
  useEffect(() => {
    if (directoryLoading || didInitEntryFormOpen.current) return;
    didInitEntryFormOpen.current = true;
    setEntryFormOpen(students.length === 0 && guardians.length === 0);
  }, [directoryLoading, students.length, guardians.length]);

  useEffect(() => {
    if (rawSecao && LEGACY_SECOES.has(rawSecao)) {
      setSearchParams({ secao: 'cadastro' }, { replace: true });
    }
  }, [rawSecao, setSearchParams]);

  const [err, setErr] = useState<string | null>(null);
  /** Evita clique duplo no fluxo «Novo aluno» / «Só aluno» / «Só responsável». */
  const [entryFormBusy, setEntryFormBusy] = useState(false);

  const notifyApiError = useCallback((ex: unknown, fallback: string) => {
    const msg = errorMessageFromUnknown(ex, fallback);
    setErr(msg);
    toast.error(msg);
  }, [toast]);

  useEffect(() => {
    if (!err) return;
    errPageBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [err]);

  const setSecao = useCallback(
    (s: Secao) => {
      setErr(null);
      setSearchParams({ secao: s });
    },
    [setSearchParams, setErr],
  );

  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [preferredPosition, setPreferredPosition] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [physicalRestrictions, setPhysicalRestrictions] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  // No modelo ATLETA, todo aluno tem uma conta-atleta (Student.accountUser).
  // Para irmãos compartilhando conta, use depois `PATCH /students/:id/account-user`.
  const [studentIsAccountHolder, setStudentIsAccountHolder] = useState(true);
  const [accountHolderEmail, setAccountHolderEmail] = useState('');
  const [accountHolderPassword, setAccountHolderPassword] = useState('');

  const [gFullName, setGFullName] = useState('');
  const [gEmail, setGEmail] = useState('');
  const [gPhone, setGPhone] = useState('');
  const [gWhatsapp, setGWhatsapp] = useState('');
  const [gKinship, setGKinship] = useState('');
  const [gCpf, setGCpf] = useState('');
  const [gAddress, setGAddress] = useState('');

  const [linkStudentId, setLinkStudentId] = useState('');
  const [linkGuardianId, setLinkGuardianId] = useState('');
  const [linkPrimary, setLinkPrimary] = useState(true);

  /** Fluxo principal: novo cadastro de responsável ou escolher um da lista */
  const [familyGuardianMode, setFamilyGuardianMode] = useState<'new' | 'existing'>('new');
  const [familyPickGuardianId, setFamilyPickGuardianId] = useState('');

  const [tName, setTName] = useState('');
  const [tCapacity, setTCapacity] = useState(20);
  const [coachUserId, setCoachUserId] = useState('');
  const [tCategoryLabel, setTCategoryLabel] = useState('');
  const [ageRangeText, setAgeRangeText] = useState('');
  const [weekDaysText, setWeekDaysText] = useState('');
  const [scheduleText, setScheduleText] = useState('');
  const [location, setLocation] = useState('');

  const [enrollTurmaId, setEnrollTurmaId] = useState('');
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrollWarningsBanner, setEnrollWarningsBanner] = useState<string[] | null>(null);

  const [editStudent, setEditStudent] = useState<StudentListItem | null>(null);
  const [esFullName, setEsFullName] = useState('');
  const [esBirth, setEsBirth] = useState('');
  const [esCategory, setEsCategory] = useState('');
  const [esPreferredPosition, setEsPreferredPosition] = useState('');
  const [esEmergencyContact, setEsEmergencyContact] = useState('');
  const [esMedicalNotes, setEsMedicalNotes] = useState('');
  const [esPhysicalRestrictions, setEsPhysicalRestrictions] = useState('');
  const [esDocumentType, setEsDocumentType] = useState('');
  const [esDocumentNumber, setEsDocumentNumber] = useState('');
  const [esActive, setEsActive] = useState(true);

  const [delStudent, setDelStudent] = useState<StudentListItem | null>(null);
  const [delStep, setDelStep] = useState<1 | 2 | null>(null);
  const [delReason, setDelReason] = useState('');

  const [editGuardian, setEditGuardian] = useState<GuardianFull | null>(null);
  const [egFullName, setEgFullName] = useState('');
  const [egEmail, setEgEmail] = useState('');
  const [egPhone, setEgPhone] = useState('');
  const [egWhatsapp, setEgWhatsapp] = useState('');
  const [egKinship, setEgKinship] = useState('');
  const [egCpf, setEgCpf] = useState('');
  const [egAddress, setEgAddress] = useState('');

  const [editTurma, setEditTurma] = useState<TurmaRow | null>(null);
  const [etName, setEtName] = useState('');
  const [etCapacity, setEtCapacity] = useState(20);
  const [etCoachId, setEtCoachId] = useState('');
  const [etCategory, setEtCategory] = useState('');
  const [etAge, setEtAge] = useState('');
  const [etDays, setEtDays] = useState('');
  const [etSchedule, setEtSchedule] = useState('');
  const [etLocation, setEtLocation] = useState('');

  const [coachTurma, setCoachTurma] = useState<TurmaRow | null>(null);
  const [newCoachId, setNewCoachId] = useState('');

  const [ncFullName, setNcFullName] = useState('');
  const [ncEmail, setNcEmail] = useState('');
  const [ncPassword, setNcPassword] = useState('');

  const [guardianToDelete, setGuardianToDelete] = useState<GuardianFull | null>(null);
  const [turmaToDelete, setTurmaToDelete] = useState<TurmaRow | null>(null);
  const [directoryDeleteBusy, setDirectoryDeleteBusy] = useState(false);

  const effectiveLinkStudentId = linkStudentId || students[0]?.id || '';
  const effectiveLinkGuardianId = linkGuardianId || guardians[0]?.id || '';
  const effectiveFamilyGuardianId = familyPickGuardianId || guardians[0]?.id || '';
  const effectiveCoachUserId = coachUserId || coaches[0]?.id || '';
  const effectiveEnrollTurmaId = enrollTurmaId || turmas[0]?.id || '';
  const effectiveEnrollStudentId = enrollStudentId || students[0]?.id || '';

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  function openEditStudent(s: StudentListItem) {
    setEditStudent(s);
    setEsFullName(s.fullName);
    setEsBirth(birthInputValue(s.birthDate));
    setEsCategory(s.categoryLabel ?? '');
    setEsPreferredPosition(s.preferredPosition ?? '');
    setEsEmergencyContact(s.emergencyContact ?? '');
    setEsMedicalNotes(s.medicalNotes ?? '');
    setEsPhysicalRestrictions(s.physicalRestrictions ?? '');
    setEsDocumentType(s.documentType ?? '');
    setEsDocumentNumber(
      s.documentType === 'CPF' && s.documentNumber && /^\d{11}$/.test(s.documentNumber)
        ? formatCpfBr(s.documentNumber)
        : (s.documentNumber ?? ''),
    );
    setEsActive(s.active);
  }

  function openEditGuardian(g: GuardianFull) {
    setEditGuardian(g);
    setEgFullName(g.fullName);
    setEgEmail(g.email ?? '');
    setEgPhone(g.phone ?? '');
    setEgWhatsapp(g.whatsapp ?? '');
    setEgKinship(g.kinship ?? '');
    setEgCpf(g.cpf ?? '');
    setEgAddress(g.address ?? '');
  }

  function openEditTurma(t: TurmaRow) {
    setEditTurma(t);
    setEtName(t.name);
    setEtCapacity(t.capacity);
    setEtCoachId(t.coach.id);
    setEtCategory(t.categoryLabel ?? '');
    setEtAge(t.ageRangeText ?? '');
    setEtDays(t.weekDaysText ?? '');
    setEtSchedule(t.scheduleText ?? '');
    setEtLocation(t.location ?? '');
  }

  function openCoachTurma(t: TurmaRow) {
    setCoachTurma(t);
    setNewCoachId(t.coach.id);
  }

  function resetStudentFormFields() {
    setFullName('');
    setBirthDate('');
    setCategoryLabel('');
    setPreferredPosition('');
    setEmergencyContact('');
    setMedicalNotes('');
    setPhysicalRestrictions('');
    setDocumentType('');
    setDocumentNumber('');
    setStudentIsAccountHolder(true);
    setAccountHolderEmail('');
    setAccountHolderPassword('');
  }

  function resetGuardianFormFields() {
    setGFullName('');
    setGEmail('');
    setGPhone('');
    setGWhatsapp('');
    setGKinship('');
    setGCpf('');
    setGAddress('');
  }

  function newStudentJson() {
    const accountBody =
      accountHolderEmail.trim() && accountHolderPassword.length >= 6
        ? {
            accountEmail: accountHolderEmail.trim().toLowerCase(),
            accountPassword: accountHolderPassword,
          }
        : {};
    return {
      fullName: fullName.trim(),
      ...(birthDate ? { birthDate } : {}),
      ...(categoryLabel.trim() ? { categoryLabel: categoryLabel.trim() } : {}),
      ...(preferredPosition.trim() ? { preferredPosition: preferredPosition.trim() } : {}),
      ...(emergencyContact.trim() ? { emergencyContact: emergencyContact.trim() } : {}),
      ...(medicalNotes.trim() ? { medicalNotes: medicalNotes.trim() } : {}),
      ...(physicalRestrictions.trim()
        ? { physicalRestrictions: physicalRestrictions.trim() }
        : {}),
      ...(documentType && documentNumber.trim()
        ? { documentType, documentNumber: documentNumber.trim() }
        : {}),
      ...accountBody,
    };
  }

  function newGuardianJson() {
    return {
      fullName: gFullName.trim(),
      ...(gEmail.trim() ? { email: gEmail.trim() } : {}),
      ...(gPhone.trim() ? { phone: gPhone.trim() } : {}),
      ...(gWhatsapp.trim() ? { whatsapp: gWhatsapp.trim() } : {}),
      ...(gKinship.trim() ? { kinship: gKinship.trim() } : {}),
      ...(gCpf.trim() ? { cpf: gCpf.trim() } : {}),
      ...(gAddress.trim() ? { address: gAddress.trim() } : {}),
    };
  }

  async function onCreateStudentOnly() {
    setErr(null);
    if (!fullName.trim()) {
      setErr('Informe o nome completo do aluno.');
      return;
    }
    if (!accountHolderEmail.trim()) {
      setErr('Informe o e-mail da conta de acesso (ATLETA).');
      return;
    }
    if (accountHolderPassword.length < 6) {
      setErr('A senha da conta deve ter ao menos 6 caracteres.');
      return;
    }
    setEntryFormBusy(true);
    try {
      await apiFetch('/students', {
        method: 'POST',
        body: JSON.stringify(newStudentJson()),
      });
      resetStudentFormFields();
      setEntryFormOpen(false);
      toast.success('Aluno cadastrado.');
      await reloadAll();
    } catch (e) {
      notifyApiError(e, 'Não foi possível cadastrar.');
    } finally {
      setEntryFormBusy(false);
    }
  }

  async function onCreateGuardianOnly() {
    setErr(null);
    if (!gFullName.trim()) {
      setErr('Informe o nome do responsável.');
      return;
    }
    setEntryFormBusy(true);
    try {
      await apiFetch('/guardians', {
        method: 'POST',
        body: JSON.stringify(newGuardianJson()),
      });
      resetGuardianFormFields();
      setEntryFormOpen(false);
      toast.success('Responsável cadastrado.');
      await reloadAll();
    } catch (e) {
      notifyApiError(e, 'Não foi possível cadastrar responsável.');
    } finally {
      setEntryFormBusy(false);
    }
  }

  async function onCreateFamily(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!fullName.trim()) {
      setErr('Informe o nome completo do aluno.');
      return;
    }
    if (!accountHolderEmail.trim()) {
      setErr('Informe o e-mail da conta de acesso (ATLETA).');
      return;
    }
    if (accountHolderPassword.length < 6) {
      setErr('A senha da conta deve ter ao menos 6 caracteres.');
      return;
    }
    if (studentIsAccountHolder) {
      setEntryFormBusy(true);
      try {
        await apiFetch('/students', {
          method: 'POST',
          body: JSON.stringify(newStudentJson()),
        });
        resetStudentFormFields();
        resetGuardianFormFields();
        setEntryFormOpen(false);
        toast.success('Aluno cadastrado com conta própria no app.');
        await reloadAll();
      } catch (e) {
        notifyApiError(e, 'Não foi possível cadastrar o aluno.');
      } finally {
        setEntryFormBusy(false);
      }
      return;
    }
    if (familyGuardianMode === 'new' && !gFullName.trim() && !studentIsAccountHolder) {
      setErr(
        'Informe o nome do novo responsável ou mude para «Usar responsável já cadastrado». Se marcar «Esse aluno é o responsável pela conta» no passo 1, não é obrigatório responsável aqui.',
      );
      return;
    }
    if (familyGuardianMode === 'existing') {
      if (!guardians.length) {
        setErr(
          'Não há responsável cadastrado ainda. Escolha «Cadastrar novo responsável» ou use «Só cadastrar o responsável».',
        );
        return;
      }
      if (!effectiveFamilyGuardianId) {
        setErr('Selecione o responsável na lista.');
        return;
      }
    }

    setEntryFormBusy(true);
    try {
      let studentId: string;
      try {
        const st = await apiFetch<{ id: string }>('/students', {
          method: 'POST',
          body: JSON.stringify(newStudentJson()),
        });
        studentId = st.id;
      } catch (e) {
        notifyApiError(e, 'Não foi possível cadastrar o aluno.');
        return;
      }

      if (familyGuardianMode === 'existing') {
        try {
          await apiFetch(`/students/${studentId}/guardians`, {
            method: 'POST',
            body: JSON.stringify({
              guardianId: effectiveFamilyGuardianId,
              isPrimaryForBilling: linkPrimary,
            }),
          });
        } catch (linkErr) {
          await reloadAll();
          resetStudentFormFields();
          const base = errorMessageFromUnknown(linkErr, 'Não foi possível vincular.');
          const msg = `${base} O aluno foi salvo; vincule na seção «Vincular quem já está cadastrado».`;
          setErr(msg);
          toast.error(msg);
          return;
        }
        resetStudentFormFields();
        setEntryFormOpen(false);
        toast.success('Aluno cadastrado e vinculado ao responsável escolhido.');
        await reloadAll();
        return;
      }

      try {
        const g = await apiFetch<{ id: string }>('/guardians', {
          method: 'POST',
          body: JSON.stringify(newGuardianJson()),
        });
        try {
          await apiFetch(`/students/${studentId}/guardians`, {
            method: 'POST',
            body: JSON.stringify({
              guardianId: g.id,
              isPrimaryForBilling: linkPrimary,
            }),
          });
        } catch (linkErr) {
          await reloadAll();
          resetStudentFormFields();
          resetGuardianFormFields();
          const base = errorMessageFromUnknown(
            linkErr,
            'Não foi possível vincular; conclua o vínculo na seção abaixo.',
          );
          const msg = `${base} O aluno e o responsável foram criados; use «Vincular quem já está cadastrado» abaixo.`;
          setErr(msg);
          toast.error(msg);
          return;
        }
      } catch (gErr) {
        await reloadAll();
        resetStudentFormFields();
        const base = errorMessageFromUnknown(gErr, 'Não foi possível cadastrar o responsável.');
        const msg = `${base} O aluno foi salvo; cadastre o responsável nos campos acima e tente de novo ou vincule manualmente.`;
        setErr(msg);
        toast.error(msg);
        return;
      }

      resetStudentFormFields();
      resetGuardianFormFields();
      setEntryFormOpen(false);
      toast.success('Aluno, responsável e vínculo registrados.');
      await reloadAll();
    } finally {
      setEntryFormBusy(false);
    }
  }

  async function onSaveStudentEdit(e: FormEvent) {
    e.preventDefault();
    if (!editStudent) return;
    setErr(null);
    try {
      const docBody =
        esDocumentType && esDocumentNumber.trim()
          ? { documentType: esDocumentType, documentNumber: esDocumentNumber.trim() }
          : { documentType: null, documentNumber: null };
      await apiFetch(`/students/${editStudent.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: esFullName.trim(),
          ...(esBirth ? { birthDate: esBirth } : { birthDate: null }),
          ...(esCategory.trim() ? { categoryLabel: esCategory.trim() } : { categoryLabel: null }),
          preferredPosition: esPreferredPosition.trim() || null,
          emergencyContact: esEmergencyContact.trim() || null,
          medicalNotes: esMedicalNotes.trim() || null,
          physicalRestrictions: esPhysicalRestrictions.trim() || null,
          ...docBody,
          active: esActive,
        }),
      });
      setEditStudent(null);
      toast.success('Aluno atualizado.');
      await reloadAll();
    } catch (e) {
      notifyApiError(e, 'Não foi possível salvar.');
    }
  }

  async function toggleStudentActive(s: StudentListItem) {
    setErr(null);
    try {
      await apiFetch(`/students/${s.id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !s.active }),
      });
      toast.success(!s.active ? 'Aluno reativado.' : 'Aluno inativado.');
      await reloadAll();
    } catch (e) {
      notifyApiError(e, 'Não foi possível alterar o status.');
    }
  }

  async function onConfirmDeleteStudent() {
    if (!delStudent || delStep !== 2) return;
    setErr(null);
    try {
      await apiFetch(`/students/${delStudent.id}/delete`, {
        method: 'POST',
        body: JSON.stringify({ reason: delReason.trim() }),
      });
      setDelStudent(null);
      setDelStep(null);
      setDelReason('');
      toast.success('Cadastro do aluno removido definitivamente (RN-105).');
      await reloadAll();
    } catch (e) {
      const msg = errorMessageFromUnknown(e, 'Exclusão não permitida.');
      toast.error(msg);
      setErr(msg);
    }
  }

  async function onSaveGuardianEdit(e: FormEvent) {
    e.preventDefault();
    if (!editGuardian) return;
    setErr(null);
    try {
      await apiFetch(`/guardians/${editGuardian.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: egFullName.trim(),
          email: egEmail.trim() || null,
          phone: egPhone.trim() || null,
          whatsapp: egWhatsapp.trim() || null,
          kinship: egKinship.trim() || null,
          cpf: egCpf.trim() || null,
          address: egAddress.trim() || null,
        }),
      });
      setEditGuardian(null);
      toast.success('Responsável atualizado.');
      await reloadAll();
    } catch (e) {
      notifyApiError(e, 'Não foi possível salvar.');
    }
  }

  async function onLink(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await apiFetch(`/students/${effectiveLinkStudentId}/guardians`, {
        method: 'POST',
        body: JSON.stringify({
          guardianId: effectiveLinkGuardianId,
          isPrimaryForBilling: linkPrimary,
        }),
      });
      setVincularPanelOpen(false);
      toast.success('Responsável vinculado. Você pode matricular na aba Matrícula.');
      await reloadAll();
    } catch (e) {
      notifyApiError(e, 'Não foi possível vincular.');
    }
  }

  async function onUnlink(studentId: string, guardianId: string) {
    setErr(null);
    try {
      await apiFetch(`/students/${studentId}/guardians/${guardianId}/unlink`, {
        method: 'POST',
      });
      toast.success('Vínculo removido.');
      await reloadAll();
    } catch (e) {
      notifyApiError(e, 'Não foi possível desvincular.');
    }
  }

  async function onCreateCoach(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const name = ncFullName.trim();
    const email = ncEmail.trim();
    if (!name || !email || ncPassword.length < 8) {
      setErr('Preencha nome, e-mail e senha (mín. 8 caracteres) do treinador.');
      return;
    }
    try {
      await apiFetch('/auth/coaches', {
        method: 'POST',
        body: JSON.stringify({
          fullName: name,
          email,
          password: ncPassword,
        }),
      });
      setNcFullName('');
      setNcEmail('');
      setNcPassword('');
      toast.success('Treinador cadastrado. Ele pode entrar com este e-mail e senha.');
      await reloadAll();
    } catch (e) {
      notifyApiError(e, 'Não foi possível cadastrar o treinador.');
    }
  }

  async function onCreateTurma(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await apiFetch('/turmas', {
        method: 'POST',
        body: JSON.stringify({
          name: tName.trim(),
          capacity: Number(tCapacity),
          coachUserId: effectiveCoachUserId,
          ...(tCategoryLabel.trim() ? { categoryLabel: tCategoryLabel.trim() } : {}),
          ...(ageRangeText.trim() ? { ageRangeText: ageRangeText.trim() } : {}),
          ...(weekDaysText.trim() ? { weekDaysText: weekDaysText.trim() } : {}),
          ...(scheduleText.trim() ? { scheduleText: scheduleText.trim() } : {}),
          ...(location.trim() ? { location: location.trim() } : {}),
        }),
      });
      setTName('');
      setTCategoryLabel('');
      toast.success('Turma criada.');
      await reloadAll();
    } catch (e) {
      notifyApiError(e, 'Não foi possível criar a turma.');
    }
  }

  async function onSaveTurmaEdit(e: FormEvent) {
    e.preventDefault();
    if (!editTurma) return;
    setErr(null);
    try {
      await apiFetch(`/turmas/${editTurma.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: etName.trim(),
          capacity: Number(etCapacity),
          coachUserId: etCoachId,
          categoryLabel: etCategory.trim() || null,
          ageRangeText: etAge.trim() || null,
          weekDaysText: etDays.trim() || null,
          scheduleText: etSchedule.trim() || null,
          location: etLocation.trim() || null,
        }),
      });
      setEditTurma(null);
      toast.success('Turma atualizada.');
      await reloadAll();
    } catch (e) {
      notifyApiError(e, 'Não foi possível salvar a turma.');
    }
  }

  async function onSaveCoachChange(e: FormEvent) {
    e.preventDefault();
    if (!coachTurma) return;
    setErr(null);
    try {
      await apiFetch(`/turmas/${coachTurma.id}/coach`, {
        method: 'PATCH',
        body: JSON.stringify({ coachUserId: newCoachId }),
      });
      setCoachTurma(null);
      toast.success('Treinador da turma atualizado (ROT-TUR-05).');
      await reloadAll();
    } catch (e) {
      notifyApiError(e, 'Não foi possível trocar o treinador.');
    }
  }

  async function onEnroll(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setEnrollWarningsBanner(null);
    try {
      const res = await apiFetch<EnrollResponse>(`/turmas/${effectiveEnrollTurmaId}/enrollments`, {
        method: 'POST',
        body: JSON.stringify({ studentId: effectiveEnrollStudentId }),
      });
      if (res.warnings?.length) setEnrollWarningsBanner(res.warnings);
      toast.success('Aluno matriculado.');
      await reloadAll();
    } catch (e) {
      const msg = errorMessageFromUnknown(e, 'Matrícula falhou.');
      const full = msg.includes('responsável')
        ? `${msg} Em Gestão, vincule responsável ao aluno (seção «Vincular quem já está cadastrado») e tente novamente.`
        : msg;
      setErr(full);
      toast.error(full);
    }
  }

  const tabLabels: Record<Secao, string> = {
    cadastro: 'Alunos e responsáveis',
    turma: 'Turmas',
    matricula: 'Matrícula',
  };

  const activeStudentCount = students.filter((s) => s.active).length;
  const studentsMissingGuardian = students.filter(studentNeedsGuardianLink);
  const studentsWithoutGuardianCount = studentsMissingGuardian.length;
  const turmasNearCapacity = turmas.filter(
    (t) => (t._count?.enrollments ?? 0) >= t.capacity * 0.9 && t.capacity > 0,
  ).length;

  const birthHint = birthDate ? formatDateBR(`${birthDate}T12:00:00`) : null;

  function openNewEntryForm() {
    setEntryFormOpen(true);
    setErr(null);
    requestAnimationFrame(() => {
      newEntryFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function openVincularForStudent(studentId: string) {
    setLinkStudentId(studentId);
    setErr(null);
    setVincularPanelOpen(true);
    requestAnimationFrame(() => {
      vincularDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  return (
    <div className="page stack gestao-page">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Gestão</h1>
          <p className="page-header__subtitle">
            Cadastre famílias, organize turmas e matricule — use as abas para focar em cada etapa. Listas completas
            continuam em <Link to="/alunos">Alunos</Link> e <Link to="/turmas">Turmas</Link>.
          </p>
        </div>
      </header>

      <div className="tabs gestao-tabs" role="tablist" aria-label="Seções de gestão">
        {SECOES.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={secao === s}
            className={`tabs__btn ${secao === s ? 'tabs__btn--active' : ''}`}
            onClick={() => setSecao(s)}
          >
            {tabLabels[s]}
          </button>
        ))}
      </div>

      <div className="gestao-panel stack">
        <div ref={errPageBannerRef}>
          {err ? (
            <Banner variant="danger" onDismiss={() => setErr(null)}>
              {err}
            </Banner>
          ) : null}
        </div>

        {secao === 'cadastro' ? (
          <div className="gestao-flow stack">
            <section className="card stack card--lg gestao-summary" aria-labelledby="gestao-summary-title">
              <div className="gestao-summary__head">
                <div>
                  <h2 id="gestao-summary-title" className="text-h3">
                    Visão geral
                  </h2>
                  <p className="muted gestao-summary__intro" style={{ margin: 0 }}>
                    Números do tenant e pendências antes de abrir o formulário longo.
                  </p>
                </div>
                <nav className="gestao-summary__nav" aria-label="Listas completas">
                  <Link to="/alunos" className="btn btn-secondary gestao-summary__nav-btn">
                    Alunos
                  </Link>
                  <Link to="/turmas" className="btn btn-secondary gestao-summary__nav-btn">
                    Turmas
                  </Link>
                </nav>
              </div>
              <div className="gestao-summary__stats" aria-busy={directoryLoading}>
                <GestaoStat
                  label="Alunos ativos"
                  value={directoryLoading ? '—' : activeStudentCount}
                />
                <GestaoStat label="Responsáveis" value={directoryLoading ? '—' : guardians.length} />
                <GestaoStat label="Turmas" value={directoryLoading ? '—' : turmas.length} />
                <GestaoStat
                  label="Sem responsável (RN-103, exceto conta própria)"
                  value={directoryLoading ? '—' : studentsWithoutGuardianCount}
                  variant={studentsWithoutGuardianCount > 0 ? 'warning' : 'success'}
                />
              </div>
              {!directoryLoading && studentsWithoutGuardianCount > 0 ? (
                <div className="gestao-pending-guardian stack" role="region" aria-label="Alunos sem responsável">
                  <Banner variant="warning">
                    <strong>Portal e notificações dependem do vínculo.</strong> Selecione o responsável na seção que
                    abre abaixo ou cadastre um novo responsável antes de vincular.
                  </Banner>
                  <ul className="plain gestao-pending-guardian__list">
                    {studentsMissingGuardian.map((s) => (
                      <li key={s.id} className="gestao-pending-guardian__row">
                        <div className="gestao-pending-guardian__who">
                          <strong>{s.fullName}</strong>
                          {s.categoryLabel ? (
                            <span className="muted text-caption gestao-pending-guardian__cat">{s.categoryLabel}</span>
                          ) : null}
                        </div>
                        <div className="gestao-pending-guardian__actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={!guardians.length}
                            title={
                              guardians.length ? undefined : 'Cadastre ao menos um responsável antes de vincular.'
                            }
                            onClick={() => openVincularForStudent(s.id)}
                          >
                            Vincular responsável
                          </button>
                          <Link to={`/alunos/${s.id}`} className="btn btn-secondary">
                            Abrir ficha
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {!guardians.length ? (
                    <p className="muted text-caption" style={{ margin: 0 }}>
                      Não há responsável cadastrado ainda — use «Novo aluno e responsável» ou «Só cadastrar o
                      responsável» acima, depois volte aqui.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {!directoryLoading && turmasNearCapacity > 0 ? (
                <p className="muted text-caption" style={{ margin: 0 }}>
                  {turmasNearCapacity} turma(s) com ocupação a partir de 90% da capacidade — considere abrir nova turma
                  ou ajustar limite.
                </p>
              ) : null}
            </section>

            {!entryFormOpen ? (
              <div className="card stack card--lg gestao-reopen">
                <p className="muted" style={{ margin: 0 }}>
                  Formulário de cadastro recolhido. Use o botão para incluir outra família ou aluno avulso.
                </p>
                <button type="button" className="btn btn-primary gestao-reopen__cta" onClick={() => openNewEntryForm()}>
                  Novo aluno e responsável
                </button>
              </div>
            ) : null}

            {entryFormOpen ? (
              <div ref={newEntryFormRef} className="card stack card--lg gestao-new-entry">
                <div className="gestao-new-entry__head">
                  <div>
                    <h2 className="text-h3 gestao-new-entry__title">
                      {studentIsAccountHolder
                        ? 'Novo aluno (somente conta-atleta)'
                        : 'Novo aluno + responsável de contato'}
                    </h2>
                    <p className="muted gestao-lead" style={{ margin: 0 }}>
                      Todo aluno tem uma <strong>conta-atleta</strong> (acesso ao app). Informe o
                      e-mail e senha de acesso. Marque o passo 2 para também cadastrar um responsável
                      de contato/cobrança (Guardian) — sem login.
                    </p>
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={() => setEntryFormOpen(false)}>
                    Ocultar formulário
                  </button>
                </div>
                <form className="stack gestao-form gestao-form--nested" onSubmit={onCreateFamily}>
              <section className="gestao-flow__step stack" aria-labelledby="gestao-step-aluno">
                <h3 id="gestao-step-aluno" className="gestao-flow__step-title">
                  1. Dados do aluno
                </h3>
                <div className="form-grid-2">
                  <label className="stack">
                    <span className="muted">Nome completo</span>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} />
                  </label>
                  <label className="stack">
                    <span className="muted">Data de nascimento (opcional)</span>
                    <input type="date" lang="pt-BR" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                    {birthHint ? (
                      <span className="text-caption">Exibido como {birthHint} no sistema</span>
                    ) : null}
                  </label>
                </div>
                <label className="stack">
                  <span className="muted">Categoria / observação (opcional)</span>
                  <input value={categoryLabel} onChange={(e) => setCategoryLabel(e.target.value)} />
                </label>
                <div className="form-grid-2">
                  <label className="stack">
                    <span className="muted">Tipo de documento (opcional)</span>
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      aria-label="Tipo de documento do aluno"
                    >
                      {STUDENT_DOC_TYPES.map((o) => (
                        <option key={o.value || 'none'} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="stack">
                    <span className="muted">Número do documento (opcional)</span>
                    <input
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                      placeholder="CPF com ou sem pontuação"
                      disabled={!documentType}
                    />
                  </label>
                </div>
                <label className="stack">
                  <span className="muted">Posição preferida (opcional)</span>
                  <input
                    value={preferredPosition}
                    onChange={(e) => setPreferredPosition(e.target.value)}
                    placeholder="ex. Atacante, goleiro"
                  />
                </label>
                <label className="stack">
                  <span className="muted">Contato de emergência (opcional)</span>
                  <input
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="Nome e telefone"
                  />
                </label>
                <label className="stack">
                  <span className="muted">Observações médicas (opcional)</span>
                  <textarea value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} rows={2} />
                </label>
                <label className="stack">
                  <span className="muted">Restrições físicas (opcional)</span>
                  <textarea
                    value={physicalRestrictions}
                    onChange={(e) => setPhysicalRestrictions(e.target.value)}
                    rows={2}
                  />
                </label>

                <div className="stack" style={{ gap: 'var(--space-2)' }}>
                  <p className="text-caption muted" style={{ margin: 0 }}>
                    Dados da conta de login da conta-atleta (RN-200). O admin define a senha
                    inicial; o aluno (ou um adulto operando a conta) aceita os termos no 1º acesso.
                    Para compartilhar com irmãos, depois use «Vincular a conta existente» na ficha
                    do aluno.
                  </p>
                  <div className="form-grid-2">
                    <label className="stack">
                      <span className="muted">E-mail do login</span>
                      <input
                        type="email"
                        autoComplete="off"
                        value={accountHolderEmail}
                        onChange={(e) => setAccountHolderEmail(e.target.value)}
                        placeholder="ex. atleta@email.com"
                        required
                      />
                    </label>
                    <label className="stack">
                      <span className="muted">Senha (mín. 6 caracteres)</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={accountHolderPassword}
                        onChange={(e) => setAccountHolderPassword(e.target.value)}
                        minLength={6}
                        required
                      />
                    </label>
                  </div>
                  <label className="field-check">
                    <input
                      type="checkbox"
                      checked={!studentIsAccountHolder}
                      onChange={(e) => {
                        const on = !e.target.checked;
                        setStudentIsAccountHolder(on);
                        if (on) {
                          setFamilyGuardianMode('new');
                          setFamilyPickGuardianId('');
                        }
                      }}
                    />
                    <span>
                      <strong>Também cadastrar responsável de contato</strong> (pai/mãe/tutor para
                      cobrança e canais externos). Sem login no app.
                    </span>
                  </label>
                </div>
              </section>

              {!studentIsAccountHolder ? (
                <>
                  <section className="gestao-flow__step stack" aria-labelledby="gestao-step-resp">
                    <h3 id="gestao-step-resp" className="gestao-flow__step-title">
                      2. Responsável
                    </h3>
                    <fieldset
                      className="gestao-fieldset stack"
                      style={{ margin: 0, border: 'none', padding: 0, gap: 'var(--space-3)' }}
                    >
                      <legend className="sr-only">Modo de inclusão do responsável</legend>
                      <div className="gestao-choice-row" role="group" aria-label="Como incluir o responsável">
                        <label className="field-check gestao-choice-row__item">
                          <input
                            type="radio"
                            name="familyGuardianMode"
                            checked={familyGuardianMode === 'new'}
                            onChange={() => {
                              setFamilyGuardianMode('new');
                              setFamilyPickGuardianId('');
                            }}
                          />
                          <span>Cadastrar novo responsável</span>
                        </label>
                        <label className="field-check gestao-choice-row__item">
                          <input
                            type="radio"
                            name="familyGuardianMode"
                            checked={familyGuardianMode === 'existing'}
                            onChange={() => setFamilyGuardianMode('existing')}
                          />
                          <span>Usar responsável já cadastrado</span>
                        </label>
                      </div>
                    </fieldset>

                    {familyGuardianMode === 'existing' ? (
                      <label className="stack">
                        <span className="muted">Responsável</span>
                        <select
                          value={effectiveFamilyGuardianId}
                          onChange={(e) => setFamilyPickGuardianId(e.target.value)}
                          aria-label="Responsável já cadastrado"
                          disabled={!guardians.length}
                        >
                          {guardians.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.fullName}
                              {g.phone ? ` · ${g.phone}` : ''}
                              {g.email ? ` · ${g.email}` : ''}
                            </option>
                          ))}
                        </select>
                        {!guardians.length ? (
                          <span className="text-caption muted">
                            Cadastre um responsável primeiro ou escolha a opção acima.
                          </span>
                        ) : (
                          <span className="text-caption muted">
                            O vínculo será criado com o aluno que você está cadastrando agora.
                          </span>
                        )}
                      </label>
                    ) : (
                      <>
                        <p className="text-caption muted" style={{ margin: 0 }}>
                          Contatos para cobrança e comunicados. O vínculo com o aluno é criado ao confirmar abaixo.
                        </p>
                        <div className="form-grid-2">
                          <label className="stack">
                            <span className="muted">Nome</span>
                            <input
                              value={gFullName}
                              onChange={(e) => setGFullName(e.target.value)}
                              required={familyGuardianMode === 'new'}
                              minLength={2}
                            />
                          </label>
                          <label className="stack">
                            <span className="muted">Parentesco (opcional)</span>
                            <input
                              value={gKinship}
                              onChange={(e) => setGKinship(e.target.value)}
                              placeholder="ex. Pai, Mãe"
                            />
                          </label>
                        </div>
                        <div className="form-grid-2">
                          <label className="stack">
                            <span className="muted">E-mail (opcional)</span>
                            <input type="email" value={gEmail} onChange={(e) => setGEmail(e.target.value)} />
                          </label>
                          <label className="stack">
                            <span className="muted">Telefone (opcional)</span>
                            <input value={gPhone} onChange={(e) => setGPhone(e.target.value)} />
                          </label>
                        </div>
                        <div className="form-grid-2">
                          <label className="stack">
                            <span className="muted">WhatsApp (opcional)</span>
                            <input value={gWhatsapp} onChange={(e) => setGWhatsapp(e.target.value)} />
                          </label>
                          <label className="stack">
                            <span className="muted">CPF (opcional)</span>
                            <input value={gCpf} onChange={(e) => setGCpf(e.target.value)} />
                          </label>
                        </div>
                        <label className="stack">
                          <span className="muted">Endereço (opcional)</span>
                          <input value={gAddress} onChange={(e) => setGAddress(e.target.value)} />
                        </label>
                      </>
                    )}
                  </section>

                  <section className="gestao-flow__step stack" aria-labelledby="gestao-step-vinc">
                    <h3 id="gestao-step-vinc" className="gestao-flow__step-title">
                      3. Cobrança neste vínculo
                    </h3>
                    <label className="field-check">
                      <input type="checkbox" checked={linkPrimary} onChange={(e) => setLinkPrimary(e.target.checked)} />
                      <span>
                        Este responsável é o <strong>principal para cobrança</strong> em relação a este aluno
                      </span>
                    </label>
                  </section>
                </>
              ) : null}

              <div className="gestao-flow__actions stack" style={{ gap: 'var(--space-3)' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    entryFormBusy ||
                    (!studentIsAccountHolder && familyGuardianMode === 'existing' && !guardians.length)
                  }
                  aria-busy={entryFormBusy}
                >
                  {entryFormBusy
                    ? 'Salvando…'
                    : studentIsAccountHolder
                      ? 'Cadastrar aluno com conta própria'
                      : familyGuardianMode === 'existing'
                        ? 'Cadastrar aluno e vincular ao responsável escolhido'
                        : 'Cadastrar aluno, responsável e vínculo'}
                </button>
                {!studentIsAccountHolder ? (
                  <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={entryFormBusy}
                      onClick={() => void onCreateStudentOnly()}
                    >
                      Só cadastrar o aluno
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={entryFormBusy}
                      onClick={() => void onCreateGuardianOnly()}
                    >
                      Só cadastrar o responsável
                    </button>
                  </div>
                ) : null}
                <p className="muted gestao-form__footer" style={{ margin: 0 }}>
                  Lista geral de atletas em <Link to="/alunos">Alunos</Link>.
                </p>
              </div>
            </form>
              </div>
            ) : null}

            <details
              ref={vincularDetailsRef}
              className="card stack card--lg gestao-form gestao-details"
              open={vincularPanelOpen}
              onToggle={(e) => setVincularPanelOpen(e.currentTarget.open)}
            >
              <summary className="gestao-details__summary">Vincular quem já está cadastrado</summary>
              <p className="muted gestao-lead" style={{ marginTop: 'var(--space-2)' }}>
                Quando aluno e responsável já existem na lista, selecione os dois e confirme. Útil para segundo
                responsável ou retomar depois de um cadastro parcial.
              </p>
              <form className="stack" style={{ gap: 'var(--space-4)' }} onSubmit={onLink}>
                <div className="form-grid-2">
                  <label className="stack">
                    <span className="muted">Aluno</span>
                    <select value={effectiveLinkStudentId} onChange={(e) => setLinkStudentId(e.target.value)}>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="stack">
                    <span className="muted">Responsável</span>
                    <select value={effectiveLinkGuardianId} onChange={(e) => setLinkGuardianId(e.target.value)}>
                      {guardians.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field-check">
                  <input type="checkbox" checked={linkPrimary} onChange={(e) => setLinkPrimary(e.target.checked)} />
                  <span>Principal para cobrança</span>
                </label>
                <button type="submit" className="btn btn-secondary" disabled={!students.length || !guardians.length}>
                  Vincular
                </button>
              </form>
            </details>

            <div className="gestao-rosters-layout">
            <div className="card card--lg stack">
              <h3 className="text-h3">Alunos cadastrados</h3>
              {!students.length ? (
                <p className="muted" style={{ margin: 0 }}>
                  Nenhum aluno ainda.
                </p>
              ) : (
                <ul className="plain gestao-roster">
                  {students.map((s) => (
                    <li key={s.id} className="gestao-roster__row">
                      <div>
                        <strong>{s.fullName}</strong>
                        <span className="muted gestao-roster__meta">
                          {s.active ? 'Ativo' : 'Inativo'}
                          {studentNeedsGuardianLink(s) ? (
                            <span className="gestao-roster__badge">Sem responsável</span>
                          ) : null}
                          {s.categoryLabel ? ` · ${s.categoryLabel}` : ''}
                          {typeof s._count?.enrollments === 'number' ? ` · ${s._count.enrollments} turma(s)` : ''}
                        </span>
                      </div>
                      <div className="gestao-roster__actions">
                        {studentNeedsGuardianLink(s) ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={!guardians.length}
                            title={guardians.length ? undefined : 'Cadastre um responsável primeiro.'}
                            onClick={() => openVincularForStudent(s.id)}
                          >
                            Vincular
                          </button>
                        ) : null}
                        <button type="button" className="btn btn-secondary" onClick={() => openEditStudent(s)}>
                          Editar
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => void toggleStudentActive(s)}>
                          {s.active ? 'Inativar' : 'Reativar'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ borderColor: 'var(--state-danger)', color: 'var(--state-danger)' }}
                          onClick={() => {
                            setDelStudent(s);
                            setDelStep(1);
                            setDelReason('');
                          }}
                        >
                          Excluir definitivamente
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card card--lg stack">
              <h3 className="text-h3">Vínculos atuais</h3>
              {!students.some((s) => (s.guardians?.length ?? 0) > 0) ? (
                <p className="muted" style={{ margin: 0 }}>
                  Nenhum vínculo cadastrado.
                </p>
              ) : (
                <ul className="plain gestao-roster">
                  {students.flatMap((s) =>
                    (s.guardians ?? []).map((sg) => (
                      <li key={`${s.id}-${sg.guardian.id}`} className="gestao-roster__row">
                        <div>
                          <strong>{s.fullName}</strong>
                          <span className="muted gestao-roster__meta">
                            ↔ {sg.guardian.fullName}
                            {sg.isPrimaryForBilling ? ' · principal p/ cobrança' : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => void onUnlink(s.id, sg.guardian.id)}
                        >
                          Desvincular
                        </button>
                      </li>
                    )),
                  )}
                </ul>
              )}
            </div>

            <GuardianDirectory
              guardians={guardians}
              onEdit={openEditGuardian}
              onRequestDelete={(g) => setGuardianToDelete(g)}
            />
            </div>
          </div>
        ) : null}

        {secao === 'turma' ? (
          <>
            <section className="card stack card--lg gestao-summary gestao-summary--compact" aria-label="Resumo turmas">
              <h2 className="text-h3" style={{ margin: 0 }}>
                Resumo
              </h2>
              <div className="gestao-summary__stats">
                <GestaoStat label="Turmas" value={directoryLoading ? '—' : turmas.length} />
                <GestaoStat label="Treinadores" value={directoryLoading ? '—' : coaches.length} />
                <GestaoStat
                  label="Matrículas (todas as turmas)"
                  value={
                    directoryLoading
                      ? '—'
                      : turmas.reduce((acc, t) => acc + (t._count?.enrollments ?? 0), 0)
                  }
                />
              </div>
            </section>
            <form className="card stack card--lg gestao-form" onSubmit={onCreateCoach}>
              <h2 className="text-h3">Novo treinador</h2>
              <p className="muted text-caption" style={{ margin: 0 }}>
                Cria usuário com perfil TREINADOR nesta escolinha (acesso ao app e às turmas em que for vinculado).
              </p>
              <div className="form-grid-2">
                <label className="stack">
                  <span className="muted">Nome completo</span>
                  <input
                    value={ncFullName}
                    onChange={(e) => setNcFullName(e.target.value)}
                    required
                    minLength={2}
                    autoComplete="name"
                  />
                </label>
                <label className="stack">
                  <span className="muted">E-mail (login)</span>
                  <input
                    type="email"
                    value={ncEmail}
                    onChange={(e) => setNcEmail(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </label>
              </div>
              <label className="stack">
                <span className="muted">Senha inicial (mín. 8 caracteres)</span>
                <input
                  type="password"
                  value={ncPassword}
                  onChange={(e) => setNcPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <button type="submit" className="btn btn-primary">
                Cadastrar treinador
              </button>
            </form>
            <form className="card stack card--lg gestao-form" onSubmit={onCreateTurma}>
              <h2 className="text-h3">Nova turma</h2>
              <div className="form-grid-2">
                <label className="stack">
                  <span className="muted">Nome</span>
                  <input value={tName} onChange={(e) => setTName(e.target.value)} required minLength={2} />
                </label>
                <label className="stack">
                  <span className="muted">Vagas (capacidade)</span>
                  <input
                    type="number"
                    min={1}
                    value={tCapacity}
                    onChange={(e) => setTCapacity(Number(e.target.value))}
                    required
                  />
                </label>
              </div>
              <label className="stack">
                <span className="muted">Treinador responsável</span>
                <select value={effectiveCoachUserId} onChange={(e) => setCoachUserId(e.target.value)} required>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.email})
                    </option>
                  ))}
                </select>
              </label>
              <label className="stack">
                <span className="muted">Categoria da turma (opcional, RN-204)</span>
                <input
                  value={tCategoryLabel}
                  onChange={(e) => setTCategoryLabel(e.target.value)}
                  placeholder="ex. Sub-9"
                />
              </label>
              <div className="form-grid-2">
                <label className="stack">
                  <span className="muted">Faixa etária (opcional)</span>
                  <input value={ageRangeText} onChange={(e) => setAgeRangeText(e.target.value)} placeholder="ex. Sub-11" />
                </label>
                <label className="stack">
                  <span className="muted">Dias da semana (opcional)</span>
                  <input value={weekDaysText} onChange={(e) => setWeekDaysText(e.target.value)} placeholder="ex. Ter/Qui" />
                </label>
              </div>
              <div className="form-grid-2">
                <label className="stack">
                  <span className="muted">Horário (opcional)</span>
                  <input value={scheduleText} onChange={(e) => setScheduleText(e.target.value)} placeholder="ex. 18h–19h30" />
                </label>
                <label className="stack">
                  <span className="muted">Local (opcional)</span>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} />
                </label>
              </div>
              <button type="submit" className="btn btn-primary" disabled={!coaches.length}>
                Criar turma
              </button>
              {!coaches.length ? (
                <p className="muted" style={{ margin: 0 }}>
                  Use o formulário <strong>Novo treinador</strong> acima para poder criar turmas.
                </p>
              ) : null}
              <p className="muted gestao-form__footer" style={{ margin: 0 }}>
                Ver turmas em <Link to="/turmas">Turmas</Link>.
              </p>
            </form>

            <div className="card card--lg stack">
              <h3 className="text-h3">Turmas</h3>
              {!turmas.length ? (
                <p className="muted" style={{ margin: 0 }}>
                  Nenhuma turma ainda.
                </p>
              ) : (
                <ul className="plain gestao-roster">
                  {turmas.map((t) => (
                    <li key={t.id} className="gestao-roster__row">
                      <div>
                        <strong>{t.name}</strong>
                        <span className="muted gestao-roster__meta">
                          {t.coach.fullName}
                          {t.categoryLabel ? ` · ${t.categoryLabel}` : ''} · {t._count?.enrollments ?? 0}/{t.capacity}{' '}
                          alunos
                        </span>
                      </div>
                      <div className="gestao-roster__actions">
                        <button type="button" className="btn btn-secondary" onClick={() => openEditTurma(t)}>
                          Editar
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => openCoachTurma(t)}>
                          Trocar treinador
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ borderColor: 'var(--state-danger)', color: 'var(--state-danger)' }}
                          onClick={() => setTurmaToDelete(t)}
                        >
                          Excluir turma
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}

        {secao === 'matricula' ? (
          <>
            <section className="card stack card--lg gestao-summary gestao-summary--compact" aria-label="Resumo matrícula">
              <h2 className="text-h3" style={{ margin: 0 }}>
                Antes de matricular
              </h2>
              <p className="muted" style={{ margin: 0 }}>
                Cada aluno ativo precisa de ao menos um responsável vinculado (RN-103), exceto quem tem{' '}
                <strong>conta própria no app</strong> já configurada. Use a aba{' '}
                <button type="button" className="btn btn-ghost gestao-inline-link" onClick={() => setSecao('cadastro')}>
                  Alunos e responsáveis
                </button>{' '}
                se a matrícula falhar por falta de vínculo.
              </p>
              <div className="gestao-summary__stats">
                <GestaoStat label="Turmas disponíveis" value={directoryLoading ? '—' : turmas.length} />
                <GestaoStat label="Alunos" value={directoryLoading ? '—' : students.length} />
                <GestaoStat
                  label="Ativos sem responsável (exceto conta própria)"
                  value={directoryLoading ? '—' : studentsWithoutGuardianCount}
                  variant={studentsWithoutGuardianCount > 0 ? 'warning' : 'default'}
                />
              </div>
            </section>
            {enrollWarningsBanner?.length ? (
              <div className="gestao-banner-warn stack" role="status">
                <p style={{ margin: 0 }}>
                  <strong>Categoria do aluno difere da turma</strong> — confira se a matrícula está correta (RN-204). A
                  matrícula já foi registrada.
                </p>
                {enrollWarningsBanner.includes('categoria divergente') ? (
                  <p className="muted text-caption" style={{ margin: 0 }}>
                    Motivo: inconsistência entre a categoria informada no cadastro do aluno e a categoria da turma.
                  </p>
                ) : null}
                <button type="button" className="btn btn-secondary" onClick={() => setEnrollWarningsBanner(null)}>
                  Entendi, manter matrícula
                </button>
              </div>
            ) : null}
            <form className="card stack card--lg gestao-form" onSubmit={onEnroll}>
              <h2 className="text-h3">Matricular aluno em turma</h2>
              <p className="muted gestao-lead">
                Exige responsável vinculado ou aluno com conta própria ativa. Consulte contatos na lista abaixo se
                precisar cobrar ou avisar.
              </p>
              <div className="form-grid-2">
                <label className="stack">
                  <span className="muted">Turma</span>
                  <select value={effectiveEnrollTurmaId} onChange={(e) => setEnrollTurmaId(e.target.value)}>
                    {turmas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="stack">
                  <span className="muted">Aluno</span>
                  <select value={effectiveEnrollStudentId} onChange={(e) => setEnrollStudentId(e.target.value)}>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="submit" className="btn btn-secondary" disabled={!turmas.length || !students.length}>
                Matricular
              </button>
            </form>
            <GuardianDirectory guardians={guardians} />
          </>
        ) : null}
      </div>

      <Modal open={Boolean(editStudent)} title="Editar aluno" onClose={() => setEditStudent(null)}>
        {editStudent ? (
          <form className="stack" style={{ gap: 'var(--space-4)' }} onSubmit={onSaveStudentEdit}>
            <label className="stack">
              <span className="muted">Nome completo</span>
              <input value={esFullName} onChange={(e) => setEsFullName(e.target.value)} required minLength={2} />
            </label>
            <label className="stack">
              <span className="muted">Data de nascimento</span>
              <input type="date" lang="pt-BR" value={esBirth} onChange={(e) => setEsBirth(e.target.value)} />
            </label>
            <label className="stack">
              <span className="muted">Categoria</span>
              <input value={esCategory} onChange={(e) => setEsCategory(e.target.value)} />
            </label>
            <div className="form-grid-2">
              <label className="stack">
                <span className="muted">Tipo de documento</span>
                <select
                  value={esDocumentType}
                  onChange={(e) => setEsDocumentType(e.target.value)}
                  aria-label="Tipo de documento"
                >
                  {STUDENT_DOC_TYPES.map((o) => (
                    <option key={o.value || 'none-edit'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="stack">
                <span className="muted">Número do documento</span>
                <input
                  value={esDocumentNumber}
                  onChange={(e) => setEsDocumentNumber(e.target.value)}
                  placeholder="CPF com ou sem pontuação"
                  disabled={!esDocumentType}
                />
              </label>
            </div>
            <label className="stack">
              <span className="muted">Posição preferida</span>
              <input value={esPreferredPosition} onChange={(e) => setEsPreferredPosition(e.target.value)} />
            </label>
            <label className="stack">
              <span className="muted">Contato de emergência</span>
              <input value={esEmergencyContact} onChange={(e) => setEsEmergencyContact(e.target.value)} />
            </label>
            <label className="stack">
              <span className="muted">Observações médicas</span>
              <textarea value={esMedicalNotes} onChange={(e) => setEsMedicalNotes(e.target.value)} rows={2} />
            </label>
            <label className="stack">
              <span className="muted">Restrições físicas</span>
              <textarea
                value={esPhysicalRestrictions}
                onChange={(e) => setEsPhysicalRestrictions(e.target.value)}
                rows={2}
              />
            </label>
            <label className="field-check">
              <input type="checkbox" checked={esActive} onChange={(e) => setEsActive(e.target.checked)} />
              <span>Aluno ativo (desmarque para inativar sem apagar o histórico, RN-104)</span>
            </label>
            <div className="gestao-modal__actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditStudent(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                Salvar
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={Boolean(editGuardian)} title="Editar responsável" onClose={() => setEditGuardian(null)}>
        {editGuardian ? (
          <form className="stack" style={{ gap: 'var(--space-4)' }} onSubmit={onSaveGuardianEdit}>
            <label className="stack">
              <span className="muted">Nome</span>
              <input value={egFullName} onChange={(e) => setEgFullName(e.target.value)} required minLength={2} />
            </label>
            <div className="form-grid-2">
              <label className="stack">
                <span className="muted">E-mail</span>
                <input type="email" value={egEmail} onChange={(e) => setEgEmail(e.target.value)} />
              </label>
              <label className="stack">
                <span className="muted">Telefone</span>
                <input value={egPhone} onChange={(e) => setEgPhone(e.target.value)} />
              </label>
            </div>
            <div className="form-grid-2">
              <label className="stack">
                <span className="muted">WhatsApp</span>
                <input value={egWhatsapp} onChange={(e) => setEgWhatsapp(e.target.value)} />
              </label>
              <label className="stack">
                <span className="muted">CPF</span>
                <input value={egCpf} onChange={(e) => setEgCpf(e.target.value)} />
              </label>
            </div>
            <label className="stack">
              <span className="muted">Parentesco</span>
              <input value={egKinship} onChange={(e) => setEgKinship(e.target.value)} />
            </label>
            <label className="stack">
              <span className="muted">Endereço</span>
              <input value={egAddress} onChange={(e) => setEgAddress(e.target.value)} />
            </label>
            <div className="gestao-modal__actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditGuardian(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                Salvar
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={Boolean(editTurma)} title="Editar turma" onClose={() => setEditTurma(null)}>
        {editTurma ? (
          <form className="stack" style={{ gap: 'var(--space-4)' }} onSubmit={onSaveTurmaEdit}>
            <label className="stack">
              <span className="muted">Nome</span>
              <input value={etName} onChange={(e) => setEtName(e.target.value)} required minLength={2} />
            </label>
            <div className="form-grid-2">
              <label className="stack">
                <span className="muted">Capacidade</span>
                <input
                  type="number"
                  min={1}
                  value={etCapacity}
                  onChange={(e) => setEtCapacity(Number(e.target.value))}
                  required
                />
              </label>
              <label className="stack">
                <span className="muted">Treinador</span>
                <select value={etCoachId} onChange={(e) => setEtCoachId(e.target.value)} required>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="stack">
              <span className="muted">Categoria da turma</span>
              <input value={etCategory} onChange={(e) => setEtCategory(e.target.value)} />
            </label>
            <div className="form-grid-2">
              <label className="stack">
                <span className="muted">Faixa etária</span>
                <input value={etAge} onChange={(e) => setEtAge(e.target.value)} />
              </label>
              <label className="stack">
                <span className="muted">Dias</span>
                <input value={etDays} onChange={(e) => setEtDays(e.target.value)} />
              </label>
            </div>
            <div className="form-grid-2">
              <label className="stack">
                <span className="muted">Horário</span>
                <input value={etSchedule} onChange={(e) => setEtSchedule(e.target.value)} />
              </label>
              <label className="stack">
                <span className="muted">Local</span>
                <input value={etLocation} onChange={(e) => setEtLocation(e.target.value)} />
              </label>
            </div>
            <div className="gestao-modal__actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditTurma(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                Salvar
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={Boolean(coachTurma)} title="Trocar treinador" onClose={() => setCoachTurma(null)}>
        {coachTurma ? (
          <>
          <p className="muted" style={{ margin: 0 }}>
            Turma: <strong>{coachTurma.name}</strong> (ROT-TUR-05)
          </p>
          <form className="stack" style={{ gap: 'var(--space-4)' }} onSubmit={onSaveCoachChange}>
            <label className="stack">
              <span className="muted">Novo treinador</span>
              <select value={newCoachId} onChange={(e) => setNewCoachId(e.target.value)} required>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.email})
                  </option>
                ))}
              </select>
            </label>
            <div className="gestao-modal__actions">
              <button type="button" className="btn btn-ghost" onClick={() => setCoachTurma(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                Confirmar
              </button>
            </div>
          </form>
          </>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(delStudent && delStep === 1)}
        title="Exclusão definitiva (RN-105)"
        onClose={() => {
          setDelStudent(null);
          setDelStep(null);
        }}
      >
        {delStudent && delStep === 1 ? (
          <>
          <p style={{ margin: 0 }}>
            Esta ação é <strong>irreversível</strong> e fica registrada em log de auditoria com seu usuário e motivo.
          </p>
          <p className="muted text-caption" style={{ margin: 0 }}>
            Inativação preserva histórico; use “Inativar” na lista se não precisar apagar o cadastro.
          </p>
          <div className="gestao-modal__actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setDelStudent(null);
                setDelStep(null);
              }}
            >
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setDelStep(2)}>
              Continuar
            </button>
          </div>
          </>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(delStudent && delStep === 2)}
        title="Confirmar exclusão"
        onClose={() => {
          setDelStudent(null);
          setDelStep(null);
          setDelReason('');
        }}
      >
        {delStudent && delStep === 2 ? (
          <>
          <p style={{ margin: 0 }}>
            Aluno: <strong>{delStudent.fullName}</strong>
          </p>
          <label className="stack">
            <span className="muted">Motivo (obrigatório, mín. 3 caracteres)</span>
            <textarea
              value={delReason}
              onChange={(e) => setDelReason(e.target.value)}
              rows={4}
              required
              minLength={3}
              className="gestao-textarea"
            />
          </label>
          <div className="gestao-modal__actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setDelStep(1);
                setDelReason('');
              }}
            >
              Voltar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: 'var(--state-danger)', borderColor: 'var(--state-danger)' }}
              disabled={delReason.trim().length < 3}
              onClick={() => void onConfirmDeleteStudent()}
            >
              Excluir definitivamente
            </button>
          </div>
          </>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(guardianToDelete)}
        onOpenChange={(open) => !open && setGuardianToDelete(null)}
        title="Excluir responsável"
        danger
        confirmLabel="Excluir"
        busy={directoryDeleteBusy}
        description={
          guardianToDelete ? (
            <>
              <p style={{ margin: '0 0 var(--space-3)' }}>
                Remove <strong>{guardianToDelete.fullName}</strong> do cadastro e desfaz todos os vínculos com alunos,
                desde que nenhum fique sem outro responsável (RN-103).
              </p>
              <p className="muted text-caption" style={{ margin: 0 }}>
                Se algum aluno tiver só este responsável, a exclusão será bloqueada — vincule outro antes ou use
                «Desvincular» quando houver mais de um.
              </p>
            </>
          ) : null
        }
        onConfirm={async () => {
          if (!guardianToDelete) return;
          setDirectoryDeleteBusy(true);
          setErr(null);
          try {
            await apiFetch(`/guardians/${guardianToDelete.id}/delete`, { method: 'POST' });
            setGuardianToDelete(null);
            toast.success('Responsável removido.');
            await reloadAll();
          } catch (e) {
            const msg = errorMessageFromUnknown(e, 'Não foi possível excluir.');
            toast.error(msg);
            setErr(msg);
          } finally {
            setDirectoryDeleteBusy(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(turmaToDelete)}
        onOpenChange={(open) => !open && setTurmaToDelete(null)}
        title="Excluir turma"
        danger
        confirmLabel="Excluir turma"
        busy={directoryDeleteBusy}
        description={
          turmaToDelete ? (
            <>
              <p style={{ margin: '0 0 var(--space-3)' }}>
                A turma <strong>{turmaToDelete.name}</strong> será removida junto com matrículas, presenças e demais
                registros vinculados no banco (conforme políticas do sistema).
              </p>
              <p className="muted text-caption" style={{ margin: 0 }}>
                Esta ação não pode ser desfeita. Eventos de calendário podem permanecer sem turma associada.
              </p>
            </>
          ) : null
        }
        onConfirm={async () => {
          if (!turmaToDelete) return;
          setDirectoryDeleteBusy(true);
          setErr(null);
          try {
            await apiFetch(`/turmas/${turmaToDelete.id}/delete`, { method: 'POST' });
            setTurmaToDelete(null);
            toast.success('Turma excluída.');
            await reloadAll();
          } catch (e) {
            const msg = errorMessageFromUnknown(e, 'Não foi possível excluir a turma.');
            toast.error(msg);
            setErr(msg);
          } finally {
            setDirectoryDeleteBusy(false);
          }
        }}
      />
    </div>
  );
}
