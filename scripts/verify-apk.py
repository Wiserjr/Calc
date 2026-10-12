"""Confere integridade, HTML empacotado e ausência de arquivos privados."""
from pathlib import Path
import hashlib
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
apk = Path(sys.argv[1])
expected = (root / 'calc.html').read_bytes()
with zipfile.ZipFile(apk) as archive:
    bad = archive.testzip()
    if bad:
        raise SystemExit(f'ZIP inválido: {bad}')
    actual = archive.read('assets/index.html')
    if actual != expected:
        raise SystemExit('O HTML do APK difere do arquivo web validado.')
    for name in archive.namelist():
        if name.startswith('assets/') and name != 'assets/index.html':
            raise SystemExit(f'Asset não previsto: {name}')
        if name.lower().endswith(('.jks', '.keystore', '.pem', '.key')) or (name.startswith('assets/') and name.lower().endswith('.properties')):
            raise SystemExit(f'Arquivo privado ou de configuração indevido: {name}')
    if any(name.startswith('lib/') and name.endswith('.so') for name in archive.namelist()):
        raise SystemExit('A calculadora deve ser universal, sem bibliotecas específicas de CPU.')
print('ZIP íntegro; HTML do APK idêntico ao calc.html; assets permitidos; sem bibliotecas de CPU.')
print('SHA-256 APK:', hashlib.sha256(apk.read_bytes()).hexdigest())
print('SHA-256 HTML:', hashlib.sha256(actual).hexdigest())
