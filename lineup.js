/**
 * Created by sam on 24.02.2015.
 */
define(function (require, exports) {
  var views = require('../caleydo_core/layout_view');
  var C = require('../caleydo_core/main');
  var vis = require('../caleydo_core/vis');
  var tables = require('../caleydo_core/table_impl');
  var d3 = require('d3');

  function StratomeXLineUp(parent, showGroups, onAdd) {
    views.AView.call(this);
    this._data = [];
    this.parent = parent;
    this.showGroups = showGroups;
    this.onAdd = onAdd;
  }
  C.extendClass(StratomeXLineUp, views.AView);

  Object.defineProperty(StratomeXLineUp.prototype, 'data', {
    get : function() {
      return this._data;
    }
  });
  StratomeXLineUp.prototype.setBounds = function(x,y,w,h) {
    views.AView.prototype.setBounds.call(this, x, y, w, h);
    if (this.lineup) {
      this.lineup.update();
    }
  };
  function col(name, width) {
    return { column: name,  width: width };
  }
  function convertToTable(list) {
      return tables.wrapObjects({
          id : '_stratification',
          name: 'stratifications',
          type: 'table',
          rowtype: '_stratification',
          size: [list.length, 4],
          columns: [
            {
              name: 'Package',
              value: { type: 'string' },
              getter: function(d) {
                var s = d.desc.fqname.split('/');
                return s[0];
              }
            },
            {
              name: 'Dataset',
              value: { type: 'string' },
              getter: function(d) {
                var s = d.desc.fqname.split('/');
                return s.length === 2 ? s[0] : s[1];
              }
            },
            {
              name: 'Name',
              value: { type: 'string' },
              getter: function(d) {
                var s = d.desc.fqname.split('/');
                return s[s.length-1];
              }
            }, {
              name: 'Dimensions',
              value: { type: 'string' },
              getter: function(d) { return d.dim.join(' x '); },
              lineup: {
                alignment: 'right'
              }
            }, {
              name: 'ID Type',
              value: { type: 'string' },
              getter: function(d) { return (d.idtypes.map(String).join(', ')); }
            }, {
              name: 'Type',
              value: { type: 'string' },
              getter: function(d) { return d.desc.type; }
            }, {
              name: '# Groups',
              value: { type: 'string' },
              getter: function(d) { return d.ngroups || (d.valuetype.categories ? d.valuetype.categories.length : 0); },
              lineup: {
                alignment: 'right'
              }
            }
          ]
    }, list, function(d) { return d.desc.name });
  }
  StratomeXLineUp.prototype.setData = function(stratifications) {
    var that = this;
    var data = convertToTable(stratifications);
    this.rawData = stratifications;
    this._data = [data];
    this.parent.__data__  = data;
    var v = vis.list(data);
    v = v.filter(function (v) { return v.id === 'caleydo-vis-lineup';})[0];
    v.load().then(function (plugin) {
      that.lineup = plugin.factory(data, that.parent, {
        lineup: {
          svgLayout: {
            mode: 'separate',
            rowActions: [
              {
                name: 'add',
                icon: '\uf067',
                action: function(row) { that.onAdd(row._); }
              }
            ]
          },
          manipulative: true,
          interaction: {
            tooltips: false
          }
        },
        dump: {
          layout: {
            primary: [
              {type: 'actions', width: 20, label: ' '}, {
              type: 'rank',
              width: 40
            }, col('Package', 150), col('Dataset', 220), col('Name', 220), col('Dimensions', 90), col('ID Type', 120), col(that.showGroups ? '# Groups' : 'Type', 80)]
          }
        }
      });
    });
  };

  exports.StratomeXLineUp = StratomeXLineUp;
  exports.create = function (parent, onAdd) {
    return new StratomeXLineUp(parent, true, onAdd);
  };
  exports.createData = function (parent, onAdd) {
    return new StratomeXLineUp(parent, false, onAdd);
  }
});
