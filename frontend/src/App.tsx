import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { ToastProvider } from './components/ToastProvider';
import AppLayout from './layout/AppLayout';
import Login from './pages/Login';
import Home from './pages/Home';
import Students from './pages/Students';
import Turmas from './pages/Turmas';
import Gestao from './pages/Gestao';
import StudentDetail from './pages/StudentDetail';
import TurmaDetail from './pages/TurmaDetail';
import Calendar from './pages/Calendar';
import Attendance from './pages/Attendance';
import Finance from './pages/Finance';
import Dashboard from './pages/Dashboard';
import Filhos from './pages/Filhos';
import Avisos from './pages/Avisos';
import Notificacoes from './pages/Notificacoes';
import Preferencias from './pages/Preferencias';
import Avaliacoes from './pages/Avaliacoes';
import AvaliacoesConfig from './pages/AvaliacoesConfig';
import Filho from './pages/Filho';
import Relatorios from './pages/Relatorios';
import RelatorioDetail from './pages/RelatorioDetail';
import FilhoRelatorios from './pages/FilhoRelatorios';
import Comunicacoes from './pages/Comunicacoes';
import ComunicacoesHistorico from './pages/ComunicacoesHistorico';
import Midia from './pages/Midia';
import Profissionais from './pages/Profissionais';
import ProfissionalDetail from './pages/ProfissionalDetail';
import PlanosAluno from './pages/PlanosAluno';
import PlanoEditor from './pages/PlanoEditor';
import FilhoPlanos from './pages/FilhoPlanos';
import FilhoPlanoDetail from './pages/FilhoPlanoDetail';
import BibliotecaExercicios from './pages/BibliotecaExercicios';
import Treinos from './pages/Treinos';
import TreinoEditor from './pages/TreinoEditor';
import TreinosHistorico from './pages/TreinosHistorico';
import MeusTreinos from './pages/MeusTreinos';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/gestao" element={<Gestao />} />
          <Route path="/gestao/profissionais/:id" element={<ProfissionalDetail />} />
          <Route path="/gestao/profissionais" element={<Profissionais />} />
          {/* planId pode ser "novo" ou o id do plano — uma única rota preenche useParams corretamente */}
          <Route path="/alunos/:id/planos/:planId" element={<PlanoEditor />} />
          <Route path="/alunos/:id/planos" element={<PlanosAluno />} />
          <Route path="/biblioteca/exercicios" element={<BibliotecaExercicios />} />
          <Route path="/treinos/historico" element={<TreinosHistorico />} />
          <Route path="/treinos/:id" element={<TreinoEditor />} />
          <Route path="/treinos" element={<Treinos />} />
          <Route path="/meus-treinos" element={<MeusTreinos />} />
          <Route path="/alunos/:id" element={<StudentDetail />} />
          <Route path="/alunos" element={<Students />} />
          <Route path="/turmas/:id" element={<TurmaDetail />} />
          <Route path="/turmas" element={<Turmas />} />
          <Route path="/calendario" element={<Calendar />} />
          <Route path="/presenca" element={<Attendance />} />
          <Route path="/financeiro" element={<Finance />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/filhos/:studentId/relatorios" element={<FilhoRelatorios />} />
          <Route path="/filhos/:studentId/planos/:planId" element={<FilhoPlanoDetail />} />
          <Route path="/filhos/:studentId/planos" element={<FilhoPlanos />} />
          <Route path="/filhos/:studentId" element={<Filho />} />
          <Route path="/filhos" element={<Filhos />} />
          <Route path="/relatorios/:id" element={<RelatorioDetail />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/avaliacoes/config" element={<AvaliacoesConfig />} />
          <Route path="/avaliacoes" element={<Avaliacoes />} />
          <Route path="/comunicacoes/historico" element={<ComunicacoesHistorico />} />
          <Route path="/comunicacoes" element={<Comunicacoes />} />
          <Route path="/midia" element={<Midia />} />
          <Route path="/avisos" element={<Avisos />} />
          <Route path="/notificacoes" element={<Notificacoes />} />
          <Route path="/preferencias" element={<Preferencias />} />
        </Route>
      </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
