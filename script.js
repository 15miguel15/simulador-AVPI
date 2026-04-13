// ============================================================
// SIMULADOR DE PRÉSTAMO · SISTEMA FRANCÉS
// Análisis y Valoración de Proyectos de Inversión · 2025-26
// ============================================================

// ============================================================
// NAVEGACIÓN ENTRE PANTALLAS
// ============================================================

function goTo(from, to) {
  var src = document.getElementById('s' + from);
  var dst = document.getElementById('s' + to);
  src.classList.add('out');
  setTimeout(function () {
    src.classList.add('hidden');
    src.classList.remove('out');
    dst.classList.remove('hidden');
    dst.scrollTop = 0;
  }, 500);
}

function volver() {
  var s3 = document.getElementById('s3');
  var s1 = document.getElementById('s1');
  s3.classList.add('out');
  setTimeout(function () {
    s3.classList.add('hidden');
    s3.classList.remove('out');
    s1.classList.remove('hidden');
  }, 500);
}

// ============================================================
// UTILIDADES
// ============================================================

function fmt(n) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtP(n) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

// ============================================================
// ETIQUETA MES ACTUAL
// ============================================================
(function () {
  var meses = ['enero','febrero','marzo','abril','mayo','junio',
               'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var now = new Date();
  var el = document.getElementById('mesLabel');
  if (el) el.textContent = '(' + meses[now.getMonth()] + ' ' + now.getFullYear() + ')';
})();

// ============================================================
// CÁLCULOS FINANCIEROS
// ============================================================

/**
 * Cuota periódica constante — Sistema Francés
 * alpha = C · i / [1 - (1+i)^(-n)]
 */
function cuotaFrancesa(C, i, n) {
  if (i === 0) return C / n;
  return C * i / (1 - Math.pow(1 + i, -n));
}

/**
 * Cuadro de amortización completo (sin gastos ni comisiones)
 */
function cuadroAmortizacion(C, i, n) {
  var alpha = cuotaFrancesa(C, i, n);
  var filas = [];
  var pendiente = C;
  for (var k = 1; k <= n; k++) {
    var intereses    = pendiente * i;
    var amortizacion = alpha - intereses;
    pendiente        = pendiente - amortizacion;
    if (k === n) pendiente = 0;
    filas.push({
      periodo:      k,
      cuota:        alpha,
      intereses:    intereses,
      amortizacion: amortizacion,
      pendiente:    Math.max(0, pendiente)
    });
  }
  return filas;
}

/**
 * Coste efectivo / TAE con gastos — Newton-Raphson
 *
 * Ecuación: C_neto = Σ (cuota + gastoAdm) / (1+r)^k
 * TAE = (1+r)^m − 1
 */
function costeEfectivo(C_neto, cuota, gastoAdm, n, m) {
  var flujo = cuota + gastoAdm;
  var r = 0.004;
  for (var it = 0; it < 300; it++) {
    var f = 0, df = 0;
    for (var k = 1; k <= n; k++) {
      var v  = Math.pow(1 + r, k);
      f  += flujo / v;
      df -= k * flujo / (v * (1 + r));
    }
    var delta = (C_neto - f) / (-df);
    r -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  return (Math.pow(1 + r, m) - 1) * 100;
}

// ============================================================
// FUNCIÓN PRINCIPAL — CALCULAR
// ============================================================

function calcular() {
  var errBox = document.getElementById('errorBox');
  errBox.style.display = 'none';
  errBox.innerHTML = '';

  // Leer datos del formulario
  var capital  = parseFloat(document.getElementById('capital').value);
  var duracion = parseInt(document.getElementById('duracion').value, 10);
  var m        = parseInt(document.getElementById('periodicidad').value, 10);
  var tipo     = document.querySelector('input[name="tipo"]:checked').value;
  var euribor  = parseFloat(document.getElementById('euribor').value);
  var bonif    = parseFloat(document.getElementById('bonif').value) || 0;

  // Validaciones
  var err = [];
  if (isNaN(capital) || capital < 100000 || capital > 200000)
    err.push('El capital debe estar entre 100.000 € y 200.000 €.');
  if (isNaN(duracion) || duracion < 1 || duracion > 30)
    err.push('La duración debe estar entre 1 y 30 años.');
  if (isNaN(euribor) || euribor < 0)
    err.push('Introduce un Euribor válido (mayor o igual a 0).');
  if (bonif !== 0 && (bonif < 0.10 || bonif > 0.25))
    err.push('La bonificación debe estar entre 0,10% y 0,25%.');

  if (err.length) {
    errBox.innerHTML = '⚠ ' + err.join('<br>⚠ ');
    errBox.style.display = 'block';
    return;
  }

  // Tipo nominal anual
  var difer    = tipo === 'fijo' ? 1.00 : 0.50;
  var tinAnual = euribor + difer - bonif;      // % anual
  var tinPer   = tinAnual / 100 / m;           // tipo periódico decimal

  // Número de períodos
  var n = duracion * m;

  // Cuota sin gastos
  var cuota = cuotaFrancesa(capital, tinPer, n);

  // Gastos
  var gastoEstudio = 150;
  var gastoAdm     = cuota * 0.001;           // 1‰ por período
  var capitalNeto  = capital - gastoEstudio;

  // TAE / Coste efectivo
  var tae = costeEfectivo(capitalNeto, cuota, gastoAdm, n, m);

  // Cuadro amortización
  var tabla = cuadroAmortizacion(capital, tinPer, n);
  var totalIntereses = tabla.reduce(function (s, f) { return s + f.intereses; }, 0);

  // Nombres legibles
  var nomPer  = { 12:'mensual', 4:'trimestral', 2:'semestral', 1:'anual' }[m];
  var nomTipo = tipo === 'fijo' ? 'Fijo' : 'Variable';

  // Volcar KPIs
  document.getElementById('rCuota').textContent     = fmt(cuota);
  document.getElementById('rTin').textContent       = fmtP(tinAnual);
  document.getElementById('rTae').textContent       = fmtP(tae);
  document.getElementById('rIntereses').textContent = fmt(totalIntereses);

  // Hipótesis
  document.getElementById('hipBox').innerHTML =
    'Capital: <strong>' + fmt(capital) + ' €</strong> &nbsp;·&nbsp; ' +
    'Duración: <strong>' + duracion + ' años</strong> &nbsp;·&nbsp; ' +
    'Periodicidad: <strong>' + nomPer + '</strong> &nbsp;·&nbsp; ' +
    'Tipo: <strong>' + nomTipo + '</strong><br>' +
    'Euribor: <strong>' + fmtP(euribor) + '%</strong> &nbsp;·&nbsp; ' +
    'Diferencial: <strong>+' + difer.toFixed(2) + '%</strong> &nbsp;·&nbsp; ' +
    'Bonificación: <strong>−' + bonif.toFixed(2) + '%</strong> &nbsp;·&nbsp; ' +
    'TIN: <strong>' + fmtP(tinAnual) + '%</strong><br>' +
    'Gastos estudio: <strong>150,00 €</strong> &nbsp;·&nbsp; ' +
    'Gastos adm.: <strong>' + fmt(gastoAdm) + ' €/período</strong>';

  // Tabla de amortización
  var tbody = document.getElementById('tablaBody');
  tbody.innerHTML = '';
  tabla.forEach(function (f) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + f.periodo + '</td>' +
      '<td>' + fmt(f.cuota) + '</td>' +
      '<td>' + fmt(f.intereses) + '</td>' +
      '<td>' + fmt(f.amortizacion) + '</td>' +
      '<td>' + fmt(f.pendiente) + '</td>';
    tbody.appendChild(tr);
  });

  // Navegar a resultados
  goTo(2, 3);
}