import { Context } from "../menus/context";
import { NucleotideModel } from "../models/nucleotide_model";

export class SimulationAPI {
  context: Context;
  host = "http://0.0.0.0:8081";
  token: string;

  constructor(context: Context) {
    this.context = context;
    this.createElement();
    this.setupEventListeners();
    this.auth();
  }


  private setupEventListeners() {
    $("#sim-auth").on("click", () => {
      try {
        this.host = $("#sim-host")[0].value;
        this.auth();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    })

    $("#sim-new").on("click", () => {
      try {
        this.newSimulation();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });
  }

  createElement() {
    return;
    const win = $("<div>", { "data-role": 'window' });
    const host = $("<input>", { type: "text", "data-role": "input", "data-prened": "Host:", "data-default-value": this.host });
    win.append(host);
    const connect = $("<button>Connect</button>", { class: "button" });
    win.append(connect);
    connect.on("click", () => {
      this.host = host[0].value;
      this.auth();
    })

    win.appendTo($("body"));

  }

  setAuthStatus(status: string) {
    $("#sim-auth-status").html(status);
  }

  setParams() {

  }

  async auth() {
    await fetch(this.host + "/auth",
      {
        method: "GET",
        headers: {
          'Content-Type': 'text/plain',
        }
      }
    ).then(response => response.text())
      .then(data => {
        this.token = data;
        this.setAuthStatus(`Connected. ID: ${data}`);
        this.getDefaultConfigs();
      })
      .catch((error) => {
        this.token = null;
        this.setAuthStatus(`Failed to connect.`);
      });
  }

  async getOptions() {
    const headers = new Headers();
    headers.append('authorization', this.token);

    await fetch(this.host + "/options/available",
      {
        method: "GET",
        headers: headers
      }
    ).then(response => response.text())
      .then(data => {
        this.parseOptions(JSON.parse(data));
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  setupConfigComponents(json: any) {
    $("#sim-params").html("");
    for (let c of json) {
      const component = this.createConfigComponent(c.options.entries);
      $("#sim-params").append(component);
    }
  }

  createConfigComponent(entries: JSONObject[]) {
    const confComponent = $("<li>");
    const confContainer = $("<div>", { "data-role": "panel", "data-title-caption": `Config ${entries[0].value}`, "data-collapsible": true });
    confContainer.on("mousedown", (e: any) => {
      e.stopPropagation();
    })
    confContainer.on("panelCreate", (e: any) => {
      const toggleButton = e.detail.element.parent().find(".dropdown-toggle")
      const customButtons = $("<div>", {class: "custom-buttons"});
      const closeButton = $("<button>", {class: "button btn-custom alert"});
      closeButton.append($("<span>", {class: "mif-cross"}));
      customButtons.append(closeButton);
      toggleButton.before(customButtons);


      toggleButton.on("mousedown", (e2: any) => {
        e2.stopPropagation();
      });
      closeButton.on("mousedown", (e2: any) => {
        e2.stopPropagation();
        confComponent.remove();
      });
    })
    confComponent.append(confContainer);

    const getItems = (entry: any): any[] => {
      const items = [];
      if (entry.type == "SelectedContainer") {
        const entries = entry.value.entries;
        for (let entry of entries) {
          for (let item of getItems(entry)) {
            items.push(item);
          };
        }
      }
      if (entry.type == "SelectedProperty") {
        const el = $("<input>", {
          type: "text",
          "data-prepend": entry.name,
          "data-role": "input",
          "data-default-value": entry.value,
          "data-name": entry.name
        });
        items.push(el);

      }
      return items;
    };
    for (let entry of entries) {
      const items = getItems(entry);
      for (let item of items) confContainer.append(item);
    }

    //const confFooter = $("<form>", {});
    //confContainer.append($("<button>asd</button>", {class: "button"}))

    return confComponent;
  }

  readConfigs(): JSONObject[] {
    const confs: JSONObject[] = [];
    for (let c of Array.from($("#sim-params").children())) {
      const entries: JSONValue = [];
      for (let i of Array.from($(c).find("input"))) {
        const el = $(i);
        const property = { type: "SelectedProperty", name: el.attr("data-name"), value: el.val() };
        entries.push(property);
      }
      const conf: JSONValue = { type: "ManualConfig", options: { entries: entries, name: "Manual Config" } };
      confs.push(conf);
    }
    return confs;
  }

  async getDefaultConfigs(): Promise<JSONObject> {
    const headers = new Headers();
    headers.append('authorization', this.token);

    const confs = await fetch(this.host + "/options/default",
      {
        method: "GET",
        headers: headers
      }
    ).then(response => response.text())
      .then(data => {
        this.setupConfigComponents(JSON.parse(data));
        return JSON.parse(data);
      })
      .catch((error) => {
        console.error('Error:', error);
        return "";
      });
    return confs;
  }

  parseOptions(json: JSONObject) {
    console.log(json);

  }



  async getJobs() {
    if (!this.token) this.auth();
    console.log(this.token);
    const headers = new Headers();
    headers.append('authorization', this.token);

    await fetch(this.host + "/job",
      {
        method: "GET",
        headers: headers
      }
    ).then(response => response.text())
      .then(data => {
        this.parseOptions(JSON.parse(data));
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  async getJob(id: string) {
    if (!this.token) this.auth();
    console.log(this.token);
    const headers = new Headers();
    headers.append('authorization', this.token);

    await fetch(this.host + "/job/" + id,
      {
        method: "GET",
        headers: headers
      }
    ).then(response => response.text())
      .then(data => {
        this.parseOptions(JSON.parse(data));
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  async getJobDetails(id: string) {
    if (!this.token) this.auth();
    console.log(this.token);
    const headers = new Headers();
    headers.append('authorization', this.token);

    await fetch(this.host + "/job/details/" + id,
      {
        method: "GET",
        headers: headers
      }
    ).then(response => response.text())
      .then(data => {
        this.parseOptions(JSON.parse(data));
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  async downloadJob(id: string) {
    if (!this.token) this.auth();
    console.log(this.token);
    const headers = new Headers();
    headers.append('authorization', this.token);

    await fetch(this.host + "/job/download/" + id,
      {
        method: "GET",
        headers: headers
      }
    ).then(response => response.text())
      .then(data => {
        this.parseOptions(JSON.parse(data));
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  newSimulation() {
    const model = this.context.activeContext?.nm;
    if (!model) {
      throw `No nucleotide model found in the active context`;
    }
    else {
      const confs = this.readConfigs();
      this.submitJob(confs, model);
    }
  }



  async submitJob(confs: JSONObject[], model: NucleotideModel) {
    const dat = model.toDat();
    const top = model.toTop();
    const forces = model.toExternalForces();

    const job = {
      configs: confs,
      top: top,
      dat: dat,
      forces: forces
    }

    const headers = new Headers();
    headers.append('authorization', this.token);
    headers.append('content-type', "application/json");

    await fetch(this.host + "/job",
      {
        method: "POST",
        headers: headers,
        body: JSON.stringify(job)
      }
    ).then(response => response.text())
      .then(data => {
        console.log(data);

      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  async deleteJob(id: string) {
    if (!this.token) this.auth();
    console.log(this.token);
    const headers = new Headers();
    headers.append('authorization', this.token);

    await fetch(this.host + "/job/" + id,
      {
        method: "DELETE",
        headers: headers
      }
    ).then(response => response.text())
      .then(data => {
        this.parseOptions(JSON.parse(data));
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  async cancelJob(id: string) {
    if (!this.token) this.auth();
    console.log(this.token);
    const headers = new Headers();
    headers.append('authorization', this.token);

    await fetch(this.host + "/job/" + id,
      {
        method: "PATCH",
        headers: headers
      }
    ).then(response => response.text())
      .then(data => {
        this.parseOptions(JSON.parse(data));
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }



  async getSubscription() {
    if (!this.token) this.auth();
    console.log(this.token);
    const headers = new Headers();
    headers.append('authorization', this.token);

    await fetch(this.host + "/job/subscribe",
      {
        method: "GET",
        headers: headers
      }
    ).then(response => response.text())
      .then(data => {
        this.parseOptions(JSON.parse(data));
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  async subscribe(id: string) {
    if (!this.token) this.auth();
    console.log(this.token);
    const headers = new Headers();
    headers.append('authorization', this.token);

    await fetch(this.host + "/job/subscribe/" + id,
      {
        method: "POST",
        headers: headers
      }
    ).then(response => response.text())
      .then(data => {
        this.parseOptions(JSON.parse(data));
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  async unsubscribe(id: string) {
    if (!this.token) this.auth();
    console.log(this.token);
    const headers = new Headers();
    headers.append('authorization', this.token);

    await fetch(this.host + "/job/subscribe/" + id,
      {
        method: "DELETE",
        headers: headers
      }
    ).then(response => response.text())
      .then(data => {
        this.parseOptions(JSON.parse(data));
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

}