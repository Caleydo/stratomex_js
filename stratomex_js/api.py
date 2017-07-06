from __future__ import absolute_import
from phovea_server.ns import Namespace


app = Namespace(__name__)


@app.route('/add/<x>/<y>', methods=['GET'])
def add(x, y):
  from . import tasks
  res = tasks.add.delay(x, y)
  return res.id

@app.route('/similarity/<method>/', methods=['GET'])
def calcJaccardSim2Grp(method):
  from . import tasks #import from current package
  from flask import request

  res = tasks.similarity.delay(method, request.args['range'])
  return res.id

def create():
  """
   entry point of this plugin
  """
  return app
