import * as THREE from 'three';

// Simplex noise (inline, no dependency)
function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t: number, a: number, b: number) { return a + t * (b - a); }
function grad(hash: number, x: number, y: number): number {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}
const p = new Uint8Array(512);
const perm = new Uint8Array(256);
for (let i = 0; i < 256; i++) perm[i] = i;
for (let i = 255; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [perm[i], perm[j]] = [perm[j], perm[i]];
}
for (let i = 0; i < 512; i++) p[i] = perm[i & 255];

export function noise2(x: number, y: number): number {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y);
  const a = p[X] + Y, aa = p[a], ab = p[a + 1];
  const b = p[X + 1] + Y, ba = p[b], bb = p[b + 1];
  return lerp(v, lerp(u, grad(p[aa], x, y), grad(p[ba], x - 1, y)),
              lerp(u, grad(p[ab], x, y - 1), grad(p[bb], x - 1, y - 1)));
}

export function getTerrainY(x: number, z: number): number {
  const scale = 0.008;
  let h = noise2(x * scale, z * scale) * 8;
  h += noise2(x * scale * 3, z * scale * 3) * 2;
  h += noise2(x * scale * 8, z * scale * 8) * 0.5;
  // hill in the north
  const dx = x, dz = z + 200;
  h += Math.max(0, 15 - Math.sqrt(dx * dx + dz * dz) * 0.05);
  return h;
}

export function buildTerrain(scene: THREE.Scene): THREE.Mesh {
  const size = 600, segs = 80;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, getTerrainY(x, z));
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ color: 0x4a7c3f });
  // vertex color for variety
  const colors: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 6) { colors.push(0.4, 0.35, 0.3); }
    else { colors.push(0.28 + Math.random() * 0.06, 0.48 + Math.random() * 0.08, 0.24 + Math.random() * 0.04); }
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  (mat as THREE.MeshLambertMaterial & { vertexColors: boolean }).vertexColors = true;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

export function buildSky(scene: THREE.Scene, stormMode = false): void {
  // Gradient sky sphere
  const skyGeo = new THREE.SphereGeometry(500, 16, 8);
  skyGeo.scale(-1, 1, 1);
  const skyColors: number[] = [];
  const skyPos = skyGeo.attributes.position;
  for (let i = 0; i < skyPos.count; i++) {
    const y = skyPos.getY(i);
    const t = (y + 500) / 1000;
    if (stormMode) {
      skyColors.push(
        lerp(t, 0.25, 0.35),
        lerp(t, 0.28, 0.38),
        lerp(t, 0.38, 0.45)
      );
    } else {
      skyColors.push(
        lerp(t, 0.6, 0.3),
        lerp(t, 0.78, 0.5),
        lerp(t, 0.5, 0.85)
      );
    }
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // Sun
  if (!stormMode) {
    const sunGeo = new THREE.SphereGeometry(8, 8, 8);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffacd });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(200, 150, -300);
    scene.add(sun);
  }

  // Clouds (a few flat ellipsoids)
  for (let i = 0; i < 8; i++) {
    const cGeo = new THREE.SphereGeometry(1, 6, 4);
    cGeo.scale(20 + Math.random() * 20, 5, 10 + Math.random() * 10);
    const cMat = new THREE.MeshBasicMaterial({ color: stormMode ? 0x8899aa : 0xffffff, transparent: true, opacity: 0.6 });
    const cloud = new THREE.Mesh(cGeo, cMat);
    cloud.position.set(-200 + Math.random() * 400, 60 + Math.random() * 30, -200 + Math.random() * 200);
    scene.add(cloud);
  }
}

export function buildRiver(scene: THREE.Scene): void {
  const geo = new THREE.PlaneGeometry(12, 120, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({ color: 0x4488bb, transparent: true, opacity: 0.8 });
  const river = new THREE.Mesh(geo, mat);
  river.position.set(-20, getTerrainY(-20, -90) + 0.1, -90);
  river.rotation.y = 0.3;
  scene.add(river);
}

export function buildInstances(scene: THREE.Scene): void {
  // Grass tufts
  const grassCount = 2000;
  const grassGeo = new THREE.ConeGeometry(0.05, 0.3, 3);
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x5a9040 });
  const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < grassCount; i++) {
    const x = -250 + Math.random() * 500;
    const z = -250 + Math.random() * 500;
    dummy.position.set(x, getTerrainY(x, z) + 0.1, z);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    dummy.scale.setScalar(0.8 + Math.random() * 0.6);
    dummy.updateMatrix();
    grassMesh.setMatrixAt(i, dummy.matrix);
  }
  grassMesh.instanceMatrix.needsUpdate = true;
  scene.add(grassMesh);

  // Rocks
  const rockCount = 80;
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a8880 });
  const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  for (let i = 0; i < rockCount; i++) {
    const x = -200 + Math.random() * 400;
    const z = -200 + Math.random() * 400;
    dummy.position.set(x, getTerrainY(x, z) + 0.3, z);
    dummy.rotation.set(Math.random(), Math.random(), Math.random());
    const s = 0.4 + Math.random() * 1.5;
    dummy.scale.set(s, s * 0.7, s * 1.1);
    dummy.updateMatrix();
    rockMesh.setMatrixAt(i, dummy.matrix);
  }
  rockMesh.instanceMatrix.needsUpdate = true;
  scene.add(rockMesh);
}

// Build a low-poly ger (yurt)
export function buildGer(scene: THREE.Scene, x: number, z: number, ornate = false): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, getTerrainY(x, z), z);

  // Base/floor
  const baseGeo = new THREE.CylinderGeometry(4.2, 4.2, 0.2, 12);
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
  group.add(new THREE.Mesh(baseGeo, baseMat));

  // Walls (canvas cylinder)
  const wallGeo = new THREE.CylinderGeometry(4, 4, 2.2, 12, 1, true);
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xf5f0e8, side: THREE.DoubleSide });
  const walls = new THREE.Mesh(wallGeo, wallMat);
  walls.position.y = 1.2;
  group.add(walls);

  // Roof (cone)
  const roofGeo = new THREE.ConeGeometry(4.5, 2.5, 12);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xf0ebe0 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 3.45;
  group.add(roof);

  // Toono (crown ring)
  const toonoGeo = new THREE.TorusGeometry(0.8, 0.15, 6, 12);
  const toonoMat = new THREE.MeshLambertMaterial({ color: 0xd4a017 });
  const toono = new THREE.Mesh(toonoGeo, toonoMat);
  toono.position.y = 4.7;
  toono.rotation.x = Math.PI / 2;
  group.add(toono);

  // Stovepipe
  const pipeGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.5, 8);
  const pipeMat = new THREE.MeshLambertMaterial({ color: 0x222 });
  const pipe = new THREE.Mesh(pipeGeo, pipeMat);
  pipe.position.set(0.3, 5.5, 0);
  group.add(pipe);

  // Door
  const doorColor = ornate ? 0x2a8060 : 0xe06a00;
  const doorGeo = new THREE.BoxGeometry(1.2, 1.8, 0.1);
  const doorMat = new THREE.MeshLambertMaterial({ color: doorColor });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, 1.0, -4.05);
  group.add(door);

  // Door frame
  const frameGeo = new THREE.BoxGeometry(1.4, 2.0, 0.08);
  const frameMat = new THREE.MeshLambertMaterial({ color: ornate ? 0xd4a017 : 0x8b6914 });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.set(0, 1.0, -4.1);
  group.add(frame);

  // Roof poles (uni)
  const poleColor = 0xe06a00;
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const pGeo = new THREE.CylinderGeometry(0.04, 0.04, 4.2, 4);
    const pMat = new THREE.MeshLambertMaterial({ color: poleColor });
    const pole = new THREE.Mesh(pGeo, pMat);
    pole.position.set(Math.sin(angle) * 2.2, 3.5, Math.cos(angle) * 2.2);
    pole.rotation.z = -angle;
    pole.rotation.x = 0.45;
    group.add(pole);
  }

  scene.add(group);
  return group;
}

// Build the barrel
export function buildBarrel(scene: THREE.Scene, x: number, z: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.4, 0.35, 0.9, 10);
  const mat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const barrel = new THREE.Mesh(geo, mat);
  barrel.position.set(x, getTerrainY(x, z) + 0.45, z);
  scene.add(barrel);
  return barrel;
}

// Build an ovoo (sacred stone cairn)
export function buildOvoo(scene: THREE.Scene, x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, getTerrainY(x, z), z);

  // Pile of rocks
  const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x888880 });
  for (let i = 0; i < 8; i++) {
    const r = new THREE.Mesh(rockGeo, rockMat);
    const angle = (i / 8) * Math.PI * 2;
    const dist = i < 4 ? 0.6 : 0.2;
    r.position.set(Math.sin(angle) * dist, i * 0.3, Math.cos(angle) * dist);
    r.scale.setScalar(0.5 + Math.random() * 0.5);
    group.add(r);
  }

  // Khadag scarves (blue strips)
  const scarf1 = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x1a5fd6, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
  );
  scarf1.position.set(0, 2.5, 0);
  scarf1.rotation.y = 0.3;
  group.add(scarf1);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 3, 6),
    new THREE.MeshLambertMaterial({ color: 0x8b6914 })
  );
  pole.position.y = 1.5;
  group.add(pole);

  scene.add(group);
  return group;
}

// Simple NPC character
export function buildNPC(scene: THREE.Scene, color: number, x: number, z: number, name: string): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, getTerrainY(x, z), z);
  group.userData.name = name;

  // Body (deel or outfit)
  const bodyGeo = new THREE.CapsuleGeometry(0.25, 0.8, 4, 8);
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  group.add(new THREE.Mesh(bodyGeo, bodyMat));

  // Head
  const headGeo = new THREE.SphereGeometry(0.22, 8, 6);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xd4956a });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.75;
  group.add(head);

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.04, 4, 4);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111 });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.09, 0.77, 0.2);
  group.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.09;
  group.add(eyeR);

  // Arms
  const armGeo = new THREE.CapsuleGeometry(0.07, 0.4, 3, 6);
  const armL = new THREE.Mesh(armGeo, bodyMat);
  armL.position.set(-0.35, 0.2, 0);
  armL.rotation.z = 0.3;
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.35;
  armR.rotation.z = -0.3;
  group.add(armR);

  scene.add(group);
  return group;
}

// Yak
export function buildYak(scene: THREE.Scene, x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, getTerrainY(x, z), z);

  // Body
  const bodyGeo = new THREE.BoxGeometry(1.6, 0.9, 2.8);
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4a3828 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.9;
  group.add(body);

  // Shaggy fur (lighter underbelly)
  const furGeo = new THREE.BoxGeometry(1.7, 0.4, 2.9);
  const furMat = new THREE.MeshLambertMaterial({ color: 0x6b5040 });
  const fur = new THREE.Mesh(furGeo, furMat);
  fur.position.set(0, 0.55, 0);
  group.add(fur);

  // Head
  const headGeo = new THREE.BoxGeometry(0.7, 0.65, 0.9);
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.set(0, 1.1, -1.7);
  group.add(head);

  // Horns
  for (const side of [-1, 1]) {
    const hornGeo = new THREE.ConeGeometry(0.05, 0.5, 5);
    const horn = new THREE.Mesh(hornGeo, new THREE.MeshLambertMaterial({ color: 0x222 }));
    horn.position.set(side * 0.32, 1.45, -1.7);
    horn.rotation.z = side * 0.4;
    group.add(horn);
  }

  // Blond forelock
  const forelockGeo = new THREE.SphereGeometry(0.25, 6, 4);
  const forelockMat = new THREE.MeshLambertMaterial({ color: 0xd4b040 });
  const forelock = new THREE.Mesh(forelockGeo, forelockMat);
  forelock.scale.set(0.8, 1.2, 0.6);
  forelock.position.set(0, 1.5, -1.9);
  group.add(forelock);

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.14, 0.1, 0.8, 6);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x3a2818 });
  for (const [lx, lz] of [[-0.55, -0.9], [0.55, -0.9], [-0.55, 0.9], [0.55, 0.9]]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, 0.4, lz);
    group.add(leg);
  }

  // Tail
  const tailGeo = new THREE.CylinderGeometry(0.06, 0.12, 0.6, 5);
  const tailMat = new THREE.MeshLambertMaterial({ color: 0x6b5040 });
  const tail = new THREE.Mesh(tailGeo, tailMat);
  tail.position.set(0, 1.0, 1.5);
  tail.rotation.x = -0.5;
  group.add(tail);

  scene.add(group);
  return group;
}

// Sheep (simplified)
export function buildSheep(scene: THREE.Scene, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, getTerrainY(x, z), z);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 4), new THREE.MeshLambertMaterial({ color: 0xe8e8e0 }));
  body.position.y = 0.45;
  body.scale.z = 1.4;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), new THREE.MeshLambertMaterial({ color: 0xc8c0b0 }));
  head.position.set(0, 0.55, -0.5);
  g.add(head);
  for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.3, 4), new THREE.MeshLambertMaterial({ color: 0x888 }));
    leg.position.set(lx, 0.15, lz);
    g.add(leg);
  }
  scene.add(g);
  return g;
}

export function buildHorse(scene: THREE.Scene, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, getTerrainY(x, z), z);
  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 1.6), new THREE.MeshLambertMaterial({ color: 0x7a5c38 }));
  body.position.y = 1.1;
  g.add(body);
  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.55), new THREE.MeshLambertMaterial({ color: 0x7a5c38 }));
  head.position.set(0, 1.4, -1.0);
  g.add(head);
  // Mane
  const mane = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.5), new THREE.MeshLambertMaterial({ color: 0x3a2c18 }));
  mane.position.set(0, 1.5, -0.7);
  g.add(mane);
  // Legs
  const legMat = new THREE.MeshLambertMaterial({ color: 0x5a4028 });
  for (const [lx, lz] of [[-0.22, -0.55], [0.22, -0.55], [-0.22, 0.55], [0.22, 0.55]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.9, 6), legMat);
    leg.position.set(lx, 0.45, lz);
    g.add(leg);
  }
  scene.add(g);
  return g;
}

export function buildWorld(scene: THREE.Scene): void {
  buildSky(scene);
  buildRiver(scene);
  buildInstances(scene);

  // Two gers
  buildGer(scene, -8, -10, false);   // plain orange door
  buildGer(scene, 8, -10, true);     // ornate teal/gold door

  // Ovoo on hill
  buildOvoo(scene, 0, -180);

  // Water barrel
  buildBarrel(scene, -12, -8);

  // Yaks
  for (let i = 0; i < 8; i++) {
    buildYak(scene, -30 + i * 8, -30 + Math.sin(i) * 10);
  }

  // Sheep herd
  for (let i = 0; i < 15; i++) {
    buildSheep(scene, -40 + Math.random() * 60, -50 + Math.random() * 40);
  }

  // Horses on hitching line
  for (let i = 0; i < 3; i++) {
    buildHorse(scene, -20 + i * 6, -20);
  }

  // NPC placeholders
  buildNPC(scene, 0x1a4a9a, 0, 1, 'Baatar');
  buildNPC(scene, 0x4a2a6a, 5, 1, 'Oyuna');

  // Ambient + directional light for world
  const ambientLight = new THREE.AmbientLight(0xfff4e0, 0.5);
  scene.add(ambientLight);
  const sunLight = new THREE.DirectionalLight(0xffd080, 1.2);
  sunLight.position.set(50, 80, 30);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.far = 400;
  sunLight.shadow.camera.left = -150;
  sunLight.shadow.camera.right = 150;
  sunLight.shadow.camera.top = 150;
  sunLight.shadow.camera.bottom = -150;
  scene.add(sunLight);
}
