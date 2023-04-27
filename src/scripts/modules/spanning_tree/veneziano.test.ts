const assert = require('assert');
import * as _ from 'lodash';
import * as THREE from 'three';
import { OBJLoader } from '../../io/read_obj';
import { CylinderModel, PrimePos } from '../../models/cylinder_model';
import { Graph, HalfEdge } from '../../models/graph';
import { NucleotideModel } from '../../models/nucleotide_model';
import { STParameters } from './spanning_tree_menu';
import {
  cylindersToNucleotides,
  Veneziano,
  wiresToCylinders,
} from './veneziano';
const tet = require('../../../test/test_shapes/tetra_dubs.obj');
const x3 = require('../../../test/test_shapes/3x3.obj');
const plane = require('../../../test/test_shapes/plane.obj');

function getParams(): STParameters {
  return {
    scaffoldOffset: 0,
    scaffoldStart: 0,
  };
}

describe('Spanning tree-routing', function () {
  const graphs = [
    ['tetrahedron', tet],
    ['3x3', x3],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });

  let st: Veneziano;
  let graph: Graph;
  let trail: HalfEdge[];

  graphs.forEach(function (g: [string, Graph]) {
    it(`Should start where it ends: ${g[0]}`, function () {
      graph = g[1];
      st = new Veneziano(graph);
      trail = st.trail;

      const first = trail[0];
      const last = trail[trail.length - 1];

      if (!st.st.has(last.edge))
        assert.equal(first.twin.vertex == last.twin.vertex, true);
      else assert.equal(first.twin.vertex == last.vertex, true);
    });

    it(`Should span all edges twice: ${g[0]}`, function () {
      graph = g[1];
      st = new Veneziano(graph);
      trail = st.trail;
    });
  });
});

describe('Spanning Tree Cylinder Model', function () {
  const graphs = [
    ['tetrahedron', tet],
    ['3x3', x3],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });
  const sts = graphs.map((g) => {
    const st = new Veneziano(g[1]);
    return [g[0], st];
  });

  let cm: CylinderModel;

  sts.forEach(function (g: [string, Veneziano]) {
    it(`Should throw error because of small scale: ${g[0]}`, function () {
      const params = getParams();
      params.scale = 100;

      try {
        cm = wiresToCylinders(g[1], params);
        assert.equal(false, true);
      } catch {}
    });
  });

  sts.forEach(function (g: [string, Veneziano]) {
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

  sts.forEach(function (g: [string, Veneziano]) {
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

describe('Spanning Tree Nucleotide Model', function () {
  const graphs = [
    ['tetrahedron', tet],
    ['3x3', x3],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });
  const sts = graphs.map((g) => {
    const st = new Veneziano(g[1]);
    return [g[0], st];
  });

  let cm: CylinderModel;
  let nm: NucleotideModel;

  sts.forEach(function (g: [string, Veneziano]) {
    it(`Should generate nucleotides: ${g[0]}`, function () {
      const params = getParams();
      params.scale = 0.3;
      params.scaffoldName = 'none';

      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      assert.equal(nm.getNucleotides().length > 0, true);
    });
  });

  sts.forEach(function (g: [string, Veneziano]) {
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

  sts.forEach(function (g: [string, Veneziano]) {
    it(`Staple lengths should be 20, 22, 31, 32, 42, 52, or 78 ${g[0]}`, function () {
      const params = getParams();
      params.scale = 0.2;
      params.scaffoldName = 'random';
      params.addNicks = true;

      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      const options = new Set([20, 22, 31, 32, 42, 52, 78]);

      for (const s of nm.strands) {
        if (s.isScaffold) continue;
        assert.equal(options.has(s.length()), true);
      }
    });
  });
});
