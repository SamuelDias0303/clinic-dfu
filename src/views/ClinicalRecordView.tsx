import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  History, 
  ClipboardList, 
  PenTool, 
  Mic, 
  Image as ImageIcon,
  Save,
  CheckCircle,
  Loader2,
  Calendar,
  Clock,
  User,
  Bell,
  MoreVertical,
  Pencil,
  Trash2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Patient, Evolution, Anamnese } from '../types';
import { clinicalRecordService } from '../services/clinicalRecordService';
import { useAuth } from '../contexts/AuthContext';

interface ClinicalRecordViewProps {
  patient: Patient;
  onBack: () => void;
}

type Tab = 'HISTORICO' | 'ANAMNESE' | 'EVOLUIR' | 'GRAVACAO' | 'IMAGENS';

export default function ClinicalRecordView({ patient, onBack }: ClinicalRecordViewProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('HISTORICO');
  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [anamnese, setAnamnese] = useState<Anamnese | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form states
  const [currentEvolution, setCurrentEvolution] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const canManageEvolution =
    user?.activeRole === 'ADMIN_GLOBAL' ||
    user?.activeRole === 'GESTOR' ||
    user?.activeRole === 'TERAPEUTA';
  const [anamneseForm, setAnamneseForm] = useState({
    diagnosis: '',
    mainComplaint: '',
    hda: '',
    personalHistory: '',
    familyHistory: ''
  });

  useEffect(() => {
    if (!patient.id) return;

    const unsubEvolutions = clinicalRecordService.subscribeToEvolutions(patient.id, (data) => {
      setEvolutions(data);
      setLoading(false);
    }, user?.activeWhitelabelId);

    const unsubAnamnese = clinicalRecordService.subscribeToAnamnese(patient.id, (data) => {
      if (data) {
        setAnamnese(data);
        setAnamneseForm({
          diagnosis: data.diagnosis || '',
          mainComplaint: data.mainComplaint || '',
          hda: data.hda || '',
          personalHistory: data.personalHistory || '',
          familyHistory: data.familyHistory || ''
        });
      }
    }, user?.activeWhitelabelId);

    return () => {
      unsubEvolutions();
      unsubAnamnese();
    };
  }, [patient.id, user?.activeWhitelabelId]);

  const handleSaveAnamnese = async () => {
    if (!patient.id) return;
    setSaving(true);
    try {
      await clinicalRecordService.saveAnamnese({
        patientId: patient.id,
        ...anamneseForm
      }, user?.activeWhitelabelId);
      alert('Anamnese salva com sucesso!');
    } catch (error) {
      console.error('Error saving anamnese:', error);
      alert('Erro ao salvar anamnese.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEvolution = async (status: 'DRAFT' | 'FINALIZED') => {
    if (!patient.id || !user) return;
    if (!currentEvolution.trim()) {
      alert('Por favor, descreva a evolução.');
      return;
    }

    setSaving(true);
    try {
      const now = new Date();
      await clinicalRecordService.createEvolution({
        patientId: patient.id,
        therapistId: user.email,
        therapistName: user.name,
        date: now.toLocaleDateString('pt-BR'),
        time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'SESSÃO DE ATENDIMENTO',
        content: currentEvolution,
        status
      }, user.activeWhitelabelId);
      setCurrentEvolution('');
      if (status === 'FINALIZED') {
        setActiveTab('HISTORICO');
      }
      alert(status === 'FINALIZED' ? 'Evolução finalizada!' : 'Rascunho salvo!');
    } catch (error) {
      console.error('Error saving evolution:', error);
      alert('Erro ao salvar evolução.');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (evo: Evolution) => {
    setActiveTab('HISTORICO');
    setEditingId(evo.id ?? null);
    setEditingContent(evo.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingContent('');
  };

  const handleUpdateEvolution = async (id: string) => {
    if (!editingContent.trim()) {
      alert('A evolução não pode ficar vazia.');
      return;
    }
    setSaving(true);
    try {
      await clinicalRecordService.updateEvolution(id, { content: editingContent }, user?.activeWhitelabelId);
      setEditingId(null);
      setEditingContent('');
    } catch (error) {
      console.error('Error updating evolution:', error);
      alert('Erro ao editar evolução.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvolution = async (id: string) => {
    if (!window.confirm('Excluir esta evolução? Esta ação não pode ser desfeita.')) return;
    setSaving(true);
    try {
      await clinicalRecordService.deleteEvolution(id, user?.activeWhitelabelId);
      if (editingId === id) handleCancelEdit();
    } catch (error) {
      console.error('Error deleting evolution:', error);
      alert('Erro ao excluir evolução.');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'HISTORICO', label: 'HISTÓRICO', icon: History },
    { id: 'ANAMNESE', label: 'ANAMNESE', icon: ClipboardList },
    { id: 'EVOLUIR', label: 'EVOLUIR', icon: PenTool },
    { id: 'GRAVACAO', label: 'GRAVAÇÃO', icon: Mic },
    { id: 'IMAGENS', label: 'IMAGENS', icon: ImageIcon },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 dark:text-slate-400">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Prontuário</h2>
        </div>
        <button className="p-2 text-slate-400 hover:text-primary transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 size-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900" />
        </button>
      </div>

      {/* Patient Info Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-all duration-300">
        <div className="p-6">
          <div className="flex items-start gap-6">
            <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-300 dark:text-slate-600">
              <User size={40} />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-[#1e5d8c] dark:text-blue-400 uppercase">{patient.name}</h3>
              <p className="text-slate-500 dark:text-slate-400 font-bold mt-1">CPF: {patient.cpf}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12 mt-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Data de Nascimento:</label>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{patient.birthDate}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Telefone:</label>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{patient.phone}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Email:</label>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{patient.email}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Convênio:</label>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase">{patient.healthPlan}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Endereço:</label>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{patient.address}</p>
                </div>
                {patient.fatherName && (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Pai:</label>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{patient.fatherName}</p>
                  </div>
                )}
                {patient.motherName && (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Mae:</label>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{patient.motherName}</p>
                  </div>
                )}
                {patient.homeLocationUrl && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Localizacao:</label>
                    <a
                      href={patient.homeLocationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-bold text-primary hover:text-primary/80 break-all"
                    >
                      Abrir link da localizacao
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Evoluções Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 transition-all duration-300">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6">Evoluções</h3>
        
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${
                activeTab === tab.id 
                  ? 'bg-[#1e5d8c] border-[#1e5d8c] text-white shadow-md' 
                  : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-200 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <tab.icon size={24} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="animate-spin text-primary" size={32} />
              <p className="text-slate-400 text-sm font-medium">Carregando prontuário...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === 'HISTORICO' && (
                <motion.div
                  key="historico"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {evolutions.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 dark:text-slate-500">Nenhuma evolução registrada.</div>
                  ) : (
                    evolutions.map((evo) => (
                      <div key={evo.id} className="p-6 border border-slate-100 dark:border-slate-800 rounded-2xl hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-[#1e5d8c] dark:bg-blue-600 text-white text-[10px] font-bold rounded-full">{evo.date}</span>
                            <span className="px-3 py-1 bg-[#1e5d8c] dark:bg-blue-600 text-white text-[10px] font-bold rounded-full">{evo.time}</span>
                          </div>
                          {canManageEvolution && evo.id && editingId !== evo.id && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleStartEdit(evo)}
                                className="p-2 rounded-lg text-slate-400 hover:text-[#1e5d8c] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Editar evolução"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteEvolution(evo.id!)}
                                disabled={saving}
                                className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50"
                                title="Excluir evolução"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                        <h4 className="text-[#1e5d8c] dark:text-blue-400 font-bold uppercase mb-2">
                          {evo.type} com Dr(a). {evo.therapistName}
                        </h4>
                        {editingId === evo.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={editingContent}
                              onChange={e => setEditingContent(e.target.value)}
                              className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm min-h-[150px] dark:text-white"
                            />
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleUpdateEvolution(evo.id!)}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-[#1e5d8c] text-white rounded-xl font-bold text-sm hover:bg-[#1e5d8c]/90 transition-all active:scale-95 disabled:opacity-50"
                              >
                                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                SALVAR
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
                              >
                                <X size={16} />
                                CANCELAR
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {evo.content}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </motion.div>
              )}

              {activeTab === 'ANAMNESE' && (
                <motion.div
                  key="anamnese"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="relative">
                    <select className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none dark:text-white">
                      <option>Anamnese</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronLeft size={20} className="-rotate-90" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Diagnostico</label>
                      <textarea
                        value={anamneseForm.diagnosis}
                        onChange={e => setAnamneseForm({...anamneseForm, diagnosis: e.target.value})}
                        className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm min-h-[100px] dark:text-white"
                        placeholder="Informe - Diagnostico"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Queixa Principal</label>
                      <textarea 
                        value={anamneseForm.mainComplaint}
                        onChange={e => setAnamneseForm({...anamneseForm, mainComplaint: e.target.value})}
                        className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm min-h-[100px] dark:text-white"
                        placeholder="Informe - Queixa Principal"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">HDA</label>
                      <textarea 
                        value={anamneseForm.hda}
                        onChange={e => setAnamneseForm({...anamneseForm, hda: e.target.value})}
                        className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm min-h-[100px] dark:text-white"
                        placeholder="Informe - HDA"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Antecedentes Pessoais</label>
                      <textarea 
                        value={anamneseForm.personalHistory}
                        onChange={e => setAnamneseForm({...anamneseForm, personalHistory: e.target.value})}
                        className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm min-h-[100px] dark:text-white"
                        placeholder="Informe - Antecedentes Pessoais"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Antecedentes Familiares</label>
                      <textarea 
                        value={anamneseForm.familyHistory}
                        onChange={e => setAnamneseForm({...anamneseForm, familyHistory: e.target.value})}
                        className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm min-h-[100px] dark:text-white"
                        placeholder="Informe - Antecedentes Familiares"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button 
                      onClick={handleSaveAnamnese}
                      disabled={saving}
                      className="flex items-center gap-2 px-8 py-3 bg-[#1e5d8c] text-white rounded-xl font-bold hover:bg-[#1e5d8c]/90 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                      SALVAR ANAMNESE
                    </button>
                  </div>
                </motion.div>
              )}

              {activeTab === 'EVOLUIR' && (
                <motion.div
                  key="evoluir"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <textarea 
                    value={currentEvolution}
                    onChange={e => setCurrentEvolution(e.target.value)}
                    className="w-full p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm min-h-[250px] shadow-inner dark:text-white"
                    placeholder="Descreva a evolução do paciente nesta sessão..."
                  />

                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => handleSaveEvolution('DRAFT')}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-[#45b39d] text-white rounded-xl font-bold hover:bg-[#45b39d]/90 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                      SALVAR
                    </button>
                    <button 
                      onClick={() => handleSaveEvolution('FINALIZED')}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-[#1e5d8c] text-white rounded-xl font-bold hover:bg-[#1e5d8c]/90 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                      FINALIZAR
                    </button>
                  </div>
                </motion.div>
              )}

              {(activeTab === 'GRAVACAO' || activeTab === 'IMAGENS') && (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4"
                >
                  {activeTab === 'GRAVACAO' ? <Mic size={48} /> : <ImageIcon size={48} />}
                  <p className="font-medium">Funcionalidade em desenvolvimento.</p>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </motion.div>
  );
}
