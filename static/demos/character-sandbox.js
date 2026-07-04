// character-sandbox 演示场 —— 由真实 GameBox 角色模块驱动的点地寻路。
//   WorldTargetCharacterMotionController  真实角色运动（朝目标走、到停靠半径停、自动转向移动方向）
//   GeneralObjectModelController          把控制器 yaw 姿态映射到角色网格（keepBasisUp=直立）
//   GroundClickIndicator                  落点涟漪（该模块的设计用途）
// 库里没有角色视觉工厂 → 角色网格用图元自拼（面朝 -Z，配 GeneralObjectModelController 默认 localForward='-z'）。
import * as THREE from 'three';
import { mountThree } from './_three.js';
import { WorldTargetCharacterMotionController } from '../../gamebox/modules/actor-motion/character/WorldTargetCharacterMotionController.js';
import { GeneralObjectModelController } from '../../gamebox/modules/actor-motion/GeneralObjectModelController.js';
import { GroundClickIndicator } from '../../gamebox/modules/world/visual-effects/GroundClickIndicator.js';

function buildCharacter() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x9fb4d4, metalness: 0.3, roughness: 0.6 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x32e0ff, emissive: 0x0a3a4a, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a3348, roughness: 0.8 });
  // 躯干胶囊（默认轴 Y）：feet 贴 y=0 → 上移 length/2 + radius。
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 8, 16), bodyMat);
  body.position.y = 0.67; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 16), bodyMat);
  head.position.y = 1.5; g.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.06), accentMat);
  visor.position.set(0, 1.53, -0.22); g.add(visor);           // 面罩朝 -Z（正面）
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 4), accentMat);
  nose.rotation.x = -Math.PI / 2;                             // 锥尖 +Y → -Z
  nose.position.set(0, 0.92, -0.42); g.add(nose);             // 胸前朝向指示
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 6, 12), darkMat);
    arm.position.set(side * 0.44, 0.78, 0); g.add(arm);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.42), darkMat);
    foot.position.set(side * 0.16, 0.08, -0.04); g.add(foot);
  }
  return g;
}

export function mount(host, { interactive = false } = {}) {
  const ctx = {};   // setup 内填 camera / onPointerDown，供 mount 级监听复用

  const handle = mountThree(host, ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x080b12, 30, 90);
    scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x151a26, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.25); sun.position.set(8, 16, 6); scene.add(sun);

    // 地面 + 网格（y=0）。
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 56),
      new THREE.MeshStandardMaterial({ color: 0x0c1220, roughness: 0.98 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const grid = new THREE.GridHelper(80, 40, 0x2a3550, 0x182036);
    grid.position.y = 0.01; scene.add(grid);

    // 几根装饰柱做地标（不参与碰撞，纯参照）。
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1a2438, roughness: 0.9 });
    for (const [x, z, h] of [[-11, -7, 2.4], [12, -9, 3.0], [9, 10, 2.0], [-13, 8, 2.6], [0, -15, 3.4]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, h, 12), pillarMat);
      p.position.set(x, h / 2, z); scene.add(p);
    }

    // ---- 真实模块 ----
    const ctrl = new WorldTargetCharacterMotionController({});
    ctrl.setState({ position: { x: 0, y: 0, z: 0 } });
    const character = buildCharacter(); scene.add(character);
    const model = new GeneralObjectModelController({ model: character, localForward: '-z', keepBasisUp: true });

    // 巡逻航点（自动演示）。
    const PATROL = [[10, 0], [6, 10], [-8, 9], [-12, -3], [-4, -12], [8, -10]].map(([x, z]) => ({ x, y: 0, z }));
    let patrolIdx = 0;
    let userTarget = null;                 // interactive 点击目标（优先于巡逻）
    const indicators = [];
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const raycaster = new THREE.Raycaster();

    function spawnIndicator(pos) {
      const ind = new GroundClickIndicator({ position: pos, color: 0x32e0ff, accentColor: 0xbaf8ec });
      scene.add(ind.group); indicators.push(ind);
    }
    spawnIndicator(PATROL[0]);

    // interactive 点击 → 射线打地面 → 设 userTarget + 涟漪。
    ctx.camera = camera;
    ctx.onPointerDown = (e) => {
      const r = host.getBoundingClientRect();
      const ndc = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
      raycaster.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, hit)) {
        userTarget = { x: hit.x, y: 0, z: hit.z };
        spawnIndicator(userTarget);
      }
    };

    camera.position.set(0, 8, 7.5);
    const camGoal = new THREE.Vector3(), lookAt = new THREE.Vector3();
    const CAM_OFF = new THREE.Vector3(0, 8, 7.5);
    const reached = (tp) => { const dx = tp.x - ctrl.position.x, dz = tp.z - ctrl.position.z; return dx * dx + dz * dz <= 0.6 * 0.6; };

    return (dt) => {
      const target = (interactive && userTarget) ? userTarget : PATROL[patrolIdx];

      // 真实角色运动一步（commit=true → 落定位置/朝向）。
      const s = ctrl.planMovement({ moveTarget: target, deltaSeconds: dt, commit: true });
      model.step(s.position, s.planarMoveFrame);   // keepBasisUp → 只用水平 forward，角色直立

      // 到点：用户目标 → 清空回巡逻；巡逻点 → 前进并冒新涟漪。
      if (reached(target)) {
        if (interactive && userTarget) { userTarget = null; }
        else { patrolIdx = (patrolIdx + 1) % PATROL.length; spawnIndicator(PATROL[patrolIdx]); }
      }

      // 步进涟漪，结束即销毁。
      for (let i = indicators.length - 1; i >= 0; i--) {
        if (!indicators[i].step(dt)) { scene.remove(indicators[i].group); indicators[i].dispose(); indicators.splice(i, 1); }
      }

      // 固定角度 ARPG 追随相机（不随朝向旋转 → 点击落点直观）。
      camGoal.copy(s.position).add(CAM_OFF);
      camera.position.lerp(camGoal, 1 - Math.pow(0.0015, dt));
      lookAt.copy(s.position).setY(0.8); camera.lookAt(lookAt);
    };
  });

  if (interactive) {
    host.style.cursor = 'crosshair';
    host.addEventListener('pointerdown', ctx.onPointerDown);
  }

  return {
    destroy() {
      if (interactive && ctx.onPointerDown) host.removeEventListener('pointerdown', ctx.onPointerDown);
      handle.destroy();
    },
  };
}
