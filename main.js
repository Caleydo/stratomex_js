/**
 * Created by Samuel Gratzl on 15.12.2014.
 */
define(function (require) {
  'use strict';
  var $ = require('jquery');
  var data = require('../caleydo_core/data');
  var vis = require('../caleydo_core/vis');
  var C = require('../caleydo_core/main');
  var template = require('../clue_demo/template');
  var cmode = require('../caleydo_provenance/mode');


  var helper = document.querySelector('#mainhelper');
  var elems = template.create(document.body, {
    app: 'StratomeX.js',
    application: '/stratomex.js',
    id: 'clue_stratomex'
  });
  {
    while(helper.firstChild) {
      elems.$main.node().appendChild(helper.firstChild);
    }
    helper.remove();
  }

  elems.graph.then(function(graph) {
    var datavalues;
    var stratomex = require('./StratomeX').create(document.getElementById('stratomex'), graph);

    var lineup = require('./lineup').create(document.getElementById('tab_stratifications'), function (rowStrat) {
      if (rowStrat.desc.type === 'stratification') {
        rowStrat.origin().then(function (d) {
          if (d.desc.type === 'matrix') {
            if (rowStrat.idtypes[0] !== d.idtypes[0]) {
              d = d.t; //transpose
            }
          }
          if (d.desc.type === 'table') {
            stratomex.addData(rowStrat, rowStrat);
          } else {
            stratomex.addData(rowStrat, d, null);
          }
        });
      } else if (rowStrat.desc.type === 'vector') {
        rowStrat.stratification().then(function (d) {
          stratomex.addData(d, d);
        });
      }
    });

    var lineupData = require('./lineup').createData(document.getElementById('tab_data'), function (vector) {
      stratomex.addDependentData(vector);
    });

    var $left_data = $('#databrowser');
    if (cmode.getMode().exploration < 0.8) {
      $left_data.hide();
    } else {
      $left_data.show();
    }
    stratomex.setInteractive(cmode.getMode().exploration >= 0.8);
    function updateLineUp() {
      if (lineup.lineup) {
        lineup.lineup.update();
      }
      if (lineupData.lineup) {
        lineupData.lineup.update();
      }
    }

    $('a[data-toggle="tab"]').on('shown.bs.tab', function () {
      updateLineUp();
    });

    function updateBounds() {
      var bounds = C.bounds(stratomex.parent);
      stratomex.setBounds(bounds.x, bounds.y, bounds.w, bounds.h);
      updateLineUp();
    }

    elems.on('modeChanged', function (event, new_) {
      if (new_.exploration < 0.8) {
        $left_data.animate({height: 'hide'}, 'fast');
      } else {
        $left_data.animate({height: 'show'}, 'fast');
      }
      stratomex.setInteractive(new_.exploration >= 0.8);

      //for the animations to end
      updateBounds();
      setTimeout(updateBounds, 300);
    });
    $(window).on('resize', updateBounds);
    updateBounds();
    //var notes = require('./notes').create(document.getElementById('notes'), graph);

    function splitAndConvert(arr) {
      var strat = arr.filter(function (d) {
        return d.desc.type === 'stratification'
      });

      strat = strat.concat(arr.filter(function (d) {
        return d.desc.type === 'vector'
      }));

      //convert all matrices to slices with their corresponding name
      return Promise.all(arr.filter(function (d) {
        return d.desc.type === 'matrix'
      }).map(function (d) {
        return d.cols().then(function (colNames) {
          var cols = d.ncol, r = [];
          for (var i = 0; i < cols; ++i) {
            var v = d.slice(i);
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

    function filterTypes(arr) {
      return arr.filter(function (d) {
        var desc = d.desc;
        if (desc.type === 'matrix' || desc.type === 'vector') {
          return desc.value.type === 'categorical';
        }
        return desc.type === 'stratification' && desc.origin != null;
      });
    }

    function createDataLineUp(r) {
      lineupData.setData(r);
    }

    function filterDataTypes(arr) {
      return arr.filter(function (d) {
        var desc = d.desc;
        if (desc.type === 'matrix' || desc.type == 'vector') {
          return desc.value.type === 'real' || desc.value.type === 'int';
        }
        return false;
      });
    }

    var vectors = data.list().then(data.convertTableToVectors);
    vectors.then(filterTypes).then(splitAndConvert).then(createLineUp);
    vectors.then(filterDataTypes).then(createDataLineUp);

    elems.jumpToStored();
  });
});
