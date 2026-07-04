// factory-showroom 演示场 —— 真实 VisualFactory 模块造 three 网格，转台展示 + 相机环绕。
import * as THREE from 'three';
import { mountThree, asObject3D } from './_three.js';
import { createTreeVisual, createTreeMaterials } from '../../gamebox/modules/world/object/factory/PlantVisualFactory.js';
import { createIrregularRockVisual } from '../../gamebox/modules/world/object/factory/RockVisualFactory.js';
import { createCarVisual } from '../../gamebox/modules/world/object/factory/CarVisualFactory.js';
import { createAirplaneVisual } from '../../gamebox/modules/world/object/factory/AirplaneVisualFactory.js';
import { createPickupVisual } from '../../gamebox/modules/world/object/factory/PickupVisualFactory.js';
import { createMissileProjectileVisual } from '../../gamebox/modules/world/object/factory/ProjectileVisualFactory.js';

export function mount(host) {
  return mountThree(host, ({ scene, camera }) => {
    scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x171c28, 1.15));
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(6, 12, 7); scene.add(dir);
    const rim = new THREE.PointLight(0x5b8cff, 0.6, 60); rim.position.set(-8, 5, -6); scene.add(rim);

    // 地台圆盘
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(9.5, 64),
      new THREE.MeshStandardMaterial({ color: 0x0e1420, roughness: 0.95, metalness: 0.0 }));
    disc.rotation.x = -Math.PI / 2; scene.add(disc);
    const ringGeo = new THREE.RingGeometry(9.2, 9.5, 64);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x32e0ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; scene.add(ring);

    // 各工厂产出一件展品，围成一圈
    const exhibits = [];
    const safe = (fn) => { try { return asObject3D(fn()); } catch (e) { console.warn('factory failed', e); return null; } };
    const items = [
      safe(() => createTreeVisual({ height: 4.2, radius: 0.52, materials: createTreeMaterials({}) })),
      safe(() => createIrregularRockVisual({ radius: 1.5, color: 0x8e95a3, detail: 1 })),
      safe(() => createCarVisual({})),
      safe(() => { const a = createAirplaneVisual({ scale: 0.9 }); return a; }),
      safe(() => createPickupVisual({ type: 'health' })),
      safe(() => createMissileProjectileVisual()),
    ].filter(Boolean);

    const R = 5.6, TARGET = 2.4;
    items.forEach((obj, i) => {
      // 归一化：各工厂原生尺度差异极大 → 缩放到统一包围盒 + 居中 + 坐落底座
      let box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      obj.scale.multiplyScalar(TARGET / maxDim);
      box = new THREE.Box3().setFromObject(obj);
      const c = box.getCenter(new THREE.Vector3());
      obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box.min.y;

      const a = (i / items.length) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.position.set(Math.sin(a) * R, 0, Math.cos(a) * R);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, 0.4, 24),
        new THREE.MeshStandardMaterial({ color: 0x131a28, roughness: 0.8 }));
      ped.position.y = 0.2; pivot.add(ped);
      const spin = new THREE.Group(); spin.position.y = 0.42; spin.add(obj); pivot.add(spin);
      scene.add(pivot);
      exhibits.push(spin);
    });

    camera.position.set(0, 6, 13);
    let t = 0;
    return (dt) => {
      t += dt;
      const cr = 13, ch = 5.5 + Math.sin(t * 0.3) * 1.2;
      camera.position.set(Math.sin(t * 0.22) * cr, ch, Math.cos(t * 0.22) * cr);
      camera.lookAt(0, 1.4, 0);
      exhibits.forEach((s, i) => { s.rotation.y += dt * (0.5 + i * 0.08); });
    };
  });
}
