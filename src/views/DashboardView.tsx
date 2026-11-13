import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  FileText,
  BarChart3,
  Plus
} from 'lucide-react';
import StatCard from '../components/StatCard';
import MyDayCard from '../components/MyDayCard';
import { needsEvolution } from '../lib/clinicalHelpers';
import QuickStats from '../components/QuickStats';
import AppointmentFormModal from '../components/AppointmentFormModal';
import PackagesOverviewCard from '../components/PackagesOverviewCard';
import { motion } from 'motion/react';
import { patientService } from '../services/patientService';
import { appointmentService } from '../services/appointmentService';
import { packageService } from '../services/packageService';
import { Patient, Appointment, Package } from '../types';
import { useAuth } from '../contexts/AuthContext';

const DAILY_APPOINTMENT_CAPACITY = 14;

interface DashboardViewProps {
  onOpenProntuario: (patient: Patient) => void;
  onOpenAgenda: (patient: Patient) => void;
  onOpenEvolution: (patient: Patient, appointment: Appointment) => void;
  onViewAgenda: () => void;
}

export default function DashboardView({ onOpenProntuario, onOpenAgenda, onOpenEvolution, onViewAgenda }: DashboardViewProps) {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const filterId = user?.activeRole === 'TERAPEUTA' ? user.email : undefined;
    const whitelabelId = user?.activeWhitelabelId;

    const unsubscribePatients = patientService.subscribeToPatients((data) => {
      setPatients(data);
    }, filterId, whitelabelId);

    const unsubscribeAppointments = appointmentService.subscribeToAppointments((data) => {
      setAppointments(data);
      setLoading(false);
    }, filterId, whitelabelId);

    const unsubscribePackages = packageService.subscribeToPackages(setPackages, whitelabelId);

    return () => {
      unsubscribePatients();
      unsubscribeAppointments();
      unsubscribePackages();
    };
  }, [user]);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const todayAppointments = appointments.filter(app => app.date === todayStr);
  const activePatients = patients.filter(patient => patient.status === 'Ativo').length;
  const pendingAll = appointments.filter(needsEvolution);
  const pendingReports = pendingAll.length;
  // Hoje as pendências já aparecem na lista do dia; aqui entram só dias anteriores, mais recentes primeiro.
  const pendingBefore = pendingAll
    .filter(app => app.date !== todayStr)
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  const canRecordEvolution = user?.activeRole === 'ADMIN_GLOBAL' || user?.activeRole === 'GESTOR' || user?.activeRole === 'TERAPEUTA';

  const findPatient = (appointment: Appointment) => patients.find(patient => patient.id === appointment.patientId);

  const handleComplete = async (appointment: Appointment) => {
    if (!appointment.id) return;
    setBusyId(appointment.id);
    try {
      await appointmentService.updateAppointment(appointment.id, { status: 'CONCLUÍDO' }, user?.activeWhitelabelId);
    } catch (error) {
      console.error('Error completing appointment:', error);
      alert('Erro ao concluir a sessão.');
    } finally {
      setBusyId(null);
    }
  };
  const freeSlotsToday = Math.max(0, DAILY_APPOINTMENT_CAPACITY - todayAppointments.length);
  const utilizationToday = Math.min(100, Math.round((todayAppointments.length / DAILY_APPOINTMENT_CAPACITY) * 100));

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const handleCreateAppointment = async (data: any) => {
    await appointmentService.createAppointment(data, user?.activeWhitelabelId);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
      >
        <div className="min-w-0">
          <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Painel</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs lg:text-sm mt-1 font-medium capitalize">Visão geral para {formatDate(today)}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 rounded-lg bg-primary text-white text-xs lg:text-sm font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95"
          >
            <Plus size={18} />
            Novo Agendamento
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        <StatCard
          label="Total de Pacientes"
          value={loading ? '...' : patients.length.toString()}
          subtext={loading ? undefined : `${activePatients} ativos`}
          icon={Users}
        />
        <StatCard
          label="Agenda de Hoje"
          value={loading ? '...' : todayAppointments.length.toString()}
          subtext={loading ? undefined : `${freeSlotsToday} horários livres`}
          icon={Calendar}
        />
        <StatCard
          label="Relatórios Pendentes"
          value={loading ? '...' : pendingReports.toString()}
          subtext={pendingReports > 0 ? 'Requer evolução' : 'Tudo em dia'}
          trendType={pendingReports > 0 ? 'negative' : 'neutral'}
          icon={FileText}
        />
        <StatCard
          label="Utilização da Clínica"
          value={loading ? '...' : `${utilizationToday}%`}
          subtext={`${todayAppointments.length}/${DAILY_APPOINTMENT_CAPACITY} horários`}
          icon={BarChart3}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 min-w-0">
          <MyDayCard
            todayAppointments={todayAppointments}
            pendingEvolutions={pendingBefore.slice(0, 8)}
            pendingTotal={pendingBefore.length}
            showTherapist={user?.activeRole !== 'TERAPEUTA'}
            canRecordEvolution={canRecordEvolution}
            busyId={busyId}
            onComplete={handleComplete}
            onOpenProntuario={(appointment) => {
              const patient = findPatient(appointment);
              if (patient) onOpenProntuario(patient);
            }}
            onEvolve={(appointment) => {
              const patient = findPatient(appointment);
              if (patient) onOpenEvolution(patient, appointment);
            }}
            onViewAgenda={onViewAgenda}
          />
        </div>
        <div className="min-w-0">
          <QuickStats
            patientsCount={patients.length}
            appointmentsCount={appointments.length}
            weeklyCapacity={DAILY_APPOINTMENT_CAPACITY * 6}
          />
        </div>
      </div>

      <PackagesOverviewCard
        packages={packages}
        patients={patients}
        appointments={appointments}
        canFilterByTherapist={user?.activeRole !== 'TERAPEUTA'}
        onOpenProntuario={(patientId) => {
          const patient = patients.find((item) => item.id === patientId);
          if (patient) onOpenProntuario(patient);
        }}
        onOpenAgenda={(patientId) => {
          const patient = patients.find((item) => item.id === patientId);
          if (patient) onOpenAgenda(patient);
        }}
      />

      <AppointmentFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateAppointment}
        title="Novo Agendamento"
      />
    </div>
  );
}
