import { SuffixArray } from 'mnemonist';
import { NucleotideModel } from '../models/nucleotide_model';

class ListDict {
    constructor() {

    }
}


export class PrimaryGenerator {

    constructor() {

    }

    generatePrimary(nm: NucleotideModel) {
        const l = 250000;
        let r = Object.keys([].concat(Array(l).join().split(''))).map(() => { return "ATGC"[Math.floor(Math.random() * 4)] });
        //console.log(r);

        const startT = performance.now();
        const suffixArray = new SuffixArray(r);
        //console.log(suffixArray.array);
        console.log(performance.now() - startT);
    }

    seedPrimary() {

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