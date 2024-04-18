const assert = require('assert');
import * as _ from 'lodash';
import * as THREE from 'three';
import { OBJLoader } from '../../io/read_obj';
import { CylinderModel } from '../../models/cylinder_model';
import { PrimePos } from '../../models/cylinder';
import { Graph, HalfEdge } from '../../models/graph_model';
import { NucleotideModel } from '../../models/nucleotide_model';
import { MenuParameters } from '../../menus/menu';
import { setRandomPrimary } from '../../utils/primary_utils';
import { cylindersToNucleotides, Xtrna, wiresToCylinders } from './xtrna';
const tet = require('../../../test/test_shapes/tetra_dubs.obj');
const x3 = require('../../../test/test_shapes/3x3.obj');
const plane = require('../../../test/test_shapes/plane.obj');

describe('XT-RNA routing', function () {
  const graphs = [
    ['tetrahedron', tet],
    ['3x3', x3],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });

  let xtrna: Xtrna;
  let graph: Graph;
  let trail: HalfEdge[];

  graphs.forEach(function (g: [string, Graph]) {
    it(`Should start where it ends: ${g[0]}`, function () {
      graph = g[1];
      xtrna = new Xtrna(graph);
      trail = xtrna.trail;

      const first = trail[0];
      const last = trail[trail.length - 1];

      assert.equal(
        first.vertex == last.twin.vertex || first.vertex == last.vertex,
        true,
      );
    });
  });

  graphs.forEach(function (g: [string, Graph]) {
    it(`Should span all edges twice: ${g[0]}`, function () {
      graph = g[1];
      xtrna = new Xtrna(graph);
      trail = xtrna.trail;

      const visited = new Map(
        xtrna.graph.edges.map((e) => {
          return [e, 0];
        }),
      );

      for (const e of trail) {
        visited.set(e.edge, visited.get(e.edge) + 1);
      }

      for (const e of xtrna.graph.getEdges()) {
        assert.equal(visited.get(e) == 2, true);
      }
    });
  });
});

describe('Xtrna Cylinder Model', function () {
  const graphs = [
    ['tetrahedron', tet],
    ['3x3', x3],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });
  const xtrnas = graphs.map((g) => {
    const xtrna = new Xtrna(g[1]);
    return [g[0], xtrna];
  });

  let cm: CylinderModel;

  xtrnas.forEach(function (g: [string, Xtrna]) {
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

  xtrnas.forEach(function (g: [string, Xtrna]) {
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

  xtrnas.forEach(function (g: [string, Xtrna]) {
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

describe('Xtrna Nucleotide Model', function () {
  const graphs = [
    ['tetrahedron', tet],
    ['3x3', x3],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });
  const xtrnas = graphs.map((g) => {
    const xtrna = new Xtrna(g[1]);
    return [g[0], xtrna];
  });

  let cm: CylinderModel;
  let nm: NucleotideModel;

  xtrnas.forEach(function (g: [string, Xtrna]) {
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

  xtrnas.forEach(function (g: [string, Xtrna]) {
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

  xtrnas.forEach(function (g: [string, Xtrna]) {
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

      for (const s of nm.strands) {
        for (const n of s.nucleotides) {
          if (!n.pair) continue;
          assert.equal(complement[n.base].includes(n.pair.base), true);
        }
      }
    });
  });

  xtrnas.forEach(function (g: [string, Xtrna]) {
    it(`Dat export should have as many entries as there are nucleotides + 3: ${g[0]}`, function () {
      const params: MenuParameters = {
        scale: 0.2,
      };
      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);
      setRandomPrimary(nm, 0.5, 'RNA');

      const dat = nm.toDat();
      const datL = dat.split('\n').length;
      const nmL = nm.getNucleotides().length;

      assert.equal(datL == nmL + 3, true);
    });
  });

  xtrnas.forEach(function (g: [string, Xtrna]) {
    it(`Top export should have as many entries as there are nucleotides + 1: ${g[0]}`, function () {
      const params: MenuParameters = {
        scale: 0.2,
      };
      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);
      setRandomPrimary(nm, 0.5, 'RNA');

      const top = nm.toTop();
      const topL = top.split('\n').length;
      const nmL = nm.getNucleotides().length;

      assert.equal(topL == nmL + 1, true);
    });
  });

  xtrnas.forEach(function (g: [string, Xtrna]) {
    it(`Forces export should have a mutual trap for every basepair: ${g[0]}`, function () {
      const params: MenuParameters = {
        scale: 0.2,
      };
      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);
      setRandomPrimary(nm, 0.5, 'RNA');

      const forces = nm.toExternalForces();
      const forcesL = forces.split('\n').length;
      const nmL = nm.getNucleotides().reduce((i, n) => {
        return n.pair ? i + 1 : i;
      }, 0);

      assert.equal(forcesL == 9 * nmL, true);
    });
  });

  xtrnas.forEach(function (g: [string, Xtrna]) {
    it(`UNF export should have as many entries as there are nucleotides: ${g[0]}`, function () {
      const params: MenuParameters = {
        scale: 0.2,
      };
      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);
      setRandomPrimary(nm, 0.5, 'RNA');

      const unf = nm.toUNF();
      const unfL = unf.idCounter;
      const nmL = nm.getNucleotides().length;

      assert.equal(unfL == nmL, true);
    });
  });

  xtrnas.forEach(function (g: [string, Xtrna]) {
    it(`PDB export should have ~20 times as many atoms as there are nucleotides: ${g[0]}`, function () {
      const params: MenuParameters = {
        scale: 0.2,
      };
      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);
      setRandomPrimary(nm, 0.5, 'RNA');

      const pdb = nm.toPDB();
      const pdbL = pdb.split('\n').length;
      const nmL = nm.getNucleotides().length;

      assert.equal(pdbL > 15 * nmL && pdbL < 25 * nmL, true);
    });
  });
});
