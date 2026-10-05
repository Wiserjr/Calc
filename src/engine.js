/* Motor sem DOM ou dependências. Valores em reais; arredondamento por rubrica. */
(function (root) {
  'use strict';
  const round = value => Math.round((value + Number.EPSILON * Math.max(1, Math.abs(value)) * 8) * 100) / 100;
  const ISS_FACTORS = { 2025: 1, 2026: 1, 2027: 1, 2028: 1, 2029: .9, 2030: .8, 2031: .7, 2032: .6, 2033: 0 };
  function calendar(year) {
    if (!Object.hasOwn(ISS_FACTORS, year)) throw new Error('Selecione um ano entre 2025 e 2033.');
    return { year, issFactor: ISS_FACTORS[year], legacy: year <= 2026,
      ibs: year === 2025 ? 0 : year <= 2028 ? .1 : null,
      cbs: year === 2025 ? 0 : year === 2026 ? .9 : null,
      cbsAdjustment: year === 2027 || year === 2028 ? .1 : 0 };
  }
  function number(value, label, max = 1e9) {
    if (value === '' || value === null || value === undefined || typeof value !== 'number' ||
        !Number.isFinite(value) || value < 0 || value > max) throw new Error(`${label}: informe um valor válido entre 0 e ${max}.`);
    return value;
  }
  function validate(c) {
    const a = calendar(c.year);
    number(c.target, 'Líquido desejado', 1e8);
    if (c.target <= 0 || round(c.target) !== c.target) throw new Error('Informe o líquido positivo com até duas casas decimais.');
    if (!['payment', 'after-tax'].includes(c.goal)) throw new Error('Objetivo de líquido inválido.');
    if (!['regular', 'manual'].includes(c.regime)) throw new Error('Regime inválido.');
    if (!['private', 'public'].includes(c.buyer)) throw new Error('Tomador inválido.');
    for (const d of [c.unconditional, c.conditional, c.other]) {
      if (!d || !['fixed', 'percent'].includes(d.type)) throw new Error('Tipo de desconto inválido.');
      number(d.value, 'Desconto', d.type === 'percent' ? 99.99 : 1e8);
    }
    for (const [id, t] of Object.entries(c.taxes)) {
      if (!['none', 'retained', 'own', 'pf'].includes(t.mode)) throw new Error(`${id}: tratamento inválido.`);
      if (!['service', 'rtc'].includes(t.base)) throw new Error(`${id}: base inválida.`);
      if (t.mode !== 'none') {
        number(t.rate, `Alíquota de ${id}`, 99.99);
        number(t.basePercent, `Percentual da base de ${id}`, 100);
        if (t.mode === 'pf') {
          if (id !== 'inss') throw new Error('Limite de pessoa física só se aplica ao INSS.');
          number(t.remainingCap, 'Base mensal disponível do INSS');
        }
      }
      if (['pis', 'cofins'].includes(id) && !a.legacy && t.mode !== 'none') throw new Error('PIS e COFINS não se aplicam a partir de 2027 neste modelo.');
      if (id === 'iss' && a.issFactor === 0 && t.mode !== 'none') throw new Error('ISS extinto em 2033.');
    }
    number(c.excludedLegacy, 'PIS/COFINS incidentes excluídos da base', 100);
    if (!a.legacy && c.excludedLegacy !== 0) throw new Error('Não exclua PIS/COFINS da base a partir de 2027.');
    number(c.reduction, 'Redução do IBS/CBS', 100);
    if (c.rtcEnabled) {
      if (c.year === 2025) throw new Error('IBS/CBS não se aplicam em 2025.');
      if (c.regime === 'manual') throw new Error('Para IBS/CBS fora do DAS, selecione regime regular.');
      if (!['supplier', 'separated'].includes(c.rtcCollection)) throw new Error('Recolhimento do IBS/CBS inválido.');
      for (const id of ['ibs', 'cbs']) {
        const fixed = a[id];
        if (c.effectiveRates || fixed === null) number(c[id], `Alíquota de ${id.toUpperCase()}`, 99.99);
      }
      if (c.effectiveRates && c.reduction !== 0) throw new Error('Alíquotas finais já incluem reduções: use redução adicional zero.');
      if (!c.effectiveRates && a.cbsAdjustment && c.cbs < a.cbsAdjustment) throw new Error('A CBS antes do ajuste deve ser pelo menos 0,1%.');
      if (c.buyer === 'public' && (!c.effectiveRates || !c.publicConfirmed)) throw new Error('Compras públicas: informe e confirme as alíquotas finais aplicáveis, com redutor e destinação verificados.');
    }
    if (!['none', 'flat', 'monthly'].includes(c.ir.mode)) throw new Error('Modo do IR inválido.');
    if (c.ir.mode === 'flat') {
      number(c.ir.rate, 'Alíquota do IR', 99.99);
      number(c.ir.deduction, 'Parcela a deduzir do IR');
      number(c.ir.basePercent, 'Percentual da base de IR', 100);
    }
    if (c.ir.mode === 'monthly') {
      if (c.year < 2026 || !c.ir.confirmed) throw new Error('IRPF: confirme a aplicação dos parâmetros mensais de 2026 à competência escolhida.');
      for (const key of ['otherIncome', 'previousTax', 'otherDeductions']) number(c.ir[key], 'Parâmetro mensal do IRPF');
      if (!['legal', 'simplified'].includes(c.ir.deductionMode)) throw new Error('Dedução de IRPF inválida.');
    }
    // Uma margem positiva garante inversão crescente antes do arredondamento.
    let burden = 0;
    for (const [id, t] of Object.entries(c.taxes)) {
      if (t.mode === 'none' || (t.mode === 'own' && c.goal === 'payment')) continue;
      burden += t.rate / 100 * t.basePercent / 100 * (id === 'iss' ? a.issFactor : 1);
    }
    if (c.ir.mode === 'flat') burden += c.ir.rate / 100 * c.ir.basePercent / 100;
    if (c.ir.mode === 'monthly') burden += .275 + .133145;
    const inc = c.unconditional.type === 'percent' ? c.unconditional.value / 100 : 0;
    const cond = [c.conditional, c.other].reduce((n, d) => n + (d.type === 'percent' ? d.value / 100 : 0), 0);
    if ((1 - inc) * (1 - burden) - cond <= 0) throw new Error('Descontos e tributos consomem a margem. Reduza os percentuais para calcular com segurança.');
    return a;
  }
  function monthlyIR(income, deductions) {
    const base = Math.max(0, income - deductions);
    const tiers = [[2428.80, 0, 0], [2826.65, .075, 182.16], [3751.05, .15, 394.16], [4664.68, .225, 675.49], [Infinity, .275, 908.73]];
    const [, rate, deduction] = tiers.find(t => base <= t[0]);
    const tax = Math.max(0, base * rate - deduction);
    const reduction = income <= 5000 ? Math.min(tax, 312.89) : income <= 7350 ? Math.max(0, 978.62 - .133145 * income) : 0;
    return tax - reduction < 1e-9 ? 0 : tax - reduction;
  }
  function forward(service, c, rounded = true) {
    const a = calendar(c.year);
    const money = rounded ? round : v => v;
    const discount = d => money(d.type === 'percent' ? service * d.value / 100 : d.value);
    const unconditional = discount(c.unconditional);
    const base = money(Math.max(0, service - unconditional));
    const conditional = discount(c.conditional), other = discount(c.other);
    let retained = 0, own = 0;
    const rows = [];
    const taxBase = t => money(base * t.basePercent / 100);
    const issConfig = c.taxes.iss;
    const iss = issConfig && issConfig.mode !== 'none' ? money(taxBase(issConfig) * issConfig.rate / 100 * a.issFactor) : 0;
    const legacyExclusion = a.legacy ? money(base * c.excludedLegacy / 100) : 0;
    // LC 214, art. 12, §2º: ISS e tributos legados incidentes, não retenções de renda.
    const rtcBase = money(Math.max(0, base - iss - legacyExclusion));
    let inss = 0;
    for (const [id, t] of Object.entries(c.taxes)) {
      if (t.mode === 'none') continue;
      let b = t.base === 'rtc' ? money(rtcBase * t.basePercent / 100) : taxBase(t);
      if (t.mode === 'pf') b = Math.min(b, t.remainingCap);
      const value = id === 'iss' ? iss : money(b * t.rate / 100);
      if (id === 'inss') inss = value;
      if (t.mode === 'own') own = money(own + value); else retained = money(retained + value);
      rows.push({ id, base: b, rate: t.rate * (id === 'iss' ? a.issFactor : 1), value, treatment: t.mode });
    }
    let ir = 0;
    if (c.ir.mode === 'flat') ir = money(Math.max(0, base * c.ir.basePercent / 100 * c.ir.rate / 100 - c.ir.deduction));
    if (c.ir.mode === 'monthly') {
      const income = money(base + c.ir.otherIncome);
      const deductions = c.ir.deductionMode === 'simplified' ? 607.20 : money(inss + c.ir.otherDeductions);
      ir = money(Math.max(0, monthlyIR(income, deductions) - c.ir.previousTax));
    }
    if (c.ir.mode !== 'none') {
      retained = money(retained + ir);
      rows.push({ id: 'ir', base, value: ir, treatment: 'retained', rate: base ? ir / base * 100 : 0 });
    }
    let ibs = 0, cbs = 0, ibsRate = 0, cbsRate = 0;
    if (c.rtcEnabled) {
      const factor = 1 - c.reduction / 100;
      ibsRate = c.effectiveRates ? c.ibs : (a.ibs ?? c.ibs) * factor;
      cbsRate = c.effectiveRates ? c.cbs : Math.max(0, (a.cbs ?? c.cbs) - a.cbsAdjustment) * factor;
      ibs = money(rtcBase * ibsRate / 100);
      cbs = money(rtcBase * cbsRate / 100);
    }
    const dispensed = c.year === 2026 && c.dispensed2026;
    const rtc = dispensed ? 0 : money(ibs + cbs);
    const separated = c.rtcCollection === 'separated' ? rtc : 0;
    const rtcOwn = money(rtc - separated);
    if (c.rtcEnabled) {
      rows.push({ id: 'ibs', base: rtcBase, rate: ibsRate, value: ibs, treatment: dispensed ? 'informative' : c.rtcCollection });
      rows.push({ id: 'cbs', base: rtcBase, rate: cbsRate, value: cbs, treatment: dispensed ? 'informative' : c.rtcCollection });
    }
    const total = money(base - conditional - other + rtc);
    const payment = money(total - retained - separated);
    const toReserve = money(own + rtcOwn);
    const afterTax = money(payment - toReserve);
    // O líquido no pagamento exclui o IBS/CBS a repassar: a reserva é explícita.
    const paymentAvailable = money(payment - rtcOwn);
    return { service, unconditional, conditional, other, base, rtcBase, iss, ibs, cbs, rtc,
      retained, own, separated, rtcOwn, total, payment, paymentAvailable, toReserve, afterTax, rows,
      net: c.goal === 'after-tax' ? afterTax : paymentAvailable };
  }
  function solve(c) {
    validate(c);
    const maximum = 1e9;
    let low = 0, high = Math.max(100, c.target * 2);
    while (high < maximum && forward(high, c, false).net < c.target) high = Math.min(maximum, high * 2);
    if (forward(high, c, false).net < c.target) throw new Error('O líquido exige um preço acima do limite de R$ 1 bilhão. Confira os parâmetros.');
    for (let i = 0; i < 80; i++) {
      const mid = (low + high) / 2;
      if (forward(mid, c, false).net < c.target) low = mid; else high = mid;
    }
    const center = Math.round(high * 100);
    // Várias rubricas arredondadas criam degraus de centavos. Busca local evita
    // supor monotonicidade estrita e prioriza um preço com líquido exato.
    let best = null;
    for (let cents = Math.max(0, center - 500); cents <= Math.min(maximum * 100, center + 500); cents++) {
      const r = forward(cents / 100, c);
      if (r.base < r.conditional + r.other || r.net < c.target || r.payment < 0) continue;
      const delta = Math.round((r.net - c.target) * 100);
      if (!best || delta < best.delta) best = { ...r, delta };
      if (delta === 0) break;
    }
    if (!best) throw new Error('Não foi possível fechar o líquido em centavos. Revise a margem e os descontos.');
    return best;
  }
  const api = { calendar, validate, round, monthlyIR, forward, solve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
