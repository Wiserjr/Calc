param(
    [string]$JavaHome = $env:JAVA_HOME,
    [string]$AndroidSdk = $env:ANDROID_HOME,
    [string]$SigningProperties = $env:CALC_SIGNING_PROPERTIES
)
$ErrorActionPreference = 'Stop'
$calcRoot = Split-Path $PSScriptRoot -Parent
if (-not $JavaHome) { $JavaHome = 'C:\Program Files\Android\Android Studio\jbr' }
if (-not $AndroidSdk) { $AndroidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not $SigningProperties) { $SigningProperties = Join-Path $env:USERPROFILE '.codex\signing\calc\release.properties' }
if (-not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin\java.exe'))) { throw 'Informe -JavaHome com um JDK 17 ou superior compatível com Gradle 9.6.' }
if (-not (Test-Path -LiteralPath $AndroidSdk)) { throw 'Informe -AndroidSdk.' }
if (-not (Test-Path -LiteralPath $SigningProperties)) { throw 'Informe -SigningProperties com a chave de release, guardada fora do Git.' }
$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $AndroidSdk
$env:CALC_SIGNING_PROPERTIES = $SigningProperties
Push-Location $calcRoot
try {
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar o HTML.' }
    & npm run check
    if ($LASTEXITCODE -ne 0) { throw 'A verificação web falhou.' }
    & (Join-Path $calcRoot 'android\gradlew.bat') -p (Join-Path $calcRoot 'android') :app:assembleRelease :app:lintRelease --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'A compilação ou o lint Android falhou.' }
    $calcVersion = (Get-Content -Raw (Join-Path $calcRoot 'package.json') | ConvertFrom-Json).version
    $calcOutputDir = Join-Path $calcRoot 'outputs'
    New-Item -ItemType Directory -Force -Path $calcOutputDir | Out-Null
    $calcApk = Join-Path $calcOutputDir "Calc-IBS-CBS-$calcVersion-android.apk"
    Copy-Item -LiteralPath (Join-Path $calcRoot 'android\app\build\outputs\apk\release\app-release.apk') -Destination $calcApk
    & (Join-Path $AndroidSdk 'build-tools\36.0.0\apksigner.bat') verify --verbose --print-certs $calcApk
    if ($LASTEXITCODE -ne 0) { throw 'Assinatura do APK inválida.' }
    & python (Join-Path $PSScriptRoot 'verify-apk.py') $calcApk
    if ($LASTEXITCODE -ne 0) { throw 'Conteúdo do APK inválido.' }
    $calcHash = (Get-FileHash -LiteralPath $calcApk -Algorithm SHA256).Hash.ToLowerInvariant()
    $calcHtmlHash = (Get-FileHash -LiteralPath (Join-Path $calcRoot 'calc.html') -Algorithm SHA256).Hash.ToLowerInvariant()
    [IO.File]::WriteAllLines((Join-Path $calcOutputDir 'SHA256SUMS.txt'), [string[]]@(
        "$calcHash  $(Split-Path $calcApk -Leaf)", "$calcHtmlHash  calc.html"
    ), [Text.UTF8Encoding]::new($false))
    Write-Output "APK release validado: $calcApk"
} finally { Pop-Location }
