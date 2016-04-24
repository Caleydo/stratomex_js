/**
 * Created by sam on 24.02.2015.
 */

import views = require('../caleydo_core/layout_view');
import datatypes = require('../caleydo_core/datatype');
import stratification = require('../caleydo_core/stratification');
import C = require('../caleydo_core/main');
import link_m = require('../caleydo_d3/link');
import ranges = require('../caleydo_core/range');
import prov = require('../caleydo_clue/prov');
import statetoken = require('../caleydo_core/statetoken')

import columns = require('./Column');
import {Column} from "./Column";
import {IDType} from "../caleydo_core/idtype";

//type ColumnRef = prov.IObjectRef<columns.Column>;

function toName(data: string, par: string) {
  const n : string= data;
  const i = n.lastIndexOf('/');
  var base =  i >= 0 ? n.slice(i+1) : n;

  var c = par.replace(' Clustering','');
  const j = c.lastIndexOf('/');
  c = j >= 0 ? c.slice(j+1) : c;
  if (base === c) {
    return base;
  }
  return base + ' ('+c+')';
}

function toMiddle(n: string) {
  const l = n.split('/');
  return l.length > 1 ? l[l.length-2] : n;
}

class StratomeX extends views.AView {
  private _columns:columns.Column[] = [];

  private dim:[number, number];
  private _links:link_m.LinkContainer;
  ref:prov.IObjectRef<StratomeX>;

  private interactive = true;

  constructor(private parent:Element, private provGraph:prov.ProvenanceGraph) {
    super();
    this.ref = provGraph.findOrAddObject(this, 'StratomeX', 'visual');
    this._links = new link_m.LinkContainer(parent, ['changed'], {
      interactive: false,
      filter: this.areNeighborColumns.bind(this),
      mode: 'link-group',
      idTypeFilter: function (idtype, i) {
        return i === 0; //just the row i.e. first one
      },
      hover: false,
      canSelect: () => this.interactive
    });
  }

  get stateTokens(): statetoken.IStateToken[] {
    let tokens: statetoken.IStateToken[]  = []
    let sortedColumns = this._columns.slice(0);
    sortedColumns.sort(function(a:Column, b:Column) {
      return a.id - b.id;
    });

    let selIDtypes:IDType[] = []
    for (let i = 0; i < sortedColumns.length; i++) {
      let t:number = this.indexOf(sortedColumns[i])/(sortedColumns.length-1);
      if (isNaN(t)) t= 0
      tokens = tokens.concat({
        name: "Column " + sortedColumns[i].id,
        value: [],
        type: statetoken.TokenType.ordinal,
        importance: 1,
        childs : sortedColumns[i].stateTokensRekursive.concat({
          name: "Column " + sortedColumns[i].id + "_order",
          value: [0,1,t],
          type: statetoken.TokenType.ordinal,
          importance: 1,
          childs: [],
          category: "layout"}),
        category: "data"
      })
      selIDtypes = selIDtypes.concat(sortedColumns[i].idtypes)
    }
    //remove duplicate idtypes
    selIDtypes = selIDtypes.filter(function(item, pos) {
      return selIDtypes.indexOf(item) == pos;
    })

    for (let i =0; i < selIDtypes.length; i++){
      tokens = tokens.concat({
        name: selIDtypes[i].name,
        value: selIDtypes[i],
        type: statetoken.TokenType.idtype,
        importance: 1,
        childs: [],
        category: "selection"
      })
    }
    return tokens;
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

  setBounds(x, y, w, h) {
    super.setBounds(x, y, w, h);
    this.dim = [w, h];
    return this.relayout();
  }

  private relayoutTimer = -1;

  relayout(within = -1) {
    var that = this;
    that._links.hide();
    return C.resolveIn(5).then(() => {
        that._columns.forEach((d) => d.layouted(within));
        if (that.relayoutTimer >= 0) {
          clearTimeout(that.relayoutTimer);
        }
        that.relayoutTimer = setTimeout(that._links.update.bind(that._links), within + 400);
        return C.resolveIn(within);
      });
  }

  addDependentData(m: datatypes.IDataType) {
    const base = columns.manager.selectedObjects()[0];
    //nothing selected
    if (!base) {
      return false;
    }
    //check if idtypes match otherwise makes no sense
    if (base.data.idtypes[0] === m.idtypes[0]) {
      let mref = this.provGraph.findOrAddObject(m, m.desc.name, 'data');
      var r = ranges.list(base.range.dim(0));
      base.data.ids(r).then(m.fromIdRange.bind(m)).then((target) => {
        this.provGraph.push(columns.createColumnCmd(this.ref, mref, target, toName(m.desc.name, base.range.dim(0).name)));
      });
      return true;
    }
    return false;
  }

  addData(rowStrat: stratification.IStratification, m: datatypes.IDataType, colStrat?: stratification.IStratification) {
    var that = this;
    var mref = this.provGraph.findOrAddObject(m, m.desc.name, 'data');
    if (rowStrat === m) {
      //both are stratifications
      rowStrat.range().then((range) => {
        that.provGraph.push(columns.createColumnCmd(that.ref, mref, range, toName(toMiddle(m.desc.fqname), rowStrat.desc.name)));
      });
    } else {
      Promise.all<ranges.Range1D>([rowStrat.idRange(), colStrat ? colStrat.idRange() : ranges.Range1D.all()]).then((range_list:ranges.Range1D[]) => {
        const idRange = ranges.list(range_list);
        return m.fromIdRange(idRange);
      }).then((range) => {
        that.provGraph.push(columns.createColumnCmd(that.ref, mref, range, toName(m.desc.name, rowStrat.desc.name)));
      });
    }
  }

  areNeighborColumns(ca, cb) {
    var loca = ca.location,
      locb = cb.location,
      t = null;
    if (loca.x > locb.x) { //swap order
      t = locb;
      locb = loca;
      loca = t;
    }
    //none in between
    return !this._columns.some(function (c) {
      if (c === ca || c === cb) {
        return false;
      }
      var l = c.location;
      return loca.x <= l.x && l.x <= locb.x;
    });
  }

  addColumn(column:columns.Column, index: number = -1, within = -1) {
    if (index < 0) {
      this._columns.push(column);
    } else {
      this._columns.splice(index, 0, column);
    }
    //console.log('add '+column.id);
    column.on('changed', C.bind(this.relayout, this));
    column.setInteractive(this.interactive);
    this._links.push(false, column);
    return this.relayout();
  }

  removeColumn(column:columns.Column, within = -1) {
    var i = this._columns.indexOf(column); //C.indexOf(this._columns, (elem) => elem === column);
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

  swapColumn(columnA: columns.Column, columnB: columns.Column, within = -1) {
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

  indexOf(column:columns.Column) {
    return C.indexOf(this._columns, function (elem) {
      return elem === column;
    });
  }

  at(index) {
    return this._columns[index];
  }

  atRef(index: number) {
    const c = this.at(index);
    return this.provGraph.findObject(c);
  }

  canShift(column:columns.Column) {
    var i = C.indexOf(this._columns, function (elem) {
      return elem === column;
    });
    return {
      left: i,
      right: i - this._columns.length + 1
    };
  }
}
export function create(parent:Element, provGraph:prov.ProvenanceGraph) {
  return new StratomeX(parent, provGraph);
}
