'use strict';
const $ = id => document.getElementById(id);
const money = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const percent = v => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(v) + '%';
const n = id => { const value = $(id).value.trim(); return value === '' ? null : Number(value); };
const TAXES = [
  ['iss', 'ISSQN', 5], ['pis', 'PIS', .65], ['cofins', 'COFINS', 3],
  ['csll', 'CSLL', 1], ['inss', 'INSS', 11], ['custom', 'DAS / outra carga', 0]
];
const NAMES = Object.fromEntries([...TAXES.map(t => [t[0], t[1]]), ['ir', 'IR'], ['ibs', 'IBS'], ['cbs', 'CBS']]);
const TREATMENTS = { retained: 'Retido pelo tomador', pf: 'Retido — pessoa física', own: 'Prestador recolhe', supplier: 'Receber e reservar', separated: 'Segregado / tomador', informative: 'Informativo — dispensado' };
let lastResult = null;
const nativeBridge = window.CalcAndroid;
const nativePending = new Map();
let nativeSequence = 0;
if (nativeBridge && typeof nativeBridge.postMessage === 'function') {
  nativeBridge.onmessage = event => {
    try {
      const reply = JSON.parse(event.data);
      const pending = nativePending.get(reply.id);
      if (!pending) return;
      nativePending.delete(reply.id);
      clearTimeout(pending.timeout);
      if (reply.ok) pending.resolve(); else pending.reject(new Error(reply.error || 'Não foi possível concluir a ação.'));
    } catch { /* Uma resposta inválida não altera o cálculo. */ }
  };
}
function nativeRequest(action, text = '') {
  return new Promise((resolve, reject) => {
    const id = String(++nativeSequence);
    const timeout = setTimeout(() => { nativePending.delete(id); reject(new Error('O Android não respondeu. Tente novamente.')); }, 15000);
    nativePending.set(id, { resolve, reject, timeout });
    try { nativeBridge.postMessage(JSON.stringify({ id, action, text })); }
    catch (error) { clearTimeout(timeout); nativePending.delete(id); reject(error); }
  });
}

function mount() {
  $('year').innerHTML = Array.from({ length: 9 }, (_, i) => `<option value="${2025 + i}" ${i === 2 ? 'selected' : ''}>${2025 + i}</option>`).join('');
  $('taxes').innerHTML = TAXES.map(([id, name, rate]) => `<div class="tax-row" id="row_${id}">
    <div class="tax-top"><span class="tax-name">${name}</span><label>Alíquota (%)<input id="rate_${id}" type="number" value="${rate}" min="0" max="99.99" step="0.0001"></label>
    <label>Tratamento<select id="mode_${id}"><option value="none">Não incluir</option><option value="retained" ${id === 'iss' ? 'selected' : ''}>Retido pelo tomador</option><option value="own">Prestador recolhe</option>${id === 'inss' ? '<option value="pf">Retido — pessoa física com teto</option>' : ''}</select></label></div>
    <div class="tax-extra" id="extra_${id}"><label>Percentual do serviço na base (%)<input id="base_${id}" type="number" value="100" min="0" max="100" step="0.0001"></label>
    ${id === 'custom' ? '<label>Base da outra carga<select id="basis_custom"><option value="service">Serviço após desc. incondicional</option><option value="rtc">Base IBS/CBS (sem ISS)</option></select></label>' : `<p class="help" id="note_${id}"></p>`}</div>
    ${id === 'inss' ? '<label id="capLabel" hidden>Base mensal ainda disponível para INSS (R$)<input id="remainingCap" type="number" min="0" step="0.01" placeholder="Teto do ano menos bases já utilizadas"><span class="help">Pessoa física: informe o teto vigente menos a base já usada no mês, inclusive em outras fontes. Em 2026 o teto é R$ 8.475,55. Para 2027, confirme o novo teto; não aplicamos o de 2026 automaticamente. Cessão de mão de obra/empreitada PJ não tem esse teto.</span></label>' : ''}</div>`).join('');
  $('discounts').innerHTML = [['unconditional', 'Desconto incondicional'], ['conditional', 'Desconto condicional'], ['other', 'Outro desconto']].map(([id, name]) => `<div class="discount-row"><span>${name}</span><label>Tipo<select id="type_${id}"><option value="fixed">Valor (R$)</option><option value="percent">Percentual (%)</option></select></label><label>Quantia<input id="value_${id}" type="number" value="0" min="0" step="0.01"></label></div>`).join('');
  $('calendarRows').innerHTML = Array.from({ length: 9 }, (_, i) => {
    const a = Calc.calendar(2025 + i);
    return `<tr><td>${a.year}</td><td>${a.legacy ? 'Vigentes' : 'Extintos'}</td><td>${a.issFactor ? percent(a.issFactor * 100) + ' da alíquota' : 'Extinto'}</td><td>${a.ibs === null ? 'Informar alíquota do ano' : percent(a.ibs)}</td><td>${a.cbs === null ? 'Informar' + (a.cbsAdjustment ? ' − 0,1 p.p.' : '') : percent(a.cbs)}</td></tr>`;
  }).join('');
  syncYear(true);
  sync();
}
function invalidate() {
  lastResult = null;
  $('result').hidden = true;
  $('emptyResult').hidden = false;
  $('resultSubtitle').textContent = 'Calcule novamente após alterar os parâmetros.';
  $('copyStatus').textContent = '';
  $('error').hidden = true;
}
function syncYear(initial = false) {
  const a = Calc.calendar(n('year'));
  // Não carrega alíquotas fixas ou estimadas de uma competência para outra.
  $('ibs').value = a.ibs ?? '';
  $('cbs').value = a.cbs ?? '';
  $('effectiveRates').checked = false;
  $('publicConfirmed').checked = false;
  $('irConfirmed').checked = false;
  $('remainingCap').value = a.year === 2026 ? '8475.55' : '';
  $('excludedLegacy').value = '0';
  for (const id of ['pis', 'cofins', 'iss']) {
    const extinct = id === 'iss' ? !a.issFactor : !a.legacy;
    if (extinct) $(`mode_${id}`).value = 'none';
    $(`mode_${id}`).disabled = extinct;
  }
  if (a.year === 2025) $('rtcEnabled').checked = false;
  else if (!initial && $('regime').value === 'regular') $('rtcEnabled').checked = true;
  $('yearNotice').textContent = a.year === 2025 ? '2025: regime anterior ao IBS/CBS.' : a.year === 2026 ? '2026: ano de teste. CBS 0,9% e IBS 0,1%; dispensa de recolhimento depende das obrigações acessórias. O destaque informativo não é adicionado ao pagamento quando dispensado.' : a.year <= 2028 ? `${a.year}: PIS/COFINS extintos; ISS integral; IBS total 0,1% (0,05% estadual + 0,05% municipal). CBS informada antes do ajuste sofre redução de 0,1 ponto percentual.` : `${a.year}: ${a.issFactor ? 'ISS a ' + percent(a.issFactor * 100) + ' da alíquota municipal.' : 'ISS extinto.'} Informe as alíquotas IBS/CBS da competência; não usamos a alíquota final de 2033 como se fosse a dos anos anteriores.`;
  $('note_iss').textContent = a.issFactor ? `Aplicamos ${percent(a.issFactor * 100)} da alíquota municipal informada.` : 'Extinto nesta competência.';
  $('note_pis').textContent = $('note_cofins').textContent = 'Retenção e incidência na apuração podem ter alíquotas diferentes.';
  $('note_csll').textContent = 'A reforma não extingue esta retenção. Confirme sua aplicação.';
  $('note_inss').textContent = 'PJ: retenção configurável sem teto. PF: escolha o modo com teto mensal disponível.';
}
function sync() {
  const a = Calc.calendar(n('year'));
  const manual = $('regime').value === 'manual';
  $('manualNotice').hidden = !manual;
  $('rtcEnabled').disabled = manual || a.year === 2025;
  if (manual || a.year === 2025) $('rtcEnabled').checked = false;
  $('rtcFields').hidden = !$('rtcEnabled').checked;
  $('dispensedLabel').hidden = a.year !== 2026;
  $('legacyLabel').hidden = a.year !== 2026;
  const publicBuyer = $('buyer').value === 'public';
  $('publicLabel').hidden = $('publicHelp').hidden = !publicBuyer;
  const effective = $('effectiveRates').checked;
  $('ibs').disabled = !effective && a.ibs !== null;
  $('cbs').disabled = !effective && a.cbs !== null;
  $('reduction').disabled = effective;
  if (effective) $('reduction').value = '0';
  $('cbs').closest('label').firstChild.textContent = effective ? 'CBS final aplicável (%)' : 'CBS antes do ajuste transitório (%)';
  $('rateHelp').textContent = effective ? 'Usaremos exatamente as alíquotas finais informadas, sem descontar novamente 0,1 ponto percentual ou aplicar redução adicional.' : a.cbsAdjustment ? 'CBS efetiva = (alíquota informada − 0,1 ponto percentual) × (1 − redução). IBS efetivo = 0,1% × (1 − redução). Não há CBS estimada preenchida.' : 'Alíquotas fixas de teste vêm da lei; as demais devem ser informadas para o ano escolhido. Redução é aplicada proporcionalmente.';
  $('goalHelp').textContent = $('goal').value === 'after-tax' ? 'O alvo é o saldo após as retenções e todos os recolhimentos selecionados, incluindo a reserva de IBS/CBS.' : 'O alvo é o pagamento após retenções, sempre descontando a reserva de IBS/CBS. Outros tributos que o prestador recolherá depois ficam fora deste objetivo e são mostrados separadamente.';
  for (const [id] of TAXES) {
    const inactive = $(`mode_${id}`).value === 'none' || $(`mode_${id}`).disabled;
    $(`rate_${id}`).disabled = $(`base_${id}`).disabled = inactive;
    $(`extra_${id}`).hidden = inactive;
    $(`row_${id}`).classList.toggle('off', inactive);
  }
  $('capLabel').hidden = $('mode_inss').value !== 'pf';
  $('irFlat').hidden = $('irMode').value !== 'flat';
  $('irMonthly').hidden = $('irMode').value !== 'monthly';
  $('otherDeductions').disabled = $('deductionMode').value === 'simplified';
  for (const id of ['unconditional', 'conditional', 'other']) $(`value_${id}`).max = $(`type_${id}`).value === 'percent' ? '99.99' : '100000000';
}
function config() {
  const a = Calc.calendar(n('year'));
  const discount = id => ({ type: $(`type_${id}`).value, value: n(`value_${id}`) });
  return { year: a.year, target: n('target'), goal: $('goal').value, regime: $('regime').value, buyer: $('buyer').value,
    taxes: Object.fromEntries(TAXES.map(([id]) => [id, { mode: $(`mode_${id}`).value,
      rate: n(`rate_${id}`), base: id === 'custom' ? $('basis_custom').value : 'service',
      basePercent: n(`base_${id}`), remainingCap: id === 'inss' ? n('remainingCap') : 0 }])),
    unconditional: discount('unconditional'), conditional: discount('conditional'), other: discount('other'),
    rtcEnabled: $('rtcEnabled').checked, ibs: n('ibs'), cbs: n('cbs'), reduction: n('reduction'),
    effectiveRates: $('effectiveRates').checked, rtcCollection: $('rtcCollection').value,
    dispensed2026: $('dispensed2026').checked, publicConfirmed: $('publicConfirmed').checked,
    excludedLegacy: a.legacy ? n('excludedLegacy') : 0,
    ir: { mode: $('irMode').value, rate: n('irRate'), deduction: n('irDeduction'), basePercent: n('irBasePercent'),
      otherIncome: n('otherIncome'), previousTax: n('previousTax'), otherDeductions: n('otherDeductions'),
      deductionMode: $('deductionMode').value, confirmed: $('irConfirmed').checked } };
}
function render(c, r) {
  const card = (title, value, note, highlight = false) => `<div class="result-card ${highlight ? 'highlight' : ''}"><span>${title}</span><strong>${money(value)}</strong><p>${note}</p></div>`;
  $('serviceResult').textContent = money(r.service);
  $('resultSubtitle').textContent = `Competência ${c.year} · valores arredondados por rubrica`;
  $('resultCards').innerHTML = card('Total cobrado do tomador', r.total, 'Após descontos, com IBS/CBS a recolher.') +
    card('Depósito ao prestador', r.payment, 'Após retenções e segregação no pagamento.') +
    card('Reserva para recolhimentos', r.toReserve, 'Tributos recebidos que o prestador ainda recolherá.') +
    card('Saldo após tributos incluídos', r.afterTax, 'Depois de reservar os recolhimentos selecionados.', c.goal === 'after-tax') +
    card('Líquido do objetivo escolhido', r.net, c.goal === 'payment' ? 'Após retenções e reserva de IBS/CBS.' : 'Após todos os tributos considerados.', true) +
    card('IBS/CBS acrescidos ao preço', r.rtc, c.year === 2026 && c.dispensed2026 ? 'Destaques informativos não foram cobrados.' : 'O tributo por fora não é renda do prestador.');
  $('resultRows').innerHTML = r.rows.map(row => `<tr><td>${NAMES[row.id]}<br><span class="help">${percent(row.rate)}</span></td><td>${money(row.base)}</td><td>${money(row.value)}</td><td>${TREATMENTS[row.treatment]}</td></tr>`).join('') || '<tr><td colspan="4">Nenhum tributo incluído.</td></tr>';
  const exact = r.delta === 0 ? 'O líquido do objetivo confere em centavos.' : `O líquido ficou ${money(r.delta / 100)} acima do alvo devido ao arredondamento das rubricas.`;
  $('reconciliation').textContent = `Serviço ${money(r.service)} − desconto incondicional ${money(r.unconditional)} − desconto condicional ${money(r.conditional)} − outro desconto ${money(r.other)} + IBS/CBS ${money(r.rtc)} = total ${money(r.total)}. Total − retenções ${money(r.retained)} − segregação ${money(r.separated)} = depósito ${money(r.payment)}. Depósito − reserva ${money(r.toReserve)} = saldo ${money(r.afterTax)}. Base IBS/CBS: ${money(r.rtcBase)}. ${exact}`;
  $('result').hidden = false;
  $('emptyResult').hidden = true;
  lastResult = { c, r };
}
function calculate(event) {
  event.preventDefault();
  invalidate();
  try { const c = config(); render(c, Calc.solve(c)); }
  catch (error) { $('error').textContent = error.message; $('error').hidden = false; $('error').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}
function memoryText() {
  const { c, r } = lastResult;
  return [`Calculadora Reversa NFS-e — competência ${c.year}`, `Objetivo: ${$('goal').selectedOptions[0].textContent}`, `Regime: ${$('regime').selectedOptions[0].textContent}; tomador: ${$('buyer').selectedOptions[0].textContent}`, `Líquido desejado: ${money(c.target)}`, `Valor do serviço: ${money(r.service)}`, `Total cobrado: ${money(r.total)}`, `Depósito: ${money(r.payment)}`, `Reserva: ${money(r.toReserve)}`, `Saldo após tributos: ${money(r.afterTax)}`, ...r.rows.map(row => `${NAMES[row.id]}: base ${money(row.base)}, alíquota ${percent(row.rate)}, valor ${money(row.value)} (${TREATMENTS[row.treatment]})`), $('reconciliation').textContent, 'Regras revisadas em 05/10/2026. Confirme enquadramento e alíquotas antes de emitir a NFS-e.'].join('\n');
}
mount();
$('shareResult').hidden = !nativeBridge;
$('calculator').addEventListener('submit', calculate);
$('calculator').addEventListener('input', invalidate);
$('calculator').addEventListener('change', event => {
  if (event.target.id === 'year') syncYear();
  if (event.target.id === 'regime' && $('regime').value === 'manual') {
    for (const id of ['iss', 'pis', 'cofins', 'csll']) $(`mode_${id}`).value = 'none';
    $('mode_custom').value = 'own';
    $('rate_custom').value = '';
  }
  sync(); invalidate();
});
$('printResult').addEventListener('click', async () => {
  if (!lastResult) return;
  if (!nativeBridge) {
    if (navigator.userAgent.includes('CalcAndroid/')) $('copyStatus').textContent = 'Atualize o Android System WebView para usar impressão/PDF.';
    else window.print();
    return;
  }
  try { await nativeRequest('print'); $('copyStatus').textContent = 'Selecione uma impressora ou Salvar como PDF no Android.'; }
  catch (error) { $('copyStatus').textContent = error.message; }
});
$('shareResult').addEventListener('click', async () => {
  if (!lastResult || !nativeBridge) return;
  try { await nativeRequest('share', memoryText()); $('copyStatus').textContent = 'Escolha o aplicativo de destino para compartilhar a memória.'; }
  catch (error) { $('copyStatus').textContent = error.message; }
});
$('copyResult').addEventListener('click', async () => {
  if (!lastResult) return;
  try {
    if (nativeBridge) await nativeRequest('copy', memoryText());
    else if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(memoryText());
    else {
      const area = document.createElement('textarea'); area.value = memoryText(); document.body.append(area); area.select();
      const ok = document.execCommand('copy'); area.remove(); if (!ok) throw new Error('Clipboard unavailable');
    }
    $('copyStatus').textContent = 'Memória copiada.';
  } catch { $('copyStatus').textContent = 'A cópia foi bloqueada pelo navegador. Use Imprimir para salvar a memória em PDF.'; }
});
