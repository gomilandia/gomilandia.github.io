import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createWorld, createBears, stepSimulation, resizeWorld, shakeBears } from './gummyPhysics.js';
import { createMouseShakeDetector, shouldShakeFromSpace } from './gummyGestures.js';

const GUMMY_COLORS = [0xff0033, 0x00cc44, 0xffaa00, 0xffee00, 0xff66cc];

export function createGummyScene(canvas, { onReady = () => {}, onPausedChange = () => {}, onError = () => {}, onShake = () => {} } = {}) {
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
  const materials = GUMMY_COLORS.map((hex) => {
    const color = new THREE.Color(hex);
    return new THREE.MeshPhysicalMaterial({
      color, metalness: 0, roughness: 0.19, transmission: 0.65, thickness: 0.7,
      ior: 1.45, clearcoat: 1, clearcoatRoughness: 0.12,
      attenuationColor: color, attenuationDistance: 0.9, envMapIntensity: 0.75,
    });
  });
  const geometries = new Set();
  const sourceMaterials = new Set();
  const batches = [];
  const modelParts = [];
  const transform = new THREE.Object3D();
  const instanceMatrix = new THREE.Matrix4();
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const touchPreference = window.matchMedia('(pointer: coarse)');
  const mouseShake = createMouseShakeDetector();
  const worldForSize = (width, height) => createWorld(width, height, { mobileBreakpoint: touchPreference.matches ? Infinity : 640 });
  let world = worldForSize(canvas.clientWidth, canvas.clientHeight);
  let bears = createBears(world);
  let batchCapacity = 0;
  let renderDirty = true;
  let pointer = null;
  let lastPointer = null;
  let paused = motionPreference.matches;
  let disposed = false;
  let loaded = false;
  let failed = false;
  let frame = 0;
  let lastTime = 0;
  let lastFrame = 0;
  let lastShake = -Infinity;

  function syncObjects() {
    const required = Math.ceil(Math.max(world.maxBears, bears.length) / materials.length);
    if (required > batchCapacity) {
      for (const { mesh } of batches) {
        scene.remove(mesh);
        mesh.dispose();
      }
      batches.length = 0;
      batchCapacity = required;
      materials.forEach((material, colorIndex) => {
        modelParts.forEach((part) => {
          const mesh = new THREE.InstancedMesh(part.geometry, material, batchCapacity);
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          mesh.frustumCulled = false;
          scene.add(mesh);
          batches.push({ mesh, colorIndex, modelMatrix: part.matrix });
        });
      });
    }
    const counts = materials.map(() => 0);
    for (const bear of bears) {
      if (!bear.active || bear.y > world.height / 2 + world.bearSize || bear.y < -world.height / 2 - world.bearSize) continue;
      const index = counts[bear.colorIndex]++;
      transform.position.set(bear.x, bear.y, bear.z);
      transform.rotation.set(bear.rotationX, bear.rotationY, bear.rotationZ);
      transform.scale.set(world.bearSize * (1 + bear.bounceAmount * 0.08), world.bearSize * (1 - bear.bounceAmount * 0.12), world.bearSize);
      transform.updateMatrix();
      for (const batch of batches) {
        if (batch.colorIndex !== bear.colorIndex) continue;
        instanceMatrix.multiplyMatrices(transform.matrix, batch.modelMatrix);
        batch.mesh.setMatrixAt(index, instanceMatrix);
      }
    }
    for (const { mesh, colorIndex } of batches) {
      mesh.count = counts[colorIndex];
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  function draw() {
    if (!loaded || disposed || failed) return;
    syncObjects();
    renderer.render(scene, camera);
    renderDirty = false;
  }

  function animate(time) {
    frame = 0;
    if (disposed || !loaded || failed || document.hidden) return;
    const interval = 1000 / (world.mobile ? 30 : 45);
    if (lastFrame && time - lastFrame < interval - 1) {
      frame = requestAnimationFrame(animate);
      return;
    }
    lastFrame = time;
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
    lastTime = time;
    const wasMoving = bears.some((bear) => bear.active && !bear.sleeping);
    if (!paused) {
      stepSimulation(bears, world, delta, { pointer });
      if (pointer) {
        pointer.vx *= Math.exp(-14 * delta);
        pointer.vy *= Math.exp(-14 * delta);
      }
    }
    const moving = bears.some((bear) => bear.active && !bear.sleeping);
    if (renderDirty || wasMoving || moving) draw();
    if (!paused && (moving || bears.length < world.maxBears || bears.some((bear) => !bear.active))) frame = requestAnimationFrame(animate);
    else lastTime = 0;
  }

  function schedule() {
    if (!frame && loaded && !disposed && !failed && !document.hidden) frame = requestAnimationFrame(animate);
  }

  function setPaused(value) {
    paused = Boolean(value);
    lastTime = 0;
    lastFrame = 0;
    renderDirty = true;
    onPausedChange(paused);
    schedule();
  }

  function shake() {
    const now = performance.now();
    if (!loaded || disposed || failed || document.hidden || now - lastShake < 1400) return false;
    lastShake = now;
    if (paused) bears = createBears(world);
    else shakeBears(bears, world);
    pointer = null;
    mouseShake.reset();
    onShake();
    draw();
    schedule();
    return true;
  }

  function pointerMove(event) {
    if (!event.isPrimary || disposed || failed || document.hidden) return;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const now = event.timeStamp;
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * world.width;
    const y = (0.5 - (event.clientY - bounds.top) / bounds.height) * world.height;
    const elapsed = lastPointer ? (now - lastPointer.time) / 1000 : 0;
    const clampVelocity = (value) => THREE.MathUtils.clamp(value, -24, 24);
    pointer = {
      x, y, radius: world.bearSize * 0.38,
      vx: elapsed > 0 && elapsed < 0.15 ? clampVelocity((x - lastPointer.x) / elapsed) : 0,
      vy: elapsed > 0 && elapsed < 0.15 ? clampVelocity((y - lastPointer.y) / elapsed) : 0,
    };
    lastPointer = { x, y, time: now };
    if (event.pointerType !== 'touch' && mouseShake.sample(event.clientX, event.clientY, now)) shake();
    if (!paused) {
      renderDirty = true;
      schedule();
    }
  }

  function clearPointer() {
    pointer = null;
    lastPointer = null;
    mouseShake.reset();
  }
  function pointerOut(event) { if (!event.relatedTarget) clearPointer(); }
  function pointerUp(event) { if (event.pointerType === 'touch') clearPointer(); }
  function keyDown(event) {
    if (loaded && !disposed && !failed && !document.hidden && shouldShakeFromSpace(event)) {
      event.preventDefault();
      shake();
    }
  }

  function resize() {
    if (disposed) return;
    const bounds = canvas.parentElement.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const next = worldForSize(bounds.width, bounds.height);
    resizeWorld(bears, world, next);
    world = next;
    clearPointer();
    camera.left = -world.width / 2;
    camera.right = world.width / 2;
    camera.top = world.height / 2;
    camera.bottom = -world.height / 2;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, world.mobile ? 1.25 : 1.5));
    renderer.transmissionResolutionScale = world.mobile ? 0.35 : 0.5;
    renderer.setSize(bounds.width, bounds.height, false);
    draw();
    schedule();
  }

  function visibilityChange() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    lastFrame = 0;
    clearPointer();
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
  touchPreference.addEventListener('change', resize);
  window.addEventListener('pointermove', pointerMove, { passive: true });
  window.addEventListener('pointerdown', pointerMove, { passive: true });
  window.addEventListener('pointerup', pointerUp, { passive: true });
  window.addEventListener('pointercancel', clearPointer, { passive: true });
  window.addEventListener('pointerout', pointerOut, { passive: true });
  window.addEventListener('blur', clearPointer);
  window.addEventListener('keydown', keyDown);
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
    const sourceModel = new THREE.Group();
    sourceModel.add(model);
    sourceModel.scale.setScalar(1 / height);
    sourceModel.rotation.y = Math.PI;
    sourceModel.updateMatrixWorld(true);
    sourceModel.traverse((child) => {
      if (child.isMesh) modelParts.push({ geometry: child.geometry, matrix: child.matrixWorld.clone() });
    });
    loaded = true;
    resize();
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
    shake,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', visibilityChange);
      motionPreference.removeEventListener('change', preferenceChange);
      touchPreference.removeEventListener('change', resize);
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerdown', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', clearPointer);
      window.removeEventListener('pointerout', pointerOut);
      window.removeEventListener('blur', clearPointer);
      window.removeEventListener('keydown', keyDown);
      canvas.removeEventListener('webglcontextlost', contextLost);
      batches.forEach(({ mesh }) => mesh.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      sourceMaterials.forEach((material) => material.dispose());
      materials.forEach((material) => material.dispose());
      environment.dispose();
      renderer.dispose();
    },
  };
}
