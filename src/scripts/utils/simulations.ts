import { NATYPE } from '../globals/consts';
import { downloadTXT } from '../io/download';
import { Context } from '../menus/context';
import { ModuleMenu } from '../menus/module_menu';
import { NucleotideModel } from '../models/nucleotide_model';
import * as streamSaver from 'streamsaver';

enum ValueType {
  UNSIGNED_INTEGER = 'UNSIGNED_INTEGER',
  FLOAT = 'FLOAT',
  ENUM = 'ENUM',
}

interface Property {
  name: string;
  valueType: ValueType;
  possibleValues?: string[];
  value?: string;
}

interface Metadata {
  title: string;
  description: string;
  algorithm?: string;
  scale?: string;
  naType?: string;
}

interface Config {
  type: string;
  metadata: Metadata;
  autoExtendStage: boolean;
  maxExtensions: number;
  properties: Property[];
}

interface Message {
  type: string;
  error: string;
}

interface Job {
  metadata: Metadata;
  id: string;
  stages: number;
  completedStages: number;
  status: string;
  initialSimSteps: number;
  simSteps: number;
  progress: number;
  initialStageSimSteps: number[];
  stageSimSteps: number[];
  stageProgress: number[];
  extensions: number;
  error: string;
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
  dat: string;
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

  availableProperties: Property[];
  defaultConfigs: Config[];

  activeModel: NucleotideModel = null;
  mutex = false;

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
    const conf = t.dat;
    const top = t.top;
    const algorithm = t.job.metadata.algorithm;
    const scale = parseFloat(t.job.metadata.scale);
    const naType = <NATYPE>t.job.metadata.naType;
    const menu = <ModuleMenu>this.context.menus.get(algorithm);
    if (!menu) throw `Unrecognised algorithm ${algorithm}`;
    if (conf.length < 1) throw `Invalid dat`;
    if (top.length < 1) throw `Invalid top`;

    if (this.mutex) return;
    this.mutex = true;
    if (this.activeModel && this.activeModel == menu.nm) {
      menu.updateFromOxDNA(conf);
    } else {
      if (this.context.activeContext != menu) this.context.switchContext(menu);
      menu.loadOxDNA(top, conf, scale, naType);
      this.activeModel = menu.nm;
    }
    this.mutex = false;
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
        console.error('TODO');
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
        this.setupConfigComponents(this.defaultConfigs);
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
      })
      .catch((error) => {
        console.error('Error:', error);
        this.token = null;
        this.setAuthStatus(`Failed to connect.`);
        this.context.addMessage(error, 'alert');
      });

    if (this.token !== null) {
      this.availableProperties = await this.getAvailableProperties();
      this.defaultConfigs = await this.getDefaultConfigs();
      this.setupConfigComponents(this.defaultConfigs);
      this.getJobs();
      this.openWebSocket();
    }
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
      $('#sim-params').append(this.createConfigComponent(c));
    }
  }

  createConfigComponent(config: Config) {
    const confComponent = $('<li>');
    const confContainer = $('<div>', {
      'data-role': 'panel',
      'data-title-caption': `${config.metadata.title}`,
      'data-collapsible': true,
      'data-name': 'stage-title',
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

    // description
    const description = $('<textarea>', {
      'data-role': 'textarea',
      'data-default-value': config.metadata.description,
      'data-name': 'stage-description',
    });
    confContainer.append(description);

    // auto extend stage
    const autoExtendStage = $('<select>', {
      'data-prepend': 'Auto Extend Stage',
      'data-role': 'select',
      'data-name': 'auto-extend-stage',
    });

    const autoTrue = $('<option>', {
      value: true,
    }).text('True');
    autoExtendStage.append(autoTrue);

    const autoFalse = $('<option>', {
      value: false,
    }).text('False');
    autoExtendStage.append(autoFalse);

    autoExtendStage.val(config.autoExtendStage);
    confContainer.append(autoExtendStage);

    // auto extend limit
    const autoExtendLimit = $('<input>', {
      type: 'number',
      min: 0,
      'data-prepend': 'Max. Extensions',
      'data-role': 'input',
      'data-default-value': config.maxExtensions,
      'data-name': 'auto-extend-stage-limit',
    });
    confContainer.append(autoExtendLimit);

    for (const prop of config.properties) {
      confContainer.append(this.createPropertyElement(prop));
    }

    return confComponent;
  }

  createPropertyElement(prop: Property) {
    let el;

    switch (prop.valueType) {
      case ValueType.UNSIGNED_INTEGER:
        el = $('<input>', {
          type: 'number',
          min: 0,
          'data-prepend': prop.name,
          'data-role': 'input',
          'data-default-value': prop.value,
          'data-name': prop.name,
        });
        break;

      case ValueType.FLOAT:
        el = $('<input>', {
          type: 'number',
          step: 'any',
          'data-prepend': prop.name,
          'data-role': 'input',
          'data-default-value': prop.value,
          'data-name': prop.name,
        });
        break;

      case ValueType.ENUM:
        el = $('<select>', {
          'data-prepend': prop.name,
          'data-role': 'select',
          'data-name': prop.name,
        });

        // needed for properties without default value
        const blank = $('<option>', {
          value: null,
        }).text(null);
        el.append(blank);

        if (prop.possibleValues) {
          for (const value of prop.possibleValues) {
            const option = $('<option>', {
              value: value,
            }).text(value);
            el.append(option);
          }
        }

        // select default value if available
        if (prop.value) {
          el = el.val(prop.value);
        }
        break;
    }
    return el;
  }

  readConfigs(): Config[] {
    const configs: Config[] = [];
    for (const c of Array.from($('#sim-params').children())) {
      const props = structuredClone(this.availableProperties);
      const propertyMap: { [id: string]: Property } = {};

      props.forEach((prop) => {
        propertyMap[prop.name] = prop;
      });

      for (const i of Array.from($(c).find('input'))) {
        const el = $(i);
        const propName = el.attr('data-name');
        const prop = propertyMap[propName];

        if (prop !== undefined) {
          prop.value = el.val();
        }
      }
      for (const i of Array.from($(c).find('select'))) {
        const el = $(i);
        const propName = el.attr('data-name');
        const prop = propertyMap[propName];

        if (prop !== undefined) {
          prop.value = el.val();
        }
      }

      var title: string;
      for (const i of Array.from($(c).find('div'))) {
        const el = $(i);
        if (el.attr('data-name') === 'stage-title') {
          title = el.attr('data-title-caption');
        }
      }
      var description: string;
      for (const i of Array.from($(c).find('textarea'))) {
        const el = $(i);
        if (el.attr('data-name') === 'stage-description') {
          description = el.val();
        }
      }
      var autoExtendStage: boolean;
      for (const i of Array.from($(c).find('select'))) {
        const el = $(i);
        if (el.attr('data-name') === 'auto-extend-stage') {
          autoExtendStage = el.val() === 'true';
        }
      }
      var autoExtendLimit: number;
      for (const i of Array.from($(c).find('input'))) {
        const el = $(i);
        if (el.attr('data-name') === 'auto-extend-stage-limit') {
          autoExtendLimit = parseInt(el.val());
        }
      }
      const meta: Metadata = {
        title: title,
        description: description,
      };
      const config: Config = {
        type: 'PropertiesConfig',
        metadata: meta,
        autoExtendStage: autoExtendStage,
        maxExtensions: autoExtendLimit,
        properties: props,
      };
      configs.push(config);
    }
    return configs;
  }

  async getDefaultConfigs(): Promise<Config[]> {
    console.log('Get Default Configs');
    const headers = new Headers();
    headers.append('authorization', this.token);

    const confs = await fetch(this.host + '/options/default/properties', {
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
    return confs;
  }

  async getAvailableProperties(): Promise<Property[]> {
    console.log('Get Config Full');
    const headers = new Headers();
    headers.append('authorization', this.token);

    const conf = await fetch(this.host + '/options/available/properties', {
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
    /**
    console.log(job);
    console.log(
      job.completedStages,
      job.stageProgress[job.completedStages - 1],
      job.stageSimSteps[job.completedStages - 1],
      job.stageProgress[job.completedStages - 1] / job.initialStageSimSteps[job.completedStages - 1] * 100);
     */

    const jobComponent = $('<li>', {
      'data-job-id': job.id,
    });

    const grid = $('<div>', { class: 'grid' });
    const row1 = $('<div>', { class: 'row' });
    const row2 = $('<div>', { class: 'row' });
    const row3 = $('<div>', { class: 'row' });

    const status = $(`<div class="cell-4">${job.status}</div>`);
    const steps = $(
      `<div class="cell-4">Completed ${job.completedStages} / ${job.stages}</div>`,
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
          (job.stageProgress[job.completedStages] /
            job.stageSimSteps[job.completedStages]) *
          100
        }"></div>`,
      ),
    );
    row3.append(
      $(
        `<div class="cell-12" data-role="progress" data-small="true" data-value="${
          (job.progress / job.simSteps) * 100
        }"></div>`,
      ),
    );

    jobComponent.append($(`<span>${job.id}</span>`, { class: 'label' }));
    jobComponent.append(grid);
    grid.append(row1);
    grid.append(row2);
    grid.append(row3);

    syncButton.on('mousedown', () => {
      this.subscribe(job.id);
    });
    downloadButton.on('mousedown', () => {
      this.downloadJob(job.id);
    });
    deleteButton.on('mousedown', () => {
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
      this.submitJob(this.readConfigs(), model, {
        title: $('#sim-sims-name').val(),
        description: $('#sim-sims-description').val(),
        algorithm: this.context.activeContext.elementId,
        scale: model.scale.toString(),
        naType: model.naType,
      });
    }
  }

  async submitJob(
    configs: Config[],
    model: NucleotideModel,
    metadata: Metadata,
  ) {
    console.log('Submit Job');
    const dat = model.toDat();
    const top = model.toTop();
    const forces = model.toExternalForces();

    const job = {
      configs: configs,
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

    await this.unsubscribe();

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
      .then((data) => {
        this.activeModel = null;
      })
      .catch((error) => {
        console.error('Error:', error);
        this.context.addMessage(error, 'alert');
      });
  }
}
