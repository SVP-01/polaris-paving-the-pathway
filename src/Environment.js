import * as THREE from "three";

const LANES = [-3.1, 0, 3.1];

function rand(min, max) {
  return min + Math.random() * (max - min);
}

export class Environment {
  constructor(scene, trainMaterial) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.trainGroup = new THREE.Group();
    scene.add(this.group);
    scene.add(this.trainGroup);

    this.segments = [];
    this.obstacles = [];
    this.ziplines = [];
    this.turns = [];
    this.worldAngle = 0;
    this.turning = false;
    this.turnProgress = 0;
    this.targetAngle = 0;

    this.floorMaterial = new THREE.MeshStandardMaterial({ color: "#242722", roughness: 0.86, metalness: 0.05 });
    this.roadMaterial = new THREE.MeshStandardMaterial({ color: "#111619", roughness: 0.72, metalness: 0.18 });
    this.mossMaterial = new THREE.MeshStandardMaterial({ color: "#355b32", roughness: 0.96 });
    this.buildingMaterials = [
      new THREE.MeshStandardMaterial({ color: "#242b2d", roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: "#343b3b", roughness: 0.82 }),
      new THREE.MeshStandardMaterial({ color: "#1b2225", roughness: 0.9 })
    ];
    this.hazardMaterial = new THREE.MeshStandardMaterial({ color: "#7b5632", roughness: 0.82 });
    this.metalMaterial = new THREE.MeshStandardMaterial({ color: "#32383a", roughness: 0.45, metalness: 0.5 });
    this.wireMaterial = new THREE.MeshBasicMaterial({ color: "#bdf7ff" });
    this.trainMaterial = trainMaterial;

    this.buildIntroTrain();
    for (let i = 0; i < 20; i += 1) this.spawnSegment(-i * 12);
  }

  resetIntro() {
    this.group.clear();
    this.trainGroup.visible = true;
    this.segments = [];
    this.obstacles = [];
    this.ziplines = [];
    this.turns = [];
    this.worldAngle = 0;
    this.targetAngle = 0;
    this.turning = false;
    this.group.rotation.y = 0;
    for (let i = 0; i < 20; i += 1) this.spawnSegment(-i * 12);
    this.buildIntroTrain();
  }

  startPlay() {
    this.trainGroup.visible = false;
  }

  buildIntroTrain() {
    this.trainGroup.clear();
    const shell = new THREE.Mesh(new THREE.BoxGeometry(8, 4.2, 9), this.metalMaterial);
    shell.position.set(0, 2.8, 7.8);
    this.trainGroup.add(shell);

    const interior = new THREE.Mesh(new THREE.BoxGeometry(7.5, 3.7, 8.5), new THREE.MeshStandardMaterial({ color: "#161b1d", roughness: 0.9 }));
    interior.position.set(0, 2.8, 7.65);
    this.trainGroup.add(interior);

    const trainSide = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 3.8), this.trainMaterial);
    trainSide.position.set(-4.25, 2.7, 7.6);
    trainSide.rotation.y = Math.PI / 2;
    this.trainGroup.add(trainSide);

    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(2.35, 3.25, 0.18), this.hazardMaterial);
    doorFrame.position.set(0, 2.35, 3.05);
    this.trainGroup.add(doorFrame);

    const opening = new THREE.Mesh(new THREE.BoxGeometry(1.75, 2.8, 0.2), new THREE.MeshBasicMaterial({ color: "#05080a" }));
    opening.position.set(0, 2.4, 2.93);
    this.trainGroup.add(opening);

    const floor = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.15, 8), this.metalMaterial);
    floor.position.set(0, 0.82, 7.4);
    this.trainGroup.add(floor);
  }

  spawnSegment(z) {
    const segment = new THREE.Group();
    segment.position.z = z;

    const base = new THREE.Mesh(new THREE.BoxGeometry(14, 0.25, 12), this.floorMaterial);
    base.receiveShadow = true;
    segment.add(base);

    const road = new THREE.Mesh(new THREE.BoxGeometry(9.7, 0.12, 12), this.roadMaterial);
    road.position.y = 0.08;
    road.receiveShadow = true;
    segment.add(road);

    for (const x of LANES) {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 10.5), this.metalMaterial);
      marker.position.set(x, 0.18, 0);
      segment.add(marker);
    }

    for (const side of [-1, 1]) {
      const verge = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 12), this.mossMaterial);
      verge.position.set(side * 6.1, 0.12, 0);
      segment.add(verge);

      const height = rand(5.5, 18);
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(rand(2.5, 4.8), height, rand(4, 9)),
        this.buildingMaterials[Math.floor(rand(0, this.buildingMaterials.length))]
      );
      building.position.set(side * rand(9, 14), height / 2, rand(-3.5, 3.5));
      building.castShadow = true;
      segment.add(building);
    }

    if (Math.random() > 0.68 && z < -25) this.spawnObstacle(z);
    if (Math.random() > 0.82 && z < -35) this.spawnZipline(z);
    if (Math.random() > 0.9 && z < -45) this.turns.push({ z, used: false });

    this.group.add(segment);
    this.segments.push(segment);
  }

  spawnObstacle(z) {
    const lane = Math.floor(rand(0, 3));
    const type = Math.random() > 0.55 ? "car" : "barrier";
    const mesh = type === "car"
      ? new THREE.Mesh(new THREE.BoxGeometry(1.8, 1, 2.7), this.hazardMaterial)
      : new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 0.7), this.metalMaterial);
    mesh.position.set(LANES[lane], type === "car" ? 0.75 : 1.25, z);
    mesh.castShadow = true;
    mesh.userData.type = type;
    this.group.add(mesh);
    this.obstacles.push(mesh);
  }

  spawnZipline(z) {
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 11, 10), this.wireMaterial);
    wire.rotation.x = Math.PI / 2;
    wire.position.set(0, 5.5, z);
    wire.userData.used = false;
    this.group.add(wire);
    this.ziplines.push(wire);
  }

  update(delta, speed) {
    const move = speed * delta;
    for (const segment of this.segments) segment.position.z += move;
    for (const obstacle of this.obstacles) obstacle.position.z += move;
    for (const wire of this.ziplines) wire.position.z += move;
    for (const turn of this.turns) turn.z += move;
    this.trainGroup.position.z += move * 0.25;

    while (this.segments.length && this.segments[0].position.z > 18) {
      const old = this.segments.shift();
      this.group.remove(old);
      const farthest = Math.min(...this.segments.map((segment) => segment.position.z));
      this.spawnSegment(farthest - 12);
    }

    this.obstacles = this.obstacles.filter((obstacle) => {
      if (obstacle.position.z < 18) return true;
      this.group.remove(obstacle);
      return false;
    });
    this.ziplines = this.ziplines.filter((wire) => {
      if (wire.position.z < 18) return true;
      this.group.remove(wire);
      return false;
    });

    const nextTurn = this.turns.find((turn) => !turn.used && turn.z > -1 && turn.z < 2);
    if (nextTurn && !this.turning) {
      nextTurn.used = true;
      this.turning = true;
      this.turnProgress = 0;
      this.targetAngle = this.worldAngle + Math.PI / 2;
    }

    if (this.turning) {
      this.turnProgress = Math.min(1, this.turnProgress + delta * 1.8);
      this.group.rotation.y = THREE.MathUtils.lerp(this.worldAngle, this.targetAngle, smooth(this.turnProgress));
      if (this.turnProgress >= 1) {
        this.turning = false;
        this.worldAngle = this.targetAngle;
      }
    }
  }

  canZipline() {
    const wire = this.ziplines.find((item) => !item.userData.used && item.position.z > -4 && item.position.z < 3);
    if (!wire) return false;
    wire.userData.used = true;
    return true;
  }

  checkCollision(playerBox) {
    const box = new THREE.Box3();
    for (const obstacle of this.obstacles) {
      box.setFromObject(obstacle);
      if (box.intersectsBox(playerBox)) return true;
    }
    return false;
  }
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}
