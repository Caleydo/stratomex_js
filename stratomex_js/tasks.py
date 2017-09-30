from __future__ import absolute_import

from phovea_processing_queue.task_definition import task, getLogger
from phovea_server.dataset import list_datasets
from .similarity import similarity_by_name
import numpy as np

_log = getLogger(__name__)


@task
def add(x, y):
  return x + y


@task
def similarity(method, ids):
  _log.debug('Start to calculate %s similarity.', method)

  similarity_measure = similarity_by_name(method)
  if similarity_measure is None:
    raise ValueError("No similarity measure for given method: " + method)

  result = {'values': {}, 'groups': {}}

  try:
    from phovea_server.range import parse
    parsed_range = parse(ids)
    cmp_patients = np.array(parsed_range[0])  # [0] since ranges are multidimensional but you just want the first one

    # compare that group's list of patients to all others
    datasets = list_datasets()
    for dataset in datasets:
      # check data type, e.g. HDFTable, HDFStratification, HDFMatrix
      if dataset.type == 'stratification':
        for group in dataset.groups():
          # now we have got two list that should get compared
          pat_set2 = dataset.rowids(group.range)
          sim_score = similarity_measure(cmp_patients, pat_set2)

          if dataset.id not in result['values'] or similarity_measure.is_more_similar(sim_score, result['values'][dataset.id]):
            result['values'][dataset.id] = sim_score
            result['groups'][dataset.id] = group.name

      elif dataset.type == 'matrix' and dataset.value == 'categorical':  # some matrix data has no categories (e.g. mRNA, RPPA)
        _log.debug('Start processing matrix ' + dataset.id)
        mat_data = dataset.asnumpy()

        # for each column (e.g. gene (e.g. A1CF))
        # datatset.cols() are the stuff that can be in added to stratomex
        for col in range(mat_data.shape[1]):
          if col % 500 == 0:
            _log.debug('Processing col ' + str(col) + "/" + str(mat_data.shape[1]))

          mat_column = mat_data[:, col]
          # check in which categories the patients are
          for cat in dataset.categories:
            cat_row_indicies = np.argwhere(mat_column == cat['name'])[:, 0]  # get indicies as 1column matrix and convert to 1d array
            patients_in_cat = dataset.rowids()[cat_row_indicies]  # indicies to patient ids
            sim_score = similarity_measure(cmp_patients, patients_in_cat)

            column_id = dataset.id + '-c' + str(col)
            if column_id not in result['values'] or similarity_measure.is_more_similar(sim_score, result['values'][column_id]):
              result['values'][column_id] = sim_score
              result['groups'][column_id] = cat if isinstance(cat, str) else cat['label']
              # e.g. result['tcgaGbmSampledMutations-c9408'] = 1

      elif dataset.type == 'table':
        for col in dataset.columns:
          if col.type == 'categorical':
            col_data = col.asnumpy()  # table doesnt have asnumpy()
            for cat in col.categories:
              cat_name = cat if isinstance(cat, str) else cat['name']  # TCGA table had just the strings, calumma table has a dict like matrix above
              cat_row_indicies = np.argwhere(col_data == cat_name)[:, 0]
              if cat_row_indicies.size > 0:
                patients_in_cat = dataset.rowids()[cat_row_indicies]  # indicies to patient ids
                sim_score = similarity_measure(cmp_patients, patients_in_cat)

                column_id = dataset.id + '_' + col.name  # id in stratomex has trailing '-s' which is not needed here (e.g. tcgaGbmSampledClinical_patient.ethnicity-s)
                if column_id not in result['values'] or similarity_measure.is_more_similar(sim_score, result['values'][column_id]):
                  result['values'][column_id] = sim_score
                  result['groups'][column_id] = cat if isinstance(cat, str) else cat['label']

  except Exception as e:
    _log.exception('Can not fulfill task. Error: %s.', e)
    raise  # rejects promise

  return result  # to JSON automatically
