/**
 * Created by sam on 24.02.2015.
 */
define(function (require, exports) {
  var views = require('../caleydo-layout/view');
  var C = require('../caleydo/main');
  var events = require('../caleydo/event');
  var layouts = require('../caleydo-layout/main');
  var vis = require('../caleydo/vis');
  var d3 = require('d3');

  function StratomeXLineUp(parent, onAdd) {
    views.AView.call(this);
    this._data = [];
    this.parent = parent;
    this.onAdd = onAdd;
  }
  C.extendClass(StratomeXLineUp, views.AView);

  Object.defineProperty(StratomeXLineUp.prototype, 'data', {
    get : function() {
      return this._data;
    }
  });
  function col(name, width) {
    return { column: name,  width: width };
  }
  StratomeXLineUp.prototype.createInteraction = function() {
    var activeRow = null, activeData = null, activeCol = null, that = this;

    var $button = d3.select(this.parent).append('div').append('button')
      .attr('disabled','disabled').attr('class','fa fa-plus').on('click', function() {
        that.onAdd(activeRow, activeData, activeCol);
    });
    function updateFilter() {
      if (activeRow && activeData && (activeCol || activeData.desc.type === 'vector')) {
        $button.attr('disabled',null);
      } else {
        $button.attr('disabled','disabled');
      }
      //filter according to selected data
      if (activeData) {
        if (activeData.desc.type === 'vector') {
          that.colLineup.lineup.changeFilter('ID Types', '_none');
        } else {
          that.colLineup.lineup.changeFilter('ID Types', activeData.idtypes[1].name);
        }
        that.rowLineup.lineup.changeFilter('ID Types', activeData.idtypes[0].name);
      } else {
        that.colLineup.lineup.changeFilter('ID Types', '');
        that.rowLineup.lineup.changeFilter('ID Types', '');
      }
      if (activeRow) {
        that.dataLineup.lineup.changeFilter('ID Types', new RegExp('^('+activeRow.idtypes.map(String).join('|')+').*'));
      } else {
        that.dataLineup.lineup.changeFilter('ID Types', '');
      }
    }
    this.rowLineup.lineup.on('selected', function(row) {
      if (row) {
        activeRow = row._;
      } else {
        activeRow = null;
      }
      updateFilter();
    });
    this.dataLineup.lineup.on('selected', function(row) {
      if (row) {
        activeData = row._;
      } else {
        activeData = null;
      }
      updateFilter();
    });
    this.colLineup.lineup.on('selected', function(row) {
      if (row) {
        activeCol = row._;
      } else {
        activeCol = null;
      }
      updateFilter();
    });
  };
  StratomeXLineUp.prototype.setData = function(stratifications, data) {
    var that = this;
    this._data = [stratifications, data];
    this.parent.__data__  = data;
    var v = vis.list(data);
    v = v.filter(function (v) { return v.id === 'caleydo-vis-lineup';})[0];
    v.load().then(function (plugin) {
      that.rowLineup = plugin.factory(stratifications, that.parent, {
        lineup: {
          svgLayout: {
            mode: 'separate'
          },
          manipulative: true,
          interaction: {
            tooltips: false
          }
        },
        layout: {
          primary: [ col('Name', 220), col('ID Types', 80)]
        }
      });
      that.dataLineup = plugin.factory(data, that.parent, {
        lineup: {
          svgLayout: {
            mode: 'separate'
          },
          manipulative: true,
          interaction: {
            tooltips: false
          }
        },
        layout: {
          primary: [ col('Name', 220),
            col('Type',80), col('Dimensions', 90), col('ID Types', 150)]
        }
      });
      that.colLineup = plugin.factory(stratifications, that.parent, {
        lineup: {
          svgLayout: {
            mode: 'separate'
          },
          manipulative: true,
          interaction: {
            tooltips: false
          }
        },
        layout: {
          primary: [ col('Name', 220), col('ID Types', 80)]
        }
      });
      that.createInteraction();
    });
  };

  exports.StratomeXLineUp = StratomeXLineUp;
  exports.create = function (parent, onAdd) {
    return new StratomeXLineUp(parent, onAdd);
  }
});
