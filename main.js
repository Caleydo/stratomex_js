/**
 * Created by Samuel Gratzl on 15.12.2014.
 */
define(function (require) {
  'use strict';
  var d3 = require('d3');
  var data = require('../caleydo/data');
  var vis = require('../caleydo/vis');
  var selectionInfo = require('../caleydo-selectioninfo/main');
  var info = selectionInfo.create(document.getElementById('selectioninfo'));
  var lineup;

  data.listAsTable(true).then(function (datalist) {
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
  });
});
