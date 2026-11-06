import { functions } from "@/config/firebase";
import {
    BancardConfig,
    BancardConfirmationResult,
    BancardEnvironment,
    BancardSingleBuyResult,
    BancardTestCard,
    CreatePaymentLinkResult
} from "@/types/bancard";
import { DEFAULT_USD_TO_PYG_RATE } from "@/types/exchange-rate";
import { httpsCallable } from "firebase/functions";

/**
 * Configuración pública de Bancard vPOS 2.0 para ALTAGO.
 * IMPORTANTE: las claves pública/privada y el cálculo del token MD5 viven
 * exclusivamente en Cloud Functions (functions/src/bancard.ts). Nunca en la app.
 */
export const BANCARD_CONFIG: BancardConfig = {
    stagingUrl: "https://vpos.infonet.com.py:8888",
    productionUrl: "https://vpos.infonet.com.py",
    commerceName: "ALTAGO - VUELOS CHÁRTER",
};

/**
 * Tarjetas de prueba públicas del manual de Bancard (staging) para la certificación.
 * Solo se muestran cuando el pago se inicia en ambiente staging.
 */
export const BANCARD_TEST_CARDS: BancardTestCard[] = [
    {
        brand: "MasterCard",
        cardNumber: "5418630110000014",
        formattedNumber: "5418 •••• •••• 0014",
        expiration: "08/30",
        cvv: "439",
        name: "MasterCard Oficial Staging",
        cardHolder: "ALTAGO TESTER MC",
    },
    {
        brand: "Visa",
        cardNumber: "4907860500000016",
        formattedNumber: "4907 •••• •••• 0016",
        expiration: "08/30",
        cvv: "209",
        name: "Visa Oficial Staging",
        cardHolder: "ALTAGO TESTER VISA",
    },
    {
        brand: "Bancard",
        cardNumber: "8601010000000013",
        formattedNumber: "8601 •••• •••• 0013",
        expiration: "08/30",
        cvv: "000",
        name: "Bancard Débito / Local",
        cardHolder: "ALTAGO TESTER BANCARD",
    },
];

/**
 * Tasa referencial USD a Guaraníes (PYG) de respaldo, solo para mostrar montos.
 * El monto real a cobrar lo calcula el servidor con el cambio del día.
 */
export const USD_TO_PYG_RATE = DEFAULT_USD_TO_PYG_RATE;

/**
 * Inicia el pago (single_buy) en Bancard a través de la Cloud Function `bancardSingleBuy`.
 * El servidor toma el precio de la reserva desde Firestore: la app no envía montos.
 * La reserva debe estar en `awaiting_payment`.
 */
export async function initiateSingleBuy(reservationId: string): Promise<BancardSingleBuyResult> {
    const callable = httpsCallable<{ reservationId: string }, BancardSingleBuyResult>(
        functions,
        "bancardSingleBuy"
    );
    const res = await callable({ reservationId });
    return res.data;
}

/**
 * Consulta en el servidor (get_confirmation) si Bancard aprobó el pago de la reserva.
 * Si fue aprobado, el servidor ya actualizó la reserva a `confirmed` en Firestore.
 */
export async function confirmBancardPayment(reservationId: string): Promise<BancardConfirmationResult> {
    const callable = httpsCallable<{ reservationId: string }, BancardConfirmationResult>(
        functions,
        "bancardGetConfirmation"
    );
    const res = await callable({ reservationId });
    return res.data;
}

/**
 * Genera un link de pago de un solo uso (vence en 48 h) para enviar por WhatsApp.
 * Abre la página pública /pagar en Firebase Hosting, que carga el iframe oficial de Bancard.
 */
export async function createPaymentLink(reservationId: string): Promise<CreatePaymentLinkResult> {
    const callable = httpsCallable<{ reservationId: string }, CreatePaymentLinkResult>(
        functions,
        "createPaymentLink"
    );
    const res = await callable({ reservationId });
    return res.data;
}

export function getBancardBaseUrl(environment: BancardEnvironment): string {
    return environment === "production" ? BANCARD_CONFIG.productionUrl : BANCARD_CONFIG.stagingUrl;
}

/**
 * Genera el documento HTML que invoca al iFrame oficial de Bancard
 * mediante la librería JavaScript oficial vPOS 2.0 (Págs. 18, 19 y 77 del manual v1.24).
 */
export function getBancardIframeHtml(
    processId: string,
    environment: BancardEnvironment = "staging"
): string {
    const baseUrl = getBancardBaseUrl(environment);

    const scriptUrl = `${baseUrl}/checkout/javascript/dist/bancard-checkout-4.0.0.js`;

    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      <title>vPOS Bancard - iFrame Oficial</title>
      <!-- Script oficial publicado por Bancard (Pág 18 del manual) -->
      <script src="${scriptUrl}"></script>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          width: 100%;
          min-height: 100%;
          background-color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        #iframe-container {
          width: 100%;
          min-height: 520px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .loading-box {
          text-align: center;
          padding: 40px 20px;
          color: #64748b;
          font-size: 13px;
        }
        .spinner {
          width: 26px;
          height: 26px;
          border: 3px solid #cbd5e1;
          border-top-color: #00529b;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 12px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <div id="iframe-container">
        <div id="loadingBox" class="loading-box">
          <div class="spinner"></div>
          Conectando con el iFrame oficial de Bancard vPOS...
        </div>
      </div>

      <script>
        var styles = {
          "form-background-color": "#ffffff",
          "button-background-color": "#00529b",
          "button-text-color": "#ffffff",
          "button-border-color": "#00529b",
          "input-background-color": "#f8fafc",
          "input-text-color": "#030436",
          "input-placeholder-color": "#94a3b8"
        };

        window.onload = function() {
          try {
            if (window.Bancard && window.Bancard.Checkout) {
              var loadingBox = document.getElementById('loadingBox');
              if (loadingBox) loadingBox.style.display = 'none';

              // Inyecta el iFrame oficial de Bancard (Págs. 18 y 19)
              Bancard.Checkout.createForm('iframe-container', '${processId}', styles);

              // Observar cuándo se inyecta y carga el iframe
              var observer = new MutationObserver(function() {
                var iframe = document.querySelector('iframe');
                if (iframe) {
                  observer.disconnect();
                  iframe.addEventListener('load', function() {
                    if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'iframe_loaded'
                      }));
                    }
                  });
                }
              });
              var container = document.getElementById('iframe-container');
              if (container) {
                observer.observe(container, { childList: true, subtree: true });
              }
            } else {
              console.warn("Bancard.Checkout no está disponible en window");
            }
          } catch (err) {
            console.error("Error al inicializar Bancard Checkout:", err);
          }
        };

        // Función de precarga automática de tarjeta en los campos de Bancard
        window.autofillBancard = function(number, exp, cvv) {
          try {
            var doc = document;
            var ifr = document.querySelector('iframe');
            if (ifr) {
              try {
                var idoc = ifr.contentDocument || (ifr.contentWindow && ifr.contentWindow.document);
                if (idoc) doc = idoc;
              } catch(e) {}
            }

            var win = doc.defaultView || window;
            var $ = win.$ || window.$;
            var cleanCvv = (cvv === '000' || cvv === 'N/D') ? '' : cvv;

            if ($ && $('#cardNumber', doc).length) {
              var $num = $('#cardNumber', doc);
              var $exp = $('#cardExpiry', doc);
              var $cvc = $('#cardCVC', doc);

              var numEl = $num[0];
              if (numEl && numEl.inputmask) {
                numEl.inputmask.setValue(number);
              } else {
                $num.val(number);
              }
              $num.trigger('input').trigger('change').trigger('keyup').trigger('blur');

              var expEl = $exp[0];
              if (expEl && expEl.inputmask) {
                expEl.inputmask.setValue(exp);
              } else {
                $exp.val(exp);
              }
              $exp.trigger('input').trigger('change').trigger('keyup').trigger('blur');

              var cvcEl = $cvc[0];
              if (cvcEl && cvcEl.inputmask) {
                cvcEl.inputmask.setValue(cleanCvv);
              } else {
                $cvc.val(cleanCvv);
              }
              $cvc.trigger('input').trigger('change').trigger('keyup').trigger('blur');

              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'autofill_success',
                  brand: number.startsWith('5') ? 'MasterCard' : (number.startsWith('4') ? 'Visa' : 'Bancard')
                }));
              }
              return { success: true };
            }

            // Fallback nativo
            function fillField(selector, val) {
              var el = doc.querySelector(selector);
              if (!el) return false;
              el.focus();
              if (el.inputmask) {
                el.inputmask.setValue(val);
              } else {
                el.value = val;
              }
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
              el.dispatchEvent(new Event('blur', { bubbles: true }));
              return true;
            }

            var f1 = fillField('#cardNumber', number) || fillField('.js-card-number', number);
            var f2 = fillField('#cardExpiry', exp) || fillField('.js-expiration-date', exp);
            var f3 = fillField('#cardCVC', cleanCvv) || fillField('.js-card-cvc', cleanCvv);

            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'autofill_success',
                success: f1 && f2
              }));
            }
            return { success: f1 && f2 };
          } catch(err) {
            return { success: false, error: String(err) };
          }
        };

        // Escuchar eventos de comunicación de Bancard
        window.addEventListener('message', function(event) {
          if (event.data) {
            try {
              var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
              if (data && (data.status === 'success' || data.type === 'bancard_payment_success')) {
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'payment_success',
                    data: data
                  }));
                }
              }
            } catch(e) {}
          }
        });
      </script>
    </body>
    </html>
    `;
}

