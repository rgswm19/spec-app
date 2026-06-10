/* ============================================================
   SPEC | Orbe de partículas
   Esfera construída em linhas de pontos (anéis de latitude),
   com deformações orgânicas grandes e brilho na silhueta,
   no estilo da referência. Respira sozinha e intensifica
   com a voz, como um V.U.
   API: window.SpecOrb.pulse(0..1), .setLevel(0..1), .vuOn(), .vuOff()
   ============================================================ */

(function () {
  'use strict';

  var canvas, ctx, dpr;
  var W = 0, H = 0;
  var pontos = [];
  var t = 0;
  var energia = 0;
  var nivelVU = 0;
  var rodando = false;
  var reduzido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Azul elétrico no corpo, violeta concentrado na base
  var COR_A = { r: 96, g: 176, b: 255 };
  var COR_B = { r: 205, g: 120, b: 255 };

  function criarPontos(orcamento) {
    pontos = [];
    var aneis = orcamento > 4000 ? 58 : 46;
    var base = orcamento > 4000 ? 118 : 92;
    for (var j = 0; j < aneis; j++) {
      var lat = -Math.PI / 2 + Math.PI * (j + 0.5) / aneis;
      var raioAnel = Math.cos(lat);
      var n = Math.max(8, Math.round(base * raioAnel));
      for (var k = 0; k < n; k++) {
        var lon = (k / n) * Math.PI * 2;
        pontos.push({ lat: lat, lon: lon });
      }
    }
  }

  // Deformação orgânica: poucas ondas, grandes, como bolha viva
  function deformar(lat, lon, tt, amp) {
    var n =
      Math.sin(lon * 2 + tt * 0.5) * Math.cos(lat * 2.4 - tt * 0.3) * 0.55 +
      Math.sin(lon * 3 - tt * 0.7 + 1.7) * Math.sin(lat * 1.6 + tt * 0.4) * 0.30 +
      Math.sin(lon + lat * 3.2 + tt * 0.9) * 0.15;
    return 1 + n * amp;
  }

  function redimensionar() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    criarPontos((W * H > 500000) ? 5000 : 3600);
  }

  function desenhar() {
    ctx.clearRect(0, 0, W, H);

    var vivo = Math.min(1, energia + nivelVU * 0.9);
    var amp = 0.16 + vivo * 0.20;

    var cx = W / 2;
    var cy = H * 0.46;
    var R = Math.min(W, H) * 0.36;

    var rotY = t * 0.10;

    for (var i = 0; i < pontos.length; i++) {
      var p = pontos[i];
      var lon = p.lon + rotY;
      var cosLat = Math.cos(p.lat);

      var def = deformar(p.lat, p.lon + rotY * 0.4, t, amp);

      var x = Math.cos(lon) * cosLat * def;
      var z = Math.sin(lon) * cosLat * def;
      var y = Math.sin(p.lat) * def;

      var px = cx + x * R;
      var py = cy + y * R;

      var frente = (z + 1) / 2;                      // 0 atrás, 1 na frente
      var silhueta = Math.pow(1 - Math.abs(z), 1.6); // brilho na borda

      var alfa = (0.06 + silhueta * 0.50 + frente * 0.16) * (0.55 + vivo * 0.75);
      if (z < -0.15) alfa *= 0.45;                   // fundo bem discreto
      if (alfa > 0.9) alfa = 0.9;
      if (alfa < 0.02) continue;

      var tam = 0.6 + frente * 1.1 + silhueta * 0.5 + vivo * 0.5;

      // Violeta só na parte baixa, como na referência
      var mix = Math.pow(Math.max(0, (y + 1) / 2), 2.6);
      var r = Math.round(COR_A.r + (COR_B.r - COR_A.r) * mix);
      var g = Math.round(COR_A.g + (COR_B.g - COR_A.g) * mix);
      var b = Math.round(COR_A.b + (COR_B.b - COR_A.b) * mix);

      ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alfa.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(px, py, tam, 0, 6.2832);
      ctx.fill();
    }
  }

  function quadro() {
    if (!rodando) return;
    t += 0.016;
    energia *= 0.94;
    desenhar();
    requestAnimationFrame(quadro);
  }

  function iniciar() {
    canvas = document.getElementById('orbe');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    redimensionar();
    window.addEventListener('resize', redimensionar);

    if (reduzido) { t = 1.7; desenhar(); return; }

    rodando = true;
    requestAnimationFrame(quadro);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        rodando = false;
      } else if (!rodando) {
        rodando = true;
        requestAnimationFrame(quadro);
      }
    });
  }

  /* ---------- V.U. real pelo microfone, quando o sistema deixa ---------- */
  var audioCtx = null, analisador = null, fonte = null, fluxo = null, vuTimer = null;

  function ligarVU() {
    if (reduzido || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      fluxo = stream;
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analisador = audioCtx.createAnalyser();
      analisador.fftSize = 256;
      fonte = audioCtx.createMediaStreamSource(stream);
      fonte.connect(analisador);
      var dados = new Uint8Array(analisador.frequencyBinCount);
      vuTimer = setInterval(function () {
        analisador.getByteFrequencyData(dados);
        var soma = 0;
        for (var i = 0; i < dados.length; i++) soma += dados[i];
        nivelVU = Math.min(1, (soma / dados.length / 255) * 2.4);
      }, 50);
    }).catch(function () { /* sem permissão: segue só com pulsos */ });
  }

  function desligarVU() {
    nivelVU = 0;
    if (vuTimer) { clearInterval(vuTimer); vuTimer = null; }
    if (fluxo) { fluxo.getTracks().forEach(function (tr) { tr.stop(); }); fluxo = null; }
    if (audioCtx) { audioCtx.close().catch(function () { }); audioCtx = null; }
    analisador = null; fonte = null;
  }

  window.SpecOrb = {
    pulse: function (forca) { energia = Math.min(1.2, energia + (forca || 0.5)); },
    setLevel: function (n) { nivelVU = Math.max(0, Math.min(1, n)); },
    vuOn: ligarVU,
    vuOff: desligarVU
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

})();
