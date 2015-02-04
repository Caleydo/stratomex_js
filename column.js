/**
 * Created by sam on 30.01.2015.
 */
define(['require', 'exports', 'd3', '../caleydo/vis', '../caleydo/multiform', '../caleydo/idtype', '../caleydo/behavior','font-awesome'], function (require, exports) {
  var d3 = require('d3');
  var vis = require('../caleydo/vis');
  var multiform = require('../caleydo/multiform');
  var idtypes = require('../caleydo/idtype');
  var behaviors = require('../caleydo/behavior');
  var events = require('../caleydo/event');
  var layouts = require('../caleydo-layout/main');

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

  function Column(parent, data, partitioning) {
    this.data = data;
    this.$parent = d3.select(parent).append('div').attr('class', 'column');
    this.$toolbar = this.$parent.append('div').attr('class','toolbar');
    this.partitioning = partitioning;
    var initialVis = guessInitial(data.desc);
    //create the vis
    this.grid = multiform.createGrid(data, partitioning, this.$parent.node(), function (data, range) {
      return data.view(range)
    }, {
      initialVis: initialVis
    });
    this.id = manager.nextId(this);

    //zooming
    var z = this.zoom = new behaviors.ZoomLogic(this.grid, this.grid.asMetaData);
    var layoutOptions = {};
    var g = this.grid.on('changed', function() {
      layoutOptions['prefWidth'] = z.isWidthFixed ? g.size[0] : Number.NaN;
      layoutOptions['prefHeight'] = z.isHeightFixed ? g.size[1] : Number.NaN;
      manager.fire('dirty'); //fire relayout
    });
    //create layout version
    this.layout = layouts.wrapDOM(this.$parent.node(), layoutOptions);

    this.createToolBar();

    manager.fire('dirty'); //fire relayout
  }
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
  };
  Column.prototype.createToolBar = function() {
    var $t = this.$toolbar,
      that = this;
    multiform.addIconVisChooser($t.node(), this.grid);
    $t.append('i').attr('class','fa fa-close').on('click', function() {
      that.destroy();
    });
    var w = (18*(1+this.grid.visses.length));
    $t.style('min-width',w+'px');
  };
  Column.prototype.destroy = function() {
    manager.remove(this);
    this.$parent.remove();
    manager.fire('dirty');
  };

  exports.create = function(parent, data, partitioning) {
    return new Column(parent, data, partitioning);
  }
});
