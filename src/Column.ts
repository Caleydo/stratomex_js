/**
 * Created by sam on 30.01.2015.
 */
import * as d3 from 'd3';
import * as $ from 'jquery';
import {randomId, mixin, bounds} from 'phovea_core/src/index';
import {IMultiForm, MultiForm, MultiFormGrid, create as createMultiform, createGrid, addIconVisChooser} from 'phovea_core/src/multiform';
import {wrap, rect} from 'phovea_core/src/geom';
import {ObjectManager, IHasUniqueId, toSelectOperation} from 'phovea_core/src/idtype';
import {ZoomLogic, ZoomBehavior} from 'phovea_core/src/behavior';
import {EventHandler} from 'phovea_core/src/event';
import {IDataVis} from 'phovea_d3/src/link';
import {
  IDataDescription, VALUE_TYPE_INT, VALUE_TYPE_CATEGORICAL, IDataType,
  assignData
} from 'phovea_core/src/datatype';
import {ProvenanceGraph, IObjectRef, ref, cat, meta, action, op, ActionNode} from 'phovea_core/src/provenance';
import {parse, Range, none, all, CompositeRange1D, Range1DGroup} from 'phovea_core/src/range';
import {IVectorDataDescription, IAnyVector} from 'phovea_core/src/vector';
import {StratomeX} from './StratomeX';
import {IStratification} from 'phovea_core/src/stratification';
import {IAnyMatrix} from 'phovea_core/src/matrix';


export function animationTime(within = -1) {
  return within < 0 ? 50 : within;
}

//guess initial vis method
function guessInitial(desc: IDataDescription): string|number {
  if (desc.type === 'matrix') {
    return 'phovea-vis-heatmap';
  }
  if (desc.type === 'vector' && (<IVectorDataDescription<any>>desc).value.type === VALUE_TYPE_INT && desc.name.toLowerCase().indexOf('daystodeath') >= 0) {
    return 'phovea-vis-kaplanmeier';
  }
  if (desc.type === 'vector') {
    return (<IVectorDataDescription<any>>desc).type === VALUE_TYPE_CATEGORICAL ? 'phovea-vis-mosaic' : 'phovea-vis-heatmap1d';
  }
  if (desc.type === 'stratification') {
    return 'phovea-vis-mosaic';
  }
  return -1;
}

//create a manager for all columns
export const manager = new ObjectManager<Column>('_column', 'Column');


function createColumn(inputs: IObjectRef<any>[], parameter: any, graph: ProvenanceGraph, within: number) {
  const stratomex = inputs[0].value,
    partitioning = parse(parameter.partitioning),
    index = parameter.hasOwnProperty('index') ? parameter.index : -1,
    name = parameter.name || inputs[1].name,
    uid = parameter.uid || 'C' + randomId();

  return inputs[1].v.then((data) => {
    //console.log(new Date(), 'create column', data.desc.name, index);
    const c = new Column(stratomex, data, partitioning, inputs[1], {
      width: (data.desc.type === 'stratification') ? 60 : (data.desc.name.toLowerCase().indexOf('death') >= 0 ? 110 : 160),
      name
    }, within);
    c.node.setAttribute('data-anchor', uid);
    const r = ref(c, c.name, cat.visual, c.hashString);
    c.changeHandler = function (event, to, from) {
      if (from) { //have a previous one so not the default
        graph.push(createChangeVis(r, to.id, from ? from.id : null));
      }
    };
    c.optionHandler = function (event, name, value, bak) {
      graph.push(createSetOption(r, name, value, bak));
    };
    c.on('changed', c.changeHandler);
    c.on('option', c.optionHandler);

    //console.log(new Date(), 'add column', data.desc.name, index);
    return stratomex.addColumn(c, index, within).then(() => {
      //console.log(new Date(), 'added column', data.desc.name, index);
      return {
        created: [r],
        inverse: (inputs, created) => createRemoveCmd(inputs[0], created[0]),
        consumed: within
      };
    });
  });
}
function removeColumn(inputs: IObjectRef<any>[], parameter: any, graph: ProvenanceGraph, within: number) {
  const column: Column = inputs[1].value;
  const dataRef = column.dataRef;
  const partitioning = column.range;
  const columnName = column.name;
  //console.log(new Date(), 'remove column', column.data.desc.name);
  const uid = column.node.getAttribute('data-anchor');

  return inputs[0].value.removeColumn(column, within).then((index) => {
    //console.log(new Date(), 'removed column', dataRef.value.desc.name, index);
    return {
      removed: [inputs[1]],
      inverse: (inputs, created) => createColumnCmd(inputs[0], dataRef, partitioning, columnName, index, uid),
      consumed: within
    };
  });
}
function swapColumns(inputs: IObjectRef<any>[], parameter: any, graph: ProvenanceGraph, within: number) {
  return (inputs[0].value).swapColumn(inputs[1].value, inputs[2].value, within).then(() => {
    return {
      inverse: createSwapColumnCmd(inputs[0], inputs[2], inputs[1]),
      consumed: within
    };
  });
}

function changeVis(inputs: IObjectRef<any>[], parameter: any) {
  const column = inputs[0].value,
    to = parameter.to,
    from = parameter.from || column.grid.act.id;
  column.off('changed', column.changeHandler);
  return column.grid.switchTo(to).then(function () {
    column.on('changed', column.changeHandler);
    return {
      inverse: createChangeVis(inputs[0], from, to)
    };
  });
}

export function showInDetail(inputs: IObjectRef<any>[], parameter: any, graph: ProvenanceGraph, within: number) {
  const column: Column = inputs[0].value,
    cluster = parameter.cluster,
    show = parameter.action === 'show';
  let r: Promise<any>;
  if (show) {
    r = column.showInDetail(cluster, within);
  } else {
    r = column.hideDetail(cluster, within);
  }
  return r.then(() => {
    return {
      inverse: createToggleDetailCmd(inputs[0], cluster, !show),
      consumed: within
    };
  });
}

export function createToggleDetailCmd(column: IObjectRef<Column>, cluster: number, show: boolean) {
  const act = show ? 'Show' : 'Hide';
  return action(meta(act + ' Details of ' + column.toString() + ' Cluster "' + cluster + '"', cat.layout), 'showStratomeXInDetail', showInDetail, [column], {
    cluster,
    action: show ? 'show' : 'hide'
  });
}

export function createChangeVis(column: IObjectRef<Column>, to: string, from: string) {
  const visses = column.value.grid.visses;
  const visDesc = visses.filter((v) => v.id === to)[0];
  return action(meta(column.value.name + ' as ' + visDesc.name, cat.visual), 'changeStratomeXColumnVis', changeVis, [column], {
    to,
    from
  });
}

function setOption(inputs: IObjectRef<any>[], parameter: any) {
  const column = inputs[0].value,
    name = parameter.name,
    value = parameter.value,
    bak = parameter.old || column.grid.option(name);
  column.grid.off('option', column.optionHandler);
  column.grid.option(name, value);
  column.grid.on('option', column.optionHandler);
  return {
    inverse: createSetOption(inputs[0], name, bak, value)
  };
}

export function createSetOption(column: IObjectRef<Column>, name: string, value: any, old: any) {
  return action(meta('set option "' + name + +'" of "' + column.name + ' to "' + value + '"', cat.visual), 'setStratomeXColumnOption', setOption, [column], {
    name,
    value,
    old
  });
}
export function createColumnCmd(stratomex: IObjectRef<StratomeX>, data: IObjectRef<IDataType>, partitioning: Range, name: string, index: number = -1, uid = 'C' + randomId()) {
  return action(meta(name, cat.data, op.create), 'createStratomeXColumn', createColumn, [stratomex, data], {
    partitioning: partitioning.toString(),
    name,
    index,
    uid
  });
}
export function createRemoveCmd(stratomex: IObjectRef<StratomeX>, column: IObjectRef<Column>) {
  return action(meta(column.name, cat.data, op.remove), 'removeStratomeXColumn', removeColumn, [stratomex, column]);
}
export function createSwapColumnCmd(stratomex: IObjectRef<StratomeX>, columnA: IObjectRef<Column>, columnB: IObjectRef<Column>) {
  return action(meta(`${columnA.name}⇄${columnB.name}`, cat.layout, op.update), 'swapStratomeXColumns', swapColumns, [stratomex, columnA, columnB]);
}

export function createCmd(id: string) {
  switch (id) {
    case 'setStratomeXColumnOption' :
      return setOption;
    case 'createStratomeXColumn':
      return createColumn;
    case 'swapStratomeXColumns':
      return swapColumns;
    case 'removeStratomeXColumn' :
      return removeColumn;
    case 'changeStratomeXColumnVis':
      return changeVis;
    case 'showStratomeXInDetail' :
      return showInDetail;
  }
  return null;
}

/**
 * annihilate two swap operations: A-B and B-A
 * @param path
 * @returns {ActionNode[]}
 */
export function compressCreateRemove(path: ActionNode[]) {
  //use a set, e.g. swap uses two columns, to avoid duplicate entries
  const toRemove = d3.set();
  path.forEach((p, i) => {
    if (p.f_id === 'removeStratomeXColumn') {
      const col = p.removes[0]; //removed column
      const toPotentialRemove = [];
      //find the matching createStatement and mark all changed in between
      for (let j = i - 1; j >= 0; --j) {
        const q = path[j];
        if (q.f_id === 'createStratomeXColumn') {
          const createdCol = q.creates[0];
          if (createdCol === col) {
            //I found my creation
            toRemove.add(String(j));
            toRemove.add(String(i)); //remove both
            //and remove all inbetween
            toPotentialRemove.forEach(toRemove.add.bind(toRemove));
            break;
          }
        } else if (q.f_id.match(/(changeStratomeXColumnVis|showStratomeXInDetail|setStratomeXColumnOption|swapStratomeXColumns)/)) {
          if (q.requires.some((d) => d === col)) {
            toPotentialRemove.push(j); //uses the element
          }
        }
      }
    }
  });
  //decreasing order for right indices
  for (const i of toRemove.values().map(Number).sort(d3.descending)) {
    path.splice(i, 1);
  }
  return path;
}

export function compressSwap(path: ActionNode[]) {
  const toRemove: number[] = [];
  path.forEach((p, i) => {
    if (p.f_id === 'swapStratomeXColumns') {
      const inputs = p.requires;
      //assert inputs.length === 3
      for (let j = i + 1; j < path.length; ++j) {
        const q = path[j];
        if (q.f_id === 'swapStratomeXColumns') {
          const otherin = q.requires;
          if (inputs[1] === otherin[2] && inputs[2] === otherin[1]) {
            //swapped again
            toRemove.push(i, j);
            break;
          }
        }
      }
    }
  });
  //decreasing order for right indices
  for (const i of toRemove.sort((a, b) => b - a)) {
    path.splice(i, 1);
  }
  return path;
}

export function compressHideShowDetail(path: ActionNode[]) {
  const toRemove: number[] = [];
  path.forEach((p, i) => {
    if (p.f_id === 'showStratomeXInDetail' && p.parameter.action === 'show') {
      const column = p.requires[0];
      const cluster = p.parameter.cluster;
      for (let j = i + 1; j < path.length; ++j) {
        const q = path[j];
        if (q.f_id === 'showStratomeXInDetail' && q.parameter.action === 'hide' && q.parameter.cluster === cluster && column === q.requires[0]) {
          //hide again
          toRemove.push(i, j);
          break;
        }
      }
    }
  });
  //decreasing order for right indices
  for (const i of toRemove.sort((a, b) => b - a)) {
    path.splice(i, 1);
  }
  return path;
}

function shiftBy(r: any, shift: {x: number, y: number}) {
  if (Array.isArray(r)) {
    return r.map(function (loc) {
      return loc ? wrap(loc).shift(shift) : loc;
    });
  }
  return r ? wrap(r).shift(shift) : r;
}

/**
 * utility to sync histograms over multiple instances
 * @param expectedNumberOfHists
 */
function groupTotalAggregator(expectedNumberOfPlots: number, agg: (v: any) => number) {
  let acc = 0;
  let resolvers = [];
  return (v) => {
    return new Promise((resolve) => {
      acc = Math.max(agg(v), acc);
      resolvers.push(resolve);
      if (resolvers.length === expectedNumberOfPlots) {
        resolvers.forEach((r) => r(acc));
        acc = 0;
        resolvers = [];
      }
    });
  };
}

export interface IColumnOptions {
  summaryHeight?: number;
  width?: number;
  detailWidth?: number;
  padding?: number;
  name?: string;
}

export class Column extends EventHandler implements IHasUniqueId, IDataVis {
  id: number;

  private options: IColumnOptions = {
    summaryHeight: 90,
    width: 180,
    detailWidth: 500,
    padding: 2,
    name: null
  };

  private $parent: d3.Selection<any>;
  private $toolbar: d3.Selection<any>;
  private $summary: d3.Selection<any>;
  private $clusters: d3.Selection<any>;

  range: Range;
  private summary: MultiForm;
  grid: MultiFormGrid;

  private gridZoom: ZoomLogic;
  private summaryZoom: ZoomLogic;

  private detail: {
    $node: d3.Selection<any>;
    multi: IMultiForm;
    zoom: ZoomBehavior;
  };

  private $layoutHelper: d3.Selection<any>;


  changeHandler: any;
  optionHandler: any;

  private highlightMe = (event: any, type: string, act: Range) => {
    this.$parent.classed('phovea-select-' + type, act.dim(0).contains(this.id));
  }

  constructor(private stratomex, public data, partitioning: Range, public dataRef, options: IColumnOptions = {}, within = -1) {
    super();
    mixin(this.options, options);

    this.$parent = d3.select(stratomex.parent).append('div').attr('class', 'column').style('opacity', 0);
    this.$parent.style('top', '20px');
    {
      const parentBounds = bounds(stratomex.parent);
      this.$parent.style('left', (parentBounds.w - this.options.width - 20) + 'px');
      this.$parent.style('height', (parentBounds.h - 20) + 'px');
    }
    this.$layoutHelper = d3.select(stratomex.parent).append('div').attr('class', 'column-layout');
    this.$parent.style('width', this.options.width + 'px');
    this.$layoutHelper.style('width', this.options.width + 'px');
    this.$toolbar = this.$parent.append('div').attr('class', 'toolbar');
    this.$summary = this.$parent.append('div').attr('class', 'summary').style({
      padding: this.options.padding + 'px',
      'border-color': data.desc.color || 'gray',
      'background-color': data.desc.bgColor || 'lightgray'
    });
    this.$summary.append('div').attr('class', 'title').style('max-width', (this.options.width - this.options.padding * 2) + 'px').text(this.name).style('background-color', data.desc.bgColor || 'lightgray');
    this.$clusters = this.$parent.append('div').attr('class', 'clusters');
    this.range = partitioning;
    //create the vis
    this.summary = createMultiform(data.desc.type !== 'stratification' ? data.view(partitioning) : data, <HTMLElement>this.$summary.node(), {
      initialVis: 'phovea-vis-histogram',
      'phovea-vis-histogram': {
        total: false,
        nbins: Math.sqrt(data.dim[0])
      },
      all: {
        selectAble: false
      }
    });
    this.$summary.on('click', () => {
      manager.select([this.id], toSelectOperation(<MouseEvent>d3.event));
    });

    const createWrapper = (elem: HTMLElement, data: IDataType, cluster: Range, pos: [number, number]) => {
      const $elem = d3.select(elem);
      assignData(elem, data);
      $elem.classed('group', true);
      const $toolbar = $elem.append('div').attr('class', 'gtoolbar');
      $toolbar.append('i').attr('class', 'fa fa-expand').on('click', () => {
        const g = this.stratomex.provGraph;
        const s = g.findObject(this);
        g.push(createToggleDetailCmd(s, pos[0], true));
        (<Event>d3.event).stopPropagation();
      });
      const toggleSelection = () => {
        const isSelected = $elem.classed('phovea-select-selected');
        if (isSelected) {
          data.select(0, none());
        } else {
          data.select(0, all());
        }
        $elem.classed('phovea-select-selected', !isSelected);
      };
      const group = <Range1DGroup>cluster.dim(0);
      $elem.append('div').attr('class', 'title').style('max-width', (this.options.width - this.options.padding * 2) + 'px').text(group.name).on('click', toggleSelection);
      $elem.append('div').attr('class', 'body').on('click', toggleSelection);

      const ratio = cluster.dim(0).length / partitioning.dim(0).length;
      $elem.append('div').attr('class', 'footer').append('div').style('width', Math.round(ratio * 100) + '%');
      return <HTMLElement>$elem.select('div.body').node();
    };

    const r = (<CompositeRange1D>partitioning.dim(0));
    //console.log(this.range, r);
    const initialHeight = 500 / (r.groups || []).length;

    this.grid = createGrid(data, partitioning, <HTMLElement>this.$clusters.node(), (data, range, pos) => {
      if (data.desc.type === 'stratification') {
        return (<IStratification>data).group(pos[0]);
      }
      return (<IAnyMatrix|IAnyVector>data).view(range);
    }, {
      initialVis: guessInitial(data.desc),
      singleRowOptimization: false,
      wrap: createWrapper,
      all: {
        selectAble: false,
        total: groupTotalAggregator((<CompositeRange1D>partitioning.dim(0)).groups.length, (v) => v.largestBin),
        nbins: Math.sqrt(data.dim[0]),
        heightTo: initialHeight
      },
      'phovea-vis-mosaic': {
        width: this.options.width - this.options.padding * 2
      },
      'phovea-vis-heatmap1d': {
        width: this.options.width - this.options.padding * 2
      },
      'phovea-vis-heatmap': {
        scaleTo: [this.options.width - this.options.padding * 2, initialHeight],
        forceThumbnails: true
      },
      'phovea-vis-kaplanmeier': {
        maxTime: groupTotalAggregator((<CompositeRange1D>partitioning.dim(0)).groups.length, (v) => v.length === 0 ? 0 : v[v.length - 1])
      }
    });
    //zooming
    this.gridZoom = new ZoomLogic(this.grid, this.grid.asMetaData);
    this.summaryZoom = new ZoomLogic(this.summary, this.summary.asMetaData);
    this.grid.on('changed', (event, to, from) => {
      this.fire('changed', to, from);
    });
    this.createToolBar();

    this.id = manager.nextId(this);
    manager.on('select', this.highlightMe);
    manager.select([this.id]);

    this.$parent.transition().duration(animationTime(within)).style('opacity', 1);
  }

  setInteractive(interactive: boolean) {
    this.$toolbar.style('display', interactive ? null : 'none');
    this.$parent.selectAll('.gtoolbar').style('display', interactive ? null : 'none');

    this.$parent.selectAll('.group .title, .group .body').classed('readonly', !interactive);
  }

  get node() {
    return <Element>this.$parent.node();
  }

  get layoutNode() {
    return <Element>this.$layoutHelper.node();
  }

  get hashString() {
    return this.data.desc.name + '_' + this.range.toString();
  }

  get name() {
    if (this.options.name) {
      return this.options.name;
    }
    const n: string = this.data.desc.name;
    const i = n.lastIndexOf('/');
    return i >= 0 ? n.slice(i + 1) : n;
  }

  ids() {
    return this.data.ids(this.range);
  }

  get location() {
    const abspos = bounds(<Element>this.$layoutHelper.node());
    const parent = bounds((<Element>this.$layoutHelper.node()).parentElement);
    return rect(abspos.x - parent.x, abspos.y - parent.y, abspos.w, abspos.h);
  }

  visPos() {
    const l = this.location;
    const offset = $(this.$parent.node()).find('div.multiformgrid').position();
    return {
      x: l.x + offset.left,
      y: l.y + offset.top
    };
  }

  locateImpl(range: Range) {
    let cluster = range.dim(0);
    cluster = cluster.toSet();
    for (let i = this.grid.dimSizes[0] - 1; i >= 0; --i) {
      const r = this.grid.getRange(i).dim(0).toSet();
      if (r.eq(cluster)) {
        return shiftBy(this.grid.getBounds(i), this.visPos());
      }
    }
    return null; //not a cluster
  }

  locate(...args: any[]) {
    if (args.length === 1) {
      return this.locateImpl(args[0]);
    }
    return args.map((arg) => this.locateImpl(arg));
  }

  private locateHack(groups: Range[]) {
    const nGroups = this.grid.dimSizes[0];
    if (groups.length !== nGroups) {
      return null;
    }
    return groups.map((g, i) => {
      return shiftBy(this.grid.getBounds(i), this.visPos());
    });
  }

  locateById(...args: any[]) {
    const that = this;
    //TODO use the real thing not a heuristic.
    const r = this.locateHack(args);
    if (r) {
      return r;
    }
    return this.data.ids().then(function (ids) {
      return that.locate.apply(that, args.map(function (r) {
        return ids.indexOf(r);
      }));
    });
  }

  showInDetail(cluster: number, within = -1) {
    const data = cluster < 0 ? this.data : this.grid.getData(cluster);

    const $elem = this.$parent.append('div').classed('detail', true).style('opacity', 0);
    $elem.classed('group', true).datum(data);
    const $toolbar = $elem.append('div').attr('class', 'gtoolbar');
    $elem.append('div').attr('class', 'title').text(cluster < 0 ? this.data.desc.name : (<CompositeRange1D>this.range.dim(0)).groups[cluster].name);
    const $body = $elem.append('div').attr('class', 'body');
    const multi = createMultiform(data, <HTMLElement>$body.node(), {
      initialVis: guessInitial(data.desc)
    });
    multi.addIconVisChooser(<HTMLElement>$toolbar.node());
    $toolbar.append('i').attr('class', 'fa fa-close').on('click', () => {
      const g = this.stratomex.provGraph;
      const s = g.findObject(this);
      g.push(createToggleDetailCmd(s, cluster, false));
    });

    this.detail = {
      $node: $elem,
      multi,
      zoom: new ZoomBehavior(<Element>$elem.node(), multi, multi.asMetaData)
    };
    this.$parent.style('width', this.options.width + this.options.detailWidth + 'px');
    this.$layoutHelper.style('width', this.options.width + this.options.detailWidth + 'px');
    $elem.transition().duration(animationTime(within)).style('opacity', 1);
    return this.stratomex.relayout(within);
  }

  hideDetail(cluster, within) {
    if (!this.detail) {
      return Promise.resolve([]);
    }
    //this.detail.multi.destroy();
    this.detail.$node.transition().duration(animationTime(within)).style('opacity', 0).remove();

    this.detail = null;
    this.$parent.style('width', this.options.width + 'px');
    this.$layoutHelper.style('width', this.options.width + 'px');
    return this.stratomex.relayout(within);
  }

  layouted(within = -1) {
    //sync the scaling
    const b = bounds(<Element>this.$layoutHelper.node());
    const size = {x: b.w, y: b.h - 5}; //no idea why but needed avoiding an overflow

    size.y -= this.options.summaryHeight;
    size.y -= (<any>this.range.dim(0)).groups.length * 32; //remove the grid height

    this.$parent.interrupt().style('opacity', 1).transition().style({
      left: b.x + 'px',
      //top: (bounds.y - 20) + 'px', //for the padding applied in the style to the stratomex
      width: b.w + 'px',
      height: (b.h - 5) + 'px' //no idea why but needed avoiding an overflow
    });

    if (this.detail) {
      size.x -= this.options.detailWidth;
      this.$summary.style('width', size.x + 'px');
      this.detail.$node.style({
        width: this.options.detailWidth + 'px',
        height: size.y + 'px',
        top: this.options.summaryHeight + 'px',
        left: (size.x + this.options.padding * 2) + 'px'
      });
      this.detail.zoom.zoomTo(this.options.detailWidth - this.options.padding * 4, size.y - this.options.padding * 2 - 30);
    }

    this.summary.actLoader.then(() => {
      this.summaryZoom.zoomTo(size.x - this.options.padding * 3, this.options.summaryHeight - this.options.padding * 3 - 30);
    });
    this.grid.actLoader.then(() => {
      this.gridZoom.zoomTo(size.x - this.options.padding * 2, size.y);

      //shift the content for the aspect ratio
      const shift = [null, null];
      if (this.gridZoom.isFixedAspectRatio) {
        const act = this.grid.size;
        shift[0] = ((size.x - act[0]) / 2) + 'px';
        shift[1] = ((size.y - act[1]) / 2) + 'px';
      }
      this.$parent.select('div.multiformgrid').style({
        left: shift[0],
        top: shift[1]
      });
    });


    //center the toolbar
    //var w = (18 * (1 + this.grid.visses.length));
    //this.$toolbar.style('left', ((size.x - w) / 2) + 'px');
  }

  createToolBar() {
    const $t = this.$toolbar;
    addIconVisChooser(<HTMLElement>$t.node(), this.grid);
    $t.append('i').attr('class', 'fa fa-chevron-left').on('click', () => {
      const g = this.stratomex.provGraph;
      const s = g.findObject(this);
      if (this.stratomex.canShift(this).left > 0) {
        g.push(createSwapColumnCmd(this.stratomex.ref, s, this.stratomex.atRef(this.stratomex.indexOf(this) - 1)));
      }
    });
    $t.append('i').attr('class', 'fa fa-chevron-right').on('click', () => {
      const g = this.stratomex.provGraph;
      const s = g.findObject(this);
      if (this.stratomex.canShift(this).right < 0) {
        g.push(createSwapColumnCmd(this.stratomex.ref, s, this.stratomex.atRef(this.stratomex.indexOf(this) + 1)));
      }
    });
    $t.append('i').attr('class', 'fa fa-expand').on('click', () => {
      const g = this.stratomex.provGraph;
      const s = g.findObject(this);
      g.push(createToggleDetailCmd(s, -1, true));
    });
    $t.append('i').attr('class', 'fa fa-close').on('click', () => {
      const g = this.stratomex.provGraph;
      g.push(createRemoveCmd(this.stratomex.ref, g.findObject(this)));
    });
    const w = (18 * (1 + this.grid.visses.length));
    $t.style('min-width', w + 'px');
  }

  destroy(within) {
    manager.off('select', this.highlightMe);
    manager.remove(this);
    this.$parent.style('opacity', 1).interrupt().transition().duration(animationTime(within)).style('opacity', 0).remove();
    this.$layoutHelper.remove();
  }
}

export class DetailView {
  private $node: d3.Selection<any>;
  private multi: IMultiForm;

  constructor($parent: d3.Selection<any>, private readonly cluster: number, private readonly data: IDataType) {

  }

  destroy() {
    this.multi.destroy();
    this.$node.remove();
  }
}
