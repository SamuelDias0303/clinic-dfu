export type UserRole = 'ADMIN_GLOBAL' | 'GESTOR' | 'REPCAO' | 'TERAPEUTA';

export type WhitelabelStatus = 'ATIVO' | 'SUSPENSO' | 'ARQUIVADO';

export type MembershipStatus = 'ATIVO' | 'INATIVO' | 'PENDENTE';

export interface WhitelabelBranding {
  primaryColor: string;
  logoUrl?: string;
  faviconUrl?: string;
}

export interface WhitelabelSettings {
  appointmentTypes?: string[];
  defaultUnitName?: string;
  therapistSpecialties?: string[];
  enabledFeatures?: string[];
}

export interface Whitelabel {
  id?: string;
  name: string;
  slug: string;
  domain?: string;
  status: WhitelabelStatus;
  plan: string;
  workspaceType?: 'INDIVIDUAL' | 'CLINICA';
  ownerUserId?: string;
  contactEmail?: string;
  contactPhone?: string;
  branding: WhitelabelBranding;
  settings?: WhitelabelSettings;
  createdAt?: any;
  updatedAt?: any;
}

export interface WhitelabelMembership {
  id?: string;
  whitelabelId: string;
  whitelabelName?: string;
  userId: string;
  email: string;
  name: string;
  roles: UserRole[];
  status: MembershipStatus;
  invitationToken?: string;
  inviteUrl?: string;
  therapistId?: string;
  therapistSpecialty?: string;
  patientIds?: string[];
  createdAt?: any;
  updatedAt?: any;
}

export type UserInviteStatus = 'PENDENTE' | 'ACEITO' | 'EXPIRADO' | 'CANCELADO';

export interface UserInvite {
  id?: string;
  token: string;
  whitelabelId: string;
  whitelabelName: string;
  email: string;
  name: string;
  roles: UserRole[];
  status: UserInviteStatus;
  therapistId?: string;
  therapistSpecialty?: string;
  invitedBy?: string;
  acceptedBy?: string;
  acceptedAt?: any;
  createdAt?: any;
  updatedAt?: any;
  expiresAt?: any;
}

export type View = 
  | 'LOGIN' 
  | 'PASSWORD_RECOVERY'
  | 'PROFILE_SELECTION' 
  | 'WHITELABEL_SELECTION'
  | 'DASHBOARD' 
  | 'AGENDA' 
  | 'PACIENTES' 
  | 'TERAPEUTAS' 
  | 'BACKOFFICE' 
  | 'PRONTUARIO'
  | 'AI_RESOURCES'
  | 'CONFIGURACOES';

export interface User {
  id?: string;
  name: string;
  email: string;
  roles: UserRole[];
  activeRole: UserRole | null;
  whitelabelMemberships?: WhitelabelMembership[];
  activeWhitelabelId?: string | null;
}

export interface TenantUser extends User {
  whitelabelMemberships: WhitelabelMembership[];
  activeWhitelabelId: string | null;
}

export interface Patient {
  id?: string;
  whitelabelId?: string;
  name: string;
  cpf: string;
  birthDate: string;
  fatherName?: string;
  motherName?: string;
  phone: string;
  email: string;
  healthPlan: string;
  address: string;
  homeLocationUrl?: string;
  status: 'Ativo' | 'Inativo';
  therapistId?: string;
  therapistName?: string;
  createdAt?: any;
}

export interface Evolution {
  id?: string;
  whitelabelId?: string;
  patientId: string;
  therapistId: string;
  therapistName: string;
  date: string;
  time: string;
  type: string;
  content: string;
  status: 'DRAFT' | 'FINALIZED';
  createdAt?: any;
}

export interface Anamnese {
  id?: string;
  whitelabelId?: string;
  patientId: string;
  diagnosis?: string;
  mainComplaint: string;
  hda: string;
  personalHistory: string;
  familyHistory: string;
  updatedAt?: any;
}

export interface Appointment {
  id?: string;
  whitelabelId?: string;
  patientId: string;
  patientName: string;
  therapistId: string;
  therapistName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type: string;
  status: 'AGUARDANDO' | 'EM ANDAMENTO' | 'CONCLUÍDO' | 'CANCELADO';
  notes?: string;
  clinicalEvolution?: string;
  evolutionId?: string;
  recurrence?: 'NONE' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  recurrenceDays?: number[]; // 0-6 (Sunday-Saturday)
  recurrenceId?: string;
  createdAt?: any;
}
