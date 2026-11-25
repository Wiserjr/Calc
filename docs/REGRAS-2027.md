# Revisão fiscal e contrato do cálculo

Data de revisão: **5 de outubro de 2026**. Ano solicitado: **2027**.

## Fontes efetivamente consultadas

1. [LC 214/2025 compilada, Planalto](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214compilado.htm), texto com alterações da LC 227/2026. O conteúdo integral foi acessado diretamente; a ferramenta de navegação encontrou limite de tamanho, superado por leitura HTTP e extração dos artigos pertinentes. [Texto legislativo no Senado](https://legis.senado.leg.br/norma/40180341/publicacao/40181429) usado para cotejo dos dispositivos originais, sem substituir o compilado.
2. [EC 132/2023, Planalto](https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm), disposições da transição no ADCT.
3. [Receita Federal: entenda a reforma](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/entenda), explicação do calendário.
4. [Receita Federal: tributação de 2026](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026), tabela de incidência mensal, desconto simplificado e redução da Lei 15.270/2025.
5. [INSS: tabela de contribuição mensal](https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal), teto de R$ 8.475,55 desde janeiro de 2026.
6. [Decreto 12.955/2026 — regulamento da CBS, Senado](https://legis.senado.leg.br/norma/43106091/publicacao/43105497), localizado na pesquisa, especialmente arts. 439–443 e particularidades da transição de compras públicas. O app exige informação das alíquotas finais e não automatiza esse regime.
7. [ReceitaFederal/calculadora-rtc-regime-regular, GitHub](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular), commit `f1eebd7`, tabela `ALIQUOTA_REFERENCIA` da base `flyway/sql/criacao/B0001__sistema_tributario_completo.sql`. API oficial de cálculo da Receita Federal, licença MIT; usada apenas para conferir alíquotas de referência publicadas, sem acoplar o app a ela.
8. [ReceitaFederal/calculadora-rtc-simples-nacional, GitHub](https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional), commit `a926d5a`. API oficial do Simples Nacional da Receita Federal, licença MIT; usada apenas para verificar se existe tabela oficial de alíquota de IBS/CBS por anexo/faixa/fator R.

A tabela `ALIQUOTA_REFERENCIA` da fonte 7 confirma a alíquota padrão de CBS em 2027 e 2028 como **8,50% antes do ajuste de transição (8,40% líquido do ajuste de 0,1 p.p.)**, e o IBS total (estadual + municipal) em **0,10%** nesses dois anos — os mesmos números usados no caso de referência dos testes de regressão. Isso substitui a incerteza anterior sobre uma resolução com alíquota numérica CBS de referência 2027: a fonte 7 confirma o valor. A aplicação continua a exigir que o operador informe a CBS do ano manualmente; a confirmação apenas remove a incerteza sobre o número oficial, sem alterar o comportamento do app. Não se inventa o teto INSS de 2027 nem se apresenta a tabela IRPF 2026 como uma nova tabela de 2027.

A fonte 8 (código-fonte de `AliquotasEfetivasInput`/`ItemSimplesInput`) mostra que a própria API oficial do Simples Nacional **não calcula** `pIBSSN`/`pCBSSN` a partir de anexo, faixa de receita ou fator R: exige essas alíquotas efetivas como entrada, "a mesma linha que o PGDAS publica na Tabela de Alíquotas Efetivas do Simples Nacional". Não existe, portanto, tabela oficial de anexo/faixa → alíquota para automatizar aqui.

## Alterações necessárias identificadas na versão anterior

| Problema | Correção |
| --- | --- |
| CBS 8,8% e IBS 17,7% sugeridos em anos de referência | Removidos; alíquotas desconhecidas ficam em branco |
| CBS 2027 sem ajuste de 0,1 ponto percentual | Ajuste transitório proporcional antes da redução setorial |
| Mesma base para ISS e IBS/CBS | Exclusão do ISS incidente e PIS/COFINS informado, conforme art. 12, §2º |
| IBS/CBS “retidos” podiam reduzir o serviço como uma retenção ordinária | Por fora em ambos os cenários; segregação e reserva explícitas |
| “Líquido” ignorava ISS que seria recolhido depois | Objetivos distintos e saldo após recolhimentos |
| Destaque 2026 somado ao preço mesmo com dispensa | Informativo e sem cobrança, quando dispensa selecionada |
| Tabela IR com faixas 5.000/6.000/7.500/9.000 | Tabela mensal 2026 real e redução separada por rendimentos |
| Teto INSS 2025 transportado para todos os anos | Base mensal disponível obrigatória; teto 2026 só em 2026 |
| Campos de desconto lidos com nomes diferentes dos IDs | Configuração explícita dos três descontos |
| Troca de ano preservava alíquota de outra competência | Limpeza de IBS/CBS, confirmações e teto na troca de ano |
| Resultados exibidos após alteração de parâmetros | Invalidação imediata |
| Bisseção apenas em valores não arredondados | Inversão contínua seguida de conferência de rubricas em centavos |

## Bases e fluxo financeiro

`S` = preço do serviço antes dos descontos, incluindo ISS quando incidente, sem IBS/CBS.

`B = S − desconto incondicional`. A contribuição de cada retenção usa `B × percentual da base informado`, salvo teto de INSS PF. Se a operação exigir outra base, deduções ou dispensas, os parâmetros precisam ser adequados; o app não faz enquadramento automático.

`Base IBS/CBS = B − ISS incidente − PIS/COFINS incidentes informados em 2026`.

O desconto condicional reduz o pagamento e permanece nas bases do modelo. Os descontos aplicados são visíveis na reconciliação. CSLL/INSS/IR retidos não diminuem automaticamente a base IBS/CBS.

Em 2027–2028, para serviços comuns:

`IBS efetivo = 0,1% × (1 − redução)`.

`CBS efetiva = (CBS informada − 0,1 ponto percentual) × (1 − redução)`.

Com a opção de alíquotas finais, o motor utiliza os números digitados, sem segunda aplicação de ajuste ou redução. As reduções de 30% e 60% só são cabíveis mediante os requisitos dos arts. 127–130 e respectivos anexos; selecionar a opção não comprova elegibilidade.

`Total cobrado = B − desconto condicional − outro desconto + IBS/CBS a recolher`.

`Depósito = total cobrado − retenções ordinárias − IBS/CBS segregados`.

`Reserva = tributos que o prestador recolherá + IBS/CBS recebidos para repasse`.

`Saldo após tributos = depósito − reserva`.

No objetivo de pagamento, o motor ainda exclui IBS/CBS recebidos para repasse. Isso impede que o valor de um tributo destinado ao Fisco seja tratado como líquido disponível. O depósito real é apresentado em cartão próprio.

## Limitações deliberadas

- O modelo considera débitos brutos da operação, sem créditos IBS/CBS ou compensação na apuração. Não mede a carga efetiva global da empresa.
- Não aplica automaticamente retenções por natureza de serviço, tomador, dispensa de valor mínimo ou benefício fiscal municipal.
- PIS/COFINS a excluir em 2026 são informados separadamente das retenções. Não se presume regime cumulativo ou não cumulativo.
- IRPF considera apenas a renda do serviço e rendimentos adicionais da mesma fonte informados. Deduções legais devem incluir o que se aplica ao mês; o INSS desta operação é somado automaticamente. IR já retido pela fonte é subtraído do imposto mensal calculado. Não apura ajuste anual, tributação mínima ou demais fontes.
- A confirmação dos parâmetros 2026 é obrigatória para IRPF mensal em 2027 ou posteriores. Se houver alteração legal, deve-se atualizar o motor antes de usar esse modo, ou configurar a retenção validada externamente.
- Não calcula fator R, anexos, faixas ou receita bruta acumulada do Simples. A carga manual é um parâmetro externo — verificado contra a fonte 8: a própria API oficial do Simples Nacional também exige essas alíquotas efetivas como entrada do contribuinte (mesma Tabela de Alíquotas Efetivas do PGDAS), em vez de calculá-las a partir de anexo/faixa/fator R. A postura manual do app está alinhada com o sistema oficial, não é uma simplificação indevida.
- Compras públicas exigem alíquotas finais e confirmação da regra da operação. A segregação é uma hipótese financeira selecionada pelo operador, sem afirmar disponibilidade universal de split payment em 2027.
- Imóveis, serviços financeiros, combustíveis e demais regimes específicos não são automaticamente abrangidos pela fórmula geral dos serviços.

## Verificação

O conjunto de testes cobre o exemplo fornecido, base e ajuste 2027, reduções setoriais, dispensa de 2026, separação de caixa, ISS posterior, INSS PF/PJ, IRPF mensal, pagamentos anteriores, descontos, Simples manual, dados inválidos, 100 combinações de reconciliação em centavos e um caso de referência com as alíquotas oficiais da tabela `ALIQUOTA_REFERENCIA` (fonte 7): CBS 8,50%→8,40% e IBS 0,10% em 2027 e 2028. A interface é conferida no navegador e os arquivos entregues são gerados das mesmas fontes testadas.
