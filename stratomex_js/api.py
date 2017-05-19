from __future__ import absolute_import
from phovea_server.ns import Namespace


app = Namespace(__name__)


@app.route('/add/<x>/<y>', methods=['GET'])
def add(x, y):
  from . import tasks
  res = tasks.add.delay(x, y)
  return res.id

@app.route('/similarity/<datasetId>/<groupName>', methods=['GET'])
def calcJaccardSim2Grp(datasetId, groupName):
  from . import tasks #import from current package
  res = tasks.similarity.delay(datasetId, groupName)
  return res.id

def create():
  """
   entry point of this plugin
  """
  return app
