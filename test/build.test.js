import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';

import { builder, FACE, tile } from '../src/render/build.js';

/** Every position in a geometry, as [x, y, z] triples. */
function points(geometry) {
  const p = geometry.attributes.position;
  return Array.from({ length: p.count }, (_, i) => [p.getX(i), p.getY(i), p.getZ(i)]);
}

/** The world-space normal of the first triangle, worked out from the winding
 *  rather than read off the attribute — which is the only way to catch a face
 *  that was wound inside out. */
function faceNormals(geometry) {
  const index = geometry.index.array;
  const p = geometry.attributes.position;
  const out = [];
  for (let i = 0; i < index.length; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, index[i]);
    const b = new THREE.Vector3().fromBufferAttribute(p, index[i + 1]);
    const c = new THREE.Vector3().fromBufferAttribute(p, index[i + 2]);
    out.push(b.sub(a).cross(c.sub(a)).normalize());
  }
  return out;
}

describe('the box builder', () => {
  it('builds a box out of six quads, and no more', () => {
    const geometry = builder().box(0, 0, 0, 2, 2, 2).geometry();
    assert.equal(geometry.attributes.position.count, 24);
    assert.equal(geometry.index.count, 36);
  });

  it('puts the box where it was asked to, at the size it was asked for', () => {
    const geometry = builder().box(3, 1, -2, 2, 4, 6).geometry();
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox;
    assert.deepEqual([min.x, min.y, min.z], [2, -1, -5]);
    assert.deepEqual([max.x, max.y, max.z], [4, 3, 1]);
  });

  /** A face wound the wrong way round is invisible from outside and solid
   *  from within — a railing you can only see from over the edge. */
  it('winds every face outwards, and says so in the normals', () => {
    const geometry = builder().box(0, 0, 0, 2, 2, 2).geometry();
    const normal = geometry.attributes.normal;
    for (const [i, wound] of faceNormals(geometry).entries()) {
      const declared = new THREE.Vector3().fromBufferAttribute(normal, geometry.index.array[i * 3]);
      assert.ok(wound.dot(declared) > 0.99, `triangle ${i} is wound inside out`);
    }
  });

  it('leaves out the faces it is told to', () => {
    const open = builder().box(0, 0, 0, 1, 1, 1, 63 & ~FACE.py).geometry();
    assert.equal(open.attributes.position.count, 20);
    assert.ok(points(open).every(([, y]) => y === -0.5 || y === 0.5), 'the box lost a corner');
    for (const n of faceNormals(open)) assert.ok(n.y < 0.99, 'the top face is still there');
  });

  it('merges every box into one buffer, which is the whole point of it', () => {
    const fence = builder();
    for (let z = 0; z < 8; z++) fence.box(0, 0.5, z * 2, 0.2, 1, 0.2);
    const geometry = fence.geometry();
    assert.equal(geometry.attributes.position.count, 8 * 24);
    assert.equal(geometry.groups.length, 0, 'one draw, one material');
  });

  it('bakes the tiling into the uvs, so one texture serves every deck', () => {
    const geometry = tile(new THREE.PlaneGeometry(12, 30), 6, 15);
    const uv = geometry.attributes.uv;
    let u = 0;
    let v = 0;
    for (let i = 0; i < uv.count; i++) {
      u = Math.max(u, uv.getX(i));
      v = Math.max(v, uv.getY(i));
    }
    assert.equal(u, 6, 'the plate would be stretched across the deck instead of tiled');
    assert.equal(v, 15);
  });
});
