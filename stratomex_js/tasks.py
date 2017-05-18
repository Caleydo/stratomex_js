from __future__ import absolute_import
from phovea_processing_queue.task_definition import task, getLogger

_log = getLogger(__name__)


@task
def add(x, y):
  return x + y
