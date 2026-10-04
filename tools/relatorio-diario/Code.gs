/**
 * Relatorio diario por e-mail (Apps Script). A regra de negocio esta em
 * Relatorio.js (colado no mesmo projeto como Relatorio.gs); aqui so ha rede,
 * envio e gatilho.
 *
 * Propriedades do Script (Configuracoes do projeto > Propriedades do script):
 *   SA_KEY  JSON da chave da conta de servico somente leitura (NUNCA fora daqui)
 *   CONFIG  { "backofficeUrl": "...", "destinatarios": [ { "email", "tipo": "TENANT"|"GLOBAL", "whitelabelId"? } ] }
 */

var PROJETO_FIRESTORE = 'clinic-dfu';
var FIRESTORE_BASE =
  'https://firestore.googleapis.com/v1/projects/' + PROJETO_FIRESTORE + '/databases/(default)/documents';
var CAMPOS_LEAD = ['status', 'prioritario', 'arquivado', 'responsavel', 'bebeNome', 'createdAt'];

// --- Autenticacao (conta de servico -> token OAuth) --------------------------

function base64Url_(valor) {
  return Utilities.base64EncodeWebSafe(valor).replace(/=+$/, '');
}

function gerarToken_() {
  var bruto = PropertiesService.getScriptProperties().getProperty('SA_KEY');
  if (!bruto) throw new Error('Propriedade SA_KEY nao configurada.');
  var chave = JSON.parse(bruto);
  var agora = Math.floor(Date.now() / 1000);
  var entrada =
    base64Url_(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' +
    base64Url_(JSON.stringify({
      iss: chave.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: agora,
      exp: agora + 3600,
    }));
  var assinatura = Utilities.computeRsaSha256Signature(entrada, chave.private_key);
  var resposta = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: entrada + '.' + base64Url_(assinatura),
    },
    muteHttpExceptions: true,
  });
  // Nao registrar o corpo da resposta nem a chave: so o codigo HTTP.
  if (resposta.getResponseCode() !== 200) {
    throw new Error('Falha ao obter token da conta de servico: HTTP ' + resposta.getResponseCode());
  }
  var token = JSON.parse(resposta.getContentText()).access_token;
  CacheService.getScriptCache().put('sa_token', token, 3000);
  return token;
}

function obterToken_() {
  return CacheService.getScriptCache().get('sa_token') || gerarToken_();
}

// --- Firestore REST -------------------------------------------------------------

/** Lista todos os documentos de uma colecao (paginado), ja decodificados. */
function listarColecao_(caminho, campos) {
  var token = obterToken_();
  var documentos = [];
  var pagina = '';
  do {
    var url = FIRESTORE_BASE + '/' + caminho + '?pageSize=300';
    campos.forEach(function (campo) { url += '&mask.fieldPaths=' + encodeURIComponent(campo); });
    if (pagina) url += '&pageToken=' + encodeURIComponent(pagina);
    var resposta = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true,
    });
    if (resposta.getResponseCode() !== 200) {
      throw new Error('Firestore ' + caminho + ': HTTP ' + resposta.getResponseCode());
    }
    var corpo = JSON.parse(resposta.getContentText());
    (corpo.documents || []).forEach(function (doc) { documentos.push(decodificarDocumento(doc)); });
    pagina = corpo.nextPageToken || '';
  } while (pagina);
  return documentos;
}

/** Le leads e depoimentos pendentes dos whitelabels necessarios para os destinatarios. */
function coletarDados_(destinatarios) {
  var global = destinatarios.some(function (d) { return d.tipo === 'GLOBAL'; });
  var mapaNomes = {};
  var ids = [];

  listarColecao_('whitelabels', ['name']).forEach(function (wl) { mapaNomes[wl.id] = wl.name; });
  if (global) {
    ids = Object.keys(mapaNomes);
  } else {
    destinatarios.forEach(function (d) {
      if (ids.indexOf(d.whitelabelId) === -1) ids.push(d.whitelabelId);
    });
  }

  return ids.map(function (id) {
    var leads = listarColecao_('whitelabels/' + id + '/leads', CAMPOS_LEAD);
    var pendentes = listarColecao_('whitelabels/' + id + '/depoimentosPendentes', ['status'])
      .filter(function (doc) { return doc.status === 'PENDENTE'; }).length;
    return { whitelabelId: id, nome: mapaNomes[id] || id, leads: leads, depoimentosPendentes: pendentes };
  });
}

// --- Envio -----------------------------------------------------------------------

function lerConfig_() {
  var bruto = PropertiesService.getScriptProperties().getProperty('CONFIG');
  if (!bruto) throw new Error('Propriedade CONFIG nao configurada.');
  var config = JSON.parse(bruto);
  if (!config.destinatarios || config.destinatarios.length === 0) {
    throw new Error('CONFIG sem destinatarios.');
  }
  return config;
}

/**
 * Funcao do gatilho diario. `opcoes.forcar = true` ignora a trava "ja enviei hoje"
 * (use em testes). O gatilho chama com um objeto de evento, que nao tem `forcar`.
 */
function enviarRelatorio(opcoes) {
  var forcar = Boolean(opcoes && opcoes.forcar === true);
  var config = lerConfig_();
  var propriedades = PropertiesService.getScriptProperties();
  var agora = new Date();
  var hoje = diaBrasilia(agora);

  var pendentes = config.destinatarios.filter(function (d) {
    return forcar || propriedades.getProperty('ultimoEnvio:' + d.email) !== hoje;
  });
  if (pendentes.length === 0) {
    Logger.log('Nada a enviar: todos ja receberam hoje (' + hoje + ').');
    return;
  }

  var dados = coletarDados_(pendentes);
  var erros = [];

  pendentes.forEach(function (destinatario) {
    try {
      // Um destinatario por vez: falha em um nao impede os outros.
      var email = montarEmails([destinatario], dados, { agora: agora, backofficeUrl: config.backofficeUrl })[0];
      MailApp.sendEmail({
        to: email.email,
        subject: email.assunto,
        htmlBody: email.html,
        body: email.texto,
        name: 'Relatório diário',
      });
      propriedades.setProperty('ultimoEnvio:' + destinatario.email, hoje);
      Logger.log('Enviado para ' + destinatario.email + ': ' + email.assunto);
    } catch (erro) {
      erros.push(destinatario.email + ': ' + erro.message);
    }
  });

  // Relanca no fim para o Google avisar a dona do script por e-mail.
  if (erros.length > 0) throw new Error('Falha ao enviar relatorio: ' + erros.join(' | '));
}

/** Atalho para rodar no editor: envia agora, ignorando a trava de "ja enviei hoje". */
function enviarAgoraForcando() {
  enviarRelatorio({ forcar: true });
}

/** Monta os e-mails e registra no log (assunto e tamanho), SEM enviar nada. */
function testarSemEnviar() {
  var config = lerConfig_();
  var dados = coletarDados_(config.destinatarios);
  var emails = montarEmails(config.destinatarios, dados, { agora: new Date(), backofficeUrl: config.backofficeUrl });
  emails.forEach(function (email) {
    Logger.log(email.email + ' | ' + email.assunto + ' | html ' + email.html.length + ' caracteres');
  });
  dados.forEach(function (item) {
    Logger.log('whitelabel ' + item.whitelabelId + ': ' + item.leads.length + ' leads, ' + item.depoimentosPendentes + ' depoimentos pendentes');
  });
}

/** Rode uma vez: cria o gatilho diario (~20:00) e remove duplicatas. */
function criarGatilhoDiario() {
  ScriptApp.getProjectTriggers().forEach(function (gatilho) {
    if (gatilho.getHandlerFunction() === 'enviarRelatorio') ScriptApp.deleteTrigger(gatilho);
  });
  ScriptApp.newTrigger('enviarRelatorio').timeBased().atHour(20).nearMinute(0).everyDays(1).create();
  Logger.log('Gatilho diario criado para ~20:00 (America/Sao_Paulo).');
}
