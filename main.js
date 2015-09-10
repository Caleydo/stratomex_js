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
  var graph = elems.graph;
  elems.$main.append('div').attr('id', 'stratomex');
  elems.$main.append('div').attr('id', 'databrowser');

  var datavalues;
  var stratomex = require('./stratomex').create(document.getElementById('stratomex'), graph);

  var lineup =  require('./lineup').create(document.getElementById('databrowser'),function (rowStrat) {
    var d = datavalues.filter(function(di) { return di.desc.name === rowStrat.desc.origin;})[0];
    if (d.desc.type === 'matrix' && rowStrat.idtypes[0] !== d.idtypes[0]) {
      d = d.t; //transpose
    }
    stratomex.addData(rowStrat, d);
  });

  var $left_data = $('#databrowser');
  if (cmode.getMode() > cmode.ECLUEMode.Exploration) {
    $left_data.hide();
  } else {
    $left_data.show();
  }
  function updateBounds() {
    var bounds = C.bounds(stratomex.parent);
    stratomex.setBounds(bounds.x, bounds.y, bounds.w, bounds.h);
  }
  elems.on('modeChanged', function(event, new_) {
    if (new_ > cmode.ECLUEMode.Exploration) {
      $left_data.animate({height: 'hide'});
    } else {
      $left_data.animate({height: 'show'});
    }

    updateBounds();
  });
  $(window).on('resize', updateBounds);
  updateBounds();
  //var notes = require('./notes').create(document.getElementById('notes'), graph);

  function splitAndConvert(arr) {
    var strat = arr.filter(function(d) { return d.desc.type === 'stratification'});
    datavalues = arr.filter(function(d) { return d.desc.type !== 'stratification'});

    return strat;
  }

  function createLineUp(r) {
    lineup.setData(r);
  }

  function filterTypes(arr) {
    return arr.filter(function(d) {
      var desc = d.desc;
      if (desc.type === 'matrix' || desc.type === 'vector') {
        return desc.value.type.match('(int|real|categorical)');
      }
      return desc.type === 'stratification' && desc.origin != null;
    });
  }
  data.list().then(data.convertTableToVectors).then(filterTypes).then(splitAndConvert).then(createLineUp);

  elems.jumpToStored();
});
