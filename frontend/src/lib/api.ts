const TOKEN_KEY = 'evolui_token';
const ACTIVE_STUDENT_KEY_PREFIX = 'evolui_active_student:';

/** Erro HTTP da API com mensagem já legível (NestJS / class-validator). */
export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

/**
 * Extrai texto útil do corpo de erro (JSON Nest ou texto puro).
 * `message` pode ser string ou array de strings (validação).
 */
export function formatApiErrorBody(bodyText: string, fallback: string): string {
  const trimmed = bodyText.trim();
  if (!trimmed) return fallback;
  try {
    const j = JSON.parse(trimmed) as { message?: unknown };
    if (typeof j.message === 'string' && j.message.trim()) return j.message.trim();
    if (Array.isArray(j.message)) {
      const parts = j.message
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim())
        .filter(Boolean);
      if (parts.length) return parts.join(' ');
    }
  } catch {
    /* corpo não é JSON */
  }
  if (trimmed.length > 0 && trimmed.length < 400 && !trimmed.startsWith('{')) return trimmed;
  return fallback;
}

export function errorMessageFromUnknown(e: unknown, fallback: string): string {
  if (e instanceof ApiRequestError) return e.message;
  if (e instanceof Error && e.message.trim()) return e.message.trim();
  return fallback;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/**
 * Aluno ativo (switcher RN-200). Chave por `userId` para que múltiplas contas
 * no mesmo navegador não compartilhem seleção.
 */
export function getActiveStudentId(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return localStorage.getItem(`${ACTIVE_STUDENT_KEY_PREFIX}${userId}`);
}

export function setActiveStudentId(userId: string, studentId: string | null) {
  const key = `${ACTIVE_STUDENT_KEY_PREFIX}${userId}`;
  if (studentId) localStorage.setItem(key, studentId);
  else localStorage.removeItem(key);
}

export type AccountStudent = {
  id: string;
  fullName: string;
  birthDate: string | null;
  categoryLabel: string | null;
  active: boolean;
};

export type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: 'ADMIN' | 'TREINADOR' | 'ATLETA';
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
    staffProfile?: {
      id: string;
      professionalType: string;
      active: boolean;
      registry: string | null;
    } | null;
    termsAcceptedAt: string | null;
    termsKinship: string | null;
    students: AccountStudent[];
  };
};

/** Header automático com o aluno ativo (quando há um selecionado). */
function attachActiveStudentHeader(headers: Headers) {
  const token = getToken();
  if (!token) return;
  // Reconstruí o userId via decoding de payload JWT seria mais robusto; aqui
  // confiamos no shadow `evolui_active_student:<userId>` setado pelo provider.
  // O middleware backend ignora o header para roles ≠ ATLETA.
  const keys = Object.keys(localStorage).filter((k) =>
    k.startsWith(ACTIVE_STUDENT_KEY_PREFIX),
  );
  if (keys.length === 1) {
    const sid = localStorage.getItem(keys[0]);
    if (sid) headers.set('X-Active-Student-Id', sid);
  } else if (keys.length > 1) {
    // Múltiplos usuários no mesmo navegador: usa o último escrito (lru não
    // implementado aqui — caso raro; o AuthProvider zera os demais ao logar).
    const sid = localStorage.getItem(keys[keys.length - 1]);
    if (sid) headers.set('X-Active-Student-Id', sid);
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);
  attachActiveStudentHeader(headers);

  const hadAuth = !!token;
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (res.status === 401) {
    if (hadAuth) {
      setToken(null);
      window.location.href = '/login';
    }
    throw new ApiRequestError('Não autorizado', 401);
  }
  if (!res.ok) {
    const text = await res.text();
    const msg = formatApiErrorBody(text, res.statusText || 'Erro na requisição');
    throw new ApiRequestError(msg, res.status);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type');
  if (ct?.includes('application/json')) return (await res.json()) as T;
  return (await res.text()) as T;
}

/** GET binário autenticado (ex.: thumbnail / arquivo de mídia). */
export async function apiFetchBlob(
  path: string,
  init: RequestInit = {},
): Promise<{ blob: Blob; contentType: string | null }> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  attachActiveStudentHeader(headers);
  const hadAuth = !!token;
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (res.status === 401) {
    if (hadAuth) {
      setToken(null);
      window.location.href = '/login';
    }
    throw new ApiRequestError('Não autorizado', 401);
  }
  if (!res.ok) {
    const text = await res.text();
    const msg = formatApiErrorBody(text, res.statusText || 'Erro na requisição');
    throw new ApiRequestError(msg, res.status);
  }
  return {
    blob: await res.blob(),
    contentType: res.headers.get('content-type'),
  };
}
