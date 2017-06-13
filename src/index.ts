/**
 * Created by Samuel Gratzl on 15.12.2014.
 */

import 'file-loader?name=index.html!extract-loader!html-loader!./index.html';
import 'file-loader?name=404.html!./404.html';
import 'file-loader?name=robots.txt!./robots.txt';

import 'phovea_ui/src/_bootstrap';
import 'phovea_ui/src/_font-awesome';
import './style.scss';

import * as $ from 'jquery';
import {convertTableToVectors, list as listData} from 'phovea_core/src/data';
import {IAnyMatrix, IMatrixDataDescription, INumericalMatrix} from 'phovea_core/src/matrix';
import {bounds} from 'phovea_core/src/index';
import {create as createCLUE} from 'phovea_clue/src/template';
import * as cmode from 'phovea_clue/src/mode';

import {create as createStratomeX} from './StratomeX';
import {create as createStratomeXLineUp, createData} from './LineUp';
import {
  VALUE_TYPE_REAL, VALUE_TYPE_INT, IDataType, VALUE_TYPE_CATEGORICAL
} from 'phovea_core/src/datatype';
import {INumericalVector, ICategoricalVector, IVectorDataDescription} from 'phovea_core/src/vector';
import {IStratification, IStratificationDataDescription} from 'phovea_core/src/stratification';

import {manager, Column} from './Column';
import {getAPIJSON} from 'phovea_processing_queue/src';

const helper = document.querySelector('#mainhelper');
const elems = createCLUE(document.body, {
  app: 'StratomeX.js',
  application: '/stratomex_js',
  id: 'clue_stratomex'
});
{
  while (helper.firstChild) {
    elems.$main.node().appendChild(helper.firstChild);
  }
  helper.remove();
}

elems.graph.then((graph) => {
  const stratomex = createStratomeX(document.getElementById('stratomex'), graph);

  const lineup = createStratomeXLineUp(document.getElementById('tab_stratifications'), (rowStrat) => {
    if (rowStrat.desc.type === 'stratification') {
      const s = <IStratification>rowStrat;
      s.origin().then((d) => {
        if (d.desc.type === 'matrix') {
          if (rowStrat.idtypes[0] !== d.idtypes[0]) {
            d = (<IAnyMatrix>d).t; //transpose
          }
        }
        if (d.desc.type === 'table') {
          stratomex.addData(s, rowStrat);
        } else {
          stratomex.addData(s, d, null);
        }
      });
    } else if (rowStrat.desc.type === 'vector') {
      const v = <ICategoricalVector>rowStrat;
      v.stratification().then((d) => {
        stratomex.addData(d, d);
      });
    }
  });

  const lineupData = createData(document.getElementById('tab_data'), function (vector) {
    stratomex.addDependentData(vector);
  });


  // MY AWESOME STUFF -----------------------------------------------------
  const stratoHeaders = document.getElementsByTagName('header');
  if (stratoHeaders.length > 0) {
    const jaccardButton = document.createElement('button');
    jaccardButton.innerText = 'Calc Jaccard';
    jaccardButton.id = 'jaccardButton';
    jaccardButton.onclick = (ev) => {
      console.log('Jaccard Buton onclick');

      const selected = manager.selectedObjects();

      for (const selectedObj of selected) {
        if (selectedObj instanceof Column) {
          const selGroup = selectedObj.selectedGroup;
          if (selGroup !== null) {
            console.log('Send group '+selGroup.name+' of column '+selectedObj.name+' to processing queue', selGroup, selectedObj);
            console.log('call http://localhost:9000/api/stratomex_js/similarity/'+selectedObj.data.desc.id+'/'+encodeURIComponent(selGroup.name));

            getAPIJSON('/stratomex_js/similarity/'+selectedObj.data.desc.id+'/'+selGroup.name)
              .then((res) => {
                console.log('success for '+selectedObj.data.desc.id+'/'+selGroup.name+':', res);
              })
              .catch((err) => {
                console.log('error', err);
              });
          }
        }
      }
    };
    stratoHeaders[0].appendChild(jaccardButton);
  } else {
    console.log('no header for addin');
  }

  // -----------------------------------------------------------------------------
  const $leftData = $('#databrowser');
  if (cmode.getMode().exploration < 0.8) {
    $leftData.hide();
  } else {
    $leftData.show();
  }
  stratomex.setInteractive(cmode.getMode().exploration >= 0.8);
  function updateLineUp() {
    lineup.update();
    lineupData.update();
  }

  $('a[data-toggle="tab"]').on('shown.bs.tab', function () {
    updateLineUp();
  });

  function updateBounds() {
    const b = bounds(stratomex.parent);
    stratomex.setBounds(b.x, b.y, b.w, b.h);
    updateLineUp();
  }

  elems.on('modeChanged', function (event, newMode) {
    if (newMode.exploration < 0.8) {
      $leftData.animate({height: 'hide'}, 'fast');
    } else {
      $leftData.animate({height: 'show'}, 'fast');
    }
    stratomex.setInteractive(newMode.exploration >= 0.8);

    //for the animations to end
    updateBounds();
    setTimeout(updateBounds, 300);
  });
  $(window).on('resize', updateBounds);
  updateBounds();
  //var notes = require('./notes').create(document.getElementById('notes'), graph);

  function splitAndConvert(arr) {
    let strat = arr.filter((d) => d.desc.type === 'stratification');

    strat = strat.concat(arr.filter((d) => d.desc.type === 'vector'));

    //convert all matrices to slices with their corresponding name
    return Promise.all(arr.filter((d) => d.desc.type === 'matrix').map(function (d) {
      return d.cols().then(function (colNames) {
        const cols = d.ncol, r = [];
        for (let i = 0; i < cols; ++i) {
          const v = d.slice(i);
          v.desc.name = colNames[i];
          v.desc.fqname = d.desc.fqname + '/' + colNames[i];
          r.push(v);
        }
        return r;
      });
    })).then(function (colsarray) {
      return strat.concat.apply(strat, colsarray);
    });
  }

  function createLineUp(r) {
    lineup.setData(r);
  }

  function filterTypes(arr: IDataType[]) {
    return arr.filter(function (d) {
      const desc = d.desc;
      if (desc.type === 'matrix' || desc.type === 'vector') {
        return (<IVectorDataDescription<any>|IMatrixDataDescription<any>>desc).value.type === VALUE_TYPE_CATEGORICAL;
      }
      return desc.type === 'stratification' && (<IStratificationDataDescription>desc).origin != null;
    });
  }

  function createDataLineUp(r: (INumericalMatrix|INumericalVector)[]) {
    lineupData.setData(r);
  }

  function filterDataTypes(arr) {
    return arr.filter((d) => {
      const desc = d.desc;
      if (desc.type === 'matrix' || desc.type === 'vector') {
        return desc.value.type === VALUE_TYPE_REAL || desc.value.type === VALUE_TYPE_INT;
      }
      return false;
    });
  }

  const vectors = listData().then(convertTableToVectors);
  vectors.then(filterTypes).then(splitAndConvert).then(createLineUp);
  vectors.then(filterDataTypes).then(createDataLineUp);

  elems.jumpToStored();
});

