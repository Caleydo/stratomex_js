from __future__ import absolute_import, division
import abc
import numpy as np

__author__ = 'Klaus Eckelt'


def similarity_by_name(method_name):
  if method_name == "jaccard":
    return JaccardSimilarity
  else:
    return None


class ASimilarityMeasure(object):
  __metaclass__ = abc.ABCMeta

  @staticmethod
  @abc.abstractmethod
  def is_more_similar(measure_a, measure_b):
    pass

  @staticmethod
  @abc.abstractmethod
  def calc(set_a, set_b):
    pass


class JaccardSimilarity(ASimilarityMeasure):
  @staticmethod
  def is_more_similar(measure_a, measure_b):
    return measure_a > measure_b  # higher jaccard score = better

  @staticmethod
  def calc(set_a, set_b):
    return np.intersect1d(set_a, set_b).size / np.union1d(set_a, set_b).size  # independent of parameter order
