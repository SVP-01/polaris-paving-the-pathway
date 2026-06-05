import * as THREE from "three";

const LANES = [-3.1, 0, 3.1];

export class Player {
  constructor(material) {
    this.group = new THREE.Group();
    this.lane = 1;
    this.velocityY = 0;
    this.state = "intro-stand";
    this.slideTimer = 0;
    this.ziplineTimer = 0;
    this.introJumping = false;
    this.groundY = 1.45;

    this.sprite = new THREE.Mesh(
      new THREE.PlaneGeometry(1.65, 3.3),
      material
    );
    this.sprite.position.y = 1.62;
    this.group.add(this.sprite);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 24),
      new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.32, depthWrite: false })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;
    this.group.add(this.shadow);
  }

  resetIntro() {
    this.lane = 1;
    this.velocityY = 0;
    this.state = "intro-stand";
    this.slideTimer = 0;
    this.ziplineTimer = 0;
    this.introJumping = false;
    this.group.position.set(0, 3.45, 8);
    this.group.scale.set(1, 1, 1);
    this.group.rotation.set(0, 0, 0);
  }

  beginIntroJump() {
    this.state = "intro-jump";
    this.introJumping = true;
    this.velocityY = 9.8;
  }

  resetPlay() {
    this.state = "run";
    this.lane = 1;
    this.velocityY = 0;
    this.group.position.set(0, this.groundY, 0);
    this.group.scale.set(1, 1, 1);
    this.group.rotation.set(0, 0, 0);
  }

  move(direction) {
    if (this.state !== "run" && this.state !== "jump" && this.state !== "slide") return;
    this.lane = THREE.MathUtils.clamp(this.lane + direction, 0, 2);
  }

  jump() {
    if (this.group.position.y > this.groundY + 0.05 || this.state === "zipline") return;
    this.state = "jump";
    this.velocityY = 10.5;
  }

  slide() {
    if (this.group.position.y > this.groundY + 0.05 || this.state === "zipline") return;
    this.state = "slide";
    this.slideTimer = 0.6;
  }

  zipline() {
    if (this.state === "zipline") return;
    this.state = "zipline";
    this.ziplineTimer = 1.4;
    this.velocityY = 0;
  }

  update(delta, gameState) {
    this.sprite.lookAt(0, this.sprite.position.y + this.group.position.y, 12);

    if (gameState === "MENU") return;

    if (gameState === "INTRO") {
      if (this.state === "intro-jump") {
        this.group.position.z = THREE.MathUtils.damp(this.group.position.z, 0, 2.5, delta);
        this.velocityY -= 24 * delta;
        this.group.position.y += this.velocityY * delta;
        this.group.rotation.x = THREE.MathUtils.damp(this.group.rotation.x, -0.22, 8, delta);
        if (this.group.position.y <= this.groundY) {
          this.group.position.y = this.groundY;
          this.velocityY = 0;
          this.introJumping = false;
        }
      }
      return;
    }

    const targetX = LANES[this.lane];
    this.group.position.x = THREE.MathUtils.damp(this.group.position.x, targetX, 13, delta);

    if (this.state === "zipline") {
      this.ziplineTimer -= delta;
      this.group.position.y = THREE.MathUtils.damp(this.group.position.y, 5.35, 14, delta);
      this.group.rotation.x = THREE.MathUtils.damp(this.group.rotation.x, -0.28, 10, delta);
      if (this.ziplineTimer <= 0) {
        this.state = "jump";
        this.velocityY = -1;
      }
      return;
    }

    this.velocityY -= 25 * delta;
    this.group.position.y += this.velocityY * delta;
    if (this.group.position.y <= this.groundY) {
      this.group.position.y = this.groundY;
      this.velocityY = 0;
      if (this.state === "jump") this.state = "run";
    }

    if (this.state === "slide") {
      this.slideTimer -= delta;
      this.group.scale.y = THREE.MathUtils.damp(this.group.scale.y, 0.55, 18, delta);
      if (this.slideTimer <= 0) this.state = "run";
    } else {
      this.group.scale.y = THREE.MathUtils.damp(this.group.scale.y, 1, 18, delta);
      this.group.rotation.x = THREE.MathUtils.damp(this.group.rotation.x, 0, 10, delta);
    }
  }

  getBox(target = new THREE.Box3()) {
    target.setFromObject(this.group);
    if (this.state === "slide") target.max.y -= 1.1;
    return target;
  }
}
