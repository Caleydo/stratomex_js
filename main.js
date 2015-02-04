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

  var layout = require('../caleydo-layout/main').distributeLayout(true, 100, { top : 30, left: 30, right: 30, bottom: 10});
  var info = require('../caleydo-selectioninfo/main').create(document.getElementById('selectioninfo'));

  var columns = require('./column.js');

  var stratomex = document.getElementById('stratomex');
  var lineup;

  function createLineUp(datalist) {
    var v = vis.list(datalist);
    v = v.filter(function (v) { return v.id === 'caleydo-vis-lineup';})[0];
    return v.load().then(function (plugin) {
      lineup = plugin.factory(datalist, document.getElementById('lineup'), {
        lineup: {
          svgLayout: {
            rowActions: [

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

  function listenToData(datalist) {
    datalist.on('select-selected', function(event, range) {
      if (range.isNone) {
        return;
      }
      datalist.objects(range).then(function(toAdd) {
        var m = toAdd[0]._;
        columns.create(stratomex, m, ranges.range(0));
      });
    });
    return datalist;
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
  data.list().then(data.convertTableToVectors).then(filterTypes).then(data.convertToTable).then(listenToData).then(createLineUp);

  columns.manager.on('dirty', function() {
    //update the layout
    var w = $(stratomex).width();
    var h = $(stratomex).height();
    layout(columns.manager.entries.map(function(c) { return c.layout; }), w, h);
    columns.manager.forEach(function(c) {c.layouted();});
  });
});
