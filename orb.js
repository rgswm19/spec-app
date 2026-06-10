/* ============================================================
   SPEC | Orbe de partículas, estudo fiel da referência
   Esfera em linhas de pontos com DOBRAS profundas (ruído
   ridged), brilho onde as linhas se comprimem (vincos),
   luz vinda do alto à esquerda, babados violeta na base e
   leve perspectiva (pontos maiores na frente).
   Ancorado na esfera do microfone: rola junto com a página.
   API: window.SpecOrb.pulse(0..1), .setLevel(0..1), .vuOn(), .vuOff()
   Estilo anterior preservado em orb-suave-copia.js
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

  var COR_A = { r: 100, g: 178, b: 255 };  // azul elétrico
  var COR_B = { r: 215, g: 122, b: 255 };  // violeta da base

  // Luz vinda do alto, à esquerda e da frente, como na referência
  var LX = -0.42, LY = -0.62, LZ = 0.66;

  function criarPontos(orcamento) {
    pontos = [];
    var aneis = orcamento > 4000 ? 60 : 48;
    var base = orcamento > 4000 ? 116 : 92;
    for (var j = 0; j < aneis; j++) {
      var lat = -Math.PI / 2 + Math.PI * (j + 0.5) / aneis;
      var n = Math.max(8, Math.round(base * Math.cos(lat)));
      for (var k = 0; k < n; k++) {
        pontos.push({ lat: lat, lon: (k / n) * Math.PI * 2 });
      }
    }
  }

  /* Campo de deformação:
     lóbulos grandes + vincos (ridged) + babado na base */
  function campo(lat, lon, tt) {
    var lobos =
      Math.sin(lon * 2 + tt * 0.40) * Math.cos(lat * 2.1 - tt * 0.26) * 0.50 +
      Math.sin(lon * 3.3 - tt * 0.55 + 1.3) * Math.sin(lat * 1.7 + tt * 0.33) * 0.28;

    // vinco: cria vales estreitos e paredes que concentram linhas
    var vinco = 0.5 - Math.abs(Math.sin(lon * 2.6 + lat * 1.9 + tt * 0.47));

    // babado: ondulação curta que cresce na metade de baixo
    var baixo = Math.max(0, Math.sin(lat));
    var babado = Math.sin(lon * 7 + lat * 2 + tt * 1.1) * baixo * baixo * 0.55;

    return lobos + vinco * 0.55 + babado;
  }

  function redimensionar() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    criarPontos((window.innerWidth * window.innerHeight > 500000) ? 4800 : 3500);
  }

  var EPS = 0.045;

  function desenhar() {
    ctx.clearRect(0, 0, W, H);

    var vivo = Math.min(1, energia + nivelVU * 0.9);
    var amp = 0.20 + vivo * 0.17;

    var cx = W / 2;
    var cy = H / 2;
    var R = Math.min(W, H) * 0.355;
    var rotY = t * 0.085;

    for (var i = 0; i < pontos.length; i++) {
      var p = pontos[i];
      var lon = p.lon + rotY;

      var n0 = campo(p.lat, p.lon + rotY * 0.35, t);
      var def = 1 + n0 * amp;

      // compressão local: gradiente do campo = onde as linhas se juntam
      var nLon = campo(p.lat, p.lon + rotY * 0.35 + EPS, t);
      var nLat = campo(p.lat + EPS, p.lon + rotY * 0.35, t);
      var grad = (Math.abs(nLon - n0) + Math.abs(nLat - n0)) / EPS;
      var vincoBrilho = Math.min(1, grad * 0.34);

      var cosLat = Math.cos(p.lat);
      var ux = Math.cos(lon) * cosLat;
      var uz = Math.sin(lon) * cosLat;
      var uy = Math.sin(p.lat);

      var x = ux * def, y = uy * def, z = uz * def;

      // perspectiva leve: frente maior, fundo menor
      var persp = 1 / (1.55 - z * 0.45);
      var px = cx + x * R * persp;
      var py = cy + y * R * persp;

      var frente = (z + 1) / 2;
      var silhueta = Math.pow(1 - Math.abs(z), 1.5);
      var luz = Math.max(0, ux * LX + uy * LY + uz * LZ);

      var alfa = (0.05 + vincoBrilho * 0.50 + luz * 0.28 + silhueta * 0.12) *
                 (0.50 + vivo * 0.75);
      if (z < -0.2) alfa *= 0.35;
      if (alfa > 0.92) alfa = 0.92;
      if (alfa < 0.02) continue;

      var tam = (0.55 + frente * 1.35 + vincoBrilho * 0.55 + vivo * 0.4) * persp;

      // violeta concentrado na base, puxando rosa nos vincos de baixo
      var baixo = Math.pow(Math.max(0, (y + 1) / 2), 2.3);
      var mix = Math.min(1, baixo + vincoBrilho * baixo * 0.6);
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
    // só gasta bateria se o orbe estiver visível na tela
    if (canvas.offsetParent !== null) desenhar();
    requestAnimationFrame(quadro);
  }

  function iniciar() {
    canvas = document.getElementById('orbe');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    redimensionar();
    window.addEventListener('resize', redimensionar);

    if (reduzido) { t = 2.3; desenhar(); return; }

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
    }).catch(function () { });
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
