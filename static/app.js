// GameBox 展示站 —— 目录搜索/筛选 + 复制 + 滚动淡入（零依赖）
(function () {
  "use strict";

  // ---- 复制（路径 / 代码 / 源码） ----
  function flash(btn) {
    btn.classList.add("done");
    var o = btn.textContent;
    btn.dataset._o = o;
    btn.textContent = "✓";
    setTimeout(function () { btn.textContent = btn.dataset._o || o; btn.classList.remove("done"); }, 1500);
  }
  document.addEventListener("click", function (ev) {
    var cp = ev.target.closest(".copy-path");
    if (cp) {
      navigator.clipboard.writeText(cp.dataset.copy || "").then(function () { flash(cp); });
      return;
    }
    var c = ev.target.closest(".copy");
    if (c) {
      var box = c.closest(".code") || c.closest("section");
      var pre = box ? box.querySelector("pre") : null;
      if (pre) navigator.clipboard.writeText(pre.innerText).then(function () { flash(c); });
    }
  });

  // ---- 目录搜索 + 依赖档位筛选 ----
  var search = document.getElementById("mod-search");
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  if (search || chips.length) {
    var tier = "all";
    var apply = function () {
      var q = ((search && search.value) || "").trim().toLowerCase();
      var anyGlobal = false;
      document.querySelectorAll(".cat-sec").forEach(function (sec) {
        var vis = 0;
        sec.querySelectorAll(".mcard").forEach(function (card) {
          var okT = tier === "all" || card.dataset.tier === tier;
          var okQ = !q || card.dataset.name.indexOf(q) >= 0 || card.dataset.func.indexOf(q) >= 0;
          var show = okT && okQ;
          card.hidden = !show;
          if (show) { vis++; anyGlobal = true; }
        });
        sec.hidden = vis === 0;
      });
      var em = document.getElementById("empty-msg");
      if (em) em.hidden = anyGlobal;
    };
    if (search) search.addEventListener("input", apply);
    chips.forEach(function (ch) {
      ch.addEventListener("click", function () {
        chips.forEach(function (c) { c.classList.remove("on"); });
        ch.classList.add("on");
        tier = ch.dataset.tier;
        apply();
      });
    });
  }

  // ---- 滚动淡入（带兜底：无论 IO 是否触发，内容都不会长期隐身） ----
  var reveals = document.querySelectorAll(".reveal");
  var revealAll = function () { reveals.forEach(function (el) { el.classList.add("in"); }); };
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } });
    }, { threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
    // 兜底：页面加载后仍未进入视口的段，1.2s 后统一显示（防 IO 时序/截图/异常导致内容不可见）
    window.addEventListener("load", function () { setTimeout(revealAll, 1200); });
  } else {
    revealAll();
  }
})();
