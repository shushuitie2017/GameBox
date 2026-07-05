import * as THREE from 'three';
import { JetFlameLocalVisual } from '../../visual-effects/JetFlame.js';

// A jet built around a lathed (surface-of-revolution) fuselage with swept wings,
// a raked canopy and twin tail engines. Local frame: forward is -Z, aft is +Z,
// so the jet flames sit at the tail. Public params and the returned shape
// { group, airframe, jetFlames, targetRing } are unchanged.
export function createAirplaneVisual({
  scale = 8,
  bodyColor = 0xe1ebf5,
  bodyEmissive = 0x000000,
  bodyEmissiveIntensity = 0,
  bodyMetalness = 0.78,
  bodyRoughness = 0.28,
  accentColor = 0xffa33a,
  accentEmissive = 0x5a2200,
  accentEmissiveIntensity = 0.26,
  accentMetalness = 0.44,
  accentRoughness = 0.42,
  canopyColor = 0x87cefa,
  canopyEmissive = 0x102c4b,
  canopyEmissiveIntensity = 0.4,
  canopyOpacity = 0.9,
  showCanopy = true,
  showJetFlames = true,
  showEngineGlow = false,
  engineGlowColor = 0xffb35b,
  engineGlowOpacity = 0.78,
  showCentroid = false,
  centroidColor = 0xff2bd6,
  showTargetRing = false,
  targetRingName = 'AirplaneTargetRing',
  targetRingColor = 0xff775c,
  targetRingRadius = 2.15,
  targetRingTube = 0.035,
  targetRingOpacity = 0.36,
}) {
  const group = new THREE.Group();
  const airframe = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    emissive: bodyEmissive,
    emissiveIntensity: bodyEmissiveIntensity,
    metalness: bodyMetalness,
    roughness: bodyRoughness,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentEmissive,
    emissiveIntensity: accentEmissiveIntensity,
    metalness: accentMetalness,
    roughness: accentRoughness,
  });
  const canopyMaterial = new THREE.MeshStandardMaterial({
    color: canopyColor,
    emissive: canopyEmissive,
    emissiveIntensity: canopyEmissiveIntensity,
    metalness: 0.18,
    roughness: 0.14,
    transparent: true,
    opacity: canopyOpacity,
  });
  const engineMaterial = new THREE.MeshStandardMaterial({ color: 0x3a4152, metalness: 0.7, roughness: 0.4 });

  // --- Fuselage: lathed profile (radius vs body length), nose at -Z. ---
  const R = (r, y) => new THREE.Vector2(r, y);
  const fuseProfile = [
    R(0.05, 0), R(0.19, 0.35), R(0.28, 0.9), R(0.335, 1.5),
    R(0.335, 2.05), R(0.30, 2.55), R(0.20, 3.05), R(0.10, 3.4), R(0.012, 3.62),
  ];
  const fuseGeo = new THREE.LatheGeometry(fuseProfile, 24);
  fuseGeo.rotateX(-Math.PI / 2);   // body axis +Y → -Z (nose forward)
  fuseGeo.translate(0, 0, 1.81);   // centre: nose ≈ -1.81, tail ≈ +1.81
  const fuselage = new THREE.Mesh(fuseGeo, bodyMaterial);
  fuselage.castShadow = true; airframe.add(fuselage);

  // Accent nose cap at the tip.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.5, 20), accentMaterial);
  nose.rotation.x = -Math.PI / 2;                // cone tip +Y → -Z
  nose.position.z = -1.68; airframe.add(nose);

  if (showCanopy) {
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), canopyMaterial);
    canopy.scale.set(1.0, 0.72, 1.9);
    canopy.position.set(0, 0.24, -0.45);
    airframe.add(canopy);
  }

  // --- Swept wings: extruded planform (span × chord), thin in Y. ---
  function makeWing(rootChordF, rootChordB, tipChordF, tipChordB, span, thick) {
    const shape = new THREE.Shape();
    shape.moveTo(0, rootChordF);
    shape.lineTo(span, tipChordF);
    shape.lineTo(span, tipChordB);
    shape.lineTo(0, rootChordB);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1, steps: 1 });
    geo.rotateX(Math.PI / 2);       // x=span, y(chord)→z (front -Z), thin in Y
    geo.translate(0, 0, 0);
    return geo;
  }
  // main wings (front chord negative = toward -Z), swept back at tips.
  const wingGeoR = makeWing(-0.5, 0.55, 0.05, 0.36, 1.62, 0.07);
  for (const sign of [1, -1]) {
    const wing = new THREE.Mesh(wingGeoR, bodyMaterial);
    wing.scale.x = sign;
    wing.position.set(0, -0.03, 0.1);
    wing.rotation.z = sign * 0.06;   // slight dihedral
    wing.castShadow = true; airframe.add(wing);
    // accent wingtip
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.34), accentMaterial);
    tip.position.set(sign * 1.62, -0.03 + 1.62 * 0.06, 0.28); airframe.add(tip);
  }

  // --- Tail: swept vertical fin + horizontal stabilisers. ---
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0); finShape.lineTo(0.66, 0.34); finShape.lineTo(0.7, 0.62); finShape.lineTo(0.14, 0.58); finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.06, bevelEnabled: false, steps: 1 });
  finGeo.translate(-0.03, 0, -0.03);
  finGeo.rotateY(Math.PI / 2);      // fin plane = Y-Z, thin in X
  const fin = new THREE.Mesh(finGeo, accentMaterial);
  fin.position.set(0, 0.2, 1.18); fin.castShadow = true; airframe.add(fin);

  const stabGeo = makeWing(1.12, 1.42, 1.2, 1.36, 0.62, 0.05);
  for (const sign of [1, -1]) {
    const stab = new THREE.Mesh(stabGeo, bodyMaterial);
    stab.scale.x = sign; stab.position.set(0, 0.24, 0.0); airframe.add(stab);
  }

  // --- Twin tail engines + exhausts. ---
  const engineGeo = new THREE.CylinderGeometry(0.15, 0.13, 1.0, 16);
  engineGeo.rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const engine = new THREE.Mesh(engineGeo, engineMaterial);
    engine.position.set(side * 0.34, -0.09, 1.28);
    engine.castShadow = true; airframe.add(engine);
  }

  const airframeCenter = new THREE.Box3()
    .setFromObject(airframe)
    .getCenter(new THREE.Vector3());
  airframe.position.sub(airframeCenter);

  const jetFlames = [];
  if (showJetFlames) {
    const flameLeft = new JetFlameLocalVisual();
    const flameRight = new JetFlameLocalVisual();
    flameLeft.group.position.set(-0.34, -0.09, 1.82);
    flameRight.group.position.set(0.34, -0.09, 1.82);
    airframe.add(flameLeft.group);
    airframe.add(flameRight.group);
    jetFlames.push(flameLeft, flameRight);
  }

  if (showEngineGlow) {
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: engineGlowColor,
      transparent: true,
      opacity: engineGlowOpacity,
    });
    for (const side of [-1, 1]) {
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 8),
        glowMaterial.clone()
      );
      glow.position.set(side * 0.34, -0.09, 1.84);
      airframe.add(glow);
    }
  }

  group.add(airframe);

  if (showCentroid) {
    const centroidMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 16, 12),
      new THREE.MeshBasicMaterial({
        color: centroidColor,
        depthTest: false,
        depthWrite: false,
      })
    );
    centroidMarker.name = 'PlaneCentroidMarker';
    centroidMarker.renderOrder = 1000;
    group.add(centroidMarker);
  }

  let targetRing = null;
  if (showTargetRing) {
    targetRing = new THREE.Mesh(
      new THREE.TorusGeometry(targetRingRadius, targetRingTube, 8, 36),
      new THREE.MeshBasicMaterial({
        color: targetRingColor,
        transparent: true,
        opacity: targetRingOpacity,
        depthWrite: false,
      })
    );
    targetRing.name = targetRingName;
    targetRing.renderOrder = 4;
    group.add(targetRing);
  }

  group.scale.setScalar(scale);

  return {
    group,
    airframe,
    jetFlames,
    targetRing,
  };
}
