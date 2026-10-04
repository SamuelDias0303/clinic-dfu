/**
 * Logica pura do relatorio diario (sem rede, sem API do Apps Script).
 *
 * Roda igual no Apps Script (V8) e no Node (scripts/test-relatorio.ts). Por isso:
 * so `var` e funcoes declaradas, e o `module.exports` no fim e condicional.
 *
 * Formato do lead (ja decodificado): { id, status, prioritario, arquivado,
 * responsavel, bebeNome, createdAt (string ISO ou null) }.
 */

var STATUS_ORDEM = ['NOVO', 'LISTA_ESPERA', 'EM_CONTATO', 'AGENDADO', 'CONVERTIDO', 'DESCARTADO'];
var STATUS_ROTULO = {
  NOVO: 'Novo',
  LISTA_ESPERA: 'Lista de espera',
  EM_CONTATO: 'Em contato',
  AGENDADO: 'Agendado',
  CONVERTIDO: 'Convertido',
  DESCARTADO: 'Descartado',
};
/** Brasil nao tem horario de verao desde 2019: deslocamento fixo UTC-3. */
var OFFSET_BRASILIA_MIN = -180;
var MS_DIA = 24 * 60 * 60 * 1000;
var SEM_DATA = Number.MAX_SAFE_INTEGER;

// --- Firestore REST -> objeto simples --------------------------------------

function decodificarValor(valor) {
  if (valor === null || typeof valor !== 'object') return undefined;
  if ('stringValue' in valor) return valor.stringValue;
  if ('booleanValue' in valor) return valor.booleanValue;
  if ('integerValue' in valor) return Number(valor.integerValue);
  if ('doubleValue' in valor) return Number(valor.doubleValue);
  if ('timestampValue' in valor) return valor.timestampValue;
  if ('nullValue' in valor) return null;
  if ('arrayValue' in valor) return (valor.arrayValue.values || []).map(decodificarValor);
  if ('mapValue' in valor) return decodificarCampos(valor.mapValue.fields || {});
  return undefined;
}

function decodificarCampos(campos) {
  var objeto = {};
  Object.keys(campos).forEach(function (chave) {
    objeto[chave] = decodificarValor(campos[chave]);
  });
  return objeto;
}

function decodificarDocumento(doc) {
  var objeto = decodificarCampos(doc.fields || {});
  objeto.id = String(doc.name || '').split('/').pop();
  return objeto;
}

// --- Datas (Brasilia) ------------------------------------------------------

function diaBrasilia(data, offsetMin) {
  var deslocamento = offsetMin === undefined ? OFFSET_BRASILIA_MIN : offsetMin;
  return new Date(data.getTime() + deslocamento * 60000).toISOString().slice(0, 10);
}

/** Os `quantidade` dias-calendario de Brasilia que terminam em "hoje" (do mais antigo ao mais novo). */
function ultimosDias(agora, quantidade, offsetMin) {
  var dias = [];
  for (var i = quantidade - 1; i >= 0; i--) {
    dias.push(diaBrasilia(new Date(agora.getTime() - i * MS_DIA), offsetMin));
  }
  return dias;
}

function rotuloDia(dia) {
  return dia.slice(8, 10) + '/' + dia.slice(5, 7);
}

function dataEntrada(lead) {
  if (!lead.createdAt) return SEM_DATA;
  var tempo = Date.parse(lead.createdAt);
  return isNaN(tempo) ? SEM_DATA : tempo;
}

// --- Fila (mesma regra de src/lib/listaEspera.ts) --------------------------

function ordenarFila(leads) {
  return leads
    .filter(function (lead) { return !lead.arquivado && lead.status === 'LISTA_ESPERA'; })
    .sort(function (a, b) {
      if (Boolean(a.prioritario) !== Boolean(b.prioritario)) return a.prioritario ? -1 : 1;
      var diferenca = dataEntrada(a) - dataEntrada(b);
      if (diferenca !== 0) return diferenca;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
}

function primeiroNome(nome) {
  var primeiro = String(nome || '').trim().split(/\s+/)[0];
  return primeiro || '—';
}

// --- Agregacao --------------------------------------------------------------

function agregar(leads, depoimentosPendentes, agora, offsetMin) {
  var ativos = leads.filter(function (lead) { return !lead.arquivado; });

  var porStatus = {};
  STATUS_ORDEM.forEach(function (status) { porStatus[status] = 0; });
  var outros = 0;
  ativos.forEach(function (lead) {
    if (Object.prototype.hasOwnProperty.call(porStatus, lead.status)) porStatus[lead.status]++;
    else outros++;
  });

  var agoraMs = agora.getTime();
  var novas24h = ativos.filter(function (lead) {
    var tempo = dataEntrada(lead);
    return tempo !== SEM_DATA && tempo > agoraMs - MS_DIA && tempo <= agoraMs;
  }).length;

  var dias = ultimosDias(agora, 7, offsetMin).map(function (dia) {
    var qtd = ativos.filter(function (lead) {
      var tempo = dataEntrada(lead);
      return tempo !== SEM_DATA && diaBrasilia(new Date(tempo), offsetMin) === dia;
    }).length;
    return { dia: dia, rotulo: rotuloDia(dia), qtd: qtd };
  });

  var fila = ordenarFila(leads);
  var datas = fila.map(dataEntrada).filter(function (tempo) { return tempo !== SEM_DATA; });
  var maisAntigaDias = datas.length
    ? Math.max(0, Math.floor((agoraMs - Math.min.apply(null, datas)) / MS_DIA))
    : null;

  var top5 = fila.slice(0, 5).map(function (lead, indice) {
    var tempo = dataEntrada(lead);
    return {
      posicao: indice + 1,
      primeiroNome: primeiroNome(lead.responsavel),
      bebe: lead.bebeNome ? String(lead.bebeNome).trim() : '',
      esperaDias: tempo === SEM_DATA ? null : Math.max(0, Math.floor((agoraMs - tempo) / MS_DIA)),
      prioritario: Boolean(lead.prioritario),
    };
  });

  return {
    total: ativos.length,
    porStatus: porStatus,
    outros: outros,
    novas24h: novas24h,
    dias: dias,
    fila: {
      tamanho: fila.length,
      prioritarios: fila.filter(function (lead) { return lead.prioritario; }).length,
      maisAntigaDias: maisAntigaDias,
      top5: top5,
    },
    arquivadas: leads.length - ativos.length,
    depoimentosPendentes: depoimentosPendentes || 0,
  };
}

/** Consolida varios resumos (visao global). Nao carrega nomes: `fila.top5` fica vazio. */
function somar(resumos) {
  var soma = {
    total: 0,
    porStatus: {},
    outros: 0,
    novas24h: 0,
    dias: [],
    fila: { tamanho: 0, prioritarios: 0, maisAntigaDias: null, top5: [] },
    arquivadas: 0,
    depoimentosPendentes: 0,
  };
  STATUS_ORDEM.forEach(function (status) { soma.porStatus[status] = 0; });

  resumos.forEach(function (resumo) {
    soma.total += resumo.total;
    STATUS_ORDEM.forEach(function (status) { soma.porStatus[status] += resumo.porStatus[status]; });
    soma.outros += resumo.outros;
    soma.novas24h += resumo.novas24h;
    resumo.dias.forEach(function (dia, indice) {
      if (!soma.dias[indice]) soma.dias[indice] = { dia: dia.dia, rotulo: dia.rotulo, qtd: 0 };
      soma.dias[indice].qtd += dia.qtd;
    });
    soma.fila.tamanho += resumo.fila.tamanho;
    soma.fila.prioritarios += resumo.fila.prioritarios;
    var antiga = resumo.fila.maisAntigaDias;
    if (antiga !== null && (soma.fila.maisAntigaDias === null || antiga > soma.fila.maisAntigaDias)) {
      soma.fila.maisAntigaDias = antiga;
    }
    soma.arquivadas += resumo.arquivadas;
    soma.depoimentosPendentes += resumo.depoimentosPendentes;
  });
  return soma;
}

if (typeof module !== 'undefined') {
  module.exports = {
    STATUS_ORDEM: STATUS_ORDEM,
    STATUS_ROTULO: STATUS_ROTULO,
    OFFSET_BRASILIA_MIN: OFFSET_BRASILIA_MIN,
    decodificarDocumento: decodificarDocumento,
    diaBrasilia: diaBrasilia,
    ultimosDias: ultimosDias,
    rotuloDia: rotuloDia,
    ordenarFila: ordenarFila,
    primeiroNome: primeiroNome,
    agregar: agregar,
    somar: somar,
  };
}
