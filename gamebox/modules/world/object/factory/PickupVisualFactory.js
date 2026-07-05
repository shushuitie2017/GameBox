import * as THREE from 'three';

function createMaterial(color, emissiveIntensity = 0.2) {
  const base = new THREE.Color(color);
  return new THREE.MeshStandardMaterial({
    color: base,
    emissive: base.clone().multiplyScalar(0.2),
    emissiveIntensity,
    metalness: 0.25,
    roughness: 0.4,
  });
}

// Rounded box via an extruded rounded-rectangle profile — gives soft, bevelled
// pickups instead of hard cubes. Centred on the origin.
function roundedBoxGeo(w, h, d, r) {
  const x = -w / 2, y = -h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d, bevelEnabled: true, bevelThickness: Math.min(r, 0.08), bevelSize: Math.min(r, 0.08), bevelSegments: 3, steps: 1,
  });
  geo.translate(0, 0, -d / 2);
  geo.computeVertexNormals();
  return geo;
}

export function buildAmmoPickupVisual(color = null, accentColor = null) {
  const group = new THREE.Group();
  const crate = new THREE.Mesh(roundedBoxGeo(1.2, 0.82, 0.9, 0.12), createMaterial(color ?? 0x4b7b51));
  const belt = new THREE.Mesh(roundedBoxGeo(1.06, 0.24, 0.94, 0.08), createMaterial(accentColor ?? 0xd9e56a, 0.55));
  belt.position.y = 0.12;
  const cap = new THREE.Mesh(roundedBoxGeo(0.5, 0.16, 0.5, 0.06), createMaterial(accentColor ?? 0xd9e56a, 0.7));
  cap.position.y = 0.44;
  group.add(crate, belt, cap);
  return { mesh: group, radius: 0.85 };
}

export function buildHealthPickupVisual(color = null, crossColor = null) {
  const size = 0.78;
  const group = new THREE.Group();
  const body = new THREE.Mesh(roundedBoxGeo(size, size, size, 0.16), createMaterial(color ?? 0xd23a3f, 0.32));
  const thick = size * 0.24, arm = size * 0.72;
  const crossMat = new THREE.MeshStandardMaterial({ color: crossColor ?? 0xffffff, emissive: crossColor ?? 0xffffff, emissiveIntensity: 0.85, roughness: 0.3 });
  const vertical = new THREE.Mesh(roundedBoxGeo(thick, arm, thick, 0.05), crossMat);
  const horizontal = new THREE.Mesh(roundedBoxGeo(arm, thick, thick, 0.05), crossMat);
  vertical.position.z = size * 0.44; horizontal.position.z = size * 0.44;
  group.add(body, vertical, horizontal);
  return { mesh: group, radius: 0.8 };
}

export function buildArmorPickupVisual(color = null, ringColor = null) {
  const group = new THREE.Group();
  // Faceted shield core (octahedron) inside an orbiting ring.
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.5, 0),
    createMaterial(color ?? 0x2d66ff, 0.5));
  core.scale.set(0.8, 1.05, 0.55);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.52, 0.06, 14, 28),
    createMaterial(ringColor ?? 0x77a3ff, 0.7));
  ring.rotation.x = Math.PI * 0.5;
  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.035, 12, 26),
    createMaterial(ringColor ?? 0x77a3ff, 0.55));
  ring2.rotation.set(Math.PI * 0.5, 0, Math.PI * 0.4);
  group.add(core, ring, ring2);
  return { mesh: group, radius: 0.82 };
}

export function createPickupVisual({
  type,
  color = null,
  accentColor = null,
  crossColor = null,
  ringColor = null,
}) {
  if (type === 'ammo') return buildAmmoPickupVisual(color, accentColor);
  if (type === 'health') return buildHealthPickupVisual(color, crossColor);
  return buildArmorPickupVisual(color, ringColor);
}
