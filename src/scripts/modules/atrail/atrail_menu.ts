import {ATrail, graphToWires, wiresToCylinders, cylindersToNucleotides } from './atrail';
import downloadTXT from '../../io/download';
import html from './menu_atrail.htm';
import ModuleMenu from '../module_menu';
import Context from '../../scene/context';
import { Graph } from '../../models/graph';
import WiresModel from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';


export default class ATrailMenu extends ModuleMenu {
    scaleInput = $('#atrail-scale');
    linkersMinInput = $('#atrail-linkers-min');
    linkersMaxInput = $('#atrail-linkers-max');
    strandLengthMaxInput = $('#atrail-strand-length-max');
    strandLengthMinInput = $('#atrail-strand-length-min');
    addNicksSwitch = $('#atrail-add-nicks');
    atrailScaffold = $('#atrail-scaffold');
    downloadButton = $('#download-atrail');


    constructor(context: Context) {
        super(context, html);
    }

    graphToWires(graph: Graph, params: typeof this.params) {
        const atrail = graphToWires(graph, params);
        this.context.addMessage(`Found an atrail.`, "info");
        return atrail;
    }

    wiresToCylinders(wires: WiresModel, params: typeof this.params) {
        return wiresToCylinders(<ATrail>wires, params);
    }

    cylindersToNucleotides(cm: CylinderModel, params: typeof this.params) {
        return cylindersToNucleotides(cm, params);
    }

    generatePrimary() {
        if (!this.nm) this.generateNucleotideModel();

        this.collectParameters();

        this.nm.generatePrimaryFromScaffold(<string>this.params.scaffoldName);
    }

    downloadATrail() {
        try {
            const str = JSON.stringify(this.nm.toJSON());
            downloadTXT("atrail.unf", str);
        } catch (error) {
            throw `Nucleotide model not defined.`;
        }
    }

    uploadATrail(str: string) {
        // remove old:
        this.removeWires(true);
        this.removeCylinders(true);
        this.removeNucleotides(true);

        this.collectParameters();

        const graph = this.context.graph;
        if (!graph) throw ("No model is loaded.");
        const t = str.trim().split(" ");
        const trail = [];
        for (let n of t) {
            const num = Number(n) - 1;
            trail.push(num);
            if (num < 0 || isNaN(num) || num >= graph.getVertices().length) throw `Unrecognised index`;
        }
        if (trail.length <= 1) throw `Route too short.`;
        if (trail[0] != trail[trail.length - 1]) throw `Acylic route.`;

        const atrail = new ATrail(graph);
        atrail.setATrail(trail);

        this.wires = atrail;
    }


    collectParameters() {
        super.collectParameters();

        this.params.scale = 1 / parseFloat(this.scaleInput[0].value);
        this.params.minLinkers = parseInt(this.linkersMinInput[0].value);
        this.params.maxLinkers = parseInt(this.linkersMaxInput[0].value);

        this.params.maxStrandLength = parseInt(this.strandLengthMaxInput[0].value);
        this.params.minStrandLength = parseInt(this.strandLengthMinInput[0].value);
        this.params.addNicks = this.addNicksSwitch[0].checked;
        this.params.scaffold = this.atrailScaffold[0].value;
    }

    setupEventListeners() {
        super.setupEventListeners();

        this.scaleInput = $('#atrail-scale');
        this.linkersMinInput = $('#atrail-linkers-min');
        this.linkersMaxInput = $('#atrail-linkers-max');

        this.strandLengthMaxInput = $('#atrail-strand-length-max');
        this.strandLengthMinInput = $('#atrail-strand-length-min');
        this.addNicksSwitch = $('#atrail-add-nicks');

        this.atrailScaffold = $('#atrail-scaffold');
        this.downloadButton = $('#download-atrail');

        this.downloadButton.on("click", () => {
            try {
                this.downloadATrail();
            } catch (error) {
                this.context.addMessage(error, "alert");
                throw (error);
            }
        });

        $("#atrail-dialog-confirm").on("click", () => {
            try {
                this.uploadATrail($("#atrail-dialog-text").val().toUpperCase());
                this.regenerateVisible();
            } catch (error) {
                this.context.addMessage(error, "alert");
                throw (error);
            }
        });
    }
}