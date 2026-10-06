/* Estimate builder: pick jobs, see a price range, send the list as a request. No payment. */
(function () {
  "use strict";
  var CFG = window.BG_CONFIG || {};
  var SITE = window.BG_SITE;
  var CART_KEY = SITE ? SITE.CART_KEY : "bg_cart_v1";
  var KEY_PLACEHOLDER = "YOUR-WEB3FORMS-ACCESS-KEY";

  var data = null;
  var byId = {};
  var cart = [];
  var editing = {}; // service id -> cart item uid being edited

  /* ---------- helpers ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "text") n.textContent = v;
      else if (k === "class") n.className = v;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : String(v));
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
  function rng(lo, hi) { return lo === hi ? money(lo) : money(lo) + "–" + money(hi); }
  function addonText(a) {
    if (a.parts && !a.high) return "No extra labor";
    return "+" + rng(a.low, a.high) + (a.parts ? " labor" : "");
  }
  function partsFor(it) {
    var s = byId[it.sid], sup = it.supply || {}, out = [];
    if (s.supply && sup[s.supply.key] === "bg") out.push(s.supply.label);
    s.addons.forEach(function (a) { if (a.parts && it.addons[a.id] && sup[a.id] === "bg") out.push(a.partLabel || a.label); });
    return out;
  }
  // One-line text only: no line breaks or control characters (blocks header tricks in the email subject).
  function clean(v, max) { return String(v || "").replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max); }
  function cleanMulti(v, max) { return String(v || "").replace(/[\u0000-\u0009\u000B-\u001F\u007F]+/g, " ").trim().slice(0, max); }
  var lastSent = 0;
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function clampInt(v, lo, hi) { v = parseInt(v, 10); if (isNaN(v)) v = lo; return Math.max(lo, Math.min(hi, v)); }

  function save() {
    try { window.localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { /* private mode: list lasts for this visit */ }
    if (SITE) SITE.updateCount();
  }
  function load() {
    var raw = SITE ? SITE.readCart() : [];
    // Keep only items that still match the current price list.
    cart = raw.filter(function (it) {
      var s = it && byId[it.sid];
      return s && s.variants.some(function (v) { return v.id === it.vid; });
    }).map(function (it) {
      var s = byId[it.sid];
      var addons = {};
      s.addons.forEach(function (a) {
        if (it.addons && it.addons[a.id]) addons[a.id] = clampInt(it.addons[a.id], 0, a.count ? (a.max || 10) : 1);
      });
      var supply = {}, inSup = (it.supply && typeof it.supply === "object") ? it.supply : {};
      var keys = (s.supply ? [s.supply.key] : []).concat(s.addons.filter(function (a) { return a.parts; }).map(function (a) { return a.id; }));
      keys.forEach(function (k) { if (inSup[k] === "bg") supply[k] = "bg"; });
      return { uid: String(it.uid || uid()).slice(0, 12), sid: s.id, vid: it.vid, qty: s.qty ? clampInt(it.qty, 1, s.qty.max) : 1, addons: addons, supply: supply };
    }).slice(0, 30);
  }

  /* ---------- pricing ---------- */
  function linePrice(it) {
    var s = byId[it.sid];
    var v = s.variants.filter(function (x) { return x.id === it.vid; })[0];
    var q = it.qty || 1;
    var lo = v.low * q, hi = v.high * q;
    s.addons.forEach(function (a) {
      var n = it.addons[a.id] || 0;
      if (!n) return;
      var mult = a.count ? n : (a.each ? q : 1);
      lo += a.low * mult; hi += a.high * mult;
    });
    return { low: lo, high: hi };
  }
  function totals(items) {
    var lo = 0, hi = 0;
    items.forEach(function (it) { var p = linePrice(it); lo += p.low; hi += p.high; });
    var r = data.roundTo || 5, min = data.minimumVisit || 0;
    var minApplied = items.length > 0 && lo < min;
    if (items.length) { lo = Math.max(lo, min); hi = Math.max(hi, min); }
    return { low: Math.floor(lo / r) * r, high: Math.ceil(hi / r) * r, minApplied: minApplied };
  }
  function describe(it) {
    var s = byId[it.sid];
    var v = s.variants.filter(function (x) { return x.id === it.vid; })[0];
    var sup = it.supply || {};
    var parts = [(s.qty && it.qty > 1 ? it.qty + " × " : "") + v.label];
    if (s.supply) parts.push(s.supply.label + (sup[s.supply.key] === "bg" ? " from Big Guava" : " supplied by you"));
    s.addons.forEach(function (a) {
      var n = it.addons[a.id];
      if (!n) return;
      var txt = a.count ? a.label + " × " + n : a.label;
      if (a.parts) txt += sup[a.id] === "bg" ? " (kit from Big Guava)" : " (you supply)";
      parts.push(txt);
    });
    return parts.join(" · ");
  }

  /* ---------- service menu ---------- */
  function draftFor(s) {
    var editUid = editing[s.id];
    var existing = editUid && cart.filter(function (c) { return c.uid === editUid; })[0];
    if (existing) return JSON.parse(JSON.stringify(existing));
    return { uid: null, sid: s.id, vid: s.variants[0].id, qty: 1, addons: {}, supply: {} };
  }

  function stepper(id, value, min, max, onChange, label) {
    var out = el("output", { id: id, "aria-live": "polite", text: String(value) });
    function set(n) { n = clampInt(n, min, max); out.textContent = String(n); onChange(n); }
    return el("div", { class: "stepper", role: "group", "aria-label": label }, [
      el("button", { type: "button", "aria-label": "Fewer", onclick: function () { set(parseInt(out.textContent, 10) - 1); } }, ["−"]),
      out,
      el("button", { type: "button", "aria-label": "More", onclick: function () { set(parseInt(out.textContent, 10) + 1); } }, ["+"])
    ]);
  }

  function supplyChoice(sid, key, label, d, onChange) {
    var name = "s-" + sid + "-" + key;
    var cur = (d.supply && d.supply[key]) || "home";
    function opt(val, text, price) {
      var id = name + "-" + val;
      return el("label", { class: "opt", for: id }, [
        el("input", { type: "radio", name: name, id: id, value: val, checked: cur === val,
          onchange: function () { if (!d.supply) d.supply = {}; if (val === "bg") d.supply[key] = "bg"; else delete d.supply[key]; onChange(); } }),
        el("span", { text: text }), el("span", { class: "price", text: price })
      ]);
    }
    return el("fieldset", { class: "supply" }, [
      el("legend", { class: "small", text: "Who supplies the " + label.replace(/^[A-Z][a-z]/, function (m) { return m.toLowerCase(); }) + "?" }),
      opt("home", "I'll supply it", "$0"),
      opt("bg", "Big Guava supplies it (we send you options)", "Cost + 15%")
    ]);
  }

  function renderBody(s, body) {
    var d = draftFor(s);
    var lineOut = el("span", { class: "line-range", "aria-live": "polite" });
    var addBtn = el("button", { type: "button", class: "btn btn-primary" });
    function refresh() {
      var p = linePrice(d);
      lineOut.textContent = rng(p.low, p.high);
      addBtn.textContent = d.uid ? "Update my list" : "Add to my list";
    }

    var variants = el("fieldset", null, [el("legend", { text: "Choose one" })]);
    s.variants.forEach(function (v) {
      var id = "v-" + s.id + "-" + v.id;
      var input = el("input", { type: "radio", name: "v-" + s.id, id: id, value: v.id, checked: d.vid === v.id,
        onchange: function () { d.vid = v.id; refresh(); } });
      variants.appendChild(el("label", { class: "opt", for: id }, [input, el("span", { text: v.label }), el("span", { class: "price", text: rng(v.low, v.high) })]));
    });
    body.appendChild(variants);
    if (s.supply) body.appendChild(supplyChoice(s.id, s.supply.key, s.supply.label, d, refresh));

    if (s.qty) {
      body.appendChild(el("div", { class: "qty-row" }, [
        el("span", { class: "small", text: s.qty.label }),
        stepper("q-" + s.id, d.qty, 1, s.qty.max, function (n) { d.qty = n; refresh(); }, s.qty.label)
      ]));
    }

    if (s.addons.length) {
      var adds = el("fieldset", null, [el("legend", { text: "Anything that makes the job bigger?" })]);
      s.addons.forEach(function (a) {
        var id = "a-" + s.id + "-" + a.id;
        var price = el("span", { class: "price" }, [addonText(a), a.each ? el("span", { class: "each", text: " each" }) : null]);
        if (a.count) {
          adds.appendChild(el("div", { class: "opt" }, [
            stepper(id, d.addons[a.id] || 0, 0, a.max || 10, function (n) { if (n) d.addons[a.id] = n; else delete d.addons[a.id]; refresh(); }, a.label),
            el("span", { text: a.label }), price
          ]));
        } else {
          var sub = a.parts ? supplyChoice(s.id, a.id, a.partLabel || a.label, d, refresh) : null;
          if (sub) sub.hidden = !d.addons[a.id];
          var cb = el("input", { type: "checkbox", id: id, checked: !!d.addons[a.id],
            onchange: function (e) {
              if (e.target.checked) d.addons[a.id] = 1; else { delete d.addons[a.id]; if (d.supply) delete d.supply[a.id]; }
              if (sub) { sub.hidden = !e.target.checked; if (!e.target.checked) sub.querySelector('input[value="home"]').checked = true; }
              refresh();
            } });
          adds.appendChild(el("label", { class: "opt", for: id }, [cb, el("span", { text: a.label }), price]));
          if (sub) adds.appendChild(sub);
        }
      });
      body.appendChild(adds);
    }

    addBtn.addEventListener("click", function () {
      if (d.uid) {
        cart = cart.map(function (c) { return c.uid === d.uid ? d : c; });
        delete editing[s.id];
      } else {
        if (cart.length >= 30) return;
        d.uid = uid();
        cart.push(d);
      }
      save(); renderCart(); renderMenu(s.id, false);
      var cartEl = document.getElementById("your-list");
      if (cartEl && window.matchMedia("(max-width: 60rem)").matches) announce("Added to your list.");
    });

    body.appendChild(el("div", { class: "svc-foot" }, [
      el("div", null, [el("div", { class: "small muted", text: "This job" }), lineOut]),
      addBtn
    ]));
    refresh();
  }

  var openId = null;
  function renderMenu(focusId, keepOpen) {
    var menu = document.getElementById("menu");
    menu.replaceChildren();
    if (focusId !== undefined) openId = keepOpen ? focusId : null;
    data.services.forEach(function (s) {
      var lo = Math.min.apply(null, s.variants.map(function (v) { return v.low; }));
      var isOpen = openId === s.id;
      var inList = cart.filter(function (c) { return c.sid === s.id; }).length;
      var bodyId = "body-" + s.id;
      var head = el("button", { type: "button", class: "svc-head", id: "head-" + s.id, "aria-expanded": isOpen ? "true" : "false", "aria-controls": bodyId,
        onclick: function () { openId = isOpen ? null : s.id; if (!isOpen) delete editing[s.id]; renderMenu(); var h = document.getElementById("head-" + s.id); if (h) h.focus(); } }, [
        el("strong", { text: s.name }),
        el("span", { class: "from", text: "from " + money(lo) }),
        el("span", { class: "sub", text: s.short + (inList ? "  (" + inList + " in your list)" : "") })
      ]);
      var body = el("div", { class: "svc-body", id: bodyId, hidden: !isOpen });
      if (isOpen) renderBody(s, body);
      menu.appendChild(el("section", { class: "svc", id: s.id }, [head, body]));
    });
  }

  /* ---------- cart ---------- */
  function renderCart() {
    var list = document.getElementById("cart-items");
    var totalEl = document.getElementById("cart-total");
    var bar = document.getElementById("range-fill");
    var scaleHi = document.getElementById("scale-hi");
    var notes = document.getElementById("cart-notes");
    var reqBtn = document.getElementById("to-request");
    var mobileTotal = document.getElementById("mobile-total");
    list.replaceChildren();
    notes.replaceChildren();

    if (!cart.length) {
      list.appendChild(el("li", { class: "empty" }, ["Your list is empty. Open a service on the left and add it here."]));
    }
    cart.forEach(function (it) {
      var s = byId[it.sid], p = linePrice(it);
      list.appendChild(el("li", null, [
        el("span", { class: "name", text: s.name }),
        el("span", { class: "amt", text: rng(p.low, p.high) + (partsFor(it).length ? " + parts" : "") }),
        el("span", { class: "detail", text: describe(it) }),
        el("span", { class: "row-actions" }, [
          el("button", { type: "button", class: "linkish", text: "Edit", "aria-label": "Edit " + s.name, onclick: function () {
            editing[s.id] = it.uid; openId = s.id; renderMenu(s.id, true);
            var h = document.getElementById("head-" + s.id); if (h) { h.scrollIntoView({ block: "start" }); h.focus(); }
          } }),
          el("button", { type: "button", class: "linkish", text: "Remove", "aria-label": "Remove " + s.name, onclick: function () {
            cart = cart.filter(function (c) { return c.uid !== it.uid; });
            if (editing[s.id] === it.uid) delete editing[s.id];
            save(); renderCart(); renderMenu(openId, !!openId);
          } })
        ])
      ]));
    });

    var t = totals(cart);
    var text = cart.length ? rng(t.low, t.high) : "$0";
    totalEl.textContent = text;
    if (mobileTotal) mobileTotal.textContent = text;

    var top = Math.max(500, Math.ceil((t.high * 1.2) / 250) * 250);
    bar.style.left = (cart.length ? (t.low / top) * 100 : 0) + "%";
    bar.style.width = (cart.length ? Math.max(1.5, ((t.high - t.low) / top) * 100) : 0) + "%";
    scaleHi.textContent = money(top);

    var allParts = [];
    cart.forEach(function (it) { partsFor(it).forEach(function (l) { if (allParts.indexOf(l) < 0) allParts.push(l); }); });
    if (allParts.length) notes.appendChild(el("p", { class: "note", text: "Plus products at our cost + 15%: " + allParts.join(", ") + ". We'll send you options and prices before buying anything." }));
    if (t.minApplied) notes.appendChild(el("p", { class: "note", text: "Includes the " + money(data.minimumVisit) + " minimum visit, which covers the trip and the first hour." }));
    if (t.high >= data.jobCap) notes.appendChild(el("p", { class: "warn", text: "This list may reach " + money(data.jobCap) + " or more. We only take on jobs under that amount, so send it anyway and we'll tell you which parts we can do." }));
    if (cart.length) notes.appendChild(el("p", { class: "note", text: "Includes labor and materials. This is a price range, not a quote. We confirm a firm price from your photos before anything is booked." }));
    reqBtn.disabled = !cart.length;
    document.body.classList.toggle("has-bar", true);
  }

  var live;
  function announce(msg) { if (live) { live.textContent = ""; setTimeout(function () { live.textContent = msg; }, 50); } }

  /* ---------- request form ---------- */
  function weekendOptions(select) {
    var d = new Date(); d.setHours(12, 0, 0, 0);
    var fmt = { weekday: "short", month: "short", day: "numeric" };
    var added = 0;
    for (var i = 1; i <= 50 && added < 8; i++) {
      var day = new Date(d.getTime() + i * 86400000);
      if (day.getDay() === 6 || day.getDay() === 0) {
        var label = day.toLocaleDateString("en-US", fmt);
        select.appendChild(el("option", { value: label, text: label }));
        added++;
      }
    }
    select.appendChild(el("option", { value: "Flexible", text: "I'm flexible" }));
  }

  function setupForm() {
    var form = document.getElementById("request-form");
    var status = document.getElementById("form-status");
    var section = document.getElementById("request");
    var photoNote = document.getElementById("photo-note");
    weekendOptions(document.getElementById("f-weekend"));
    if (photoNote) photoNote.textContent = "After you send this, text 2 to 4 photos of the job to " + (CFG.PHONE || "us") + ". Photos let us confirm your price quickly.";

    document.getElementById("to-request").addEventListener("click", function () {
      section.hidden = false;
      section.scrollIntoView({ block: "start" });
      document.getElementById("f-name").focus();
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.hidden = true;
      var fields = ["f-name", "f-phone", "f-email", "f-zip"];
      var bad = null;
      fields.forEach(function (id) {
        var input = document.getElementById(id);
        var ok = input.checkValidity();
        input.setAttribute("aria-invalid", ok ? "false" : "true");
        if (!ok && !bad) bad = input;
      });
      if (!cart.length) { showStatus("Add at least one job to your list first.", false); return; }
      if (bad) { showStatus("Check the highlighted fields: " + (bad.getAttribute("data-msg") || "this field is required") + ".", false); bad.focus(); return; }
      if (document.getElementById("f-botcheck").checked) return; // bots tick hidden boxes

      var t = totals(cart);
      var jobs = cart.map(function (it, i) { var p = linePrice(it); return (i + 1) + ". " + byId[it.sid].name + " (" + rng(p.low, p.high) + "): " + describe(it); }).join("\n");
      var name = clean(document.getElementById("f-name").value, 80);
      var payload = {
        access_key: CFG.WEB3FORMS_KEY,
        subject: "Estimate request " + rng(t.low, t.high) + " from " + name,
        from_name: "Big Guava website",
        name: name,
        phone: clean(document.getElementById("f-phone").value, 20),
        email: clean(document.getElementById("f-email").value, 120),
        zip: clean(document.getElementById("f-zip").value, 5),
        street: clean(document.getElementById("f-street").value, 120),
        weekend: clean(document.getElementById("f-weekend").value, 40),
        contact_by: clean(document.getElementById("f-contact").value, 10),
        estimated_range: rng(t.low, t.high),
        jobs: jobs,
        parts_at_cost_plus_15: (function () { var l = []; cart.forEach(function (it) { partsFor(it).forEach(function (x) { if (l.indexOf(x) < 0) l.push(x); }); }); return l.join(", ") || "None"; })(),
        notes: cleanMulti(document.getElementById("f-notes").value, 1500),
        botcheck: ""
      };

      if (Date.now() - lastSent < 60000) { showStatus("Your list was just sent. Wait a minute before sending again.", false); return; }
      var btn = document.getElementById("send-btn");
      btn.disabled = true; btn.textContent = "Sending…";

      if (!CFG.WEB3FORMS_KEY || CFG.WEB3FORMS_KEY === KEY_PLACEHOLDER) {
        // Preview mode: the form isn't connected to an inbox yet.
        setTimeout(function () { done(true, true); }, 400);
        return;
      }
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined,
        credentials: "omit",
        referrerPolicy: "strict-origin-when-cross-origin"
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return r.ok && j.success; }); })
        .then(function (ok) { done(ok, false); })
        .catch(function () { done(false, false); })
        .then(function () { if (timer) clearTimeout(timer); });

      function done(ok, preview) {
        btn.disabled = false; btn.textContent = "Send my list";
        if (ok) lastSent = Date.now();
        if (!ok) { showStatus("Your list didn't send. Check your connection and try again, or call or text " + (CFG.PHONE || "us") + ".", false); return; }
        cart = []; save(); renderCart(); renderMenu();
        form.hidden = true;
        var sent = document.getElementById("sent");
        sent.hidden = false;
        document.getElementById("sent-range").textContent = payload.estimated_range;
        document.getElementById("sent-preview").hidden = !preview;
        sent.scrollIntoView({ block: "start" });
        document.getElementById("sent-title").focus();
      }
    });

    function showStatus(msg, ok) {
      status.textContent = msg;
      status.className = "status " + (ok ? "ok" : "bad");
      status.hidden = false;
    }
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    live = document.getElementById("live");
    var root = document.documentElement.getAttribute("data-root") || "";
    fetch(root + "data/services.json", { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (json) {
        data = json;
        data.services.forEach(function (s) { byId[s.id] = s; });
        load(); save();
        var hash = (location.hash || "").replace("#", "");
        if (byId[hash]) openId = hash;
        renderMenu(); renderCart(); setupForm();
        if (byId[hash]) { var h = document.getElementById("head-" + hash); if (h) h.scrollIntoView({ block: "start" }); }
      })
      .catch(function () {
        document.getElementById("menu").replaceChildren(el("p", { class: "warn", text: "Prices didn't load. Refresh the page, or call or text " + (CFG.PHONE || "us") + " for an estimate." }));
      });
  });
})();
