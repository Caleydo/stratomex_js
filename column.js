/**
 * Created by sam on 30.01.2015.
 */
define(function (require, exports) {
  var d3 = require('d3');
  var vis = require('../caleydo/vis');
  var C = require('../caleydo/main');
  var multiform = require('../caleydo/multiform');
  var geom = require('../caleydo/geom');
  var idtypes = require('../caleydo/idtype');
  var behaviors = require('../caleydo/behavior');
  var events = require('../caleydo/event');
  var layouts = require('../caleydo-layout/main');
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

  function createColumn(inputs, parameter) {
    var parent = inputs[0].v,
      data = inputs[1].v,
      partitioning = ranges.parse(parameter.partitioning);
    var c = new Column(parent, data, partitioning);
    var r = prov.createRef(c, 'Column of '+data.desc.name, prov.cat.vis);
    return {
      created: [r],
      inverse: createRemoveCmd(r)
    }
  }
  function removeColumn(inputs, parameter, graph) {
    var column = inputs[0].v,
      data = graph.findObject(column.data),
      partitioning = column.range,
      parent = graph.findObject(column.$parent.node().parentElement);
    column.destroy();
    return {
      removed: [inputs[0]],
      inverse: createColumnCmd(parent, data, partitioning)
    };
  }
  function createColumnCmd(parent, data, partitioning) {
    return prov.cmd(prov.meta('Create Column for '+data.v.desc.name, prov.CmdOperation.create), 'createColumn', createColumn, [parent, data], { partitioning: partitioning })
  }
  function createRemoveCmd(column) {
    return prov.cmd(prov.meta('Remove Column', prov.CmdOperation.remove), 'removeColumn', removeColumn, [column]);
  }

  function Column(parent, data, partitioning) {
    events.EventHandler.call(this);
    var that = this;
    this.data = data;
    this.$parent = d3.select(parent).append('div').attr('class', 'column');
    this.$toolbar = this.$parent.append('div').attr('class','toolbar');
    this.range = partitioning;
    var initialVis = guessInitial(data.desc);
    //create the vis
    this.grid = multiform.createGrid(data, partitioning, this.$parent.node(), function (data, range) {
      return data.view(range)
    }, {
      initialVis: initialVis
    });

    //zooming
    var z = this.zoom = new behaviors.ZoomLogic(this.grid, this.grid.asMetaData);
    var layoutOptions = {};
    var g = this.grid.on('changed', function(event, to, from) {
      that.fire('changed', to, from);
      layoutOptions['prefWidth'] = z.isWidthFixed ? g.size[0] : Number.NaN;
      layoutOptions['prefHeight'] = z.isHeightFixed ? g.size[1] : Number.NaN;
      manager.fire('dirty'); //fire relayout
    });
    //create layout version
    this.layout = layouts.wrapDOM(this.$parent.node(), layoutOptions);

    this.createToolBar();

    this.id = manager.nextId(this);
    manager.fire('dirty'); //fire relayout
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
    var xy = this.location.xy;
    var $grid = this.$parent.select('div.multiformgrid');
    function fromPx(v) {
      return parseFloat(v.substring(0, v.length-2));
    }
    var sx = fromPx($grid.style('left') || '0px');
    var sy = fromPx($grid.style('top') || '0px');
    return xy.addEquals(geom.vec(sx, sy));
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
    this.zoom.zoomTo(size.x, size.y);

    //shift the content for the aspect ratio
    var shift = [null, null];
    if (this.zoom.isFixedAspectRatio) {
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

    this.fire('dirty');
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
    this.$parent.remove();
    manager.fire('dirty');
  };

  exports.areNeighborColumns = function (ca, cb) {
    var loca = ca.location,
      locb = cb.location,
      t = null;
    if (loca.x > locb.x) { //swap order
      t = locb;
      locb = loca;
      loca = t;
    }
    //none in between
    return !exports.manager.entries.some(function(c) {
      if (c === ca || c === cb) {
        return false;
      }
      var l = c.location;
      return loca.x <= l.x && l.x <= locb.x;
    });
  };

  exports.create = function(parent, data, partitioning) {
    session.retrieve('provenancegraph').push(createColumnCmd(parent, data, partitioning));
  }
});
