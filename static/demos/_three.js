// three 场景脚手架 —— 供三档演示场复用。renderer/scene/camera/resize/loop/destroy 全包。
// three 经 importmap 映射到 vendored /static/vendor/three.module.js（零外链）。
import * as THREE from 'three';

export function mountThree(host, setup, { bg = 0x080b12, fov = 50, near = 0.1, far = 600 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(bg, 1);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, near, far);

  function resize() {
    const r = host.getBoundingClientRect();
    const w = Math.max(1, r.width | 0), h = Math.max(1, r.height | 0);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(host); resize();

  const clock = new THREE.Clock();
  const update = setup({ scene, camera, renderer, THREE }) || function () {};

  // 离屏暂停：用 scroll/getBoundingClientRect（本环境 IntersectionObserver 对 demo host 不可靠）
  let visible = true;
  function checkVisible() {
    const r = host.getBoundingClientRect();
    visible = r.bottom > 0 && r.top < (window.innerHeight || 0);
  }
  window.addEventListener('scroll', checkVisible, { passive: true });
  window.addEventListener('resize', checkVisible);
  checkVisible();

  let raf = 0, running = true;
  function loop() {
    if (!running) return;
    const dt = Math.min(0.05, clock.getDelta());
    if (visible) { update(dt); renderer.render(scene, camera); }
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  return {
    destroy() {
      running = false; cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener('scroll', checkVisible);
      window.removeEventListener('resize', checkVisible);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose?.()); });
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    },
  };
}

// 各工厂返回形态不一（Group / {group} / {mesh} / {visual}）——统一取出 Object3D
export function asObject3D(r) {
  if (!r) return null;
  if (r.isObject3D) return r;
  return r.group || r.mesh || r.visual || r.object || null;
}
