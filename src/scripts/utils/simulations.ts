import { downloadTXT } from '../io/download';
import { Context } from '../menus/context';
import { NucleotideModel } from '../models/nucleotide_model';
import * as streamSaver from 'streamsaver';

interface SelectedProperty {
  name: string;
  configNames?: string[];
  suffix?: string;
  type: 'SelectedProperty' | 'Property';
  value: string;
}

interface SelectedContainer {
  name: string;
  type: 'SelectedContainer';
  value: options;
}

interface options {
  entries: (SelectedProperty | SelectedContainer)[];
  fixedProperties?: { [key: string]: string };
  name: string;
}

interface Config {
  options: options;
  type: string;
  title?: string;
  description?: string;
}

interface Message {
  type: string;
  error: string;
}

interface Job {
  id: string;
  stages: number;
  completedStages: number;
  status: string;
  progress: number;
  extensions: number;
  error: string;
  metadata: Record<string, string>;
}

interface WebSocketAuthResponse {
  type: 'WebSocketAuthResponse';
  success: boolean;
}

interface JobUpdate {
  type: 'JobUpdate';
  JobId: string;
  job?: Job;
}

interface DetailedJobUpdate {
  type: 'DetailedUpdate';
  job?: Job;
  top: string;
  conf: string;
  forces: string;
}

enum JobStatus {
  CANCELLED = 'CANCELED',
  DONE = 'DONE',
  RUNNING = 'RUNNING',
}

export class SimulationAPI {
  context: Context;
  host = 'http://localhost:8081';
  token: string;
  socket: WebSocket;

  constructor(context: Context) {
    this.context = context;
    this.setupEventListeners();
  }

  dev() {
    this.auth();
  }

  handleWebSocketMessage(data: string) {
    let message = JSON.parse(data);
    if (message.type == 'JobUpdate') {
      message = <JobUpdate>message;
      this.getJobs();
      if (message.job?.error) {
        console.error(message.job.error);
      }
    } else if (message.type == 'DetailedUpdate') {
      message = <DetailedJobUpdate>message;
      this.getJobs();
      if (message.job?.error) {
        console.error(message.job.error);
      } else {
        this.detailedUpdate(message);
      }
    } else if (message.type == 'WebSocketAuthResponse') {
      message = <WebSocketAuthResponse>message;
      if (!message.success) {
        console.error(message);
      }
    } else {
      console.log(message);
    }
  }

  detailedUpdate(t: DetailedJobUpdate) {
    const conf = t.conf;
    const top = t.top;
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
        this.getDefaultConfigs();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#sim-unsubscribe').on('click', () => {
      try {
        this.unsubscribe();
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
    console.log('Auth');
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
        this.openWebSocket();
      })
      .catch((error) => {
        console.error('Error:', error);
        this.token = null;
        this.setAuthStatus(`Failed to connect.`);
        this.context.addMessage(error, 'alert');
      });
  }

  openWebSocket() {
    console.log('Open Websocket');
    this.socket = new WebSocket(this.host.replace('http://', 'ws://'));
    this.socket.addEventListener('open', (event) => {
      this.socket.send(
        JSON.stringify({
          type: 'WebSocketAuth',
          bearerToken: this.token,
        }),
      );
    });
    this.socket.addEventListener('message', (event) => {
      this.handleWebSocketMessage(event.data);
    });
  }

  setupConfigComponents(configs: Config[]) {
    $('#sim-params').html('');
    for (const c of configs) {
      const component = this.createConfigComponent(c);
      this.addConfigComponent(component);
    }

    //console.log(configs[0].options.entries);
    //console.log(this.readConfigs()[0].options.entries);
  }

  addConfigComponent(confComponent: any) {
    $('#sim-params').append(confComponent);
  }

  createConfigComponent(config: Config) {
    const entries = config.options.entries;
    const confComponent = $('<li>');
    const confContainer = $('<div>', {
      'data-role': 'panel',
      'data-title-caption': `${config.title}`,
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
    const description = $('<textarea>', {
      'data-role': 'textarea',
      'data-default-value': config.description,
    });
    confContainer.append(description);
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
        title: 'New config',
        options: { entries: entries, name: 'Manual Config' },
      };
      confs.push(conf);
    }
    return confs;
  }

  async getDefaultConfigs(): Promise<Config[]> {
    console.log('Get Default Configs');
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
        this.context.addMessage(error, 'alert');
      });
    return confs;
  }

  async getTemplateConfig() {
    console.log('Get Config Template');
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
        this.context.addMessage(error, 'alert');
      });
    console.log(conf);

    return conf;
  }

  parseOptions(json: JSONObject) {
    console.log(json);
  }

  updateJobList(jobs: Job[]) {
    const jobsElement = $('#sim-jobs-list');

    const needsRemake = (() => {
      const children = jobsElement.children();
      if (children.length != jobs.length) return true;
      for (let i = 0; i < jobs.length; i++) {
        const j = jobs[i];
        const elId = $(children[i]).attr('data-job-id');
        if (elId != j.id) {
          return true;
        }
      }
      return false;
    })();

    jobsElement.html('');
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i];
      const jobElement = this.createJobComponent(j);
      jobsElement.append(jobElement);
    }

    //TODO: Update onyl specific element.
  }

  createJobComponent(job: Job) {
    const jobComponent = $('<li>', {
      'data-job-id': job.id,
    });

    const grid = $('<div>', { class: 'grid' });
    const row1 = $('<div>', { class: 'row' });
    const row2 = $('<div>', { class: 'row' });

    const status = $(`<div class="cell-4">${job.status}</div>`);
    const steps = $(
      `<div class="cell-4">${job.completedStages} / ${job.stages}</div>`,
    );
    const buttons = $(`<div class="cell-4 text-right">`);

    const syncButton = $('<button>', {
      class: 'button cycle mif-2x mif-3d-rotation outline primary',
    });
    const downloadButton = $('<button>', {
      class: 'button cycle mif-2x mif-download outline primary',
    });
    const deleteButton = $('<button>', {
      class: 'button cycle mif-2x mif-cross outline alert',
    });

    row1.append(status);
    row1.append(steps);
    row1.append(buttons);
    buttons.append(syncButton);
    buttons.append(downloadButton);
    buttons.append(deleteButton);
    row2.append(
      $(
        `<div class="cell-12" data-role="progress" data-small="true" data-value="${
          job.progress * 100
        }"></div>`,
      ),
    );

    jobComponent.append($(`<span>${job.id}</span>`, { class: 'label' }));
    jobComponent.append(grid);
    grid.append(row1);
    grid.append(row2);

    syncButton.on('click', () => {
      this.subscribe(job.id);
    });
    downloadButton.on('click', () => {
      this.downloadJob(job.id);
    });
    deleteButton.on('click', () => {
      console.log('asdf');

      if (job.status == JobStatus.CANCELLED || job.status == JobStatus.DONE) {
        this.deleteJob(job.id);
      } else {
        this.cancelJob(job.id);
      }
    });

    return jobComponent;
  }

  updateJobComponent(component: any, job: Job) {}

  async getJobs() {
    console.log('Get Jobs');
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
        console.error('Error:', error);
        this.context.addMessage(error, 'alert');
      });
  }

  async getJob(id: string) {
    console.log('Get Job', id);
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
        this.context.addMessage(error, 'alert');
      });
  }

  async getJobDetails(id: string) {
    console.log('Get Job Details', id);
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
        this.context.addMessage(error, 'alert');
      });
  }

  async downloadJob(id: string) {
    console.log('Download Job', id);
    const headers = new Headers();
    headers.append('authorization', this.token);

    await fetch(this.host + '/job/download/' + id, {
      method: 'GET',
      headers: headers,
    })
      .then((response) => {
        if (response.ok) {
          const fileStream = streamSaver.createWriteStream(`job-${id}.zip`);
          response.body.pipeTo(fileStream).then(
            () => {},
            (e: Error) => {
              throw e;
            },
          );
          return;
        }
        throw new Error(response.statusText);
      })
      .catch((error) => {
        console.error('Error:', error);
        this.context.addMessage(error, 'alert');
      });
  }

  newSimulation() {
    const model = this.context.activeContext?.nm;
    if (!model) {
      throw `No nucleotide model found in the active context`;
    } else {
      const confs = this.readConfigs();

      this.submitJob(confs, model, {
        name: $('#sim-sims-name').val(),
        description: $('#sim-sims-description').val(),
      });
    }
  }

  async submitJob(
    confs: Config[],
    model: NucleotideModel,
    metadata: Record<string, string>,
  ) {
    console.log(metadata);

    console.log('Submit Job');
    const dat = model.toDat();
    const top = model.toTop();
    const forces = model.toExternalForces();

    const job = {
      configs: await this.getDefaultConfigs(),
      top: top,
      dat: dat,
      forces: forces,
      metadata: metadata,
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
        console.error('Error:', error);
        this.context.addMessage(error, 'alert');
      });
  }

  async deleteJob(id: string) {
    console.log('Delete Job', id);
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
        this.getJobs();
      })
      .catch((error) => {
        console.error('Error:', error);
        this.context.addMessage(error, 'alert');
      });
  }

  async cancelJob(id: string) {
    console.log('Cancel Job', id);
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
      .then((data) => {})
      .catch((error) => {
        console.error('Error:', error);
        this.context.addMessage(error, 'alert');
      });
  }

  async getSubscription() {
    console.log('GetSubscription');
    const headers = new Headers();
    headers.append('authorization', this.token);

    const id = await fetch(this.host + '/job/subscribe', {
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
        return data;
      })
      .catch((error) => {
        console.error('Error:', error);
        this.context.addMessage(error, 'alert');
      });
    return id;
  }

  async subscribe(id: string) {
    console.log('Subscribe', id);
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
        console.log(data);
      })
      .catch((error) => {
        console.error('Error:', error);
        this.context.addMessage(error, 'alert');
      });
  }

  async unsubscribe() {
    console.log('Unsubscribe');
    const headers = new Headers();
    headers.append('authorization', this.token);

    await fetch(this.host + '/job/subscribe', {
      method: 'DELETE',
      headers: headers,
    })
      .then((response) => {
        if (response.ok) {
          return response.text();
        }
        throw new Error(response.statusText);
      })
      .then((data) => {})
      .catch((error) => {
        console.error('Error:', error);
        this.context.addMessage(error, 'alert');
      });
  }
}
