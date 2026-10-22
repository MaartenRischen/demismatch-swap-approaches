// The emotion glow, live in the browser over a still panel (see line/src/approaches/EMOTION.md, "Glow"). The June
// 2026 body-glow grammar, rebuilt in code: the wood is lit from inside, a hot core at the chest, the glow spreading
// through the torso, then the limbs and head as the feeling grows, with a soft bloom just past the silhouette and a
// little coloured light on what is near. Hue = the emotion's type; spread and brightness = its intensity.
// Only the glow moves: the still never changes.
// Each <canvas data-glow> carries data-base, data-mask, data-color, data-chest="x,y", data-body (px) and
// data-curve (the intensity per frame, 24 fps, comma separated).
(function () {
  var W = 1000, H = 590, FPS = 24;
  function load(src) { return new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = no; i.src = src; }); }
  function canvas() { var c = document.createElement('canvas'); c.width = W; c.height = H; return c; }
  function rgb(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')'; }
  function mixw(c, k) { return c.map(function (v) { return Math.round(v + (255 - v) * k); }); }
  function setup(cv) {
    return Promise.all([load(cv.dataset.base), load(cv.dataset.mask)]).then(function (im) {
      var base = im[0], m = canvas(), mx = m.getContext('2d');
      // the mask image is grey (white = the subject); turn it into an alpha mask
      mx.drawImage(im[1], 0, 0, W, H); var d = mx.getImageData(0, 0, W, H), p = d.data;
      for (var i = 0; i < p.length; i += 4) { p[i + 3] = p[i]; p[i] = p[i + 1] = p[i + 2] = 255; }
      mx.putImageData(d, 0, 0);
      // two blurred copies of the mask: a close halo hugging the outline, and a wide bloom
      var body = +cv.dataset.body, blurred = function (px) { var c = canvas(), x = c.getContext('2d'); x.filter = 'blur(' + px.toFixed(1) + 'px)'; x.drawImage(m, 0, 0); x.drawImage(m, 0, 0); x.drawImage(m, 0, 0); x.filter = 'none'; return c; };
      var blur = blurred(Math.max(4, body * 0.05)), wide = blurred(Math.max(10, body * 0.16));
      var ch = cv.dataset.chest.split(',').map(Number), col = rgb(cv.dataset.color), curve = cv.dataset.curve.split(',').map(Number);
      return { cv: cv, ctx: cv.getContext('2d'), base: base, mask: m, blur: blur, wide: wide, tmp: canvas(), chest: ch, body: body, col: col, hot: mixw(col, 0.55), curve: curve, on: false };
    });
  }
  // a radial colour field from the chest, cut to a mask, composited onto the panel
  function field(P, src, r, a0, col, op, alpha) {
    var t = P.tmp.getContext('2d'); t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, W, H);
    var g = t.createRadialGradient(P.chest[0], P.chest[1], 0, P.chest[0], P.chest[1], r);
    g.addColorStop(0, rgba(col, a0)); g.addColorStop(0.55, rgba(col, a0 * 0.85)); g.addColorStop(1, rgba(col, 0));
    t.fillStyle = g; t.fillRect(0, 0, W, H);
    if (src) { t.globalCompositeOperation = 'destination-in'; t.drawImage(src, 0, 0); }
    P.ctx.globalCompositeOperation = op; P.ctx.globalAlpha = alpha; P.ctx.drawImage(P.tmp, 0, 0);
    P.ctx.globalCompositeOperation = 'source-over'; P.ctx.globalAlpha = 1;
  }
  function draw(P, time) {
    var f = (time * FPS) % P.curve.length, i0 = Math.floor(f), k = f - i0, I = P.curve[i0] * (1 - k) + P.curve[(i0 + 1) % P.curve.length] * k;
    var c = P.ctx; c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.drawImage(P.base, 0, 0, W, H);
    if (I < 0.01) return;
    // how far through the body the glow has spread: a core at the chest at low intensity, the whole figure at 1
    var R = P.body * (0.22 + 1.55 * I);
    // the light it casts on what is near (the ground, the cot, the neighbours), first, under everything
    field(P, null, P.body * (0.7 + 1.4 * I), 0.32, P.col, 'screen', 0.85 * I);
    // the wood lit from inside: coloured through, then brightened (additive), as far as the glow has spread
    field(P, P.mask, R, 1, P.col, 'color', Math.min(1, 0.5 + 0.6 * I));
    field(P, P.mask, R, 1, P.col, 'lighter', 0.16 + 0.34 * I);
    // the hot core at the chest, nearly white at its heart
    field(P, P.mask, P.body * (0.14 + 0.42 * I), 1, P.hot, 'lighter', 0.28 + 0.5 * I);
    // the halo past the silhouette: close and bright, then a wide soft bloom
    field(P, P.blur, R * 1.12, 1, P.col, 'screen', 0.3 + 0.6 * I);
    field(P, P.wide, R * 1.25, 1, P.col, 'screen', 0.75 * I);
  }
  var items = [], reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, t0 = performance.now();
  // at most 30 frames a second: the glow moves slowly, and a desktop screen can hold eight cards
  var last = 0;
  function tick(now) { if (now - last > 32) { last = now; var t = (now - t0) / 1000; items.forEach(function (P) { if (P.on) draw(P, reduce ? 3 : t); }); } requestAnimationFrame(tick); }
  Promise.all([].slice.call(document.querySelectorAll('canvas[data-glow]')).map(setup)).then(function (ps) {
    items = ps;
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { var P = items.find(function (x) { return x.cv === e.target; }); if (P) { P.on = e.isIntersecting; if (P.on) draw(P, reduce ? 3 : (performance.now() - t0) / 1000); } }); }, { rootMargin: '100px' });
    items.forEach(function (P) { draw(P, 3); io.observe(P.cv); });
    requestAnimationFrame(tick);
  });
})();
