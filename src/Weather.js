import * as THREE from "three";

const MODES = [
  { name: "Clear", fog: 0.01, color: "#0b1118", rain: 0, lightning: 0, wetness: 0.05 },
  { name: "Rain", fog: 0.018, color: "#07161c", rain: 0.75, lightning: 0.2, wetness: 0.75 },
  { name: "Fog", fog: 0.045, color: "#141c1f", rain: 0.2, lightning: 0.05, wetness: 0.25 },
  { name: "Storm", fog: 0.024, color: "#060f17", rain: 1, lightning: 0.8, wetness: 0.95 }
];

export class Weather {
  constructor(scene) {
    this.scene = scene;
    this.modeIndex = 0;
    this.timer = 12;
    this.autoCycle = false;
    this.flash = 0;
    this.lightning = new THREE.PointLight("#83eeff", 0, 70);
    this.lightning.position.set(0, 12, -22);
    scene.add(this.lightning);

    const count = 1500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 26;
      positions[i * 3 + 1] = Math.random() * 15;
      positions[i * 3 + 2] = -Math.random() * 92;
    }
    this.rainGeometry = new THREE.BufferGeometry();
    this.rainGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.rain = new THREE.Points(
      this.rainGeometry,
      new THREE.PointsMaterial({ color: "#9be8ff", size: 0.065, transparent: true, opacity: 0 })
    );
    scene.add(this.rain);

    this.boltMaterial = new THREE.LineBasicMaterial({ color: "#aef6ff", transparent: true, opacity: 0 });
    this.bolt = this.createLightningBolt();
    this.bolt.visible = false;
    scene.add(this.bolt);
    this.applyMode();
  }

  reset() {
    this.modeIndex = 0;
    this.timer = 10;
    this.flash = 0;
    this.autoCycle = false;
    this.applyMode();
  }

  setMode(index, { autoCycle = false } = {}) {
    const next = THREE.MathUtils.clamp(index, 0, MODES.length - 1);
    this.modeIndex = next;
    this.timer = 10 + Math.random() * 9;
    this.autoCycle = autoCycle;
    this.applyMode();
  }

  applyMode() {
    const mode = MODES[this.modeIndex];
    this.scene.fog = new THREE.FogExp2(mode.color, mode.fog);
    this.scene.background = new THREE.Color(mode.color);
    this.rain.material.opacity = mode.rain;
  }

  update(delta, speed) {
    if (this.autoCycle) {
      this.timer -= delta;
      if (this.timer <= 0) {
        this.modeIndex = (this.modeIndex + 1) % MODES.length;
        this.timer = 10 + Math.random() * 9;
        this.applyMode();
      }
    }

    const mode = MODES[this.modeIndex];
    const positions = this.rainGeometry.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      let y = positions.getY(i) - delta * (8 + speed * 0.22);
      let z = positions.getZ(i) + delta * speed * 0.7;
      if (y < -0.2 || z > 8) {
        y = 10 + Math.random() * 7;
        z = -80 - Math.random() * 25;
      }
      positions.setY(i, y);
      positions.setZ(i, z);
    }
    positions.needsUpdate = true;

    if (Math.random() < mode.lightning * delta) {
      this.flash = 0.22;
      this.lightning.position.x = (Math.random() - 0.5) * 15;
      this.lightning.position.z = -18 - Math.random() * 28;
      this.spawnBolt();
    }

    this.flash = Math.max(0, this.flash - delta);
    this.lightning.intensity = this.flash > 0 ? 6.5 * (this.flash / 0.22) : 0;
    this.boltMaterial.opacity = this.flash > 0 ? 0.9 * (this.flash / 0.22) : 0;
    this.bolt.visible = this.flash > 0.02;
    return mode.name;
  }

  getWetness() {
    return MODES[this.modeIndex].wetness;
  }

  getLightingPreset() {
    const mode = MODES[this.modeIndex].name;
    if (mode === "Clear") {
      return {
        hemiSky: "#ffe2b3",
        hemiGround: "#0c1014",
        hemiIntensity: 1.25,
        keyColor: "#ffd29a",
        keyIntensity: 2.35
      };
    }
    if (mode === "Rain") {
      return {
        hemiSky: "#bfeaff",
        hemiGround: "#071014",
        hemiIntensity: 1.05,
        keyColor: "#d9f5ff",
        keyIntensity: 1.9
      };
    }
    if (mode === "Fog") {
      return {
        hemiSky: "#d7e7ee",
        hemiGround: "#0a0f12",
        hemiIntensity: 0.95,
        keyColor: "#f1fbff",
        keyIntensity: 1.65
      };
    }
    return {
      hemiSky: "#9edcff",
      hemiGround: "#05080d",
      hemiIntensity: 1.15,
      keyColor: "#bfeaff",
      keyIntensity: 2.1
    };
  }

  createLightningBolt() {
    const points = [];
    let x = 0;
    let y = 14;
    let z = -40;
    points.push(new THREE.Vector3(x, y, z));
    for (let i = 0; i < 10; i += 1) {
      x += (Math.random() - 0.5) * 3.5;
      y -= 1.6 + Math.random() * 1.6;
      z += (Math.random() - 0.5) * 2.4;
      points.push(new THREE.Vector3(x, y, z));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.Line(geo, this.boltMaterial);
  }

  spawnBolt() {
    const bolt = this.bolt.geometry.attributes.position;
    let x = (Math.random() - 0.5) * 20;
    let y = 16;
    let z = -45 - Math.random() * 30;
    for (let i = 0; i < bolt.count; i += 1) {
      bolt.setXYZ(i, x, y, z);
      x += (Math.random() - 0.5) * 3.4;
      y -= 1.5 + Math.random() * 1.7;
      z += (Math.random() - 0.5) * 2.6;
    }
    bolt.needsUpdate = true;
  }
}
