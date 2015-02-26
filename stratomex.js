/**
 * Created by sam on 24.02.2015.
 */
define(function (require, exports) {
  var views = require('../caleydo-layout/view');
  var C = require('../caleydo/main');
  var link_m = require('../caleydo-links/link');
  var ranges = require('../caleydo/range');

  var layout = require('../caleydo-layout/main').distributeLayout(true, 100, { top : 30, left: 30, right: 30, bottom: 10});
  var columns = require('./column.js');


  function StratomeX(parent, provGraph) {
    views.AView.call(this);
    this.parentRef =  provGraph.addObject(parent, 'StratomeX DOM', 'visual');
    this.provGraph = provGraph;

    this.manager = provGraph.addObject(columns.manager, 'Column Manager', 'logic');
    var links = new link_m.LinkContainer(parent, ['dirty'], {
      interactive: false,
      filter: columns.areNeighborColumns,
      mode: 'link-group'
    });

    this.manager.v.on('add', function (event, id, column) {
      links.push(column);
    });
    this.manager.v.on('remove', function (event, id, column) {
      links.remove(column);
    });

    var that = this;
    columns.manager.on('dirty', function() {
      that.relayout();
    });
  }
  C.extendClass(StratomeX, views.AView);
  StratomeX.prototype.setBounds = function(x,y,w,h) {
    views.AView.prototype.setBounds.call(this, x,y,w,h);
    this.dim = [w,h];
    this.relayout();
  };
  StratomeX.prototype.relayout = function() {
    layout(columns.manager.entries.map(function(c) { return c.layout; }), this.dim[0], this.dim[1]);
  };
  StratomeX.prototype.addData = function(rowStrat, m, colStrat) {
    var that = this;
    var mref = this.provGraph.addObject(m, m.desc.name, 'data');
    if (m.desc.type === 'matrix') {
      C.all([rowStrat.range(), colStrat.range()]).then(function(rr) {
        columns.create(that.parentRef, mref, ranges.list(rr[0],rr[1]));
      })
    } else {
      rowStrat.range().then(function(r) {
        columns.create(that.parentRef, mref, ranges.list(r));
      })
    }
  };

  exports.StratomeX = StratomeX;
  exports.create = function (parent, provGraph) {
    return new StratomeX(parent, provGraph);
  }
});
