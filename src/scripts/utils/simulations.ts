import { NATYPE } from '../globals/consts';
import { downloadTXT } from '../io/download';
import { read_json } from '../io/read_json';
import { binarySearch } from './misc_utils';
import { Context } from '../menus/context';
import { ModuleMenu } from '../menus/module_menu';
import { NucleotideModel } from '../models/nucleotide_model';
import * as streamSaver from 'streamsaver';

enum ValueType {
  BOOLEAN = 'BOOLEAN',
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
  createTrajectory: boolean;
  autoExtendStage: boolean;
  maxExtensions: number;
}

interface PropertiesConfig extends Config {
  properties: Property[];
}

interface FileConfig extends Config {
  content: string;
}

enum JobState {
  NEW = 'NEW',
  RUNNING = 'RUNNING',
  DONE = 'DONE',
  CANCELED = 'CANCELED',
}

interface Job {
  metadata: Metadata;
  id: number;
  stages: number;
  completedStages: number;
  status: JobState;
  initialSimSteps: number;
  simSteps: number;
  progress: number;
  initialStageSimSteps: number[];
  stageSimSteps: number[];
  stageProgress: number[];
  extensions: number[];
  error: string;
}

interface JobDetails {
  job: Job;
  top: string;
  dat: string;
  forces: string;
}

interface WebSocketAuthResponse {
  type: 'WebSocketAuthResponse';
  success: boolean;
}

interface JobUpdate {
  type: 'JobUpdate';
  JobId: number;
  job?: Job;
}

interface DetailedJobUpdate {
  type: 'DetailedUpdate';
  job: Job;
  top: string;
  dat: string;
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
      this.updateJobInList(message.jobId, message.job);
      if (message.job?.error) {
        console.error(message.job.error);
      }
    } else if (message.type == 'DetailedUpdate') {
      message = <DetailedJobUpdate>message;
      this.updateJobInList(message.job.id, message.job);
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
      console.log(`Unknown message via WebSocket: ${message}`);
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
        e.preventDefault();
        e.stopPropagation();
        $('#sim-window').show();
      });

    $('#sim-show').on('click', () => {
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

    // #sim-auth-with-token
    const tokenInput = $('#sim-auth-token-input');
    const tokenInputButton = $('#sim-auth-token-connect');
    tokenInputButton.on('click', () => {
      try {
        const accessToken = tokenInput.val() ? tokenInput.val() : null;
        this.auth(accessToken);
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
        this.getJobsAndUpdateList();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#sim-confs-new').on('click', () => {
      try {
        this.addConfigComponent();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#sim-confs-download').on('click', () => {
      try {
        downloadTXT(
          'simulation-stages.json',
          JSON.stringify(this.readConfigs()),
        );
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    // #sim-confs-upload
    const fileInput = $('#sim-stage-file-input');
    const fileInputButton = $('#sim-stage-file-input-open');
    fileInputButton.on('click', () => {
      try {
        const files = (<HTMLInputElement>fileInput[0]).files;
        const file = files[0]; // ignore all but the first file
        if (file.name.endsWith('.json')) {
          read_json(URL.createObjectURL(file), (json: Config[]) => {
            this.setupConfigComponents(json);
          });
        } else {
          this.context.addMessage('Expected JSON file.', '');
        }
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

    // fix the configuration file reordering bug in Mozilla Firefox
    $('#sim-configs').on('selectstart', (e: any) => {
      e.preventDefault();
    });
  }

  setAuthStatus(status: string) {
    $('#sim-auth-status').html(status);
  }

  setParams() {}

  async auth(accessToken: string | null = null) {
    console.log('Auth');
    await fetch(this.host + '/auth', {
      method: 'GET',
      headers: {
        'Content-Type': 'text/plain',
        Authorization: accessToken,
      },
    })
      .then((response) => {
        if (response.ok) {
          return response.text();

          // try using an access token, if that wasn't already tried
        } else if (accessToken === null) {
          Metro.dialog.open('#sim-auth-with-token');
          return null;
        }
      })
      .then((data) => {
        if (data !== null) {
          this.token = data;
          this.setAuthStatus(`Connected. ID: ${data}`);
        }
      })
      .catch((error) => {
        console.error('Error:', error);
        this.token = null;
        this.setAuthStatus(`Failed to connect.`);
        this.context.addMessage(error, 'alert');
      });

    if (this.token !== undefined && this.token !== null) {
      // Open WebSocket first to avoid missing job state changes after the first job list fetch
      this.openWebSocket();

      this.availableProperties = await this.getAvailableProperties();
      this.defaultConfigs = await this.getDefaultConfigs();
      this.setupConfigComponents(this.defaultConfigs);

      this.getJobsAndUpdateList();
    }
  }

  openWebSocket() {
    console.log('Open Websocket');
    this.socket = new WebSocket(this.host.replace('http://', 'ws://'));
    this.socket.addEventListener('open', () => {
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

  addConfigComponent() {
    const config: Config = {
      type: 'PropertiesConfig',
      metadata: {
        title: 'New Stage',
        description: 'Another Simulation Stage',
      },
      createTrajectory: true,
      autoExtendStage: true,
      maxExtensions: 5,
      properties: this.availableProperties,
    } as PropertiesConfig;
    $('#sim-params').append(this.createConfigComponent(config, false));
  }

  createConfigComponent(config: Config, collapsed: boolean = true) {
    const confComponent = $('<li>');
    const confContainer = $('<div>', {
      'data-role': 'panel',
      'data-title-caption': `${config.metadata.title}`,
      'data-collapsible': true,
      'data-collapsed': collapsed,
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
    $('<textarea>', {
      'data-role': 'textarea',
      'data-default-value': config.metadata.description,
      'data-name': 'stage-description',
    }).appendTo(confContainer);

    // create trajectory
    const createTrajectory = $('<select>', {
      'data-prepend': 'Create Trajectory',
      'data-role': 'select',
      'data-name': 'create-trajectory',
    });

    $('<option>', {
      value: true,
    })
      .text('True')
      .appendTo(createTrajectory);

    $('<option>', {
      value: false,
    })
      .text('False')
      .appendTo(createTrajectory);

    createTrajectory.val(config.createTrajectory);
    confContainer.append(createTrajectory);

    // auto extend stage
    const autoExtendStage = $('<select>', {
      'data-prepend': 'Auto Extend Stage',
      'data-role': 'select',
      'data-name': 'auto-extend-stage',
    });

    $('<option>', {
      value: true,
    })
      .text('True')
      .appendTo(autoExtendStage);

    $('<option>', {
      value: false,
    })
      .text('False')
      .appendTo(autoExtendStage);

    autoExtendStage.val(config.autoExtendStage);
    confContainer.append(autoExtendStage);

    // auto extend limit
    // container is required to hide the data-prepend label as well
    const autoExtendLimitContainer = $('<div>');
    $('<input>', {
      type: 'number',
      min: 0,
      'data-prepend': 'Max. Extensions',
      'data-role': 'input',
      'data-default-value': config.maxExtensions,
      'data-name': 'auto-extend-stage-limit',
    }).appendTo(autoExtendLimitContainer);
    confContainer.append(autoExtendLimitContainer);
    if (autoExtendStage.val() !== 'true') {
      autoExtendLimitContainer.hide();
    }

    // register select change event
    autoExtendStage.on('change', (event: Event) => {
      const target = $(event.target);
      if (target.val() === 'true') {
        autoExtendLimitContainer.show();
      } else {
        autoExtendLimitContainer.hide();
      }
    });

    // create config type tabs
    const configTypeTabs = $('<ul>', {
      'data-role': 'tabs',
      'data-tabs-type': 'group',
      'data-expand': 'true',
      style: 'margin-top: 10px;',
    });

    const manualTab = $('<li>').append(
      $('<a>', {
        href: '#manual_config',
      }).text('Manual Config'),
    );
    configTypeTabs.append(manualTab);

    const fileTab = $('<li>').append(
      $('<a>', {
        href: '#file_config',
      }).text('oxDNA Input File'),
    );
    configTypeTabs.append(fileTab);

    confContainer.append(configTypeTabs);
    // Initialize MetroUI tabs
    configTypeTabs.tabs();

    const manualConfContainer = $('<div>', {
      'data-name': 'stage-manual',
    });
    confContainer.append(manualConfContainer);

    const fileConfContainer = $('<div>', {
      'data-name': 'stage-file',
    });
    confContainer.append(fileConfContainer);

    // register tab change event
    configTypeTabs.on('tab', (event: CustomEvent) => {
      const currentTab = $(event.target).find('li.active');
      const clickedTab = $(event.detail.tab);

      if (currentTab.text() !== clickedTab.text()) {
        if (clickedTab.text() === 'Manual Config') {
          fileConfContainer.hide();
          manualConfContainer.show();
        } else {
          manualConfContainer.hide();
          fileConfContainer.show();
        }
      }
    });

    // open correct tab
    if (config.type === 'PropertiesConfig') {
      const propConf = <PropertiesConfig>config;

      for (const prop of propConf.properties) {
        manualConfContainer.append(this.createPropertyElement(prop));
      }
      $('<textarea>', {
        'data-role': 'textarea',
        'data-default-value': '',
        'data-name': 'file-content',
      }).appendTo(fileConfContainer);

      configTypeTabs.data('tabs').open(manualTab);
      fileConfContainer.hide();
    } else if (config.type === 'FileConfig') {
      const fileConf = <FileConfig>config;

      $('<textarea>', {
        'data-role': 'textarea',
        'data-default-value': fileConf.content,
        'data-name': 'file-content',
      }).appendTo(fileConfContainer);
      for (const prop of this.availableProperties) {
        manualConfContainer.append(this.createPropertyElement(prop));
      }

      configTypeTabs.data('tabs').open(fileTab);
      manualConfContainer.hide();
    } else {
      throw new Error('Unknown Config type!');
    }

    return confComponent;
  }

  createPropertyElement(prop: Property) {
    let el;

    switch (prop.valueType) {
      case ValueType.BOOLEAN:
        el = $('<select>', {
          'data-prepend': prop.name,
          'data-role': 'select',
          'data-name': prop.name,
        });

        $('<option>', {
          value: 'true',
        })
          .text('True')
          .appendTo(el);

        $('<option>', {
          value: 'false',
        })
          .text('False')
          .appendTo(el);

        // select default value if available
        if (prop.value) {
          el = el.val(prop.value);
        }
        break;

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
        $('<option>', {
          value: null,
        })
          .text(null)
          .appendTo(el);

        if (prop.possibleValues) {
          for (const value of prop.possibleValues) {
            $('<option>', {
              value: value,
            })
              .text(value)
              .appendTo(el);
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
      let title: string;
      for (const i of Array.from($(c).find('div'))) {
        const el = $(i);
        if (el.attr('data-name') === 'stage-title') {
          title = el.attr('data-title-caption');
          break;
        }
      }
      let description: string;
      for (const i of Array.from($(c).find('textarea'))) {
        const el = $(i);
        if (el.attr('data-name') === 'stage-description') {
          description = el.val();
          break;
        }
      }
      let createTrajectory: boolean;
      let autoExtendStage: boolean;
      for (const i of Array.from($(c).find('select'))) {
        const el = $(i);
        if (el.attr('data-name') === 'create-trajectory') {
          createTrajectory = el.val() === 'true';
        } else if (el.attr('data-name') === 'auto-extend-stage') {
          autoExtendStage = el.val() === 'true';
        }
      }
      let autoExtendLimit: number;
      for (const i of Array.from($(c).find('input'))) {
        const el = $(i);
        if (el.attr('data-name') === 'auto-extend-stage-limit') {
          autoExtendLimit = parseInt(el.val());
          break;
        }
      }
      let type: string;
      for (const i of Array.from($(c).find('ul'))) {
        const el = $(i);
        if (el.find('li.active').text() === 'Manual Config') {
          type = 'PropertiesConfig';
        } else if (el.find('li.active').text() === 'oxDNA Input File') {
          type = 'FileConfig';
        }
      }

      const meta: Metadata = {
        title: title,
        description: description,
      };
      const config: Config =
        type === 'PropertiesConfig'
          ? ({
              type: 'PropertiesConfig',
              metadata: meta,
              createTrajectory: createTrajectory,
              autoExtendStage: autoExtendStage,
              maxExtensions: autoExtendLimit,
              properties: this.readProperties(c),
            } as PropertiesConfig)
          : ({
              type: 'FileConfig',
              metadata: meta,
              createTrajectory: createTrajectory,
              autoExtendStage: autoExtendStage,
              maxExtensions: autoExtendLimit,
              content: this.readOxDnaFile(c),
            } as FileConfig);
      configs.push(config);
    }
    return configs;
  }

  readProperties(c: unknown): Property[] {
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
    return props;
  }

  readOxDnaFile(c: unknown): string {
    for (const i of Array.from($(c).find('textarea'))) {
      const el = $(i);
      if (el.attr('data-name') === 'file-content') {
        return el.val();
      }
    }
    return '';
  }

  async getDefaultConfigs(): Promise<Config[]> {
    console.log('Get Default Configs');
    const headers = new Headers();
    headers.append('authorization', this.token);

    return await fetch(this.host + '/options/default/properties', {
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
  }

  async getAvailableProperties(): Promise<Property[]> {
    console.log('Get Available Properties');
    const headers = new Headers();
    headers.append('authorization', this.token);

    return await fetch(this.host + '/options/available/properties', {
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
  }

  updateJobList(jobs: Job[]) {
    const jobsMap: { [id: number]: Job } = {};
    jobs.forEach((job) => {
      jobsMap[job.id] = job;
    });

    const elementsMap: { [id: number]: any } = {};

    const jobsElement = $('#sim-jobs-list');
    const children = jobsElement.children();

    // remove unneeded elements
    // keep track of which job elements already exist
    children.each(function () {
      const jobElement = $(this);
      const jobId = jobElement.attr('data-job-id');

      if (jobId in jobsMap) {
        elementsMap[jobId] = jobElement;
      } else {
        jobElement.remove();
      }
    });

    // create a sorted array of IDs
    const sortedIds = Object.keys(elementsMap)
      .map((id) => parseInt(id))
      .sort((a, b) => a - b);

    // update job elements
    // add new job elements if needed
    jobs.forEach((job) => {
      if (job.id in elementsMap) {
        this.updateJobComponent(elementsMap[job.id], job);
      } else {
        const newJobElement = this.createJobComponent(job);

        // find the correct position to insert the new job element
        const insertBeforeIndex = binarySearch(sortedIds, job.id);

        // insert new job element at correct position
        if (insertBeforeIndex >= sortedIds.length) {
          newJobElement.appendTo(jobsElement);
        } else {
          jobsElement.insertBefore(
            newJobElement,
            elementsMap[sortedIds[insertBeforeIndex]],
          );
        }

        // update elements map and sortedIds
        elementsMap[job.id] = newJobElement;
        sortedIds.splice(insertBeforeIndex + 1, 0, job.id);
      }
    });
  }

  updateJobInList(jobId: number, job?: Job) {
    const elementsMap: { [id: number]: any } = {};

    const jobsElement = $('#sim-jobs-list');
    const children = jobsElement.children();

    children.each(function () {
      const jobElement = $(this);
      const jobId = jobElement.attr('data-job-id');

      elementsMap[jobId] = jobElement;
    });

    if (job === null || job === undefined) {
      // remove element
      if (jobId in elementsMap) {
        elementsMap[jobId].remove();
      }
    } else {
      // add or update job element
      if (job.id in elementsMap) {
        this.updateJobComponent(elementsMap[job.id], job);
      } else {
        this.createJobComponent(job).appendTo(jobsElement);
      }
    }
  }

  createJobComponent(job: Job) {
    const statusValues = this.generateStatusValues(job);

    const jobComponent = $('<li>', {
      'data-job-id': job.id,
    });

    const grid = $('<div>', { class: 'grid' });
    const row1 = $('<div>', { class: 'row' });
    const row2 = $('<div>', { class: 'row' });
    const row3 = $('<div>', { class: 'row' });

    const state = $(`<div class="cell-4">${job.status}</div>`);
    const status = $(`<div class="cell-4">${statusValues[0]}</div>`);
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

    row1.append(state);
    row1.append(status);
    row1.append(buttons);
    buttons.append(syncButton);
    buttons.append(downloadButton);
    buttons.append(deleteButton);
    row2.append(
      $(
        `<div class="cell-12" data-role="progress" data-small="true" data-value="${statusValues[1]}"></div>`,
      ),
    );
    row3.append(
      $(
        `<div class="cell-12" data-role="progress" data-small="true" data-value="${statusValues[2]}"></div>`,
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
      if (job.status == JobState.CANCELED || job.status == JobState.DONE) {
        this.deleteJob(job.id);
      } else {
        this.cancelJob(job.id);
      }
    });

    return jobComponent;
  }

  updateJobComponent(component: any, job: Job) {
    const statusValues = this.generateStatusValues(job);

    // Update status and stage
    component.find('.cell-4:first-child').text(job.status);
    component.find('.cell-4:nth-child(2)').text(statusValues[0]);

    // Update progress bars
    component
      .find('[data-role="progress"]')
      .eq(0)
      .attr('data-value', statusValues[1]);
    component
      .find('[data-role="progress"]')
      .eq(1)
      .attr('data-value', statusValues[2]);

    // Update button click handler based on job status
    const deleteButton = component.find('.mif-cross');
    deleteButton.off('mousedown');
    if (job.status === JobState.CANCELED || job.status === JobState.DONE) {
      deleteButton.on('mousedown', () => {
        this.deleteJob(job.id);
      });
    } else {
      deleteButton.on('mousedown', () => {
        this.cancelJob(job.id);
      });
    }
  }

  generateStatusValues(job: Job): [string, number, number] {
    let statusLabel: string;
    switch (job.status) {
      case JobState.NEW:
        statusLabel = 'Pending';
        break;
      case JobState.RUNNING:
        statusLabel =
          job.extensions[job.completedStages] === 0
            ? `Running stage ${job.completedStages + 1} / ${job.stages}`
            : `Extending stage ${job.completedStages + 1}: ${
                job.extensions[job.completedStages]
              }`;
        break;
      case JobState.DONE:
        statusLabel = 'Completed';
        break;
      case JobState.CANCELED:
        statusLabel = `Completed ${job.completedStages} / ${job.stages} stages`;
        break;
    }

    const stageProgress =
      job.completedStages === job.stages
        ? 0
        : (job.stageProgress[job.completedStages] /
            job.stageSimSteps[job.completedStages]) *
          100;
    const overallProgress = (job.progress / job.simSteps) * 100;

    return [statusLabel, stageProgress, overallProgress];
  }

  async getJobsAndUpdateList() {
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

  async getJob(id: string): Promise<Job> {
    console.log('Get Job', id);
    const headers = new Headers();
    headers.append('authorization', this.token);

    return await fetch(this.host + '/job/' + id, {
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
  }

  async getJobDetails(id: string): Promise<JobDetails> {
    console.log('Get Job Details', id);
    const headers = new Headers();
    headers.append('authorization', this.token);

    return await fetch(this.host + '/job/details/' + id, {
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
  }

  async downloadJob(id: number) {
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
      .catch((error) => {
        console.error('Error:', error);
        this.context.addMessage(error, 'alert');
      });
  }

  async deleteJob(id: number) {
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
      .catch((error) => {
        console.error('Error:', error);
        this.context.addMessage(error, 'alert');
      });
  }

  async cancelJob(id: number) {
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
      .catch((error) => {
        console.error('Error:', error);
        this.context.addMessage(error, 'alert');
      });
  }

  async getSubscription() {
    console.log('Get Subscription');
    const headers = new Headers();
    headers.append('authorization', this.token);

    return await fetch(this.host + '/job/subscribe', {
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
  }

  async subscribe(id: number) {
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
      .then(() => {
        this.activeModel = null;
      })
      .catch((error) => {
        console.error('Error:', error);
        this.context.addMessage(error, 'alert');
      });
  }
}
