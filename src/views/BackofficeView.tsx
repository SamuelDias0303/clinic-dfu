import React, { useEffect, useState } from 'react';
import {
  Archive,
  Building2,
  Edit2,
  Globe,
  LogIn,
  Loader2,
  Palette,
  Plus,
  Power,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import ConfirmModal from '../components/ConfirmModal';
import WhitelabelFormModal from '../components/WhitelabelFormModal';
import WhitelabelMembersModal from '../components/WhitelabelMembersModal';
import TenantAccessState from '../components/TenantAccessState';
import { useAuth } from '../contexts/AuthContext';
import { whitelabelService } from '../services/whitelabelService';
import { LEGACY_WHITELABEL_ID } from '../services/serviceScope';
import { Whitelabel } from '../types';

const statusClasses: Record<Whitelabel['status'], string> = {
  ATIVO: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  SUSPENSO: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  ARQUIVADO: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
};

export default function BackofficeView() {
  const { user, assumeLegacyManagement } = useAuth();
  const [whitelabels, setWhitelabels] = useState<Whitelabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [editingWhitelabel, setEditingWhitelabel] = useState<Whitelabel | undefined>();
  const [membersWhitelabel, setMembersWhitelabel] = useState<Whitelabel | undefined>();
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    variant: 'info',
    onConfirm: async () => {},
  });

  const isAdminGlobal = user?.activeRole === 'ADMIN_GLOBAL';
  const isGestor = user?.activeRole === 'GESTOR';
  const activeMembership = user?.whitelabelMemberships?.find(
    (membership) => membership.whitelabelId === user.activeWhitelabelId && membership.status === 'ATIVO'
  );

  const legacyWhitelabel: Whitelabel = {
    id: LEGACY_WHITELABEL_ID,
    name: 'Clinic DFU - Legado',
    slug: LEGACY_WHITELABEL_ID,
    status: 'ATIVO',
    plan: 'Legado',
    workspaceType: 'CLINICA',
    branding: {
      primaryColor: '#0066ff',
    },
  };

  useEffect(() => {
    if (!isAdminGlobal) {
      if (isGestor && activeMembership) {
        setLoading(true);

        const unsubscribe = whitelabelService.subscribeToWhitelabel(activeMembership.whitelabelId, (whitelabel) => {
          setWhitelabels([whitelabel ?? {
            id: activeMembership.whitelabelId,
            name: activeMembership.whitelabelName || activeMembership.whitelabelId,
            slug: activeMembership.whitelabelId,
            status: 'ATIVO',
            plan: 'Operacional',
            branding: {
              primaryColor: '#0066ff',
            },
          }]);
          setLoading(false);
        });

        return () => unsubscribe();
      } else {
        setWhitelabels([]);
      }
      setLoading(false);
      return;
    }

    const unsubscribe = whitelabelService.subscribeToWhitelabels((data) => {
      setWhitelabels([
        legacyWhitelabel,
        ...data.filter((item) => item.id !== LEGACY_WHITELABEL_ID && item.slug !== LEGACY_WHITELABEL_ID),
      ]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeMembership, isAdminGlobal, isGestor]);

  const totalWhitelabels = whitelabels.length;
  const activeWhitelabels = whitelabels.filter((item) => item.status === 'ATIVO').length;
  const suspendedWhitelabels = whitelabels.filter((item) => item.status === 'SUSPENSO').length;

  const handleCreate = () => {
    if (!isAdminGlobal) return;
    setEditingWhitelabel(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (whitelabel: Whitelabel) => {
    if (!isAdminGlobal) return;
    setEditingWhitelabel(whitelabel);
    setIsFormOpen(true);
  };

  const handleSubmit = async (payload: Omit<Whitelabel, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingWhitelabel?.id) {
      await whitelabelService.updateWhitelabel(editingWhitelabel.id, payload);
    } else {
      await whitelabelService.createWhitelabel(payload);
    }
  };

  const openMembers = (whitelabel: Whitelabel) => {
    if (whitelabel.id === LEGACY_WHITELABEL_ID) return;
    setMembersWhitelabel(whitelabel);
    setIsMembersOpen(true);
  };

  const requestStatusChange = (whitelabel: Whitelabel, status: Whitelabel['status']) => {
    if (!isAdminGlobal) return;
    const actionLabel = status === 'ATIVO' ? 'reativar' : status === 'SUSPENSO' ? 'suspender' : 'arquivar';
    setConfirmAction({
      isOpen: true,
      title: `${actionLabel.charAt(0).toUpperCase()}${actionLabel.slice(1)} whitelabel`,
      message: `Confirma ${actionLabel} ${whitelabel.name}?`,
      confirmText: actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1),
      variant: status === 'ARQUIVADO' ? 'danger' : status === 'SUSPENSO' ? 'warning' : 'info',
      onConfirm: async () => {
        if (!whitelabel.id) return;
        await whitelabelService.updateWhitelabel(whitelabel.id, { status });
      },
    });
  };

  if (!isAdminGlobal && !isGestor) {
    return (
      <TenantAccessState
        title="Acesso restrito"
        message="A gestao de membros esta disponivel apenas para administradores globais e gestores da whitelabel."
      />
    );
  }

  if (isGestor && !activeMembership) {
    return (
      <TenantAccessState
        title="Whitelabel nao selecionada"
        message="Selecione uma whitelabel ativa antes de gerenciar convites e membros."
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isAdminGlobal ? 'Administracao Global' : 'Gestao da Whitelabel'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs lg:text-sm mt-1 font-medium">
            {isAdminGlobal
              ? 'Gestao de whitelabels, dominios, membros e configuracoes operacionais.'
              : 'Convites e membros vinculados somente ao ambiente ativo.'}
          </p>
        </div>
        {isAdminGlobal && (
          <button
            onClick={handleCreate}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95 sm:w-auto"
          >
            <Plus size={18} />
            Novo Whitelabel
          </button>
        )}
      </div>

      {isAdminGlobal && (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Building2 size={20} />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Whitelabels</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? '...' : totalWhitelabels}</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Ativos</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? '...' : activeWhitelabels}</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <Power size={20} />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Suspensos</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? '...' : suspendedWhitelabels}</div>
            </div>
          </div>
        </div>
      </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[880px] text-left border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-bold bg-slate-50/50 dark:bg-slate-800/50">
                <th className="px-6 py-3">Whitelabel</th>
                <th className="px-6 py-3">Dominio</th>
                <th className="px-6 py-3">Plano</th>
                <th className="px-6 py-3">Marca</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <Loader2 className="animate-spin text-primary mx-auto" size={24} />
                  </td>
                </tr>
              ) : whitelabels.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    Nenhum whitelabel cadastrado.
                  </td>
                </tr>
              ) : (
                whitelabels.map((whitelabel) => (
                  <tr key={whitelabel.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm text-slate-900 dark:text-white">{whitelabel.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{whitelabel.slug}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-2 min-w-0">
                        <Globe size={14} className="text-slate-400" />
                        <span className="truncate">{whitelabel.domain || 'Sem dominio'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold">
                        {whitelabel.plan}
                      </span>
                      {whitelabel.id === LEGACY_WHITELABEL_ID && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1">
                          Dados antigos globais
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        <span
                          className="size-4 rounded-full border border-slate-200 dark:border-slate-700"
                          style={{ backgroundColor: whitelabel.branding.primaryColor }}
                        />
                        <Palette size={14} />
                        {whitelabel.branding.primaryColor}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusClasses[whitelabel.status]}`}>
                        {whitelabel.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {whitelabel.id === LEGACY_WHITELABEL_ID && isAdminGlobal && (
                          <button
                            onClick={assumeLegacyManagement}
                            className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                            title="Acessar dados legados"
                          >
                            <LogIn size={17} />
                          </button>
                        )}
                        {whitelabel.id !== LEGACY_WHITELABEL_ID && (
                        <button
                          onClick={() => openMembers(whitelabel)}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                          title="Gerenciar membros"
                        >
                          <Users size={17} />
                        </button>
                        )}
                        {isAdminGlobal && whitelabel.id !== LEGACY_WHITELABEL_ID && (
                          <>
                            <button
                              onClick={() => handleEdit(whitelabel)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={17} />
                            </button>
                            {whitelabel.status === 'ATIVO' ? (
                              <button
                                onClick={() => requestStatusChange(whitelabel, 'SUSPENSO')}
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                title="Suspender"
                              >
                                <Power size={17} />
                              </button>
                            ) : (
                              <button
                                onClick={() => requestStatusChange(whitelabel, 'ATIVO')}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                title="Reativar"
                              >
                                <Power size={17} />
                              </button>
                            )}
                          <button
                            onClick={() => requestStatusChange(whitelabel, 'ARQUIVADO')}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                            title="Arquivar"
                          >
                            <Archive size={17} />
                          </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
          {loading ? (
            <div className="flex items-center justify-center px-4 py-10">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : whitelabels.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Nenhum whitelabel cadastrado.
            </div>
          ) : (
            whitelabels.map((whitelabel) => (
              <div key={whitelabel.id} className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-slate-900 dark:text-white">{whitelabel.name}</div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">{whitelabel.slug}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClasses[whitelabel.status]}`}>
                    {whitelabel.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold uppercase text-slate-400">Dominio</span>
                    <span className="truncate text-right font-medium text-slate-700 dark:text-slate-300">{whitelabel.domain || 'Sem dominio'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold uppercase text-slate-400">Plano</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{whitelabel.plan}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold uppercase text-slate-400">Marca</span>
                    <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                      <span className="size-4 rounded-full border border-slate-200 dark:border-slate-700" style={{ backgroundColor: whitelabel.branding.primaryColor }} />
                      {whitelabel.branding.primaryColor}
                    </span>
                  </div>
                  {whitelabel.id === LEGACY_WHITELABEL_ID && (
                    <div className="rounded-lg bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                      Dados antigos globais
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  {whitelabel.id === LEGACY_WHITELABEL_ID && isAdminGlobal && (
                    <button onClick={assumeLegacyManagement} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-primary dark:border-slate-700">
                      Legado
                    </button>
                  )}
                  {whitelabel.id !== LEGACY_WHITELABEL_ID && (
                    <button onClick={() => openMembers(whitelabel)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-primary dark:border-slate-700">
                      Membros
                    </button>
                  )}
                  {isAdminGlobal && whitelabel.id !== LEGACY_WHITELABEL_ID && (
                    <>
                      <button onClick={() => handleEdit(whitelabel)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-blue-600 dark:border-slate-700 dark:text-blue-400">
                        Editar
                      </button>
                      <button
                        onClick={() => requestStatusChange(whitelabel, whitelabel.status === 'ATIVO' ? 'SUSPENSO' : 'ATIVO')}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-amber-600 dark:border-slate-700 dark:text-amber-400"
                      >
                        {whitelabel.status === 'ATIVO' ? 'Suspender' : 'Reativar'}
                      </button>
                      <button onClick={() => requestStatusChange(whitelabel, 'ARQUIVADO')} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 dark:border-rose-900 dark:text-rose-400">
                        Arquivar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <WhitelabelFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmit}
        initialData={editingWhitelabel}
      />

      <WhitelabelMembersModal
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
        whitelabel={membersWhitelabel}
      />

      <ConfirmModal
        isOpen={confirmAction.isOpen}
        onClose={() => setConfirmAction({ ...confirmAction, isOpen: false })}
        onConfirm={confirmAction.onConfirm}
        title={confirmAction.title}
        message={confirmAction.message}
        confirmText={confirmAction.confirmText}
        variant={confirmAction.variant}
      />
    </motion.div>
  );
}
