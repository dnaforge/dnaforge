const assert = require('assert');
import * as _ from 'lodash';
import * as THREE from 'three';
import { OBJLoader } from '../../io/read_obj';
import { CylinderModel, PrimePos } from '../../models/cylinder_model';
import { Graph, HalfEdge } from '../../models/graph_model';
import { NucleotideModel } from '../../models/nucleotide_model';
import { MenuParameters } from '../../scene/menu';
import { setRandomPrimary } from '../../utils/primary_utils';
import {
  cylindersToNucleotides,
  CycleCover,
  wiresToCylinders,
} from './cycle_cover';
const tet = require('../../../test/test_shapes/tetra_dubs.obj');
const x3 = require('../../../test/test_shapes/3x3.obj');
const plane = require('../../../test/test_shapes/plane.obj');

describe('Cycle cover routing', function () {
  const graphs = [
    ['tetrahedron', tet],
    ['3x3', x3],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });

  let cc: CycleCover;
  let graph: Graph;
  let cycles: HalfEdge[][];

  graphs.forEach(function (g: [string, Graph]) {
    it(`Each cycle should by cyclical: ${g[0]}`, function () {
      graph = g[1];
      cc = new CycleCover(graph);
      cycles = cc.cycles;

      for (const c of cycles) {
        for (let i = 0; i < c.length; i++) {
          const start = c[0];
          const end = c[c.length - 1];

          assert.equal(start.vertex == end.twin.vertex, true);
        }
      }
    });
  });

  graphs.forEach(function (g: [string, Graph]) {
    it(`Each edge should be spanned twice: ${g[0]}`, function () {
      graph = g[1];
      cc = new CycleCover(graph);
      cycles = cc.cycles;

      const visited = new Map(
        cc.graph.edges.map((e) => {
          return [e, 0];
        }),
      );

      for (const c of cycles) {
        for (const he of c) {
          visited.set(he.edge, visited.get(he.edge) + 1);
        }
      }

      for (const e of graph.getEdges()) {
        assert.equal(visited.get(e) == 2, true);
      }
    });
  });
});

describe('Cycle Cover Cylinder Model', function () {
  const graphs = [
    ['tetrahedron', tet],
    ['3x3', x3],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });
  const ccs = graphs.map((g) => {
    const cc = new CycleCover(g[1]);
    return [g[0], cc];
  });

  let cm: CylinderModel;

  ccs.forEach(function (g: [string, CycleCover]) {
    it(`Should throw error because of small scale: ${g[0]}`, function () {
      const params = {
        scale: 100,
      };
      try {
        cm = wiresToCylinders(g[1], params);
        assert.equal(false, true);
      } catch {}
    });
  });

  ccs.forEach(function (g: [string, CycleCover]) {
    it(`All cylinders should be fully connected: ${g[0]}`, function () {
      const params = {
        scale: 0.1,
      };
      cm = wiresToCylinders(g[1], params);

      for (const c of cm.cylinders) {
        for (const n of _.values(c.neighbours)) {
          assert.equal(!!n, true);
        }
      }
    });
  });

  ccs.forEach(function (g: [string, CycleCover]) {
    it(`All primes should be 1-to-1 connected: ${g[0]}`, function () {
      const params = {
        scale: 0.1,
      };
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

describe('Cycle Cover Nucleotide Model', function () {
  const graphs = [
    ['tetrahedron', tet],
    ['3x3', x3],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });
  const ccs = graphs.map((g) => {
    const cc = new CycleCover(g[1]);
    return [g[0], cc];
  });

  let cm: CylinderModel;
  let nm: NucleotideModel;

  ccs.forEach(function (g: [string, CycleCover]) {
    it(`Should generate nucleotides: ${g[0]}`, function () {
      const params = {
        scale: 0.5,
        scaffoldName: 'none',
      };
      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      assert.equal(nm.getNucleotides().length > 0, true);
    });
  });

  ccs.forEach(function (g: [string, CycleCover]) {
    it(`Min strand overlap should be above 5: ${g[0]}`, function () {
      const params = {
        scale: 0.2,
        scaffoldName: 'none',
        addNicks: true,
        minStrandLength: 10,
        maxStrandLength: 100,
      };
      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      for (const strand of nm.strands) {
        const nucs = strand.nucleotides;
        let overlap = 1;
        for (let i = 0; i < nucs.length; i++) {
          const nuc = nucs[i];
          const pair = nuc.pair;
          if (!pair) {
            overlap = 0;
            continue;
          }
          if (!pair.next) {
            assert.equal(overlap >= 10, true);
            overlap = 1;
          }
          overlap++;
        }
      }
    });
  });

  ccs.forEach(function (g: [string, CycleCover]) {
    it(`Max strand length should be under 100: ${g[0]}`, function () {
      const params = {
        scale: 0.2,
        scaffoldName: 'none',
        addNicks: true,
        minStrandLength: 5,
        maxStrandLength: 100,
      };
      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      for (const s of nm.strands) {
        if (s.isScaffold) continue;
        assert.equal(s.nucleotides.length <= 100, true);
      }
    });
  });

  ccs.forEach(function (g: [string, CycleCover]) {
    it(`Primary structure should be complementary: ${g[0]}`, function () {
      const params: MenuParameters = {
        scale: 0.2,
        scaffoldName: 'random',
      };
      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      setRandomPrimary(nm, 0.5, 'DNA');

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
