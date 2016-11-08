/* *****************************************************************************
 * Caleydo - Visualization for Molecular Biology - http://caleydo.org
 * Copyright (c) The Caleydo Team. All rights reserved.
 * Licensed under the new BSD license, available at http://caleydo.org/license
 **************************************************************************** */

//register all extensions in the registry following the given pattern
module.exports = function (registry) {
  //registry.push('extension-type', 'extension-id', function() { return System.import('./src/extension_impl'); }, {});
  // generator-phovea:begin
  registry.push('view', 'stratomex', function () {
    return System.import('./src/StratomeX');
  }, {
    'location': 'center'
  });

  registry.push('view', 'stratomex-lineup', function () {
    return System.import('./src/LineUp');
  }, {
    'location': 'bottom'
  });

  registry.push('actionFactory', 'stratomex-note', function () {
    return System.import('./src/notes');
  }, {
    'factory': 'createCmd',
    'creates': '(addStratomeXNote|changeStratomeXNote|removeStratomeXNote)'
  });

  registry.push('actionFactory', 'stratomex-column', function () {
    return System.import('./src/Column');
  }, {
    'factory': 'createCmd',
    'creates': '(createStratomeXColumn|removeStratomeXColumn|swapStratomeXColumns|setStratomeXColumnOption|changeStratomeXColumnVis|showStratomeXInDetail)'
  });

  registry.push('actionCompressor', 'stratomex-compressSwap', function () {
    return System.import('./src/Column');
  }, {
    'factory': 'compressSwap',
    'matches': 'swapStratomeXColumns'
  });

  registry.push('actionCompressor', 'stratomex-compressCreateRemove', function () {
    return System.import('./src/Column');
  }, {
    'factory': 'compressCreateRemove',
    'matches': '(createStratomeXColumn|removeStratomeXColumn)'
  });

  registry.push('actionCompressor', 'stratomex-compressHideShowDetail', function () {
    return System.import('./src/Column');
  }, {
    'factory': 'compressHideShowDetail',
    'matches': 'showStratomeXInDetail'
  });

  registry.push('app', 'stratomex_js', null, {
    'name': 'Stratomex.js'
  });
  // generator-phovea:end
};

