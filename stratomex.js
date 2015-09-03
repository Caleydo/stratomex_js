/**
 * Created by sam on 24.02.2015.
 */
define(function (require, exports) {
  var views = require('../caleydo_core/layout_view');
  var C = require('../caleydo_core/main');
  var link_m = require('../caleydo_links/link');
  var ranges = require('../caleydo_core/range');

  var layout = require('../caleydo_core/layout').distributeLayout(true, 100, { top : 30, left: 30, right: 30, bottom: 10});
  var columns = require('./column.js');

  function StratomeX(parent, provGraph) {
    views.AView.call(this);
    var that = this;
    this.parent = parent;
    this._thisRef =  provGraph.addObject(this, 'StratomeX', 'visual');
    this.provGraph = provGraph;
    this._columns = [];
    this._links = new link_m.LinkContainer(parent, ['changed'], {
      interactive: false,
      filter: C.bind(that.areNeighborColumns, this),
      mode: 'link-group',
      idTypeFilter : function(idtype, i) {
        return i == 0; //just the row i.e. first one
      }
    });

  }
  C.extendClass(StratomeX, views.AView);
  StratomeX.prototype.setBounds = function(x,y,w,h) {
    views.AView.prototype.setBounds.call(this, x,y,w,h);
    this.dim = [w,h];
    this.relayout();
  };
  StratomeX.prototype.relayout = function() {
    var that = this;
    that._links.hide();
    layout(this._columns.map(function(c) { return c.value.layout; }), this.dim[0], this.dim[1]).then(function() {
      that._links.update();
    });
  };
  StratomeX.prototype.addData = function(rowStrat, m) {
    var that = this;
    var mref = this.provGraph.findOrAddObject(m, m.desc.name, 'data');
    rowStrat.range().then(function(r) {
      that.provGraph.push(columns.createColumnCmd(that._thisRef, mref, ranges.list(r, ranges.Range1D.all())));
    });
  };
  StratomeX.prototype.areNeighborColumns = function (ca, cb) {
    var loca = ca.location,
      locb = cb.location,
      t = null;
    if (loca.x > locb.x) { //swap order
      t = locb;
      locb = loca;
      loca = t;
    }
    //none in between
    return !this._columns.some(function(c) {
      if (c.value === ca || c.value === cb) {
        return false;
      }
      var l = c.value.location;
      return loca.x <= l.x && l.x <= locb.x;
    });
  };
  StratomeX.prototype.addColumn = function(columnRef) {
    this._columns.push(columnRef);
    columnRef.value.on('changed', C.bind(this.relayout, this));
    this._links.push(false, columnRef.value);
    this.relayout();
  };
  StratomeX.prototype.removeColumn = function(columnRef) {
    var i = C.indexOf(this._columns,function(elem) { return elem.value === columnRef.value; });
    if (i >= 0) {
      this._columns.splice(i, 1);
      this._links.remove(false, columnRef.value);
      this.relayout();
    }
  };
  StratomeX.prototype.moveColumn = function(columnRef, shift) {
    var i = C.indexOf(this._columns,function(elem) { return elem.value === columnRef.value; });
    if (i >= 0) {
      this._columns.splice(i, 1);
      this._columns.splice(i+shift, 0, columnRef);
      this.relayout();
    }
  };
  StratomeX.prototype.canShift = function(columnRef) {
    var i = C.indexOf(this._columns,function(elem) { return elem.value === columnRef.value; });
    return {
      left: i,
      right : i - this._columns.length + 1
    };
  };

  exports.StratomeX = StratomeX;
  exports.create = function (parent, provGraph) {
    return new StratomeX(parent, provGraph);
  }
});
