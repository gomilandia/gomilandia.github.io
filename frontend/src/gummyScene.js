import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createWorld, createBears, createScore, hitBear, stepSimulation, resizeWorld } from './gummyPhysics.js';

const GUMMY_COLORS = [
  new THREE.Color(0xff0033),
  new THREE.Color(0x00cc44),
  new THREE.Color(0xffaa00),
  new THREE.Color(0xffee00),
  new THREE.Color(0xff66cc),
];

export function createGummyScene(canvas, { onReady, onScore, onPausedChange, onError }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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

  const materials = GUMMY_COLORS.map((color) => new THREE.MeshPhysicalMaterial({
    color, metalness: 0, roughness: 0.19,
    transmission: 0.65, thickness: 0.7, ior: 1.45,
    clearcoat: 1, clearcoatRoughness: 0.12,
    attenuationColor: color, attenuationDistance: 0.9, envMapIntensity: 0.75,
  }));
  const haloGeometry = new THREE.RingGeometry(0.76, 0.79, 48);
  const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xa247bc, transparent: true, opacity: 0.45, depthTest: false });
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);
  halo.renderOrder = 2;
  halo.visible = false;
  scene.add(halo);

  const geometries = new Set();
  const sourceMaterials = new Set();
  const groups = [];
  const score = createScore();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let world = createWorld(canvas.clientWidth, canvas.clientHeight);
  const bears = createBears(world);
  let paused = motionPreference.matches;
  let disposed = false;
  let loaded = false;
  let failed = false;
  let frame = 0;
  let lastTime = 0;
  let pointerStart = null;

  function emitScore() {
    const active = bears.find((bear) => bear.id === score.activeId);
    onScore({ ...score, activeColorIndex: active?.colorIndex ?? null });
  }

  function syncObjects() {
    bears.forEach((bear, index) => {
      const group = groups[index];
      if (!group) return;
      const limit = Math.max(0, world.width / 2 - world.bearSize * 0.8);
      group.position.set(THREE.MathUtils.clamp(bear.x, -limit, limit), bear.y, bear.z);
      group.rotation.set(bear.rotationX, bear.rotationY, bear.rotationZ);
      group.scale.set(
        world.bearSize * (1 + bear.bounceAmount * 0.08),
        world.bearSize * (1 - bear.bounceAmount * 0.12),
        world.bearSize,
      );
    });
    const active = bears.find((bear) => bear.id === score.activeId);
    halo.visible = Boolean(active);
    if (active) {
      halo.position.copy(groups[active.id].position);
      halo.position.z = 2;
      halo.scale.setScalar(world.bearSize);
    }
  }

  function draw() {
    if (!loaded || disposed || failed) return;
    syncObjects();
    renderer.render(scene, camera);
  }

  function animate(time) {
    frame = 0;
    if (disposed || !loaded || failed || document.hidden) return;
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;
    if (!paused && stepSimulation(bears, world, delta, score)) emitScore();
    draw();
    if (!paused) frame = requestAnimationFrame(animate);
    else lastTime = 0;
  }

  function schedule() {
    if (!frame && loaded && !disposed && !failed && !document.hidden) {
      frame = requestAnimationFrame(animate);
    }
  }

  function setPaused(value) {
    paused = Boolean(value);
    lastTime = 0;
    onPausedChange(paused);
    schedule();
  }

  function bounce(id) {
    if (!loaded || disposed || failed || !hitBear(bears, id, score, world)) return false;
    // Deliberately playing resumes a paused rain, so a stationary bear cannot farm points.
    if (paused) setPaused(false);
    emitScore();
    draw();
    schedule();
    return true;
  }

  function bounceActive() {
    if (score.activeId !== null) return bounce(score.activeId);
    const candidates = bears.filter((bear) => Math.abs(bear.y) < world.height / 2 - world.bearSize);
    const bear = candidates.sort((a, b) => Math.abs(a.y) - Math.abs(b.y))[0];
    return bear ? bounce(bear.id) : false;
  }

  function pointerDown(event) {
    if (!event.isPrimary || event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }

  function pageClick(event) {
    const start = pointerStart;
    pointerStart = null;
    if (event.detail === 0 || event.target.closest?.('.gummy-score-widget')) return;
    if (!loaded || disposed || failed || !start
      || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) return;
    const bounds = canvas.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
      -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(groups, true)[0];
    if (hit) {
      event.preventDefault();
      event.stopImmediatePropagation();
      bounce(hit.object.userData.bearId);
      return;
    }
    // A small touch-friendly margin also catches thin silhouettes mid-rotation.
    const x = pointer.x * world.width / 2;
    const y = pointer.y * world.height / 2;
    const nearby = bears.filter((bear) => Math.hypot(bear.x - x, bear.y - y) < world.bearSize * 0.58)
      .sort((a, b) => b.z - a.z)[0];
    if (nearby) {
      event.preventDefault();
      event.stopImmediatePropagation();
      bounce(nearby.id);
    }
  }

  function cancelPointer() { pointerStart = null; }

  function resize() {
    if (disposed) return;
    const bounds = canvas.parentElement.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const next = createWorld(bounds.width, bounds.height);
    resizeWorld(bears, world, next);
    world = next;
    camera.left = -world.width / 2;
    camera.right = world.width / 2;
    camera.top = world.height / 2;
    camera.bottom = -world.height / 2;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(bounds.width, bounds.height, false);
    draw();
    schedule();
  }

  function visibilityChange() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (!document.hidden) schedule();
  }

  function preferenceChange(event) { if (event.matches) setPaused(true); }

  function contextLost(event) {
    event.preventDefault();
    failed = true;
    cancelAnimationFrame(frame);
    frame = 0;
    onError();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement);
  document.addEventListener('visibilitychange', visibilityChange);
  motionPreference.addEventListener('change', preferenceChange);
  window.addEventListener('pointerdown', pointerDown, true);
  window.addEventListener('click', pageClick, true);
  window.addEventListener('pointercancel', cancelPointer, true);
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
    const normalized = new THREE.Group();
    normalized.add(model);
    normalized.scale.setScalar(1 / height);
    normalized.rotation.y = Math.PI;

    bears.forEach((bear) => {
      const group = new THREE.Group();
      const copy = normalized.clone(true);
      copy.traverse((child) => {
        if (!child.isMesh) return;
        child.material = materials[bear.colorIndex];
        child.userData.bearId = bear.id;
      });
      group.add(copy);
      groups.push(group);
      scene.add(group);
    });
    loaded = true;
    resize();
    draw();
    onReady();
    schedule();
  }).catch((error) => {
    if (disposed) return;
    failed = true;
    console.error('No se pudo cargar la lluvia de gomitas:', error);
    onError();
  });

  return {
    setPaused,
    bounceActive,
    resetGame() {
      Object.assign(score, createScore(), { best: score.best });
      emitScore();
      draw();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', visibilityChange);
      motionPreference.removeEventListener('change', preferenceChange);
      window.removeEventListener('pointerdown', pointerDown, true);
      window.removeEventListener('click', pageClick, true);
      window.removeEventListener('pointercancel', cancelPointer, true);
      canvas.removeEventListener('webglcontextlost', contextLost);
      geometries.forEach((geometry) => geometry.dispose());
      sourceMaterials.forEach((material) => material.dispose());
      materials.forEach((material) => material.dispose());
      haloGeometry.dispose();
      haloMaterial.dispose();
      environment.dispose();
      renderer.dispose();
    },
  };
}
