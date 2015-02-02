/**
 * Created by sam on 30.01.2015.
 */
define(function () {
  var d3 = require('d3');
  var vis = require('../caleydo/vis');
  var multiform = require('../caleydo/multiform');
  function Cluster(group, data) {
    this.group = group;
    this.data = data;
  }
  Cluster.prototype.build = function (parent) {
    this.multiform = multiform.create(parent, data);
  };
  function Column(parent, data, partitioning) {
    this.data = data;
    this.$parent = d3.select(parent).append('div').attr('class','column');
    this.partitioning = partitioning;
    this.$clusters = this.$parent.append('div').classed('clusters',true).selectAll('div.cluster').data(partitioning.groups.map(function (group) {
      return new Cluster(group, data.view(group));
    }));
    this.$clusters.enter().append('div')
      .attr('class', 'cluster')
      .each(function(cluster) {
        cluster.build(this);
      });
  }
  return Column;
});
