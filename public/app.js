import { ScenePreview } from './scene3d.js';
import * as THREE from './vendor/three.module.js';
import { iconBadgeRegions } from './iconShapes.js';
import { standBaseSpec, standInsertKeepout, keyringHoleSpec, standBaseFacets, extrudedRegionsFacets } from './modelParts.js';
import { glyphShapes, textMetrics, TEXT_TRACKING } from './smoothText.js';
import { createZip } from './zip.js';

(() => {
  const form = document.querySelector('#generator-form');
  const input = document.querySelector('#url-input');
  const error = document.querySelector('#form-error');
  const qrSvg = document.querySelector('#qr-svg');
  const previewStage = document.querySelector('#preview-stage');
  const viewReset = document.querySelector('#view-reset');
  const viewZoomOut = document.querySelector('#view-zoom-out');
  const viewZoomIn = document.querySelector('#view-zoom-in');
  const viewZoom = document.querySelector('#view-zoom');
  const status = document.querySelector('#status-pill');
  const stlButton = document.querySelector('#download-stl');
  const stlButtonLabel = stlButton.querySelector('span');
  const svgButton = document.querySelector('#download-svg');
  const widthInput = document.querySelector('#plate-width');
  const heightInput = document.querySelector('#plate-height');
  const holePositionInput = document.querySelector('#keyring-hole-position');
  const holePositionRow = document.querySelector('#keyring-hole-row');
  const layoutWarning = document.querySelector('#layout-warning');
  const whiteSizeInput = document.querySelector('#white-size');
  const whiteThicknessInput = document.querySelector('#white-thickness');
  const qrSizeInput = document.querySelector('#qr-size');
  const qrMarginInput = document.querySelector('#qr-margin');
  const thicknessInput = document.querySelector('#base-thickness');
  const modeInput = document.querySelector('#qr-mode');
  const depthInput = document.querySelector('#qr-depth');
  const iconInput = document.querySelector('#icon-select');
  const iconPositionInput = document.querySelector('#icon-position');
  const iconHeightInput = document.querySelector('#icon-height');
  const textInput = document.querySelector('#text-input');
  const textPositionInput = document.querySelector('#text-position');
  const textFontInput = document.querySelector('#text-font');
  const textSizeInput = document.querySelector('#text-size');
  const textHeightInput = document.querySelector('#text-height');
  const shapeInput = document.querySelector('#base-shape');
  const standeeNote = document.querySelector('#standee-note');
  const widthValue = document.querySelector('#plate-width-value');
  const heightValue = document.querySelector('#plate-height-value');
  const whiteSizeValue = document.querySelector('#white-size-value');
  const whiteThicknessValue = document.querySelector('#white-thickness-value');
  const qrSizeValue = document.querySelector('#qr-size-value');
  const qrMarginValue = document.querySelector('#qr-margin-value');
  const quietZoneNote = document.querySelector('#quiet-zone-note');
  const thicknessValue = document.querySelector('#base-thickness-value');
  const depthValue = document.querySelector('#qr-depth-value');
  const iconHeightValue = document.querySelector('#icon-height-value');
  const textSizeValue = document.querySelector('#text-size-value');
  const textHeightValue = document.querySelector('#text-height-value');
  const textCount = document.querySelector('#text-count');
  const sceneBaseSize = document.querySelector('#scene-base-size');
  const moduleOutput = document.querySelector('#qr-modules');
  const versionOutput = document.querySelector('#qr-version');
  const shapeOutput = document.querySelector('#shape-output');
  const sceneQrDepth = document.querySelector('#scene-qr-depth');
  const sceneWhiteSize = document.querySelector('#scene-white-size');
  const sceneQrSize = document.querySelector('#scene-qr-size');
  const sceneQrMargin = document.querySelector('#scene-qr-margin');
  const sceneIconDepth = document.querySelector('#scene-icon-depth');
  const sceneTextDepth = document.querySelector('#scene-text-depth');
  const sceneStandBaseRow = document.querySelector('#scene-stand-base-row');
  const sceneStandBaseSize = document.querySelector('#scene-stand-base-size');
  const sceneHoleRow = document.querySelector('#scene-hole-row');
  const sceneHolePosition = document.querySelector('#scene-hole-position');
  const shapeButtons = [...document.querySelectorAll('.shape-option')];
  let currentMatrix = null;
  let currentUrl = '';
  let preview;
  let urlTimer;
  try {
    preview = new ScenePreview(previewStage, viewZoom);
  } catch (err) {
    console.error('3D preview could not start:', err);
    previewStage.classList.add('preview-unavailable');
    previewStage.insertAdjacentHTML('beforeend', '<p class="preview-error">此瀏覽器無法啟動 3D 預覽，仍可下載 STL。</p>');
  }

  function settings() {
    return { shape: shapeInput.value, width: Number(widthInput.value), height: Number(heightInput.value), holePosition: holePositionInput.value, whiteSize: Number(whiteSizeInput.value), whiteThickness: Number(whiteThicknessInput.value), qrSize: Number(qrSizeInput.value), qrMargin: Number(qrMarginInput.value), thickness: Number(thicknessInput.value), mode: modeInput.value, depth: Number(depthInput.value), icon: iconInput.value, iconPosition: iconPositionInput.value, iconHeight: Number(iconHeightInput.value), text: textInput.value, textPosition: textPositionInput.value, textFont: textFontInput.value, textSize: Number(textSizeInput.value), textHeight: Number(textHeightInput.value) };
  }

  function setRangeFill(el) {
    const percent = ((Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min))) * 100;
    el.style.background = `linear-gradient(90deg, var(--orange) 0 ${percent}%, #dce5e1 ${percent}% 100%)`;
  }

  function shapeDimensions(s = settings()) {
    return { width: s.width, height: s.height };
  }

  function bandHeightFor(s) {
    const iconLine = s.icon !== 'none' ? 11 : 0, textLine = s.text ? s.textSize : 0;
    return s.textPosition === 'after-icon' && s.icon !== 'none' ? Math.max(iconLine, textLine) : iconLine + textLine + (iconLine && textLine ? 2 : 0);
  }

  function maxWhiteFor(s) {
    const dims = shapeDimensions(s), margin = Math.max(2.5, Math.min(dims.width, dims.height) * .05), hasAccessory = s.icon !== 'none' || Boolean(s.text);
    const bottomKeepout = s.shape === 'standee' ? standInsertKeepout(dims.width, s.thickness) : 0;
    const availableHeight = dims.height - 2 * margin - bottomKeepout - (s.shape === 'keychain' ? keyringHoleSpec(dims.width, dims.height, s.holePosition).topKeepout : 0) - (hasAccessory ? bandHeightFor(s) + 3 : 0);
    return Math.floor(Math.min(dims.width - 2 * margin, availableHeight) * 2) / 2;
  }

  function syncQrDimensions(changedId) {
    const maxDepth = Math.round(Math.min(3, Number(thicknessInput.value) - .2) * 10) / 10;
    depthInput.max = String(maxDepth);
    if (Number(depthInput.value) > maxDepth) depthInput.value = String(maxDepth);
    const s = settings();
    const available = maxWhiteFor(s);
    const fits = available >= 16;
    whiteSizeInput.max = String(Math.max(16, available));
    whiteSizeInput.value = String(Math.min(Math.max(16, Number(whiteSizeInput.value)), Number(whiteSizeInput.max)));
    const white = Number(whiteSizeInput.value);
    qrSizeInput.max = String(white - 4);
    qrMarginInput.max = String(Math.min(15, (white - 12) / 2));
    if (changedId === 'qr-size') {
      qrSizeInput.value = String(Math.min(Math.max(12, Number(qrSizeInput.value)), white - 4));
      qrMarginInput.value = String((white - Number(qrSizeInput.value)) / 2);
    } else {
      qrMarginInput.value = String(Math.min(Math.max(2, Number(qrMarginInput.value)), Number(qrMarginInput.max)));
      qrSizeInput.value = String(white - 2 * Number(qrMarginInput.value));
    }
    layoutWarning.hidden = fits;
    layoutWarning.textContent = fits ? '' : '目前長寬不足以同時容納 QR、孔位／插槽與圖文；請加大底盤長或寬，或移除圖文。';
    return fits;
  }

  function updateQuietZone(s, count) {
    const moduleWidth = s.qrSize / count, modules = s.qrMargin / moduleWidth;
    quietZoneNote.textContent = `每側留白 ${modules.toFixed(1)} 個模組（建議 ≥ 4）；單格 ${moduleWidth.toFixed(2)} mm（建議 ≥ 1.2 mm）。`;
    quietZoneNote.classList.toggle('is-warning', modules < 4 || moduleWidth < 1.2);
  }

  function updateReadouts(changed) {
    const fits = syncQrDimensions(typeof changed === 'string' ? changed : changed?.target?.id);
    const s = settings(), d = shapeDimensions(s);
    widthValue.textContent = widthInput.value; heightValue.textContent = heightInput.value; whiteSizeValue.textContent = s.whiteSize.toFixed(1); whiteThicknessValue.textContent = s.whiteThickness.toFixed(1); qrSizeValue.textContent = s.qrSize.toFixed(1); qrMarginValue.textContent = s.qrMargin.toFixed(1);
    thicknessValue.textContent = s.thickness.toFixed(1); depthValue.textContent = s.depth.toFixed(1); iconHeightValue.textContent = s.iconHeight.toFixed(1); textSizeValue.textContent = s.textSize.toFixed(1); textHeightValue.textContent = s.textHeight.toFixed(1); textCount.textContent = `${textInput.value.length} / 18`;
    sceneBaseSize.textContent = `${d.width.toFixed(0)} × ${d.height.toFixed(0)} × ${s.thickness.toFixed(1)} mm`;
    sceneWhiteSize.textContent = `${s.whiteSize.toFixed(1)} × ${s.whiteSize.toFixed(1)} × ${s.whiteThickness.toFixed(1)} mm`;
    sceneQrSize.textContent = `${s.qrSize.toFixed(1)} × ${s.qrSize.toFixed(1)} mm`;
    sceneQrMargin.textContent = `${s.qrMargin.toFixed(1)} mm`;
    if (currentMatrix) updateQuietZone(s, currentMatrix.count);
    sceneQrDepth.textContent = `${s.mode === 'raised' ? '凸起' : '凹入'} ${s.depth.toFixed(1)} mm`;
    sceneIconDepth.textContent = s.icon === 'none' ? '未加入' : `圖案鏤空 ${s.iconHeight.toFixed(1)} mm`;
    const currentLayout = currentMatrix ? layoutFor(s, Boolean(s.icon !== 'none' || s.text)) : null;
    const textPlacement = currentLayout && s.text ? textPosition(s, currentLayout) : null;
    sceneTextDepth.textContent = s.text ? `字級 ${s.textSize.toFixed(1)} · 厚 ${s.textHeight.toFixed(1)} mm` : '未加入';
    const standBase = standBaseSpec(d.width, s.thickness);
    standeeNote.hidden = s.shape !== 'standee';
    standeeNote.textContent = `桌上立牌包含牌面與同寬插槽底座；插槽向後傾斜 ${standBase.leanAngleDeg}°，方便由前方掃描。牌面底部預留 ${standInsertKeepout(d.width, s.thickness).toFixed(1)} mm 插入區，圖文自動上移。插槽保留 0.5 mm 組裝間隙；下載 ZIP 含兩個獨立 STL。`;
    sceneStandBaseRow.hidden = s.shape !== 'standee';
    sceneStandBaseSize.textContent = `${standBase.width.toFixed(0)} × ${standBase.depth.toFixed(0)} × ${standBase.height.toFixed(1)} mm`;
    holePositionRow.hidden = s.shape !== 'keychain';
    sceneHoleRow.hidden = s.shape !== 'keychain';
    sceneHolePosition.textContent = `${{ left: '左', center: '中', right: '右' }[s.holePosition]} · Ø${(keyringHoleSpec(d.width, d.height, s.holePosition).radius * 2).toFixed(1)} mm`;
    [widthInput, heightInput, whiteSizeInput, whiteThicknessInput, qrSizeInput, qrMarginInput, thicknessInput, depthInput, iconHeightInput, textSizeInput, textHeightInput].forEach(setRangeFill);
    shapeButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.shape === s.shape));
    shapeOutput.textContent = s.shape === 'standee' ? 'STAND' : s.shape === 'keychain' ? 'KEYRING' : 'FLAT';
    stlButtonLabel.textContent = s.shape === 'standee' ? '下載立牌 ZIP（2 個 STL）' : '下載 STL';
    stlButton.disabled = !currentMatrix || !fits;
    if (currentMatrix) {
      status.innerHTML = `<i></i> ${fits ? 'READY TO PRINT' : '尺寸不足'}`;
      status.style.color = fits ? '#5d9272' : '#c75b42';
    }
    if (currentMatrix) renderPreview(currentMatrix);
  }

  function normaliseUrl(value) {
    const trimmed = value.trim();
    if (!trimmed) throw new Error('請先輸入網址。');
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    if (!parsed.hostname || !parsed.hostname.includes('.')) throw new Error('請輸入有效的網址，例如 example.com。');
    return parsed.toString();
  }

  function makeMatrix(value) {
    if (typeof window.qrcode !== 'function') throw new Error('QR 引擎仍在載入中，請稍候再試。');
    const qr = window.qrcode(0, 'M'); qr.addData(value, 'Byte'); qr.make();
    const count = qr.getModuleCount();
    const matrix = Array.from({ length: count }, (_, row) => Array.from({ length: count }, (_, col) => qr.isDark(row, col)));
    return { matrix, count, version: Math.round((count - 17) / 4) };
  }

  function renderPreview(qrData) {
    const { matrix, count } = qrData, s = settings(), darkCells = [];
    matrix.forEach((row, r) => row.forEach((dark, c) => { if (dark) darkCells.push(`<rect x="${c}" y="${r}" width="1" height="1"/>`); }));
    qrSvg.setAttribute('viewBox', `0 0 ${count} ${count}`); qrSvg.innerHTML = `<rect width="${count}" height="${count}" fill="#ffffff"/><g fill="#14232c">${darkCells.join('')}</g>`;
    const layout = layoutFor(s, Boolean(s.icon !== 'none' || s.text));
    updateQuietZone(s, count);
    preview?.update({ s, layout, matrix, glyphShapes, iconPosition: accessoryPosition, textPosition, textSizing });
    moduleOutput.textContent = `${count} × ${count}`; versionOutput.textContent = `V${qrData.version}`;
  }

  function asciiFacet(a, b, c) { return `facet normal 0 0 0\n outer loop\n  vertex ${a.join(' ')}\n  vertex ${b.join(' ')}\n  vertex ${c.join(' ')}\n endloop\nendfacet\n`; }
  function cuboid(x, y, z, width, depth, height) {
    if (width <= 0 || depth <= 0 || height <= 0) return '';
    const x2 = x + width, y2 = y + depth, z2 = z + height, v = [[x,y,z],[x2,y,z],[x2,y2,z],[x,y2,z],[x,y,z2],[x2,y,z2],[x2,y2,z2],[x,y2,z2]];
    return asciiFacet(v[0],v[2],v[1]) + asciiFacet(v[0],v[3],v[2]) + asciiFacet(v[4],v[5],v[6]) + asciiFacet(v[4],v[6],v[7]) + asciiFacet(v[0],v[1],v[5]) + asciiFacet(v[0],v[5],v[4]) + asciiFacet(v[1],v[2],v[6]) + asciiFacet(v[1],v[6],v[5]) + asciiFacet(v[2],v[3],v[7]) + asciiFacet(v[2],v[7],v[6]) + asciiFacet(v[3],v[0],v[4]) + asciiFacet(v[3],v[4],v[7]);
  }

  function polygonPrism(points, z, height) {
    let out = ''; const bottom = points.map(([x,y]) => [x,y,z]), top = points.map(([x,y]) => [x,y,z + height]);
    for (let i = 1; i < points.length - 1; i++) { out += asciiFacet(bottom[0], bottom[i + 1], bottom[i]); out += asciiFacet(top[0], top[i], top[i + 1]); }
    points.forEach((_, i) => { const n = (i + 1) % points.length; out += asciiFacet(bottom[i], bottom[n], top[n]); out += asciiFacet(bottom[i], top[n], top[i]); });
    return out;
  }

  function roundedRectPoints(width, height, radius, offsetX = 0, offsetY = 0) {
    const r = Math.min(radius, width / 2, height / 2), points = [];
    [[r,r,Math.PI],[width-r,r,Math.PI * 1.5],[width-r,height-r,0],[r,height-r,Math.PI * .5]].forEach(([cx,cy,start]) => { for (let i = 0; i <= 4; i++) { const a = start + (Math.PI / 2) * i / 4; points.push([offsetX + cx + Math.cos(a) * r, offsetY + cy + Math.sin(a) * r]); } });
    return points;
  }

  function baseGeometry(s, layout) {
    const outline = s.shape === 'flat'
      ? [[0,0],[layout.width,0],[layout.width,layout.height],[0,layout.height]]
      : roundedRectPoints(layout.width, layout.height, s.shape === 'keychain' ? 5 : 4);
    if (s.shape === 'keychain') {
      const hole = keyringHoleSpec(layout.width, layout.height, s.holePosition);
      const circle = Array.from({ length: 40 }, (_, i) => { const angle = -2 * Math.PI * i / 40; return [hole.cx + hole.radius * Math.cos(angle), hole.cy + hole.radius * Math.sin(angle)]; });
      return extrudedRegionsFacets([[outline.concat([outline[0]]), circle.concat([circle[0]])]], 0, s.thickness, asciiFacet);
    }
    return polygonPrism(outline, 0, s.thickness);
  }

  function standFootGeometry(s, layout) {
    return standBaseFacets(0, 0, standBaseSpec(layout.width, s.thickness), asciiFacet);
  }

  function layoutFor(s, hasAccessory) {
    const dims = shapeDimensions(s), margin = Math.max(2.5, Math.min(dims.width, dims.height) * .05);
    const bottomKeepout = s.shape === 'standee' ? standInsertKeepout(dims.width, s.thickness) : 0;
    const safeBottom = margin + bottomKeepout;
    const bandHeight = hasAccessory ? bandHeightFor(s) : 0;
    const gap = hasAccessory ? 3 : 0, holeClearance = s.shape === 'keychain' ? keyringHoleSpec(dims.width, dims.height, s.holePosition).topKeepout : 0;
    const usableHeight = dims.height - safeBottom - margin - holeClearance;
    const whiteSize = s.whiteSize, qrSize = s.qrSize;
    const whiteX = (dims.width - whiteSize) / 2;
    const row = s.iconPosition.split('-')[0];
    const whiteY = !hasAccessory ? safeBottom + (usableHeight - whiteSize) / 2 : row === 'below' ? safeBottom + bandHeight + gap : safeBottom;
    const bandY = row === 'below' ? safeBottom : whiteY + whiteSize + gap;
    return { width: dims.width, height: dims.height, margin, bottomKeepout, safeBottom, whiteX, whiteY, whiteSize, qrX: whiteX + s.qrMargin, qrY: whiteY + s.qrMargin, qrSize, module: qrSize / currentMatrix.count, bandY, bandHeight };
  }

  function textSizing(s, maxWidth) {
    const metrics = textMetrics(s.text, s.textFont);
    const scaleX = Math.min(s.textSize, maxWidth / Math.max(0.18, metrics.widthEm));
    const scaleY = s.textPosition === 'after-icon' && s.icon !== 'none' ? s.textSize : scaleX;
    return { scaleX, scaleY, width: metrics.widthEm * scaleX };
  }

  function pairStart(s, layout, pairWidth) {
    const col = s.iconPosition.split('-')[1];
    return col === 'left' ? layout.margin : col === 'right' ? layout.width - layout.margin - pairWidth : (layout.width - pairWidth) / 2;
  }

  function accessoryPosition(s, layout) {
    let x;
    if (s.text && s.textPosition === 'after-icon') {
      const maxWidth = layout.width - 2 * layout.margin - 14;
      x = pairStart(s, layout, 14 + textSizing(s, maxWidth).width);
    } else x = pairStart(s, layout, 11);
    const y = layout.bandY + (s.textPosition === 'after-icon' && s.text ? (layout.bandHeight - 11) / 2 : s.text ? s.textSize + 2 : 0);
    return { x, y };
  }

  function textPosition(s, layout) {
    const align = s.textPosition === 'next-left' ? 'left' : s.textPosition === 'next-right' ? 'right' : 'center';
    if (s.textPosition === 'after-icon' && s.icon !== 'none') {
      const maxWidth = layout.width - 2 * layout.margin - 14;
      return { x: pairStart(s, layout, 14 + textSizing(s, maxWidth).width) + 14, y: layout.bandY + (layout.bandHeight - s.textSize) / 2, width: maxWidth, align: 'left' };
    }
    return { x: layout.margin, y: layout.bandY, width: layout.width - layout.margin * 2, align };
  }

  function qrGeometry(matrix, layout, s) {
    const whiteHeight = s.whiteThickness, qrZ = s.thickness + whiteHeight;
    let out = cuboid(layout.whiteX, layout.whiteY, s.thickness, layout.whiteSize, layout.whiteSize, whiteHeight);
    if (s.mode === 'recessed') {
      const right = layout.whiteX + layout.whiteSize, top = layout.whiteY + layout.whiteSize;
      out += cuboid(layout.whiteX, layout.whiteY, qrZ, layout.whiteSize, layout.qrY - layout.whiteY, s.depth);
      out += cuboid(layout.whiteX, layout.qrY + layout.qrSize, qrZ, layout.whiteSize, top - layout.qrY - layout.qrSize, s.depth);
      out += cuboid(layout.whiteX, layout.qrY, qrZ, layout.qrX - layout.whiteX, layout.qrSize, s.depth);
      out += cuboid(layout.qrX + layout.qrSize, layout.qrY, qrZ, right - layout.qrX - layout.qrSize, layout.qrSize, s.depth);
    }
    matrix.forEach((row, r) => row.forEach((dark, c) => { const visible = s.mode === 'raised' ? dark : !dark; if (visible) out += cuboid(layout.qrX + c * layout.module, layout.qrY + (matrix.length - 1 - r) * layout.module, qrZ, layout.module, layout.module, s.depth); }));
    return out;
  }

  function textGeometry(text, x, y, maxWidth, z, height, size, align = 'center', fontFamily = 'Arial', preserveHeight = false) {
    if (!text) return '';
    const metrics = textMetrics(text, fontFamily);
    const scaleX = Math.min(size, maxWidth / Math.max(0.18, metrics.widthEm));
    const scaleY = preserveHeight ? size : scaleX;
    const total = metrics.widthEm * scaleX;
    const start = align === 'left' ? x : align === 'right' ? x + maxWidth - total : x + (maxWidth - total) / 2;
    const centerY = y + scaleY / 2;
    let out = '';
    let cursor = start;
    [...text].forEach((char, i) => {
      glyphShapes(char, fontFamily).forEach((shape) => {
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
      const positions = geometry.getAttribute('position'), indices = geometry.getIndex();
      const vertex = (index) => {
        const pointIndex = indices ? indices.getX(index) : index;
        return [cursor + metrics.advances[i] * scaleX / 2 + positions.getX(pointIndex) * scaleX, centerY + positions.getY(pointIndex) * scaleY, z + positions.getZ(pointIndex)];
      };
      const count = indices ? indices.count : positions.count;
      for (let v = 0; v < count; v += 3) out += asciiFacet(vertex(v), vertex(v + 1), vertex(v + 2));
      geometry.dispose();
      });
      cursor += (metrics.advances[i] + (i < metrics.advances.length - 1 ? TEXT_TRACKING : 0)) * scaleX;
    });
    return out;
  }

  function iconGeometry(icon, x, y, size, z, height) {
    if (icon === 'none') return '';
    return extrudedRegionsFacets(iconBadgeRegions(icon, x, y, size), z, height, asciiFacet);
  }

  function buildPlateStl(qrData) {
    const s = settings(), layout = layoutFor(s, Boolean(s.icon !== 'none' || s.text)); let facets = baseGeometry(s, layout) + qrGeometry(qrData.matrix, layout, s); const topZ = s.thickness;
    if (s.icon !== 'none') { const p = accessoryPosition(s, layout); facets += iconGeometry(s.icon, p.x, p.y, 11, topZ, s.iconHeight); }
    if (s.text) { const p = textPosition(s, layout); facets += textGeometry(s.text, p.x, p.y, p.width, topZ, s.textHeight, s.textSize, p.align, s.textFont, s.textPosition === 'after-icon' && s.icon !== 'none'); }
    return `solid qr_plate_${s.shape}\n${facets}endsolid qr_plate_${s.shape}\n`;
  }

  function buildStandFootStl() {
    const s = settings(), layout = layoutFor(s, Boolean(s.icon !== 'none' || s.text));
    return `solid standee_slot_base\n${standFootGeometry(s, layout)}endsolid standee_slot_base\n`;
  }

  function download(contents, filename, mime) { const blob = new Blob([contents], { type: mime }), url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function makeFileName() { try { return (new URL(currentUrl).hostname || 'qr-plate').replace(/[^a-z0-9.-]/gi, '-').replace(/\.+/g, '-').toLowerCase(); } catch { return 'qr-plate'; } }

  function generate(event) {
    event?.preventDefault(); error.textContent = '';
    try { currentUrl = normaliseUrl(input.value); currentMatrix = makeMatrix(currentUrl); renderPreview(currentMatrix); stlButton.disabled = maxWhiteFor(settings()) < 16; svgButton.disabled = false; status.innerHTML = `<i></i> ${stlButton.disabled ? '尺寸不足' : 'READY TO PRINT'}`; status.style.color = stlButton.disabled ? '#c75b42' : '#5d9272'; }
    catch (err) { currentMatrix = null; stlButton.disabled = true; svgButton.disabled = true; error.textContent = err.message || '無法建立 QR Code，請檢查網址。'; status.innerHTML = '<i></i> CHECK INPUT'; status.style.color = '#c75b42'; }
  }

  shapeButtons.forEach((button) => button.addEventListener('click', () => { shapeInput.value = button.dataset.shape; updateReadouts(); }));
  input.addEventListener('input', () => { clearTimeout(urlTimer); urlTimer = setTimeout(() => generate(), 220); });
  textInput.addEventListener('input', () => { textInput.value = textInput.value.replace(/[^\x20-\x7E]/g, '').slice(0, 18); updateReadouts(); });
  [widthInput, heightInput, whiteSizeInput, whiteThicknessInput, qrSizeInput, qrMarginInput, thicknessInput, modeInput, depthInput, iconInput, iconPositionInput, iconHeightInput, textPositionInput, textFontInput, textSizeInput, textHeightInput].forEach((control) => control.addEventListener('input', updateReadouts));
  [modeInput, iconInput, iconPositionInput, textPositionInput, textFontInput, holePositionInput].forEach((control) => control.addEventListener('change', updateReadouts));
  form.addEventListener('submit', generate);
  stlButton.addEventListener('click', () => {
    if (!currentMatrix) return;
    const name = makeFileName();
    if (settings().shape === 'standee') {
      const archive = createZip([
        { name: `${name}-standee-plaque.stl`, contents: buildPlateStl(currentMatrix) },
        { name: `${name}-standee-slot-base.stl`, contents: buildStandFootStl() },
      ]);
      download(archive, `${name}-standee-2parts.zip`, 'application/zip');
    } else download(buildPlateStl(currentMatrix), `${name}-${settings().shape}-qr-plate.stl`, 'model/stl');
  });
  svgButton.addEventListener('click', () => currentMatrix && download(qrSvg.outerHTML, `${makeFileName()}-qr.svg`, 'image/svg+xml'));
  viewReset.addEventListener('click', () => preview?.reset());
  viewZoomOut.addEventListener('click', () => preview?.zoomBy(-.1));
  viewZoomIn.addEventListener('click', () => preview?.zoomBy(.1));
  updateReadouts(); window.addEventListener('load', () => generate());
})();
