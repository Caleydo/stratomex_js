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
import 'lineupjs/src/style.scss';
import {createActionDesc, createRankDesc} from 'lineupjs/src/model';
import NumberColumn from 'lineupjs/src/model/NumberColumn';

const columns = [
  {
    label: 'Package',
    type: 'string',
    accessor: (d) => {
      const s = d.desc.fqname.split('/');
      return s[0];
    }
  },
  {
    label: 'Dataset',
    type: 'string',
    accessor: (d) => {
      const s = d.desc.fqname.split('/');
      return s.length === 2 ? s[0] : s[1];
    }
  },
  {
    label: 'Name',
    type: 'string',
    accessor: (d) => {
      const s = d.desc.fqname.split('/');
      return s[s.length - 1];
    }
  }, <any>{
    label: 'Dimensions',
    type: 'string',
    accessor: (d) => d.dim.join(' x '),
    alignment: 'right'
  }, {
    label: 'ID Type',
    type: 'string',
    accessor: (d) => (d.idtypes.map(String).join(', '))
  }, {
    label: 'Type',
    type: 'string',
    accessor: (d) => d.desc.type
  }, {
    label: '# Groups',
    type: 'string',
    domain: [0, 20],
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

    this.provider = new LocalDataProvider([], columns.slice());
    StratomeXLineUp.createDefaultRanking(this.provider, showGroups);
    this.lineup = new LineUp(parent, this.provider, {
      body: {
        renderer: 'canvas',
        actions: [
          {
            name: 'add',
            icon: '\uf067',
            action: (row) => this.onAdd(row)
          }
        ]
      },
      manipulative: true
    });
  }

  static createDefaultRanking(provider: LocalDataProvider, showGroups: boolean) {
    const r = provider.pushRanking();
    r.clear();
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
    this.update();
  }

  update() {
    if (this.lineup) {
      this.lineup.update();
    }
  }

  setData(datasets: IDataType[]) {
    this.provider.setData(datasets);
    this.update();
  }

  /**
   * adds a lazy column to LineUp
   * @param label
   * @param domain
   * @param data a map of datasetId->scores
   */
  addNumberColumn(label: string, domain: [number, number], data: Promise<{ [datasetId: string]: number }>) {
    let lookup: { [datasetId: string]: number } = null;
    const desc = {
      type: 'number',
      label,
      domain,
      lazyLoaded: true,
      accessor: (d: IDataType) => {
        if (lookup === null || !lookup.hasOwnProperty(d.desc.id)) {
          return NaN;
        }
        return lookup[d.desc.id];
      }
    };
    this.provider.pushDesc(desc);
    const column = <NumberColumn>this.provider.push(this.provider.getLastRanking(), desc);

    data.then((scores) => {
      lookup = scores;
      column.setLoaded(true);
      column.sortByMe();
    });
  }
}

export function create(parent: HTMLElement, onAdd: (s: IStratification|ICategoricalVector) => void) {
  return new StratomeXLineUp(parent, true, onAdd);
}

export function createData(parent: HTMLElement, onAdd: (s: INumericalVector|INumericalMatrix) => void) {
  return new StratomeXLineUp(parent, false, onAdd);
}
