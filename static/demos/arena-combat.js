// arena-combat 演示场 —— 由真实 GameBox 战斗模块驱动的自动竞技场防守。
//   ArenaEnvironment       竞技场地面/围墙/柱/斜坡 + sampleSpawn 合法刷怪点
//   WaveSpawnDirector      波次节奏（吐 spawn 描述符，按存活数推进波次）
//   ProjectileWeaponSystem 开火决策（BORESIGHT 沿炮口方向，冷却/热量）
//   ProjectileManager      推进投射物 + 返回命中事件
//   createBulletProjectileVisual  真实曳光弹视觉
// 库里无敌人/角色视觉与移动 AI → 敌人实体 + 朝玩家的移动 AI + 视觉均手写（诚实标注）。
import * as THREE from 'three';
import { mountThree } from './_three.js';
import { WaveSpawnDirector } from '../../gamebox/modules/gameplay/WaveSpawnDirector.js';
import { ProjectileWeaponSystem, WEAPON_AIM_MODES, WEAPON_TYPES, WEAPON_DECISIONS } from '../../gamebox/modules/gameplay/combat/ProjectileWeaponSystem.js';
import { ProjectileManager } from '../../gamebox/modules/gameplay/combat/ProjectileManager.js';
import { createBulletProjectileVisual } from '../../gamebox/modules/world/object/factory/ProjectileVisualFactory.js';
import { ArenaEnvironment } from '../../gamebox/modules/world/environment/ArenaEnvironment.js';

function buildEnemy() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 0),
    new THREE.MeshStandardMaterial({ color: 0x3a2740, roughness: 0.7, metalness: 0.2, flatShading: true }));
  g.add(body);
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0),
    new THREE.MeshStandardMaterial({ color: 0xff4d5e, emissive: 0xff2b45, emissiveIntensity: 0.8, roughness: 0.4, flatShading: true }));
  shell.position.y = 0.02; g.add(shell);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffcf5a, emissiveIntensity: 1.1 }));
  eye.position.set(0, 0.05, -0.55); g.add(eye);
  return g;
}

function buildTurret() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.3, 0.5, 24),
    new THREE.MeshStandardMaterial({ color: 0x263145, metalness: 0.5, roughness: 0.5 }));
  base.position.y = 0.25; group.add(base);
  const head = new THREE.Group(); head.position.y = 0.85; group.add(head);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0x9fb4d4, metalness: 0.5, roughness: 0.4 }));
  head.add(dome);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0x32e0ff, emissive: 0x1aa6c8, emissiveIntensity: 1.0 }));
  core.position.set(0, 0.18, -0.34); head.add(core);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.1, 14),
    new THREE.MeshStandardMaterial({ color: 0x1c2432, metalness: 0.6, roughness: 0.4 }));
  barrel.rotation.x = -Math.PI / 2; barrel.position.set(0, 0.05, -0.6); head.add(barrel);   // 炮管朝 -Z
  return { group, head };
}

export function mount(host, { interactive = false } = {}) {
  const ctx = {};

  const handle = mountThree(host, ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x0a0f18, 40, 120);
    scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x141a26, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(14, 26, 10); scene.add(sun);

    const arena = new ArenaEnvironment({
      scene, worldSize: 44,
      groundColor: 0x141d2c, wallColor: 0x27334a, pillarColor: 0x33405a,
      gridMajorColor: 0x39507a, gridMinorColor: 0x233149,
    }).create();

    const turret = buildTurret(); scene.add(turret.group);
    const MUZZLE = new THREE.Vector3(0, 1.15, 0);

    let t = 0;   // sim 时间（武器冷却按它计，确定性 + 可暂停，不受墙钟影响）
    const director = new WaveSpawnDirector({ baseWaveSize: 5, growthPerWave: 2 });
    const weapon = new ProjectileWeaponSystem({ aimMode: WEAPON_AIM_MODES.BORESIGHT, gunHeatPerShot: 0.003, clock: { nowSeconds: () => t } });
    weapon.updateWeaponConfig(WEAPON_TYPES.GUN, { ammo: Infinity, maxAmmo: Infinity, fireRate: 0.13, speed: 48, launchOffset: { right: 0, up: 0, forward: 0.7 } });
    const manager = new ProjectileManager({});

    const enemies = [];
    const spawnQueue = [];
    const bursts = [];
    const ENEMY_Y = 1.0, ENEMY_SPEED = 3.4, ENEMY_STOP = 4.6;

    const fwd = new THREE.Vector3(0, 0, -1), up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3(1, 0, 0);
    const bodyFrame = () => ({ forward: fwd.clone(), up: up.clone(), right: right.clone() });

    function spawnBullet(position, direction) {
      const visual = createBulletProjectileVisual();
      visual.mesh.scale.setScalar(0.32);
      visual.mesh.material.color.set(0x8ff0ff);
      scene.add(visual.group);
      manager.spawnProjectile({ visual, position, direction, speed: 48, lifetimeSeconds: 2.4, hitRadius: 1.7 });
    }
    function spawnBurst(pos) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0),
        new THREE.MeshBasicMaterial({ color: 0xff8a5a, transparent: true, opacity: 0.9 }));
      m.position.copy(pos); scene.add(m); bursts.push({ mesh: m, t: 0, life: 0.34 });
    }

    // interactive：点击地面（敌人高度平面）→ 手动补射一发。
    const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ENEMY_Y);
    const raycaster = new THREE.Raycaster();
    ctx.camera = camera;
    ctx.onPointerDown = (e) => {
      const r = host.getBoundingClientRect();
      const ndc = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
      raycaster.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(aimPlane, hit)) spawnBullet(MUZZLE.clone(), hit.sub(MUZZLE).normalize());
    };

    camera.position.set(0, 30, 34);
    let spawnCooldown = 0;

    const update = (dt) => {
      t += dt;

      // 波次：喂存活+待生成数，推进波次。
      const live = enemies.reduce((n, e) => n + (e.destroyed ? 0 : 1), 0);
      const res = director.step({ activeUnits: live + spawnQueue.length });
      for (const sp of res.spawns) spawnQueue.push(sp);

      // 分批从队列实例化敌人（在远离炮塔处刷出）。
      spawnCooldown -= dt;
      if (spawnCooldown <= 0 && spawnQueue.length) {
        spawnCooldown = 0.45; spawnQueue.shift();
        const pos = arena.sampleSpawn(MUZZLE, 15); pos.y = ENEMY_Y;
        const mesh = buildEnemy(); mesh.position.copy(pos); scene.add(mesh);
        enemies.push({ position: pos.clone(), destroyed: false, mesh, hp: 2, phase: t });
      }

      // 敌人 AI：朝炮塔逼近，近了绕圈游走。
      for (const e of enemies) {
        if (e.destroyed) continue;
        const dx = -e.position.x, dz = -e.position.z, d = Math.hypot(dx, dz) || 1;
        if (d > ENEMY_STOP) { e.position.x += (dx / d) * ENEMY_SPEED * dt; e.position.z += (dz / d) * ENEMY_SPEED * dt; }
        e.mesh.position.set(e.position.x, ENEMY_Y + Math.sin(t * 3 + e.phase) * 0.16, e.position.z);
        e.mesh.rotation.y += dt * 1.6;
        e.mesh.scale.setScalar(THREE.MathUtils.lerp(e.mesh.scale.x || 1, 1, dt * 9));  // 命中闪缩回正
      }

      // 炮塔：锁最近敌人 → 转向 → 开火。
      let nearest = null, nd = Infinity;
      for (const e of enemies) { if (e.destroyed) continue; const dd = e.position.distanceToSquared(MUZZLE); if (dd < nd) { nd = dd; nearest = e; } }
      if (nearest) {
        fwd.copy(nearest.position).sub(MUZZLE).normalize();
        right.crossVectors(up, fwd).normalize();
        const yawFwd = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
        turret.head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), yawFwd);
        const shot = weapon.requestFire({ shooterPosition: MUZZLE, shooterBodyFrame: bodyFrame() });
        if (shot && shot.type === WEAPON_DECISIONS.FIRE_GUN) spawnBullet(shot.position.clone(), shot.direction.clone());
      }
      weapon.step({ shooterPosition: MUZZLE, shooterBodyFrame: bodyFrame(), targets: enemies, deltaSeconds: dt });

      // 投射物推进 + 命中处理。
      for (const h of manager.step(enemies, dt)) {
        const e = h.hittedTarget; if (!e || e.destroyed) continue;
        e.hp -= 1;
        if (e.hp <= 0) { e.destroyed = true; scene.remove(e.mesh); spawnBurst(e.position); }
        else { e.mesh.scale.setScalar(1.35); }
      }
      // 清除已消灭敌人，防止数组无界增长 + 每帧遍历变慢。
      for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].destroyed) enemies.splice(i, 1);

      // 爆裂粒子。
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i]; b.t += dt; const k = b.t / b.life;
        if (k >= 1) { scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); bursts.splice(i, 1); continue; }
        b.mesh.scale.setScalar(1 + k * 3); b.mesh.material.opacity = 0.9 * (1 - k);
      }

      // 缓慢环绕俯视相机。
      const cr = 37, ch = 27;
      camera.position.set(Math.sin(t * 0.12) * cr, ch, Math.cos(t * 0.12) * cr);
      camera.lookAt(0, 1.5, 0);
    };
    return update;
  }, { bg: 0x0a0f18, far: 300, fov: 52 });

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
