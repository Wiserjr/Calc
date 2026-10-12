# Calculadora IBS CBS — Android e Web 2.1.0

Primeira versão Android da calculadora reversa NFS-e: calcule quanto cobrar para preservar o líquido do prestador, com as regras e correções de IBS/CBS preparadas para 2027.

## Downloads

- **Calc-IBS-CBS-2.1.0-android.apk**: instalador Android release assinado, universal, para Android 8.0 ou superior.
- **calc.html**: aplicação web independente, com todos os recursos incorporados.
- **SHA256SUMS.txt**: hashes dos arquivos distribuídos.

No celular, baixe e abra o APK. Se solicitado, permita a instalação por esse navegador ou gerenciador de arquivos. Não há necessidade de conta ou conexão para os cálculos. Esta distribuição é pelo GitHub, sem publicação na Google Play.

## Alterações

- Projeto Android no repositório, com conteúdo local e sem permissão de internet.
- Mesmo motor e mesmo HTML da versão web, sincronizados automaticamente na compilação.
- Copiar memória pelo clipboard do Android, compartilhar por aplicativo escolhido pelo usuário e imprimir/Salvar como PDF pelo sistema.
- Ícone próprio, tratamento das barras do sistema e interface responsiva.
- Assinatura de release dedicada, mantida fora do repositório para futuras atualizações.
- Compilação, lint e verificações automatizadas no GitHub Actions.

Inclui as correções da versão 2.0.0: separação entre preço, total cobrado, depósito, reserva e saldo líquido; ISS excluído da base IBS/CBS; ajuste da CBS 2027–2028; descontos e retenções corrigidos; IRPF mensal com parâmetros de 2026 e INSS PF com base disponível. A data da revisão fiscal permanece 05/10/2026, sem presumir alíquota CBS ou teto INSS novo para 2027.

## Verificação

- 19 testes do motor aprovados, incluindo 100 cenários de conferência em centavos.
- 8 testes instrumentados aprovados no APK release instalado em emulador Android 16/API 36.1: funcionamento local, segurança, CBS ausente, exemplo original, IBS/CBS e segregação, cópia nativa, transição 2026 e parâmetros 2027, compras públicas e abertura da impressão.
- Compilação e lint de release aprovados, sem erros de lint.
- Integridade ZIP, assinatura, pacote, versão e HTML incorporado conferidos.

Não houve teste em celular físico, envio por aplicativo de compartilhamento ou gravação final de um PDF pelo seletor do sistema. O teste de impressão confirma a abertura da interface nativa. O aplicativo não substitui enquadramento ou apuração fiscal completa.

Detalhes em `docs/ANDROID.md`, `docs/VALIDACAO-ANDROID.md` e `docs/REGRAS-2027.md`.
