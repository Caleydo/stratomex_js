/**
 * Created by Samuel Gratzl on 15.12.2014.
 */
define(function (require) {
  'use strict';
  var $ = require('jquery');
  var data = require('../caleydo_web/data');
  var vis = require('../caleydo_web/vis');
  var prov = require('../caleydo_provenance/main');

  var graph = prov.create({
    type: 'provenance_graph',
    name: 'StratomeX',
    id: 'stratomex'
  });

  var datavalues;
  var info = require('../caleydo_selectioninfo/main').create(document.getElementById('selectioninfo'));
  var stratomex = require('./stratomex').create(document.getElementById('stratomex'), graph);

  var lineup =  require('./lineup').create(document.getElementById('lineup'),function (rowStrat) {
    var d = datavalues.filter(function(di) { return di.desc.name === rowStrat.desc.origin;})[0];
    if (d.desc.type === 'matrix' && rowStrat.idtypes[0] !== d.idtypes[0]) {
      d = d.t; //transpose
    }
    stratomex.addData(rowStrat, d);
  });

  require('../caleydo_provenance/selection').create(graph, 'selected', {
    filter: function(idtype) { return idtype.name[0] !== '_' }
  });
  var notes = require('./notes').create(document.getElementById('notes'), graph);
  var graphvis;
  vis.list(graph)[1].load().then(function (plugin) {
    graphvis = plugin.factory(graph, document.getElementById('provenancegraph'));
  });

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
