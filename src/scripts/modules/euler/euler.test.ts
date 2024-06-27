const assert = require('assert');
import * as _ from 'lodash';
import * as THREE from 'three';
import { OBJLoader } from '../../io/read_obj';
import { CylinderModel } from '../../models/cylinder_model';
import { PrimePos } from '../../models/cylinder';
import { Graph, HalfEdge } from '../../models/graph_model';
import { NucleotideModel } from '../../models/nucleotide_model';
import { Euler, cylindersToNucleotides, wiresToCylinders } from './euler';
import { EulerParameters } from './euler_menu';
const x3 = require('../../../test/test_shapes/3x3.obj');
const tet = require('../../../test/test_shapes/tetra.obj');
const x4 = require('../../../test/test_shapes/4x4.obj');
const plane = require('../../../test/test_shapes/plane.obj');

function getParams(): EulerParameters {
  return {
    scaffoldOffset: 0,
    scaffoldStart: 0,
    midpointNicking: false,
  };
}

describe('Euler-routing', function () {
  const graphs = [
    ['tetrahedron', tet],
    ['4x4', x4],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });

  let euler: Euler;
  let graph: Graph;
  let trail: HalfEdge[];

  graphs.forEach(function (g: [string, Graph]) {
    it(`Should be directed: ${g[0]}`, function () {
      graph = g[1];
      euler = new Euler(graph);
      trail = euler.findEuler();

      for (let i = 1; i < trail.length; i++) {
        assert.notEqual(trail[i - 1].vertex, trail[i].vertex);
      }
    });

    it(`Should span all edges once: ${g[0]}`, function () {
      graph = g[1];
      euler = new Euler(graph);
      trail = euler.findEuler();

      const visited = new Set();

      for (const he of trail) {
        assert.equal(visited.has(he.edge), false);
        visited.add(he.edge);
      }

      for (const e of euler.graph.getEdges()) {
        assert.equal(visited.has(e), true);
      }
    });

    it(`Should start where it ends: ${g[0]}`, function () {
      graph = g[1];
      euler = new Euler(graph);
      trail = euler.findEuler();

      assert.equal(
        trail[trail.length - 1].twin.vertex == trail[0].vertex,
        true,
      );
    });

    /*
    it(`Should be non-crossing: ${g[0]}`, function () {
      graph = g[1];
      euler = new Euler(graph);
      trail = euler.findEuler();

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
    */
  });

  it(`Should not have an euler: 3x3`, function () {
    graph = new OBJLoader(new THREE.LoadingManager()).parse(x3);
    try {
      euler = new Euler(graph);
      trail = euler.findEuler();
      assert.equal(false, true);
    } catch {}
  });
});

describe('Euler Cylinder Model', function () {
  const graphs = [
    ['tetrahedron', tet],
    ['4x4', x4],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });
  const eulers = graphs.map((g) => {
    const euler = new Euler(g[1]);
    euler.findEuler();
    return [g[0], euler];
  });

  let cm: CylinderModel;

  eulers.forEach(function (g: [string, Euler]) {
    it(`Should throw error because of small scale: ${g[0]}`, function () {
      const params = getParams();
      params.scale = 100;
      try {
        cm = wiresToCylinders(g[1], params);
        assert.equal(false, true);
      } catch {}
    });
  });

  eulers.forEach(function (g: [string, Euler]) {
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

  eulers.forEach(function (g: [string, Euler]) {
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

describe('Euler Nucleotide Model', function () {
  const graphs = [
    ['tetrahedron', tet],
    ['4x4', x4],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });
  const eulers = graphs.map((g) => {
    const euler = new Euler(g[1]);
    euler.findEuler();
    return [g[0], euler];
  });

  let cm: CylinderModel;
  let nm: NucleotideModel;

  eulers.forEach(function (g: [string, Euler]) {
    it(`Should generate nucleotides: ${g[0]}`, function () {
      const params = getParams();
      params.scale = 0.5;
      params.scaffoldName = 'none';

      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      assert.equal(nm.getNucleotides().length > 0, true);
    });
  });

  eulers.forEach(function (g: [string, Euler]) {
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

  eulers.forEach(function (g: [string, Euler]) {
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

  eulers.forEach(function (g: [string, Euler]) {
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

  eulers.forEach(function (g: [string, Euler]) {
    it(`Top export should have as many entries as there are nucleotides + 1: ${g[0]}`, function () {
      const params = getParams();
      params.scale = 0.2;
      params.scaffoldName = 'random';

      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      const top = nm.toTop();
      const topL = top.split('\n').length;
      const nmL = nm.getNucleotides().length;

      assert.equal(topL == nmL + 1, true);
    });
  });

  eulers.forEach(function (g: [string, Euler]) {
    it(`Forces export should have a mutual trap for every basepair: ${g[0]}`, function () {
      const params = getParams();
      params.scale = 0.2;
      params.scaffoldName = 'random';

      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      const forces = nm.toExternalForces();
      const forcesL = forces.split('\n').length;
      const nmL = nm.getNucleotides().reduce((i, n) => {
        return n.pair ? i + 1 : i;
      }, 0);

      assert.equal(forcesL == 9 * nmL, true);
    });
  });

  eulers.forEach(function (g: [string, Euler]) {
    it(`UNF export should have as many entries as there are nucleotides: ${g[0]}`, function () {
      const params = getParams();
      params.scale = 0.2;
      params.scaffoldName = 'random';

      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      const unf = nm.toUNF();
      const unfL = unf.idCounter;
      const nmL = nm.getNucleotides().length;

      assert.equal(unfL == nmL, true);
    });
  });

  eulers.forEach(function (g: [string, Euler]) {
    it(`PDB export should have ~20 times as many atoms as there are nucleotides: ${g[0]}`, function () {
      const params = getParams();
      params.scale = 0.2;
      params.scaffoldName = 'random';

      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      const pdb = nm.toPDB();
      const pdbL = pdb.split('\n').length;
      const nmL = nm.getNucleotides().length;

      assert.equal(pdbL > 15 * nmL && pdbL < 25 * nmL, true);
    });
  });
});
