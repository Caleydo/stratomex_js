/**
 * Created by sam on 11.02.2015.
 */
define(function (require, exports) {
  var C = require('../caleydo/main');
  var prov = require('../caleydo-provenance/main');
  var session = require('../caleydo/session');
  var d3 = require('d3');

  function addNote(inputs, parameter) {
    var r = prov.ref(parameter.text, 'Note', prov.cat.annotation);
    return {
      created: [r],
      inverse: removeNoteCmd(r)
    };
  }
  function addNoteCmd(text) {
    return prov.action(prov.meta('Add Note', prov.cat.annotation, prov.op.create), 'addNote', addNote, [], {
      text : text
    });
  }

  function removeNote(inputs) {
    var note = inputs[0];
    var text = note.v;
    return {
      removed: [note],
      inverse: addNoteCmd(text)
    };
  }
  function removeNoteCmd(note) {
    return prov.action(prov.meta('Remove Note', prov.cat.annotation, prov.op.remove), 'removeNote', removeNote, [note]);
  }

  function changeNote(inputs, parameter) {
    var note = inputs[0];
    var text = parameter.text,
      old = note.v;
    note.v = text;
    return {
      inverse: changeNoteCmd(note, old)
    };
  }
  function changeNoteCmd(note, text) {
    return prov.action(prov.meta('Change Note', prov.cat.annotation, prov.op.update), 'changeNote', changeNote, [note], { text : text} );
  }

  exports.create = function (parent, graph) {
    var $r = d3.select(parent).append('div').attr('class','notes');
    var $text = $r.append('textarea').attr({
      rows: 5
    }).style({
      width: '100%'
    });

    graph.on('switch_state', function() {
      var l = graph.act.consistsOf.slice().reverse();
      var lastAnnot = C.search(l, function(elem) {
        return elem.category === prov.cat.annotation;
      });
      $text.property('value', lastAnnot ? lastAnnot.v : '');
      $text.datum(lastAnnot);
      //enable buttons
      $r.selectAll('button + button').attr('disabled',lastAnnot ? null : 'disabled');
    });
    $r.append('button').text('New Note').on('click', function() {
      graph.push(addNoteCmd($text.property('value')));
    });
    $r.append('button').text('Change').attr('disabled','disabled').on('click', function() {
      graph.push(changeNoteCmd($text.datum(), $text.property('value')));
    });
    $r.append('button').text('Remove').attr('disabled','disabled').on('click', function() {
      graph.push(removeNoteCmd($text.datum()));
    });
  }
});
