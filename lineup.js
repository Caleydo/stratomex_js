/**
 * Created by sam on 24.02.2015.
 */
define(function (require, exports) {
  var views = require('../caleydo-layout/view');
  var C = require('../caleydo/main');
  var events = require('../caleydo/event');
  var vis = require('../caleydo/vis');

  function StratomeXLineUp(parent, datalist) {
    views.AView.call(this);
    this.build(parent, datalist);

  }
  C.extendClass(StratomeXLineUp, views.AView);

  StratomeXLineUp.prototype.build = function(parent, onAdd) {
    this.parent = parent;
    this.onAdd = onAdd;
  };
  StratomeXLineUp.prototype.setData = function(datalist) {
    var that = this;
    var v = vis.list(datalist);
    v = v.filter(function (v) { return v.id === 'caleydo-vis-lineup';})[0];
    v.load().then(function (plugin) {
      that.lineup = plugin.factory(datalist, that.parent, {
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
        layout: {
          primary: [
            {
              type: 'actions',
              width: 30
            },
            {
              type: 'rank',
              width: 50
            },
            {
              column: 'Name',
              width: 250
            },
            {
              column: 'Type',
              width: 100
            },
            {
              column: 'Dimensions',
              width: 100
            },
            {
              column: 'ID Types',
              width: 200
            }
          ]
        }
      });
    });
  };

  exports.StratomeXLineUp = StratomeXLineUp;
  exports.create = function (parent, onAdd) {
    return new StratomeXLineUp(parent, onAdd);
  }
});
