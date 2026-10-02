import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plane } from '../src/gpu/geometry.js';
import { builder, FACE, tile } from '../src/render/build.js';

/** Every position in a geometry, as [x, y, z] triples. */
function points(geometry) {
  const p = geometry.position;
  return Array.from({ length: geometry.count }, (_, i) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]);
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (a) => a.map((v) => v / Math.hypot(...a));

/** The world-space normal of the first triangle, worked out from the winding
 *  rather than read off the attribute — which is the only way to catch a face
 *  that was wound inside out. */
function faceNormals(geometry) {
  const index = geometry.index;
  const p = points(geometry);
  const out = [];
  for (let i = 0; i < index.length; i += 3) {
    const [a, b, c] = [p[index[i]], p[index[i + 1]], p[index[i + 2]]];
    out.push(normalize(cross(sub(b, a), sub(c, a))));
  }
  return out;
}

describe('the box builder', () => {
  it('builds a box out of six quads, and no more', () => {
    const geometry = builder().box(0, 0, 0, 2, 2, 2).geometry();
    assert.equal(geometry.count, 24);
    assert.equal(geometry.index.length, 36);
  });

  it('puts the box where it was asked to, at the size it was asked for', () => {
    const p = points(builder().box(3, 1, -2, 2, 4, 6).geometry());
    const min = [0, 1, 2].map((k) => Math.min(...p.map((v) => v[k])));
    const max = [0, 1, 2].map((k) => Math.max(...p.map((v) => v[k])));
    assert.deepEqual(min, [2, -1, -5]);
    assert.deepEqual(max, [4, 3, 1]);
  });

  /** A face wound the wrong way round is invisible from outside and solid
   *  from within — a railing you can only see from over the edge. */
  it('winds every face outwards, and says so in the normals', () => {
    const geometry = builder().box(0, 0, 0, 2, 2, 2).geometry();
    const n = geometry.normal;
    for (const [i, wound] of faceNormals(geometry).entries()) {
      const v = geometry.index[i * 3];
      const declared = [n[v * 3], n[v * 3 + 1], n[v * 3 + 2]];
      assert.ok(dot(wound, declared) > 0.99, `triangle ${i} is wound inside out`);
    }
  });

  it('leaves out the faces it is told to', () => {
    const open = builder().box(0, 0, 0, 1, 1, 1, 63 & ~FACE.py).geometry();
    assert.equal(open.count, 20);
    assert.ok(points(open).every(([, y]) => y === -0.5 || y === 0.5), 'the box lost a corner');
    for (const n of faceNormals(open)) assert.ok(n[1] < 0.99, 'the top face is still there');
  });

  it('merges every box into one buffer, which is the whole point of it', () => {
    const fence = builder();
    for (let z = 0; z < 8; z++) fence.box(0, 0.5, z * 2, 0.2, 1, 0.2);
    const geometry = fence.geometry();
    assert.equal(geometry.count, 8 * 24);
    assert.equal(geometry.index.length, 8 * 36, 'one draw, one material');
  });

  it('bakes the tiling into the uvs, so one texture serves every deck', () => {
    const geometry = tile(plane(12, 30), 6, 15);
    const uv = geometry.uv;
    let u = 0;
    let v = 0;
    for (let i = 0; i < uv.length; i += 2) {
      u = Math.max(u, uv[i]);
      v = Math.max(v, uv[i + 1]);
    }
    assert.equal(u, 6, 'the plate would be stretched across the deck instead of tiled');
    assert.equal(v, 15);
  });
});
