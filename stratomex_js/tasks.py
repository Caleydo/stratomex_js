from __future__ import absolute_import
from phovea_processing_queue.task_definition import task, getLogger

from phovea_server.dataset import get as get_dataset
from phovea_server.dataset import list_datasets

from phovea_server.dataset_def import AStratification

_log = getLogger(__name__)


@task
def add(x, y):
  return x + y


@task
def similarity(datasetId, groupName):
  _log.debug('Start to calculate Jaccard similarity between group %s of dataset %s and all others.', groupName, datasetId)

  result = {}

  try:
    # get column data of group to be compared
    cmpDataSet = get_dataset(datasetId)

    # find group in that column
    for aGroup in cmpDataSet.groups():
      if (aGroup.name == groupName):
        group = aGroup
        break


    if ('group' in vars()): # found it?
      #get the patients of that group
      patList = cmpDataSet.rowids(group.range)

      #compare that group's list of patients to all others
      datasets = list_datasets()

      for dataset in datasets:
        if (isinstance(dataset, AStratification) and dataset.id != datasetId):
          _log.debug('Get groups of dataset '+dataset.id)
          secondDatset = get_dataset(dataset.id)
          for aGroup in secondDatset.groups():
            #now we have got two list that should get compared
            patList2 = secondDatset.rowids(aGroup.range)
            setA = set(patList)
            setB = set(patList2)
            #jaccard = intersection / union
            jaccard = len(setA.intersection(setB))/float(len(setA.union(setB)))
            _log.debug('jaccard for {} index is {}'.format(dataset.id+'/'+aGroup.name, str(jaccard)))

            if dataset.id not in result or result[dataset.id] < jaccard:
              result[dataset.id] = jaccard
    else:
      _log.error('Group %s not part of column %s.', groupName, datasetId)
      raise Exception('Group '+groupName+' not part of column '+  datasetId+'.')

    _log.debug('Done with Jaccard calculation.')
  except Exception as e:
    _log.exception('Can not fulfill task. Error: %s.', e)
    raise #rejects promise

  return result #to JSON automatically
