/**
 * Created by sam on 30.01.2015.
 */
define(function (require, exports) {
  var d3 = require('d3');
  var $ = require('jquery');
  var vis = require('../caleydo/vis');
  var C = require('../caleydo/main');
  var multiform = require('../caleydo/multiform');
  var geom = require('../caleydo/geom');
  var idtypes = require('../caleydo/idtype');
  var behaviors = require('../caleydo/behavior');
  var events = require('../caleydo/event');
  var layouts = require('../caleydo-layout/d3util');
  var prov = require('../caleydo-provenance/main');
  var session = require('../caleydo/session');
  var ranges = require('../caleydo/range');

  //guess initial vis method
  function guessInitial(desc) {
    if (desc.type === 'matrix') {
      return 'caleydo-vis-heatmap';
    }
    if (desc.type === 'vector') {
      return  desc.value.type === 'categorical' ? 'caleydo-vis-mosaic' : 'caleydo-vis-heatmap1d';
    }
    return -1;
  }

  //create a manager for all columns
  var manager = exports.manager = new idtypes.ObjectManager('_column', 'Column');

  function createWrapper($elem, data, range) {
    $elem.classed('group', true);
    $elem.append('div').attr('class','title').text(range.dim(0).name);
    return $elem.append('div').attr('class', 'body');
  }

  function createColumn(inputs, parameter, graph) {
    var stratomex = inputs[0].v,
      data = inputs[1].v,
      partitioning = ranges.parse(parameter.partitioning);
    var c = new Column(stratomex, data, partitioning);
    var r = prov.ref(c, 'Column of '+data.desc.name, prov.cat.vis);
    c.changeHandler = function(event, to, from) {
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
      inverse: createRemoveCmd(r)
    }
  }
  function removeColumn(inputs, parameter, graph) {
    var column = inputs[0].v,
      inv = createColumnCmd(graph.findObject(column.stratomex), graph.findObject(column.data), column.range);
    column.destroy();
    column.stratomex.removeColumn(inputs[0]);
    return {
      removed: [inputs[0]],
      inverse: inv
    };
  }

  function changeVis(inputs, parameter) {
    var column = inputs[0].v,
      to = parameter.to,
      from = parameter.from || column.grid.act.id;
    column.off('changed', column.changeHandler);
    column.grid.switchTo(to).then(function() {
      column.on('changed', column.changeHandler);
    });
    return {
      inverse: createChangeVis(inputs[0], from, to)
    };
  }

  function createChangeVis(column, to, from) {
    return prov.action(prov.meta('change vis ' + column.toString() + ' to ' + to, prov.cat.visual), 'changeColumnVis', changeVis, [column], {
      to: to,
      from: from
    });
  }

  function setOption(inputs, parameter) {
    var column = inputs[0].v,
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

  function createSetOption(column, name, value, old) {
    return prov.action(prov.meta('set option "' + name + +'" of "' + column.toString() + ' to "' + value + '"', prov.cat.visual), 'setColumnOption', setOption, [column], {
      name: name,
      value: value,
      old: old
    });
  }
  function createColumnCmd(stratomex, data, partitioning) {
    return prov.action(prov.meta('Create Column for '+data.v.desc.name, prov.op.create), 'createColumn', createColumn, [stratomex, data], { partitioning: partitioning })
  }
  function createRemoveCmd(column) {
    return prov.action(prov.meta('Remove Column', prov.op.remove), 'removeColumn', removeColumn, [column]);
  }

  exports.createCmd = function(id) {
    switch(id) {
      case 'setColumnOption' : return setOption;
      case 'createColumn': return createColumn;
      case 'removeColumn' : return removeColumn;
      case 'changeColumnVis': return changeVis;
    }
    return null;
  };

  function Column(stratomex, data, partitioning, options) {
    events.EventHandler.call(this);
    var that = this;
    this.data = data;
    this.options = C.mixin({
      summaryHeight: 100,
      width: 180,
      padding: 3
    }, options || {});
    this.stratomex = stratomex;
    this.$parent = d3.select(stratomex.parent).append('div').attr('class', 'column').style('opacity',0.1);
    this.$toolbar = this.$parent.append('div').attr('class','toolbar');
    this.$summary = this.$parent.append('div').attr('class', 'summary').style({
      padding: this.options.padding + 'px',
      'border-color': data.desc.color || 'gray',
      'background-color' : data.desc.bgColor || 'lightgray'
    });
    this.$summary.append('div').attr('class','title').text(data.desc.name).style('background-color',data.desc.bgColor || 'lightgray');
    this.$clusters = this.$parent.append('div').attr('class', 'clusters');
    this.range = partitioning;
    //create the vis
    this.summary = multiform.create(data, this.$summary.node() ,{
      initialVis : 'caleydo-vis-histogram',
      'caleydo-vis-histogram' : {
        totalHeight : false,
        nbins : Math.sqrt(data.dim[0])
      }
    });
    this.grid = multiform.createGrid(data, partitioning, this.$clusters.node(), function (data, range) {
      return data.view(range)
    }, {
      initialVis: guessInitial(data.desc),
      wrap : createWrapper
    });
    //zooming
    var grid_z = this.grid_zoom = new behaviors.ZoomLogic(this.grid, this.grid.asMetaData);
    var summary_z = this.summary_zoom = new behaviors.ZoomLogic(this.summary, this.summary.asMetaData);
    var layoutOptions = {
      animate: true,
      'set-call' : function(s) {
        s.style('opacity',1);
      },
      onSetBounds : function() { that.layouted()},
      prefWidth : this.options.width
    };
    var g = this.grid.on('changed', function(event, to, from) {
      that.fire('changed', to, from);
    });
    //create layout version
    this.layout = layouts.wrapDom(this.$parent.node(), layoutOptions);

    this.createToolBar();

    this.id = manager.nextId(this);
  }

  C.extendClass(Column, events.EventHandler);

  Column.prototype.ids = function() {
    return this.data.ids(this.range);
  };
  Object.defineProperty(Column.prototype, 'location', {
    get : function() {
      return this.layout.getBounds();
    },
    enumerable: true
  });
  Column.prototype.visPos = function() {
    var l = this.location;
    var offset = $(this.$parent.node()).find('div.multiformgrid').position();
    return {
      x : l.x + offset.left,
      y : l.y + offset.top
    };
  };

  function shiftBy(r, shift) {
    if (C.isArray(r)) {
      return r.map(function (loc) {
        return loc ? geom.wrap(loc).shift(shift) : loc;
      });
    }
    return r ? geom.wrap(r).shift(shift) : r;
  }

  Column.prototype.locate = function () {
    var vis = this.grid, that = this;
    return this.grid.locate.apply(vis, C.argList(arguments)).then(function (r) {
      return shiftBy(r, that.visPos());
    });
  };

  Column.prototype.locateById = function () {
    var vis = this.vis, that = this;
    return this.grid.locateById.apply(this.grid, C.argList(arguments)).then(function (r) {
      return shiftBy(r, that.visPos());
    });
  };
  Column.prototype.layouted = function() {
    //sync the scaling
    var size = this.layout.getSize();
    this.summary_zoom.zoomTo(size.x - this.options.padding*2, this.options.summaryHeight - this.options.padding*2 - 30);
    size.y -=  this.options.summaryHeight;
    size.y -= this.range.dim(0).groups.length * 35; //FIXME hack
    this.grid_zoom.zoomTo(size.x, size.y);

    //shift the content for the aspect ratio
    var shift = [null, null];
    if (this.grid_zoom.isFixedAspectRatio) {
      var act = this.grid.size;
      shift[0] = ((size[0]-act[0])/2) + 'px';
      shift[1] = ((size[1]-act[1])/2) + 'px';
    }
    this.$parent.select('div.multiformgrid').style({
      left: shift[0],
      top: shift[1]
    });
    //center the toolbar
    var w = (18*(1+this.grid.visses.length));
    this.$toolbar.style('left',((size.x-w)/2)+'px');
  };
  Column.prototype.createToolBar = function() {
    var $t = this.$toolbar,
      that = this;
    multiform.addIconVisChooser($t.node(), this.grid);
    $t.append('i').attr('class','fa fa-close').on('click', function() {
      var g = session.retrieve('provenancegraph');
      g.push(createRemoveCmd(g.findObject(that)));
    });
    var w = (18*(1+this.grid.visses.length));
    $t.style('min-width',w+'px');
  };
  Column.prototype.destroy = function() {
    manager.remove(this);
    this.$parent.style('opacity',1).transition().style('opacity',0).remove();
  };



  exports.create = function(parent, data, partitioning) {
    session.retrieve('provenancegraph').push(createColumnCmd(parent, data, partitioning));
  }
});
