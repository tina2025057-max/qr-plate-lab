import * as THREE from './vendor/three.module.js';

// Polygon clipping returns a MultiPolygon: each region has an exterior ring
// followed by zero or more holes (the pictogram cutouts).
export function regionToShape(region) {
  const vertices = (ring) => ring.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y));
  const shape = new THREE.Shape(vertices(region[0]));
  for (const ring of region.slice(1)) shape.holes.push(new THREE.Path(vertices(ring)));
  return shape;
}

export function extrudedRegionsFacets(regions, z, height, facet) {
  let out = '';
  for (const region of regions) {
    const geometry = new THREE.ExtrudeGeometry(regionToShape(region), { depth: height, steps: 1, bevelEnabled: false });
    const position = geometry.getAttribute('position');
    const index = geometry.getIndex();
    const point = (i) => [position.getX(i), position.getY(i), position.getZ(i) + z];
    for (let i = 0, count = index ? index.count : position.count; i < count; i += 3) {
      const a = point(index ? index.getX(i) : i);
      const b = point(index ? index.getX(i + 1) : i + 1);
      const c = point(index ? index.getX(i + 2) : i + 2);
      out += facet(a, b, c);
    }
    geometry.dispose();
  }
  return out;
}

// Shared print-layout dimensions for the two-piece stand and inset keyring hole.

export function standBaseSpec(plateWidth, plateThickness) {
  const width = plateWidth;
  const depth = Math.max(28, plateWidth * 0.8);
  const height = Math.max(8, plateThickness * 2.5);
  const floor = 2;
  const slotWidth = plateThickness + 0.5; // 0.5 mm total FDM assembly clearance.
  const leanAngleDeg = 10;
  const leanRadians = leanAngleDeg * Math.PI / 180;
  const slotOpeningWidth = slotWidth / Math.cos(leanRadians);
  const slotY = depth * 0.36 - slotOpeningWidth / 2;
  const slotShift = (height - floor) * Math.tan(leanRadians);
  const cornerRadius = Math.min(4, width / 8, slotY / 3, (depth - slotY - slotOpeningWidth - slotShift) / 3);
  return { width, depth, height, floor, slotWidth, slotOpeningWidth, slotY, leanAngleDeg, slotShift, cornerRadius, gap: 12 };
}

// The plate slides down to the slot floor; keep artwork 2 mm above the base rim.
export function standInsertKeepout(plateWidth, plateThickness) {
  const base = standBaseSpec(plateWidth, plateThickness);
  return base.height - base.floor + 2;
}

export function keyringHoleSpec(width, height, position = 'center') {
  const inset = 5;
  const cx = position === 'left' ? inset : position === 'right' ? width - inset : width / 2;
  return { cx, cy: height - 5, radius: 2.5, topKeepout: 9 };
}

function quad(a, b, c, d, facet) {
  return facet(a, b, c) + facet(a, c, d);
}

export function standBaseContours(spec, segments = 8) {
  const { width: w, depth: d, slotY, slotOpeningWidth, slotShift, cornerRadius: r } = spec;
  const slotEnd = slotY + slotOpeningWidth;
  const arc = (cx, cy, start, end) => Array.from({ length: segments }, (_, index) => {
    const angle = start + (end - start) * (index + 1) / segments;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });
  const front = [[r, 0], [w - r, 0], ...arc(w - r, r, -Math.PI / 2, 0), [w, slotY], [0, slotY], [0, r], ...arc(r, r, Math.PI, Math.PI * 1.5).slice(0, -1)];
  const rear = [[0, slotEnd], [w, slotEnd], [w, d - r], ...arc(w - r, d - r, 0, Math.PI / 2), [r, d], ...arc(r, d - r, Math.PI / 2, Math.PI)];
  const frontTop = front.map(([x, py]) => [x, Math.abs(py - slotY) < 1e-8 ? py + slotShift : py]);
  const rearTop = rear.map(([x, py]) => [x, Math.abs(py - slotEnd) < 1e-8 ? py + slotShift : py]);
  const rightSlotIndex = front.findIndex(([px, py]) => px === w && py === slotY);
  const full = [...front.slice(0, rightSlotIndex + 1), ...rear.slice(1), rear[0], ...front.slice(rightSlotIndex + 1)];
  return { full, front, rear, frontTop, rearTop };
}

export function standBaseTriangles(x, y, spec) {
  const { height, floor, slotOpeningWidth, slotY } = spec;
  const { full, front, rear, frontTop, rearTop } = standBaseContours(spec);
  const vertex = ([px, py], z) => [x + px, y + py, z];
  const triangles = [];
  const facet = (a, b, c) => { triangles.push([a, b, c]); };
  const quad = (a, b, c, d) => { facet(a, b, c); facet(a, c, d); };
  const cap = (outline, z, upward) => {
    const center = outline.reduce(([sx, sy], [px, py]) => [sx + px, sy + py], [0, 0]).map((sum) => sum / outline.length);
    outline.forEach((point, i) => {
      const next = outline[(i + 1) % outline.length];
      upward ? facet(vertex(center, z), vertex(point, z), vertex(next, z)) : facet(vertex(center, z), vertex(next, z), vertex(point, z));
    });
  };
  const walls = (outline, bottom, top, topZ) => outline.forEach((point, i) => {
    const next = outline[(i + 1) % outline.length];
    quad(vertex(point, bottom), vertex(next, bottom), vertex(top[(i + 1) % top.length], topZ), vertex(top[i], topZ));
  });
  const slotEnd = slotY + slotOpeningWidth;
  quad(vertex([0, slotY], floor), vertex([spec.width, slotY], floor), vertex([spec.width, slotEnd], floor), vertex([0, slotEnd], floor));
  cap(full, 0, false);
  walls(full, 0, full, floor);
  walls(front, floor, frontTop, height);
  walls(rear, floor, rearTop, height);
  cap(frontTop, height, true);
  cap(rearTop, height, true);
  return triangles;
}

export function standBaseFacets(x, y, spec, facet) {
  return standBaseTriangles(x, y, spec).map((triangle) => facet(...triangle)).join('');
}
