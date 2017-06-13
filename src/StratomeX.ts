/**
 * Created by sam on 24.02.2015.
 */

import {AView} from 'phovea_core/src/layout_view';
import {IDataType} from 'phovea_core/src/datatype';
import {IStratification} from 'phovea_core/src/stratification';
import {resolveIn} from 'phovea_core/src/index';
import {LinkContainer} from 'phovea_d3/src/link';
import {list as rlist, Range1D, Range} from 'phovea_core/src/range';
import {IObjectRef, ProvenanceGraph} from 'phovea_core/src/provenance';
import {Column, manager, createColumnCmd} from './Column';
import Rect from 'phovea_core/src/geom/Rect';

//type ColumnRef = prov.IObjectRef<columns.Column>;

function toName(data: string, par: string) {
  const n: string = data;
  const i = n.lastIndexOf('/');
  const base = i >= 0 ? n.slice(i + 1) : n;

  let c = par.replace(' Clustering', '');
  const j = c.lastIndexOf('/');
  c = j >= 0 ? c.slice(j + 1) : c;

  if (par.indexOf('Clustering') !== -1) {
    //if it's some clustering, keep base in name for differentiation
    if (base === c) {
      return base;
    }
    return base + ' (' + c + ')';
  }

  return c;
}

function toMiddle(n: string) {
  const l = n.split('/');
  return l.length > 1 ? l[l.length - 2] : n;
}

export class StratomeX extends AView {
  private _columns: Column[] = [];

  private dim: [number, number];
  private _links: LinkContainer;
  ref: IObjectRef<StratomeX>;

  private interactive = true;

  private bounds: Rect = new Rect(0, 0, 0, 0);

  constructor(public parent: Element, private provGraph: ProvenanceGraph) {
    super();
    this.ref = provGraph.findOrAddObject(this, 'StratomeX', 'visual');
    this._links = new LinkContainer(parent, ['changed'], {
      interactive: false,
      filter: this.areNeighborColumns.bind(this),
      mode: 'link-group',
      idTypeFilter: (idtype, i) => i === 0, //just the row i.e. first one
      hover: false,
      canSelect: () => this.interactive
    });
  }

  setInteractive(interactive: boolean) {
    this.interactive = interactive;
    this._columns.forEach((c) => c.setInteractive(interactive));
  }

  reset() {
    this._columns.forEach((c) => {
      c.destroy(-1);
    });
    this._columns = [];
    this._links.clear();
  }

  getBounds() {
    return this.bounds;
  }

  setBounds(x, y, w, h) {
    this.bounds = new Rect(x, y, w, h);
    this.dim = [w, h];
    return this.relayout();
  }

  get data() {
    return [].concat(...this._columns.map((d) => d.data));
  }

  get idtypes() {
    return Array.from(new Set([].concat(...this.data.map((d) => d.idtypes))));
  }


  private relayoutTimer = -1;

  relayout(within = -1) {
    this._links.hide();
    return resolveIn(5).then(() => {
      this._columns.forEach((d) => d.layouted(within));
      if (this.relayoutTimer >= 0) {
        clearTimeout(this.relayoutTimer);
      }
      this.relayoutTimer = setTimeout(this._links.update.bind(this._links), within + 400);
      return resolveIn(within);
    });
  }

  addDependentData(m: IDataType) {
    const base = manager.selectedObjects()[0];
    //nothing selected
    if (!base) {
      return false;
    }
    //check if idtypes match otherwise makes no sense
    if (base.data.idtypes[0] === m.idtypes[0]) {
      const mref = this.provGraph.findOrAddObject(m, m.desc.name, 'data');
      const r = rlist(base.range.dim(0));
      base.data.ids(r).then(m.fromIdRange.bind(m)).then((target) => {
        this.provGraph.push(createColumnCmd(this.ref, mref, target, toName(m.desc.name, base.range.dim(0).name)));
      });
      return true;
    }
    return false;
  }

  addData(rowStrat: IStratification, m: IDataType, colStrat?: IStratification) {
    const mref = this.provGraph.findOrAddObject(m, m.desc.name, 'data');
    if (rowStrat === m) {
      //both are stratifications
      rowStrat.range().then((range) => {
        this.provGraph.push(createColumnCmd(this.ref, mref, new Range([range]), toName(toMiddle(m.desc.fqname), rowStrat.desc.name)));
      });
    } else {
      Promise.all<Range1D>([rowStrat.idRange(), colStrat ? colStrat.idRange() : Range1D.all()]).then((rangesList: Range1D[]) => {
        const idRange = rlist(rangesList);
        return m.fromIdRange(idRange);
      }).then((range: Range) => {
        this.provGraph.push(createColumnCmd(this.ref, mref, range, toName(m.desc.name, rowStrat.desc.name)));
      });
    }
  }

  areNeighborColumns(ca, cb) {
    let loca = ca.location,
      locb = cb.location;
    if (loca.x > locb.x) { //swap order
      const t = locb;
      locb = loca;
      loca = t;
    }
    //none in between
    return !this._columns.some((c) => {
      if (c === ca || c === cb) {
        return false;
      }
      const l = c.location;
      return loca.x <= l.x && l.x <= locb.x;
    });
  }

  addColumn(column: Column, index: number = -1, within = -1) {
    if (index < 0) {
      this._columns.push(column);
    } else {
      this._columns.splice(index, 0, column);
    }
    //console.log('add '+column.id);
    column.on('changed', this.relayout.bind(this));
    column.setInteractive(this.interactive);
    this._links.push(false, column);
    return this.relayout();
  }

  removeColumn(column: Column, within = -1) {
    const i = this._columns.indexOf(column); //C.indexOf(this._columns, (elem) => elem === column);
    if (i >= 0) {
      //console.log('remove '+column.id);
      this._columns.splice(i, 1);
      this._links.remove(false, column);
      column.destroy(within);
      return this.relayout(within).then(() => i);
    } else {
      console.error('cant find column');
    }
    return Promise.resolve(-1);
  }

  swapColumn(columnA: Column, columnB: Column, within = -1) {
    const i = this.indexOf(columnA),
      j = this.indexOf(columnB);
    this._columns[i] = columnB;
    this._columns[j] = columnA;
    if (i < j) {
      this.parent.insertBefore(columnB.layoutNode, columnA.layoutNode);
    } else {
      this.parent.insertBefore(columnA.layoutNode, columnB.layoutNode);
    }
    return this.relayout(within);
  }

  indexOf(column: Column) {
    return this._columns.indexOf(column);
  }

  at(index: number) {
    return this._columns[index];
  }

  atRef(index: number) {
    const c = this.at(index);
    return this.provGraph.findObject(c);
  }

  canShift(column: Column) {
    const i = this._columns.indexOf(column);
    return {
      left: i,
      right: i - this._columns.length + 1
    };
  }
}

export function create(parent: Element, provGraph: ProvenanceGraph) {
  return new StratomeX(parent, provGraph);
}
