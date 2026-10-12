# Aplicativo Android — 2.1.0

Primeira distribuição Android deste repositório, preparada em 12/10/2026. Inclui a calculadora modernizada para a transição de 2027. A data da revisão fiscal permanece **05/10/2026**; criar o APK não presume uma nova alíquota ou regra tributária.

| Propriedade | Valor |
| --- | --- |
| Nome no celular | Calculadora IBS CBS |
| Identificador | `br.com.wiserjr.calc` |
| Versão | 2.1.0 |
| Código Android | 21000 |
| Android mínimo | 8.0 / API 26 |
| SDK alvo / compilação | 36 |
| Arquiteturas | Universal, sem bibliotecas nativas específicas |
| Permissão de internet | Não solicitada |
| Armazenamento / câmera / localização | Não solicitados |
| Distribuição | APK release assinado, GitHub Releases |

## Instalar e usar

Baixe `Calc-IBS-CBS-2.1.0-android.apk` da versão publicada no GitHub e abra no celular. Se o sistema solicitar, permita a instalação por esse navegador ou gerenciador de arquivos. A instalação é direta por APK; não há publicação na Google Play.

A interface e o motor estão dentro do APK. Não dependem de servidor, login ou internet. Os campos não são armazenados permanentemente. Rotação de tela e mudança de tamanho preservam a mesma instância da calculadora; fechar o processo reinicia os campos.

- **Copiar memória** usa o clipboard do Android.
- **Imprimir / PDF** abre a impressão do sistema; escolha Salvar como PDF ou uma impressora disponível.
- **Compartilhar** abre o seletor de aplicativos. O usuário escolhe o destino e confirma o envio no aplicativo escolhido.
- Links oficiais abrem no navegador externo. Somente links HTTPS dos domínios oficiais `.gov.br` e `.leg.br` são permitidos pelo aplicativo.

## Arquitetura

Uma Activity Java com WebView carrega `https://appassets.androidplatform.net/assets/index.html` usando AndroidX `WebViewAssetLoader`. A URL é virtual e resolvida pelo APK, sem conexão de rede. Apenas o HTML gerado é empacotado em assets. Requisições de outros recursos são bloqueadas, e páginas externas não são carregadas no WebView.

Cópia, impressão e compartilhamento usam `WebViewCompat.addWebMessageListener`, limitado à origem local e ao frame principal. Não há `addJavascriptInterface` genérico. Acesso a arquivos e a `content://` está desativado; conteúdo misto é proibido. O WebView de release não permite depuração remota. Se o WebView instalado não oferecer a ponte necessária, o aplicativo pede sua atualização.

Referências de implementação: [conteúdo local em WebView](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content), [WebViewCompat](https://developer.android.com/reference/androidx/webkit/WebViewCompat) e [compatibilidade AGP 9.4](https://developer.android.com/build/releases/agp-9-4-0-release-notes).

## Compilar no Windows

Requisitos: Node 20+, Python 3, JDK compatível com Gradle 9.6, Android SDK 36 e Build Tools 36.0.0. O wrapper Gradle 9.6.0 está versionado com o checksum da distribuição oficial; AGP 9.4.0 e AndroidX WebKit 1.15.0 estão fixados.

```powershell
.\scripts\build-android.ps1
```

Também aceita `-JavaHome`, `-AndroidSdk` e `-SigningProperties`. O script gera os HTMLs, executa as verificações web, compila e analisa o Android, verifica a assinatura e compara `assets/index.html` byte a byte com `calc.html`. Saídas locais em `outputs/`, ignorado pelo Git:

- `Calc-IBS-CBS-2.1.0-android.apk`
- `SHA256SUMS.txt`

Para desenvolvimento sem chave de release:

```powershell
android\gradlew.bat -p android :app:assembleDebug :app:lintDebug
```

O pacote debug é `br.com.wiserjr.calc.debug`, separado do instalador distribuído.

## Assinatura e próximas versões

Foi criada uma chave **dedicada a este aplicativo**, fora do repositório. No computador usado para a publicação, fica em `%USERPROFILE%\.codex\signing\calc\calc-release.jks`, com propriedades locais em `release.properties` na mesma pasta. **Preserve um backup privado dos dois arquivos.** Não publique os arquivos ou suas senhas no GitHub.

O Gradle aceita `CALC_SIGNING_PROPERTIES` apontando para esse arquivo externo. Ele contém `storeFile`, `storePassword`, `keyAlias` e `keyPassword`; nenhum desses segredos é versionado. O certificado público desta primeira distribuição tem SHA-256:

```text
23aaa46f55e02c171f822c8eadcba3ccc052adc1540131f754f271ddeedd1a6c
```

Para uma atualização instalável sobre a anterior, mantenha o identificador e a mesma chave, aumente `versionCode` em `android/app/build.gradle` e atualize `package.json`. Não é necessário desinstalar o aplicativo para instalar uma atualização compatível.

## Testes no emulador

Os testes instrumentados estão em `android/app/src/androidTest/`. Eles abrem o WebView do APK, executam cenários, conferem a ponte nativa e a impressão do sistema. É possível usar o mesmo conjunto contra a build release assinada:

```powershell
android\gradlew.bat -p android :app:assembleReleaseAndroidTest -PcalcTestBuildType=release
adb install -r outputs\Calc-IBS-CBS-2.1.0-android.apk
adb install -r android\app\build\outputs\apk\androidTest\release\app-release-androidTest.apk
adb shell am instrument -w br.com.wiserjr.calc.test/br.com.wiserjr.calc.CalculatorInstrumentation
```

Verifique os resultados `passed`/`failed`; o código de saída do comando adb sozinho não comprova aprovação. A imagem e o relatório da publicação ficam em `docs/VALIDACAO-ANDROID.md`.
