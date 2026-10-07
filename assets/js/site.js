/* Shared behavior: mobile nav, cart count badge, live prices on service pages. */
(function () {
  "use strict";
  var CART_KEY = "bg_cart_v1";

  function readCart() {
    try {
      var raw = window.localStorage.getItem(CART_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  function updateCount() {
    var n = readCart().length;
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.textContent = String(n);
      el.setAttribute("data-n", String(n));
      el.setAttribute("aria-label", n + (n === 1 ? " job" : " jobs") + " in your list");
    });
  }

  function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
  function rng(lo, hi) { return lo === hi ? money(lo) : money(lo) + "–" + money(hi); }

  // Re-render price tables from data/services.json so price edits show up without touching HTML.
  function livePrices() {
    var tables = document.querySelectorAll("[data-price-table]");
    var froms = document.querySelectorAll("[data-from]");
    if (!tables.length && !froms.length) return;
    var root = document.documentElement.getAttribute("data-root") || "";
    fetch(root + "data/services.json", { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var byId = {};
        data.services.forEach(function (s) { byId[s.id] = s; });
        froms.forEach(function (el) {
          var s = byId[el.getAttribute("data-from")];
          if (!s) return;
          var lo = Math.min.apply(null, s.variants.map(function (v) { return v.low; }));
          el.textContent = "from " + money(lo);
        });
        tables.forEach(function (tbl) {
          var s = byId[tbl.getAttribute("data-price-table")];
          if (!s) return;
          var body = tbl.querySelector("tbody");
          if (!body) return;
          var frag = document.createDocumentFragment();
          function row(label, value, cls) {
            var tr = document.createElement("tr");
            if (cls) tr.className = cls;
            var a = document.createElement("td"); a.textContent = label;
            var b = document.createElement("td"); b.textContent = value;
            tr.appendChild(a); tr.appendChild(b); frag.appendChild(tr);
          }
          s.variants.forEach(function (v) { row(v.label, rng(v.low, v.high)); });
          if (s.supply) { row(s.supply.label + ": you supply it", "$0"); row(s.supply.label + ": Big Guava supplies it", "Cost + 15%"); }
          s.addons.forEach(function (a) {
            row("Add: " + a.label + (a.each ? " (each)" : ""), a.parts && !a.high ? "No extra labor" : "+" + rng(a.low, a.high) + (a.parts ? " labor" : ""));
            if (a.parts) row((a.partLabel || a.label) + ": you supply it, or Big Guava supplies it", "$0 or cost + 15%", "sub");
          });
          body.replaceChildren(frag);
        });
      })
      .catch(function () { /* static prices in the HTML stay in place */ });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("site-nav");
    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
    updateCount();
    livePrices();
  });
  window.addEventListener("storage", function (e) { if (e.key === CART_KEY) updateCount(); });
  window.BG_SITE = { readCart: readCart, updateCount: updateCount, CART_KEY: CART_KEY };
})();
