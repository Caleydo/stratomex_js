/**
 * Created by sam on 24.02.2015.
 */


import {ITable} from 'phovea_core/src/table/ITable';
import {wrapObjects} from 'phovea_core/src/table/Table';
import {AView} from 'phovea_core/src/layout_view';
import {IVisInstance, list as listVis} from 'phovea_core/src/vis';
import {assignData, IDataType, VALUE_TYPE_STRING} from 'phovea_core/src/datatype';
import {IStratification} from 'phovea_core/src/stratification';
import Rect from 'phovea_core/src/geom/Rect';
import {INumericalVector, ICategoricalVector} from 'phovea_core/src/vector';
import {INumericalMatrix} from 'phovea_core/src/matrix';

function col(name, width) {
  return {column: name, width};
}
function convertToTable(list: IDataType[], name: string) {
  return wrapObjects({
    id: '_data',
    name,
    fqname: 'stratomex/'+name,
    description: '',
    type: 'table',
    idtype: '_dataset',
    creator: 'Anonymous',
    ts: Date.now(),
    size: [list.length, 4],
    columns: [
      {
        name: 'Package',
        value: {type: VALUE_TYPE_STRING},
        getter: (d) => {
          const s = d.desc.fqname.split('/');
          return s[0];
        }
      },
      {
        name: 'Dataset',
        value: {type: VALUE_TYPE_STRING},
        getter: (d) => {
          const s = d.desc.fqname.split('/');
          return s.length === 2 ? s[0] : s[1];
        }
      },
      {
        name: 'Name',
        value: {type: VALUE_TYPE_STRING},
        getter: (d) => {
          const s = d.desc.fqname.split('/');
          return s[s.length - 1];
        }
      }, <any>{
        name: 'Dimensions',
        value: {type: VALUE_TYPE_STRING},
        getter: (d) => d.dim.join(' x '),
        lineup: {
          alignment: 'right'
        }
      }, {
        name: 'ID Type',
        value: {type: VALUE_TYPE_STRING},
        getter: (d) => (d.idtypes.map(String).join(', '))
      }, {
        name: 'Type',
        value: {type: VALUE_TYPE_STRING},
        getter: (d) => d.desc.type
      }, {
        name: '# Groups',
        value: {type: VALUE_TYPE_STRING},
        getter: (d) => d.ngroups || (d.valuetype.categories ? d.valuetype.categories.length : 0),
        lineup: {
          alignment: 'right'
        }
      }
    ]
  }, list, (d) => d.desc.name);
}


class StratomeXLineUp extends AView {
  private _data : ITable[] = [];
  private rawData: IDataType[] = [];
  lineup: IVisInstance = null;

  private bounds: Rect = new Rect(0, 0, 0, 0);

  constructor(public readonly parent: Element, private readonly showGroups: boolean, private onAdd: (s: IDataType) => void) {
    super();
  }

  get idtypes() {
    return this.data.length > 0 ? this.data[0].idtypes : [];
  }

  get data() {
    return this._data;
  }

  getBounds() {
    return this.bounds;
  }

  setBounds(x: number, y: number, w: number, h: number) {
    this.bounds = new Rect(x, y, w, h);
    if (this.lineup) {
      this.lineup.update();
    }
  }

  setData(datasets: IDataType[]) {
    const data = convertToTable(datasets, this.showGroups ? 'Stratifications': 'Datasets');
    this.rawData = datasets;
    this._data = [data];
    assignData(this.parent, data);
    const v = listVis(data).filter((v) => v.id === 'phovea-vis-lineup')[0];
    v.load().then((plugin) => {
      this.lineup = plugin.factory(data, this.parent, {
        lineup: {
          body: {
            renderer: 'svg',
            actions: [
              {
                name: 'add',
                icon: '\uf067',
                action: (row) => this.onAdd(row._)
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
              }, col('Package', 150), col('Dataset', 220), col('Name', 220), col('Dimensions', 90), col('ID Type', this.showGroups ? 250 : 120), col(this.showGroups ? '# Groups' : 'Type', 80)]
          }
        }
      });
    });
  }
}

export function create(parent: HTMLElement, onAdd: (s: IStratification|ICategoricalVector) => void) {
  return new StratomeXLineUp(parent, true, onAdd);
}

export function createData(parent: HTMLElement, onAdd: (s: INumericalVector|INumericalMatrix) => void) {
  return new StratomeXLineUp(parent, false, onAdd);
}
