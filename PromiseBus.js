var Promise = require('bluebird');
var _ = require('lodash');

function PromiseBus(name) {
  this.name = name || 'promisebus' + Math.floor(Math.random() * 65536);
  this.bus = {};
  return this;
}

/**
 * The equivalent of EventEmitter's `on`
 * @param {string} [name] The name of the current worker. Taken from `worker.name` if unspecified. Must be unique; will overwrite the old worker with this name if it isn't
 * @param {Array.<string>} dependencies The list of workers on this event that this worker depends on
 * @param {function} worker The worker. Will be supplied the event's arguments first, then its dependencies as arguments
 * @return {this}
 */
PromiseBus.prototype.register = function(name, dependencies, worker) {
  if (!worker) {
    worker = dependencies;
    dependencies = name;
    name = worker.name;
  }

  if (_.isEmpty(name)) {
    throw new Error('Empty name not allowed');
  }

  this.bus[name] = {
    name: name,
    dependencies: dependencies,
    worker: worker
  };

  return this;
};

/**
 * The equivalent of EventEmitter's `removeListener`
 * @param {string} name The worker to unregister
 * @return {this}
 */
PromiseBus.prototype.unregister = function(name) {
  delete this.bus[name];
  return this;
};

/**
 * The equivalent of EventEmitter's `listeners`
 * @return {Object.<string,{dependencies: Array.<string>, worker: function}>}
 */
PromiseBus.prototype.workers = function() {
  return this.bus || {};
};

/**
 * The equivalent of EventEmitter's `emit`
 * @param {...?} args Optional additional arguments for the workers
 * @return {Promise.<Object.<string, ?>>} returns a promise for the results
 */
PromiseBus.prototype.run = function() {
  var args = Array.prototype.slice.call(arguments, 0);
  return Promise.props(this._buildGraph.apply(this, [this.bus].concat(args)));
};

/**
 * Run a single worker, with its dependencies. Doesn't run unrelated workers.
 * @param {string} name The worker to run
 * @param {...?} args Optional additional arguments for the worker
 * @return {Promise.<?>} returns a promise for the results
 */
PromiseBus.prototype.runWorker = function(name) {
  var args = Array.prototype.slice.call(arguments, 1);

  var relevantWorkers = function(bus, name) {
    return Array.prototype.concat.apply(
      [name], _.map(bus[name].dependencies, _.partial(relevantWorkers, bus)));
  };

  var bus = _.pick(this.bus, relevantWorkers(this.bus, name));

  var promises = this._buildGraph.apply(this, [bus].concat(args));
  return promises[name];
};

// this function synchronously builds the promise chain as
// specified by the dependency information. It uses the string keys of
// the given workers to late-bind promises to each other's `.then`
// functions.
PromiseBus.prototype._buildGraph = function(bus) {
  var args = Array.prototype.slice.call(arguments, 1);
  var tasks = _.cloneDeep(bus);

  var results = {};
  var undone = _.keys(tasks).length;
  var lastUndone = undone;

  while (undone > 0) {
    // essentially, we loop through the task list continuously,
    // looking for things whose dependency promises have been built
    // this allows us to do late binding of dependencies, in the
    // promise chain
    // Don't do circular graphs!
    _.each(tasks, function buildTask(task, name) {
      // if we haven't built the task yet, and all its dependencies are ready
      if (!task.built && _.all(_.at(results, task.dependencies)))  {
        results[name] = Promise.props(_.pick(results, task.dependencies))
          .then(function(values) {
            return task.worker.apply(null, args.concat([values]));
          });

        task.built = true;
        undone--;
      }
    });

    // if we've been unable to build anything, because everything is
    // waiting on something else
    if (undone === lastUndone) {
      var unbuilt = _(tasks).reject('built').map('name').value();
      throw new Error('Unsatisfiable dependency graph found for promisebus ' + this.name +
                      ' (unresolved tasks: ' + unbuilt.join(', ') + ')');
    }

    lastUndone = undone;
  }

  return results;
};

module.exports = PromiseBus;
