# Calculadora Reversa NFS-e — IBS/CBS 2027

Nova interface e motor de cálculo para preservar o líquido do prestador durante a transição tributária.

Baixe **calc.html** e abra no navegador. O arquivo contém todo o aplicativo, sem instalação e sem dependências externas.

## Alterações

- Calendário 2025–2033, ISS integral em 2027–2028 e redução gradual de 2029 a 2032.
- IBS total 0,1% em 2027–2028 e ajuste transitório CBS de menos 0,1 ponto percentual, proporcional às reduções cabíveis.
- Alíquota de referência CBS obrigatória e sem estimativa preenchida.
- Exclusão do ISS incidente da base IBS/CBS, com PIS/COFINS de 2026 informado separadamente.
- Preço do serviço, total cobrado, depósito, retenções, reserva e saldo após tributos apresentados separadamente.
- Cenários de recebimento pelo prestador ou segregação no pagamento, sem dupla subtração de IBS/CBS.
- Correção de descontos, IRPF mensal 2026 com redução e INSS PF com base mensal restante.
- Parâmetros futuros sujeitos à confirmação, compras públicas com alíquotas finais e composição manual para Simples/MEI.
- Memória copiável, impressão e layout móvel.

## Validação

19 testes aprovados, incluindo 100 cenários de reconciliação em centavos. Exemplo original reproduzido no navegador: R$ 1.200,00 líquidos, ISS retido 5%, serviço R$ 1.263,16 e ISS R$ 63,16. Conferência visual em computador e celular. O HTML foi verificado por servidor local; abertura direta file://, clipboard e diálogo de impressão não foram testados visualmente.

Fontes legais e limitações em `docs/REGRAS-2027.md` e evidências em `docs/VALIDACAO.md`. A calculadora forma preço dos itens selecionados; não substitui enquadramento ou apuração fiscal completa. Créditos IBS/CBS, IRPJ e anexos do Simples não são calculados automaticamente.
