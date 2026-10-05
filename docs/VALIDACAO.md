# Validação da versão 2.0.0

Realizada em 05/10/2026.

- `npm run check`: sintaxe dos scripts, 19 testes de cálculo e correspondência dos HTMLs com as fontes. Todos aprovados.
- Um dos testes percorre 100 combinações de valores, retenções, recolhimentos próprios, descontos e segregação, conferindo pagamento e saldo em centavos.
- Exemplo original no navegador: alvo R$ 1.200,00, ISS retido de 5%, IBS/CBS desligados → serviço R$ 1.263,16, ISS R$ 63,16, líquido R$ 1.200,00.
- CBS vazia bloqueia o cálculo em 2027 quando IBS/CBS estão ativos.
- Exemplo **hipotético**, sem afirmar alíquota oficial: CBS antes do ajuste 10% em 2027 → serviço R$ 1.263,16, base IBS/CBS R$ 1.200,00, IBS R$ 1,20, CBS R$ 118,80, total R$ 1.383,16. Prestador recebe: depósito R$ 1.320,00 e reserva R$ 120,00. Segregado: depósito R$ 1.200,00 e reserva zero. Saldo final R$ 1.200,00 em ambos os cenários.
- Resultado desaparece ao mudar um parâmetro, exigindo novo cálculo.
- Mudança para 2026 restaura as alíquotas legais de teste. Com dispensa selecionada, os destaques ficam informativos e não são somados ao preço.
- Conferência visual de layout em computador e celular. Em largura de 390 px, área útil de 375 px e largura do documento de 375 px, sem transbordamento horizontal. O mesmo exemplo original fecha em centavos no celular.
- Nenhum aviso ou erro de JavaScript observado no console durante esses fluxos.
- `git diff --check`: sem erros de espaços; apenas aviso da configuração local Git sobre conversão futura LF/CRLF.

## Evidências

[Tela de computador](images/calculadora-desktop.jpg) e [tela de celular](images/calculadora-mobile.jpg). As imagens mostram o exemplo com ISS, sem aplicar estimativa de CBS.

## Limites da verificação

A interface foi aberta por HTTP em servidor local. O navegador de automação bloqueou a navegação direta `file://`; essa abertura não foi verificada visualmente. Inspeção dos arquivos confirma CSS e JavaScript incorporados, sem fetch, módulos externos, fontes remotas ou servidor necessário ao cálculo. A impressão e a cópia da memória estão implementadas, mas o diálogo de impressão/PDF e o clipboard não foram verificados manualmente nesta rodada.

Não houve emissão de nota real nem integração com portais fiscais. Os parâmetros de enquadramento e de apuração continuam responsabilidade do operador conforme a operação. O conjunto de testes verifica o contrato financeiro e as regras explicitamente implementadas.
