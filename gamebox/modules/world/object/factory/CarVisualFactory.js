import * as THREE from 'three';

// A car whose body is one smooth, bevelled silhouette (hood → windshield → roof →
// trunk) extruded across the width, with a tinted glass greenhouse, lights and
// hubbed wheels. Local forward is -Z; wheel order follows wheelOffsets
// (front pair first). Return shape is unchanged: { group, wheels, wheelPivots, forwardArrow }.
export function createCarVisual({
  paintColor = 0xc75238,
  cabinColor = 0xf4f7ff,
  wheelColor = 0x181c22,
  arrowColor = null,
  wheelOffsets = [
    [-0.84, 0.26, -1.07],
    [0.84, 0.26, -1.07],
    [-0.84, 0.26, 1.07],
    [0.84, 0.26, 1.07],
  ]
}) {
  const group = new THREE.Group();

  const HALF_W = 0.8;

  // Side silhouette, drawn in (x = length, front at +x) × (y = height); extruded
  // across the width, then rotated so the front faces -Z.
  const s = new THREE.Shape();
  s.moveTo(-1.62, 0.06);
  s.lineTo(1.62, 0.06);
  s.lineTo(1.66, 0.34);
  s.quadraticCurveTo(1.70, 0.52, 1.5, 0.56);      // hood front lip
  s.lineTo(0.66, 0.60);
  s.quadraticCurveTo(0.44, 0.62, 0.30, 0.96);     // windshield rake
  s.lineTo(-0.52, 1.04);                          // roof
  s.quadraticCurveTo(-0.92, 1.03, -1.12, 0.66);   // rear window
  s.lineTo(-1.5, 0.6);                            // trunk deck
  s.quadraticCurveTo(-1.66, 0.58, -1.62, 0.34);
  s.lineTo(-1.62, 0.06);

  const bodyGeo = new THREE.ExtrudeGeometry(s, {
    depth: HALF_W * 2, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.09, bevelSegments: 3, steps: 1,
  });
  bodyGeo.translate(0, 0, -HALF_W);
  bodyGeo.rotateY(Math.PI / 2);                    // length → Z (front at -Z), width → X
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({
    color: paintColor, metalness: 0.42, roughness: 0.38,
  }));
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);

  // Rocker sill under the doors reads the body as sitting on the wheels.
  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(1.58, 0.16, 2.5),
    new THREE.MeshStandardMaterial({ color: 0x11151d, roughness: 0.85 }));
  sill.position.y = 0.14; group.add(sill);

  // Glass greenhouse: a narrower, tinted cap over the cabin profile.
  const g = new THREE.Shape();
  g.moveTo(0.60, 0.60);
  g.quadraticCurveTo(0.40, 0.63, 0.27, 0.94);
  g.lineTo(-0.50, 1.01);
  g.quadraticCurveTo(-0.88, 1.0, -1.06, 0.66);
  g.lineTo(-0.98, 0.63);
  g.quadraticCurveTo(-0.84, 0.9, -0.52, 0.9);
  g.lineTo(0.24, 0.84);
  g.quadraticCurveTo(0.42, 0.63, 0.58, 0.62);
  g.lineTo(0.60, 0.60);
  const glassGeo = new THREE.ExtrudeGeometry(g, {
    depth: 1.34, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, steps: 1,
  });
  glassGeo.translate(0, 0, -0.67);
  glassGeo.rotateY(Math.PI / 2);
  const glass = new THREE.Mesh(glassGeo, new THREE.MeshStandardMaterial({
    color: cabinColor, metalness: 0.2, roughness: 0.12, transparent: true, opacity: 0.55,
  }));
  glass.position.y = 0.02; group.add(glass);

  // Lights: emissive cyan-white headlamps at -Z, red tails at +Z.
  const lamp = (color, emissive, x, z) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.14, 0.06),
      new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.9, roughness: 0.4 }));
    m.position.set(x, 0.42, z); group.add(m);
  };
  lamp(0xffffff, 0xbfe4ff, -0.52, -1.66); lamp(0xffffff, 0xbfe4ff, 0.52, -1.66);
  lamp(0xff5a4d, 0x5a0f0a, -0.54, 1.64); lamp(0xff5a4d, 0x5a0f0a, 0.54, 1.64);

  // ---- Wheels: tire + rim + hub, grouped so rotation.x rolls and pivot.rotation.y steers. ----
  const tireMat = new THREE.MeshStandardMaterial({ color: wheelColor, roughness: 0.85, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb9c2d0, roughness: 0.35, metalness: 0.7 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.5, metalness: 0.4 });
  const tireGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.30, 26); tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.32, 20); rimGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.34, 8); hubGeo.rotateZ(Math.PI / 2);

  const wheels = [];
  const wheelPivots = [];
  for (const [x, y, z] of wheelOffsets) {
    const wheelPivot = new THREE.Group();
    wheelPivot.position.set(x, y, z);

    const wheel = new THREE.Group();            // rolls via rotation.x
    const tire = new THREE.Mesh(tireGeo, tireMat);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    for (const m of [tire, rim, hub]) { m.castShadow = true; m.receiveShadow = true; wheel.add(m); }
    wheelPivot.add(wheel);
    group.add(wheelPivot);

    wheelPivots.push(wheelPivot);
    wheels.push(wheel);
  }

  const forwardArrow = arrowColor == null
    ? null
    : new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0, 0),
      3.6,
      arrowColor,
      0.8,
      0.5
    );

  if (forwardArrow) group.add(forwardArrow);

  return {
    group,
    wheels,
    wheelPivots,
    forwardArrow,
  };
}
