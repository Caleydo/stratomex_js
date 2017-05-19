from __future__ import absolute_import
from phovea_processing_queue.task_definition import task, getLogger
import json
from urllib2 import urlopen #python 2, for 3 use: from urllib.request import urlopen
_log = getLogger(__name__)


@task
def add(x, y):
  return x + y


def get_jsonparsed_data(url):
    response = urlopen(url)
    data = response.read().decode("utf-8")
    return json.loads(data)  #loads = load string

def rangeString2Ints(range):
  """
      Converts the given range string into a start- and end Index.

      Parameters
      ----------
      range : str
        Range such as: (start:end), start:end, (start) or start

      Returns
      -------
      (start, end): int
        Start and end index - might be the equal
  """

  if (':' in range):
    if range.startswith('(') and range.endswith(')'):  # might be 176:192 or (176:192)
      range = range[1:-1]

    startIndex = int(range.split(':')[0])
    endIndex = int(range.split(':')[1])

    return startIndex, endIndex

  else:
    if range.startswith('(') and range.endswith(')'):  # might be 111 or (111)
      range = range[1:-1]

    index = int(range)
    return index, index



@task
def similarity(datasetId, groupName):
  _log.debug('Start to calculate Jaccard similarity between group %s of dataset %s and all others.', groupName, datasetId)

  # Get all Datasets: http://localhost:9000/api/dataset/
  # Get details for dataset: http://localhost:9000/api/dataset/tcgaGbmSampledClinicalRace
  # ---> contains range and rowIds --> range first 13 patients are in grp 1, first patient's id can be looked up by rowIds

  try:
    # get column data of group to be compared
    url = ("http://api/api/dataset/"+datasetId)
    cmpDataSet = get_jsonparsed_data(url)

    result = {}

    # find group in that column
    for aGroup in cmpDataSet['groups']:
      if (aGroup['name'] == groupName):
        group = aGroup
        break

    # found it?
    if ('group' in vars()):
      #get the patients of that group
      startIndex, endIndex = rangeString2Ints(group['range'])
      patList = cmpDataSet['rowIds'][startIndex:endIndex]

      #compare that group's list of patients to all others
      url = ("http://api/api/dataset/")
      jsonDatasets = get_jsonparsed_data(url)

      for dataset in jsonDatasets:
        if (dataset['id'] != datasetId and dataset['id'] != 'tcgaGbmSampledRppaTreeClusterer1'):
          _log.debug('Get groups of dataset '+dataset['id'])
          url = ("http://api/api/dataset/" + dataset['id'])
          secondDatset = get_jsonparsed_data(url)
          if ('groups' in secondDatset):
            for aGroup in secondDatset['groups']:
              startIndex, endIndex = rangeString2Ints(aGroup['range'])
              #now we have got two list that should get compared
              patList2 = secondDatset['rowIds'][startIndex:endIndex]
              setA = set(patList)
              setB = set(patList2)
              #jaccard = intersection / union
              jaccard = len(setA.intersection(setB))/float(len(setA.union(setB)))
              _log.debug('jaccard for {} index is {}'.format(dataset['id']+'/'+aGroup['name'], str(jaccard)))

              if dataset['id'] not in result or result[dataset['id']] < jaccard:
                result[dataset['id']] = jaccard
    else:
      _log.error('Group %s not part of column %s', groupName, datasetId)

    _log.debug('done with jaccard calculation')
  except Exception as e:
    _log.exception('cant fullfil task %s', e)

  return result #to JSON automatically
