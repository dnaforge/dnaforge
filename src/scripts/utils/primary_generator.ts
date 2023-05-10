import { SuffixArray } from 'mnemonist';
import { Nucleotide, NucleotideModel } from '../models/nucleotide_model';
import { getPairing, setRandomPrimary } from './primary_utils';

class ListDict {
    constructor() {

    }
}


export class PrimaryGenerator {

    constructor(nm: NucleotideModel) {
        const gcContent = 0.5;
        const naType = "DNA";

        setRandomPrimary(nm, gcContent, naType);
        const nucleotides = nm.getNucleotides();

        const pairs = getPairing(nucleotides);
        const pString = nucleotides.map((n) => {return n.base});

        const subSeqs = this.getSubSeqs(pString, 10);
        console.log(subSeqs);
        

        //console.log(pString);
        //const suffixArray = new SuffixArray(pString);
        //console.log(suffixArray.array.map((i) => {return pString.slice(i).join("")  }));
    }

    generatePrimary() {
        //const l = 250000;
        //let r = Object.keys([].concat(Array(l).join().split(''))).map(() => { return "ATGC"[Math.floor(Math.random() * 4)] });
        //console.log(r);

        //const startT = performance.now();
        //const suffixArray = new SuffixArray(r);
        //console.log(suffixArray.array);
        //console.log(performance.now() - startT);
    }

    seedPrimary() {


    }

    getSubSeqs(pString: string[], len: number){
        const subSeqs = new Map<string, Set<number>>();

        for(let i = 0; i < pString.length - len + 1; i++){
            const s = pString.slice(i, i + len).join("");
            if(!subSeqs.get(s)) subSeqs.set(s, new Set<number>());
            subSeqs.get(s).add(i);
        }
        return subSeqs;
        
    }

    populateOffenders() {

    }

    populateRepeats() {

    }

    setBase() {

    }

    getOffender() {

    }

    optimise() {

    }
}