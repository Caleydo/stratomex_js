from __future__ import absolute_import, division

from phovea_processing_queue.task_definition import task, getLogger

from phovea_server.dataset import get as get_dataset
from phovea_server.dataset import list_datasets
import numpy as np

_log = getLogger(__name__)


@task
def add(x, y):
  return x + y


@task
def similarity(datasetId, groupName):
  _log.debug('Start to calculate Jaccard similarity between group %s of dataset %s and all others.', groupName, datasetId)

  result = {}

  try:
    # get data of group to be compared
    cmpDataSet = get_dataset(datasetId)

    if not cmpDataSet:
      _log.error('Dataset %s cannot be found.', datasetId)
      raise Exception('Dataset '+datasetId+' cannot be found.')

    cmpPatients = np.array([])

    # find group
    for group in cmpDataSet.groups():
      if group.name == groupName:
        #get the patients of that group
        cmpPatients = cmpDataSet.rowids(group.range)
        break


    #compare that group's list of patients to all others
    if cmpPatients.size > 0: # found it?
      datasets = list_datasets()
      for dataset in datasets:
        # check data type, e.g. HDFTable, HDFStratification, HDFMatrix
        if dataset.type == 'stratification':
          for group in dataset.groups():
            #now we have got two list that should get compared
            patSet2 = dataset.rowids(group.range)

            #jaccard = intersection / union
            jaccard = np.intersect1d(cmpPatients, patSet2).size / np.union1d(cmpPatients, patSet2).size
            #_log.debug('jaccard for {} index is {}'.format(dataset.id+'/'+group.name, str(jaccard)))

            if dataset.id not in result or result[dataset.id] < jaccard:
              result[dataset.id] = jaccard


        elif dataset.type == 'matrix' and dataset.value == 'categorical': #some matrix data has no categories (e.g. mRNA, RPPA)
          _log.info('Start processing matrix '+dataset.id)
          matData = dataset.asnumpy()

          # for each column (e.g. gene (e.g. A1CF))
          # datatset.cols() are the stuff that can be in added to stratomex
          for col in range(matData.shape[1]):
            if col % 500 == 0:
              _log.info('Processing col ' + str(col) + "/" + str(matData.shape[1]))

            matColumn = matData[:, col]
            # check in which categories the patients are
            for cat in dataset.categories:
              catRowIndicies = np.argwhere(matColumn == cat['name'])[:,0] #get indicies as 1column matrix and convert to 1d array
              patientsInCat = dataset.rowids()[catRowIndicies] #indicies to patient ids
              jaccard = np.intersect1d(cmpPatients, patientsInCat).size / np.union1d(cmpPatients, patientsInCat).size
              # _log.debug('jaccard index for {} is {}'.format(dataset.id + '/' + dataset.cols()[col], str(jaccard)))

              columnId = dataset.id + '-c' + str(col)
              if columnId not in result or result[columnId] < jaccard:
                result[columnId] = jaccard
                # e.g. result['tcgaGbmSampledMutations-c9408'] = 1
    else:
      _log.error('Group %s not part of column %s.', groupName, datasetId)
      raise Exception('Group '+groupName+' not part of column '+  datasetId+'.')

    _log.debug('Done with Jaccard calculation.')
  except Exception as e:
    _log.exception('Can not fulfill task. Error: %s.', e)
    raise #rejects promise

  return result #to JSON automatically

