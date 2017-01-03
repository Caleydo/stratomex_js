/**
 * Created by sam on 24.02.2015.
 */

import {wrapObjects} from 'phovea_core/src/table/Table';
import * as views from 'phovea_core/src/layout_view';
import * as vis from 'phovea_core/src/vis';

function col(name, width) {
  return {column: name, width: width};
}
function convertToTable(list) {
  return wrapObjects({
    id: '_stratification',
    name: 'stratifications',
    fqname: 'stratomex/stratifications',
    type: 'table',
    rowtype: '_stratification',
    size: [list.length, 4],
    columns: [
      {
        name: 'Package',
        value: {type: 'string'},
        getter: function (d) {
          var s = d.desc.fqname.split('/');
          return s[0];
        }
      },
      {
        name: 'Dataset',
        value: {type: 'string'},
        getter: function (d) {
          var s = d.desc.fqname.split('/');
          return s.length === 2 ? s[0] : s[1];
        }
      },
      {
        name: 'Name',
        value: {type: 'string'},
        getter: function (d) {
          var s = d.desc.fqname.split('/');
          return s[s.length - 1];
        }
      }, {
        name: 'Dimensions',
        value: {type: 'string'},
        getter: function (d) {
          return d.dim.join(' x ');
        },
        lineup: {
          alignment: 'right'
        }
      }, {
        name: 'ID Type',
        value: {type: 'string'},
        getter: function (d) {
          return (d.idtypes.map(String).join(', '));
        }
      }, {
        name: 'Type',
        value: {type: 'string'},
        getter: function (d) {
          return d.desc.type;
        }
      }, {
        name: '# Groups',
        value: {type: 'string'},
        getter: function (d) {
          return d.ngroups || (d.valuetype.categories ? d.valuetype.categories.length : 0);
        },
        lineup: {
          alignment: 'right'
        }
      }
    ]
  }, list, function (d) {
    return d.desc.name;
  });
}


class StratomeXLineUp extends views.AView {
  private _data = [];
  private rawData = [];
  lineup: vis.IVisInstance = null;

  constructor(public parent: Element, private showGroups: boolean, private onAdd) {
    super();
  }

  get data() {
    return this._data;
  }

  setBounds(x, y, w, h) {
    super.setBounds(x, y, w, h);
    if (this.lineup) {
      this.lineup.update();
    }
  }

  setData(stratifications) {
    var that = this;
    var data = convertToTable(stratifications);
    this.rawData = stratifications;
    this._data = [data];
    (<any>this.parent).__data__ = data;
    const v =  vis.list(data).filter((v) => v.id === 'phovea-vis-lineup')[0];
    v.load().then(function (plugin) {
      that.lineup = plugin.factory(data, that.parent, {
        lineup: {
          body: {
            renderer: 'canvas',
            actions: [
              {
                name: 'add',
                icon: '\uf067',
                action: function (row) {
                  that.onAdd(row._);
                }
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
              }, col('Package', 150), col('Dataset', 220), col('Name', 220), col('Dimensions', 90), col('ID Type', that.showGroups ? 250 : 120), col(that.showGroups ? '# Groups' : 'Type', 80)]
          }
        }
      });
    });
  }
}

export function create(parent, onAdd) {
  return new StratomeXLineUp(parent, true, onAdd);
}

export function createData(parent, onAdd) {
  return new StratomeXLineUp(parent, false, onAdd);
}
