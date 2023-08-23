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
}

interface Entry {
  type: 'Option' | 'Container' | 'Property';
  name: string;
}

interface Option extends Entry {
  type: 'Option';
  entries: Entry[];
}

interface OptionContainer extends Entry {
  type: 'Container';
  values: Option[];
}

interface Property extends Entry {
  type: 'Property';
  valueType: ValueType;
}

interface SelectedProperty {
  name: string;
  value: string;
}

interface Metadata {
  title: string;
  description: string;
  algorithm?: string;
  scale?: string;
  naType?: string;
}

interface Config {
  type: 'FileConfig' | 'ManualConfig';
  metadata: Metadata;
  createTrajectory: boolean;
  autoExtendStage: boolean;
  maxExtensions: number;
}

interface FileConfig extends Config {
  type: 'FileConfig';
  content: string;
}

interface ManualConfig extends Config {
  type: 'ManualConfig';
  properties: SelectedProperty[];
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

  headers: Headers;

  availableOptions: Option;
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
    $('#sim-configs').on('selectstart', (e: Event) => {
      e.preventDefault();
    });
  }

  setAuthStatus(status: string) {
    $('#sim-auth-status').html(status);
  }

  async auth(accessToken: string | null = null) {
    console.log('Auth');
    const headers = new Headers();
    headers.append('Authorization', accessToken);

    await fetch(this.host + '/auth', {
      method: 'GET',
      headers: headers,
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

      this.headers = new Headers();
      this.headers.append('Authorization', this.token);
      this.headers.append('Content-Type', 'application/json');

      this.availableOptions = await this.getAvailableOptions();
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
    const config: Config = structuredClone(
      this.defaultConfigs[this.defaultConfigs.length - 1],
    );
    config.metadata.title = 'New Stage';
    config.metadata.description = 'Another Simulation Stage';
    $('#sim-params').append(this.createConfigComponent(config, false));
  }

  createConfigComponent(config: Config, collapsed: boolean = true): any {
    const confComponent = $('<li>');
    const confContainer = $('<div>', {
      'data-role': 'panel',
      'data-title-caption': `${config.metadata.title}`,
      'data-collapsible': true,
      'data-collapsed': collapsed,
      'data-name': 'stage-title',
    });
    confContainer.on('mousedown', (e: Event) => {
      e.stopPropagation();
    });
    confContainer.on('panelCreate', (e: CustomEvent) => {
      const toggleButton = e.detail.element.parent().find('.dropdown-toggle');
      const customButtons = $('<div>', { class: 'custom-buttons' });
      const closeButton = $('<button>', { class: 'button btn-custom alert' });
      closeButton.append($('<span>', { class: 'mif-cross' }));
      customButtons.append(closeButton);
      toggleButton.before(customButtons);

      toggleButton.on('mousedown', (e2: Event) => {
        e2.stopPropagation();
      });
      closeButton.on('mousedown', (e2: Event) => {
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
    autoExtendStage.on('itemSelect', (e: CustomEvent) => {
      if (e.detail.val === 'true') {
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

    const manualTab = $('<li>', {
      'data-name': 'config-type-tab',
    }).append(
      $('<a>', {
        href: '#manual_config',
      }).text('Manual Config'),
    );
    configTypeTabs.append(manualTab);

    const fileTab = $('<li>', {
      'data-name': 'config-type-tab',
    }).append(
      $('<a>', {
        href: '#file_config',
      }).text('oxDNA Input File'),
    );
    configTypeTabs.append(fileTab);

    confContainer.append(configTypeTabs);

    const manualConfContainer = $('<div>', {
      'data-role': 'panel',
      'data-name': 'stage-manual',
    });
    confContainer.append(manualConfContainer);

    const fileConfContainer = $('<div>', {
      'data-role': 'panel',
      'data-name': 'stage-file',
    });
    confContainer.append(fileConfContainer);

    // Initialize MetroUI tabs
    configTypeTabs.tabs();

    // register tab change event
    configTypeTabs.on('tab', (e: CustomEvent) => {
      const currentTab = $(e.target).find('li.active');
      const clickedTab = $(e.detail.tab);

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
    switch (config.type) {
      case 'FileConfig':
        const fileConf = <FileConfig>config;

        fileConfContainer.append(this.createOxFileElement(fileConf.content));
        this.appendOptionElement(
          this.availableOptions,
          {},
          manualConfContainer,
        );

        configTypeTabs.data('tabs').open(fileTab);
        manualConfContainer.hide();
        break;

      case 'ManualConfig':
        const propConf = <ManualConfig>config;

        const propertyMap: { [id: string]: SelectedProperty } = {};
        propConf.properties.forEach((prop) => {
          propertyMap[prop.name] = prop;
        });
        this.appendOptionElement(
          this.availableOptions,
          propertyMap,
          manualConfContainer,
        );
        fileConfContainer.append(this.createOxFileElement(''));

        configTypeTabs.data('tabs').open(manualTab);
        fileConfContainer.hide();
        break;

      default:
        throw new Error(`Unknown Config type: ${config.type}`);
    }

    return confComponent;
  }

  createOxFileElement(content: string) {
    return $('<textarea>', {
      'data-role': 'textarea',
      'data-default-value': content,
      'data-name': 'ox-dna-file-content',
    });
  }

  appendOptionElement(
    option: Option,
    selected: { [id: string]: SelectedProperty },
    container: any,
  ) {
    for (const entry of option.entries) {
      switch (entry.type) {
        case 'Option':
          // should not happen, but it doesn't hurt to have this case...
          this.appendOptionElement(<Option>entry, selected, container);
          break;

        case 'Container':
          this.appendOptionContainerElement(
            <OptionContainer>entry,
            selected,
            container,
          );
          break;

        case 'Property':
          this.appendPropertyElement(<Property>entry, selected, container);
          break;

        default:
          throw new Error(`Unknown Entry type: ${entry.type}`);
      }
    }
  }

  appendOptionContainerElement(
    optionContainer: OptionContainer,
    selected: { [id: string]: SelectedProperty },
    container: any,
  ): any {
    const selectedName: string = selected[optionContainer.name]
      ? selected[optionContainer.name].value
        ? selected[optionContainer.name].value
        : optionContainer.values[0].name
      : optionContainer.values[0].name;

    const select = $('<select>', {
      'data-prepend': optionContainer.name,
      'data-role': 'select',
      'data-name': optionContainer.name,
    });
    container.append(select);

    // store reference to shown subContainer
    let shownSubContainer: any = null;

    select.on('itemSelect', (e: CustomEvent) => {
      if (shownSubContainer) {
        shownSubContainer.hide();
      }
      shownSubContainer = container.find(
        `[data-name="${optionContainer.name}.${e.detail.val}"]`,
      );
      if (shownSubContainer) {
        shownSubContainer.show();
      }
    });

    for (const option of optionContainer.values) {
      $('<option>', {
        value: option.name,
      })
        .text(option.name)
        .appendTo(select);

      // options with no entries don't need a container.
      if (option.entries.length === 0) {
        continue;
      }

      // create container for option entries
      const subContainer = $('<div>', {
        'data-role': 'panel',
        'data-name': `${optionContainer.name}.${option.name}`,
      });
      this.appendOptionElement(option, selected, subContainer);
      container.append(subContainer);
      if (selectedName === option.name) {
        shownSubContainer = subContainer;
      } else {
        subContainer.hide();
      }
    }

    select.val(selectedName);
  }

  appendPropertyElement(
    prop: Property,
    selected: { [id: string]: SelectedProperty },
    container: any,
  ) {
    const value: string | null = selected[prop.name]
      ? selected[prop.name].value
        ? selected[prop.name].value
        : null
      : null;

    switch (prop.valueType) {
      case ValueType.BOOLEAN:
        const el = $('<select>', {
          'data-prepend': prop.name,
          'data-role': 'select',
          'data-name': prop.name,
        });
        el.appendTo(container);

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
        if (value != null) {
          el.val(value);
        }
        break;

      case ValueType.UNSIGNED_INTEGER:
        $('<input>', {
          type: 'number',
          min: 0,
          'data-prepend': prop.name,
          'data-role': 'input',
          'data-default-value': value,
          'data-name': prop.name,
        }).appendTo(container);
        break;

      case ValueType.FLOAT:
        $('<input>', {
          type: 'number',
          step: 'any',
          'data-prepend': prop.name,
          'data-role': 'input',
          'data-default-value': value,
          'data-name': prop.name,
        }).appendTo(container);
        break;

      default:
        throw new Error(`Unknown Value type: ${prop.valueType}`);
    }
  }

  readConfigs(): Config[] {
    const configs: Config[] = [];
    for (const c of Array.from($('#sim-params').children())) {
      const panelContent = $($($(c).children()[0]).children()[0]);

      const title: string = panelContent.attr('data-title-caption');
      const description: string = panelContent
        .find('[data-name="stage-description"]')
        .val();

      const createTrajectory: boolean =
        panelContent.find('[data-name="create-trajectory"]').val() === 'true';
      const autoExtendStage: boolean =
        panelContent.find('[data-name="auto-extend-stage"]').val() === 'true';
      const autoExtendLimit: number = parseInt(
        panelContent.find('[data-name="auto-extend-stage-limit"]').val(),
      );

      let type: string;
      for (const i of Array.from(panelContent.find('li.active'))) {
        const tab = $(i);
        if (tab.attr('data-name') !== 'config-type-tab') {
          continue;
        }
        if (tab.text() === 'Manual Config') {
          type = 'PropertiesConfig';
        } else if (tab.text() === 'oxDNA Input File') {
          type = 'FileConfig';
        } else {
          throw new Error(`Unknown tab: ${tab.text()}`);
        }
        break;
      }

      const meta: Metadata = {
        title: title,
        description: description,
      };
      const config: Config =
        type === 'PropertiesConfig'
          ? ({
              type: 'ManualConfig',
              metadata: meta,
              createTrajectory: createTrajectory,
              autoExtendStage: autoExtendStage,
              maxExtensions: autoExtendLimit,
              properties: this.readProperties(
                panelContent.find('[data-name="stage-manual"]'),
              ),
            } as ManualConfig)
          : ({
              type: 'FileConfig',
              metadata: meta,
              createTrajectory: createTrajectory,
              autoExtendStage: autoExtendStage,
              maxExtensions: autoExtendLimit,
              content: this.readOxDnaFile(
                panelContent.find('[data-name="stage-file"]'),
              ),
            } as FileConfig);
      configs.push(config);
    }
    return configs;
  }

  readProperties(child: any): SelectedProperty[] {
    const props: SelectedProperty[] = [];

    // store sub-panels for easy access later on
    const subPanels: { [name: string]: any } = {};
    for (const div of Array.from(child.children('.panel'))) {
      const subPanel = $($(div).children()[0]);
      if (subPanel.attr('data-name')) {
        subPanels[subPanel.attr('data-name')] = subPanel;
      }
    }

    // inputs are wrapped in a div with class 'input'
    for (const div of Array.from(child.children('.input'))) {
      // select actual input element
      const input = $($(div).children('input'));
      const name = input.attr('data-name');
      const value = input.val();
      props.push({ name: name, value: value });
    }
    // selects are wrapped in a label with class 'select'
    for (const label of Array.from(child.children('.select'))) {
      // select actual select element
      const select = $($(label).children('select'));
      const name = select.attr('data-name');
      const value = select.val();
      props.push({ name: name, value: value });

      // read properties made available by this selection
      const subPanelName = `${name}.${value}`;
      if (subPanels[subPanelName]) {
        props.push.apply(props, this.readProperties(subPanels[subPanelName]));
      }
    }
    return props;
  }

  readOxDnaFile(child: any): string {
    return child.find('[data-name="ox-dna-file-content"]').val();
  }

  async getDefaultConfigs(): Promise<Config[]> {
    console.log('Get Default Configs');

    return await fetch(this.host + '/options/default', {
      method: 'GET',
      headers: this.headers,
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

  async getAvailableOptions(): Promise<Option> {
    console.log('Get Available Options');

    return await fetch(this.host + '/options/available', {
      method: 'GET',
      headers: this.headers,
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

      default:
        throw new Error(`Unknown Job state: ${job.status}`);
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

    await fetch(this.host + '/job', {
      method: 'GET',
      headers: this.headers,
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

    return await fetch(this.host + '/job/' + id, {
      method: 'GET',
      headers: this.headers,
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

    return await fetch(this.host + '/job/details/' + id, {
      method: 'GET',
      headers: this.headers,
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

    await fetch(this.host + '/job/download/' + id, {
      method: 'GET',
      headers: this.headers,
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

    await fetch(this.host + '/job', {
      method: 'POST',
      headers: this.headers,
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

    await fetch(this.host + '/job/' + id, {
      method: 'DELETE',
      headers: this.headers,
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

    await fetch(this.host + '/job/' + id, {
      method: 'PATCH',
      headers: this.headers,
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

    return await fetch(this.host + '/job/subscribe', {
      method: 'GET',
      headers: this.headers,
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

    await fetch(this.host + '/job/subscribe/' + id, {
      method: 'POST',
      headers: this.headers,
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

    await fetch(this.host + '/job/subscribe', {
      method: 'DELETE',
      headers: this.headers,
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
