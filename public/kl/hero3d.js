// Kissan Drishti — cinematic hero scene (Three.js). Scroll-driven: scan → extract → understand.
(function () {
  function webglOK() {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
    catch (e) { return false; }
  }

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;

  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

  function chipCanvas(title, text, tone) {
    const c = document.createElement('canvas'); c.width = 720; c.height = 170;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(251,248,239,0.96)'; rr(x, 4, 4, 712, 162, 26); x.fill();
    x.strokeStyle = tone === 'warn' ? '#c98a12' : '#3c8a3f'; x.lineWidth = 4; rr(x, 4, 4, 712, 162, 26); x.stroke();
    x.fillStyle = tone === 'warn' ? '#9a6608' : '#2c6b31'; x.font = '600 30px "JetBrains Mono", monospace'; x.fillText(title.toUpperCase(), 36, 58);
    x.fillStyle = '#1a1c18'; x.font = '600 44px "Instrument Sans", Arial, sans-serif'; x.fillText(text, 36, 124);
    return c;
  }

  function phoneScreen(stage) {
    const c = document.createElement('canvas'); c.width = 540; c.height = 1100;
    const x = c.getContext('2d');
    x.fillStyle = '#f6f2e8'; x.fillRect(0, 0, 540, 1100);
    x.fillStyle = '#1f3b2d'; x.fillRect(0, 0, 540, 150);
    x.fillStyle = '#f6f2e8'; x.font = '700 38px "Newsreader", Georgia, serif'; x.fillText('Kissan Drishti', 40, 102);
    x.fillStyle = '#8fd16a'; x.beginPath(); x.arc(492, 90, 14, 0, Math.PI * 2); x.fill();
    if (stage === 0) {
      x.fillStyle = '#1a1c18'; x.fillRect(40, 190, 460, 560);
      x.strokeStyle = '#8fd16a'; x.lineWidth = 6;
      [[60, 210], [480, 210], [60, 730], [480, 730]].forEach(([px, py], i) => {
        x.beginPath(); const sx = i % 2 ? -1 : 1, sy = i > 1 ? -1 : 1;
        x.moveTo(px, py + 50 * sy); x.lineTo(px, py); x.lineTo(px + 50 * sx, py); x.stroke();
      });
      x.fillStyle = 'rgba(143,209,106,0.9)'; x.fillRect(60, 420, 420, 5);
      x.fillStyle = '#1a1c18'; x.font = '600 34px "Instrument Sans", Arial'; x.fillText('Reading label…', 40, 830);
      x.fillStyle = '#e1d9c4'; rr(x, 40, 870, 460, 18, 9); x.fill();
      x.fillStyle = '#3c8a3f'; rr(x, 40, 870, 300, 18, 9); x.fill();
    } else {
      x.fillStyle = '#5b5f55'; x.font = '500 26px "JetBrains Mono", monospace'; x.fillText('PRODUCT · SAMPLE', 40, 210);
      x.fillStyle = '#1a1c18'; x.font = '700 44px "Instrument Sans", Arial'; x.fillText('DEMOGUARD 25 EC', 40, 266);
      const rows = [['Dose (as printed)', '2 ml in 1 litre', 'ok'], ['Waiting period', '7 days', 'ok'], ['Caution', 'Harmful if swallowed', 'warn'], ['Wear', 'Gloves, mask', 'ok']];
      rows.forEach((r, i) => {
        const y = 320 + i * 170;
        x.fillStyle = r[2] === 'warn' ? '#f3e3b8' : '#fffdf6'; rr(x, 40, y, 460, 145, 20); x.fill();
        x.fillStyle = r[2] === 'warn' ? '#9a6608' : '#2c6b31'; x.font = '600 24px "JetBrains Mono", monospace'; x.fillText(r[0].toUpperCase(), 66, y + 50);
        x.fillStyle = '#1a1c18'; x.font = '600 36px "Instrument Sans", Arial'; x.fillText(r[1], 66, y + 104);
      });
      x.fillStyle = '#1f3b2d'; rr(x, 40, 1000, 460, 70, 35); x.fill();
      x.fillStyle = '#f6f2e8'; x.font = '600 28px "Instrument Sans", Arial'; x.fillText('▶  Listen in हिन्दी', 150, 1045);
    }
    return c;
  }

  function beamTex() {
    const c = document.createElement('canvas'); c.width = 8; c.height = 256;
    const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(143,209,106,0)'); g.addColorStop(0.82, 'rgba(143,209,106,0.35)'); g.addColorStop(0.97, 'rgba(200,255,170,1)'); g.addColorStop(1, 'rgba(143,209,106,0)');
    x.fillStyle = g; x.fillRect(0, 0, 8, 256); return c;
  }

  function mount(container, opts) {
    const o = opts || {};
    if (!webglOK() || !window.THREE) return null;
    const THREE = window.THREE;
    const W = () => container.clientWidth, H = () => container.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(W(), H());
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, W() / H(), 0.1, 200);
    camera.position.set(0, 0, 14);

    scene.add(new THREE.AmbientLight(0xfff4e0, 0.85));
    const sun = new THREE.DirectionalLight(0xffe2b0, 0.9); sun.position.set(-6, 8, 10); scene.add(sun);

    const texLoader = new THREE.TextureLoader();
    const disposables = [];
    const tex = (canvas) => { const t = new THREE.CanvasTexture(canvas); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; disposables.push(t); return t; };

    // Farm backdrop (two layers for parallax)
    const bgGroup = new THREE.Group(); scene.add(bgGroup);
    if (o.backdrop) {
      texLoader.load(o.backdrop, (t) => {
        t.encoding = THREE.sRGBEncoding; disposables.push(t);
        const asp = t.image.width / t.image.height;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(60 * asp / 1.0, 60), new THREE.MeshBasicMaterial({ map: t, fog: false }));
        m.position.set(0, 2, -40); bgGroup.add(m);
      });
    }

    const world = new THREE.Group(); scene.add(world);

    // A small, low-cost field of softly glowing motes adds depth without competing with the label.
    const particleCount = window.innerWidth < 700 ? 28 : 54;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSeeds = [];
    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * 10, y = (Math.random() - 0.5) * 7.4, z = -1.6 + Math.random() * 4;
      particlePositions.set([x, y, z], i * 3); particleSeeds.push({ x, y, z, phase: Math.random() * Math.PI * 2 });
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({ color: 0xb6ed8b, size: 0.045, transparent: true, opacity: 0.46, depthWrite: false, sizeAttenuation: true });
    const particles = new THREE.Points(particleGeo, particleMat); scene.add(particles);

    // Label card
    const labelCanvas = window.KL.drawSampleLabel();
    const labelGroup = new THREE.Group(); world.add(labelGroup);
    const LW = 3.6, LH = LW * labelCanvas.height / labelCanvas.width;
    const label = new THREE.Mesh(new THREE.BoxGeometry(LW, LH, 0.04), [
      new THREE.MeshStandardMaterial({ color: 0xe8dfc9 }), new THREE.MeshStandardMaterial({ color: 0xe8dfc9 }),
      new THREE.MeshStandardMaterial({ color: 0xe8dfc9 }), new THREE.MeshStandardMaterial({ color: 0xe8dfc9 }),
      new THREE.MeshStandardMaterial({ map: tex(labelCanvas), roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: 0xd9cfb5 }),
    ]);
    labelGroup.add(label);
    // shadow card behind
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(LW * 1.05, LH * 1.04), new THREE.MeshBasicMaterial({ color: 0x0b1a10, transparent: true, opacity: 0.28 }));
    shadow.position.set(0.18, -0.22, -0.25); labelGroup.add(shadow);
    // scan beam
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(LW * 1.02, 1.1), new THREE.MeshBasicMaterial({ map: tex(beamTex()), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.z = 0.04; labelGroup.add(beam);

    // Phone
    const phone = new THREE.Group(); world.add(phone);
    const PW = 1.9, PH = 3.85;
    const body = new THREE.Mesh(new THREE.BoxGeometry(PW, PH, 0.16), new THREE.MeshStandardMaterial({ color: 0x15201a, metalness: 0.4, roughness: 0.35 }));
    phone.add(body);
    const screens = [tex(phoneScreen(0)), tex(phoneScreen(1))];
    const screenMat = new THREE.MeshBasicMaterial({ map: screens[0], transparent: true });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(PW - 0.14, PH - 0.16), screenMat);
    screen.position.z = 0.085; phone.add(screen);
    const screen2Mat = new THREE.MeshBasicMaterial({ map: screens[1], transparent: true, opacity: 0 });
    const screen2 = new THREE.Mesh(new THREE.PlaneGeometry(PW - 0.14, PH - 0.16), screen2Mat);
    screen2.position.z = 0.087; phone.add(screen2);

    // Light cone from phone to label
    const coneMat = new THREE.MeshBasicMaterial({ color: 0x8fd16a, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const coneGeo = new THREE.BufferGeometry();
    coneGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Array(9).fill(0), 3));
    const cone = new THREE.Mesh(coneGeo, coneMat); world.add(cone);

    // OCR chips
    const chipDefs = [
      ['Active ingredient', 'Examplofen 25% w/w EC', 'ok', 0.24],
      ['Directions · original', 'Dilute 2 ml in 1 litre', 'ok', 0.02],
      ['Waiting period', '7 days before harvest', 'ok', -0.12],
      ['Caution · on label', 'Harmful if swallowed', 'warn', -0.2],
      ['Protective wear', 'Gloves, mask, full sleeves', 'ok', -0.3],
    ];
    const chips = chipDefs.map((d, i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.64), new THREE.MeshBasicMaterial({ map: tex(chipCanvas(d[0], d[1], d[2])), transparent: true, opacity: 0, depthWrite: false }));
      m.userData = { srcY: d[3] * LH, i }; world.add(m); return m;
    });

    let progress = 0, target = 0, mx = 0, my = 0, tmx = 0, tmy = 0, raf = 0, visible = true;
    const onMove = (e) => { const r = container.getBoundingClientRect(); tmx = ((e.clientX - r.left) / r.width - 0.5); tmy = ((e.clientY - r.top) / r.height - 0.5); };
    const pointerFine = window.matchMedia('(pointer: fine)').matches && window.innerWidth > 700;
    if (pointerFine) window.addEventListener('pointermove', onMove, { passive: true });
    const onResize = () => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); };
    window.addEventListener('resize', onResize);
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0 });
    io.observe(container);

    const t0 = performance.now(); let lastFrame = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      if (now - lastFrame < 33) return;
      lastFrame = now;
      const time = (performance.now() - t0) / 1000;
      target = o.getProgress ? o.getProgress() : 0;
      progress += (target - progress) * 0.08;
      mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
      const p = progress;
      const narrow = W() / H() < 1.1;
      const sideX = narrow ? 0 : 2.6;

      // stages
      const sScan = seg(p, 0.0, 0.3), sExtract = seg(p, 0.28, 0.62), sUnder = seg(p, 0.6, 0.92);

      bgGroup.position.set(-mx * 1.6, my * 0.9 - p * 2.2, 0);
      world.rotation.y = mx * 0.12; world.rotation.x = my * 0.06;
      const posAttr = particleGeo.attributes.position;
      particleSeeds.forEach((seed, i) => {
        posAttr.setXYZ(i, seed.x + Math.sin(time * 0.18 + seed.phase) * 0.12 + mx * 0.2,
          seed.y + Math.sin(time * 0.24 + seed.phase) * 0.1 + my * -0.12,
          seed.z);
      });
      posAttr.needsUpdate = true;

      // label: floats, then recedes left as understanding forms
      const lx = lerp(sideX - 0.4, sideX - 3.2, ease(sUnder)) - (narrow ? 0 : 0);
      labelGroup.position.set(narrow ? lerp(0, -1.4, ease(sUnder)) : lx, Math.sin(time * 0.8) * 0.08 + lerp(0, 0.2, sUnder), lerp(0, -2.2, ease(sUnder)));
      labelGroup.rotation.set(-0.06 + Math.sin(time * 0.6) * 0.02, lerp(0.32, 0.55, ease(sUnder)), lerp(-0.05, -0.1, sUnder));

      // phone: in front-right, swings to face viewer at the end
      phone.position.set(narrow ? lerp(1.1, 0.6, ease(sUnder)) : lerp(sideX + 1.7, sideX + 0.9, ease(sUnder)), lerp(-0.9, -0.1, ease(sUnder)) + Math.sin(time * 1.1 + 1) * 0.05, lerp(2.6, 3.4, ease(sUnder)));
      phone.rotation.set(lerp(0.12, 0.02, sUnder), lerp(-0.5, -0.12, ease(sUnder)), lerp(0.1, 0.0, sUnder));
      screen2Mat.opacity = ease(seg(p, 0.66, 0.82));

      // beam: idle sweep, faster sweep during scan stage, fades when done
      const sweep = p < 0.02 ? (Math.sin(time * 1.3) * 0.5 + 0.5) : ((time * 0.55) % 1);
      beam.position.y = lerp(LH / 2 - 0.3, -LH / 2 + 0.3, sweep);
      beam.material.opacity = 1 - seg(p, 0.55, 0.7);

      // cone: from phone top to label beam line
      phone.updateMatrixWorld(); labelGroup.updateMatrixWorld();
      const a = new THREE.Vector3(0, PH / 2 - 0.25, 0.1).applyMatrix4(phone.matrixWorld);
      const b1 = new THREE.Vector3(-LW / 2, beam.position.y, 0.05).applyMatrix4(labelGroup.matrixWorld);
      const b2 = new THREE.Vector3(LW / 2, beam.position.y, 0.05).applyMatrix4(labelGroup.matrixWorld);
      world.worldToLocal(a); world.worldToLocal(b1); world.worldToLocal(b2);
      const pos = coneGeo.attributes.position; pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, b1.x, b1.y, b1.z); pos.setXYZ(2, b2.x, b2.y, b2.z); pos.needsUpdate = true;
      coneMat.opacity = 0.09 * (1 - seg(p, 0.5, 0.66));

      // chips: emerge from label lines, line up in a column, then fold into the phone
      chips.forEach((m, i) => {
        const local = new THREE.Vector3(0, m.userData.srcY, 0.1).applyMatrix4(labelGroup.matrixWorld); world.worldToLocal(local);
        const stagger = i * 0.05;
        const e1 = ease(seg(sExtract, stagger, stagger + 0.55));
        const colX = narrow ? 0 : sideX - 3.6, colY = 1.5 - i * 0.78;
        const outX = narrow ? 0 : sideX - 3.9;
        const e2 = ease(seg(sUnder, i * 0.06, 0.55 + i * 0.06));
        const phonePos = phone.position;
        let x = lerp(local.x, colX + Math.sin(time + i) * 0.04, e1), y = lerp(local.y, colY + Math.cos(time * 0.9 + i) * 0.04, e1), z = lerp(local.z, 1.2, e1);
        x = lerp(x, phonePos.x, e2); y = lerp(y, phonePos.y + 0.6 - i * 0.3, e2); z = lerp(z, phonePos.z + 0.1, e2);
        m.position.set(x, y, z);
        const sc = lerp(lerp(0.5, narrow ? 0.85 : 1, e1), 0.3, e2);
        m.scale.setScalar(sc);
        m.rotation.y = lerp(0.3, 0.05, e1) + world.rotation.y * -0.3;
        m.material.opacity = Math.min(e1 * 1.4, 1) * (1 - e2);
        void outX;
      });

      renderer.render(scene, camera);
    }
    frame();

    return function dispose() {
      cancelAnimationFrame(raf); io.disconnect();
      if (pointerFine) window.removeEventListener('pointermove', onMove); window.removeEventListener('resize', onResize);
      disposables.forEach((d) => d.dispose && d.dispose());
      scene.traverse((ob) => { if (ob.geometry) ob.geometry.dispose(); if (ob.material) [].concat(ob.material).forEach((mm) => mm.dispose()); });
      renderer.dispose(); renderer.domElement.remove();
    };
  }

  window.KLHero = { mount, webglOK };
})();
