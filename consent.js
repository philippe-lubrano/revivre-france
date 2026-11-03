/*
 * consent.js — Consentement cookies (RGPD / CNIL) + Google Consent Mode v2
 * -------------------------------------------------------------------------
 * Principe : aucun script Google n'est chargé avant un accord explicite.
 *
 *  - Le choix est conservé 6 mois (localStorage), puis il est redemandé.
 *  - Refuser est aussi simple qu'accepter ; aucun cookie n'est déposé en cas
 *    de refus (et les cookies GA déjà présents sont supprimés).
 *  - Le choix est modifiable à tout moment via le lien « Gérer mes cookies »
 *    ajouté au pied de page, via tout élément portant l'attribut
 *    data-rf-consent-open, ou via window.rfOpenConsent().
 *  - Consent Mode v2 : tous les signaux sont refusés par défaut ; seul
 *    analytics_storage est accordé. Aucune finalité publicitaire.
 */
(function () {
  "use strict";

  var GA_ID = "G-D8WWD07X39";
  var GTAG_SRC = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
  var STORAGE_KEY = "rf_consent_v1";
  var HIDE_KEY = "rf_consent_hidden";
  var MAX_AGE_MS = 183 * 24 * 60 * 60 * 1000; // 6 mois

  var CONSENT_DENIED = {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    functionality_storage: "denied",
    personalization_storage: "denied",
    security_storage: "granted"
  };

  var CONSENT_GRANTED = {
    ad_storage: "denied", // ce site ne fait aucune publicité
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "granted",
    functionality_storage: "denied",
    personalization_storage: "denied",
    security_storage: "granted"
  };

  var banner = null;
  var gaLoaded = false;

  function gtag() {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(arguments);
  }

  /* ---------------------------------------------------------------------- */
  /* Stockage (tolérant : navigation privée, stockage bloqué, etc.)          */
  /* ---------------------------------------------------------------------- */

  function usableStorage(kind) {
    try {
      var store = kind === "session" ? window.sessionStorage : window.localStorage;
      store.setItem("__rf_probe__", "1");
      store.removeItem("__rf_probe__");
      return store;
    } catch (err) {
      return null;
    }
  }

  var localStore = usableStorage("local");
  var sessionStore = usableStorage("session");

  function readStoredChoice() {
    if (!localStore) return null;

    var raw = null;
    try {
      raw = localStore.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }
    if (!raw) return null;

    var data = null;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      data = null;
    }
    if (!data || typeof data.analytics !== "boolean") return null;

    // Choix périmé (6 mois) : on repart de zéro et on efface les cookies GA.
    if (!data.ts || Date.now() - data.ts > MAX_AGE_MS) {
      try {
        localStore.removeItem(STORAGE_KEY);
      } catch (err) {}
      clearGaCookies();
      return null;
    }

    return data;
  }

  function storeChoice(granted) {
    if (!localStore) return;
    try {
      localStore.setItem(
        STORAGE_KEY,
        JSON.stringify({ analytics: !!granted, ts: Date.now(), v: 1 })
      );
    } catch (err) {}
  }

  /* ---------------------------------------------------------------------- */
  /* Cookies Google Analytics                                               */
  /* ---------------------------------------------------------------------- */

  function cookieScopes() {
    var host = window.location.hostname;
    var scopes = [null];
    if (!host || host === "localhost" || /^[\d.]+$/.test(host)) return scopes;

    var parts = host.split(".");
    scopes.push(host);
    if (parts.length >= 3) scopes.push("." + parts.slice(1).join("."));
    if (parts.length >= 2) scopes.push("." + parts.slice(-2).join("."));
    return scopes;
  }

  function clearGaCookies() {
    var names = [];
    var cookies = document.cookie ? document.cookie.split(";") : [];

    for (var i = 0; i < cookies.length; i++) {
      var name = cookies[i].split("=")[0].replace(/^\s+|\s+$/g, "");
      if (/^_(ga|gid|gat|gcl)/.test(name) && names.indexOf(name) === -1) {
        names.push(name);
      }
    }

    var scopes = cookieScopes();
    for (var n = 0; n < names.length; n++) {
      for (var s = 0; s < scopes.length; s++) {
        var domain = scopes[s] ? "; domain=" + scopes[s] : "";
        document.cookie =
          names[n] + "=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax" + domain;
        document.cookie = names[n] + "=; path=/; Max-Age=0; SameSite=Lax" + domain;
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Chargement / arrêt de Google Analytics                                  */
  /* ---------------------------------------------------------------------- */

  function loadGa() {
    if (gaLoaded) return;
    gaLoaded = true;

    window["ga-disable-" + GA_ID] = false;

    gtag("consent", "update", CONSENT_GRANTED);
    gtag("js", new Date());
    gtag("config", GA_ID, { anonymize_ip: true });

    var script = document.createElement("script");
    script.async = true;
    script.src = GTAG_SRC;
    document.head.appendChild(script);
  }

  function unloadGa() {
    window["ga-disable-" + GA_ID] = true;
    gtag("consent", "update", CONSENT_DENIED);
    clearGaCookies();
  }

  /* ---------------------------------------------------------------------- */
  /* Bandeau                                                                */
  /* ---------------------------------------------------------------------- */

  function buildBanner() {
    var el = document.createElement("div");

    el.className = "rf-consent";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-labelledby", "rf-consent-title");
    el.setAttribute("aria-describedby", "rf-consent-intro");
    el.setAttribute("tabindex", "-1");
    el.hidden = true;

    el.innerHTML =
      "<div class='rf-consent-inner'>" +
        "<div class='rf-consent-text'>" +
          "<p class='rf-consent-title' id='rf-consent-title'>Cookies et mesure d'audience</p>" +
          "<p id='rf-consent-intro'>Nous utilisons Google Analytics pour savoir combien de personnes visitent ce site " +
          "et quelles pages sont utiles. Aucun cookie de mesure n'est déposé avant votre accord, et refuser est " +
          "aussi simple qu'accepter : le site fonctionne exactement de la même manière.</p>" +
          "<details class='rf-consent-details'>" +
            "<summary>En savoir plus</summary>" +
            "<table>" +
              "<thead><tr>" +
                "<th scope='col'>Service</th>" +
                "<th scope='col'>Finalité</th>" +
                "<th scope='col'>Durée</th>" +
              "</tr></thead>" +
              "<tbody><tr>" +
                "<td>Google Analytics 4</td>" +
                "<td>Mesure d'audience (pages vues, provenance de la visite, type d'appareil)</td>" +
                "<td>13 mois maximum</td>" +
              "</tr></tbody>" +
            "</table>" +
            "<p>Aucun cookie publicitaire n'est utilisé et vos données de navigation ne sont jamais revendues. " +
            "Votre choix est conservé 6 mois dans ce navigateur, puis il vous sera redemandé.</p>" +
            "<p>Responsable de traitement : Revivre-France. Pour exercer vos droits (accès, effacement, opposition), " +
            "écrivez à <a href='mailto:contact@revivre-france.org'>contact@revivre-france.org</a>.</p>" +
          "</details>" +
        "</div>" +
        "<div class='rf-consent-actions'>" +
          "<button type='button' class='rf-consent-btn rf-consent-btn--reject' data-rf-consent='reject'>Refuser</button>" +
          "<button type='button' class='rf-consent-btn rf-consent-btn--accept' data-rf-consent='accept'>Accepter</button>" +
        "</div>" +
      "</div>";

    el.addEventListener("click", function (event) {
      var target = event.target;
      var button = target && target.closest ? target.closest("[data-rf-consent]") : null;
      if (!button) return;
      choose(button.getAttribute("data-rf-consent") === "accept");
    });

    var details = el.querySelector("details");
    if (details) details.addEventListener("toggle", syncOffset);

    document.body.appendChild(el);
    return el;
  }

  function syncOffset() {
    if (!banner || banner.hidden || !document.body) {
      document.body.style.paddingBottom = "";
      return;
    }
    document.body.style.paddingBottom = banner.offsetHeight + "px";
  }

  function showBanner(moveFocus) {
    if (!document.body) return;
    if (!banner) banner = buildBanner();

    banner.hidden = false;
    if (sessionStore) {
      try {
        sessionStore.removeItem(HIDE_KEY);
      } catch (err) {}
    }

    syncOffset();
    if (moveFocus) banner.focus();
  }

  function hideBanner() {
    if (!banner) return;
    banner.hidden = true;
    syncOffset();
  }

  function announce(message) {
    var region = document.getElementById("rf-consent-live");

    if (!region) {
      region = document.createElement("p");
      region.id = "rf-consent-live";
      region.className = "rf-visually-hidden";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }

    region.textContent = message;
  }

  function choose(granted) {
    storeChoice(granted);

    if (granted) {
      loadGa();
    } else {
      unloadGa();
    }

    hideBanner();
    announce(
      granted
        ? "Merci, la mesure d'audience est activée. Vous pouvez changer d'avis via le lien Gérer mes cookies."
        : "Mesure d'audience désactivée. Aucun cookie de suivi n'est utilisé."
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Points d'entrée pour rouvrir le bandeau                                 */
  /* ---------------------------------------------------------------------- */

  function bindOpenTrigger(element) {
    element.addEventListener("click", function (event) {
      event.preventDefault();
      showBanner(true);
    });
  }

  function addFooterLink() {
    var bottom = document.querySelector(".footer-bottom");
    if (!bottom || bottom.querySelector("[data-rf-consent-open]")) return;

    var link = document.createElement("a");
    link.href = "#";
    link.className = "footer-cookie-link";
    link.setAttribute("data-rf-consent-open", "");
    link.textContent = "Gérer mes cookies";

    // On place le lien juste après le texte « © … » pour qu'il reste groupé
    // avec lui (le margin-right:auto le fait ensuite respirer avant les icônes).
    var first = bottom.firstElementChild;
    if (first && first.tagName === "SPAN" && !first.classList.contains("footer-social")) {
      first.insertAdjacentElement("afterend", link);
    } else {
      bottom.appendChild(link);
    }

    bindOpenTrigger(link);
  }

  function initTriggers() {
    var triggers = document.querySelectorAll("[data-rf-consent-open]");
    for (var i = 0; i < triggers.length; i++) {
      bindOpenTrigger(triggers[i]);
    }
    addFooterLink();
  }

  window.rfOpenConsent = function () {
    showBanner(true);
  };

  /* ---------------------------------------------------------------------- */
  /* Démarrage                                                              */
  /* ---------------------------------------------------------------------- */

  // 1) Immédiatement (avant tout script Google) : appliquer le choix enregistré.
  var storedChoice = readStoredChoice();
  if (storedChoice && storedChoice.analytics) loadGa();

  function isHiddenThisSession() {
    if (!sessionStore) return false;
    try {
      return sessionStore.getItem(HIDE_KEY) === "1";
    } catch (err) {
      return false;
    }
  }

  // 2) Une fois le DOM disponible : bandeau et liens.
  function boot() {
    initTriggers();

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || !banner || banner.hidden) return;
      // Échap ferme le bandeau sans enregistrer de choix : aucun consentement,
      // donc aucun cookie. Il ne réapparaîtra pas avant la prochaine session.
      if (sessionStore) {
        try {
          sessionStore.setItem(HIDE_KEY, "1");
        } catch (err) {}
      }
      hideBanner();
    });

    window.addEventListener("resize", syncOffset);
    window.addEventListener("load", syncOffset);

    if (!storedChoice && !isHiddenThisSession()) showBanner(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
