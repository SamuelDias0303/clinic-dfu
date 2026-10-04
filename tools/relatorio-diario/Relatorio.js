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
      // So o primeiro nome: o bebe costuma vir com o sobrenome da familia.
      bebe: lead.bebeNome && String(lead.bebeNome).trim() ? primeiroNome(lead.bebeNome) : '',
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

// --- Renderizacao ------------------------------------------------------------

var COR = {
  texto: '#2C3135',
  suave: '#6B7378',
  verde: '#5F7A6D',
  terracota: '#B4533A',
  fundo: '#F7F3EE',
  borda: '#E5DED3',
};

function esc(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cartao(rotulo, valor, destaque) {
  var cor = destaque ? COR.terracota : COR.verde;
  return (
    '<td width="33%" style="padding:4px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ' + COR.borda + ';border-radius:10px">' +
    '<tr><td align="center" style="padding:12px 4px">' +
    '<div style="font-size:26px;font-weight:bold;color:' + cor + ';line-height:1.1">' + esc(valor) + '</div>' +
    '<div style="font-size:11px;color:' + COR.suave + ';text-transform:uppercase;letter-spacing:0.5px;margin-top:4px">' + esc(rotulo) + '</div>' +
    '</td></tr></table></td>'
  );
}

function blocoStatus(resumo) {
  var celulas = STATUS_ORDEM.map(function (status) {
    return cartao(STATUS_ROTULO[status], resumo.porStatus[status], status === 'LISTA_ESPERA');
  });
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    '<tr>' + celulas.slice(0, 3).join('') + '</tr>' +
    '<tr>' + celulas.slice(3, 6).join('') + '</tr>' +
    '</table>'
  );
}

function blocoBarras(dias) {
  var maximo = 0;
  dias.forEach(function (dia) { if (dia.qtd > maximo) maximo = dia.qtd; });
  var linhas = dias.map(function (dia) {
    var largura = maximo === 0 ? 0 : Math.max(4, Math.round((dia.qtd / maximo) * 100));
    var barra = dia.qtd === 0
      ? ''
      : '<table role="presentation" width="' + largura + '%" cellpadding="0" cellspacing="0"><tr>' +
        '<td height="14" bgcolor="' + COR.verde + '" style="background:' + COR.verde + ';border-radius:4px;font-size:0;line-height:0">&nbsp;</td>' +
        '</tr></table>';
    return (
      '<tr>' +
      '<td width="46" style="font-size:12px;color:' + COR.suave + ';padding:3px 0">' + esc(dia.rotulo) + '</td>' +
      '<td style="padding:3px 6px">' + barra + '</td>' +
      '<td width="28" align="right" style="font-size:12px;font-weight:bold;color:' + COR.texto + '">' + dia.qtd + '</td>' +
      '</tr>'
    );
  });
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + linhas.join('') + '</table>';
}

function textoAntiguidade(fila) {
  return fila.maisAntigaDias === null ? '' : ' · mais antigo há ' + fila.maisAntigaDias + ' dia(s)';
}

function blocoFila(fila) {
  if (fila.tamanho === 0) {
    return '<p style="font-size:14px;color:' + COR.suave + ';margin:0">Ninguém na lista de espera.</p>';
  }
  var resumo =
    '<p style="font-size:14px;color:' + COR.texto + ';margin:0 0 8px">' +
    fila.tamanho + ' na fila · ' + fila.prioritarios + ' prioritário(s)' + textoAntiguidade(fila) + '</p>';
  if (fila.top5.length === 0) return resumo;
  var linhas = fila.top5.map(function (pessoa) {
    var bebe = pessoa.bebe
      ? ' <span style="color:' + COR.suave + '">(bebê ' + esc(pessoa.bebe) + ')</span>'
      : '';
    var espera = pessoa.esperaDias === null ? '—' : pessoa.esperaDias + ' d';
    return (
      '<tr>' +
      '<td width="28" style="font-size:13px;font-weight:bold;color:' + COR.verde + ';padding:4px 0">' + pessoa.posicao + '</td>' +
      '<td style="font-size:13px;color:' + COR.texto + ';padding:4px 0">' +
      (pessoa.prioritario ? '<span style="color:#E0A100">★</span> ' : '') + esc(pessoa.primeiroNome) + bebe + '</td>' +
      '<td width="50" align="right" style="font-size:12px;color:' + COR.suave + ';padding:4px 0">' + espera + '</td>' +
      '</tr>'
    );
  });
  return resumo + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + linhas.join('') + '</table>';
}

function subtitulo(texto) {
  return '<div style="font-size:12px;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;color:' + COR.suave + ';margin:18px 0 8px">' + esc(texto) + '</div>';
}

function blocoSecao(titulo, resumo) {
  var rodape =
    'Depoimentos aguardando moderação: ' + resumo.depoimentosPendentes +
    ' · Arquivadas: ' + resumo.arquivadas + ' (fora das contagens)' +
    (resumo.outros > 0 ? ' · Outros status: ' + resumo.outros : '');
  return (
    '<div style="margin-top:22px">' +
    '<div style="font-size:17px;font-weight:bold;color:' + COR.texto + ';border-bottom:2px solid ' + COR.verde + ';padding-bottom:6px">' + esc(titulo) + '</div>' +
    '<p style="font-size:14px;color:' + COR.texto + ';margin:10px 0">' +
    '<b>' + resumo.total + '</b> solicitações ativas · <b>' + resumo.novas24h + '</b> nas últimas 24 h</p>' +
    blocoStatus(resumo) +
    subtitulo('Últimos 7 dias') +
    blocoBarras(resumo.dias) +
    subtitulo('Lista de espera') +
    blocoFila(resumo.fila) +
    '<p style="font-size:12px;color:' + COR.suave + ';margin:14px 0 0">' + esc(rodape) + '</p>' +
    '</div>'
  );
}

function renderHtml(ctx) {
  var corpo = '';
  if (ctx.consolidado) corpo += blocoSecao('Total consolidado', ctx.consolidado);
  ctx.secoes.forEach(function (secao) { corpo += blocoSecao(secao.nome, secao.resumo); });
  return (
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:' + COR.fundo + ';font-family:Arial,Helvetica,sans-serif;color:' + COR.texto + '">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + COR.fundo + '"><tr><td align="center" style="padding:16px 8px">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px"><tr><td style="padding:20px">' +
    '<div style="font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:' + COR.verde + '">Relatório diário</div>' +
    '<div style="font-size:22px;font-weight:bold;margin:4px 0 0">' + esc(ctx.dataRotulo) + '</div>' +
    corpo +
    '<a href="' + esc(ctx.backofficeUrl) + '" style="display:inline-block;margin-top:24px;background:' + COR.terracota + ';color:#ffffff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:14px">Abrir backoffice</a>' +
    '</td></tr></table></td></tr></table></body></html>'
  );
}

function textoSecao(titulo, resumo) {
  var linhas = [
    '== ' + titulo + ' ==',
    'Ativas: ' + resumo.total + ' | Novas nas últimas 24 h: ' + resumo.novas24h,
    STATUS_ORDEM.map(function (status) { return STATUS_ROTULO[status] + ': ' + resumo.porStatus[status]; }).join(' | '),
    'Últimos 7 dias: ' + resumo.dias.map(function (dia) { return dia.rotulo + '=' + dia.qtd; }).join(' '),
  ];
  if (resumo.fila.tamanho === 0) {
    linhas.push('Ninguém na lista de espera.');
  } else {
    linhas.push('Lista de espera: ' + resumo.fila.tamanho + ' (' + resumo.fila.prioritarios + ' prioritário(s))' + textoAntiguidade(resumo.fila));
    resumo.fila.top5.forEach(function (pessoa) {
      linhas.push(
        pessoa.posicao + '. ' + (pessoa.prioritario ? '★ ' : '') + pessoa.primeiroNome +
        (pessoa.bebe ? ' (bebê ' + pessoa.bebe + ')' : '') +
        ' — ' + (pessoa.esperaDias === null ? '—' : pessoa.esperaDias + ' d')
      );
    });
  }
  linhas.push(
    'Depoimentos aguardando moderação: ' + resumo.depoimentosPendentes +
    ' | Arquivadas: ' + resumo.arquivadas + ' (fora das contagens)' +
    (resumo.outros > 0 ? ' | Outros status: ' + resumo.outros : '')
  );
  return linhas.join('\n');
}

function renderTexto(ctx) {
  var partes = ['Relatório diário — ' + ctx.dataRotulo];
  if (ctx.consolidado) partes.push(textoSecao('Total consolidado', ctx.consolidado));
  ctx.secoes.forEach(function (secao) { partes.push(textoSecao(secao.nome, secao.resumo)); });
  partes.push('Backoffice: ' + ctx.backofficeUrl);
  return partes.join('\n\n');
}

// --- Montagem por destinatario (isolamento) ---------------------------------

/**
 * `TENANT` recebe somente o whitelabel dele; `GLOBAL` recebe todos (e o total
 * consolidado quando ha mais de um). Os dados dos outros whitelabels podem
 * estar em `dados`, mas nunca entram no e-mail de um `TENANT`.
 */
function montarEmails(destinatarios, dados, contexto) {
  var agora = contexto.agora;
  var offsetMin = contexto.offsetMin;
  var dia = diaBrasilia(agora, offsetMin);
  var dataRotulo = dia.slice(8, 10) + '/' + dia.slice(5, 7) + '/' + dia.slice(0, 4);

  return destinatarios.map(function (destinatario) {
    var escolhidos;
    if (destinatario.tipo === 'GLOBAL') {
      escolhidos = dados;
    } else if (destinatario.tipo === 'TENANT') {
      escolhidos = dados.filter(function (item) { return item.whitelabelId === destinatario.whitelabelId; });
      if (escolhidos.length === 0) {
        throw new Error('Whitelabel nao encontrado para ' + destinatario.email + ': ' + destinatario.whitelabelId);
      }
    } else {
      throw new Error('Tipo de destinatario invalido para ' + destinatario.email + ': ' + destinatario.tipo);
    }

    var secoes = escolhidos.map(function (item) {
      return {
        nome: item.nome || item.whitelabelId,
        resumo: agregar(item.leads || [], item.depoimentosPendentes, agora, offsetMin),
      };
    });
    var resumos = secoes.map(function (secao) { return secao.resumo; });
    var consolidado = destinatario.tipo === 'GLOBAL' && secoes.length > 1 ? somar(resumos) : null;
    var tamanhoFila = resumos.reduce(function (acumulado, resumo) { return acumulado + resumo.fila.tamanho; }, 0);

    var ctx = {
      dataRotulo: dataRotulo,
      backofficeUrl: contexto.backofficeUrl,
      consolidado: consolidado,
      secoes: secoes,
    };
    return {
      email: destinatario.email,
      assunto: 'Relatório diário — ' + dataRotulo.slice(0, 5) + ' — Lista de espera: ' + tamanhoFila,
      html: renderHtml(ctx),
      texto: renderTexto(ctx),
    };
  });
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
    esc: esc,
    renderHtml: renderHtml,
    renderTexto: renderTexto,
    montarEmails: montarEmails,
  };
}
