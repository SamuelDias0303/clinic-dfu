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
  | 'CAPTACAO'
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

export type LeadStatus = 'NOVO' | 'EM_CONTATO' | 'AGENDADO' | 'CONVERTIDO' | 'DESCARTADO';

export type LeadFaixaIdade = '0-1m' | '1-3m' | '3-6m' | '6-12m' | '12-24m' | 'outra';

export type LeadPeriodoContato = 'MANHA' | 'TARDE' | 'NOITE' | 'QUALQUER';

/**
 * Solicitacao vinda de um site publico (landing page do whitelabel).
 *
 * Nao e um `Appointment`: nao tem paciente, terapeuta, data nem hora. E o
 * contato bruto que a recepcao tria e depois converte em `Patient` pelo
 * `leadService.convertToPatient`.
 *
 * Este e o unico documento do sistema que aceita escrita anonima. Os limites de
 * campo e tamanho abaixo estao replicados em `firestore.rules` e no contrato
 * espelhado da landing page — alterar aqui exige alterar os tres.
 */
export interface Lead {
  id?: string;
  whitelabelId?: string;
  origem: string;
  responsavel: string;
  whatsapp: string;
  bebeNome?: string;
  bebeIdadeFaixa: LeadFaixaIdade;
  preocupacoes: string[];
  periodoContato?: LeadPeriodoContato;
  observacoes?: string;
  consentimento: true;
  consentimentoTexto: string;
  status: LeadStatus;
  notasInternas?: string;
  convertedPatientId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export const LEAD_LIMITS = {
  responsavel: 120,
  whatsapp: 25,
  bebeNome: 120,
  observacoes: 1000,
  consentimentoTexto: 500,
  origem: 60,
  preocupacoesMax: 10,
  preocupacaoTamanho: 120,
} as const;

export type TestimonialStatus = 'PENDENTE' | 'APROVADO' | 'REJEITADO';

export type TestimonialPapel = 'Mãe' | 'Pai' | 'Responsável';

export type TestimonialIdadeUnidade = 'meses' | 'anos';

/**
 * Depoimento enviado pela pagina publica `/depoimento` da landing page.
 *
 * Junto com `Lead`, e a segunda e ultima colecao do sistema que aceita escrita
 * anonima. Nasce sempre com `status: 'PENDENTE'` e so entra em
 * `SiteContent.depoimentos.itens` quando aprovado no backoffice — ver
 * `testimonialService.approve`. Os limites de campo abaixo estao replicados em
 * `firestore.rules` e no contrato espelhado da landing page
 * (`landing-page-raiza/src/lib/clinicContract.ts`) — alterar aqui exige
 * alterar os tres.
 */
export interface TestimonialPendente {
  id?: string;
  whitelabelId?: string;
  origem: string;
  nome: string;
  papel: TestimonialPapel;
  texto: string;
  whatsapp?: string;
  bebeNome?: string;
  bebeIdadeValor?: number;
  bebeIdadeUnidade?: TestimonialIdadeUnidade;
  status: TestimonialStatus;
  createdAt?: any;
  updatedAt?: any;
}

export const TESTIMONIAL_LIMITS = {
  nome: 120,
  papel: 60,
  texto: 1000,
  whatsapp: 25,
  bebeNome: 120,
  bebeIdadeValorMax: 200,
} as const;

export interface SiteImageRef {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Preenchido quando a imagem veio de upload no Firebase Storage. */
  storagePath?: string;
}

export type SiteImageSlot =
  | 'hero'
  | 'terapia'
  | 'assimetria'
  | 'torcicolo'
  | 'bebeSorrindo'
  | 'recemNascido'
  | 'raiza';

/**
 * Conteudo editavel da landing page do whitelabel.
 *
 * Convencao de destaque: trechos entre asteriscos viram destaque visual no
 * site. Ex.: "O cuidado exato para o *desenvolvimento perfeito* do seu bebe."
 */
export interface SiteContent {
  hero: {
    badge: string;
    titulo: string;
    subtitulo: string;
    ctaPrimario: string;
    ctaSecundario: string;
    seloTitulo: string;
    seloSubtitulo: string;
  };
  trustBar: { icone: string; titulo: string; detalhe: string }[];
  sintomas: {
    eyebrow: string;
    titulo: string;
    intro: string;
    itens: { titulo: string; texto: string; mensagem: string }[];
  };
  especialidades: {
    eyebrow: string;
    titulo: string;
    intro: string;
    cards: {
      titulo: string;
      texto: string;
      imagem?: SiteImageSlot;
      ctaTexto?: string;
      ctaMensagem?: string;
    }[];
  };
  metodo: {
    badge: string;
    titulo: string;
    intro: string;
    pilares: string[];
  };
  comoFunciona: {
    eyebrow: string;
    titulo: string;
    passos: { numero: string; titulo: string; texto: string }[];
    destaqueTitulo: string;
    destaqueTexto: string;
    destaqueCta: string;
  };
  sobre: {
    eyebrow: string;
    titulo: string;
    paragrafos: string[];
    seloLabel: string;
    seloValor: string;
    contadorValor: string;
    contadorTexto: string;
  };
  depoimentos: {
    eyebrow: string;
    titulo: string;
    itens: { texto: string; inicial: string; nome: string; papel: string }[];
  };
  faq: {
    eyebrow: string;
    titulo: string;
    itens: { pergunta: string; resposta: string }[];
  };
  ctaFinal: {
    titulo: string;
    texto: string;
    botao: string;
    rodape: string;
  };
  footer: {
    nome: string;
    subtitulo: string;
    crefito: string;
    copyright: string;
  };
  contato: {
    whatsapp: string;
    instagram: string;
  };
  seo: {
    titulo: string;
    descricao: string;
    ogTitulo: string;
    ogDescricao: string;
  };
  imagens: Record<SiteImageSlot, SiteImageRef>;
  atualizadoEm?: any;
  atualizadoPor?: string;
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
