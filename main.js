/**
 * Created by Samuel Gratzl on 15.12.2014.
 */
define(function (require) {
  'use strict';
  var d3 = require('d3');
  var $ = require('jquery');
  var data = require('../caleydo/data');
  var vis = require('../caleydo/vis');
  var ranges = require('../caleydo/range');
  var datatypes = require('../caleydo/datatype');
  var idtypes = require('../caleydo/idtype');
  var link_m = require('../caleydo-links/link');
  var prov = require('../caleydo-provenance/main');
  var session = require('../caleydo/session');

  var layout = require('../caleydo-layout/main').distributeLayout(true, 100, { top : 30, left: 30, right: 30, bottom: 10});
  var info = require('../caleydo-selectioninfo/main').create(document.getElementById('selectioninfo'));

  var columns = require('./column.js');

  var graph = prov.create({
    type: 'provenance_graph',
    name: 'StratomeX',
    id: 'stratomex'
  });
  //set shared variable
  session.store('provenancegraph', graph);

  var stratomex = graph.addObject(document.getElementById('stratomex'), 'StratomeX DOM', prov.cat.visual);
  var manager = graph.addObject(columns.manager, 'Column Manager', prov.cat.logic);
  require('../caleydo-provenance/selection').create(graph, 'selected');
  require('./notes').create(document.getElementById('notes'), graph);

  var graphvis;
  vis.list(graph)[0].load().then(function (plugin) {
    graphvis = plugin.factory(graph, document.getElementById('provenancegraph'));
  });

  var lineup;

  var links = new link_m.LinkContainer(stratomex.v, ['dirty'], {
    interactive: false,
    filter: columns.areNeighborColumns,
    mode: 'link-group'
  });

  manager.v.on('add', function (event, id, column) {
    links.push(column);
  });
  manager.v.on('remove', function (event, id, column) {
    links.remove(column);
  });

  //clear on click on background
  /*d3.select(links.node).classed('selection-clearer', true).on('click', function () {
    columns.manager.clear();
    idtypes.clearSelection();
  });*/

  function addData(lineup_row) {
    var m = lineup_row._;
    var mref = graph.addObject(m, m.desc.name, prov.cat.data);

    if (m.desc.type === 'vector' && m.desc.value.type === 'categorical') {
      m.groups().then(function(parition) {
        columns.create(stratomex, mref, ranges.list(parition));
      });
    } else {
      columns.create(stratomex, mref, ranges.range(0));
    }
  }

  function createLineUp(datalist) {
    var v = vis.list(datalist);
    v = v.filter(function (v) { return v.id === 'caleydo-vis-lineup';})[0];
    return v.load().then(function (plugin) {
      lineup = plugin.factory(datalist, document.getElementById('lineup'), {
        lineup: {
          svgLayout: {
            rowActions: [
              {
                name: 'add',
                icon: '\uf067',
                action: addData
              }
            ]
          },
          manipulative: true,
          interaction: {
            tooltips: false
          }
        }
      });
      return lineup;
    });
  }

  function filterTypes(arr) {
    return arr.filter(function(d) {
      var desc = d.desc;
      if (desc.type === 'matrix' || desc.type === 'vector') {
        return desc.value.type.match('(int|real|categorical)');
      }
      return false;
    });
  }
  data.list().then(data.convertTableToVectors).then(filterTypes).then(data.convertToTable).then(createLineUp);

  columns.manager.on('dirty', function() {
    //update the layout
    var w = $(stratomex.v).width();
    var h = $(stratomex.v).height();
    layout(columns.manager.entries.map(function(c) { return c.layout; }), w, h);
    columns.manager.forEach(function(c) {c.layouted();});
  });
  $(window).on('resize', function() {
    columns.manager.fire('dirty');
  });
});
