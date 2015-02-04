/**
 * Created by sam on 30.01.2015.
 */
define(['require', 'exports', 'd3', '../caleydo/vis', '../caleydo/multiform', '../caleydo/idtype', '../caleydo/behavior'], function (require, exports) {
  var d3 = require('d3');
  var vis = require('../caleydo/vis');
  var multiform = require('../caleydo/multiform');
  var idtypes = require('../caleydo/idtype');
  var behaviors = require('../caleydo/behavior');
  var events = require('../caleydo/event');
  var layouts = require('../caleydo-layout/main');

  function guessInitial(desc) {
    if (desc.type === 'matrix') {
      return 'caleydo-vis-heatmap';
    }
    if (desc.type === 'vector') {
      return  desc.value.type === 'categorical' ? 'caleydo-vis-mosaic' : 'caleydo-vis-heatmap1d';
    }
    return -1;
  }

  var manager = exports.manager = new idtypes.ObjectManager('_column', 'Column');

  function Column(parent, data, partitioning) {
    this.data = data;
    this.$parent = d3.select(parent).append('div').attr('class', 'column');
    this.partitioning = partitioning;
    var initialVis = guessInitial(data.desc);
    this.grid = multiform.createGrid(data, partitioning, this.$parent.node(), function (data, range) {
      return data.view(range)
    }, {
      initialVis: initialVis
    });
    this.id = manager.nextId(this);

    var z = this.zoom = new behaviors.ZoomLogic(this.grid, this.grid.asMetaData);
    var layoutOptions = {};
    var g = this.grid.on('changed', function() {
      layoutOptions['prefWidth'] = z.isWidthFixed ? g.size.x : Number.NaN;
      layoutOptions['prefHeight'] = z.isHeightFixed ? g.size.x : Number.NaN;
      manager.fire('dirty'); //fire relayout
    });
    this.layout = layouts.wrapDOM(this.$parent.node(), layoutOptions);
    manager.fire('dirty'); //fire relayout
  }
  Column.prototype.layouted = function() {
    //sync the scaling
    var size = this.layout.getSize();
    this.zoom.zoomTo(size.x, size.y);
  };


  exports.create = function(parent, data, partitioning) {
    return new Column(parent, data, partitioning);
  }
});
