// physics-crowd 演示场 —— 真实 KinematicBatchResolver 经 Rapier 解算一群 agent 的碰撞。
// three 经 importmap；Rapier 用相对路径 import（vendored，base 无关，无需 importmap）。
import * as THREE from 'three';
import * as RAPIER from '../vendor/rapier.es.js';
import { mountThree } from './_three.js';
import { KinematicBatchResolver } from '../../gamebox/modules/actor-motion/KinematicBatchResolver.js';

const COLORS = [0x5b8cff, 0x32e0ff, 0x46e0a0, 0xf5a65b, 0x9b8cff, 0xff7a9c];

export function mount(host) {
  let ready = false, agents = [], resolver, world;

  const inst = mountThree(host, ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x080b12, 20, 60);
    scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x151a26, 1.05));
    const dir = new THREE.DirectionalLight(0xffffff, 1.3); dir.position.set(6, 14, 5); scene.add(dir);

    const HALF = 9;         // 竞技场半边长
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2),
      new THREE.MeshStandardMaterial({ color: 0x0d1422, roughness: 0.98 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    scene.add(new THREE.GridHelper(HALF * 2, 24, 0x243050, 0x161e30));

    // 障碍视觉（与物理体一致）
    const obstacles = [
      { x: 0, z: 0, hx: 1.4, hz: 1.4 }, { x: -4.5, z: 3.5, hx: 1.0, hz: 1.0 },
      { x: 4.5, z: -3.5, hx: 1.0, hz: 1.0 }, { x: 4, z: 4, hx: 0.8, hz: 2.2 },
      { x: -4, z: -4, hx: 2.2, hz: 0.8 },
    ];
    const obMat = new THREE.MeshStandardMaterial({ color: 0x1c2740, roughness: 0.85, metalness: 0.1 });
    for (const o of obstacles) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(o.hx * 2, 1.6, o.hz * 2), obMat);
      m.position.set(o.x, 0.8, o.z); scene.add(m);
    }

    camera.position.set(14, 15, 14); camera.lookAt(0, 0.5, 0);
    let camT = 0;

    RAPIER.init().then(() => {
      world = new RAPIER.World({ x: 0, y: 0, z: 0 });
      // 地面
      world.createCollider(RAPIER.ColliderDesc.cuboid(HALF, 0.5, HALF).setTranslation(0, -0.5, 0),
        world.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
      // 四面墙
      const wall = (x, z, hx, hz) => world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, 1.5, hz).setTranslation(x, 1.5, z),
        world.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
      wall(0, HALF, HALF, 0.4); wall(0, -HALF, HALF, 0.4); wall(HALF, 0, 0.4, HALF); wall(-HALF, 0, 0.4, HALF);
      // 障碍物理体
      for (const o of obstacles) wall(o.x, o.z, o.hx, o.hz);

      resolver = new KinematicBatchResolver(world, RAPIER);

      const R = 0.42, HH = 0.5, Y = R + HH; // 胶囊贴地的中心高度
      const geo = new THREE.CapsuleGeometry(R, HH * 2, 6, 12);
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2, rad = 6.5;
        const pos = new THREE.Vector3(Math.cos(ang) * rad, Y, Math.sin(ang) * rad);
        const actor = resolver.createActor({
          position: pos, colliderShape: { type: 'capsule', halfHeight: HH, radius: R },
          controllerOptions: { offset: 0.02 },
        });
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLORS[i % COLORS.length], roughness: 0.6 }));
        mesh.position.copy(pos); scene.add(mesh);
        const dirAng = ang + Math.PI + (Math.random() - 0.5); // 大致朝对面走
        agents.push({ actor, mesh, pos, dir: new THREE.Vector3(Math.cos(dirAng), 0, Math.sin(dirAng)), retarget: 0 });
      }
      ready = true;
    }).catch((e) => console.warn('rapier init failed', e));

    const SPEED = 3.2;
    return (dt) => {
      camT += dt;
      camera.position.set(Math.sin(camT * 0.12) * 19, 15.5, Math.cos(camT * 0.12) * 19);
      camera.lookAt(0, 0.5, 0);
      if (!ready) return;
      resolver.beginFrame();
      for (const a of agents) {
        a.retarget -= dt;
        if (a.retarget <= 0) { const t = Math.random() * Math.PI * 2; a.dir.set(Math.cos(t), 0, Math.sin(t)); a.retarget = 1.5 + Math.random() * 2.5; }
        const delta = a.dir.clone().multiplyScalar(SPEED * dt);
        resolver.queueMove(a.actor, { startPosition: a.pos, desiredDelta: { x: delta.x, y: 0, z: delta.z }, deltaSeconds: dt });
      }
      resolver.resolveQueuedMoves(dt);
      for (const a of agents) {
        const r = resolver.getResult(a.actor);
        if (!r) continue;
        a.pos.copy(r.position);
        a.mesh.position.set(a.pos.x, a.pos.y, a.pos.z);
        if (r.blocked) { const t = Math.random() * Math.PI * 2; a.dir.set(Math.cos(t), 0, Math.sin(t)); a.retarget = 1 + Math.random() * 2; }
        else if (r.velocity && (r.velocity.x || r.velocity.z)) a.mesh.rotation.y = Math.atan2(r.velocity.x, r.velocity.z);
      }
    };
  });

  return {
    destroy() { inst.destroy(); if (world) { try { world.free(); } catch (e) {} } },
  };
}
