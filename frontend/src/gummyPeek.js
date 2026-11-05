import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const FIRST_PEEK = 8.5;
const INTERVAL = 24;
const DURATION = 6.6;
const EASE_TIME = 1.2;
const smooth = (value) => value * value * (3 - 2 * value);

export function getPeekState(elapsed, reducedMotion = false) {
  if (reducedMotion || !Number.isFinite(elapsed) || elapsed < FIRST_PEEK) {
    return { visible: false, amount: 0, side: 'right', tilt: 0 };
  }
  const cycle = Math.floor((elapsed - FIRST_PEEK) / INTERVAL);
  const time = (elapsed - FIRST_PEEK) % INTERVAL;
  const side = cycle % 2 === 0 ? 'right' : 'left';
  if (time >= DURATION) return { visible: false, amount: 0, side, tilt: 0 };
  const amount = smooth(Math.max(0, Math.min(1, time / EASE_TIME, (DURATION - time) / EASE_TIME)));
  return { visible: amount > 0, amount, side, tilt: Math.sin(time * 1.8) * 0.055 };
}

export function createCornerPeek(canvas, element, model, sourceMaterial) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.transmissionResolutionScale = 0.5;
  const scene = new THREE.Scene();
  // Render targets belong to one WebGL context; this small renderer owns its own light map.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();
  scene.environmentIntensity = 0.8;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffd5c2, 1.1));
  const light = new THREE.DirectionalLight(0xffffff, 2.3);
  light.position.set(-3, 4, 8);
  scene.add(light);
  const camera = new THREE.OrthographicCamera(-1.6, 1.6, 1.9, -1.9, 0.1, 30);
  camera.position.z = 10;
  const material = sourceMaterial.clone();
  material.opacity = 1;
  material.transparent = false;
  material.depthWrite = true;
  const bear = new THREE.Group();
  const copy = model.clone(true);
  copy.traverse((child) => { if (child.isMesh) child.material = material; });
  bear.add(copy);
  bear.scale.setScalar(3.3);
  scene.add(bear);
  let visible = false;

  function resize() {
    const { width, height } = element.getBoundingClientRect();
    if (!width || !height) return;
    camera.left = -1.9 * width / height;
    camera.right = 1.9 * width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  resize();

  return {
    resize,
    update(elapsed, reducedMotion) {
      const state = getPeekState(elapsed, reducedMotion);
      if (visible !== state.visible) {
        visible = state.visible;
        element.dataset.visible = String(visible);
      }
      if (!visible) return;
      element.dataset.side = state.side;
      bear.position.set(state.side === 'right' ? 0.13 : -0.13, -4.05 + state.amount * 2.65, 0);
      bear.rotation.set(-0.04, state.side === 'right' ? -0.28 : 0.28,
        (state.side === 'right' ? 0.17 : -0.17) + state.tilt);
      renderer.render(scene, camera);
    },
    dispose() {
      element.dataset.visible = 'false';
      material.dispose();
      environment.dispose();
      renderer.dispose();
    },
  };
}
