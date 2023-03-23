var assert = require('assert');
import * as _ from 'lodash';
import * as THREE from 'three';
import { OBJLoader } from '../../io/read_obj';
import { CylinderModel } from '../../models/cylinder_model';
import { Edge, Graph, HalfEdge } from '../../models/graph';
import { NucleotideModel } from '../../models/nucleotide_model';
import { WiresModel } from '../../models/wires_model';
import { MenuParameters } from '../../scene/menu';
import { setRandomPrimary } from '../../utils/primary_utils';
import { cylindersToNucleotides, Sterna, wiresToCylinders } from './sterna';

describe('Sterna routing', function () {
  const tet = require('../../../test/test_shapes/tetra_dubs.obj');
  const x3 = require('../../../test/test_shapes/3x3.obj');
  const plane = require('../../../test/test_shapes/plane.obj');

  const graphs = [
    ['tetrahedron', tet],
    ['3x3', x3],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });

  let sterna: Sterna;
  let graph: Graph;
  let trail: Edge[];

  graphs.forEach(function (g: [string, Graph]) {
    it(`Should start where it ends: ${g[0]}`, function () {
      graph = g[1];
      sterna = new Sterna(graph);
      trail = sterna.trail;

      const first = trail[0];
      const last = trail[trail.length - 1];

      assert.equal(!!first.getCommonVertex(last), true);
    });
  });

  graphs.forEach(function (g: [string, Graph]) {
    it(`Should span all edges twice: ${g[0]}`, function () {
      graph = g[1];
      sterna = new Sterna(graph);
      trail = sterna.trail;

      const visited = new Map(
        sterna.graph.edges.map((e) => {
          return [e, 0];
        })
      );

      for (let e of trail) {
        visited.set(e, visited.get(e) + 1);
      }

      for (let e of sterna.graph.getEdges()) {
        assert.equal(visited.get(e) == 2, true);
      }
    });
  });
});

describe('Sterna Cylinder Model', function () {
  const tet = require('../../../test/test_shapes/tetra_dubs.obj');
  const x3 = require('../../../test/test_shapes/3x3.obj');
  const plane = require('../../../test/test_shapes/plane.obj');

  const graphs = [
    ['tetrahedron', tet],
    ['3x3', x3],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });
  const sternas = graphs.map((g) => {
    const sterna = new Sterna(g[1]);
    return [g[0], sterna];
  });

  let cm: CylinderModel;

  sternas.forEach(function (g: [string, Sterna]) {
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

  sternas.forEach(function (g: [string, Sterna]) {
    it(`All cylinders should be fully connected: ${g[0]}`, function () {
      const params = {
        scale: 0.1,
      };
      cm = wiresToCylinders(g[1], params);

      for (let c of cm.cylinders) {
        for (let n of _.values(c.neighbours)) {
          assert.equal(!!n, true);
        }
      }
    });
  });

  sternas.forEach(function (g: [string, Sterna]) {
    it(`All primes should be 1-to-1 connected: ${g[0]}`, function () {
      const params = {
        scale: 0.1,
      };
      cm = wiresToCylinders(g[1], params);

      for (let c of cm.cylinders) {
        for (let prime of _.keys(c.neighbours)) {
          const n = c.neighbours[prime];
          const prime2 = n[1];

          assert.equal(n[0].neighbours[prime2][0] == c, true);
        }
      }
    });
  });
});

describe('Sterna Nucleotide Model', function () {
  const tet = require('../../../test/test_shapes/tetra_dubs.obj');
  const x3 = require('../../../test/test_shapes/3x3.obj');
  const plane = require('../../../test/test_shapes/plane.obj');

  const graphs = [
    ['tetrahedron', tet],
    ['3x3', x3],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });
  const sternas = graphs.map((g) => {
    const sterna = new Sterna(g[1]);
    return [g[0], sterna];
  });

  let cm: CylinderModel;
  let nm: NucleotideModel;

  sternas.forEach(function (g: [string, Sterna]) {
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

  sternas.forEach(function (g: [string, Sterna]) {
    it(`There should be only one strand: ${g[0]}`, function () {
      const params = {
        scale: 0.2,
        scaffoldName: 'none',
        addNicks: true,
        minStrandLength: 5,
        maxStrandLength: 100,
      };
      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      assert.equal(nm.strands.length == 1, true);
    });
  });

  sternas.forEach(function (g: [string, Sterna]) {
    it(`Primary structure should be complementary: ${g[0]}`, function () {
      const params: MenuParameters = {
        scale: 0.2,
      };
      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      setRandomPrimary(nm, 0.5, 'RNA');

      const complement: Record<string, string> = {
        A: 'U',
        U: 'GA',
        G: 'UC',
        C: 'G',
      };

      for (let s of nm.strands) {
        for (let n of s.nucleotides) {
          if (!n.pair) continue;
          assert.equal(complement[n.base].includes(n.pair.base), true);
        }
      }
    });
  });
});