import React, { useState, useEffect } from 'react';
import { Star, Loader2, Edit2, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { therapistService, Therapist } from '../services/therapistService';
import TherapistFormModal from '../components/TherapistFormModal';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../contexts/AuthContext';

export default function TherapistListView() {
  const { user } = useAuth();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [therapistToDelete, setTherapistToDelete] = useState<string | null>(null);
  const [editingTherapist, setEditingTherapist] = useState<Therapist | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = therapistService.subscribeToTherapists((data) => {
      setTherapists(data);
      setLoading(false);
    }, user?.activeWhitelabelId);

    return () => unsubscribe();
  }, [user?.activeWhitelabelId]);

  const handleUpdateTherapist = async (data: Omit<Therapist, 'id' | 'createdAt'>) => {
    if (editingTherapist?.id) {
      await therapistService.updateTherapist(editingTherapist.id, data, user?.activeWhitelabelId);
    }
  };

  const handleDeleteTherapist = async (id: string) => {
    setTherapistToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (therapistToDelete) {
      await therapistService.deleteTherapist(therapistToDelete, user?.activeWhitelabelId);
      setTherapistToDelete(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Terapeutas</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs lg:text-sm mt-1 font-medium">Gerencie a equipe clínica e suas disponibilidades.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : therapists.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center">
          <p className="text-slate-500 dark:text-slate-400">Nenhum terapeuta cadastrado ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {therapists.map((t) => (
            <div key={t.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-all group relative">
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => {
                    setEditingTherapist(t);
                    setIsModalOpen(true);
                  }}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  onClick={() => handleDeleteTherapist(t.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="flex justify-between items-start mb-4">
                <div className="size-12 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary font-bold text-lg uppercase">
                  {t.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                  t.status === 'Ativo' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                }`}>
                  {t.status.toUpperCase()}
                </span>
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">{t.name}</h3>
              <p className="text-sm text-primary font-medium">{t.specialty}</p>
              
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Unidades:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{t.units ? t.units.join(', ') : 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Avaliação:</span>
                  <div className="flex items-center gap-1 text-amber-500 font-bold">
                    <Star size={12} fill="currentColor" /> {t.rating || 'N/A'}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-50 dark:border-slate-800 flex gap-2">
                <button className="flex-1 text-xs font-bold py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Ver Agenda</button>
                <button className="flex-1 text-xs font-bold py-2 bg-primary/5 dark:bg-primary/10 text-primary rounded-lg hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors">Perfil</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TherapistFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleUpdateTherapist}
        initialData={editingTherapist}
        title="Editar Terapeuta"
      />

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setTherapistToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Excluir Terapeuta"
        message="Tem certeza que deseja excluir este terapeuta? Esta ação não pode ser desfeita."
        confirmText="Excluir"
      />
    </motion.div>
  );
}
