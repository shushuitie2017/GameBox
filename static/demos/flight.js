// flight 演示场 —— 由真实 GameBox 飞行模块驱动的第三人称追尾飞行。
//   AirplaneMotionController  真实飞行物理（油门/俯仰/横滚倾转转向/加力）
//   AirplaneVisualFactory     真实 three 机体网格（含内置 JetFlameLocalVisual 尾焰）
//   AirplaneModelController   把控制器姿态映射到机体 + 步进尾焰
// 相对 import：/static/demos/ → /gamebox/modules/ 为 ../../gamebox/modules/（深度固定，base 无关）。
import * as THREE from 'three';
import { mountThree } from './_three.js';
import { AirplaneMotionController } from '../../gamebox/modules/actor-motion/aircraft/AirplaneMotionController.js';
import { AirplaneModelController } from '../../gamebox/modules/actor-motion/aircraft/AirplaneModelController.js';
import { createAirplaneVisual } from '../../gamebox/modules/world/object/factory/AirplaneVisualFactory.js';

export function mount(host, { interactive = false } = {}) {
  // interactive 时用户接管；否则自动驾驶。共享给键盘处理与更新循环。
  const input = { left: 0, right: 0, up: 0, down: 0, boost: false, active: false };

  const handle = mountThree(host, ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x0a0f1a, 70, 360);
    scene.add(new THREE.HemisphereLight(0x9fc0ff, 0x0a0f16, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(30, 60, 20); scene.add(sun);

    // 地面：实心地板 + 网格，按格吸附跟随飞机 XZ → 无尽流动的速度感。
    const GROUND_Y = -34, SPAN = 480, SPACING = 20;
    const grid = new THREE.GridHelper(SPAN, SPAN / SPACING, 0x2a3a58, 0x141d30);
    grid.position.y = GROUND_Y; scene.add(grid);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(SPAN, SPAN),
      new THREE.MeshStandardMaterial({ color: 0x0b111d, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = GROUND_Y - 0.2; scene.add(floor);

    // 云团：相对飞机环绕回收，营造穿云而过的运动参照。
    const R = 210, CLOUDS = [];
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0x2c3c5c, roughness: 1, transparent: true, opacity: 0.5 });
    const cloudGeo = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < 44; i++) {
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      const s = 6 + Math.random() * 13;
      puff.scale.set(s * (0.8 + Math.random() * 0.6), s * 0.5, s * (0.8 + Math.random() * 0.6));
      puff.position.set((Math.random() * 2 - 1) * R, -6 + Math.random() * 48, (Math.random() * 2 - 1) * R);
      scene.add(puff); CLOUDS.push(puff);
    }

    // ---- 真实模块 ----
    const ctrl = new AirplaneMotionController({});
    ctrl.reset({ x: 0, y: 0, z: 0 });
    ctrl.throttle = 0.55;
    const visual = createAirplaneVisual({
      scale: 1.7, showEngineGlow: true,
      accentColor: 0x32e0ff, accentEmissive: 0x06344a, accentEmissiveIntensity: 0.5,
    });
    scene.add(visual.group);
    const model = new AirplaneModelController(visual.group, visual.jetFlames);

    camera.position.set(0, 6, -16);

    const worldUp = new THREE.Vector3(0, 1, 0);
    const fwd = new THREE.Vector3(), back = new THREE.Vector3(), bUp = new THREE.Vector3();
    const camPos = new THREE.Vector3(), lookAt = new THREE.Vector3();
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    let t = 0;

    return (dt) => {
      t += dt;

      let left = 0, right = 0, up = 0, down = 0, boost = false;
      if (interactive && input.active) {
        left = input.left; right = input.right; up = input.up; down = input.down; boost = input.boost;
      } else {
        // 自动驾驶：偏向盘旋 + 轻柔起伏 + 高度回正 + 周期加力。
        const steer = Math.sin(t * 0.22) * 0.7 + 0.25;
        if (steer > 0) right = Math.min(1, steer); else left = Math.min(1, -steer);
        const desiredPitch = 0.05 * Math.sin(t * 0.5) + clamp(-ctrl.position.y * 0.012, -0.1, 0.1);
        const pe = desiredPitch - ctrl.pitch;
        if (pe > 0) up = Math.min(1, pe * 5); else down = Math.min(1, -pe * 5);
        boost = (t % 8) < 1.5;
      }

      // 真实飞行物理一步（commit=true → 直接落定姿态与位置）。
      const s = ctrl.planMovement({ left, right, up, down, throttle: 1, boost, deltaSeconds: dt, commit: true });

      // 真实姿态映射 + 尾焰步进。
      model.step({
        position: s.position, yaw: s.yaw, pitch: s.pitch, roll: s.roll,
        throttle: ctrl.throttle, isBoosting: ctrl.isBoosting, elapsedTimeSeconds: t, deltaSeconds: dt,
      });

      // 环境跟随飞机。
      const px = s.position.x, pz = s.position.z;
      for (const c of CLOUDS) {
        if (c.position.x - px > R) c.position.x -= R * 2; else if (c.position.x - px < -R) c.position.x += R * 2;
        if (c.position.z - pz > R) c.position.z -= R * 2; else if (c.position.z - pz < -R) c.position.z += R * 2;
      }
      grid.position.set(Math.round(px / SPACING) * SPACING, GROUND_Y, Math.round(pz / SPACING) * SPACING);
      floor.position.set(px, GROUND_Y - 0.2, pz);

      // 追尾相机：在机体后上方，随横滚轻微侧倾。
      fwd.copy(s.bodyFrame.forward); bUp.copy(s.bodyFrame.up); back.copy(fwd).multiplyScalar(-1);
      camPos.copy(s.position).addScaledVector(back, 13).addScaledVector(worldUp, 4.5).addScaledVector(bUp, 1.5);
      camera.position.copy(camPos);
      camera.up.copy(worldUp).lerp(bUp, 0.35).normalize();
      lookAt.copy(s.position).addScaledVector(fwd, 8);
      camera.lookAt(lookAt);
    };
  }, { bg: 0x0a0f1a, far: 720, fov: 55 });

  // ---- 键盘（interactive）----
  let onDown, onUp;
  if (interactive) {
    host.tabIndex = 0; host.style.outline = 'none';
    const set = (k, v) => {
      switch (k) {
        case 'ArrowLeft': input.left = v; break;
        case 'ArrowRight': input.right = v; break;
        case 'ArrowUp': input.up = v; break;
        case 'ArrowDown': input.down = v; break;
        case ' ': case 'Spacebar': input.boost = !!v; break;
        default: return false;
      }
      input.active = !!(input.left || input.right || input.up || input.down || input.boost);
      return true;
    };
    onDown = (e) => { if (set(e.key, 1)) e.preventDefault(); };
    onUp = (e) => { set(e.key, 0); };
    host.addEventListener('keydown', onDown);
    host.addEventListener('keyup', onUp);
  }

  return {
    destroy() {
      if (interactive) { host.removeEventListener('keydown', onDown); host.removeEventListener('keyup', onUp); }
      handle.destroy();
    },
    focus() { if (interactive) host.focus(); },
  };
}
