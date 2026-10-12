# Validação Android 2.1.0 — 12/10/2026

## Artefato distribuído

- Nome: `Calc-IBS-CBS-2.1.0-android.apk`
- Package: `br.com.wiserjr.calc`
- VersionName: `2.1.0`; versionCode: `21000`
- Min SDK 26 / target SDK 36
- Tamanho: 1.025.875 bytes
- Release assinado com certificado dedicado, não certificado debug
- Não solicita permissão INTERNET e não contém bibliotecas nativas de CPU

SHA-256 APK:

```text
1c7e4612152845117fe9044863833628b2bbb5cfcecefa715698b0cf0bc4f8a7
```

SHA-256 do HTML incorporado, idêntico ao `calc.html`:

```text
09638e331b524b86a4d97b861ff0424fa87f0a63981b5bafdc19edfb3a76faec
```

Certificado público SHA-256:

```text
23aaa46f55e02c171f822c8eadcba3ccc052adc1540131f754f271ddeedd1a6c
```

## Verificações

`npm run check`: 19 testes aprovados, incluindo 100 combinações de reconciliação em centavos. O motor tributário não foi alterado para gerar o Android.

`:app:assembleRelease :app:lintRelease`: compilação aprovada; lint sem erros. O relatório registrou 5 avisos sobre recursos/versões, sem falhas bloqueantes. `apksigner verify --verbose --print-certs`: assinatura v2 válida, um signatário, RSA 4096 bits. `aapt dump badging`: pacote, versão, SDKs e ausência de permissão INTERNET conferidos.

`scripts/verify-apk.py`: ZIP íntegro, `assets/index.html` byte a byte igual ao HTML web validado, nenhum asset extra ou arquivo de chave, nenhuma biblioteca `.so`. A chave e suas propriedades não são assets nem arquivos versionados.

## Testes no APK release instalado

Emulador isolado `Calc_API_36_1_Test`, Android 16/API 36.1, x86_64. Testes instrumentados compilados com `-PcalcTestBuildType=release`, assinados com o mesmo certificado. Resultado: **8 passed, 0 failed**.

1. Origem local, HTML carregado, ponte Android disponível, sem permissão INTERNET, acesso a arquivos e content URI desativado.
2. CBS ausente impede o cálculo em 2027.
3. Exemplo original: R$ 1.200 líquidos → serviço R$ 1.263,16 e ISS R$ 63,16. Sem transbordamento horizontal.
4. CBS **hipotética** 10% antes do ajuste, IBS 0,1% e ISS 5%: total R$ 1.383,16, depósito R$ 1.320,00 e reserva R$ 120,00. Segregação preserva líquido R$ 1.200,00, reduz depósito e zera a reserva de IBS/CBS. A troca de parâmetro invalida o resultado anterior.
5. Copiar memória: ponte nativa respondeu e o clipboard Android continha a memória correta.
6. Dispensa 2026: IBS/CBS informativos não acrescentados ao pagamento; volta a 2027 limpa CBS e teto INSS.
7. Compras públicas sem alíquotas finais/confirmadas são bloqueadas.
8. Imprimir/PDF abre a interface do Android Print Spooler. Nenhum erro JavaScript capturado no WebView.

A reinstalação por `adb install -r` do mesmo APK release foi aceita, sem desinstalar ou limpar dados. Não há aplicativo de outro projeto modificado para realizar esses testes.

Repetições posteriores apresentaram travamentos intermitentes do emulador (Print Spooler sem resposta, perda de foco e timeout do WebView). O registro de 8 testes aprovados corresponde à execução concluída; não significa que todas as repetições passaram. A estabilidade em aparelhos físicos permanece pendente.

## Limites

Não houve instalação em celular físico. Android 8 é a compatibilidade mínima declarada e verificada na compilação, mas a execução nesta rodada foi em Android 16. O teste de impressão confirma o diálogo nativo; não grava um PDF final pelo seletor de documentos. O compartilhamento foi implementado para seleção explícita pelo usuário, sem realizar envio a outro aplicativo durante os testes.

A primeira tentativa usou um emulador previamente existente cujo System UI estava sem resposta, causando falta de foco no teste de clipboard. A suíte foi concluída no emulador novo e isolado. A falha de infraestrutura não foi tratada como aprovação.

A revisão fiscal permanece em 05/10/2026. Esta publicação entrega as alterações já documentadas em `REGRAS-2027.md` dentro do Android, sem declarar confirmação de novas alíquotas ou parâmetros para 2027.
