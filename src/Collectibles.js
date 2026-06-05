import * as THREE from "three";

const LANES = [-3.2, 0, 3.2];

export class Collectibles {
  constructor(scene, textures) {
    this.scene = scene;
    this.textures = textures;
    this.items = [];
    this.spawnTimer = 0;
    this.obstacleMaterial = new THREE.MeshStandardMaterial({ map: textures.hazard, roughness: 0.55, metalness: 0.1 });
    this.woodMaterial = new THREE.MeshStandardMaterial({ color: "#7a5a35", roughness: 0.92 });
    this.boulderMaterial = new THREE.MeshStandardMaterial({ color: "#41484c", roughness: 0.95, metalness: 0.02 });
    this.energyMaterial = new THREE.MeshStandardMaterial({
      color: "#071a6a",
      emissive: "#1d6bff",
      emissiveIntensity: 2.6,
      roughness: 0.28,
      metalness: 0.08
    });
    this.energyEdgeMaterial = new THREE.MeshBasicMaterial({
      color: "#7bd8ff",
      transparent: true,
      opacity: 0.55
    });
    this.energyGeometry = this.createBoltGeometry();
    this.sharedGeometries = new Set([this.energyGeometry]);
  }

  reset() {
    for (const item of this.items) this.scene.remove(item.mesh);
    this.items = [];
    this.spawnTimer = 0;
  }

  createBoltGeometry() {
    // 2D bolt silhouette extruded into a small 3D token.
    const shape = new THREE.Shape();
    shape.moveTo(-0.35, 0.7);
    shape.lineTo(0.05, 0.7);
    shape.lineTo(-0.1, 0.15);
    shape.lineTo(0.45, 0.15);
    shape.lineTo(-0.05, -0.75);
    shape.lineTo(0.05, -0.1);
    shape.lineTo(-0.35, -0.1);
    shape.lineTo(-0.35, 0.7);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2 });
    geo.center();
    geo.scale(0.95, 0.95, 0.95);
    return geo;
  }

  spawn(type, z = -90) {
    const lane = Math.floor(Math.random() * LANES.length);
    let mesh;
    let hitKind = "solid";
    if (type === "energy") {
      const core = new THREE.Mesh(this.energyGeometry, this.energyMaterial);
      const edge = new THREE.Mesh(this.energyGeometry, this.energyEdgeMaterial);
      edge.scale.set(1.12, 1.12, 1.08);
      mesh = new THREE.Group();
      mesh.add(core);
      mesh.add(edge);
      mesh.position.set(LANES[lane], 1.35 + Math.random() * 1.8, z);
      hitKind = "pickup";
    } else {
      const roll = Math.random();
      if (roll < 0.34) {
        const height = 1.0;
        mesh = new THREE.Mesh(new THREE.BoxGeometry(1.7, height, 1.1), this.obstacleMaterial);
        mesh.position.set(LANES[lane], height / 2, z);
        hitKind = "slide";
      } else if (roll < 0.66) {
        const radius = 0.72 + Math.random() * 0.32;
        mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), this.boulderMaterial);
        mesh.position.set(LANES[lane], radius, z);
        hitKind = "solid";
      } else {
        const height = 2.25;
        mesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, height, 0.8), this.woodMaterial);
        mesh.position.set(LANES[lane], height / 2, z);
        hitKind = "smash";
        const brace = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 0.9), this.woodMaterial);
        brace.position.set(0, -0.45, 0.02);
        brace.rotation.z = 0.4;
        mesh.add(brace);
        const brace2 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 0.9), this.woodMaterial);
        brace2.position.set(0, 0.38, -0.02);
        brace2.rotation.z = -0.35;
        mesh.add(brace2);
      }
    }
    mesh.castShadow = true;
    mesh.userData.hitKind = hitKind;
    this.scene.add(mesh);
    this.items.push({ type, mesh, lane });
  }

  update(speed, delta, playerBox, { energy = 0, sliding = false } = {}) {
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      const z = -95 - Math.random() * 15;
      this.spawn(Math.random() > 0.44 ? "obstacle" : "energy", z);
      if (Math.random() > 0.72) this.spawn("energy", z - 8);
      this.spawnTimer = Math.max(0.58, 1.25 - speed * 0.025);
    }

    const result = { collected: 0, crashed: false, needSlide: false, smashed: 0, energySpent: 0 };
    const itemBox = new THREE.Box3();
    for (const item of this.items) {
      item.mesh.position.z += speed * delta;
      item.mesh.rotation.y += delta * (item.type === "energy" ? 4 : 0.4);
      item.mesh.rotation.x += delta * (item.type === "energy" ? 2 : 0);
      itemBox.setFromObject(item.mesh);
      if (itemBox.intersectsBox(playerBox)) {
        if (item.type === "energy") {
          result.collected += 1;
          item.mesh.position.z = 40;
        } else {
          const kind = item.mesh.userData.hitKind;
          if (kind === "slide") {
            if (!sliding) {
              result.needSlide = true;
              result.crashed = true;
            } else {
              item.mesh.position.z = 40;
            }
          } else if (kind === "smash") {
            if (energy > 0) {
              result.energySpent += 1;
              result.smashed += 1;
              item.mesh.position.z = 40;
            } else {
              result.crashed = true;
            }
          } else {
            result.crashed = true;
          }
        }
      }
    }

    const survivors = [];
    for (const item of this.items) {
      if (item.mesh.position.z < 22) {
        survivors.push(item);
      } else {
        this.scene.remove(item.mesh);
        // Items may be Groups (energy bolt). Dispose only real, non-shared geometries.
        item.mesh.traverse?.((child) => {
          if (child && child.isMesh && child.geometry && !this.sharedGeometries.has(child.geometry)) {
            child.geometry.dispose();
          }
        });
      }
    }
    this.items = survivors;
    return result;
  }
}
