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

  var elems = template.create(document.body, {
    app: 'StratomeX.js'
  });
  elems.header.addMainMenu('New Workspace', elems.reset.bind(elems));
  var graph = elems.graph;
  elems.$main.append('div').attr('id', 'stratomex').attr('data-main',true);
  elems.$main.append('div').attr('id', 'databrowser');

  var datavalues;
  var stratomex = require('./StratomeX').create(document.getElementById('stratomex'), graph);

  var lineup =  require('./lineup').create(document.getElementById('databrowser'),function (rowStrat) {
    if (rowStrat.desc.type === 'stratification') {
      rowStrat.origin().then(function (d) {
        if (d.desc.type === 'matrix' && rowStrat.idtypes[0] !== d.idtypes[0]) {
          d = d.t; //transpose
        }
        if (d.desc.type === 'table') {
          stratomex.addData(rowStrat, rowStrat);
        } else {
          stratomex.addData(rowStrat, d);
        }
      });
    } else if (rowStrat.desc.type === 'vector') {
      //TODO
    }
  });

  var $left_data = $('#databrowser');
  if (cmode.getMode() > cmode.ECLUEMode.Exploration) {
    $left_data.hide();
  } else {
    $left_data.show();
  }
  function updateLineUp() {
    if (lineup.lineup) {
      lineup.lineup.update();
    }
  }
  function updateBounds() {
    var bounds = C.bounds(stratomex.parent);
    stratomex.setBounds(bounds.x, bounds.y, bounds.w, bounds.h);
    updateLineUp();
  }
  elems.on('modeChanged', function(event, new_) {
    if (new_ > cmode.ECLUEMode.Exploration) {
      $left_data.animate({height: 'hide'});
    } else {
      $left_data.animate({height: 'show'});
    }

    //for the animations to end
    setTimeout(updateBounds, 700);
  });
  $(window).on('resize', updateBounds);
  updateBounds();
  //var notes = require('./notes').create(document.getElementById('notes'), graph);

  function splitAndConvert(arr) {
    var strat = arr.filter(function(d) { return d.desc.type === 'stratification'});

    strat = strat.concat(arr.filter(function(d) { return d.desc.type === 'vector'}));

    //convert all matrixes to slicees with their corresponding name
    return Promise.all(arr.filter(function(d) { return d.desc.type === 'matrix'}).map(function(d) {
      return d.cols().then(function(colNames) {
        var cols = d.ncol, r = [];
        for(var i = 0; i < cols; ++i) {
          var v = d.slice(i);
          v.desc.name = d.desc.name+'/'+colNames[i];
          v.desc.fqname = d.desc.fqname+'/'+colNames[i];
          r.push(v);
        }
        return r;
      });
    })).then(function(colsarray) {
      return strat.concat.apply(strat, colsarray);
    });
  }

  function createLineUp(r) {
    lineup.setData(r);
  }

  function filterTypes(arr) {
    return arr.filter(function(d) {
      var desc = d.desc;
      if (desc.type === 'matrix' || desc.type === 'vector') {
        return desc.value.type === 'categorical';
      }
      return desc.type === 'stratification' && desc.origin != null;
    });
  }
  data.list().then(data.convertTableToVectors).then(filterTypes).then(splitAndConvert).then(createLineUp);

  elems.jumpToStored();
});
