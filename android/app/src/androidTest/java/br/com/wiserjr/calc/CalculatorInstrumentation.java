package br.com.wiserjr.calc;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.webkit.WebView;
import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Executa fluxos no WebView do APK instalado, sem servidor ou JUnit externo. */
public final class CalculatorInstrumentation extends Instrumentation {
    private MainActivity activity;
    private WebView web;
    private int passed;
    private int failed;
    private final StringBuilder report = new StringBuilder();

    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
    @Override public void onStart() {
        try {
            Intent launch = new Intent().setClassName(getTargetContext().getPackageName(), MainActivity.class.getName())
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity = (MainActivity) startActivitySync(launch);
            web = activity.getCalculatorForTesting();
            waitFor("carregamento", () -> "true".equals(js("typeof Calc === 'object' && !!document.getElementById('year') && document.getElementById('year').value === '2027'")));
            runTest("offlineAndSecurity", () -> {
                check(activity.isCalculatorReadyForTesting(), "Página local não pronta");
                check(getTargetContext().checkCallingOrSelfPermission("android.permission.INTERNET") == PackageManager.PERMISSION_DENIED, "APK não deve solicitar INTERNET");
                check("true".equals(js("!!window.CalcAndroid && location.origin === 'https://appassets.androidplatform.net'")), "Ponte Android ou origem inválida");
                main(() -> {
                    check(!web.getSettings().getAllowFileAccess(), "Acesso a arquivos habilitado");
                    check(!web.getSettings().getAllowContentAccess(), "Acesso a content URI habilitado");
                });
            });
            runTest("missingCbs", () -> {
                js("document.getElementById('calculator').requestSubmit(); true");
                check("true".equals(js("!document.getElementById('error').hidden && document.getElementById('error').textContent.includes('CBS')")), "CBS ausente não bloqueou cálculo");
            });
            runTest("originalExample", () -> {
                js("document.getElementById('rtcEnabled').checked=false; sync(); document.getElementById('calculator').requestSubmit(); true");
                check("true".equals(js("lastResult.r.service === 1263.16 && lastResult.r.retained === 63.16 && lastResult.r.net === 1200")), "Exemplo original não fechou");
                check("true".equals(js("document.documentElement.scrollWidth <= document.documentElement.clientWidth")), "Transbordamento horizontal");
            });
            runTest("cbsAndSettlement", () -> {
                js("document.getElementById('rtcEnabled').checked=true; document.getElementById('cbs').value='10'; sync(); document.getElementById('calculator').requestSubmit(); true");
                check("true".equals(js("lastResult.r.total === 1383.16 && lastResult.r.payment === 1320 && lastResult.r.toReserve === 120 && lastResult.r.net === 1200")), "CBS/IBS ou reserva incorretos");
                js("document.getElementById('rtcCollection').value='separated'; document.getElementById('rtcCollection').dispatchEvent(new Event('change',{bubbles:true})); true");
                check("true".equals(js("document.getElementById('result').hidden")), "Resultado antigo permaneceu visível");
                js("document.getElementById('calculator').requestSubmit(); true");
                check("true".equals(js("lastResult.r.payment === 1200 && lastResult.r.toReserve === 0 && lastResult.r.total === 1383.16")), "Segregação incorreta");
            });
            runTest("copyNativeMemory", () -> {
                js("document.getElementById('copyResult').click(); true");
                waitFor("cópia", () -> "true".equals(js("document.getElementById('copyStatus').textContent === 'Memória copiada.'")));
                main(() -> {
                    ClipboardManager clipboard = activity.getSystemService(ClipboardManager.class);
                    check(clipboard.hasPrimaryClip(), "Clipboard vazio");
                    String text = clipboard.getPrimaryClip().getItemAt(0).coerceToText(activity).toString();
                    check(text.contains("Calculadora Reversa NFS-e") && text.contains("1.200,00"), "Memória nativa incorreta");
                });
            });
            runTest("year2026Dispensation", () -> {
                js("document.getElementById('year').value='2026'; document.getElementById('year').dispatchEvent(new Event('change',{bubbles:true})); document.getElementById('calculator').requestSubmit(); true");
                check("true".equals(js("lastResult.r.rtc === 0 && lastResult.r.ibs === 1.2 && lastResult.r.cbs === 10.8 && lastResult.r.net === 1200")), "Dispensa 2026 incorreta");
                js("document.getElementById('year').value='2027'; document.getElementById('year').dispatchEvent(new Event('change',{bubbles:true})); true");
                check("true".equals(js("document.getElementById('cbs').value === '' && document.getElementById('remainingCap').value === ''")), "Parâmetros antigos transportados para 2027");
            });
            runTest("publicBuyerGuard", () -> {
                js("document.getElementById('buyer').value='public'; document.getElementById('cbs').value='10'; sync(); document.getElementById('calculator').requestSubmit(); true");
                check("true".equals(js("!document.getElementById('error').hidden && document.getElementById('error').textContent.includes('Compras públicas')")), "Compra pública sem confirmação aceita");
                js("document.getElementById('buyer').value='private'; document.getElementById('rtcEnabled').checked=false; sync(); document.getElementById('calculator').requestSubmit(); true");
            });
            runTest("nativePrintAndScreenshot", () -> {

                main(() -> {
                    web.evaluateJavascript("window.scrollTo(0, document.getElementById('result').getBoundingClientRect().top + window.scrollY - 20)", null);
                });
                waitForIdleSync();
                Bitmap image = getUiAutomation().takeScreenshot();
                check(image != null, "Captura indisponível");
                try (FileOutputStream out = new FileOutputStream(new File(activity.getExternalFilesDir(null), "android-calculation.png"))) {
                    image.compress(Bitmap.CompressFormat.PNG, 100, out);
                } catch (Exception error) { throw new AssertionError(error); }
                image.recycle();
                checkPrintDialog();
                check(activity.getConsoleErrorForTesting().isEmpty(), "Erro JavaScript: " + activity.getConsoleErrorForTesting());
            });
        } catch (Throwable error) {
            failed++;
            report.append("SETUP FAIL: ").append(error).append('\n');
        }
        Bundle result = new Bundle();
        result.putString("stream", report + "\n" + passed + " passed, " + failed + " failed\n");
        result.putInt("passed", passed); result.putInt("failed", failed);
        finish(failed == 0 ? Activity.RESULT_OK : Activity.RESULT_CANCELED, result);
    }

    private void checkPrintDialog() {
        js("document.getElementById('printResult').click(); true");
        waitFor("diálogo de impressão", () -> {
            android.view.accessibility.AccessibilityNodeInfo root = getUiAutomation().getRootInActiveWindow();
            return root != null && root.getPackageName() != null && "com.android.printspooler".contentEquals(root.getPackageName());
        });
        sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_BACK);
        waitForIdleSync();
    }
    private void runTest(String name, Runnable test) {
        Bundle status = new Bundle(); status.putString("class", getClass().getName()); status.putString("test", name); status.putInt("numtests", 8);
        sendStatus(1, status);
        try { test.run(); passed++; report.append("PASS ").append(name).append('\n'); sendStatus(0, status); }
        catch (Throwable error) { failed++; report.append("FAIL ").append(name).append(": ").append(error).append('\n'); status.putString("stack", error.toString()); sendStatus(-2, status); }
    }
    private String js(String expression) {
        CountDownLatch ready = new CountDownLatch(1); AtomicReference<String> value = new AtomicReference<>();
        main(() -> web.evaluateJavascript("(() => { " + (expression.contains(";") ? expression.substring(0, expression.lastIndexOf(';') + 1) + " return " + expression.substring(expression.lastIndexOf(';') + 1) : "return " + expression) + "; })()", reply -> { value.set(reply); ready.countDown(); }));
        try { check(ready.await(10, TimeUnit.SECONDS), "JavaScript não respondeu"); }
        catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new AssertionError(error); }
        return value.get();
    }
    private void main(Runnable action) {
        AtomicReference<Throwable> failure = new AtomicReference<>();
        runOnMainSync(() -> { try { action.run(); } catch (Throwable error) { failure.set(error); } });
        if (failure.get() != null) throw new AssertionError(failure.get());
    }
    private interface Probe { boolean ready(); }
    private void waitFor(String label, Probe probe) {
        long end = System.currentTimeMillis() + 30000;
        while (System.currentTimeMillis() < end) {
            if (probe.ready()) return;
            try { Thread.sleep(100); } catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new AssertionError(error); }
        }
        throw new AssertionError("Prazo excedido: " + label);
    }
    private static void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
}
