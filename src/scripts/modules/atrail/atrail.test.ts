const assert = require('assert');
import * as _ from 'lodash';
import * as THREE from 'three';
import { OBJLoader } from '../../io/read_obj';
import { CylinderModel } from '../../models/cylinder_model';
import { PrimePos } from '../../models/cylinder';
import { Graph, HalfEdge } from '../../models/graph_model';
import { NucleotideModel } from '../../models/nucleotide_model';
import { ATrail, cylindersToNucleotides, wiresToCylinders } from './atrail';
import { ATrailParameters } from './atrail_menu';
const x3 = require('../../../test/test_shapes/3x3.obj');
const tet = require('../../../test/test_shapes/tetra_dubs.obj');
const x4 = require('../../../test/test_shapes/4x4.obj');
const plane = require('../../../test/test_shapes/plane.obj');

function getParams(): ATrailParameters {
  return {
    scaffoldOffset: 0,
    scaffoldStart: 0,
    checkerBoard: false,
    midpointNicking: false,
    maxTime: 10000,
  };
}

describe('Atrail-routing', function () {
  const graphs = [
    ['tetrahedron', tet],
    ['4x4', x4],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });

  let atrail: ATrail;
  let graph: Graph;
  let trail: HalfEdge[];

  graphs.forEach(function (g: [string, Graph]) {
    it(`Should be directed: ${g[0]}`, function () {
      graph = g[1];
      atrail = new ATrail(graph);
      trail = atrail.findATrail();

      for (let i = 1; i < trail.length; i++) {
        assert.notEqual(trail[i - 1].vertex, trail[i].vertex);
      }
    });

    it(`Should span all edges once: ${g[0]}`, function () {
      graph = g[1];
      atrail = new ATrail(graph);
      trail = atrail.findATrail();

      const visited = new Set();

      for (const he of trail) {
        assert.equal(visited.has(he.edge), false);
        visited.add(he.edge);
      }

      for (const e of atrail.graph.getEdges()) {
        assert.equal(visited.has(e), true);
      }
    });

    it(`Should start where it ends: ${g[0]}`, function () {
      graph = g[1];
      atrail = new ATrail(graph);
      trail = atrail.findATrail();

      assert.equal(
        trail[0].twin.vertex == trail[trail.length - 1].vertex,
        true,
      );
    });

    it(`Should be non-crossing: ${g[0]}`, function () {
      graph = g[1];
      atrail = new ATrail(graph);
      trail = atrail.findATrail();

      for (let i = 0; i < trail.length; i++) {
        const incoming = trail[i];
        const outoing = trail[(i + 1) % trail.length].twin;

        const neighbours = incoming.vertex.getTopoAdjacentHalfEdges();
        const idxIn = neighbours.indexOf(incoming);
        const idxOut = neighbours.indexOf(outoing);

        const isRight = idxIn == (idxOut + 1) % neighbours.length;
        const isLeft =
          idxIn == (idxOut + neighbours.length - 1) % neighbours.length;

        assert.equal(isRight || isLeft, true);
      }
    });
  });

  it(`Should not have an atrail: 3x3`, function () {
    graph = new OBJLoader(new THREE.LoadingManager()).parse(x3);
    try {
      atrail = new ATrail(graph);
      trail = atrail.findATrail();
      assert.equal(false, true);
    } catch {}
  });
});

describe('Atrail Cylinder Model', function () {
  const graphs = [
    ['tetrahedron', tet],
    ['4x4', x4],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });
  const atrails = graphs.map((g) => {
    const atrail = new ATrail(g[1]);
    atrail.findATrail();
    return [g[0], atrail];
  });

  let cm: CylinderModel;

  atrails.forEach(function (g: [string, ATrail]) {
    it(`Should throw error because of small scale: ${g[0]}`, function () {
      const params = getParams();
      params.scale = 100;
      try {
        cm = wiresToCylinders(g[1], params);
        assert.equal(false, true);
      } catch {}
    });
  });

  atrails.forEach(function (g: [string, ATrail]) {
    it(`All cylinders should be fully connected: ${g[0]}`, function () {
      const params = getParams();
      params.scale = 0.1;
      cm = wiresToCylinders(g[1], params);

      for (const c of cm.cylinders) {
        for (const n of _.values(c.neighbours)) {
          assert.equal(!!n, true);
        }
      }
    });
  });

  atrails.forEach(function (g: [string, ATrail]) {
    it(`All primes should be 1-to-1 connected: ${g[0]}`, function () {
      const params = getParams();
      params.scale = 0.1;
      cm = wiresToCylinders(g[1], params);

      for (const c of cm.cylinders) {
        for (const prime of Object.values(PrimePos)) {
          const n = c.neighbours[prime];
          const prime2 = n[1];

          assert.equal(n[0].neighbours[prime2][0] == c, true);
        }
      }
    });
  });
});

describe('Atrail Nucleotide Model', function () {
  const graphs = [
    ['tetrahedron', tet],
    ['4x4', x4],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });
  const atrails = graphs.map((g) => {
    const atrail = new ATrail(g[1]);
    atrail.findATrail();
    return [g[0], atrail];
  });

  let cm: CylinderModel;
  let nm: NucleotideModel;

  atrails.forEach(function (g: [string, ATrail]) {
    it(`Should generate nucleotides: ${g[0]}`, function () {
      const params = getParams();
      params.scale = 0.5;
      params.scaffoldName = 'none';

      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      assert.equal(nm.getNucleotides().length > 0, true);
    });
  });

  atrails.forEach(function (g: [string, ATrail]) {
    it(`Min strand overlap should be above 5: ${g[0]}`, function () {
      const params = getParams();
      params.scale = 0.2;
      params.scaffoldName = 'none';
      params.addNicks = true;
      params.minStrandLength = 5;
      params.maxStrandLength = 100;

      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      const scaffold = nm.getScaffold().nucleotides;
      let overlap = 0;
      for (let i = 0; i < scaffold.length; i++) {
        const nuc = scaffold[i];
        const pair = nuc.pair;
        if (!pair) {
          overlap = 0;
          continue;
        }
        if (!pair.next) {
          assert.equal(overlap >= 5, true);
          overlap = 0;
        }
        overlap++;
      }
    });
  });

  atrails.forEach(function (g: [string, ATrail]) {
    it(`Max strand length should be under 100: ${g[0]}`, function () {
      const params = getParams();
      params.scale = 0.2;
      params.scaffoldName = 'none';
      params.addNicks = true;
      params.minStrandLength = 5;
      params.maxStrandLength = 100;

      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      for (const s of nm.strands) {
        if (s.isScaffold) continue;
        assert.equal(s.nucleotides.length <= 100, true);
      }
    });
  });

  atrails.forEach(function (g: [string, ATrail]) {
    it(`Primary structure should be complementary: ${g[0]}`, function () {
      const params = getParams();
      params.scale = 0.2;
      params.scaffoldName = 'random';

      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      const complement: Record<string, string> = {
        A: 'T',
        T: 'A',
        G: 'C',
        C: 'G',
      };

      for (const s of nm.strands) {
        for (const n of s.nucleotides) {
          if (!n.pair) continue;
          assert.equal(complement[n.base] == n.pair.base, true);
        }
      }
    });
  });
});
