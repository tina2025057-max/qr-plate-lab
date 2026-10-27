import './vendor/polygon-clipping.umd.mjs';

// The same printable 2D outlines are used by the STL writer and the 3D preview.
function stroke(a, b, width) {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length * width / 2, ny = dx / length * width / 2;
  return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
}

export function iconMarkPolygons(icon, x, y, size) {
  const cx = x + size / 2, cy = y + size / 2, scale = size / 11;
  const place = ([px, py]) => [cx + px * scale, cy + py * scale];
  if (icon === 'facebook') {
    // A recognizable lowercase f: long stem, full crossbar, and upper hook.
    return [[[-1.05,-3.9],[0.85,-3.9],[0.85,-0.45],[2.25,-0.45],[2.5,1.05],[0.85,1.05],[0.85,2.05],[1.0,2.35],[1.3,2.5],[2.5,2.5],[2.5,4.0],[1.05,4.0],[-0.2,3.75],[-0.95,2.9],[-1.05,1.05],[-2.0,1.05],[-2.0,-0.45],[-1.05,-0.45]].map(place)];
  }
  if (icon === 'thumb') {
    const cuff = [[-4.05,-3.15],[-2.45,-3.15],[-2.45,0.85],[-4.05,0.85]];
    const hand = [[-2.05,-3.0],[2.35,-3.0],[2.9,-2.55],[3.55,0.2],[3.3,0.9],[0.45,0.9],[1.1,3.4],[0.9,3.95],[0.3,3.95],[-2.05,0.9]];
    return [cuff.map(place), hand.map(place)];
  }
  if (icon === 'peace') {
    const palm = [[-2.15,-3.8],[1.8,-3.8],[2.55,-2.75],[2.55,-1.45],[3.3,-0.85],[3.05,-0.1],[2.35,0.0],[1.5,-0.65],[0.55,-0.15],[-1.9,-0.15],[-2.75,-1.0],[-2.75,-2.65]];
    const leftFinger = [[-2.0,-0.5],[-0.65,-0.3],[-1.95,3.75],[-2.5,4.05],[-3.15,3.8]];
    const rightFinger = [[0.05,-0.35],[1.35,-0.55],[3.05,3.55],[2.85,4.0],[2.2,4.05]];
    return [palm.map(place), leftFinger.map(place), rightFinger.map(place)];
  }
  if (icon === 'youtube') return [[[-1.45,-2.35],[-1.45,2.35],[2.65,0]].map(place)];
  if (icon !== 'globe') return [];

  const shapes = [], outer = 4.05, inner = 3.4;
  for (let i = 0; i < 32; i++) {
    const a = i * Math.PI / 16, b = (i + 1) * Math.PI / 16;
    shapes.push([[outer*Math.cos(a),outer*Math.sin(a)],[outer*Math.cos(b),outer*Math.sin(b)],[inner*Math.cos(b),inner*Math.sin(b)],[inner*Math.cos(a),inner*Math.sin(a)]].map(place));
  }
  for (const latitude of [-1.45, 0, 1.45]) {
    const half = Math.sqrt(inner * inner - latitude * latitude) - 0.12;
    shapes.push(stroke([-half,latitude],[half,latitude],0.6).map(place));
  }
  for (const sign of [-1, 1]) {
    for (let i = 0; i < 18; i++) {
      const a = i * Math.PI / 18, b = (i + 1) * Math.PI / 18;
      const point = (angle) => [sign * 1.6 * Math.sin(angle), inner * Math.cos(angle)];
      shapes.push(stroke(point(a),point(b),0.6).map(place));
    }
  }
  return shapes;
}

// Subtract the union of every pictogram stroke from a white circular badge.
// The resulting gaps expose the unmodified base plate underneath.
export function iconBadgeRegions(icon, x, y, size) {
  if (icon === 'none') return [];
  const cx = x + size / 2, cy = y + size / 2, radius = size / 2;
  const circle = [Array.from({ length: 64 }, (_, i) => {
    const angle = i * Math.PI * 2 / 64;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  })];
  circle[0].push([...circle[0][0]]);
  const marks = iconMarkPolygons(icon, x, y, size).map((polygon) => [[...polygon, [...polygon[0]]]]);
  const cutout = globalThis.polygonClipping.union(...marks);
  return globalThis.polygonClipping.difference(circle, cutout);
}
