import * as THREE from "three";

export function makeCanvasTexture(draw, size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createGeneratedAtlasTexture() {
  const texture = new THREE.TextureLoader().load("/assets/dystopian-texture-atlas.png");
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createProceduralTextures() {
  const concrete = makeCanvasTexture((ctx, size) => {
    ctx.fillStyle = "#3a4143";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 900; i += 1) {
      const shade = 70 + Math.random() * 80;
      ctx.fillStyle = `rgba(${shade}, ${shade + 4}, ${shade + 7}, ${Math.random() * 0.16})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    ctx.strokeStyle = "rgba(10, 14, 16, 0.32)";
    ctx.lineWidth = 4;
    for (let x = 0; x <= size; x += size / 4) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + Math.sin(x) * 8, size);
      ctx.stroke();
    }
  });

  const suit = makeCanvasTexture((ctx, size) => {
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, "#12171d");
    gradient.addColorStop(0.55, "#263039");
    gradient.addColorStop(1, "#080a0d");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "#6cecff";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(size * 0.18, size * 0.12);
    ctx.lineTo(size * 0.82, size * 0.88);
    ctx.moveTo(size * 0.78, size * 0.12);
    ctx.lineTo(size * 0.32, size * 0.88);
    ctx.stroke();
  });

  const hazard = makeCanvasTexture((ctx, size) => {
    ctx.fillStyle = "#14171a";
    ctx.fillRect(0, 0, size, size);
    ctx.rotate(-Math.PI / 7);
    for (let x = -size; x < size * 2; x += 42) {
      ctx.fillStyle = "#e7b63e";
      ctx.fillRect(x, -size, 18, size * 3);
    }
  });

  return { concrete, suit, hazard };
}
