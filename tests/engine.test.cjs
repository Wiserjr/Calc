'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calendar, forward, solve, monthlyIR, validate } = require('../src/engine.js');
function fixture(patch = {}) {
  const tax = (rate, mode = 'none') => ({ rate, mode, basePercent: 100, base: 'service', remainingCap: 8475.55 });
  return { year: 2027, target: 1200, goal: 'after-tax', regime: 'regular', buyer: 'private',
    taxes: { iss: tax(5, 'retained'), pis: tax(.65), cofins: tax(3), csll: tax(1), inss: tax(11), custom: tax(0) },
    unconditional: { type: 'fixed', value: 0 }, conditional: { type: 'fixed', value: 0 }, other: { type: 'fixed', value: 0 },
    rtcEnabled: true, cbs: 10, ibs: .1, reduction: 0, effectiveRates: false, rtcCollection: 'supplier',
    dispensed2026: true, excludedLegacy: 0, publicConfirmed: false,
    ir: { mode: 'none', rate: 1.5, basePercent: 100, deduction: 0, otherIncome: 0, previousTax: 0, otherDeductions: 0, deductionMode: 'legal', confirmed: false }, ...patch };
}
test('Exemplo original: 1200 líquidos e ISS retido 5%', () => {
  const r = solve(fixture({ rtcEnabled: false }));
  assert.equal(r.service, 1263.16); assert.equal(r.retained, 63.16); assert.equal(r.net, 1200);
});
test('2027 exclui ISS, aplica CBS menos 0,1 p.p. e soma os tributos por fora', () => {
  const r = forward(1000, fixture());
  assert.equal(r.iss, 50); assert.equal(r.rtcBase, 950);
  assert.equal(r.ibs, .95); assert.equal(r.cbs, 94.05);
  assert.equal(r.total, 1095); assert.equal(r.payment, 1045);
  assert.equal(r.toReserve, 95); assert.equal(r.afterTax, 950);
});
test('Caso de referência oficial (ALIQUOTA_REFERENCIA, calculadora-rtc-regime-regular): CBS 8,50%→8,40% e IBS 0,10% em 2027 e 2028', () => {
  for (const year of [2027, 2028]) {
    const r = forward(1000, fixture({ year, cbs: 8.5 }));
    assert.equal(r.ibs, .95); assert.equal(r.cbs, 79.8);
    assert.equal(r.rtc, 80.75); assert.equal(r.total, 1080.75);
    assert.equal(r.payment, 1030.75); assert.equal(r.toReserve, 80.75); assert.equal(r.afterTax, 950);
  }
});
test('Segregação altera caixa e reserva, mantendo o preço e saldo', () => {
  const supplier = solve(fixture()); const separated = solve(fixture({ rtcCollection: 'separated' }));
  assert.equal(supplier.service, separated.service); assert.equal(supplier.total, separated.total);
  assert.equal(supplier.afterTax, separated.afterTax); assert.equal(separated.toReserve, 0);
  assert.equal(separated.payment, separated.afterTax);
});
test('ISS recolhido depois é recomposto apenas no objetivo após tributos', () => {
  const c = fixture({ rtcEnabled: false }); c.taxes.iss.mode = 'own';
  const after = solve(c), payment = solve({ ...c, goal: 'payment' });
  assert.equal(after.service, 1263.16); assert.equal(after.afterTax, 1200);
  assert.equal(payment.service, 1200); assert.equal(payment.payment, 1200); assert.equal(payment.afterTax, 1140);
});
test('IBS/CBS próprios são sempre reservados no líquido do objetivo', () => {
  const c = fixture({ goal: 'payment' });
  const r = solve(c); assert.equal(r.net, 1200); assert.equal(r.payment - r.rtcOwn, 1200);
});
test('2026 dispensa não adiciona tributo informativo ao pagamento', () => {
  const r = forward(1000, fixture({ year: 2026 }));
  assert.equal(r.ibs, .95); assert.equal(r.cbs, 8.55); assert.equal(r.rtc, 0); assert.equal(r.total, 1000);
  const payable = forward(1000, fixture({ year: 2026, dispensed2026: false }));
  assert.equal(payable.rtc, 9.5); assert.equal(payable.total, 1009.5);
});
test('Exclusão de PIS/COFINS incidente não usa automaticamente retenções', () => {
  const c = fixture({ year: 2026, excludedLegacy: 9.25 }); c.taxes.pis.mode = 'retained';
  const r = forward(1000, c); assert.equal(r.rtcBase, 857.5); assert.equal(r.retained, 56.5);
});
test('Reduções de 30% e 60% proporcionais ao ajuste CBS', () => {
  const c = fixture({ reduction: 30 });
  const r = forward(1000, c); assert.equal(r.cbs, 65.84); assert.equal(r.ibs, .67);
  const sixty = forward(1000, { ...c, reduction: 60 }); assert.equal(sixty.cbs, 37.62); assert.equal(sixty.ibs, .38);
});
test('Alíquotas finais não recebem ajuste duas vezes', () => {
  const r = forward(1000, fixture({ effectiveRates: true, cbs: 9.9 })); assert.equal(r.cbs, 94.05);
  assert.throws(() => validate(fixture({ effectiveRates: true, reduction: 30 })), /reduções/);
});
test('Compras públicas exigem parâmetros finais e confirmação', () => {
  assert.throws(() => solve(fixture({ buyer: 'public' })), /Compras públicas/);
  const r = solve(fixture({ buyer: 'public', effectiveRates: true, publicConfirmed: true })); assert.equal(r.net, 1200);
});
test('INSS PF limitado à base restante; PJ sem teto', () => {
  const c = fixture({ rtcEnabled: false }); c.taxes.inss.mode = 'pf'; c.taxes.inss.remainingCap = 2000;
  const pf = forward(10000, c); assert.equal(pf.rows.find(t => t.id === 'inss').value, 220);
  c.taxes.inss.mode = 'retained'; assert.equal(forward(10000, c).rows.find(t => t.id === 'inss').value, 1100);
  c.taxes.inss.mode = 'pf'; c.taxes.inss.remainingCap = null; assert.throws(() => solve(c), /INSS/);
});
test('IRPF 2026: faixa efetiva, redução e renda distinta da base', () => {
  assert.equal(monthlyIR(5000, 607.20), 0);
  assert.equal(Math.round(monthlyIR(6000, 607.20) * 100) / 100, 394.54);
  assert.equal(Math.round(monthlyIR(7350, 607.20) * 100) / 100, 945.54);
  assert.equal(Math.round(monthlyIR(8000, 607.20) * 100) / 100, 1124.29);
});
test('IRPF considera renda e retenções anteriores da mesma fonte', () => {
  const c = fixture({ rtcEnabled: false }); c.taxes.iss.mode = 'none';
  c.ir = { ...c.ir, mode: 'monthly', confirmed: true, deductionMode: 'simplified', otherIncome: 4000, previousTax: 0 };
  const r = forward(2000, c); assert.equal(r.retained, 394.54);
  c.ir.previousTax = 100; assert.equal(forward(2000, c).retained, 294.54);
  c.ir.confirmed = false; assert.throws(() => solve(c), /IRPF/);
});
test('Desconto incondicional reduz base; condicional não reduz base', () => {
  const c = fixture({ unconditional: { type: 'fixed', value: 100 }, conditional: { type: 'fixed', value: 50 } });
  const r = forward(1000, c); assert.equal(r.base, 900); assert.equal(r.rtcBase, 855); assert.equal(r.afterTax, 805);
  assert.equal(solve(c).net, 1200);
});
test('Descontos percentuais e ajuste em centavos', () => {
  const c = fixture({ unconditional: { type: 'percent', value: 10 }, conditional: { type: 'percent', value: 5 }, other: { type: 'fixed', value: 7.33 } });
  assert.equal(solve(c).net, 1200);
});
test('Calendário 2029–2033 usa frações corretas do ISS', () => {
  for (const [year, factor] of [[2029, .9], [2030, .8], [2031, .7], [2032, .6], [2033, 0]]) assert.equal(calendar(year).issFactor, factor);
  const c = fixture({ year: 2033, ibs: 15 }); c.taxes.iss.mode = 'none'; assert.equal(solve(c).net, 1200);
});
test('Valores inválidos, alíquotas ausentes e margem impossível são bloqueados', () => {
  for (const target of [0, -1, NaN, Infinity, 1.001]) assert.throws(() => solve(fixture({ target })));
  assert.throws(() => solve(fixture({ cbs: null })), /CBS/);
  const c = fixture(); c.taxes.iss.rate = 90; c.taxes.csll.mode = 'retained'; c.taxes.csll.rate = 20;
  assert.throws(() => solve(c), /margem/);
  const gap = fixture(); gap.taxes.pis.mode = 'retained'; assert.throws(() => solve(gap), /PIS/);
});
test('Simples manual não aplica IBS/CBS regular nem soma ISS dentro do DAS', () => {
  const c = fixture({ regime: 'manual', rtcEnabled: false }); c.taxes.iss.mode = 'none'; c.taxes.custom.mode = 'own'; c.taxes.custom.rate = 6;
  const r = solve(c); assert.equal(r.service, 1276.60); assert.equal(r.afterTax, 1200);
  assert.throws(() => solve({ ...c, rtcEnabled: true }), /DAS/);
});
test('100 cenários: reconciliação de pagamento e saldo em centavos', () => {
  for (let i = 1; i <= 100; i++) {
    const c = fixture({ target: 100 + i * 37.19, rtcCollection: i % 2 ? 'supplier' : 'separated' });
    c.target = Math.round(c.target * 100) / 100;
    c.taxes.iss.mode = i % 3 ? 'retained' : 'own'; c.taxes.csll.mode = 'retained';
    c.conditional.value = i * .13;
    const r = solve(c);
    assert.equal(r.net, c.target);
    assert.equal(Math.round((r.total - r.retained - r.separated) * 100), Math.round(r.payment * 100));
    assert.equal(Math.round((r.payment - r.toReserve) * 100), Math.round(r.afterTax * 100));
  }
});
