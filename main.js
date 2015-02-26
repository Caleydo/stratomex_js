/**
 * Created by Samuel Gratzl on 15.12.2014.
 */
define(function (require) {
  'use strict';
  var $ = require('jquery');
  var data = require('../caleydo/data');
  var vis = require('../caleydo/vis');
  var prov = require('../caleydo-provenance/main');
  var session = require('../caleydo/session');


  var graph = prov.create({
    type: 'provenance_graph',
    name: 'StratomeX',
    id: 'stratomex'
  });
  //set shared variable
  session.store('provenancegraph', graph);

  var info = require('../caleydo-selectioninfo/main').create(document.getElementById('selectioninfo'));
  var stratomex = require('./stratomex').create(document.getElementById('stratomex'), graph);
  var lineup =  require('./lineup').create(document.getElementById('lineup'),function (rowStrat, data, colStrat) {
    stratomex.addData(rowStrat, data, colStrat);
  });
  require('../caleydo-provenance/selection').create(graph, 'selected');
  var notes = require('./notes').create(document.getElementById('notes'), graph);

  var graphvis;
  vis.list(graph)[0].load().then(function (plugin) {
    graphvis = plugin.factory(graph, document.getElementById('provenancegraph'));
  });

  function splitAndConvert(arr) {
    var strat = arr.filter(function(d) { return d.desc.type === 'stratification'});
    var rest = arr.filter(function(d) { return d.desc.type !== 'stratification'});

    return {
      stratifications: data.convertToTable(strat),
      data : data.convertToTable(rest)
    };
  }

  function createLineUp(r) {
    lineup.setData(r.stratifications, r.data);
  }

  function filterTypes(arr) {
    return arr.filter(function(d) {
      var desc = d.desc;
      if (desc.type === 'matrix' || desc.type === 'vector') {
        return desc.value.type.match('(int|real|categorical)');
      }
      return desc.type === 'stratification';
    });
  }
  data.list().then(data.convertTableToVectors).then(filterTypes).then(splitAndConvert).then(createLineUp);


  //layout things using a border layout
  function relayout() {
    var $stratomex = $('#stratomex');
    stratomex.setBounds(0, 0, $stratomex.width(), $stratomex.height());

    var $lineup = $('#lineup');
    lineup.setBounds(0, 0, $lineup.width(), $lineup.height());
  }
  $(function() {
    relayout();
    $(window).on('resize', function() {
      relayout();
    })
  });
});
