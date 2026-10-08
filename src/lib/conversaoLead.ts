import type { Anamnese, Lead, LeadEndereco, Patient } from '../types';

/**
 * Regras da conversao de solicitacao (lead) em paciente. Modulo puro (sem
 * Firebase) para ser testavel em scripts/test-conversao-lead.ts.
 */

/** Endereco e opcional campo a campo — monta so com o que veio preenchido. */
export function formatarEndereco(endereco?: LeadEndereco): string {
  if (!endereco) return '';
  const ruaNumero = [endereco.logradouro, endereco.numero].filter(Boolean).join(', ');
  const partes = [
    ruaNumero + (endereco.complemento ? ` - ${endereco.complemento}` : ''),
    endereco.bairro,
    [endereco.cidade, endereco.estado].filter(Boolean).join('/'),
    endereco.cep ? `CEP ${endereco.cep}` : '',
  ].filter(Boolean);
  return partes.join(' · ');
}

function normalizarNome(nome: string | undefined): string {
  return String(nome ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Texto do campo "Antecedentes Pessoais" da anamnese, com o que o responsavel
 * informou no site: o que preocupa e o relato de gestacao e parto. Vazio quando
 * nao ha nenhum dos dois (nao cria anamnese a toa).
 */
export function montarAntecedentesPessoais(lead: Lead): string {
  const preocupacoes = (lead.preocupacoes ?? []).map((item) => {
    // "Outro motivo" vira o texto que a pessoa escreveu.
    if (item === 'Outro motivo' && lead.outroMotivo?.trim()) return `Outro motivo: ${lead.outroMotivo.trim()}`;
    return item;
  });
  const relato = String(lead.observacoes ?? '').trim();

  const linhas: string[] = [];
  if (preocupacoes.length > 0) linhas.push(`Preocupações informadas no site: ${preocupacoes.join('; ')}`);
  if (relato) linhas.push(`Gestação e parto (relato do responsável): ${relato}`);
  return linhas.join('\n');
}

/**
 * Rascunho de paciente a partir de um lead.
 *
 * Copia o que o formulario coletou: o responsavel vira o nome da mae (editavel
 * na tela: se foi o pai, a recepcao troca), o endereco vira uma linha e o
 * telefone vem do WhatsApp. NAO presume o que nao foi coletado: nada de CPF,
 * nascimento, nome do pai nem de adivinhar se o responsavel e mae ou pai por
 * outro caminho — paciente e dado clinico.
 */
export function montarRascunhoPaciente(lead: Lead): Omit<Patient, 'id' | 'createdAt'> {
  const responsavel = normalizarNome(lead.responsavel);
  return {
    name: lead.bebeNome?.trim() || `Bebe de ${responsavel}`,
    cpf: '',
    birthDate: '',
    motherName: responsavel,
    phone: lead.whatsapp,
    email: '',
    healthPlan: '',
    address: formatarEndereco(lead.endereco),
    status: 'Ativo',
  };
}

// --- Completar pacientes ja convertidos -------------------------------------

export interface AjusteConversao {
  leadId: string;
  patientId: string;
  pacienteNome: string;
  responsavel: string;
  /** So presente quando o campo do paciente esta vazio. */
  motherName?: string;
  address?: string;
  antecedentes?: {
    /** CRIAR: o paciente nao tem anamnese. PREENCHER: tem, mas o campo esta vazio. */
    acao: 'CRIAR' | 'PREENCHER';
    texto: string;
    anamneseId?: string;
  };
  avisos: string[];
}

export interface IgnoradoConversao {
  leadId: string;
  responsavel: string;
  motivo: 'PACIENTE_AUSENTE' | 'NADA_A_COMPLETAR';
}

const AVISO_ANTECEDENTES_PREENCHIDOS = 'Antecedentes pessoais já preenchidos: mantidos como estão.';

/**
 * Para cada solicitacao ja convertida, calcula o que falta copiar para o paciente:
 * nome da mae, endereco e antecedentes pessoais da anamnese.
 *
 * Regra de ouro: so preenche o que esta VAZIO; nunca sobrescreve. Quando dois leads
 * apontam para o mesmo paciente, cada campo e preenchido uma vez so (o primeiro lead
 * vence). Rodar de novo, depois de aplicar, nao encontra mais nada (idempotente).
 */
export function calcularAjustes(
  leads: Lead[],
  pacientes: Patient[],
  anamneses: Anamnese[]
): { ajustes: AjusteConversao[]; ignorados: IgnoradoConversao[] } {
  const porId = new Map<string, Patient>();
  pacientes.forEach((p) => { if (p.id) porId.set(p.id, p); });
  const anamnesePorPaciente = new Map<string, Anamnese>();
  anamneses.forEach((a) => { if (!anamnesePorPaciente.has(a.patientId)) anamnesePorPaciente.set(a.patientId, a); });

  // Campos que ja serao preenchidos por um lead anterior, por paciente.
  const reservado = new Map<string, { mae: boolean; endereco: boolean; antecedentes: boolean }>();

  const ajustes: AjusteConversao[] = [];
  const ignorados: IgnoradoConversao[] = [];

  leads.forEach((lead) => {
    if (lead.status !== 'CONVERTIDO' || !lead.convertedPatientId || !lead.id) return;

    const responsavel = normalizarNome(lead.responsavel);
    const paciente = porId.get(lead.convertedPatientId);
    if (!paciente) {
      ignorados.push({ leadId: lead.id, responsavel, motivo: 'PACIENTE_AUSENTE' });
      return;
    }

    const usado = reservado.get(paciente.id!) ?? { mae: false, endereco: false, antecedentes: false };
    reservado.set(paciente.id!, usado);

    const ajuste: AjusteConversao = {
      leadId: lead.id,
      patientId: paciente.id!,
      pacienteNome: paciente.name,
      responsavel,
      avisos: [],
    };

    if (!usado.mae && !paciente.motherName?.trim() && responsavel) {
      ajuste.motherName = responsavel;
      usado.mae = true;
    }

    const endereco = formatarEndereco(lead.endereco);
    if (!usado.endereco && !paciente.address?.trim() && endereco) {
      ajuste.address = endereco;
      usado.endereco = true;
    }

    const texto = montarAntecedentesPessoais(lead);
    if (texto) {
      const existente = anamnesePorPaciente.get(paciente.id!);
      if (existente?.personalHistory?.trim()) {
        ajuste.avisos.push(AVISO_ANTECEDENTES_PREENCHIDOS);
      } else if (!usado.antecedentes) {
        ajuste.antecedentes = existente
          ? { acao: 'PREENCHER', texto, anamneseId: existente.id }
          : { acao: 'CRIAR', texto };
        usado.antecedentes = true;
      }
    }

    const algoParaFazer = ajuste.motherName !== undefined || ajuste.address !== undefined || ajuste.antecedentes !== undefined;
    if (algoParaFazer) ajustes.push(ajuste);
    else ignorados.push({ leadId: lead.id, responsavel, motivo: 'NADA_A_COMPLETAR' });
  });

  return { ajustes, ignorados };
}
