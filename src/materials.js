import * as THREE from "three";

export function createKeyedMaterial(texture, { keyWhite = true, keyGreen = true, keyChecker = true } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: texture },
      keyWhite: { value: keyWhite ? 1 : 0 },
      keyGreen: { value: keyGreen ? 1 : 0 },
      keyChecker: { value: keyChecker ? 1 : 0 }
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform int keyWhite;
      uniform int keyGreen;
      uniform int keyChecker;
      varying vec2 vUv;

      void main() {
        vec4 color = texture2D(map, vUv);
        float neutral = max(abs(color.r - color.g), abs(color.g - color.b));
        float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        bool transparentAlpha = color.a < 0.5;
        bool green = keyGreen == 1 && color.g > 0.46 && color.g > color.r * 1.35 && color.g > color.b * 1.2;
        bool white = keyWhite == 1 && color.r > 0.9 && color.g > 0.9 && color.b > 0.9;
        bool checker = keyChecker == 1 && neutral < 0.035 && luma > 0.52;
        if (transparentAlpha || green || white || checker) discard;
        gl_FragColor = color;
      }
    `
  });
}
