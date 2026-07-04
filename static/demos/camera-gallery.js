// camera-gallery 演示场 —— 真实 PositionFollowCameraRig 驱动 three 相机跟随一辆行驶的车。
import * as THREE from 'three';
import { mountThree, asObject3D } from './_three.js';
import { PositionFollowCameraRig } from '../../gamebox/modules/camera/PositionFollowCameraRig.js';
import { createCarVisual } from '../../gamebox/modules/world/object/factory/CarVisualFactory.js';

export function mount(host) {
  return mountThree(host, ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x080b12, 24, 70);
    scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x151a26, 1.05));
    const dir = new THREE.DirectionalLight(0xffffff, 1.35); dir.position.set(8, 14, 6); scene.add(dir);

    // 地面 + 网格
    const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 48),
      new THREE.MeshStandardMaterial({ color: 0x0c1220, roughness: 0.98 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const grid = new THREE.GridHelper(60, 40, 0x2a3550, 0x182036);
    grid.position.y = 0.01; scene.add(grid);

    // 目标车（真实工厂）
    const car = asObject3D(createCarVisual({ paintColor: 0x5b8cff, cabinColor: 0xeaf1ff }));
    scene.add(car);

    // 环形跑道视觉
    const track = new THREE.Mesh(new THREE.RingGeometry(6.4, 7.6, 64),
      new THREE.MeshBasicMaterial({ color: 0x1a2438, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    track.rotation.x = -Math.PI / 2; track.position.y = 0.02; scene.add(track);

    const rig = new PositionFollowCameraRig({ azimuth: 0, distance: 11, height: 6.5, lookHeight: 1.1, positionLag: 0.12, lookLag: 0.08 });

    const RADIUS = 7, SPEED = 0.5;
    let t = 0, first = true;
    const pos = new THREE.Vector3();
    return (dt) => {
      t += dt;
      // 车沿圆周行驶
      const ang = t * SPEED;
      pos.set(Math.cos(ang) * RADIUS, 0, Math.sin(ang) * RADIUS);
      car.position.copy(pos);
      // 朝向行进方向（切线）
      car.rotation.y = -ang + Math.PI / 2;
      // 相机方位角缓慢环绕，展示 rig 参数
      rig.azimuth = ang + Math.PI * 0.75 + Math.sin(t * 0.2) * 0.4;
      rig.step({ targetPosition: pos, deltaSeconds: dt, snapToTarget: first, camera });
      first = false;
    };
  });
}
