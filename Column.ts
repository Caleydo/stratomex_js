/**
 * Created by sam on 30.01.2015.
 */
import d3 = require('d3');
import $ = require('jquery');
import C = require('../caleydo_core/main');
import multiform = require('../caleydo_core/multiform');
import geom = require('../caleydo_core/geom');
import idtypes = require('../caleydo_core/idtype');
import behaviors = require('../caleydo_core/behavior');
import events = require('../caleydo_core/event');
import layout = require('../caleydo_core/layout');
import link_m = require('../caleydo_links/link');
import layouts = require('../caleydo_d3/layout_d3util');
import prov = require('../caleydo_provenance/main');
import ranges = require('../caleydo_core/range');

//guess initial vis method
function guessInitial(desc):any {
  if (desc.type === 'matrix') {
    return 'caleydo-vis-heatmap';
  }
  if (desc.type === 'vector') {
    return desc.value.type === 'categorical' ? 'caleydo-vis-mosaic' : 'caleydo-vis-heatmap1d';
  }
  return -1;
}

//create a manager for all columns
export const manager = new idtypes.ObjectManager<Column>('_column', 'Column');

function createWrapper(elem, data, range) {
  var $elem = d3.select(elem);
  $elem.classed('group', true);
  $elem.append('div').attr('class', 'title').text(range.dim(0).name);
  return $elem.append('div').attr('class', 'body').node();
}

function createColumn(inputs, parameter, graph) {
  var stratomex = inputs[0].value,
    partitioning = ranges.parse(parameter.partitioning);
  return inputs[1].v.then(function (data) {
    var c = new Column(stratomex, data, partitioning);
    var r = prov.ref(c, 'Column of ' + data.desc.name, prov.cat.visual);
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

    stratomex.addColumn(r);
    return {
      created: [r],
      inverse: createRemoveCmd(inputs[0], r)
    };
  });
}
function removeColumn(inputs, parameter, graph) {
  var column = inputs[1].value,
    inv = createColumnCmd(inputs[0], graph.findObject(column.data), column.range.toString());
  column.destroy();
  inputs[0].value.removeColumn(inputs[1]);
  return {
    removed: [inputs[1]],
    inverse: inv
  };
}
function swapColumns(inputs) {
  inputs[0].value.swapColumn(inputs[1], inputs[2]);
  return {
    inverse: createSwapColumnCmd(inputs[0], inputs[2], inputs[1])
  };
}

function changeVis(inputs, parameter) {
  var column = inputs[0].value,
    to = parameter.to,
    from = parameter.from || column.grid.act.id;
  column.off('changed', column.changeHandler);
  column.grid.switchTo(to).then(function () {
    column.on('changed', column.changeHandler);
  });
  return {
    inverse: createChangeVis(inputs[0], from, to)
  };
}

export function showInDetail(inputs, parameter) {
  var column = inputs[0].value,
    cluster = parameter.cluster,
    show = parameter.action === 'show';
  if (show) {
    column.showInDetail(cluster);
  } else {
    column.hideDetail(cluster);
  }
  return {
    inverse: createToggleDetailCmd(inputs[0], cluster, !show)
  };
}

export function createToggleDetailCmd(column, cluster, show) {
  var act = show ? 'show' : 'hide';
  return prov.action(prov.meta(act + ' detail of cluster ' + cluster + ' of ' + column.toString(), prov.cat.layout), 'showStratomeXInDetail', showInDetail, [column], {
    cluster: cluster,
    action: show ? 'show' : 'hide'
  });
}

export function createChangeVis(column, to, from) {
  return prov.action(prov.meta('change vis ' + column.toString() + ' to ' + to, prov.cat.visual), 'changeStratomeXColumnVis', changeVis, [column], {
    to: to,
    from: from
  });
}

function setOption(inputs, parameter) {
  var column = inputs[0].value,
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

export function createSetOption(column, name, value, old) {
  return prov.action(prov.meta('set option "' + name + +'" of "' + column.toString() + ' to "' + value + '"', prov.cat.visual), 'setStratomeXColumnOption', setOption, [column], {
    name: name,
    value: value,
    old: old
  });
}
export function createColumnCmd(stratomex, data, partitioning) {
  return prov.action(prov.meta('Create Column for ' + data.value.desc.name, prov.cat.visual, prov.op.create), 'createStratomeXColumn', createColumn, [stratomex, data], {partitioning: partitioning.toString()});
}
export function createRemoveCmd(stratomex, column) {
  return prov.action(prov.meta('Remove Column', prov.cat.visual, prov.op.remove), 'removeStratomeXColumn', removeColumn, [stratomex, column]);
}
export function createSwapColumnCmd(stratomex, columnA, columnB) {
  return prov.action(prov.meta('Swap Columns', prov.cat.layout, prov.op.update), 'swapStratomeXColumns', swapColumns, [stratomex, columnA, columnB]);
}

export function createCmd(id:string) {
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
 * @returns {prov.ActionNode[]}
 */
export function compressCreateRemove(path: prov.ActionNode[]) {
  const to_remove: number[] = [];
  path.forEach((p, i) => {
    if (p.f_id === 'removeStratomeXColumn') {
      const col = p.removes[0]; //removed column
      //find the matching createStatement and mark all changed in between
      for (let j = i-1; j >= 0; --j) {
        let q = path[j];
        if (q.f_id === 'createStratomeXColumn') {
          let created_col = q.creates[0];
          if (created_col === col) {
            //I found my creation
            to_remove.push(j, i); //remove both
            break;
          }
        } else if (q.f_id.match(/(changeStratomeXColumnVis|showStratomeXInDetail|setStratomeXColumnOption|swapStratomeXColumns)/)) {
          if (q.requires.some((d) => d === col)) {
            to_remove.push(j); //uses the element
          }
        }
      }
    }
  });
  //decreasing order for right indices
  for(let i of to_remove.sort((a,b) => b-a)) {
    path.splice(i,1);
  }
  return path;
}

export function compressSwap(path: prov.ActionNode[]) {
  const to_remove: number[] = [];
  path.forEach((p, i) => {
    if (p.f_id === 'swapStratomeXColumns') {
      const inputs = p.requires;
      //assert inputs.length === 3
      for (let j = i+1; j < path.length; ++j) {
        let q = path[j];
        if (q.f_id === 'swapStratomeXColumns') {
          let otherin = q.requires;
          if (inputs[1] === otherin[2] && inputs[2] === otherin[1]) {
            //swapped again
            to_remove.push(i,j);
            break;
          }
        }
      }
    }
  });
  //decreasing order for right indices
  for(let i of to_remove.sort((a,b) => b-a)) {
    path.splice(i,1);
  }
  return path;
}

function shiftBy(r, shift) {
  if (Array.isArray(r)) {
    return r.map(function (loc) {
      return loc ? geom.wrap(loc).shift(shift) : loc;
    });
  }
  return r ? geom.wrap(r).shift(shift) : r;
}

export class Column extends events.EventHandler implements idtypes.IHasUniqueId, link_m.IDataVis {
  id:number;

  private options = {
    summaryHeight: 100,
    width: 180,
    padding: 3
  };

  private $parent:d3.Selection<any>;
  private $toolbar:d3.Selection<any>;
  private $summary:d3.Selection<any>;
  private $clusters:d3.Selection<any>;

  range:ranges.Range;
  private summary:multiform.MultiForm;
  private grid:multiform.MultiFormGrid;

  private grid_zoom:behaviors.ZoomLogic;
  private summary_zoom:behaviors.ZoomLogic;

  layout:layout.ALayoutElem;

  changeHandler: any;
  optionHandler: any;

  constructor(private stratomex, public data, partitioning:ranges.Range, options:any = {}) {
    super();
    C.mixin(this.options, options);
    var that = this;
    this.$parent = d3.select(stratomex.parent).append('div').attr('class', 'column').style('opacity', 0.1);
    this.$toolbar = this.$parent.append('div').attr('class', 'toolbar');
    this.$summary = this.$parent.append('div').attr('class', 'summary').style({
      padding: this.options.padding + 'px',
      'border-color': data.desc.color || 'gray',
      'background-color': data.desc.bgColor || 'lightgray'
    });
    this.$summary.append('div').attr('class', 'title').text(data.desc.name).style('background-color', data.desc.bgColor || 'lightgray');
    this.$clusters = this.$parent.append('div').attr('class', 'clusters');
    this.range = partitioning;
    //create the vis
    this.summary = multiform.create(data, <Element>this.$summary.node(), {
      initialVis: 'caleydo-vis-histogram',
      'caleydo-vis-histogram': {
        totalHeight: false,
        nbins: Math.sqrt(data.dim[0])
      }
    });
    this.grid = multiform.createGrid(data, partitioning, <Element>this.$clusters.node(), function (data, range) {
      return (<any>data).view(range);
    }, {
      initialVis: guessInitial(data.desc),
      wrap: createWrapper
    });
    //zooming
    this.grid_zoom = new behaviors.ZoomLogic(this.grid, this.grid.asMetaData);
    this.summary_zoom = new behaviors.ZoomLogic(this.summary, this.summary.asMetaData);
    var layoutOptions = {
      animate: true,
      'set-call': function (s) {
        s.style('opacity', 1);
      },
      onSetBounds: function () {
        that.layouted();
      },
      prefWidth: this.options.width
    };
    this.grid.on('changed', function (event, to, from) {
      that.fire('changed', to, from);
    });
    //create layout version
    this.layout = layouts.wrapDom(<HTMLElement>this.$parent.node(), layoutOptions);

    this.createToolBar();

    this.id = manager.nextId(this);
  }

  ids() {
    return this.data.ids(this.range);
  }

  get location() {
    return this.layout.getBounds();
  }

  visPos() {
    var l = this.location;
    var offset = $(this.$parent.node()).find('div.multiformgrid').position();
    return {
      x: l.x + offset.left,
      y: l.y + offset.top
    };
  }

  locateImpl(range:ranges.Range) {
    var cluster = range.dim(0);
    cluster = cluster.toSet();
    for (let i = this.grid.dimSizes[0] - 1; i >= 0; --i) {
      let r = this.grid.getRange(i).dim(0).toSet();
      if (r.eq(cluster)) {
        return shiftBy(this.grid.getBounds(i), this.visPos());
      }
    }
    return null; //not a cluster
  }

  locate(...args:any[]) {
    if (args.length === 1) {
      return this.locateImpl(args[0]);
    }
    return args.map((arg) => this.locateImpl(arg));
  }

  locateById(...args:any[]) {
    var that = this;
    return this.data.ids().then(function (ids) {
      return that.locate.apply(that, args.map(function (r) {
        return ids.indexOf(r);
      }));
    });
  }

  showInDetail(cluster) {
    this.stratomex.value.showDetail(this, this.grid.getData(cluster));
  }

  hideDetail(cluster) {
    this.stratomex.value.hideDetail();
  }

  layouted() {
    //sync the scaling
    var size = this.layout.getSize();
    this.summary_zoom.zoomTo(size.x - this.options.padding * 2, this.options.summaryHeight - this.options.padding * 2 - 30);
    size.y -= this.options.summaryHeight;
    size.y -= (<any>this.range.dim(0)).groups.length * 35; //FIXME hack
    this.grid_zoom.zoomTo(size.x, size.y);

    //shift the content for the aspect ratio
    var shift = [null, null];
    if (this.grid_zoom.isFixedAspectRatio) {
      var act = this.grid.size;
      shift[0] = ((size[0] - act[0]) / 2) + 'px';
      shift[1] = ((size[1] - act[1]) / 2) + 'px';
    }
    this.$parent.select('div.multiformgrid').style({
      left: shift[0],
      top: shift[1]
    });
    //center the toolbar
    var w = (18 * (1 + this.grid.visses.length));
    this.$toolbar.style('left', ((size.x - w) / 2) + 'px');
  }

  createToolBar() {
    var $t = this.$toolbar,
      that = this;
    multiform.addIconVisChooser(<Element>$t.node(), this.grid);
    $t.append('i').attr('class', 'fa fa-chevron-left').on('click', ()=> {
      var g = that.stratomex.provGraph;
      var s = g.findObject(that);
      if (this.stratomex.canShift(s).left > 0) {
        g.push(createSwapColumnCmd(this.stratomex.ref, s, this.stratomex.at(that.stratomex.indexOf(s) - 1)));
      }
    });
    $t.append('i').attr('class', 'fa fa-chevron-right').on('click', ()=> {
      var g = that.stratomex.provGraph;
      var s = g.findObject(that);
      if (that.stratomex.canShift(s).right < 0) {
       g.push(createSwapColumnCmd(this.stratomex.ref, s, that.stratomex.at(that.stratomex.indexOf(s) +1 )));
      }
    });
    $t.append('i').attr('class', 'fa fa-close').on('click', ()=> {
      var g = that.stratomex.provGraph;
      g.push(createRemoveCmd(this.stratomex.ref, g.findObject(that)));
    });
    var w = (18 * (1 + this.grid.visses.length));
    $t.style('min-width', w + 'px');
  }

  destroy() {
    manager.remove(this);
    this.$parent.style('opacity', 1).transition().style('opacity', 0).remove();
  }
}
