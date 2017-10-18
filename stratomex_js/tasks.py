from __future__ import absolute_import

from phovea_processing_queue.task_definition import task

@task
def add(x, y):
  return x + y

