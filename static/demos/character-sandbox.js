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

// 干净风格化机器人（面朝 -Z，脚贴 y=0）：光壳躯体 + 青色核心/面罩 + 深色关节。
function buildCharacter() {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0xb7c4dc, metalness: 0.45, roughness: 0.42 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x272f40, metalness: 0.5, roughness: 0.55 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x32e0ff, emissive: 0x1aa6c8, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.3 });

  // 髋 + 躯干（胶囊，胸腔略扁）。
  const hips = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.12, 6, 16), dark);
  hips.position.y = 0.92; hips.scale.z = 0.8; g.add(hips);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.30, 0.34, 8, 20), shell);
  torso.position.y = 1.24; torso.scale.set(1.06, 1, 0.72); g.add(torso);
  // 胸口核心灯。
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), accent);
  core.position.set(0, 1.28, -0.23); core.scale.z = 0.6; g.add(core);

  // 头 + 面罩（面罩朝 -Z＝正面）。
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.12, 12), dark);
  neck.position.y = 1.5; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 22, 18), shell);
  head.position.y = 1.66; head.scale.set(1, 1.05, 1); g.add(head);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 8, 0, Math.PI * 2, Math.PI * 0.34, Math.PI * 0.3), accent);
  visor.position.set(0, 1.68, -0.02); visor.rotation.x = Math.PI * 0.62; g.add(visor);

  // 肩 + 手臂（上臂 + 前臂 + 肘/肩关节）。
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), dark);
    shoulder.position.set(side * 0.38, 1.34, 0); g.add(shoulder);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.24, 6, 12), shell);
    upper.position.set(side * 0.40, 1.13, 0.02); g.add(upper);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), dark);
    elbow.position.set(side * 0.41, 0.97, 0.03); g.add(elbow);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.22, 6, 12), shell);
    fore.position.set(side * 0.42, 0.82, 0.05); g.add(fore);

    // 髋关节 + 大腿 + 膝 + 小腿 + 脚。
    const hip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), dark);
    hip.position.set(side * 0.15, 0.86, 0); g.add(hip);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.24, 6, 12), shell);
    thigh.position.set(side * 0.15, 0.62, 0); g.add(thigh);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), dark);
    knee.position.set(side * 0.15, 0.42, 0); g.add(knee);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.22, 6, 12), shell);
    shin.position.set(side * 0.15, 0.24, 0.01); g.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.42), dark);
    foot.position.set(side * 0.15, 0.07, -0.06); g.add(foot);
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
