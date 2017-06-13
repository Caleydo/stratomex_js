/**
 * Created by sam on 24.02.2015.
 */


import {AView} from 'phovea_core/src/layout_view';
import {IDataType} from 'phovea_core/src/datatype';
import {IStratification} from 'phovea_core/src/stratification';
import Rect from 'phovea_core/src/geom/Rect';
import {INumericalVector, ICategoricalVector} from 'phovea_core/src/vector';
import {INumericalMatrix} from 'phovea_core/src/matrix';
import LocalDataProvider from 'lineupjs/src/provider/LocalDataProvider';
import LineUp from 'lineupjs/src/lineup';
import {createActionDesc, createRankDesc} from 'lineupjs/src/model';

const columns = [
  {
    name: 'Package',
    value: {type: 'string'},
    accessor: (d) => {
      const s = d.desc.fqname.split('/');
      return s[0];
    }
  },
  {
    name: 'Dataset',
    value: {type: 'string'},
    accessor: (d) => {
      const s = d.desc.fqname.split('/');
      return s.length === 2 ? s[0] : s[1];
    }
  },
  {
    name: 'Name',
    value: {type: 'string'},
    accessor: (d) => {
      const s = d.desc.fqname.split('/');
      return s[s.length - 1];
    }
  }, <any>{
    name: 'Dimensions',
    value: {type: 'string'},
    accessor: (d) => d.dim.join(' x '),
    alignment: 'right'
  }, {
    name: 'ID Type',
    value: {type: 'string'},
    accessor: (d) => (d.idtypes.map(String).join(', '))
  }, {
    name: 'Type',
    value: {type: 'string'},
    accessor: (d) => d.desc.type
  }, {
    name: '# Groups',
    value: {type: 'number'},
    accessor: (d) => d.ngroups || (d.valuetype.categories ? d.valuetype.categories.length : 0),
    alignment: 'right'
  }
];

class StratomeXLineUp extends AView {
  private readonly lineup: LineUp;
  private readonly provider: LocalDataProvider;

  private bounds: Rect = new Rect(0, 0, 0, 0);

  constructor(parent: Element, private readonly showGroups: boolean, private onAdd: (s: IDataType) => void) {
    super();

    this.provider = new LocalDataProvider([], columns);
    StratomeXLineUp.createDefaultRanking(this.provider, showGroups);
    this.lineup = new LineUp(parent, this.provider, {
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
      manipulative: true
    });
  }

  static createDefaultRanking(provider: LocalDataProvider, showGroups: boolean) {
    const r = provider.pushRanking();
    provider.push(r, createActionDesc(' ')).setWidth(20);
    provider.push(r, createRankDesc()).setWidth(40);
    provider.push(r, columns[0]).setWidth(150); //package
    provider.push(r, columns[1]).setWidth(220); //dataset
    provider.push(r, columns[2]).setWidth(220); //name
    provider.push(r, columns[3]).setWidth(90); //dimensions
    provider.push(r, columns[4]).setWidth(showGroups ? 250 : 120); //idtype
    provider.push(r, columns[showGroups ? 6: 5]).setWidth(80);
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
    this.provider.setData(datasets);
    this.lineup.update();
  }
}

export function create(parent: HTMLElement, onAdd: (s: IStratification|ICategoricalVector) => void) {
  return new StratomeXLineUp(parent, true, onAdd);
}

export function createData(parent: HTMLElement, onAdd: (s: INumericalVector|INumericalMatrix) => void) {
  return new StratomeXLineUp(parent, false, onAdd);
}
