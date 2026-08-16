import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import TenantAccessState from './components/TenantAccessState';
import LoginView from './views/LoginView';
import PasswordRecoveryView from './views/PasswordRecoveryView';
import InviteAcceptanceView from './views/InviteAcceptanceView';
import ProfileSelectionView from './views/ProfileSelectionView';
import WhitelabelSelectionView from './views/WhitelabelSelectionView';
import DashboardView from './views/DashboardView';
import PatientListView from './views/PatientListView';
import AgendaView from './views/AgendaView';
import TherapistListView from './views/TherapistListView';
import BackofficeView from './views/BackofficeView';
import ClinicalRecordView from './views/ClinicalRecordView';
import AiResourcesView from './views/AiResourcesView';
import CaptacaoView from './views/CaptacaoView';
import { UserRole, View, Patient } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Loader2 } from 'lucide-react';

import { therapistService } from './services/therapistService';

const TENANT_PRODUCT_VIEWS: View[] = ['DASHBOARD', 'AGENDA', 'PACIENTES', 'TERAPEUTAS', 'PRONTUARIO', 'CAPTACAO'];
const ADMIN_GLOBAL_VIEWS: View[] = ['BACKOFFICE', 'AI_RESOURCES'];

function AppContent() {
  const { user, loading, logout, setActiveRole, setActiveWhitelabel, returnToGlobalAdmin } = useAuth();
  const [view, setView] = useState<View>('DASHBOARD');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [passwordRecoveryEmail, setPasswordRecoveryEmail] = useState('');
  const inviteToken = new URLSearchParams(window.location.search).get('invite');

  useEffect(() => {
    if (user) {
      const isAdminGlobal = user.activeRole === 'ADMIN_GLOBAL';
      const requiresTenant = !!user.activeRole && user.activeRole !== 'ADMIN_GLOBAL';

      if (!user.activeRole && user.roles.length === 1) {
        setActiveRole(user.roles[0]);
        return;
      } else if (user.roles.length > 1 && !user.activeRole) {
        setView('PROFILE_SELECTION');
      } else if (requiresTenant && !user.activeWhitelabelId) {
        setView('WHITELABEL_SELECTION');
      } else if (isAdminGlobal) {
        setView('BACKOFFICE');
      } else {
        if (user.activeRole === 'TERAPEUTA') {
          const activeMembership = user.whitelabelMemberships?.find((membership) => membership.whitelabelId === user.activeWhitelabelId);
          therapistService.ensureTherapistExists({
            email: user.email,
            name: user.name,
            specialty: activeMembership?.therapistSpecialty,
          }, user.activeWhitelabelId);
        }
        setView('DASHBOARD');
      }
    } else {
      setView('LOGIN');
    }
  }, [user]);

  const handleSelectProfile = async (role: UserRole) => {
    setActiveRole(role);

    if (role === 'TERAPEUTA' && user?.activeWhitelabelId) {
      const activeMembership = user.whitelabelMemberships?.find((membership) => membership.whitelabelId === user.activeWhitelabelId);
      await therapistService.ensureTherapistExists({
        email: user.email,
        name: user.name,
        specialty: activeMembership?.therapistSpecialty,
      }, user.activeWhitelabelId);
    }

    if (role === 'ADMIN_GLOBAL') {
      setView('BACKOFFICE');
    } else if (!user?.activeWhitelabelId) {
      setView('WHITELABEL_SELECTION');
    } else {
      setView('DASHBOARD');
    }
  };

  const handleSwitchProfile = () => {
    if (user && user.roles.length > 1) {
      setView('PROFILE_SELECTION');
    }
  };

  const handleSelectWhitelabel = (whitelabelId: string) => {
    setActiveWhitelabel(whitelabelId);
    setView('DASHBOARD');
  };

  const handleSwitchWhitelabel = () => {
    const activeMemberships = user?.whitelabelMemberships?.filter((membership) => membership.status === 'ATIVO') ?? [];
    if (activeMemberships.length > 1) {
      setView('WHITELABEL_SELECTION');
    }
  };

  const handleOpenProntuario = (patient: Patient) => {
    setSelectedPatient(patient);
    setView('PRONTUARIO');
  };

  const handleOpenPasswordRecovery = (email: string) => {
    setPasswordRecoveryEmail(email);
    setView('PASSWORD_RECOVERY');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (inviteToken) {
    return <InviteAcceptanceView token={inviteToken} onFinished={() => window.location.assign(window.location.pathname)} />;
  }

  if (!user) {
    if (view === 'PASSWORD_RECOVERY') {
      return (
        <PasswordRecoveryView
          initialEmail={passwordRecoveryEmail}
          onBackToLogin={() => setView('LOGIN')}
        />
      );
    }

    return <LoginView onLogin={() => {}} onForgotPassword={handleOpenPasswordRecovery} />;
  }

  if (user.roles.length === 0) {
    return (
      <TenantAccessState
        title="Acesso nao vinculado"
        message="Sua conta nao possui convite ativo ou associacao com uma whitelabel. Solicite um novo convite ao administrador."
        actionLabel="Sair"
        onAction={logout}
        variant="warning"
      />
    );
  }

  if (view === 'PROFILE_SELECTION') {
    return <ProfileSelectionView roles={user.roles} onSelect={handleSelectProfile} />;
  }

  if (view === 'WHITELABEL_SELECTION') {
    return (
      <WhitelabelSelectionView
        memberships={user.whitelabelMemberships ?? []}
        onSelect={handleSelectWhitelabel}
      />
    );
  }

  if (!user.activeRole) {
    if (user.roles.length === 1) {
      return (
        <TenantAccessState
          title="Perfil nao selecionado"
          message="Nao foi possivel ativar seu perfil automaticamente. Saia e entre novamente para recarregar suas permissoes."
          actionLabel="Sair"
          onAction={logout}
          variant="warning"
        />
      );
    }

    return <ProfileSelectionView roles={user.roles} onSelect={handleSelectProfile} />;
  }

  const renderView = () => {
    const activeMemberships = user.whitelabelMemberships?.filter((membership) => membership.status === 'ATIVO') ?? [];
    const activeMembership = activeMemberships.find((membership) => membership.whitelabelId === user.activeWhitelabelId);

    if (user.activeRole === 'ADMIN_GLOBAL') {
      if (view === 'AI_RESOURCES') return <AiResourcesView />;
      if (!ADMIN_GLOBAL_VIEWS.includes(view)) return <BackofficeView />;
      return <BackofficeView />;
    }

    if (user.activeRole !== 'ADMIN_GLOBAL' && TENANT_PRODUCT_VIEWS.includes(view)) {
      if (activeMemberships.length === 0) {
        return (
          <TenantAccessState
            title="Nenhum whitelabel ativo"
            message="Sua conta nao possui associacao ativa com um whitelabel. Solicite acesso a um administrador global."
          />
        );
      }

      if (!activeMembership) {
        return (
          <TenantAccessState
            title="Selecione um whitelabel"
            message="Escolha o ambiente de atendimento antes de acessar dados operacionais e clinicos."
            actionLabel="Selecionar Whitelabel"
            onAction={() => setView('WHITELABEL_SELECTION')}
            variant="info"
          />
        );
      }
    }

    switch (view) {
      case 'DASHBOARD': return <DashboardView />;
      case 'PACIENTES': return <PatientListView onOpenProntuario={handleOpenProntuario} />;
      case 'AGENDA': return <AgendaView />;
      case 'TERAPEUTAS': return <TherapistListView />;
      case 'BACKOFFICE': return <BackofficeView />;
      case 'AI_RESOURCES': return <AiResourcesView />;
      case 'CAPTACAO': return <CaptacaoView />;
      case 'CONFIGURACOES': return (
        <TenantAccessState
          title="Configuracoes indisponiveis"
          message="Esta area ainda nao esta habilitada para o perfil atual."
          variant="info"
        />
      );
      case 'PRONTUARIO': return selectedPatient ? (
        <ClinicalRecordView patient={selectedPatient} onBack={() => setView('PACIENTES')} />
      ) : <PatientListView onOpenProntuario={handleOpenProntuario} />;
      default: return (
        <TenantAccessState
          title="Area indisponivel"
          message="Selecione uma opcao valida no menu para continuar."
          variant="info"
        />
      );
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50/50 dark:bg-slate-950 transition-colors duration-300">
      <Sidebar 
        activeView={view} 
        onNavigate={setView} 
        role={user.activeRole} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <main className="min-w-0 flex-1 lg:ml-64 min-h-screen">
        <TopBar 
          role={user.activeRole} 
          onLogout={logout}
          onSwitchProfile={user.roles.length > 1 ? handleSwitchProfile : undefined}
          onSwitchWhitelabel={(user.whitelabelMemberships?.filter((membership) => membership.status === 'ATIVO').length ?? 0) > 1 ? handleSwitchWhitelabel : undefined}
          onReturnToGlobalAdmin={user.roles.includes('ADMIN_GLOBAL') && user.activeRole !== 'ADMIN_GLOBAL' ? returnToGlobalAdmin : undefined}
          onMenuClick={() => setIsSidebarOpen(true)}
        />
        
        <div className="min-w-0 px-4 lg:px-8 pb-12">
          <div className="mx-auto max-w-7xl min-w-0">
            {renderView()}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
