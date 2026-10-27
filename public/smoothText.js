import * as THREE from './vendor/three.module.js';

export const TEXT_TRACKING = 0.035;
const EM = 256;
const THRESHOLD = 128;
const contourCache = new Map();

function pointKey(point) {
  return `${point[0].toFixed(3)},${point[1].toFixed(3)}`;
}

function crossing(a, b, start, end) {
  const delta = b - a;
  const t = delta ? THREE.MathUtils.clamp((THRESHOLD - a) / delta, 0, 1) : 0.5;
  return [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t];
}

function squaredDistanceToSegment(point, start, end) {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  if (!dx && !dy) return (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2;
  const t = THREE.MathUtils.clamp(((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  return (point[0] - start[0] - t * dx) ** 2 + (point[1] - start[1] - t * dy) ** 2;
}

function simplifyOpen(points, tolerance = 1) {
  if (points.length <= 2) return points;
  const keep = new Set([0, points.length - 1]);
  const stack = [[0, points.length - 1]];
  const limit = tolerance * tolerance;
  while (stack.length) {
    const [first, last] = stack.pop();
    let farthest = -1, farthestDistance = limit;
    for (let i = first + 1; i < last; i++) {
      const distance = squaredDistanceToSegment(points[i], points[first], points[last]);
      if (distance > farthestDistance) { farthest = i; farthestDistance = distance; }
    }
    if (farthest !== -1) {
      keep.add(farthest);
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return [...keep].sort((a, b) => a - b).map((index) => points[index]);
}

function simplifyClosed(points) {
  const ring = points.length > 1 && pointKey(points[0]) === pointKey(points.at(-1)) ? points.slice(0, -1) : points;
  if (ring.length < 4) return ring;
  let farthest = 1, farthestDistance = 0;
  for (let i = 1; i < ring.length; i++) {
    const distance = (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2;
    if (distance > farthestDistance) { farthest = i; farthestDistance = distance; }
  }
  const firstArc = simplifyOpen(ring.slice(0, farthest + 1));
  const secondArc = simplifyOpen([...ring.slice(farthest), ring[0]]);
  return [...firstArc.slice(0, -1), ...secondArc.slice(0, -1)];
}

function polygonArea(points) {
  return points.reduce((sum, point, i) => {
    const next = points[(i + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;
}

function contains(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function traceContours(alpha, width, height) {
  const segments = [];
  const add = (a, b) => segments.push([a, b]);
  for (let y = 0; y < height - 1; y++) for (let x = 0; x < width - 1; x++) {
    const tl = alpha[y * width + x], tr = alpha[y * width + x + 1];
    const br = alpha[(y + 1) * width + x + 1], bl = alpha[(y + 1) * width + x];
    const code = (tl >= THRESHOLD ? 1 : 0) | (tr >= THRESHOLD ? 2 : 0) | (br >= THRESHOLD ? 4 : 0) | (bl >= THRESHOLD ? 8 : 0);
    if (code === 0 || code === 15) continue;
    const edge = [
      crossing(tl, tr, [x, y], [x + 1, y]),
      crossing(tr, br, [x + 1, y], [x + 1, y + 1]),
      crossing(bl, br, [x, y + 1], [x + 1, y + 1]),
      crossing(tl, bl, [x, y], [x, y + 1]),
    ];
    const active = [];
    for (let side = 0; side < 4; side++) if (([tl, tr, br, bl][side] >= THRESHOLD) !== ([tr, br, bl, tl][side] >= THRESHOLD)) active.push(side);
    if (active.length === 2) add(edge[active[0]], edge[active[1]]);
    else if (active.length === 4) {
      const centerInside = (tl + tr + br + bl) / 4 >= THRESHOLD;
      if ((code === 5 && centerInside) || (code === 10 && !centerInside)) {
        add(edge[0], edge[1]); add(edge[2], edge[3]);
      } else {
        add(edge[0], edge[3]); add(edge[1], edge[2]);
      }
    }
  }

  const adjacent = new Map();
  segments.forEach(([a, b], index) => {
    for (const point of [a, b]) {
      const key = pointKey(point);
      if (!adjacent.has(key)) adjacent.set(key, []);
      adjacent.get(key).push(index);
    }
  });
  const used = new Uint8Array(segments.length), contours = [];
  for (let start = 0; start < segments.length; start++) {
    if (used[start]) continue;
    const [a, b] = segments[start], path = [a, b];
    used[start] = 1;
    let current = b, guard = 0;
    while (pointKey(current) !== pointKey(a) && guard++ <= segments.length) {
      const next = adjacent.get(pointKey(current))?.find((index) => !used[index]);
      if (next === undefined) break;
      used[next] = 1;
      const segment = segments[next];
      current = pointKey(segment[0]) === pointKey(current) ? segment[1] : segment[0];
      path.push(current);
    }
    if (pointKey(path.at(-1)) !== pointKey(a)) continue;
    const simplified = simplifyClosed(path);
    if (simplified.length >= 3 && Math.abs(polygonArea(simplified)) > 2) contours.push(simplified);
  }
  return contours;
}

function makePath(points, asShape = false) {
  const path = asShape ? new THREE.Shape() : new THREE.Path();
  const x = (points[0][0] - EM / 2) / EM;
  const y = (EM / 2 - points[0][1]) / EM;
  path.moveTo(x, y);
  for (let i = 1; i < points.length; i++) path.lineTo((points[i][0] - EM / 2) / EM, (EM / 2 - points[i][1]) / EM);
  path.closePath();
  return path;
}

export function glyphShapes(char, fontFamily = 'Arial') {
  const key = `${fontFamily}\0${char}`;
  if (contourCache.has(key)) return contourCache.get(key).shapes;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = EM;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, EM, EM);
  ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 220px "${fontFamily.replace(/["\\]/g, '')}"`;
  const advance = Math.max(ctx.measureText(char).width / EM, 0.18);
  ctx.fillText(char, EM / 2, EM / 2, EM - 6);
  const alpha = new Uint8Array(EM * EM);
  const image = ctx.getImageData(0, 0, EM, EM).data;
  for (let i = 0; i < alpha.length; i++) alpha[i] = image[i * 4 + 3];

  const contours = traceContours(alpha, EM, EM).map((points) => ({ points, area: Math.abs(polygonArea(points)), depth: 0 }));
  contours.forEach((contour) => { contour.depth = contours.filter((other) => other !== contour && other.area > contour.area && contains(contour.points[0], other.points)).length; });
  const shapes = contours.filter((contour) => contour.depth % 2 === 0).map((outer) => {
    const shape = makePath(outer.points, true);
    contours.filter((hole) => hole.depth === outer.depth + 1 && hole.area < outer.area && contains(hole.points[0], outer.points)).forEach((hole) => shape.holes.push(makePath(hole.points)));
    return shape;
  });
  contourCache.set(key, { shapes, advance });
  return shapes;
}

export function glyphAdvance(char, fontFamily = 'Arial') {
  glyphShapes(char, fontFamily);
  return contourCache.get(`${fontFamily}\0${char}`).advance;
}

export function textMetrics(text, fontFamily = 'Arial') {
  const advances = [...text].map((char) => glyphAdvance(char, fontFamily));
  const tracking = Math.max(0, advances.length - 1) * TEXT_TRACKING;
  return { advances, widthEm: advances.reduce((sum, advance) => sum + advance, 0) + tracking };
}
