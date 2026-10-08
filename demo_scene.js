(() => {
'use strict';
const $ = id => document.getElementById(id);
if (typeof THREE === 'undefined') { $('fail').hidden = false; return; }

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const wrapPi = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const ease = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Settings come from config.js (window.AVATAR_CONFIG) and can be overridden in the page address:
   ?bg=green  ?ui=0  ?lang=en-GB */
const CFG = Object.assign({ lang: 'en-US', bg: 'studio', speechCommands: true, liveMusic: false, commands: [] }, window.AVATAR_CONFIG || {});
const QS = new URLSearchParams(location.search);
if (QS.get('bg')) CFG.bg = QS.get('bg');
if (QS.get('lang')) CFG.lang = QS.get('lang');
if (QS.get('ui') === '0') document.body.classList.add('noui');

/* ---------------------------------------------------------------
   Renderer + scene
---------------------------------------------------------------- */
const canvas = $('gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (e) { $('fail').hidden = false; return; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1216);
scene.fog = new THREE.Fog(0x0a1216, 11, 26);
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);

/* ---------------------------------------------------------------
   Avatar roster
---------------------------------------------------------------- */
const AV = [
  { name: 'Amara', skin: 0x8a5a3c, hair: 0x120b09, style: 'puff',  jacket: 0x2f6f73, shirt: 0xf3efe6, pants: 0x1d2b30, pitch: 1.15, rate: 1.0,  voice: 0 },
  { name: 'Theo',  skin: 0xe8bd9a, hair: 0x5a3a22, style: 'short', jacket: 0x33427a, shirt: 0xffffff, pants: 0x20233a, tie: 0xc23b3b, pitch: 0.9,  rate: 1.0,  voice: 1 },
  { name: 'Mei',   skin: 0xe2b48a, hair: 0x14121a, style: 'long',  jacket: 0x9b3a56, shirt: 0xf6e9d6, pants: 0x2a1f26, pitch: 1.25, rate: 1.02, voice: 2 },
  { name: 'Kofi',  skin: 0x5b3a28, hair: 0x0e0b0a, style: 'beard', jacket: 0xb5742a, shirt: 0xf4ecd8, pants: 0x2d2118, pitch: 0.72, rate: 0.96, voice: 3 }
];

/* ---------------------------------------------------------------
   Avatar rig. Faces +z, left side is +x. Origin at the floor.
---------------------------------------------------------------- */
function buildAvatar(s) {
  const M = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
  const skin = M(s.skin, .55), jacket = M(s.jacket, .8), shirt = M(s.shirt, .85), pants = M(s.pants, .85);
  const hairM = M(s.hair, .5), shoeM = M(0x15110f, .45), white = M(0xf5f2ec, .4);
  const dark = M(0x120a0a, .3), iris = M(0x3a2316, .4);
  const lipM = M(new THREE.Color(s.skin).multiplyScalar(.62).getHex(), .5);
  const noseM = M(new THREE.Color(s.skin).multiplyScalar(.92).getHex(), .6);
  const cavM = M(0x4a0f18, .6);

  const add = (p, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m;
  };
  const piv = (p, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
  const sphere = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
  const cylG = (a, b, h, n = 18) => new THREE.CylinderGeometry(a, b, h, n);

  const A = { spec: s, sh: [], el: [], lg: [], knee: [], ankle: [], eye: [], lid: [], brow: [] };
  A.root = new THREE.Group();
  A.hips = piv(A.root, 0, .96, 0);
  add(A.hips, cylG(.185, .17, .18, 20), pants).scale.z = .66;
  A.spine = piv(A.hips, 0, .07, 0);
  add(A.spine, cylG(.205, .165, .5, 24), jacket, 0, .24, 0).scale.z = .62;
  add(A.spine, new THREE.BoxGeometry(.1, .3, .02), shirt, 0, .31, .126);
  if (s.tie) add(A.spine, new THREE.BoxGeometry(.034, .24, .012), M(s.tie, .6), 0, .3, .138);
  add(A.spine, cylG(.048, .054, .12, 12), skin, 0, .5, 0);

  /* head */
  A.head = piv(A.spine, 0, .52, 0);
  A.fg = piv(A.head, 0, .17, 0);
  add(A.fg, sphere(.15, 28, 20), skin).scale.y = 1.1;
  for (const sd of [-1, 1]) add(A.fg, sphere(.026, 12, 8), skin, sd * .15, 0, 0).scale.set(.5, 1, .8);
  add(A.fg, sphere(.02, 12, 8), noseM, 0, -.012, .142).scale.set(1, 1.2, 1);

  for (const sd of [-1, 1]) {
    const g = piv(A.fg, sd * .058, .025, .126);
    const lid = piv(g, 0, 0, 0);
    add(lid, sphere(.027, 16, 12), white).scale.z = .6;
    add(lid, sphere(.0145, 12, 10), iris, 0, 0, .008).scale.z = .5;
    add(lid, sphere(.008, 10, 8), dark, 0, 0, .013).scale.z = .5;
    A.eye.push(g); A.lid.push(lid);
    add(A.fg, new THREE.BoxGeometry(.054, .006, .006), dark, sd * .058, .056, .14);
    const b = piv(A.fg, sd * .058, .078, .127);
    add(b, new THREE.BoxGeometry(.052, .011, .012), hairM);
    A.brow.push(b);
  }

  /* mouth */
  A.mouth = piv(A.fg, 0, -.07, .134);
  A.cav = add(A.mouth, sphere(1, 14, 10), cavM); A.cav.scale.set(.03, .004, .008); A.cav.castShadow = false;
  A.lipU = add(A.mouth, sphere(1, 12, 8), lipM); A.lipU.scale.set(.032, .0075, .01); A.lipU.castShadow = false;
  A.lipL = add(A.mouth, sphere(1, 12, 8), lipM); A.lipL.scale.set(.03, .0075, .01); A.lipL.castShadow = false;
  A.teeth = add(A.mouth, new THREE.BoxGeometry(.034, .007, .004), white, 0, -.006, .006); A.teeth.castShadow = false;
  A.smile = piv(A.fg, 0, -.066, .139);
  A.smile.scale.y = .35;
  const arc = add(A.smile, new THREE.TorusGeometry(.034, .0034, 6, 18, Math.PI), lipM); arc.rotation.z = Math.PI; arc.castShadow = false;

  /* hair */
  const cap = (len, tilt = -.3) => {
    const m = add(A.fg, new THREE.SphereGeometry(.157, 28, 18, 0, TAU, 0, len), hairM);
    m.scale.y = 1.1; m.rotation.x = tilt; return m;
  };
  if (s.style === 'puff') {
    cap(1.2);
    add(A.fg, sphere(.15, 22, 16), hairM, 0, .15, -.05).scale.set(1.18, 1, 1);
  } else if (s.style === 'short') {
    cap(1.2);
    add(A.fg, sphere(.1, 18, 12), hairM, .02, .125, .072).scale.set(1.1, .45, .7);
  } else if (s.style === 'long') {
    cap(1.35);
    add(A.fg, sphere(.17, 22, 16), hairM, 0, -.05, -.075).scale.set(1, 1.55, .6);
    for (const sd of [-1, 1]) add(A.fg, sphere(.05, 14, 10), hairM, sd * .142, -.03, 0).scale.set(.55, 2.4, .9);
  } else {
    cap(1.15);
    const beard = add(A.fg, new THREE.SphereGeometry(.158, 24, 12, 0, TAU, 2.15, 1.0), hairM);
    beard.scale.y = 1.1;
    add(A.fg, new THREE.BoxGeometry(.07, .012, .012), hairM, 0, -.05, .139);
  }

  /* arms */
  for (const side of [1, -1]) {
    const sh = piv(A.spine, side * .225, .45, 0);
    add(sh, sphere(.068), jacket);
    add(sh, cylG(.048, .044, .29, 14), jacket, 0, -.145, 0);
    const el = piv(sh, 0, -.29, 0);
    add(el, sphere(.045), jacket);
    add(el, cylG(.042, .036, .27, 14), jacket, 0, -.135, 0);
    add(el, cylG(.039, .039, .03, 14), shirt, 0, -.255, 0);
    const hand = piv(el, 0, -.28, 0);
    add(hand, sphere(.05, 14, 10), skin, 0, -.045, 0).scale.set(.9, 1.25, .65);
    add(hand, sphere(.016, 8, 6), skin, side * .03, -.03, .03);
    if (side === 1) {
      A.finger = add(hand, cylG(.011, .011, .08, 8), skin, 0, -.105, .008);
      A.finger.visible = false;
    }
    A.sh.push(sh); A.el.push(el);
  }

  /* legs */
  for (const side of [1, -1]) {
    const lg = piv(A.hips, side * .092, -.05, 0);
    add(lg, cylG(.08, .065, .44, 16), pants, 0, -.22, 0);
    const knee = piv(lg, 0, -.44, 0);
    add(knee, sphere(.066), pants);
    add(knee, cylG(.062, .048, .44, 16), pants, 0, -.22, 0);
    const ankle = piv(knee, 0, -.44, 0);
    add(ankle, new THREE.BoxGeometry(.095, .06, .24), shoeM, 0, 0, .05);
    A.lg.push(lg); A.knee.push(knee); A.ankle.push(ankle);
  }

  A.apply = applyPose;
  A.setFace = setFace;
  return A;
}

/* ---------------------------------------------------------------
   Pose: plain numbers that get damped toward targets every frame
---------------------------------------------------------------- */
const legY = (t, k) => .08 + .44 * (Math.cos(t) + Math.cos(t - k));

function newPose() {
  return {
    rx: 0, rz: 0, ry: 0, hy: .96, hp: 0, ht: 0, hr: 0,
    sp: 0, st: 0, sr: 0, nx: 0, ny: 0, nz: 0,
    a: [{ th: .15, ph: 1.5, e: .15 }, { th: .15, ph: 1.5, e: .15 }],
    l: [{ t: 0, z: .03, k: 0 }, { t: 0, z: .03, k: 0 }],
    pt: 0
  };
}
function resetTarget(T) {
  T.hy = .96; T.hp = T.ht = T.hr = 0; T.sp = T.st = T.sr = 0; T.nx = T.ny = T.nz = 0; T.pt = 0;
  for (let i = 0; i < 2; i++) {
    const a = T.a[i], l = T.l[i];
    a.th = .15; a.ph = 1.5; a.e = .15; l.t = 0; l.z = .03; l.k = 0;
  }
}
function blendPose(c, t, k) {
  for (const key in c) {
    const v = c[key];
    if (typeof v === 'number') { if (key !== 'rx' && key !== 'rz') c[key] = v + (t[key] - v) * k; }
    else if (Array.isArray(v)) v.forEach((o, i) => blendPose(o, t[key][i], k));
    else if (v && typeof v === 'object') blendPose(v, t[key], k);
  }
}

const _q = new THREE.Quaternion(), _d = new THREE.Vector3(), _dn = new THREE.Vector3(0, -1, 0);
function armQuat(q, side, th, ph) {
  _d.set(side * Math.sin(th) * Math.sin(ph), -Math.cos(th), Math.sin(th) * Math.cos(ph)).normalize();
  q.setFromUnitVectors(_dn, _d);
}
function applyPose(P) {
  this.root.position.set(P.rx, 0, P.rz);
  this.root.rotation.y = P.ry;
  this.hips.position.y = P.hy;
  this.hips.rotation.set(P.hp, P.ht, P.hr);
  this.spine.rotation.set(P.sp, P.st, P.sr);
  this.head.rotation.set(P.nx, P.ny, P.nz);
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1, a = P.a[i], l = P.l[i];
    armQuat(this.sh[i].quaternion, side, a.th, a.ph);
    this.el[i].rotation.x = -a.e;
    this.lg[i].rotation.set(-l.t, 0, side * l.z);
    this.knee[i].rotation.x = l.k;
    this.ankle[i].rotation.x = l.t - l.k;
  }
  this.finger.visible = P.pt > .5;
}

function newFace() { return { open: 0, wid: 1, smile: .3, brow: 0, tilt: 0, gx: 0, gy: 0, blink: 0 }; }
function setFace(F) {
  const sy = .004 + .036 * clamp(F.open, 0, 1), w = .03 * clamp(F.wid, .5, 1.5);
  this.cav.scale.set(w, sy, .008); this.cav.position.y = -sy;
  this.lipU.scale.x = w * 1.06; this.lipL.scale.x = w; this.lipL.position.y = -2 * sy;
  this.teeth.scale.x = clamp(F.wid, .6, 1.4); this.teeth.visible = F.open > .3;
  const showSmile = F.open < .12 && F.smile > .3;
  this.smile.visible = showSmile; this.lipU.visible = this.lipL.visible = !showSmile;
  this.smile.scale.x = .75 + .5 * F.smile;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    this.brow[i].position.y = .078 + F.brow * .018;
    this.brow[i].rotation.z = side * -F.tilt * .25 + F.brow * side * .08;
    this.eye[i].rotation.y = F.gx; this.eye[i].rotation.x = -F.gy;
    this.lid[i].scale.y = Math.max(.08, 1 - F.blink * .92);
  }
}

/* ---------------------------------------------------------------
   Avatar thumbnails for the picker (rendered once, then released)
---------------------------------------------------------------- */
function makeThumbs() {
  let r2;
  try { r2 = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { return []; }
  r2.setSize(150, 186); r2.setPixelRatio(1); r2.outputEncoding = THREE.sRGBEncoding;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xdfeaf0, 0x3a2c22, .9));
  const key = new THREE.DirectionalLight(0xfff0dc, .9); key.position.set(1.5, 3, 3); sc.add(key);
  const cam = new THREE.PerspectiveCamera(24, 150 / 186, .1, 20);
  cam.position.set(0, 1.28, 4.4); cam.lookAt(0, 1.18, 0);
  const urls = AV.map(s => {
    const a = buildAvatar(s); sc.add(a.root);
    const P = newPose(); P.ry = -.28; P.nx = 0; P.ny = .12;
    P.a[0].ph = 1.35; P.a[1].ph = 1.35; P.a[0].th = .12; P.a[1].th = .12;
    a.apply(P); a.setFace(Object.assign(newFace(), { smile: .8 }));
    r2.render(sc, cam);
    const u = r2.domElement.toDataURL('image/png');
    sc.remove(a.root);
    return u;
  });
  r2.dispose();
  if (r2.forceContextLoss) r2.forceContextLoss();
  return urls;
}

/* ---------------------------------------------------------------
   World: boardroom, whiteboard, chairs, audience, stage, particles
---------------------------------------------------------------- */
const MS = (c, r = .8, m = 0, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, extra || {}));
function mesh(parent, geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
const BoxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CylG = (a, b, h, n = 20) => new THREE.CylinderGeometry(a, b, h, n);

/* lights */
scene.add(new THREE.HemisphereLight(0xcfe0e8, 0x3a2b20, .62));
const key = new THREE.DirectionalLight(0xfff0dc, .95);
key.position.set(2.5, 6, 6); key.target.position.set(0, 0, 0);
key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -4, near: 1, far: 18 });
key.shadow.bias = -0.0006; key.shadow.camera.updateProjectionMatrix();
scene.add(key, key.target);
const spots = [0xff4fa3, 0x4fd2ff, 0xffc95a].map((c, i) => {
  const s = new THREE.SpotLight(c, 0, 14, .38, .6, 1);
  s.position.set([-3, 3, 0][i], 4.2, [2, 2, -1][i]);
  scene.add(s, s.target); return s;
});

/* room shell */
const room = new THREE.Group(); scene.add(room);
const floor = mesh(room, new THREE.PlaneGeometry(18, 14), MS(0x2b3b40, .35, .1), 0, 0, 1, false);
floor.rotation.x = -Math.PI / 2;
mesh(room, BoxG(18, 4.3, .1), MS(0x44606a, .9), 0, 2.15, -2.3, false);
mesh(room, BoxG(18, 1.0, .08), MS(0x7a5c40, .6), 0, .5, -2.2, false);
mesh(room, BoxG(18, .07, .12), MS(0xa07c58, .5), 0, 1.02, -2.18, false);
for (const sx of [-1, 1]) mesh(room, BoxG(.1, 4.3, 14), MS(0x3a5159, .9), sx * 8, 2.15, 1, false);
mesh(room, BoxG(18, .1, 14), MS(0x0f1a1e, 1), 0, 4.3, 1, false);
for (const x of [-3.5, 0, 3.5]) mesh(room, BoxG(2.6, .05, .35), MS(0xfff2d6, .4, 0, { emissive: 0xfff2d6, emissiveIntensity: 1 }), x, 4.24, -.4, false);

/* night skyline window */
function skylineTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 384; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 384); g.addColorStop(0, '#0e1b3a'); g.addColorStop(1, '#3a3f6b');
  x.fillStyle = g; x.fillRect(0, 0, 256, 384);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9; i++) {
    const w = 24 + rnd() * 36, h = 90 + rnd() * 190, bx = i * 30 - 8;
    x.fillStyle = '#0a1226'; x.fillRect(bx, 384 - h, w, h);
    for (let wy = 384 - h + 8; wy < 378; wy += 12) for (let wx = bx + 5; wx < bx + w - 6; wx += 10)
      if (rnd() > .55) { x.fillStyle = rnd() > .5 ? '#ffd98a' : '#bfe0ff'; x.fillRect(wx, wy, 4, 6); }
  }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
const win = new THREE.Group(); win.position.set(-3.5, 2.05, -2.22); room.add(win);
mesh(win, BoxG(1.9, 2.5, .06), MS(0x9aa7ad, .4, .5), 0, 0, 0, false);
mesh(win, new THREE.PlaneGeometry(1.7, 2.3), new THREE.MeshBasicMaterial({ map: skylineTex() }), 0, 0, .04, false);
mesh(win, BoxG(.05, 2.3, .05), MS(0x9aa7ad, .4, .5), 0, 0, .06, false);
mesh(win, BoxG(1.7, .05, .05), MS(0x9aa7ad, .4, .5), 0, .2, .06, false);

/* plants */
function plant(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); room.add(g);
  mesh(g, CylG(.22, .17, .4), MS(0x8a8f8c, .6), 0, .2, 0);
  const lm = MS(0x2f7a4a, .7);
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * TAU, l = mesh(g, new THREE.SphereGeometry(.16, 10, 8), lm, Math.cos(a) * .12, .75 + (i % 3) * .2, Math.sin(a) * .12);
    l.scale.set(.5, 2.2, .5); l.rotation.set(Math.sin(a) * .5, 0, -Math.cos(a) * .5);
  }
}
plant(-5.2, -1.5); plant(5.0, -1.6);

/* whiteboard */
const BOARD = { x: 1.35, y: 1.8, z: -2.12, w: 3.6, h: 2.025 };
const bc = document.createElement('canvas'); bc.width = 1024; bc.height = 576;
const bx = bc.getContext('2d');
const boardTex = new THREE.CanvasTexture(bc); boardTex.encoding = THREE.sRGBEncoding; boardTex.anisotropy = 4;
mesh(room, BoxG(BOARD.w + .14, BOARD.h + .14, .05), MS(0xb9c2c6, .35, .6), BOARD.x, BOARD.y, BOARD.z - .03, false);
mesh(room, new THREE.PlaneGeometry(BOARD.w, BOARD.h), new THREE.MeshBasicMaterial({ map: boardTex }), BOARD.x, BOARD.y, BOARD.z, false);
mesh(room, BoxG(BOARD.w * .7, .05, .1), MS(0xb9c2c6, .35, .6), BOARD.x, BOARD.y - BOARD.h / 2 - .09, BOARD.z + .04, false);
const boardPoint = (u, v) => new THREE.Vector3(BOARD.x + (u / 1024 - .5) * BOARD.w, BOARD.y - (v / 576 - .5) * BOARD.h, BOARD.z + .05);

/* chairs and table */
function makeChair(exec, col) {
  const g = new THREE.Group(), m = MS(col, .7), steel = MS(0x20262a, .4, .6);
  const w = exec ? .66 : .5, back = exec ? 1.05 : .55;
  mesh(g, BoxG(w, .09, w * .95), m, 0, .41, 0);
  const b = mesh(g, BoxG(w, back, .08), m, 0, .45 + back / 2, -w * .46); b.rotation.x = -.08;
  if (exec) {
    mesh(g, BoxG(.34, .22, .1), m, 0, .45 + back + .08, -w * .46 - .02);
    for (const s of [-1, 1]) { mesh(g, BoxG(.07, .05, .5), steel, s * (w / 2 + .03), .69, -.02); mesh(g, BoxG(.05, .22, .05), steel, s * (w / 2 + .03), .58, .06); }
  }
  mesh(g, CylG(.035, .035, .34, 10), steel, 0, .2, 0);
  mesh(g, CylG(.27, .27, .03, 5), steel, 0, .03, 0);
  return g;
}
const tableG = new THREE.Group(); scene.add(tableG);
mesh(tableG, BoxG(1.05, .06, 2.9), MS(0x6b4a30, .35), 3.3, .75, .6);
for (const dx of [-.42, .42]) for (const dz of [-1.3, 1.3]) mesh(tableG, BoxG(.06, .72, .06), MS(0x20262a, .4, .6), 3.3 + dx, .36, .6 + dz);
for (const z of [-.5, .6, 1.7]) {
  const l = makeChair(false, 0x2c3e48); l.position.set(2.45, 0, z); l.rotation.y = Math.PI / 2; tableG.add(l);
  const r = makeChair(false, 0x2c3e48); r.position.set(4.15, 0, z); r.rotation.y = -Math.PI / 2; tableG.add(r);
}
const CHAIR = { x: 0, z: .4 };
const execChair = makeChair(true, 0x2a1f24); execChair.position.set(CHAIR.x, 0, CHAIR.z); execChair.visible = false; scene.add(execChair);
const rug = mesh(scene, new THREE.CircleGeometry(1.7, 48), MS(0x5a2430, 1), CHAIR.x, .006, CHAIR.z + .4, false);
rug.rotation.x = -Math.PI / 2; rug.visible = false;

/* celebration stage + trophy */
const stageG = new THREE.Group(); stageG.visible = false; scene.add(stageG);
mesh(stageG, CylG(1.7, 1.8, .1, 48), MS(0x1c1b2e, .4, .3), 0, .05, .6);
const ring = mesh(stageG, new THREE.TorusGeometry(1.72, .03, 8, 64), new THREE.MeshBasicMaterial({ color: 0xffc95a }), 0, .11, .6, false);
ring.rotation.x = Math.PI / 2;
const trophy = new THREE.Group(); trophy.position.set(2.5, 0, .5); stageG.add(trophy);
const gold = MS(0xf2c14e, .25, .85, { emissive: 0x3a2400, emissiveIntensity: .6 });
mesh(trophy, BoxG(.5, .55, .5), MS(0x1c1b2e, .4, .3), 0, .275, 0);
const cupPts = [[.0, 0], [.12, 0], [.05, .06], [.04, .2], [.12, .3], [.2, .45], [.22, .62], [.17, .62], [.08, .5], [0, .46]].map(p => new THREE.Vector2(p[0], p[1]));
mesh(trophy, new THREE.LatheGeometry(cupPts, 24), gold, 0, .56, 0).scale.setScalar(1.5);
for (const s of [-1, 1]) { const h = mesh(trophy, new THREE.TorusGeometry(.12, .02, 8, 16, Math.PI), gold, s * .33, 1.12, 0); h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2; }

/* audience (backs of heads, facing the stage) */
const audienceG = new THREE.Group(); audienceG.visible = false; scene.add(audienceG);
const people = [];
{
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const skins = [0x8a5a3c, 0xe8bd9a, 0xc98f66, 0x5b3a28, 0xf0c8a8], hairs = [0x120b09, 0x3a2a1c, 0x6a4a2a, 0x1c1c26, 0x8a8a90];
  const shirts = [0x3b5b8a, 0x8a3b4b, 0x3b7a5a, 0x7a6a3b, 0x5b3b7a, 0x2c3e48];
  [[3.5, [-3.3, -2.2, -1.1, 1.1, 2.2, 3.3]], [4.6, [-3.85, -2.75, -1.65, -.8, .8, 1.65, 2.75, 3.85]]].forEach(([z, xs]) => xs.forEach(x => {
    const g = new THREE.Group(); g.position.set(x, 0, z + (rnd() - .5) * .2); g.rotation.y = Math.PI;
    const sk = MS(skins[(rnd() * 5) | 0], .6);
    mesh(g, CylG(.22, .2, .55), MS(shirts[(rnd() * 6) | 0], .8), 0, .74, 0).scale.z = .7;
    const head = new THREE.Group(); head.position.y = 1.1; g.add(head);
    mesh(head, new THREE.SphereGeometry(.115, 16, 12), sk, 0, 0, 0);
    mesh(head, new THREE.SphereGeometry(.12, 16, 12, 0, TAU, 0, 1.9), MS(hairs[(rnd() * 5) | 0], .6), 0, .01, -.01);
    const arms = [1, -1].map(s => {
      const p = new THREE.Group(); p.position.set(s * .23, .96, 0); g.add(p);
      mesh(p, CylG(.035, .035, .5, 8), sk, 0, -.25, 0); p.rotation.z = s * .12; return p;
    });
    audienceG.add(g);
    people.push({ g, head, arms, ph: rnd() * TAU, row: z });
  }));
}
function updateAudience(t, mode, beat, handUp) {
  people.forEach((p, i) => {
    const cheer = mode === 'celebrate';
    p.head.rotation.y = Math.sin(t * .6 + p.ph) * .12;
    p.head.rotation.x = cheer ? Math.sin(t * 8 + p.ph) * .05 : Math.sin(t * .9 + p.ph) * .03;
    p.g.position.y = cheer ? Math.abs(Math.sin(beat * Math.PI + p.ph * .3)) * .07 : 0;
    p.arms.forEach((a, k) => {
      const s = k === 0 ? 1 : -1;
      let z = s * .12, x = 0;
      if (cheer) { z = s * (2.5 + Math.sin(t * 7 + p.ph + k) * .35); }
      else if (handUp && i === 4 && k === 0) { z = s * (2.9 + Math.sin(t * 3) * .1); }
      a.rotation.z += (z - a.rotation.z) * .15; a.rotation.x = x;
    });
  });
}

/* falling particles: soft dust normally, confetti when celebrating */
const NP = 420;
const cGeo = new THREE.PlaneGeometry(.075, .042);
const cMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: .9 });
const conf = new THREE.InstancedMesh(cGeo, cMat, NP); conf.frustumCulled = false; scene.add(conf);
const PAL = [0xff4fa3, 0x4fd2ff, 0xffc95a, 0x7cf29a, 0xffffff, 0xff5a47];
const parts = [];
const _o = new THREE.Object3D(), _c = new THREE.Color();
for (let i = 0; i < NP; i++) {
  parts.push({ x: 0, y: -9, z: 0, vx: 0, vy: 0, vz: 0, rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6, sx: (Math.random() - .5) * 6, sy: (Math.random() - .5) * 6, ph: Math.random() * 6, f: .5 + Math.random(), s: .6 + Math.random() * .8 });
  conf.setColorAt(i, _c.set(0xffe9b0));
}
let partMode = 'dust', partCount = 0, partFall = .3;
function respawn(p, anywhere) {
  p.x = (Math.random() - .5) * 11; p.z = -1.5 + Math.random() * 6; p.y = anywhere ? Math.random() * 4.2 : 4.3 + Math.random() * .6;
  p.vx = p.vz = 0; p.vy = 0;
}
function setParticleMode(m) {
  partMode = m;
  partCount = m === 'party' ? Math.round(NP * (RM ? .45 : 1)) : (RM ? 25 : 70);
  partFall = m === 'party' ? 1.1 : .28;
  for (let i = 0; i < NP; i++) {
    conf.setColorAt(i, _c.set(m === 'party' ? PAL[i % PAL.length] : 0xffe9b0));
    if (i < partCount) respawn(parts[i], true);
  }
  conf.instanceColor.needsUpdate = true;
  cMat.opacity = m === 'party' ? .95 : .5;
}
function burst(x, y, z, n) {
  for (let i = 0; i < n && i < partCount; i++) {
    const p = parts[(Math.random() * partCount) | 0];
    p.x = x + (Math.random() - .5) * .4; p.y = y; p.z = z + (Math.random() - .5) * .4;
    const a = Math.random() * TAU, sp = 1.5 + Math.random() * 3.2;
    p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp * .6; p.vy = 3 + Math.random() * 3.4;
  }
}
function updateParticles(dt, t) {
  for (let i = 0; i < NP; i++) {
    const p = parts[i];
    if (i >= partCount) { _o.scale.set(0, 0, 0); _o.position.set(0, -9, 0); }
    else {
      p.vy += (-partFall * p.s - p.vy) * Math.min(1, dt * 1.4);
      p.vx *= 1 - Math.min(1, dt * .9); p.vz *= 1 - Math.min(1, dt * .9);
      p.x += (p.vx + Math.sin(t * p.f + p.ph) * .35) * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rx += p.sx * dt; p.ry += p.sy * dt;
      if (p.y < 0.02) respawn(p, false);
      _o.position.set(p.x, p.y, p.z); _o.rotation.set(p.rx, p.ry, p.rz);
      const sc = partMode === 'party' ? p.s : p.s * 1.1; _o.scale.set(sc, sc, sc);
    }
    _o.updateMatrix(); conf.setMatrixAt(i, _o.matrix);
  }
  conf.instanceMatrix.needsUpdate = true;
}
setParticleMode('dust');

if (CFG.bg === 'green') { scene.background = new THREE.Color(0x00b140); scene.fog = null; room.visible = false; }

/* ---------------------------------------------------------------
   Whiteboard drawing
---------------------------------------------------------------- */
const TEAMS = [['Blue', 72, '#2563c9'], ['Gold', 91, '#d99a00'], ['Green', 64, '#2a8f5a'], ['Red', 58, '#d9402f']];
let boardStep = 0, boardMode = 'present', pointPx = null;
const stepT0 = [0, 0, 0, 0, 0];
const HAND = "'Caveat', 'Comic Sans MS', cursive";

function drawBoard(t) {
  const c = bx; c.clearRect(0, 0, 1024, 576);
  c.lineCap = 'round'; c.textBaseline = 'alphabetic';
  if (boardMode === 'celebrate') {
    const g = c.createLinearGradient(0, 0, 1024, 576); g.addColorStop(0, '#1b1440'); g.addColorStop(1, '#4a1d6b');
    c.fillStyle = g; c.fillRect(0, 0, 1024, 576);
    c.textAlign = 'center'; c.fillStyle = '#ffd36b'; c.font = '700 120px ' + HAND; c.fillText('CHAMPIONS', 512, 250);
    c.fillStyle = '#fff'; c.font = '700 64px ' + HAND; c.fillText('Quiz score: 10 / 10', 512, 350);
    for (let i = 0; i < 9; i++) {
      const a = t * .8 + i * .7, x = 120 + i * 98, y = 450 + Math.sin(a) * 18;
      c.fillStyle = ['#ff4fa3', '#4fd2ff', '#ffc95a'][i % 3]; c.beginPath();
      for (let k = 0; k < 10; k++) { const r = k % 2 ? 11 : 26, an = k * Math.PI / 5 + a; c.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); }
      c.closePath(); c.fill();
    }
    boardTex.needsUpdate = true; return;
  }
  c.fillStyle = '#f7f7f4'; c.fillRect(0, 0, 1024, 576);
  c.textAlign = 'center';
  if (boardMode === 'sit') {
    c.fillStyle = '#d9402f'; c.font = '700 130px ' + HAND; c.fillText('Questions?', 512, 250);
    c.fillStyle = '#1d2a33'; c.font = '600 54px ' + HAND;
    c.fillText('Scoring  -  Teams  -  Next round', 512, 360);
    c.strokeStyle = '#2563c9'; c.lineWidth = 6; c.beginPath(); c.moveTo(250, 280); c.quadraticCurveTo(512, 300, 774, 275); c.stroke();
    boardTex.needsUpdate = true; return;
  }
  c.fillStyle = '#1d2a33'; c.font = '700 64px ' + HAND; c.fillText('Quiz Night: Round Review', 512, 80);
  c.strokeStyle = '#d9402f'; c.lineWidth = 6; c.beginPath(); c.moveTo(250, 100); c.lineTo(250 + 524 * ease((t - stepT0[1]) / .8), 104); c.stroke();
  if (boardStep >= 2) {
    c.strokeStyle = '#1d2a33'; c.lineWidth = 4; c.beginPath(); c.moveTo(150, 160); c.lineTo(150, 440); c.lineTo(880, 440); c.stroke();
    TEAMS.forEach((tm, i) => {
      const p = ease((t - stepT0[2] - i * .18) / 1.1), h = tm[1] * 2.6 * p, x = 230 + i * 170;
      c.fillStyle = tm[2]; c.fillRect(x, 440 - h, 100, h);
      c.fillStyle = '#1d2a33'; c.font = '600 38px ' + HAND; c.fillText(tm[0], x + 50, 480);
      if (p > .95) c.fillText(String(tm[1]), x + 50, 430 - h);
    });
  }
  if (boardStep >= 3) {
    const p = ease((t - stepT0[3]) / 1.0);
    c.strokeStyle = '#d9402f'; c.lineWidth = 6; c.beginPath(); c.ellipse(450, 290, 80, 170, 0, 0, TAU * p); c.stroke();
    if (p > .8) { c.fillStyle = '#d9402f'; c.font = '700 44px ' + HAND; c.fillText('perfect round 3!', 690, 215); }
  }
  if (boardStep >= 4) {
    const p = ease((t - stepT0[4]) / 1.0), txt = 'Accuracy beats speed', n = Math.floor(txt.length * p);
    c.strokeStyle = '#2a8f5a'; c.lineWidth = 5; c.strokeRect(300, 505, 424, 56);
    c.fillStyle = '#2a8f5a'; c.font = '700 46px ' + HAND; c.fillText(txt.slice(0, n), 512, 548);
  }
  if (pointPx) {
    const r = 12 + Math.sin(t * 8) * 3, g = c.createRadialGradient(pointPx[0], pointPx[1], 0, pointPx[0], pointPx[1], r * 2.4);
    g.addColorStop(0, 'rgba(255,60,40,.95)'); g.addColorStop(1, 'rgba(255,60,40,0)');
    c.fillStyle = g; c.fillRect(pointPx[0] - 40, pointPx[1] - 40, 80, 80);
  }
  boardTex.needsUpdate = true;
}

/* ---------------------------------------------------------------
   Sound: music engine (beat clock) + voice (mouth + gesture sync)
---------------------------------------------------------------- */
const Snd = {
  ctx: null, master: null, on: true,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.on ? 1 : 0; this.master.connect(c.destination);
    const len = c.sampleRate; this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return c;
  },
  set(on) { this.on = on; if (this.master) this.master.gain.value = on ? 1 : 0; }
};
function tone(type, f0, f1, t, dur, vol, filt) {
  const c = Snd.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  let n = o; if (filt) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt; o.connect(f); n = f; }
  n.connect(g); g.connect(Snd.master); o.start(t); o.stop(t + dur + .02);
}
function noiseHit(t, dur, vol, hp) {
  const c = Snd.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = Snd.noise; f.type = 'highpass'; f.frequency.value = hp;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f); f.connect(g); g.connect(Snd.master); s.start(t); s.stop(t + dur + .02);
}
const BASS = [110, 87.3, 130.8, 98];
const Music = {
  on: false, bpm: 112, t0: 0, p0: 0, step: 0, nextT: 0, timer: 0,
  start() {
    this.stop(); const c = Snd.init(); this.on = true; this.p0 = performance.now() / 1000;
    if (!c) return; this.step = 0; this.t0 = c.currentTime + .12; this.nextT = this.t0;
    this.timer = setInterval(() => this.sched(), 40);
  },
  startSilent() { this.stop(); this.on = true; this.p0 = performance.now() / 1000; },
  stop() { this.on = false; if (this.timer) clearInterval(this.timer); this.timer = 0; },
  beat() {
    const c = Snd.ctx;
    if (c && this.timer) return Math.max(0, (c.currentTime - (c.outputLatency || c.baseLatency || 0) - this.t0) * this.bpm / 60);
    return (performance.now() / 1000 - this.p0) * this.bpm / 60;
  },
  sched() {
    const c = Snd.ctx, spb = 60 / this.bpm / 4;
    while (this.nextT < c.currentTime + .2) {
      const s = this.step % 16, bar = ((this.step / 16) | 0) % 4, t = this.nextT;
      if (s % 4 === 0) tone('sine', 160, 45, t, .3, .9);
      if (s === 4 || s === 12) { noiseHit(t, .15, .35, 1500); tone('triangle', 190, 120, t, .1, .25); }
      if (s % 4 === 2) noiseHit(t, .06, .22, 7000);
      if ([0, 3, 6, 8, 10, 12, 14].includes(s)) tone('sawtooth', BASS[bar], 0, t, .2, .32, 420);
      if (s === 2 || s === 10) [1, 1.26, 1.5].forEach(m => tone('square', BASS[bar] * 2 * m, 0, t, .14, .07, 1800));
      this.nextT += spb; this.step++;
    }
  }
};

const Voice = { open: 0, wid: 1, beat: 0, side: 0, speaking: false, wordIdx: -1 };
let vTL = null, vT0 = 0, vCur = 0, vWaiting = false, vDone = null, vTarget = [0, 1];
const nowS = () => performance.now() / 1000;
const VOW = { a: [.9, 1.05], e: [.55, 1.25], i: [.4, 1.35], o: [.8, .68], u: [.5, .55], y: [.4, 1.2] };
function buildTL(text, rate) {
  const ev = [], words = []; let t = 0, inWord = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i].toLowerCase();
    if (/[a-z0-9']/.test(ch)) {
      if (!inWord) { words.push({ t, ci: i }); inWord = true; }
      if (VOW[ch]) { ev.push({ t, o: VOW[ch][0], w: VOW[ch][1] }); t += .1 / rate; }
      else if ('mbp'.includes(ch)) { ev.push({ t, o: 0, w: 1 }); t += .06 / rate; }
      else if ('fv'.includes(ch)) { ev.push({ t, o: .15, w: 1 }); t += .06 / rate; }
      else if ('wqr'.includes(ch)) { ev.push({ t, o: .3, w: .6 }); t += .06 / rate; }
      else { ev.push({ t, o: .25, w: 1.1 }); t += .055 / rate; }
    } else {
      inWord = false; ev.push({ t, o: 0, w: 1 });
      t += (',;:'.includes(ch) ? .2 : '.?!'.includes(ch) ? .38 : .04) / rate;
    }
  }
  return { ev, words, dur: t };
}
function finishVoice() { vTL = null; Voice.speaking = false; vTarget = [0, 1]; Voice.wordIdx = 99999; if (vDone) { const d = vDone; vDone = null; d(); } }
function cancelVoice() {
  try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  if (vDone) finishVoice(); else vTL = null;
  Voice.speaking = false; vTarget = [0, 1];
}
function speak(text, spec) {
  return new Promise(res => {
    cancelVoice();
    const tl = buildTL(text, spec.rate); vTL = tl; vCur = 0; vWaiting = true; Voice.wordIdx = -1; vDone = res;
    const started = () => { if (vTL === tl && vWaiting) { vWaiting = false; vT0 = nowS(); Voice.speaking = true; } };
    let usedTTS = false;
    if (Snd.on && 'speechSynthesis' in window) {
      try {
        const u = new SpeechSynthesisUtterance(text);
        const en = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
        if (en.length) u.voice = en[spec.voice % en.length];
        u.pitch = spec.pitch; u.rate = spec.rate;
        u.onstart = started;
        u.onboundary = e => {
          if (vTL !== tl) return; started();
          let w = null; for (const x of tl.words) if (x.ci <= e.charIndex) w = x; if (w) vT0 = nowS() - w.t;
        };
        u.onend = u.onerror = () => { if (vTL === tl) finishVoice(); };
        speechSynthesis.speak(u); usedTTS = true; tl.tts = true;
      } catch (e) { usedTTS = false; }
    }
    setTimeout(started, usedTTS ? 2500 : 50);
  });
}
function updateVoice(dt) {
  if (Live.active && Live.an) liveUpdate(dt);
  else if (vTL && !vWaiting) {
    const t = nowS() - vT0;
    while (vCur < vTL.ev.length && vTL.ev[vCur].t <= t) { vTarget = [vTL.ev[vCur].o, vTL.ev[vCur].w]; vCur++; }
    let wi = -1; vTL.words.forEach((w, i) => { if (w.t <= t) wi = i; });
    if (wi !== Voice.wordIdx) {
      Voice.wordIdx = wi;
      if (wi >= 0 && (wi % 3 === 0 || (vTL.words[wi + 1] && vTL.words[wi + 1].ci - vTL.words[wi].ci > 5))) { Voice.beat = 1; Voice.side = 1 - Voice.side; }
      updateCaptionWords(wi);
    }
    if (t > vTL.dur + (vTL.tts ? 6 : .3)) finishVoice();
  }
  const k = 1 - Math.exp(-dt * 26);
  Voice.open += (vTarget[0] - Voice.open) * k; Voice.wid += (vTarget[1] - Voice.wid) * k;
  Voice.beat *= Math.exp(-dt * 5);
}
const capEl = $('caption');
let capWords = [];
function setCaption(text) {
  capEl.textContent = '';
  capWords = text.split(' ').map(w => { const s = document.createElement('span'); s.className = 'w'; s.textContent = w + ' '; capEl.appendChild(s); return s; });
}
function updateCaptionWords(wi) { capWords.forEach((s, i) => s.classList.toggle('on', i <= wi)); }


/* ---------------------------------------------------------------
   Live input: the microphone drives mouth and gestures,
   recognised speech drives mode changes (see config.js)
---------------------------------------------------------------- */
const Live = { active: false, an: null, buf: null, fq: null, floor: .02, avg: 0, hold: 0, lastBeat: 0, rec: null, stream: null, lastCmd: {}, seen: {} };
const PT = [null, [512, 90], [512, 330], [450, 260], [512, 530]];

function liveUpdate(dt) {
  Live.an.getByteTimeDomainData(Live.buf);
  let s = 0; for (let i = 0; i < Live.buf.length; i++) { const x = (Live.buf[i] - 128) / 128; s += x * x; }
  const rms = Math.sqrt(s / Live.buf.length);
  Live.floor = Math.min(rms, Live.floor * 1.002 + 1e-5);
  const level = Math.max(0, rms - Live.floor * 1.6 - .004);
  Live.an.getByteFrequencyData(Live.fq);
  let num = 0, den = 0; for (let i = 1; i < 96; i++) { num += i * Live.fq[i]; den += Live.fq[i]; }
  const cen = den > 0 ? num / den / 96 : .3;
  Live.hold = level > .012 ? .25 : Math.max(0, Live.hold - dt);
  Voice.speaking = Live.hold > 0;
  vTarget = [clamp(level * 10, 0, 1), lerp(.7, 1.3, clamp(cen * 2.2, 0, 1))];
  const t = nowS();
  if (level > Live.avg * 1.6 + .02 && t - Live.lastBeat > .3) { Voice.beat = 1; Voice.side = 1 - Voice.side; Live.lastBeat = t; }
  Live.avg += (level - Live.avg) * Math.min(1, dt * 4);
}

function liveBoard(dir) {
  if (mode !== 'present') startMode('present');
  boardStep = clamp(boardStep + dir, 1, 4); stepT0[boardStep] = clock;
  line = { focus: 'board', pt: PT[boardStep], t: '' }; lineT = 0;
}
function runAction(a) {
  if (a.indexOf('mode:') === 0) { const m = a.slice(5); if (m !== mode) startMode(m); }
  else if (a === 'board:next') liveBoard(1);
  else if (a === 'board:back') liveBoard(-1);
}
function handleCommand(text) {
  const now = nowS();
  for (const c of CFG.commands || []) {
    if (!c.words.some(w => text.indexOf(w) >= 0)) continue;
    if (now - (Live.lastCmd[c.action] || 0) < 3) continue;
    Live.lastCmd[c.action] = now; runAction(c.action); return;
  }
}
function setLiveCaption(text) { capEl.textContent = text; capWords = []; }

async function liveEnter(m, token) {
  await waitFor(() => token !== runToken || phase === 'talk' || phase === 'dance');
  if (token !== runToken) return;
  if (m === 'celebrate') {
    if (CFG.liveMusic) { Snd.init(); Music.start(); } else Music.startSilent();
    burst(0, 2.2, .6, 220);
  }
}

function startRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!CFG.speechCommands || !SR) { setLiveCaption(SR ? 'Live. Voice commands are off in config.js. Use keys 1, 2, 3.' : 'Live. This browser has no speech recognition, so use keys 1, 2, 3 to change mode. Chrome and Edge support voice commands.'); return; }
  const r = new SR(); Live.rec = r; Live.seen = {};
  r.continuous = true; r.interimResults = true; r.lang = CFG.lang;
  r.onresult = e => {
    let shown = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const txt = e.results[i][0].transcript, low = txt.toLowerCase(), prev = Live.seen[i] || 0;
      if (low.length > prev) handleCommand(low.slice(Math.max(0, prev - 20)));
      Live.seen[i] = low.length; shown = txt.trim();
    }
    if (shown) setLiveCaption(shown);
  };
  r.onend = () => { Live.seen = {}; if (Live.active && Live.rec === r) { try { r.start(); } catch (e) { /* already running */ } } };
  r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setLiveCaption('Speech recognition is blocked. Voice commands are off; use keys 1, 2, 3.'); };
  try { r.start(); } catch (e) { /* ignore */ }
  setLiveCaption('Live. Speak and the avatar follows. Say \u201cwe won\u201d to celebrate, or \u201ctake a seat\u201d to sit.');
}

async function liveStart() {
  const c = Snd.init();
  if (!c || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setLiveCaption('This browser cannot open the microphone. Open the page at http://localhost in Chrome or Edge.'); return; }
  try { Live.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) { setLiveCaption('Microphone is blocked. Allow it from the address bar, then press Go live again.'); return; }
  const src = c.createMediaStreamSource(Live.stream), an = c.createAnalyser();
  an.fftSize = 1024; src.connect(an);
  Live.an = an; Live.buf = new Uint8Array(an.fftSize); Live.fq = new Uint8Array(an.frequencyBinCount);
  Live.floor = .02; Live.avg = 0; Live.active = true;
  runToken++; cancelVoice(); line = null; waiters.length = 0;
  const b = $('live'); b.setAttribute('aria-pressed', 'true'); b.textContent = 'Stop live';
  if (mode === 'idle') startMode('present'); else startMode(mode);
  startRecognition();
}
function liveStop() {
  Live.active = false;
  if (Live.rec) { const r = Live.rec; Live.rec = null; try { r.stop(); } catch (e) { /* ignore */ } }
  if (Live.stream) Live.stream.getTracks().forEach(t => t.stop());
  Live.an = null; Voice.speaking = false; vTarget = [0, 1];
  const b = $('live'); b.setAttribute('aria-pressed', 'false'); b.textContent = 'Go live';
  setCaption('Live stopped.');
}

/* ---------------------------------------------------------------
   Scripts
---------------------------------------------------------------- */
const SCRIPT = {
  present: [
    { t: 'Welcome, everyone. Today I will walk you through this week’s quiz results.', step: 1, focus: 'aud' },
    { t: 'As you can see on the board, four teams took part, and the scores were close.', step: 2, focus: 'board', pt: [512, 330] },
    { t: 'Team Blue led after round one, but Team Gold climbed fast with a perfect round three.', step: 3, focus: 'board', pt: [450, 260] },
    { t: 'Here is the key takeaway: accuracy beat speed in every round.', step: 4, focus: 'board', pt: [512, 530] },
    { t: 'Thank you. Let us take a short break, and then I will take your questions.', step: 4, focus: 'aud', wave: true }
  ],
  sit: [
    { t: 'Please take a seat, and make yourselves comfortable.', focus: 'aud' },
    { t: 'I am happy to take any questions you have about the quiz.', focus: 'aud' },
    { t: 'There are no silly questions. Every answer helps us improve.', focus: 'aud' },
    { t: 'Who would like to go first?', focus: 'aud', hand: true }
  ],
  celebrate: [
    { t: 'We did it! We won the quiz! Thank you all, this one is for the whole team!', focus: 'aud' }
  ]
};

/* ---------------------------------------------------------------
   State
---------------------------------------------------------------- */
let spec = AV[0], av = null, mode = 'idle', phase = 'talk', phaseT = 0, clock = 0, gait = 0;
let line = null, lineT = 0, handUp = false, runToken = 0, blinkT = 2, saccT = 0, sacX = 0, sacY = 0;
const P = newPose(), T = newPose(), F = newFace();
const waiters = [];
const waitFor = fn => new Promise(res => waiters.push({ fn, res }));
const sleep = s => { const t1 = clock + s; return waitFor(() => clock >= t1); };

const STAND = { x: -1.75, z: .7 };
function setAvatar(i) {
  if (av) scene.remove(av.root);
  spec = AV[i]; av = buildAvatar(spec); scene.add(av.root);
  document.querySelectorAll('.av').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
  if (mode === 'idle') placeIdle(); else startMode(mode);
}
function placeIdle() { P.rx = STAND.x; P.rz = STAND.z; P.ry = .31; P.hy = .96; phase = 'talk'; }

function setEnv(m) {
  tableG.visible = m === 'present' || m === 'idle';
  audienceG.visible = m === 'sit' || m === 'celebrate';
  execChair.visible = rug.visible = m === 'sit';
  stageG.visible = m === 'celebrate';
  boardMode = m === 'celebrate' ? 'celebrate' : m === 'sit' ? 'sit' : 'present';
  setParticleMode(m === 'celebrate' ? 'party' : 'dust');
  if (CFG.bg === 'green') { tableG.visible = false; audienceG.visible = false; }
}

function startMode(m) {
  runToken++; const token = runToken;
  cancelVoice(); Music.stop();
  mode = m; phaseT = 0; line = null; handUp = false; pointPx = null; boardStep = 0; stepT0.fill(0);
  waiters.length = 0; setEnv(m);
  document.querySelectorAll('.modes button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  if (m === 'present') { phase = 'walk'; P.rx = -4.6; P.rz = STAND.z; P.ry = 1.5; }
  else if (m === 'sit') { phase = 'walk'; P.rx = -3.8; P.rz = 1.9; P.ry = 1.8; }
  else { phase = 'run'; P.rx = -4.2; P.rz = .6; P.ry = 1.5; }
  gait = 0; setCaption('');
  if (Live.active) liveEnter(m, token); else run(m, token);
}

async function run(m, token) {
  const stale = () => token !== runToken;
  await waitFor(() => stale() || phase === 'talk' || phase === 'dance');
  if (stale()) return;
  if (m === 'celebrate') { Snd.init(); Music.start(); burst(0, 2.2, .6, 220); }
  for (const L of SCRIPT[m]) {
    if (stale()) return;
    line = L; lineT = 0; handUp = !!L.hand;
    if (L.step) { boardStep = L.step; stepT0[L.step] = clock; }
    pointPx = null; setCaption(L.t);
    await speak(L.t, spec);
    if (stale()) return;
    await sleep(.6);
  }
  if (stale()) return;
  line = null; pointPx = null;
  if (m === 'celebrate') { setCaption('Press Replay to dance again.'); }
}

/* ---------------------------------------------------------------
   Pose logic per frame
---------------------------------------------------------------- */
function walkCycle(amp, arm) {
  for (let i = 0; i < 2; i++) {
    const ph = gait + (i ? Math.PI : 0), l = T.l[i], a = T.a[1 - i];
    l.t = Math.sin(ph) * .55 * amp; l.k = Math.max(0, Math.cos(ph)) * .9 * amp;
    const s = -Math.sin(ph) * arm;
    a.th = .2 + Math.abs(s); a.ph = s >= 0 ? .1 : Math.PI - .1; a.e = .2 + arm * .6;
  }
  T.hy = .955 + .012 * Math.cos(2 * gait);
}
function lookAt(tx, ty, tz) {
  const dx = tx - P.rx, dz = tz - P.rz, rel = wrapPi(Math.atan2(dx, dz) - P.ry), h = clamp(rel, -1.1, 1.1) * .8;
  T.ny = h; F.gx = clamp(rel - h, -.5, .5);
  const pit = Math.atan2(ty - (P.hy + .8), Math.hypot(dx, dz));
  T.nx = clamp(-pit * .6, -.3, .3); F.gy = clamp(pit * .4, -.3, .3);
}
function speakGestures(seated) {
  const t = clock, sp = Voice.speaking, b = Voice.beat, e = Math.min(1, Voice.open * 1.4);
  for (let i = 0; i < 2; i++) {
    const a = T.a[i];
    if (sp) {
      a.th = .85 + .12 * Math.sin(t * 1.7 + i * 2) + b * (i === Voice.side ? .55 : .2) + e * .12 * Math.sin(t * 9 + i * 2);
      a.ph = .55 + .1 * Math.sin(t * 1.3 + i); a.e = 1.15 - b * .3;
    } else if (seated) { a.th = .6; a.ph = .45; a.e = 1.1; }
  }
  T.nx += b * .1; T.sp += e * .03;
}
function pointAtBoard(p) {
  const w = boardPoint(p[0], p[1]); pointPx = p;
  const dx = w.x - P.rx, dz = w.z - P.rz, dy = w.y - (P.hy + .52);
  const c = Math.cos(P.ry), s = Math.sin(P.ry);
  const lx = dx * c - dz * s - .225, lz = dx * s + dz * c, len = Math.hypot(lx, dy, lz) || 1;
  const a = T.a[0]; a.th = Math.acos(clamp(-dy / len, -1, 1)); a.ph = Math.atan2(lx, lz); a.e = .15; T.pt = 1;
  lookAt(w.x, w.y, w.z);
}

function think(dt) {
  resetTarget(T);
  const t = clock; phaseT += dt;
  T.hr = Math.sin(t * .7) * .012; T.sp = Math.sin(t * 1.5) * .012;
  F.tSmile = .35; F.tBrow = Voice.beat * .9; F.tOpen = Voice.speaking ? Voice.open : 0; F.tWid = Voice.wid;
  let rate = 9;
  if (mode === 'idle') {
    T.ry = .31; lookAt(0, 1.5, 6);
    const w = (t % 7) < 1.8; if (w) { const a = T.a[0]; a.th = 2.5; a.ph = 1.6 + Math.sin(t * 9) * .3; a.e = .5; }
    F.tSmile = .7;
  } else if (mode === 'present') {
    if (phase === 'walk') {
      const dx = STAND.x - P.rx; P.rx += Math.min(dx, 1.3 * dt); gait += dt * 1.3 * Math.PI / .62; walkCycle(1, .5); T.ry = 1.5; rate = 12;
      if (dx < .02) { phase = 'talk'; phaseT = 0; }
    } else {
      lineT += dt; const onBoard = line && line.focus === 'board' && lineT < 3.2;
      T.ry = onBoard ? .8 : .31;
      if (onBoard && line.pt) { speakGestures(false); pointAtBoard(line.pt); T.a[1].th = .25; T.a[1].e = .3; }
      else {
        pointPx = null; speakGestures(false); lookAt(0, 1.5, 6);
        if (line && line.wave) { const a = T.a[0]; a.th = 2.5; a.ph = 1.6 + Math.sin(t * 9) * .3; a.e = .5; F.tSmile = 1; }
      }
      if (!Voice.speaking && !line) lookAt(0, 1.5, 6);
    }
  } else if (mode === 'sit') {
    const AX = CHAIR.x, AZ = CHAIR.z + .6;
    if (phase === 'walk') {
      const dx = AX - P.rx, dz = AZ - P.rz, d = Math.hypot(dx, dz), st = Math.min(d, 1.3 * dt);
      P.rx += dx / d * st; P.rz += dz / d * st; gait += dt * 1.3 * Math.PI / .62; walkCycle(1, .5);
      T.ry = Math.atan2(dx, dz); rate = 12;
      if (d < .03) { phase = 'turn'; phaseT = 0; }
    } else if (phase === 'turn') {
      T.ry = 0; lookAt(0, 1.5, 6); if (phaseT > .8) { phase = 'sit'; phaseT = 0; }
    } else if (phase === 'sit') {
      const s = ease(phaseT / 1.3); T.ry = 0; P.rz = lerp(AZ, CHAIR.z + .02, s);
      const q = s * Math.PI / 2; T.l[0].t = T.l[1].t = q; T.l[0].k = T.l[1].k = q; T.hy = legY(q, q); T.sp = .22 * Math.sin(Math.PI * s);
      speakGestures(true); lookAt(0, 1.5, 6);
      if (phaseT > 1.3) { phase = 'talk'; phaseT = 0; }
    } else {
      lineT += dt; T.ry = 0; const q = Math.PI / 2;
      T.l[0].t = T.l[1].t = q; T.l[0].k = T.l[1].k = q; T.hy = legY(q, q); T.l[0].z = T.l[1].z = .08;
      speakGestures(true); T.sp += .04;
      const ay = Math.sin(clock * .5) * 2.2; lookAt(ay, 1.3, 6);
      F.tSmile = .6;
    }
  } else if (mode === 'celebrate') {
    if (phase === 'run') {
      const dx = 0 - P.rx; P.rx += Math.min(dx, 3.2 * dt); gait += dt * 3.2 * Math.PI / .85; walkCycle(1.3, 1.3); T.sp = .15; T.ry = 1.5; rate = 14;
      if (dx < .02) { phase = 'dance'; phaseT = 0; }
    } else {
      lineT += dt; rate = 16; dance(Music.beat()); lookAt(0, 1.6, 6);
      F.tSmile = 1; F.tBrow = 1;
      if (!Voice.speaking) { const b = Music.beat() % 1; F.tOpen = .25 + .3 * (.5 + .5 * Math.cos(TAU * b)); }
    }
  }
  return rate;
}

function dance(b) {
  const ph = b % 1, bounce = .5 + .5 * Math.cos(TAU * ph), bar = Math.floor(b / 4) % 4, sg = Math.floor(b) % 2 ? 1 : -1;
  const amp = RM ? .5 : 1, bt = b % 4;
  let hop = 0;
  T.ry = 0;
  const tt = .42 * bounce * amp, kk = .84 * bounce * amp;
  T.l[0].t = T.l[1].t = tt; T.l[0].k = T.l[1].k = kk; T.hy = legY(tt, kk);
  T.nx = .1 * bounce;
  if (bar === 0) {                      /* pump */
    for (let i = 0; i < 2; i++) {
      const up = (i === (sg > 0 ? 0 : 1)); const a = T.a[i];
      a.th = up ? 2.7 : .7; a.ph = up ? .5 : 1.9; a.e = up ? .2 : 1.7;
    }
    T.hr = sg * .1; T.nz = sg * .15;
  } else if (bar === 1) {               /* disco point */
    const s2 = Math.floor(b / 2) % 2 ? 1 : -1, up = s2 > 0 ? 0 : 1, a = T.a[up], o = T.a[1 - up];
    a.th = 2.5; a.ph = 1.0; a.e = .1; o.th = .55; o.ph = 1.35; o.e = 2;
    T.hr = Math.sin(Math.PI * b) * .15; T.ht = Math.sin(Math.PI * b) * .3; T.nz = Math.sin(Math.PI * b) * .15;
    P.rx = lerp(P.rx, Math.sin(Math.PI * b) * .3, .1);
  } else if (bar === 2) {               /* floss */
    const sw = Math.sin(Math.PI * b), a0 = -(.3 + .9 * Math.abs(sw)) * Math.sign(sw), a1 = -a0;
    T.a[0].th = 1.15; T.a[0].ph = a0; T.a[0].e = .5; T.a[1].th = 1.15; T.a[1].ph = a1; T.a[1].e = .5;
    P.rx = lerp(P.rx, sw * .3, .15); T.hr = sw * .12;
  } else {                              /* spin and jump */
    T.ry = (bt / 4) * TAU; hop = Math.max(0, Math.sin(Math.PI * ph)) * .16;
    T.hy += hop; T.l[0].t = T.l[1].t = .5 * Math.sin(Math.PI * ph); T.l[0].k = T.l[1].k = .9 * Math.sin(Math.PI * ph);
    for (let i = 0; i < 2; i++) { T.a[i].th = 2.7; T.a[i].ph = 1.0; T.a[i].e = .2; }
  }
  if (bar !== 1 && bar !== 2) P.rx = lerp(P.rx, 0, .1);
  if (ph < .06 && bar !== lastBar) { lastBar = bar; burst(0, 2, .6, 60); }
}
let lastBar = -1;

/* ---------------------------------------------------------------
   Camera
---------------------------------------------------------------- */
const camPos = new THREE.Vector3(0, 1.7, 7), camLook = new THREE.Vector3(0, 1.2, 0);
let dragYaw = 0, dragPitch = 0, zoom = 1;
function fit(w, h) {
  const th = Math.tan(camera.fov * Math.PI / 360);
  return Math.max(h / 2 / th, w / 2 / (th * camera.aspect));
}
function updateCamera(dt) {
  let tx = .1, ty = 1.2, tz = 0, w = 6.8, h = 3.6, el = .06, az = 0, minD = 0;
  if (mode === 'sit') { tx = 0; ty = 1.1; tz = .6; w = 4; h = 2.8; el = .16; minD = 7.4; }
  else if (mode === 'celebrate') { tx = 0; ty = 1.2; tz = .5; w = 5.6; h = 3.6; el = .08; az = RM ? 0 : Math.sin(clock * .35) * .25; }
  const d = Math.max(fit(w, h), minD) * zoom, vh = 2 * d * Math.tan(camera.fov * Math.PI / 360);
  az += dragYaw; el += dragPitch;
  const gx = tx + Math.sin(az) * Math.cos(el) * d, gy = ty - vh * .1 + Math.sin(el) * d, gz = tz + Math.cos(az) * Math.cos(el) * d;
  const k = 1 - Math.exp(-dt * 3);
  camPos.x += (gx - camPos.x) * k; camPos.y += (gy - camPos.y) * k; camPos.z += (gz - camPos.z) * k;
  camLook.x += (tx - camLook.x) * k; camLook.y += (ty - vh * .1 - camLook.y) * k; camLook.z += (tz - camLook.z) * k;
  camera.position.copy(camPos); camera.lookAt(camLook);
}
let dragging = false, lx = 0, ly = 0;
canvas.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  dragYaw = clamp(dragYaw - (e.clientX - lx) * .004, -.6, .6); dragPitch = clamp(dragPitch + (e.clientY - ly) * .002, -.15, .3); lx = e.clientX; ly = e.clientY;
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('wheel', e => { e.preventDefault(); zoom = clamp(zoom * (1 + e.deltaY * .001), .7, 1.4); }, { passive: false });

/* ---------------------------------------------------------------
   Frame loop
---------------------------------------------------------------- */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
let last = performance.now() / 1000, boardAcc = 0;
function frame(ms) {
  const now = ms / 1000, dt = Math.min(.05, Math.max(.001, now - last)); last = now; clock += dt;
  updateVoice(dt);
  const rate = think(dt), k = 1 - Math.exp(-rate * dt);
  T.ry = P.ry + wrapPi(T.ry - P.ry);
  blendPose(P, T, k); P.pt = T.pt;
  av.apply(P);

  /* face */
  blinkT -= dt; if (blinkT < -.14) blinkT = 2.5 + Math.random() * 3;
  saccT -= dt; if (saccT < 0) { saccT = .8 + Math.random() * 1.6; sacX = (Math.random() - .5) * .12; sacY = (Math.random() - .5) * .08; }
  const fk = 1 - Math.exp(-dt * 25), sk = 1 - Math.exp(-dt * 8);
  F.open += (F.tOpen - F.open) * fk; F.wid += (F.tWid - F.wid) * fk;
  F.smile += (F.tSmile - F.smile) * sk; F.brow += (F.tBrow - F.brow) * sk;
  F.blink = blinkT < 0 ? 1 : 0;
  const gxS = F.gx, gyS = F.gy; F.gx += sacX; F.gy += sacY;
  av.setFace(F); F.gx = gxS; F.gy = gyS;

  /* world */
  const beat = Music.on ? Music.beat() : clock * 2;
  updateAudience(clock, mode, beat, handUp && lineT > 1);
  updateParticles(dt, clock);
  const on = mode === 'celebrate';
  spots.forEach((s, i) => {
    s.intensity += ((on ? 1.6 : 0) - s.intensity) * Math.min(1, dt * 2);
    s.target.position.set(Math.sin(clock * .8 + i * 2.1) * 1.6, 1, .6 + Math.cos(clock * .7 + i * 2.1) * 1.2);
  });
  ring.rotation.z = clock;
  boardAcc += dt; if (boardAcc > .066) { boardAcc = 0; drawBoard(clock); }
  updateCamera(dt);

  for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].fn()) { const r = waiters[i].res; waiters.splice(i, 1); r(); }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ---------------------------------------------------------------
   UI
---------------------------------------------------------------- */
const thumbs = makeThumbs();
const avWrap = $('avatars');
AV.forEach((a, i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'av'; b.setAttribute('aria-pressed', 'false');
  b.innerHTML = (thumbs[i] ? '<img alt="" src="' + thumbs[i] + '">' : '') + '<span>' + a.name + '</span>';
  b.addEventListener('click', () => setAvatar(i));
  avWrap.appendChild(b);
});
document.querySelectorAll('.modes button').forEach(b => b.addEventListener('click', () => { Snd.init(); startMode(b.dataset.mode); }));
$('replay').addEventListener('click', () => { Snd.init(); startMode(mode === 'idle' ? 'present' : mode); });
$('sound').addEventListener('click', e => {
  const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
  e.currentTarget.setAttribute('aria-pressed', String(on)); e.currentTarget.textContent = on ? 'Sound on' : 'Sound off';
  Snd.set(on); if (!on) cancelVoice();
});
$('live').addEventListener('click', () => { if (Live.active) liveStop(); else liveStart(); });
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === '1') startMode('present'); else if (k === '2') startMode('sit'); else if (k === '3') startMode('celebrate');
  else if (k === 'l') { if (Live.active) liveStop(); else liveStart(); }
  else if (k === 'h') document.body.classList.toggle('noui');
});
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {};

resize();
Object.assign(P, { rx: STAND.x, rz: STAND.z });
setAvatar(0);
document.fonts && document.fonts.load('700 40px Caveat');
requestAnimationFrame(t => { last = t / 1000; frame(t); });
})();
