import React, { useEffect, useState } from 'react';
import { Clipboard, Edit2, Loader2, Send, Trash2, UserPlus, X } from 'lucide-react';
import { motion } from 'motion/react';
import { UserRole, Whitelabel, WhitelabelMembership } from '../types';
import { whitelabelMemberService } from '../services/whitelabelMemberService';
import { inviteService } from '../services/inviteService';
import { therapistService } from '../services/therapistService';
import { whitelabelService } from '../services/whitelabelService';
import { useAuth } from '../contexts/AuthContext';

interface WhitelabelMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  whitelabel?: Whitelabel;
}

const roleLabels: Record<UserRole, string> = {
  ADMIN_GLOBAL: 'ADMIN GLOBAL',
  GESTOR: 'GESTOR',
  REPCAO: 'RECEPCAO',
  TERAPEUTA: 'TERAPEUTA',
};

function formatRoles(roles: UserRole[]) {
  return roles.map((role) => roleLabels[role] ?? role).join(', ');
}

function parseList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export default function WhitelabelMembersModal({ isOpen, onClose, whitelabel }: WhitelabelMembersModalProps) {
  const { user } = useAuth();
  const roleOptions: UserRole[] = user?.activeRole === 'ADMIN_GLOBAL'
    ? ['GESTOR', 'REPCAO', 'TERAPEUTA']
    : ['REPCAO', 'TERAPEUTA'];
  const defaultRole = roleOptions[0];
  const [members, setMembers] = useState<WhitelabelMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState('');
  const [specialtiesInput, setSpecialtiesInput] = useState('');
  const [savingSpecialties, setSavingSpecialties] = useState(false);
  const [editingMember, setEditingMember] = useState<WhitelabelMembership | null>(null);
  const [editData, setEditData] = useState({
    roles: [defaultRole] as UserRole[],
    therapistSpecialty: '',
  });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    roles: [defaultRole] as UserRole[],
    status: 'ATIVO' as WhitelabelMembership['status'],
    therapistSpecialty: '',
  });
  const therapistSpecialtyOptions = whitelabel?.settings?.therapistSpecialties ?? [];

  useEffect(() => {
    setSpecialtiesInput(therapistSpecialtyOptions.join(', '));
  }, [therapistSpecialtyOptions.join('|')]);

  useEffect(() => {
    if (!isOpen || !whitelabel?.id) return;

    setLoading(true);
    const unsubscribe = whitelabelMemberService.subscribeToMembers(whitelabel.id, (data) => {
      setMembers(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, whitelabel?.id]);

  useEffect(() => {
    if (formData.roles.every((role) => roleOptions.includes(role))) return;
    setFormData((current) => ({
      ...current,
      roles: [defaultRole],
    }));
  }, [defaultRole, formData.roles, roleOptions]);

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      roles: [defaultRole],
      status: 'ATIVO',
      therapistSpecialty: '',
    });
  };

  const handleRoleToggle = (role: UserRole) => {
    const nextRoles = formData.roles.includes(role)
      ? formData.roles.filter((item) => item !== role)
      : [...formData.roles, role];
    setFormData({ ...formData, roles: nextRoles.length > 0 ? nextRoles : [defaultRole] });
  };

  const handleEditRoleToggle = (role: UserRole) => {
    const nextRoles = editData.roles.includes(role)
      ? editData.roles.filter((item) => item !== role)
      : [...editData.roles, role];
    setEditData({
      ...editData,
      roles: nextRoles.length > 0 ? nextRoles : [defaultRole],
    });
  };

  const startEdit = (member: WhitelabelMembership) => {
    setEditingMember(member);
    setEditData({
      roles: member.roles.filter((role) => roleOptions.includes(role)).length > 0
        ? member.roles.filter((role) => roleOptions.includes(role))
        : [defaultRole],
      therapistSpecialty: member.therapistSpecialty || '',
    });
  };

  const handleSaveMember = async () => {
    if (!whitelabel?.id || !editingMember?.id) return;

    const isTherapist = editData.roles.includes('TERAPEUTA');
    const therapistSpecialty = isTherapist ? editData.therapistSpecialty || undefined : undefined;

    setSaving(true);
    try {
      const payload = {
        roles: editData.roles,
        therapistSpecialty,
      };

      await whitelabelMemberService.updateMember(whitelabel.id, editingMember.id, payload);

      if (editingMember.status === 'PENDENTE' && editingMember.invitationToken) {
        await inviteService.updateInvite(editingMember.invitationToken, payload);
      }

      if (editingMember.status === 'ATIVO' && isTherapist) {
        await therapistService.ensureTherapistExists({
          email: editingMember.email,
          name: editingMember.name,
          specialty: therapistSpecialty,
        }, whitelabel.id);
      }

      setEditingMember(null);
    } catch (error) {
      console.error('Error updating member:', error);
      alert('Erro ao atualizar membro.');
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!whitelabel?.id) return;

    setSaving(true);
    setLastInviteUrl('');
    try {
      const result = await inviteService.createInvite({
        whitelabel,
        name: formData.name,
        email: formData.email,
        roles: formData.roles,
        therapistSpecialty: formData.roles.includes('TERAPEUTA') ? formData.therapistSpecialty || undefined : undefined,
        invitedBy: user?.email,
      });
      setLastInviteUrl(result.inviteUrl);
      resetForm();
    } catch (error) {
      console.error('Error creating invite:', error);
      alert('Erro ao gerar convite.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!lastInviteUrl) return;
    await copyInviteUrl(lastInviteUrl);
  };

  const copyInviteUrl = async (inviteUrl: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      alert('Link do convite copiado.');
    } catch {
      prompt('Copie o link do convite:', inviteUrl);
    }
  };

  const handleSaveSpecialties = async () => {
    if (!whitelabel?.id) return;

    const nextSpecialties = parseList(specialtiesInput);
    setSavingSpecialties(true);
    try {
      await whitelabelService.updateTherapistSpecialties(whitelabel.id, nextSpecialties);
    } catch (error) {
      console.error('Error updating therapist specialties:', error);
      alert('Erro ao salvar modalidades.');
    } finally {
      setSavingSpecialties(false);
    }
  };

  const handleDelete = async (member: WhitelabelMembership) => {
    if (!whitelabel?.id || !member.id) return;
    if (!confirm(`Remover ${member.name} deste whitelabel?`)) return;
    await whitelabelMemberService.deleteMember(whitelabel.id, member.id);
  };

  if (!isOpen || !whitelabel) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-stretch justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-xl dark:bg-slate-900 sm:h-auto sm:max-h-[92vh] sm:max-w-6xl sm:rounded-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Gerenciar membros</h3>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{whitelabel.name}</p>
          </div>
          <button onClick={onClose} className="shrink-0 p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-x-hidden overflow-y-auto lg:grid-cols-[340px_minmax(0,1fr)]">
          <form onSubmit={handleInvite} className="space-y-4 border-b border-slate-100 p-4 dark:border-slate-800 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <UserPlus size={18} className="text-primary" />
              Novo convite
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label>
              <input
                required
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail</label>
              <input
                required
                type="email"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Papeis</label>
              <div className="flex flex-wrap gap-2">
                {roleOptions.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleRoleToggle(role)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                      formData.roles.includes(role)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {roleLabels[role]}
                  </button>
                ))}
              </div>
            </div>

            {formData.roles.includes('TERAPEUTA') && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Modalidade</label>
                <select
                  value={formData.therapistSpecialty}
                  onChange={(event) => setFormData({ ...formData, therapistSpecialty: event.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Definir depois</option>
                  {therapistSpecialtyOptions.map((specialty) => (
                    <option key={specialty} value={specialty}>{specialty}</option>
                  ))}
                </select>
                {therapistSpecialtyOptions.length === 0 && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                    Cadastre modalidades na configuracao da whitelabel para habilitar opcoes.
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18} /> Gerar Convite</>}
            </button>

            {lastInviteUrl && (
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-900/20 p-3">
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-2">Convite gerado</div>
                <div className="text-xs text-slate-600 dark:text-slate-300 break-all mb-3">{lastInviteUrl}</div>
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-center justify-center gap-2"
                >
                  <Clipboard size={14} />
                  Copiar link
                </button>
              </div>
            )}
          </form>

          <div className="min-w-0 p-4 sm:p-6">
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
              <div className="mb-3">
                <div className="text-sm font-bold text-slate-900 dark:text-white">Modalidades de terapeutas</div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Separe por virgulas para liberar opcoes nos convites e perfis.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={specialtiesInput}
                  onChange={(event) => setSpecialtiesInput(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="Fisioterapia, Fonoaudiologia, Psicologia"
                />
                <button
                  type="button"
                  onClick={handleSaveSpecialties}
                  disabled={savingSpecialties}
                  className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {savingSpecialties && <Loader2 className="animate-spin" size={16} />}
                  Salvar
                </button>
              </div>
            </div>

            {editingMember && (
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">Editar membro</div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">{editingMember.name} · {editingMember.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingMember(null)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700"
                    title="Cancelar edicao"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Papeis</label>
                    <div className="flex flex-wrap gap-2">
                      {roleOptions.map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => handleEditRoleToggle(role)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                            editData.roles.includes(role)
                              ? 'bg-primary text-white border-primary'
                              : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {roleLabels[role]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Modalidade</label>
                    <select
                      disabled={!editData.roles.includes('TERAPEUTA')}
                      value={editData.therapistSpecialty}
                      onChange={(event) => setEditData({ ...editData, therapistSpecialty: event.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                    >
                      <option value="">Definir depois</option>
                      {therapistSpecialtyOptions.map((specialty) => (
                        <option key={specialty} value={specialty}>{specialty}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingMember(null)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveMember}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving && <Loader2 className="animate-spin" size={14} />}
                    Salvar
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="h-48 flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={28} />
              </div>
            ) : members.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                Nenhum membro associado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                      <th className="py-2">Membro</th>
                      <th className="py-2">Papeis</th>
                      <th className="py-2">Modalidade</th>
                      <th className="py-2">Status</th>
                      <th className="py-2 text-right">Acoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {members.map((member) => (
                      <tr key={member.id}>
                        <td className="py-3">
                          <div className="text-sm font-bold text-slate-900 dark:text-white">{member.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{member.email}</div>
                        </td>
                        <td className="py-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                          {formatRoles(member.roles)}
                        </td>
                        <td className="py-3 text-xs text-slate-500 dark:text-slate-400">
                          {member.roles.includes('TERAPEUTA') ? member.therapistSpecialty || 'A definir' : '-'}
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            member.status === 'ATIVO'
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          }`}>
                            {member.status}
                          </span>
                          {member.invitationToken && member.status === 'PENDENTE' && (
                            <div className="text-[10px] text-slate-400 mt-1">Convite enviado</div>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => startEdit(member)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors mr-1"
                            title="Editar membro"
                          >
                            <Edit2 size={16} />
                          </button>
                          {member.status === 'PENDENTE' && member.inviteUrl && (
                            <button
                              onClick={() => copyInviteUrl(member.inviteUrl!)}
                              className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors mr-1"
                              title="Copiar convite"
                            >
                              <Clipboard size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(member)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                            title="Remover membro"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
