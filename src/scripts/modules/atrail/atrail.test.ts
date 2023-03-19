/*
import { ATrail } from './atrail';


test('basic', () => {
  expect(0).toBe(0);
});


for(let v of this.graph.getVertices()){
  transitions.set(v, Direction.RIGHT);
}

for(let v of this.graph.getVertices()){
  const t = new Set<HalfEdge>();
  for(let he of v.getAdjacentHalfEdges()){
    for(let he2 of neighbours(he)) t.add(he2);
  }
  console.log(v.getAdjacentHalfEdges().length, t.size);
  
}





    for(let v of this.graph.getVertices()){
      transitions.set(v, Direction.RIGHT);
    }
    
    for(let v of this.graph.getVertices()){
      console.log("---------");
      console.log(v.id);
      const t = new Set<HalfEdge>();
      const hes = v.getTopoAdjacentHalfEdges();
      for(let i = 0; i < hes.length; i += 2 ){
        const he = hes[i];
        let he2 = neighbours(he)[0];
        t.add(he2);
        t.add(he)
        console.log(he.twin.vertex.id, he2.twin.vertex.id);
      }
      console.log("--------");
      
    }
    
    for(let v of this.graph.getVertices()){
      console.log("---------");
      console.log(v.id);
      const t = new Set<HalfEdge>();
      const hes = v.getTopoAdjacentHalfEdges();
      for(let i = 1; i < hes.length; i += 2 ){
        const he = hes[i];
        let he2 = neighbours(he)[0];
        t.add(he2);
        t.add(he)
        console.log(he.twin.vertex.id, he2.twin.vertex.id);
      }
      console.log("--------");
      
    }
*/
