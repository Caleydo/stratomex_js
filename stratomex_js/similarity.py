from __future__ import absolute_import, division
import abc
import numpy as np


__author__ = 'Klaus Eckelt'


def similarity_by_name(method_name):
  for sim_measure in ASimilarityMeasure.__subclasses__():
    if sim_measure.matches(method_name):
      return sim_measure()


class ASimilarityMeasure(object):
  __metaclass__ = abc.ABCMeta

  @abc.abstractmethod
  def __call__(self, set_a, set_b):
    pass

  @staticmethod
  @abc.abstractmethod
  def is_more_similar(measure_a, measure_b):
    return measure_a > measure_b  # higher similarity score = better

  @staticmethod
  @abc.abstractmethod
  def matches(name):
    return False


class JaccardSimilarity(ASimilarityMeasure):
  def __call__(self, set_a, set_b):
    return np.intersect1d(set_a, set_b).size / np.union1d(set_a, set_b).size  # independent of parameter order

  @staticmethod
  def matches(name):
    return "jaccard" == name
