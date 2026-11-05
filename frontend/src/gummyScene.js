import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createWorld, createBears, stepSimulation, resizeWorld } from './gummyPhysics.js';
import { createRainLifecycle } from './gummyLifecycle.js';
import { createCornerPeek } from './gummyPeek.js';

const GUMMY_COLORS = [0xff0033, 0x00cc44, 0xffaa00, 0xffee00, 0xff66cc];
const interactiveSelector = 'a, button, input, textarea, select, [role="button"], [role="link"]';

export function createGummyScene(canvas, {
  intro = true, peekCanvas, peekElement, onReady = () => {}, onSettled = () => {}, onError = () => {},
} = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.transmissionResolutionScale = 0.5;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-6, 6, 6, -6, 0.1, 60);
  camera.position.z = 20;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.65;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffd5c2, 0.9));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(-4, 7, 8);
  scene.add(light);
  const rim = new THREE.DirectionalLight(0xffe8db, 1.4);
  rim.position.set(5, 2, -4);
  scene.add(rim);
  const palette = GUMMY_COLORS.map((hex) => {
    const color = new THREE.Color(hex);
    return new THREE.MeshPhysicalMaterial({
      color, metalness: 0, roughness: 0.19, transmission: 0.65, thickness: 0.7,
      ior: 1.45, clearcoat: 1, clearcoatRoughness: 0.12,
      attenuationColor: color, attenuationDistance: 0.9, envMapIntensity: 0.75,
      transparent: true, depthWrite: false,
    });
  });
  const geometries = new Set();
  const sourceMaterials = new Set();
  const objects = new Map();
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const touchPreference = window.matchMedia('(pointer: coarse)');
  const worldForSize = (width, height) => {
    const next = createWorld(width, height, { mobileBreakpoint: touchPreference.matches ? Infinity : 640 });
    const footer = document.getElementById('contacto');
    const floorPixels = footer ? footer.getBoundingClientRect().top + window.scrollY : height;
    next.pixelScale = 12 / Math.max(1, height);
    next.viewportHeight = 12;
    next.height = Math.max(next.bearSize * 2, floorPixels * next.pixelScale);
    return next;
  };
  let world = worldForSize(canvas.clientWidth, canvas.clientHeight);
  const bears = createBears(world);
  let lifecycle = createRainLifecycle(world, { intro: intro && !motionPreference.matches });
  lifecycle.initialize(bears);
  let normalizedModel;
  let peek;
  let pointer = null;
  let lastPointer = null;
  let paused = motionPreference.matches;
  let disposed = false;
  let loaded = false;
  let failed = false;
  let notified = false;
  let frame = 0;
  let resizeFrame = 0;
  let lastTime = 0;
  let lastFrame = 0;
  let activeTime = 0;
  let dirty = true;

  function syncObjects() {
    const ids = new Set(bears.map((bear) => bear.id));
    for (const [id, entry] of objects) {
      if (ids.has(id)) continue;
      scene.remove(entry.group);
      entry.material.dispose();
      objects.delete(id);
    }
    for (const bear of bears) {
      let entry = objects.get(bear.id);
      if (!entry) {
        const material = palette[bear.colorIndex].clone();
        const copy = normalizedModel.clone(true);
        copy.traverse((child) => { if (child.isMesh) child.material = material; });
        const group = new THREE.Group();
        group.add(copy);
        scene.add(group);
        entry = { group, material };
        objects.set(bear.id, entry);
      }
      const { group, material } = entry;
      group.visible = bear.active && bear.opacity > 0;
      group.position.set(bear.x, bear.y, bear.z);
      group.rotation.set(bear.rotationX, bear.rotationY, bear.rotationZ);
      group.scale.set(world.bearSize * (1 + bear.bounceAmount * 0.08), world.bearSize * (1 - bear.bounceAmount * 0.12), world.bearSize);
      material.opacity = bear.opacity;
    }
    canvas.dataset.rainPhase = lifecycle.phase;
    canvas.dataset.bearCount = String(bears.length);
  }

  function draw() {
    if (!loaded || disposed || failed) return;
    syncObjects();
    renderer.render(scene, camera);
    dirty = false;
  }

  function animate(time) {
    frame = 0;
    if (disposed || !loaded || failed || document.hidden) return;
    const interval = 1000 / (world.mobile ? 30 : 40);
    if (lastFrame && time - lastFrame < interval - 1) {
      frame = requestAnimationFrame(animate);
      return;
    }
    lastFrame = time;
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
    lastTime = time;
    const wasMoving = bears.some((bear) => bear.active && !bear.sleeping);
    if (!paused) {
      activeTime += delta;
      const state = lifecycle.step(bears, world, delta);
      if (state.changed) dirty = true;
      if (state.changed || lifecycle.phase !== 'ambient' || wasMoving || pointer) stepSimulation(bears, world, delta, { pointer });
      if (pointer) {
        pointer.vx *= Math.exp(-14 * delta);
        pointer.vy *= Math.exp(-14 * delta);
      }
      if (!notified && state.phase === 'ambient') {
        notified = true;
        onSettled();
      }
    }
    const moving = bears.some((bear) => bear.active && !bear.sleeping);
    if (dirty || wasMoving || moving) draw();
    peek?.update(activeTime, paused);
    if (!paused) frame = requestAnimationFrame(animate);
    else lastTime = 0;
  }

  function schedule() {
    if (!frame && loaded && !disposed && !failed && !document.hidden) frame = requestAnimationFrame(animate);
  }

  function pointerMove(event) {
    if (!event.isPrimary || paused || disposed || failed || document.hidden) return;
    if (event.target.closest?.(interactiveSelector)) { clearPointer(); return; }
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const now = event.timeStamp;
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * world.width;
    const y = camera.top - (event.clientY - bounds.top) * world.pixelScale;
    const elapsed = lastPointer ? (now - lastPointer.time) / 1000 : 0;
    const velocity = (value) => THREE.MathUtils.clamp(value, -18, 18);
    pointer = { x, y, radius: world.bearSize * 0.32,
      vx: elapsed > 0 && elapsed < 0.15 ? velocity((x - lastPointer.x) / elapsed) : 0,
      vy: elapsed > 0 && elapsed < 0.15 ? velocity((y - lastPointer.y) / elapsed) : 0 };
    lastPointer = { x, y, time: now };
    schedule();
  }

  function clearPointer() { pointer = null; lastPointer = null; }
  function pointerOut(event) { if (!event.relatedTarget) clearPointer(); }
  function pointerUp(event) { if (event.pointerType === 'touch') clearPointer(); }

  function positionCamera() {
    camera.left = -world.width / 2;
    camera.right = world.width / 2;
    camera.top = world.height / 2 - window.scrollY * world.pixelScale;
    camera.bottom = camera.top - world.viewportHeight;
    camera.updateProjectionMatrix();
  }

  function onScroll() {
    if (disposed) return;
    positionCamera();
    clearPointer();
    dirty = true;
    schedule();
  }

  function resize() {
    if (disposed) return;
    const bounds = canvas.parentElement.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const next = worldForSize(bounds.width, bounds.height);
    lifecycle.resize(next);
    resizeWorld(bears, world, next);
    world = next;
    clearPointer();
    positionCamera();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, world.mobile ? 1.25 : 1.5));
    renderer.transmissionResolutionScale = world.mobile ? 0.35 : 0.5;
    renderer.setSize(bounds.width, bounds.height, false);
    peek?.resize();
    dirty = true;
    draw();
    schedule();
  }

  function queueResize() {
    if (!resizeFrame) resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; resize(); });
  }
  function visibilityChange() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    lastFrame = 0;
    clearPointer();
    if (!document.hidden) schedule();
  }
  function preferenceChange(event) {
    paused = event.matches;
    if (paused) {
      lifecycle = createRainLifecycle(world, { intro: false });
      lifecycle.initialize(bears);
      peek?.update(activeTime, true);
    }
    lastTime = 0;
    dirty = true;
    draw();
    schedule();
  }
  function contextLost(event) {
    event.preventDefault();
    failed = true;
    cancelAnimationFrame(frame);
    frame = 0;
    peek?.update(activeTime, true);
    onError();
  }

  const resizeObserver = new ResizeObserver(queueResize);
  resizeObserver.observe(canvas.parentElement);
  const page = document.querySelector('.site-shell');
  if (page) resizeObserver.observe(page);
  document.addEventListener('visibilitychange', visibilityChange);
  motionPreference.addEventListener('change', preferenceChange);
  touchPreference.addEventListener('change', queueResize);
  window.addEventListener('pointermove', pointerMove, { passive: true });
  window.addEventListener('pointerdown', pointerMove, { passive: true });
  window.addEventListener('pointerup', pointerUp, { passive: true });
  window.addEventListener('pointercancel', clearPointer, { passive: true });
  window.addEventListener('pointerout', pointerOut, { passive: true });
  window.addEventListener('blur', clearPointer);
  window.addEventListener('scroll', onScroll, { passive: true });
  canvas.addEventListener('webglcontextlost', contextLost);
  resize();

  new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/gummy.glb`).then((gltf) => {
    const model = gltf.scene;
    model.traverse((child) => {
      if (!child.isMesh) return;
      geometries.add(child.geometry);
      const source = Array.isArray(child.material) ? child.material : [child.material];
      source.forEach((material) => sourceMaterials.add(material));
    });
    if (disposed) {
      geometries.forEach((geometry) => geometry.dispose());
      sourceMaterials.forEach((material) => material.dispose());
      return;
    }
    const box = new THREE.Box3().setFromObject(model);
    const height = box.getSize(new THREE.Vector3()).y;
    if (!Number.isFinite(height) || height <= 0) throw new Error('Modelo de gomita inválido.');
    model.position.sub(box.getCenter(new THREE.Vector3()));
    normalizedModel = new THREE.Group();
    normalizedModel.add(model);
    normalizedModel.scale.setScalar(1 / height);
    normalizedModel.rotation.y = Math.PI;
    if (peekCanvas && peekElement) {
      try { peek = createCornerPeek(peekCanvas, peekElement, normalizedModel, palette[4]); }
      catch (error) { console.warn('No se pudo preparar el osito de la esquina:', error); }
    }
    loaded = true;
    resize();
    onReady();
    schedule();
  }).catch((error) => {
    if (disposed) return;
    failed = true;
    console.error('No se pudo cargar la decoración de gomitas:', error);
    onError();
  });

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', visibilityChange);
      motionPreference.removeEventListener('change', preferenceChange);
      touchPreference.removeEventListener('change', queueResize);
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerdown', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', clearPointer);
      window.removeEventListener('pointerout', pointerOut);
      window.removeEventListener('blur', clearPointer);
      window.removeEventListener('scroll', onScroll);
      canvas.removeEventListener('webglcontextlost', contextLost);
      peek?.dispose();
      objects.forEach(({ material }) => material.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      sourceMaterials.forEach((material) => material.dispose());
      palette.forEach((material) => material.dispose());
      environment.dispose();
      renderer.dispose();
    },
  };
}
