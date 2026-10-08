import type { Lead, LeadEndereco, Patient } from '../types';

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
