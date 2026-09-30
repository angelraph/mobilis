"use strict";

// Sunburst: radiating lines in the spirit of Digital Asset's Canton hero.
(function sunburst() {
  const svg = document.getElementById("sunburst");
  if (!svg) return;
  const NS = "http://www.w3.org/2000/svg";
  const defs = document.createElementNS(NS, "defs");
  defs.innerHTML =
    '<linearGradient id="ray" x1="0" x2="1"><stop offset="0" stop-color="#6fd0b2" stop-opacity="0"/>' +
    '<stop offset="0.5" stop-color="#6fd0b2" stop-opacity="0.9"/><stop offset="1" stop-color="#2bb3f0" stop-opacity="0.9"/></linearGradient>';
  svg.appendChild(defs);
  const rays = 72;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * 360;
    const rect = document.createElementNS(NS, "rect");
    const long = i % 3 === 0;
    rect.setAttribute("x", long ? 150 : 200);
    rect.setAttribute("y", -3);
    rect.setAttribute("width", long ? 340 : 260);
    rect.setAttribute("height", long ? 7 : 4);
    rect.setAttribute("fill", "url(#ray)");
    rect.setAttribute("transform", `rotate(${angle})`);
    svg.appendChild(rect);
  }
})();

// Ledger feed: a replay of the recorded demo cycle, Bloomberg-style.
(function feed() {
  const list = document.getElementById("feed");
  if (!list) return;
  const events = [
    ["DELIVER", "UST-BILL 1,000,000 → posted <b>980,000</b>", "ok", "✓ valued"],
    ["AGREE", "Secured party · rules checked", "mid", "✓ eligible"],
    ["SETTLE", "Custodian · atomic", "ok", "✓ settled"],
    ["MARGIN", "Call +1,400,000 · coverage <b>70.0%</b>", "no", "short"],
    ["FULFIL", "Posted 980,000 below 1,400,000", "no", "✕ refused"],
    ["DELIVER", "IG-CORP 500,000 → posted <b>475,000</b>", "ok", "✓ 103.9%"],
    ["FULFIL", "Margin call covered", "ok", "✓ fulfilled"],
    ["OPTIMISE", "UST out → CASH 925,000 in", "mid", "✓ cheapest"],
    ["SWAP", "UST ⇄ CASH · one transaction", "ok", "✓ settled"],
    ["SWAP", "IG-CORP → CASH 100 · book short", "no", "✕ refused"],
    ["REPORT", "Regulator · coverage 100.0%", "ok", "✓ published"],
  ];
  // Timestamps are the viewer's real local time (the first few entries are
  // backdated a few seconds each), so the replay never shows a made-up clock.
  const MAX = 9;
  const SEED = 5;
  let i = 0;
  const stamp = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const tick = (secondsAgo = 0) => {
    const [kind, text, tone, result] = events[i % events.length];
    const [hh, mm, ss] = stamp(new Date(Date.now() - secondsAgo * 1000)).split(":");
    const li = document.createElement("li");
    li.innerHTML = `<span class="t">${hh}:${mm}:${ss}</span><span><span class="${tone}">${kind}</span> ${text}</span><span class="${tone}">${result}</span>`;
    list.prepend(li);
    while (list.children.length > MAX) list.lastElementChild.remove();
    i++;
  };
  for (let n = SEED; n > 0; n--) tick(n * 2);
  setInterval(() => tick(0), 1800);
})();

// Reveal sections as they scroll into view.
(function reveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.15 }
  );
  items.forEach((el) => io.observe(el));
})();

// Count proof numbers up when they appear, like a live figure.
(function counters() {
  const els = document.querySelectorAll("[data-count]");
  const run = (el) => {
    const to = parseInt(el.dataset.count, 10);
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 1200);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        run(e.target);
        io.unobserve(e.target);
      }
    }
  });
  els.forEach((el) => io.observe(el));
})();

// Copy buttons on command blocks.
document.querySelectorAll(".code .copy").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const text = btn.parentElement.querySelector("code").innerText;
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
    } catch (e) {
      btn.textContent = "Select & copy";
    }
    btn.classList.add("done");
    setTimeout(() => {
      btn.textContent = "Copy";
      btn.classList.remove("done");
    }, 1600);
  });
});
