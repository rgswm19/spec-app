/* ============================================================
   Secretária | Interpretador de frases (pt-BR)
   Extrai título, data, hora, duração, local e participantes
   de uma frase falada ou digitada. Roda 100% no navegador.
   Sem IA, sem servidor: só expressões regulares e datas.
   ============================================================ */

(function (root) {
  'use strict';

  // Limites de palavra compatíveis com acentos (pt-BR).
  // O \b nativo do JS falha com ã, ç, é etc.
  var B = '(?<![\\p{L}\\d])';
  var E = '(?![\\p{L}\\d])';

  function rx(padrao) { return new RegExp(B + padrao + E, 'iu'); }

  var MESES = {
    'janeiro': 0, 'fevereiro': 1, 'marco': 2, 'abril': 3, 'maio': 4,
    'junho': 5, 'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9,
    'novembro': 10, 'dezembro': 11
  };

  var DIAS_SEMANA = {
    'domingo': 0, 'segunda': 1, 'terca': 2, 'quarta': 3,
    'quinta': 4, 'sexta': 5, 'sabado': 6
  };

  // Palavras que encerram a captura de nomes ou de local
  var STOP = ['hoje', 'amanha', 'depois', 'dia', 'dias', 'as', 'a', 'ao',
    'no', 'na', 'nos', 'nas', 'em', 'para', 'pra', 'por', 'sobre',
    'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo',
    'meio-dia', 'meia-noite', 'meia', 'hora', 'horas'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function semAcento(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function ehStop(palavra) {
    var p = semAcento(palavra.toLowerCase());
    return STOP.indexOf(p) >= 0 || /^\d/.test(p);
  }

  function capitalizarNome(s) {
    return s.trim().split(/\s+/).map(function (p) {
      if (/^(de|da|do|dos|das|e)$/i.test(p)) return p.toLowerCase();
      return p.charAt(0).toUpperCase() + p.slice(1);
    }).join(' ');
  }

  /* ---------- DATA ---------- */

  function extrairData(ctx, agora) {
    var hojeBase = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    var resultado = null;

    function consumir(padrao, fn) {
      if (resultado) return;
      var m = ctx.texto.match(rx(padrao));
      if (m) {
        var r = fn(m);
        if (r) {
          resultado = r;
          ctx.texto = ctx.texto.replace(m[0], ' ');
        }
      }
    }

    consumir('depois\\s+de\\s+amanh[aã]', function () {
      var d = new Date(hojeBase); d.setDate(d.getDate() + 2); return d;
    });

    consumir('amanh[aã]', function () {
      var d = new Date(hojeBase); d.setDate(d.getDate() + 1); return d;
    });

    consumir('hoje', function () { return new Date(hojeBase); });

    // 16/06 ou 16/06/2026
    consumir('(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?', function (m) {
      var dia = parseInt(m[1], 10), mes = parseInt(m[2], 10) - 1;
      var ano = m[3] ? parseInt(m[3], 10) : agora.getFullYear();
      if (ano < 100) ano += 2000;
      if (mes < 0 || mes > 11 || dia < 1 || dia > 31) return null;
      var d = new Date(ano, mes, dia);
      if (!m[3] && d < hojeBase) d.setFullYear(d.getFullYear() + 1);
      return d;
    });

    // (dia) 20 de junho (de 2026)
    consumir('(?:dia\\s+)?(\\d{1,2})\\s+de\\s+([\\p{L}]+)(?:\\s+de\\s+(\\d{4}))?', function (m) {
      var mes = MESES[semAcento(m[2].toLowerCase())];
      if (mes === undefined) return null;
      var dia = parseInt(m[1], 10);
      var ano = m[3] ? parseInt(m[3], 10) : agora.getFullYear();
      var d = new Date(ano, mes, dia);
      if (!m[3] && d < hojeBase) d.setFullYear(d.getFullYear() + 1);
      return d;
    });

    // dia 20
    consumir('(?:no\\s+)?dia\\s+(\\d{1,2})', function (m) {
      var dia = parseInt(m[1], 10);
      if (dia < 1 || dia > 31) return null;
      var d = new Date(agora.getFullYear(), agora.getMonth(), dia);
      if (d < hojeBase) d = new Date(agora.getFullYear(), agora.getMonth() + 1, dia);
      return d;
    });

    // dia da semana, com "próxima" opcional
    consumir('(?:n[ao]\\s+)?(?:pr[oó]xim[ao]\\s+)?(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:-feira)?', function (m) {
      var alvo = DIAS_SEMANA[semAcento(m[1].toLowerCase())];
      if (alvo === undefined) return null;
      var diff = (alvo - hojeBase.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      var d = new Date(hojeBase); d.setDate(d.getDate() + diff);
      return d;
    });

    return resultado; // pode ser null: usuário escolhe no cartão
  }

  /* ---------- HORA ---------- */

  function extrairHora(ctx) {
    var hora = null, minuto = 0;

    function consumir(padrao, fn) {
      if (hora !== null) return;
      var m = ctx.texto.match(rx(padrao));
      if (m && fn(m)) ctx.texto = ctx.texto.replace(m[0], ' ');
    }

    consumir('(?:ao\\s+)?meio[\\s-]dia(\\s+e\\s+meia)?', function (m) {
      hora = 12; minuto = m[1] ? 30 : 0; return true;
    });

    consumir('(?:[aà]\\s+)?meia[\\s-]noite', function () {
      hora = 0; minuto = 0; return true;
    });

    // às 15h30 | 15h | 15:30 | às 9 | 9 e meia | 8 da noite
    consumir('(?:[aà]s?\\s+)?(\\d{1,2})\\s*(?:h(?:oras?)?|:)?\\s*(\\d{2})?(\\s+e\\s+meia)?(\\s+da\\s+manh[aã]|\\s+da\\s+tarde|\\s+da\\s+noite)?', function (m) {
      // exige algum marcador de hora para não engolir números soltos
      var temMarcador = /[aà]s?\s/iu.test(m[0]) || /\d\s*h/i.test(m[0]) || /:/.test(m[0]) || !!m[3] || !!m[4];
      if (!temMarcador) return false;
      var h = parseInt(m[1], 10);
      if (h > 23) return false;
      var min = m[2] ? parseInt(m[2], 10) : 0;
      if (min > 59) return false;
      if (m[3]) min = 30;
      var periodo = m[4] ? semAcento(m[4].toLowerCase()) : '';
      if ((periodo.indexOf('tarde') >= 0 || periodo.indexOf('noite') >= 0) && h < 12) h += 12;
      if (periodo.indexOf('manha') >= 0 && h === 12) h = 0;
      hora = h; minuto = min;
      return true;
    });

    if (hora === null) return null;
    return { hora: hora, minuto: minuto };
  }

  /* ---------- DURAÇÃO ---------- */

  function extrairDuracao(ctx) {
    var minutos = null;

    function consumir(padrao, fn) {
      if (minutos !== null) return;
      var m = ctx.texto.match(rx(padrao));
      if (m) {
        minutos = fn(m);
        ctx.texto = ctx.texto.replace(m[0], ' ');
      }
    }

    consumir('por\\s+(\\d+)\\s*h(?:oras?)?(\\s+e\\s+meia)?', function (m) {
      return parseInt(m[1], 10) * 60 + (m[2] ? 30 : 0);
    });
    consumir('por\\s+(\\d+)\\s*min(?:utos?)?', function (m) {
      return parseInt(m[1], 10);
    });
    consumir('por\\s+meia\\s+hora', function () { return 30; });
    consumir('por\\s+uma\\s+hora(\\s+e\\s+meia)?', function (m) {
      return m[1] ? 90 : 60;
    });

    return minutos; // null => padrão 60 definido no app
  }

  /* ---------- PARTICIPANTES ---------- */

  function extrairParticipantes(ctx) {
    var nomes = [];
    var m = ctx.texto.match(rx('com\\s+(?:[oa]s?\\s+)?([\\p{L}].*)'));
    if (!m) return nomes;

    // Caminha palavra a palavra a partir de "com", aceitando nomes,
    // vírgulas e "e", até encontrar uma palavra de parada.
    var tokens = m[1].split(/(\s+|,)/);
    var capturado = [];
    for (var i = 0; i < tokens.length; i++) {
      var tk = tokens[i];
      if (!tk || /^\s+$/.test(tk)) { capturado.push(tk); continue; }
      if (tk === ',') { capturado.push(tk); continue; }
      var baixo = semAcento(tk.toLowerCase());
      if (baixo === 'e') { capturado.push(tk); continue; }
      if (baixo === 'o' || baixo === 'a' || baixo === 'os' || baixo === 'as') {
        // artigo no meio da lista ("e o Pedro"): pula sem encerrar
        capturado.push(tk); continue;
      }
      if (ehStop(tk)) break;
      capturado.push(tk);
    }

    var bruto = capturado.join('').replace(/[,\s]+$/, '').replace(/\s+e$/i, '');
    if (bruto.trim()) {
      bruto.split(/\s*,\s*|\s+e\s+/i).forEach(function (n) {
        n = n.replace(/^\s*[oa]s?\s+/i, '').trim();
        if (n) nomes.push(capitalizarNome(n));
      });
      var trecho = m[0].slice(0, m[0].length - (m[1].length - capturado.join('').length));
      ctx.texto = ctx.texto.replace(trecho, ' ');
    }
    return nomes;
  }

  /* ---------- LOCAL ---------- */

  function extrairLocal(ctx) {
    var m = ctx.texto.match(rx('(?:no|na|em)\\s+([\\p{L}].*)'));
    if (!m) return null;

    var tokens = m[1].split(/(\s+)/);
    var capturado = [];
    for (var i = 0; i < tokens.length; i++) {
      var tk = tokens[i];
      if (!tk || /^\s+$/.test(tk)) { capturado.push(tk); continue; }
      var baixo = semAcento(tk.toLowerCase());
      if (baixo === 'de' || baixo === 'do' || baixo === 'da' || baixo === 'dos' || baixo === 'das') {
        capturado.push(tk); continue;
      }
      if (ehStop(tk) || baixo === 'com') break;
      capturado.push(tk);
    }

    var bruto = capturado.join('').replace(/\s+(de|do|da|dos|das)$/i, '').trim();
    if (!bruto) return null;

    var trecho = m[0].slice(0, m[0].length - (m[1].length - capturado.join('').length));
    ctx.texto = ctx.texto.replace(trecho, ' ');
    return capitalizarNome(bruto);
  }

  /* ---------- TÍTULO ---------- */

  function montarTitulo(restante, participantes) {
    var limpo = restante;
    ['no', 'na', 'nos', 'nas', 'em', 'de', 'do', 'da', 'para', 'pra',
      'as', 'às', 'a', 'à', 'o', 'e', 'com', 'um', 'uma', 'ao', 'aos'].forEach(function (p) {
        limpo = limpo.replace(new RegExp(B + p + E, 'giu'), ' ');
      });
    limpo = limpo.replace(/[,.;:]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (limpo.length >= 3) {
      return limpo.charAt(0).toUpperCase() + limpo.slice(1);
    }
    if (participantes.length) return 'Reunião com ' + participantes.join(', ');
    return 'Reunião';
  }

  /* ---------- API PÚBLICA ---------- */

  function interpretar(frase, agora) {
    agora = agora || new Date();
    var ctx = { texto: frase.replace(/\s+/g, ' ').trim() };

    var data = extrairData(ctx, agora);
    var hora = extrairHora(ctx);
    var duracao = extrairDuracao(ctx);
    var participantes = extrairParticipantes(ctx);
    var local = extrairLocal(ctx);
    var titulo = montarTitulo(ctx.texto, participantes);

    return {
      titulo: titulo,
      data: data ? (data.getFullYear() + '-' + pad(data.getMonth() + 1) + '-' + pad(data.getDate())) : null,
      hora: hora ? (pad(hora.hora) + ':' + pad(hora.minuto)) : null,
      duracaoMin: duracao || 60,
      local: local,
      participantes: participantes
    };
  }

  root.SecretariaParser = { interpretar: interpretar };

})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = globalThis.SecretariaParser;
}
