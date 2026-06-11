/* ============================================================
   Secretária | Lógica do app
   ============================================================ */

/* ------------------------------------------------------------
   CONFIGURAÇÃO OBRIGATÓRIA
   Crie um OAuth Client ID (tipo "Aplicativo da Web") no Google
   Cloud Console e cole o ID abaixo. Sem ele, só o modo
   demonstração funciona. Passo a passo no README.md.
   ------------------------------------------------------------ */
var GOOGLE_CLIENT_ID = '553484806905-m1jbte73t7qqvh7j2hjv1oct6fhuq41e.apps.googleusercontent.com';

var ESCOPO = 'https://www.googleapis.com/auth/calendar.events';
var FUSO = 'America/Sao_Paulo';

(function () {
  'use strict';

  /* ---------- Estado ---------- */
  var estado = {
    demo: false,
    token: null,
    tokenExpira: 0,
    email: null,
    evento: null,          // resultado do parser, editável
    tokenClient: null,
    acaoPosLogin: null
  };

  /* ---------- Atalhos ---------- */
  function $(id) { return document.getElementById(id); }

  var telas = ['tela-principal', 'tela-revisao', 'tela-sucesso', 'tela-contatos'];

  function mostrarTela(id) {
    telas.forEach(function (t) {
      $(t).classList.toggle('ativa', t === id);
    });
    window.scrollTo(0, 0);
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('visivel'); }, 3200);
  }

  /* ---------- Agendinha de contatos (localStorage) ---------- */
  var CHAVE_CONTATOS = 'secretaria.contatos.v1';

  function lerContatos() {
    try { return JSON.parse(localStorage.getItem(CHAVE_CONTATOS)) || {}; }
    catch (e) { return {}; }
  }

  function salvarContatos(c) {
    localStorage.setItem(CHAVE_CONTATOS, JSON.stringify(c));
  }

  function emailDoNome(nome) {
    var c = lerContatos();
    return c[nome.trim().toLowerCase()] || '';
  }

  function gravarContato(nome, email) {
    nome = nome.trim();
    email = email.trim().toLowerCase();
    if (!nome || !email) return;
    var c = lerContatos();
    c[nome.toLowerCase()] = email;
    salvarContatos(c);
  }

  function apagarContato(nomeChave) {
    var c = lerContatos();
    delete c[nomeChave];
    salvarContatos(c);
  }

  /* ---------- Exemplos rotativos ---------- */
  var exemplos = [
    '"reunião com o João dia 20 às 15h no escritório"',
    '"almoço com a Maria amanhã ao meio-dia"',
    '"dentista sexta às 9h30"',
    '"call com Pedro e Ana 25 de junho às 14h por 2 horas"'
  ];
  var exemploIdx = 0;
  setInterval(function () {
    if (!$('tela-principal').classList.contains('ativa')) return;
    exemploIdx = (exemploIdx + 1) % exemplos.length;
    var el = $('frase-exemplo');
    el.style.opacity = '0';
    setTimeout(function () {
      el.textContent = exemplos[exemploIdx];
      el.style.opacity = '1';
    }, 400);
  }, 5000);

  /* ---------- Voz (Web Speech API como atalho extra) ---------- */
  var Reconhecedor = window.SpeechRecognition || window.webkitSpeechRecognition;
  var ouvindo = false;
  var rec = null;

  function pararDeOuvir() {
    ouvindo = false;
    if (window.SpecOrb) SpecOrb.vuOff();
    document.querySelector('.palco-mic').classList.remove('escutando');
    $('status-mic').textContent = 'Toque para falar';
    if (rec) { try { rec.stop(); } catch (e) { } }
  }

  $('btn-mic').addEventListener('click', function () {
    if (ouvindo) { pararDeOuvir(); return; }

    if (!Reconhecedor) {
      // Caminho garantido: microfone do teclado dentro do campo de texto
      $('campo-frase').focus();
      toast('Use o microfone do teclado para ditar no campo abaixo');
      return;
    }

    rec = new Reconhecedor();
    rec.lang = 'pt-BR';
    rec.interimResults = true;
    rec.continuous = false;

    rec.onstart = function () {
      if (window.SpecOrb) { SpecOrb.pulse(0.6); SpecOrb.vuOn(); }
      ouvindo = true;
      document.querySelector('.palco-mic').classList.add('escutando');
      $('status-mic').textContent = 'Ouvindo... fale agora';
    };

    rec.onresult = function (ev) {
      var texto = '';
      for (var i = 0; i < ev.results.length; i++) {
        texto += ev.results[i][0].transcript;
      }
      $('campo-frase').value = texto;
      if (window.SpecOrb) SpecOrb.pulse(0.5);
      if (ev.results[ev.results.length - 1].isFinal) {
        pararDeOuvir();
        interpretarFrase();
      }
    };

    rec.onerror = function (ev) {
      pararDeOuvir();
      if (ev.error === 'not-allowed') {
        toast('Microfone bloqueado. Dite pelo teclado no campo de texto.');
        $('campo-frase').focus();
      } else if (ev.error !== 'aborted') {
        toast('Não consegui ouvir. Tente digitar ou ditar pelo teclado.');
      }
    };

    rec.onend = pararDeOuvir;

    try { rec.start(); }
    catch (e) {
      pararDeOuvir();
      $('campo-frase').focus();
      toast('Use o microfone do teclado para ditar no campo abaixo');
    }
  });

  /* ---------- Interpretação e cartão de revisão ---------- */

  function interpretarFrase() {
    var frase = $('campo-frase').value.trim();
    if (!frase) { toast('Fale ou digite uma frase primeiro'); return; }

    var r = window.SecretariaParser.interpretar(frase);
    estado.evento = r;
    preencherRevisao(r);
    mostrarTela('tela-revisao');
  }

  $('campo-frase').addEventListener('input', function () {
    if (window.SpecOrb) SpecOrb.pulse(0.35);
  });

  $('btn-interpretar').addEventListener('click', interpretarFrase);
  $('campo-frase').addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      interpretarFrase();
    }
  });

  function hojeISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function preencherRevisao(r) {
    $('rev-titulo').value = r.titulo || '';
    $('rev-data').value = r.data || hojeISO();
    $('rev-hora').value = r.hora || '09:00';
    $('rev-local').value = r.local || '';

    var sel = $('rev-duracao');
    var op = Array.prototype.find.call(sel.options, function (o) {
      return parseInt(o.value, 10) === r.duracaoMin;
    });
    if (!op) {
      op = document.createElement('option');
      op.value = r.duracaoMin;
      op.textContent = r.duracaoMin + ' minutos';
      sel.appendChild(op);
    }
    sel.value = String(r.duracaoMin);

    var lista = $('lista-participantes');
    lista.innerHTML = '';
    (r.participantes || []).forEach(function (nome) {
      lista.appendChild(linhaParticipante(nome, emailDoNome(nome)));
    });

    $('erro-revisao').hidden = true;
    atualizarBotaoMarcar();
  }

  function linhaParticipante(nome, email) {
    var div = document.createElement('div');
    div.className = 'participante';

    var dados = document.createElement('div');
    dados.className = 'dados';

    var inNome = document.createElement('input');
    inNome.type = 'text';
    inNome.placeholder = 'Nome';
    inNome.value = nome || '';
    inNome.className = 'nome-part';
    inNome.setAttribute('aria-label', 'Nome do participante');

    var inEmail = document.createElement('input');
    inEmail.type = 'email';
    inEmail.placeholder = 'e-mail para o convite';
    inEmail.value = email || '';
    inEmail.autocapitalize = 'off';
    inEmail.setAttribute('aria-label', 'E-mail do participante');

    var dica = document.createElement('span');
    dica.className = 'pede-email';

    function atualizarDica() {
      if (inNome.value.trim() && !inEmail.value.trim()) {
        dica.textContent = 'Sem e-mail, ' + inNome.value.trim() + ' não recebe convite';
      } else {
        dica.textContent = '';
      }
      atualizarBotaoMarcar();
    }

    inNome.addEventListener('input', function () {
      var conhecido = emailDoNome(inNome.value);
      if (conhecido && !inEmail.value) inEmail.value = conhecido;
      atualizarDica();
    });
    inEmail.addEventListener('input', atualizarDica);

    var remover = document.createElement('button');
    remover.type = 'button';
    remover.className = 'btn-remover';
    remover.textContent = '×';
    remover.setAttribute('aria-label', 'Remover participante');
    remover.addEventListener('click', function () {
      div.remove();
      atualizarBotaoMarcar();
    });

    dados.appendChild(inNome);
    dados.appendChild(inEmail);
    dados.appendChild(dica);
    div.appendChild(dados);
    div.appendChild(remover);
    atualizarDica();
    return div;
  }

  $('btn-add-participante').addEventListener('click', function () {
    $('lista-participantes').appendChild(linhaParticipante('', ''));
  });

  function colherParticipantes() {
    var itens = [];
    document.querySelectorAll('#lista-participantes .participante').forEach(function (div) {
      var nome = div.querySelector('.nome-part').value.trim();
      var email = div.querySelector('input[type="email"]').value.trim().toLowerCase();
      if (nome || email) itens.push({ nome: nome, email: email });
    });
    return itens;
  }

  function atualizarBotaoMarcar() {
    var convidados = colherParticipantes().filter(function (p) { return p.email; });
    var btn = $('btn-marcar');
    var aviso = $('aviso-convites');
    if (convidados.length) {
      btn.textContent = 'Confirmar e enviar convites';
      aviso.hidden = false;
      aviso.innerHTML = 'Ao confirmar, o Google envia convite por e-mail para: <strong>' +
        convidados.map(function (p) {
          return escapar(p.nome ? p.nome + ' (' + p.email + ')' : p.email);
        }).join(', ') + '</strong>.';
    } else {
      btn.textContent = 'Marcar';
      aviso.hidden = true;
    }
  }

  function escapar(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ---------- Montagem do evento ---------- */

  function montarEvento() {
    var titulo = $('rev-titulo').value.trim() || 'Reunião';
    var data = $('rev-data').value;
    var hora = $('rev-hora').value;
    var duracao = parseInt($('rev-duracao').value, 10) || 60;
    var local = $('rev-local').value.trim();
    var participantes = colherParticipantes();

    if (!data || !hora) return { erro: 'Preencha a data e a hora.' };

    var inicio = new Date(data + 'T' + hora + ':00');
    if (isNaN(inicio.getTime())) return { erro: 'Data ou hora inválida.' };
    var fim = new Date(inicio.getTime() + duracao * 60000);

    function iso(d) {
      function p(n) { return String(n).padStart(2, '0'); }
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
        'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':00';
    }

    var convidados = participantes.filter(function (p) { return p.email; });

    var corpo = {
      summary: titulo,
      start: { dateTime: iso(inicio), timeZone: FUSO },
      end: { dateTime: iso(fim), timeZone: FUSO },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'email', minutes: 1440 }
        ]
      }
    };
    if (local) corpo.location = local;
    if (convidados.length) {
      corpo.attendees = convidados.map(function (p) { return { email: p.email }; });
    }

    return {
      corpo: corpo,
      convidados: convidados,
      participantes: participantes,
      resumo: { titulo: titulo, data: data, hora: hora, duracao: duracao, local: local }
    };
  }

  /* ---------- Google: login e criação ---------- */

  function clientIdConfigurado() {
    return GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.indexOf('COLE_AQUI') === -1;
  }

  function obterTokenClient() {
    if (estado.tokenClient) return estado.tokenClient;
    if (!window.google || !google.accounts || !google.accounts.oauth2) return null;
    estado.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: ESCOPO,
      callback: function (resp) {
        if (resp.error) {
          try { localStorage.removeItem('secretaria.conectado'); } catch (e) { }
          toast('Login cancelado ou negado. Toque de novo para reconectar.');
          travarBotao(false);
          return;
        }
        estado.token = resp.access_token;
        estado.tokenExpira = Date.now() + (resp.expires_in - 60) * 1000;
        try { localStorage.setItem('secretaria.conectado', '1'); } catch (e) { }
        $('btn-conta').textContent = 'Conectado';
        $('btn-conta').classList.add('logado');
        if (estado.acaoPosLogin) {
          var fn = estado.acaoPosLogin;
          estado.acaoPosLogin = null;
          fn();
        }
      }
    });
    return estado.tokenClient;
  }

  function garantirToken(depois) {
    if (estado.token && Date.now() < estado.tokenExpira) { depois(); return; }
    if (!clientIdConfigurado()) {
      toast('Client ID do Google não configurado. Veja o README ou use a demonstração.');
      travarBotao(false);
      return;
    }
    var tc = obterTokenClient();
    if (!tc) {
      toast('Serviço de login do Google ainda carregando. Tente de novo.');
      travarBotao(false);
      return;
    }
    estado.acaoPosLogin = depois;
    var jaConectou = false;
    try { jaConectou = localStorage.getItem('secretaria.conectado') === '1'; } catch (e) { }
    tc.requestAccessToken({ prompt: (estado.token || jaConectou) ? '' : 'consent' });
  }

  function criarEventoGoogle(corpo, enviarConvites, ok, falhou) {
    var url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=' +
      (enviarConvites ? 'all' : 'none');
    fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + estado.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(corpo)
    }).then(function (r) {
      if (r.status === 401) {
        estado.token = null;
        throw new Error('sessao');
      }
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(ok).catch(function (e) {
      if (e.message === 'sessao') {
        garantirToken(function () { criarEventoGoogle(corpo, enviarConvites, ok, falhou); });
      } else {
        falhou(e);
      }
    });
  }

  /* ---------- Marcar ---------- */

  function travarBotao(travar) {
    $('btn-marcar').disabled = travar;
    $('btn-marcar').textContent = travar ? 'Marcando...' : $('btn-marcar').textContent;
    if (!travar) atualizarBotaoMarcar();
  }

  $('btn-marcar').addEventListener('click', function () {
    var ev = montarEvento();
    var erroEl = $('erro-revisao');
    if (ev.erro) {
      erroEl.textContent = ev.erro;
      erroEl.hidden = false;
      return;
    }
    erroEl.hidden = true;

    // Aprende os pares nome + e-mail para as próximas vezes
    ev.participantes.forEach(function (p) {
      if (p.nome && p.email) gravarContato(p.nome, p.email);
    });

    travarBotao(true);

    if (estado.demo) {
      setTimeout(function () {
        travarBotao(false);
        mostrarSucesso(ev, null, true);
      }, 900);
      return;
    }

    garantirToken(function () {
      criarEventoGoogle(ev.corpo, ev.convidados.length > 0, function (criado) {
        travarBotao(false);
        mostrarSucesso(ev, criado, false);
      }, function () {
        travarBotao(false);
        erroEl.textContent = 'Não consegui criar o evento. Verifique a conexão e tente de novo.';
        erroEl.hidden = false;
      });
    });
  });

  function mostrarSucesso(ev, criado, demo) {
    var r = ev.resumo;
    var partes = ev.convidados.map(function (p) { return p.nome || p.email; });
    var dataBR = r.data.split('-').reverse().join('/');

    $('sucesso-titulo').textContent = demo ? 'Marcado! (demonstração)' : 'Marcado!';
    $('sucesso-resumo').innerHTML =
      '<b>' + escapar(r.titulo) + '</b><br>' +
      dataBR + ' às ' + r.hora + ' (' + r.duracao + ' min)' +
      (r.local ? '<br>Local: ' + escapar(r.local) : '') +
      (partes.length ? '<br>Convites enviados para: ' + escapar(partes.join(', ')) : '<br>Evento só seu, sem convites.') +
      '<br>Lembretes: aviso 30 min antes e e-mail 1 dia antes.';

    var link = $('sucesso-link');
    if (criado && criado.htmlLink) {
      link.href = criado.htmlLink;
      link.hidden = false;
    } else {
      link.hidden = true;
    }

    if (window.SpecOrb) SpecOrb.pulse(1);
    $('campo-frase').value = '';
    mostrarTela('tela-sucesso');
  }

  $('btn-novo').addEventListener('click', function () { mostrarTela('tela-principal'); });

  /* ---------- Conta ---------- */

  $('btn-conta').addEventListener('click', function () {
    if (estado.demo) { toast('Você está no modo demonstração'); return; }
    if (estado.token) { toast('Conta Google conectada'); return; }
    garantirToken(function () { toast('Conta conectada'); });
  });

  /* ---------- Modo demonstração ---------- */

  function ligarDemo(ligar) {
    estado.demo = ligar;
    $('faixa-demo').hidden = !ligar;
    if (ligar) {
      $('btn-conta').textContent = 'Demo';
      $('campo-frase').value = 'reunião com o João dia 20 às 15h no escritório';
      toast('Modo demonstração ligado. Nada será criado de verdade.');
    } else {
      $('btn-conta').textContent = estado.token ? 'Conectado' : 'Entrar';
    }
  }

  $('btn-demo').addEventListener('click', function () { ligarDemo(true); });
  $('btn-sair-demo').addEventListener('click', function () { ligarDemo(false); });

  /* ---------- Tela de contatos ---------- */

  function desenharContatos() {
    var c = lerContatos();
    var nomes = Object.keys(c).sort();
    var lista = $('lista-contatos');
    lista.innerHTML = '';
    if (!nomes.length) {
      lista.innerHTML = '<p class="vazio">Nenhum contato ainda. Eles são salvos sozinhos quando você marca um evento com alguém novo.</p>';
      return;
    }
    nomes.forEach(function (chave) {
      var div = document.createElement('div');
      div.className = 'contato';
      var info = document.createElement('div');
      info.className = 'info';
      var nome = document.createElement('div');
      nome.className = 'nome';
      nome.textContent = chave.charAt(0).toUpperCase() + chave.slice(1);
      var email = document.createElement('div');
      email.className = 'email';
      email.textContent = c[chave];
      info.appendChild(nome);
      info.appendChild(email);
      var btn = document.createElement('button');
      btn.className = 'btn-remover';
      btn.textContent = '×';
      btn.setAttribute('aria-label', 'Apagar ' + chave);
      btn.addEventListener('click', function () {
        apagarContato(chave);
        desenharContatos();
      });
      div.appendChild(info);
      div.appendChild(btn);
      lista.appendChild(div);
    });
  }

  $('btn-contatos').addEventListener('click', function () {
    desenharContatos();
    mostrarTela('tela-contatos');
  });

  $('btn-salvar-contato').addEventListener('click', function () {
    var n = $('novo-nome').value.trim();
    var e = $('novo-email').value.trim();
    if (!n || !e || e.indexOf('@') === -1) {
      toast('Preencha nome e um e-mail válido');
      return;
    }
    gravarContato(n, e);
    $('novo-nome').value = '';
    $('novo-email').value = '';
    desenharContatos();
    toast('Contato salvo');
  });

  /* ---------- Voltar ---------- */

  document.querySelectorAll('[data-voltar]').forEach(function (b) {
    b.addEventListener('click', function () { mostrarTela('tela-principal'); });
  });

  /* ---------- Service worker ---------- */

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { });
    });
  }

})();
