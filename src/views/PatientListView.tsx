import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, MoreVertical, UserPlus, Trash2, Edit2, FileText, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Patient } from '../types';
import { patientService } from '../services/patientService';
import { therapistService, Therapist } from '../services/therapistService';
import { useAuth } from '../contexts/AuthContext';
import PatientFormModal from '../components/PatientFormModal';
import ConfirmModal from '../components/ConfirmModal';

export default function PatientListView({ onOpenProntuario }: { onOpenProntuario: (patient: Patient) => void }) {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<string | null>(null);
  const [editingPatient, setEditingPatient] = useState<Patient | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const filterId = user?.activeRole === 'TERAPEUTA' ? user.email : undefined;
    const whitelabelId = user?.activeWhitelabelId;
    
    const unsubscribePatients = patientService.subscribeToPatients((data) => {
      setPatients(data);
      setLoading(false);
    }, filterId, whitelabelId);

    const unsubscribeTherapists = therapistService.subscribeToTherapists(setTherapists, whitelabelId);

    return () => {
      unsubscribePatients();
      unsubscribeTherapists();
    };
  }, [user]);

  const handleCreatePatient = async (data: Omit<Patient, 'id' | 'createdAt'>) => {
    await patientService.createPatient(data, user?.activeWhitelabelId);
  };

  const handleUpdatePatient = async (data: Omit<Patient, 'id' | 'createdAt'>) => {
    if (editingPatient?.id) {
      await patientService.updatePatient(editingPatient.id, data, user?.activeWhitelabelId);
    }
  };

  const handleDeletePatient = async (id: string) => {
    setPatientToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (patientToDelete) {
      await patientService.deletePatient(patientToDelete, user?.activeWhitelabelId);
      setPatientToDelete(null);
    }
  };

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cpf.includes(searchTerm) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTherapist = selectedTherapistId === 'all' || p.therapistId === selectedTherapistId;
    
    return matchesSearch && matchesTherapist;
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4 lg:space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Pacientes</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs lg:text-sm mt-1 font-medium">Gerencie o cadastro e prontuário dos seus pacientes.</p>
        </div>
        <button 
          onClick={() => {
            setEditingPatient(undefined);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95"
        >
          <UserPlus size={18} />
          Novo Paciente
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 max-w-2xl min-w-0">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar paciente..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white"
              />
            </div>
            
            {user?.activeRole === 'GESTOR' && (
              <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 min-w-0">
                <Users size={16} className="text-slate-400" />
                <select 
                  value={selectedTherapistId}
                  onChange={e => setSelectedTherapistId(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 text-sm outline-none dark:text-white min-w-0 w-full"
                >
                  <option value="all">Todos os Terapeutas</option>
                  {therapists.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="text-xs lg:text-sm text-slate-500 dark:text-slate-400 font-medium">
            Mostrando <span className="text-slate-900 dark:text-slate-100 font-bold">{filteredPatients.length}</span> de <span className="text-slate-900 dark:text-slate-100 font-bold">{patients.length}</span> pacientes
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-bold bg-slate-50/50 dark:bg-slate-900/50">
                <th className="px-6 py-3">Paciente</th>
                <th className="px-6 py-3">Contato</th>
                <th className="px-6 py-3">Convênio</th>
                {user?.activeRole === 'GESTOR' && <th className="px-6 py-3">Terapeuta</th>}
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={user?.activeRole === 'GESTOR' ? 6 : 5} className="px-6 py-12 text-center text-slate-400 text-sm">
                    Carregando pacientes...
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={user?.activeRole === 'GESTOR' ? 6 : 5} className="px-6 py-12 text-center text-slate-400 text-sm">
                    Nenhum paciente encontrado.
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {patient.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{patient.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">CPF: {patient.cpf}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">{patient.phone}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{patient.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 font-medium">{patient.healthPlan}</td>
                    {user?.activeRole === 'GESTOR' && (
                      <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 font-medium">
                        {patient.therapistName || 'Não vinculado'}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        patient.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {patient.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 transition-opacity">
                        <button 
                          onClick={() => onOpenProntuario(patient)}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                          title="Prontuário"
                        >
                          <FileText size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            setEditingPatient(patient);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeletePatient(patient.id!)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Carregando pacientes...</div>
          ) : filteredPatients.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Nenhum paciente encontrado.</div>
          ) : (
            filteredPatients.map((patient) => (
              <div key={patient.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {patient.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{patient.name}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">CPF: {patient.cpf}</div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    patient.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {patient.status.toUpperCase()}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[9px] tracking-tight">Contato</div>
                    <div className="text-slate-700 dark:text-slate-300 font-medium">{patient.phone}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[9px] tracking-tight">Convênio</div>
                    <div className="text-slate-700 dark:text-slate-300 font-medium">{patient.healthPlan}</div>
                  </div>
                </div>

                {user?.activeRole === 'GESTOR' && (
                  <div className="text-[10px] text-slate-500 font-medium">
                    Terapeuta: {patient.therapistName || 'Não vinculado'}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <button 
                    onClick={() => onOpenProntuario(patient)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-primary bg-primary/5 dark:bg-primary/10 rounded-lg text-xs font-bold"
                  >
                    <FileText size={14} />
                    Prontuário
                  </button>
                  <button 
                    onClick={() => {
                      setEditingPatient(patient);
                      setIsModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs font-bold"
                  >
                    <Edit2 size={14} />
                    Editar
                  </button>
                  <button 
                    onClick={() => handleDeletePatient(patient.id!)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-xs font-bold"
                  >
                    <Trash2 size={14} />
                    Excluir
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <PatientFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={editingPatient ? handleUpdatePatient : handleCreatePatient}
        initialData={editingPatient}
        title={editingPatient ? 'Editar Paciente' : 'Cadastrar Novo Paciente'}
      />

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setPatientToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Excluir Paciente"
        message="Tem certeza que deseja excluir este paciente? Esta ação não pode ser desfeita."
        confirmText="Excluir"
      />
    </motion.div>
  );
}
