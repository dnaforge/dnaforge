import { Context } from '../menus/context';
import { NucleotideModel } from '../models/nucleotide_model';

interface SelectedProperty {
  name: string;
  type: 'SelectedProperty';
  value: string;
}

interface SelectedContainer {
  name: string;
  type: 'SelectedContainer';
  value: options;
}

interface options {
  entries: (SelectedProperty | SelectedContainer)[];
  name: string;
}

interface Config {
  options: options;
  type: string;
}

export class SimulationAPI {
  context: Context;
  host = 'http://0.0.0.0:8081';
  token: string;

  constructor(context: Context) {
    this.context = context;
    this.setupEventListeners();
  }

  dev() {
    //this.auth();
  }

  private setupEventListeners() {
    $('#sim-window')
      .find('btn-close')
      .on('click', (e: Event) => {
        console.log('asdf');

        e.preventDefault();
        e.stopPropagation();
        $('#sim-window').show();
      });

    $('#sim-show').on('click', () => {
      console.log('asdfasdf');
      $('#sim-window').show();
    });

    $('#sim-auth').on('click', () => {
      try {
        this.host = $('#sim-host')[0].value;
        this.auth();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#sim-new').on('click', () => {
      try {
        this.newSimulation();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#sim-refresh').on('click', () => {
      try {
        this.getJobs();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#sim-confs-new').on('click', () => {
      try {
        const options = this.getTemplateConfig();
        const component = this.createConfigComponent(options as any);
        this.addConfigComponent(component);
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#sim-confs-download').on('click', () => {
      try {
        console.error('TODO');
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#sim-confs-upload').on('click', () => {
      try {
        console.error('TODO');
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#sim-confs-reset').on('click', () => {
      try {
        console.log('asdf');

        this.getDefaultConfigs();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });
  }

  setAuthStatus(status: string) {
    $('#sim-auth-status').html(status);
  }

  setParams() {}

  async auth() {
    await fetch(this.host + '/auth', {
      method: 'GET',
      headers: {
        'Content-Type': 'text/plain',
      },
    })
      .then((response) => {
        if (response.ok) {
          return response.text();
        }
        throw new Error(response.statusText);
      })
      .then((data) => {
        this.token = data;
        this.setAuthStatus(`Connected. ID: ${data}`);
        this.getDefaultConfigs();
        this.getJobs();
      })
      .catch((error) => {
        this.token = null;
        this.setAuthStatus(`Failed to connect.`);
      });
  }

  setupConfigComponents(configs: Config[]) {
    $('#sim-params').html('');
    for (const c of configs) {
      console.log(c);

      const component = this.createConfigComponent(c);
      this.addConfigComponent(component);
    }
  }

  addConfigComponent(confComponent: any) {
    $('#sim-params').append(confComponent);
  }

  createConfigComponent(config: Config) {
    const entries = config.options.entries;
    const confComponent = $('<li>');
    const confContainer = $('<div>', {
      'data-role': 'panel',
      'data-title-caption': `Config ${entries[0].value}`,
      'data-collapsible': true,
    });
    confContainer.on('mousedown', (e: any) => {
      e.stopPropagation();
    });
    confContainer.on('panelCreate', (e: any) => {
      const toggleButton = e.detail.element.parent().find('.dropdown-toggle');
      const customButtons = $('<div>', { class: 'custom-buttons' });
      const closeButton = $('<button>', { class: 'button btn-custom alert' });
      closeButton.append($('<span>', { class: 'mif-cross' }));
      customButtons.append(closeButton);
      toggleButton.before(customButtons);

      toggleButton.on('mousedown', (e2: any) => {
        e2.stopPropagation();
      });
      closeButton.on('mousedown', (e2: any) => {
        e2.stopPropagation();
        confComponent.remove();
      });
    });
    confComponent.append(confContainer);

    const getItems = (entry: any): any[] => {
      const items = [];
      if (entry.type == 'SelectedContainer') {
        const entries = entry.value.entries;
        for (const entry of entries) {
          for (const item of getItems(entry)) {
            items.push(item);
          }
        }
      }
      if (entry.type == 'SelectedProperty') {
        const el = $('<input>', {
          type: 'text',
          'data-prepend': entry.name,
          'data-role': 'input',
          'data-default-value': entry.value,
          'data-name': entry.name,
        });
        items.push(el);
      }
      return items;
    };
    for (const entry of entries) {
      const items = getItems(entry);
      for (const item of items) confContainer.append(item);
    }

    //const confFooter = $("<form>", {});
    //confContainer.append($("<button>asd</button>", {class: "button"}))

    return confComponent;
  }

  readConfigs(): Config[] {
    const confs: Config[] = [];
    for (const c of Array.from($('#sim-params').children())) {
      const entries: (SelectedProperty | SelectedContainer)[] = [];
      for (const i of Array.from($(c).find('input'))) {
        const el = $(i);
        const property: SelectedProperty = {
          type: 'SelectedProperty',
          name: el.attr('data-name'),
          value: el.val(),
        };
        entries.push(property);
      }
      const conf: Config = {
        type: 'ManualConfig',
        options: { entries: entries, name: 'Manual Config' },
      };
      confs.push(conf);
    }
    return confs;
  }

  async getDefaultConfigs(): Promise<Config[]> {
    const headers = new Headers();
    headers.append('authorization', this.token);

    const confs = await fetch(this.host + '/options/default', {
      method: 'GET',
      headers: headers,
    })
      .then((response) => {
        if (response.ok) {
          return response.text();
        }
        throw new Error(response.statusText);
      })
      .then((data) => {
        this.setupConfigComponents(JSON.parse(data));
        return JSON.parse(data);
      })
      .catch((error) => {
        console.error('Error:', error);
        return '';
      });
    return confs;
  }

  async getTemplateConfig() {
    const headers = new Headers();
    headers.append('authorization', this.token);

    const conf = await fetch(this.host + '/options/available', {
      method: 'GET',
      headers: headers,
    })
      .then((response) => {
        if (response.ok) {
          return response.text();
        }
        throw new Error(response.statusText);
      })
      .then((data) => {
        return JSON.parse(data);
      })
      .catch((error) => {
        console.error('Error:', error);
        return '';
      });
    console.log(conf);

    return conf;
  }

  parseOptions(json: JSONObject) {
    console.log(json);
  }

  updateJobList(jobs: JSONObject[]) {
    const jobsElement = $('#sim-jobs-list');
    jobsElement.html('');
    for (const j of jobs) {
      const jobElement = this.createJobComponent(j);
      jobsElement.append(jobElement);
    }
  }

  createJobComponent(job: any) {
    const jobComponent = $('<li>');

    const grid = $('<div>', { class: 'grid' });
    const row1 = $('<div>', { class: 'row' });
    const row2 = $('<div>', { class: 'row' });

    const status = $(`<div class="cell-4">${job.status}</div>`);
    const steps = $(
      `<div class="cell-4">${job.completedSteps} / ${job.steps}</div>`,
    );
    const buttons = $(`<div class="cell-4 text-right">`);

    const syncButton = $('<button></button>', {
      class: 'button cycle mif-2x mif-3d-rotation',
    });
    const downloadButton = $('<button></button>', {
      class: 'button cycle mif-2x mif-download',
    });
    const deleteButton = $('<button></button>', {
      class: 'button cycle mif-2x mif-cross',
    });

    row1.append(status);
    row1.append(steps);
    row1.append(buttons);
    buttons.append(syncButton);
    buttons.append(downloadButton);
    buttons.append(deleteButton);
    row2.append(
      $(
        `<div class="cell-12" data-role="progress" data-small="true" data-value="${job.progress}"></div>`,
      ),
    );

    jobComponent.append($(`<span>${job.id}</span>`, { class: 'label' }));
    jobComponent.append(grid);
    grid.append(row1);
    grid.append(row2);

    syncButton.on('click', () => {
      console.log('sync todo');
    });
    downloadButton.on('click', () => {
      console.log('download todo');
    });
    deleteButton.on('click', () => {
      console.log('delete todo');
    });

    return jobComponent;
  }

  async getJobs() {
    const headers = new Headers();
    headers.append('authorization', this.token);

    await fetch(this.host + '/job', {
      method: 'GET',
      headers: headers,
    })
      .then((response) => {
        if (response.ok) {
          return response.text();
        }
        throw new Error(response.statusText);
      })
      .then((data) => {
        this.updateJobList(JSON.parse(data));
      })
      .catch((error) => {
        this.context.addMessage(error, 'alert');
        throw error;
      });
  }

  async getJob(id: string) {
    if (!this.token) this.auth();
    console.log(this.token);
    const headers = new Headers();
    headers.append('authorization', this.token);

    await fetch(this.host + '/job/' + id, {
      method: 'GET',
      headers: headers,
    })
      .then((response) => {
        if (response.ok) {
          return response.text();
        }
        throw new Error(response.statusText);
      })
      .then((data) => {
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

    await fetch(this.host + '/job/details/' + id, {
      method: 'GET',
      headers: headers,
    })
      .then((response) => {
        if (response.ok) {
          return response.text();
        }
        throw new Error(response.statusText);
      })
      .then((data) => {
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

    await fetch(this.host + '/job/download/' + id, {
      method: 'GET',
      headers: headers,
    })
      .then((response) => {
        if (response.ok) {
          return response.text();
        }
        throw new Error(response.statusText);
      })
      .then((data) => {
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
    } else {
      const confs = this.readConfigs();
      this.submitJob(confs, model);
    }
  }

  async submitJob(confs: Config[], model: NucleotideModel) {
    const dat = model.toDat();
    const top = model.toTop();
    const forces = model.toExternalForces();

    const job = {
      configs: confs,
      top: top,
      dat: dat,
      forces: forces,
    };

    const headers = new Headers();
    headers.append('authorization', this.token);
    headers.append('content-type', 'application/json');

    await fetch(this.host + '/job', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(job),
    })
      .then((response) => {
        if (response.ok) {
          return response.text();
        }
        throw new Error(response.statusText);
      })
      .then((data) => {
        this.getJobs();
      })
      .catch((error) => {
        this.context.addMessage(error, 'alert');
        throw error;
      });
  }

  async deleteJob(id: string) {
    if (!this.token) this.auth();
    console.log(this.token);
    const headers = new Headers();
    headers.append('authorization', this.token);

    await fetch(this.host + '/job/' + id, {
      method: 'DELETE',
      headers: headers,
    })
      .then((response) => {
        if (response.ok) {
          return response.text();
        }
        throw new Error(response.statusText);
      })
      .then((data) => {
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

    await fetch(this.host + '/job/' + id, {
      method: 'PATCH',
      headers: headers,
    })
      .then((response) => {
        if (response.ok) {
          return response.text();
        }
        throw new Error(response.statusText);
      })
      .then((data) => {
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

    await fetch(this.host + '/job/subscribe', {
      method: 'GET',
      headers: headers,
    })
      .then((response) => {
        if (response.ok) {
          return response.text();
        }
        throw new Error(response.statusText);
      })
      .then((data) => {
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

    await fetch(this.host + '/job/subscribe/' + id, {
      method: 'POST',
      headers: headers,
    })
      .then((response) => {
        if (response.ok) {
          return response.text();
        }
        throw new Error(response.statusText);
      })
      .then((data) => {
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

    await fetch(this.host + '/job/subscribe/' + id, {
      method: 'DELETE',
      headers: headers,
    })
      .then((response) => {
        if (response.ok) {
          return response.text();
        }
        throw new Error(response.statusText);
      })
      .then((data) => {
        this.parseOptions(JSON.parse(data));
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }
}
