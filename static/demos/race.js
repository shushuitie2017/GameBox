// race 演示场 —— 由真实 GameBox 载具/赛道模块驱动的第三人称环形竞速。
//   ArcadeCarMotionController  纯运动学车辆（自行车转向模型 + 贴地 + 加力，无 rapier）
//   RaceTrackEnvironment       生成赛道地形 + checkpoint 门 + 护栏 + 起伏 terrainSampler
//   CarVisualFactory           真实车辆网格（打磨后：流线车身 + 玻璃 + 轮毂轮）
//   CarModelController         姿态映射到底盘 + 车轮滚动/转向
import * as THREE from 'three';
import { mountThree } from './_three.js';
import { ArcadeCarMotionController } from '../../gamebox/modules/actor-motion/ground-vehicle/ArcadeCarMotionController.js';
import { CarModelController } from '../../gamebox/modules/actor-motion/ground-vehicle/CarModelController.js';
import { createCarVisual } from '../../gamebox/modules/world/object/factory/CarVisualFactory.js';
import { RaceTrackEnvironment } from '../../gamebox/modules/world/environment/RaceTrackEnvironment.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function mount(host, { interactive = false } = {}) {
  const input = { left: 0, right: 0, throttle: 0, reverse: 0, boost: false, active: false };

  const handle = mountThree(host, ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x0a1018, 90, 380);
    scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x1a2130, 1.05));
    const sun = new THREE.DirectionalLight(0xffffff, 1.35); sun.position.set(40, 70, 20); scene.add(sun);

    // 椭圆赛道（一圈平面点 {right,forward}）。
    const RX = 40, RZ = 27, N = 18;
    const trackPlanarPoints = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      // 轻微扰动让弯道不完全对称，更有赛道感。
      const r = 1 + 0.12 * Math.sin(a * 3);
      trackPlanarPoints.push({ right: Math.cos(a) * RX * r, forward: Math.sin(a) * RZ * r });
    }

    // 减负的自然环境配置（默认 155 树太重）。
    const env = new RaceTrackEnvironment({
      scene, trackPlanarPoints, closed: true,
      naturalEnvironmentConfig: { terrainSize: 200, terrainSegments: 72, treeCount: 64, rockCount: 18, grassBladeCount: 90 },
    }).create();

    const spawn = env.spawnPose(0, true, 6, 0, 0.4);

    // 真实车辆物理 + 视觉。
    const ctrl = new ArcadeCarMotionController({ maxForwardSpeed: 46, throttleAccel: 34, boostMultiplier: 1.4, wheelBase: 4.2 });
    ctrl.reset(spawn.position, spawn.yaw);
    const S = 2.0;
    const visual = createCarVisual({ paintColor: 0x32e0ff, cabinColor: 0xdff4ff, wheelColor: 0x14181f });
    visual.group.scale.setScalar(S);
    scene.add(visual.group);
    const model = new CarModelController({
      vehicleModel: visual.group, wheels: visual.wheels, wheelPivots: visual.wheelPivots, wheelRadius: 0.35 * S,
    });

    let targetIdx = spawn.nextIndex;
    camera.position.copy(spawn.position).add(new THREE.Vector3(0, 8, 16));
    const fwd = new THREE.Vector3(), up = new THREE.Vector3(), back = new THREE.Vector3();
    const camGoal = new THREE.Vector3(), lookAt = new THREE.Vector3();

    const update = (dt) => {
      let left = 0, right = 0, throttle = 0, reverse = 0, boost = false;

      if (interactive && input.active) {
        left = input.left; right = input.right; throttle = input.throttle; reverse = input.reverse; boost = input.boost;
      } else {
        // 自动驾驶：朝下一个 checkpoint 转向，直道加力。
        const cp = env.checkpoints[targetIdx].position;
        const tx = cp.x - ctrl.position.x, tz = cp.z - ctrl.position.z;
        const tl = Math.hypot(tx, tz) || 1;
        const nx = tx / tl, nz = tz / tl;
        const fx = ctrl.bodyFrame.forward.x, fz = ctrl.bodyFrame.forward.z;
        const dot = fx * nx + fz * nz;                 // 对准程度
        const crs = fx * nz - fz * nx;                 // 转向符号（xz 平面叉积 y 分量）
        const steer = clamp(crs * 2.4, -1, 1);         // yaw+ 左转(-X)，故正 crs → 左
        if (steer > 0) right = steer; else left = -steer;
        throttle = dot > 0.2 ? 0.9 : 0.55;             // 对准才全油门
        boost = dot > 0.85;                            // 直道加力
        if (tl < env.checkpoints[targetIdx].radius) targetIdx = (targetIdx + 1) % env.checkpoints.length;
      }

      const s = ctrl.planMovement({ left, right, throttle, reverse, boost, deltaSeconds: dt, terrain: env.terrainSampler, commit: true });
      model.step({ position: s.position, bodyFrame: s.bodyFrame, velocity: s.velocity, steeringAngle: s.steeringAngle, deltaSeconds: dt });

      // 追尾相机。
      fwd.copy(s.bodyFrame.forward); up.copy(s.bodyFrame.up); back.copy(fwd).multiplyScalar(-1);
      camGoal.copy(s.position).addScaledVector(back, 14).addScaledVector(up, 6.5);
      camera.position.lerp(camGoal, 1 - Math.pow(0.0025, dt));
      lookAt.copy(s.position).addScaledVector(fwd, 7).addScaledVector(up, 1.5);
      camera.lookAt(lookAt);
    };
    return update;
  }, { bg: 0x0a1018, far: 460, fov: 58 });

  // 键盘（interactive）。
  let onDown, onUp;
  if (interactive) {
    host.tabIndex = 0; host.style.outline = 'none';
    const set = (k, v) => {
      switch (k) {
        case 'ArrowLeft': input.left = v; break;
        case 'ArrowRight': input.right = v; break;
        case 'ArrowUp': input.throttle = v; break;
        case 'ArrowDown': input.reverse = v; break;
        case ' ': case 'Spacebar': input.boost = !!v; break;
        default: return false;
      }
      input.active = !!(input.left || input.right || input.throttle || input.reverse || input.boost);
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
