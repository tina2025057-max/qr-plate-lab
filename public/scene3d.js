import * as THREE from './vendor/three.module.js';
import { iconBadgeRegions } from './iconShapes.js';
import { standBaseSpec, standBaseTriangles, keyringHoleSpec, regionToShape } from './modelParts.js';
import { glyphShapes, textMetrics, TEXT_TRACKING } from './smoothText.js';

const BASE = new THREE.MeshStandardMaterial({ color: 0x56b33c, roughness: 0.72, metalness: 0.03 });
const BASE_EDGE = new THREE.MeshStandardMaterial({ color: 0x288342, roughness: 0.8 });
const WHITE = new THREE.MeshStandardMaterial({ color: 0xf1f5f3, roughness: 0.78 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x24292d, roughness: 0.82 });
const INK = new THREE.MeshStandardMaterial({ color: 0x172b2a, roughness: 0.75 });
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

function roundedShape(width, height, radius) {
  const w = width / 2, h = height / 2, r = Math.min(radius, w, h);
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  return shape;
}

function cubeFace(label, color = '#eef4f1') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#a2b6b2';
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, 122, 122);
  ctx.fillStyle = '#4b5e61';
  ctx.font = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 64, 65);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture });
}

export class ScenePreview {
  constructor(stage, zoomLabel) {
    this.stage = stage;
    this.zoomLabel = zoomLabel;
    this.yaw = 0.36;
    this.pitch = -0.58;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.panMode = false;
    this.bounds = { width: 60, height: 60, thickness: 3 };
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x25362f);
    this.model = new THREE.Group();
    this.scene.add(this.model);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x365547, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(-45, 80, 130);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xd9fff1, 0.7);
    fill.position.set(80, -40, 50);
    this.scene.add(fill);

    const grid = new THREE.GridHelper(400, 40, 0x91a997, 0x5a7462);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -1.2;
    grid.material.transparent = true;
    grid.material.opacity = 0.32;
    this.scene.add(grid);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'model-canvas';
    this.renderer.domElement.setAttribute('aria-label', '可旋轉的 QR 標牌 3D 模型');
    stage.prepend(this.renderer.domElement);

    this.cubeScene = new THREE.Scene();
    this.cubeCamera = new THREE.PerspectiveCamera(36, 1, 0.1, 10);
    this.cube = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), [
      cubeFace('右'), cubeFace('左'), cubeFace('上'), cubeFace('下'), cubeFace('前', '#f5faf6'), cubeFace('後')
    ]);
    this.cubeScene.add(this.cube);
    this.cubeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.cubeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.cubeRenderer.setSize(94, 94);
    this.cubeRenderer.domElement.className = 'orientation-cube';
    this.cubeRenderer.domElement.setAttribute('aria-label', '方向參考方塊，點選可切換前、後、左、右、上、下視角');
    this.cubeRenderer.domElement.setAttribute('title', '點選方塊的面切換預覽方向');
    stage.append(this.cubeRenderer.domElement);
    this.orientationLabel = stage.querySelector('.orientation-label');
    this.faceButtons = [...stage.querySelectorAll('[data-view]')];
    this.faceButtons.forEach((button) => button.addEventListener('click', () => this.setFaceView(button.dataset.view)));
    this.panModeButton = stage.querySelector('#pan-mode');
    this.panModeButton.addEventListener('click', () => {
      this.panMode = !this.panMode;
      this.panModeButton.setAttribute('aria-pressed', String(this.panMode));
      this.panModeButton.title = this.panMode ? '關閉拖曳移動' : '開啟拖曳移動';
      this.renderer.domElement.classList.toggle('pan-mode', this.panMode);
    });
    stage.querySelectorAll('[data-pan]').forEach((button) => button.addEventListener('click', () => {
      const directions = { up: [0, -48], down: [0, 48], left: [-48, 0], right: [48, 0] };
      this.panBy(...directions[button.dataset.pan]);
    }));
    this.cubeRenderer.domElement.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = this.cubeRenderer.domElement.getBoundingClientRect();
      const point = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(point, this.cubeCamera);
      const hit = raycaster.intersectObject(this.cube)[0];
      if (hit) this.setFaceView(['right', 'left', 'top', 'bottom', 'front', 'back'][hit.face.materialIndex]);
    });

    this.drag = null;
    const canvas = this.renderer.domElement;
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 && event.button !== 2) return;
      const mode = this.panMode || event.shiftKey || event.button === 2 ? 'pan' : 'rotate';
      this.drag = { id: event.pointerId, mode, x: event.clientX, y: event.clientY, yaw: this.yaw, pitch: this.pitch, panX: this.panX, panY: this.panY };
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('is-dragging');
      event.preventDefault();
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!this.drag || this.drag.id !== event.pointerId) return;
      if (this.drag.mode === 'pan') {
        this.setPan(this.drag.panX + event.clientX - this.drag.x, this.drag.panY + event.clientY - this.drag.y);
        return;
      }
      this.yaw = this.drag.yaw - (event.clientX - this.drag.x) * 0.009;
      this.pitch = THREE.MathUtils.clamp(this.drag.pitch + (event.clientY - this.drag.y) * 0.007, -1.48, 1.48);
      this.render();
    });
    const endDrag = (event) => {
      if (this.drag?.id !== event.pointerId) return;
      this.drag = null;
      canvas.classList.remove('is-dragging');
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('lostpointercapture', endDrag);
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.zoomBy(event.deltaY < 0 ? 0.08 : -0.08);
    }, { passive: false });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(stage);
    this.resize();
  }

  addBox(x, y, z, width, height, depth, material, parent = this.model) {
    if (width <= 0 || height <= 0 || depth <= 0) return;
    const mesh = new THREE.Mesh(UNIT_BOX, material);
    mesh.position.set(x + width / 2, y + height / 2, z + depth / 2);
    mesh.scale.set(width, height, depth);
    parent.add(mesh);
  }

  addShape(shape, depth, material, z = 0, x = 0, y = 0, curveSegments = 8, parent = this.model) {
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
  }

  clearModel() {
    for (const child of [...this.model.children]) {
      this.model.remove(child);
      child.traverse((node) => { if (node.geometry && node.geometry !== UNIT_BOX) node.geometry.dispose(); });
    }
  }

  update(data) {
    const { s, layout, matrix, iconPosition, textPosition, textSizing } = data;
    this.clearModel();
    const foot = s.shape === 'standee' ? standBaseSpec(layout.width, s.thickness) : null;
    const keyringHole = s.shape === 'keychain' ? keyringHoleSpec(layout.width, layout.height, s.holePosition) : null;
    this.bounds = { width: layout.width, height: layout.height + (foot ? foot.depth + foot.gap : 0), thickness: Math.max(s.thickness + s.whiteThickness + s.depth, s.thickness + s.iconHeight, foot?.height || 0) };
    const ox = -layout.width / 2, oy = foot ? (foot.depth + foot.gap - layout.height) / 2 : -layout.height / 2;

    const cornerRadius = s.shape === 'flat' ? 0 : s.shape === 'keychain' ? 5 : 4;
    const base = roundedShape(layout.width, layout.height, cornerRadius);
    const icon = s.icon !== 'none' ? iconPosition(s, layout) : null;
    if (keyringHole) {
      const hole = new THREE.Path();
      hole.absarc(keyringHole.cx - layout.width / 2, keyringHole.cy - layout.height / 2, keyringHole.radius, 0, Math.PI * 2, true);
      hole.closePath();
      base.holes.push(hole);
    }
    this.addShape(base, s.thickness, BASE, 0, 0, oy + layout.height / 2);
    if (foot) {
      const fy = oy - foot.gap - foot.depth;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(standBaseTriangles(ox, fy, foot).flat(2), 3));
      geometry.computeVertexNormals();
      this.model.add(new THREE.Mesh(geometry, BASE));
    }

    const qrX = ox + layout.qrX, qrY = oy + layout.qrY, whiteX = ox + layout.whiteX, whiteY = oy + layout.whiteY, m = layout.module;
    const whiteHeight = s.whiteThickness, qrZ = s.thickness + whiteHeight;
    this.addBox(whiteX, whiteY, s.thickness, layout.whiteSize, layout.whiteSize, whiteHeight, WHITE);
    if (s.mode === 'recessed') {
      const right = whiteX + layout.whiteSize, top = whiteY + layout.whiteSize;
      this.addBox(qrX, qrY, qrZ + 0.005, layout.qrSize, layout.qrSize, 0.01, DARK);
      this.addBox(whiteX, whiteY, qrZ, layout.whiteSize, qrY - whiteY, s.depth, WHITE);
      this.addBox(whiteX, qrY + layout.qrSize, qrZ, layout.whiteSize, top - qrY - layout.qrSize, s.depth, WHITE);
      this.addBox(whiteX, qrY, qrZ, qrX - whiteX, layout.qrSize, s.depth, WHITE);
      this.addBox(qrX + layout.qrSize, qrY, qrZ, right - qrX - layout.qrSize, layout.qrSize, s.depth, WHITE);
    }
    const cellCount = matrix.reduce((n, row) => n + row.filter((dark) => s.mode === 'raised' ? dark : !dark).length, 0);
    const cells = new THREE.InstancedMesh(UNIT_BOX, s.mode === 'raised' ? DARK : WHITE, cellCount);
    const dummy = new THREE.Object3D();
    let index = 0;
    matrix.forEach((row, r) => row.forEach((dark, c) => {
      if (s.mode === 'raised' ? !dark : dark) return;
      const depth = s.depth;
      dummy.position.set(qrX + (c + 0.5) * m, qrY + (matrix.length - r - 0.5) * m, qrZ + depth / 2);
      dummy.scale.set(m * 0.985, m * 0.985, depth);
      dummy.updateMatrix();
      cells.setMatrixAt(index++, dummy.matrix);
    }));
    cells.instanceMatrix.needsUpdate = true;
    this.model.add(cells);

    if (icon) {
      for (const region of iconBadgeRegions(s.icon, ox + icon.x, oy + icon.y, 11)) {
        this.addShape(regionToShape(region), s.iconHeight, WHITE, s.thickness);
      }
    }

    if (s.text) {
      const p = textPosition(s, layout), sizing = textSizing(s, p.width), metrics = textMetrics(s.text, s.textFont), width = sizing.width;
      const start = p.align === 'left' ? p.x : p.align === 'right' ? p.x + p.width - width : p.x + (p.width - width) / 2;
      let cursor = start;
      [...s.text].forEach((char, i) => {
        glyphShapes(char, s.textFont).forEach((shape) => {
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: s.textHeight, bevelEnabled: false });
        const mesh = new THREE.Mesh(geometry, WHITE);
        mesh.position.set(ox + cursor + metrics.advances[i] * sizing.scaleX / 2, oy + p.y + sizing.scaleY / 2, s.thickness);
        mesh.scale.set(sizing.scaleX, sizing.scaleY, 1);
        this.model.add(mesh);
        });
        cursor += (metrics.advances[i] + (i < metrics.advances.length - 1 ? TEXT_TRACKING : 0)) * sizing.scaleX;
      });
    }
    this.render();
  }

  resize() {
    const width = this.stage.clientWidth, height = this.stage.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.render();
  }

  render() {
    const { width, height, thickness } = this.bounds;
    const viewHeight = Math.max(height * 1.25, width / Math.max(0.45, this.camera.aspect) * 1.25);
    const distance = viewHeight / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / this.zoom;
    const target = new THREE.Vector3(0, 0, thickness / 2);
    const cosPitch = Math.cos(this.pitch);
    this.camera.position.set(Math.sin(this.yaw) * cosPitch * distance, Math.sin(this.pitch) * distance, Math.cos(this.yaw) * cosPitch * distance + thickness / 2);
    this.camera.lookAt(target);
    // Translate in camera space so the model moves in screen directions at every viewing angle.
    const worldPerPixel = 2 * distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) / this.stage.clientHeight;
    this.camera.translateX(-this.panX * worldPerPixel);
    this.camera.translateY(this.panY * worldPerPixel);
    this.renderer.render(this.scene, this.camera);
    this.cubeCamera.position.set(Math.sin(this.yaw) * cosPitch * 3.5, Math.sin(this.pitch) * 3.5, Math.cos(this.yaw) * cosPitch * 3.5);
    this.cubeCamera.lookAt(0, 0, 0);
    this.cubeRenderer.render(this.cubeScene, this.cubeCamera);
    this.zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`;
    const horizontal = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
    const face = this.pitch > 0.9 ? 'top' : this.pitch < -0.9 ? 'bottom' : ['back','left','front','right','back'][Math.round(horizontal / (Math.PI / 2)) + 2];
    const labels = { front: '前', back: '後', left: '左', right: '右', top: '上', bottom: '下' };
    this.orientationLabel.textContent = `方向參考 · ${labels[face]}`;
    this.faceButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.view === face));
  }

  setFaceView(face) {
    const views = { front: [0, 0], back: [Math.PI, 0], left: [-Math.PI / 2, 0], right: [Math.PI / 2, 0], top: [0, 1.47], bottom: [0, -1.47] };
    if (!views[face]) return;
    [this.yaw, this.pitch] = views[face];
    this.render();
  }

  zoomBy(amount) {
    this.zoom = THREE.MathUtils.clamp(Number((this.zoom + amount).toFixed(2)), 0.55, 2.2);
    this.render();
  }

  setPan(x, y) {
    this.panX = THREE.MathUtils.clamp(x, -this.stage.clientWidth * 0.85, this.stage.clientWidth * 0.85);
    this.panY = THREE.MathUtils.clamp(y, -this.stage.clientHeight * 0.85, this.stage.clientHeight * 0.85);
    this.render();
  }

  panBy(x, y) {
    this.setPan(this.panX + x, this.panY + y);
  }

  reset() {
    this.yaw = 0.36;
    this.pitch = -0.58;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.render();
  }
}
