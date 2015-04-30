var sinon = require('sinon');
var Promise = require('bluebird');
var Bus = require('../PromiseBus');

describe('PromiseBus', function() {
  it('registers tasks', function() {
    var bus = new Bus();

    var task = sinon.stub();
    bus.register('foo', [], task);

    bus.tasks().should.deep.equal({
      foo: {
        dependencies: [],
        fn: task,
        name: 'foo'
      }
    });
  });

  it('uses the function name as a name when none is provided', function() {
    var bus = new Bus();

    var task = function foo() {};
    bus.register([], task);

    bus.tasks().should.deep.equal({
      foo: {
        dependencies: [],
        fn: task,
        name: 'foo'
      }
    });
  });

  it('does not allow empty function names', function() {
    var bus = new Bus();

    (function() {
      bus.register([], function() {});
    }).should.throw(/Empty name not allowed/);
  });

  it('runs tasks with arguments', function() {
    var bus = new Bus();

    var task1 = sinon.stub().resolves(1);
    var task2 = sinon.stub().resolves(2);

    bus.register('t1', [], task1);
    bus.register('t2', [], task2);

    var run = bus.run('arg1', 2, { obj: 3 });

    return Promise.all([
      run.should.eventually.deep.equal({ t1: 1, t2: 2 }),
      run.then(function() {
        task1.should.have.been.calledWith('arg1', 2, { obj: 3 }, {});
        task2.should.have.been.calledWith('arg1', 2, { obj: 3 }, {});
      })
    ]);
  });

  it('constructs and runs a dependency graph', function() {
    var bus = new Bus();

    var task1 = sinon.stub().resolves(1);
    var task2 = sinon.stub().resolves(2);
    var task3 = sinon.stub().resolves(3);
    var task4 = sinon.stub().resolves(4);
    var task5 = sinon.stub().resolves(5);

    bus.register('t1', [], task1);
    bus.register('t2', ['t1'], task2);
    bus.register('t3', ['t1'], task3);
    bus.register('t4', ['t2', 't3'], task4);
    bus.register('t5', ['t3'], task5);

    var run = bus.run(0);

    return Promise.all([
      run.should.eventually.deep.equal({ t1: 1, t2: 2, t3: 3, t4: 4, t5: 5 }),
      run.then(function() {
        task1.should.have.been.calledWith(0, {});
        task2.should.have.been.calledWith(0, { t1: 1 });
        task3.should.have.been.calledWith(0, { t1: 1 });
        task4.should.have.been.calledWith(0, { t2: 2, t3: 3 });
        task5.should.have.been.calledWith(0, { t3: 3 });
      })
    ]);
  });

  it('bails out early on unsatisfiable dependency graphs', function() {
    var bus = new Bus();

    var task1 = sinon.stub().resolves(1);
    var task2 = sinon.stub().resolves(2);
    var task3 = sinon.stub().resolves(3);
    var task4 = sinon.stub().resolves(4);

    bus.register('t1', [], task1);
    bus.register('t2', ['t1'], task2);
    bus.register('t3', ['t4'], task3);
    bus.register('t4', ['t3'], task4);

    (function() {
      bus.run();
    }).should.throw(/Unsatisfiable dependency graph found for promisebus/);

    task1.should.not.have.been.called;
    task2.should.not.have.been.called;
    task3.should.not.have.been.called;
    task4.should.not.have.been.called;
  });

  it('can run an empty bus', function() {
    var bus = new Bus();
    (function() {
      bus.run();
    }).should.not.throw;
  });

  it('doesn\'t accidentally store state', function() {
    var bus = new Bus();

    var task = sinon.stub().resolves(1);
    bus.register('t1', [], task);

    var state1 = bus.tasks('event');
    var run1 = bus.run();

    var state2 = run1.then(function() { return bus.tasks(); });
    var run2 = state2.then(function() { return bus.run(); });

    return Promise.all([
      run1.should.eventually.deep.equal({ t1: 1 }),
      run2.should.eventually.deep.equal({ t1: 1 }),
      state2.should.eventually.equal(state1)
    ]);
  });

  it('can run a single task, and its dependencies, without running disconnected tasks', function() {
    var bus = new Bus();

    var task1 = sinon.stub().resolves(1);
    var task2 = sinon.stub().resolves(2);
    var task3 = sinon.stub().resolves(3);
    var task4 = sinon.stub().resolves(4);
    var task5 = sinon.stub().resolves(5);

    bus.register('t1', [], task1);
    bus.register('t2', [], task2);
    bus.register('t3', ['t1', 't2'], task3);
    bus.register('t4', [], task4);
    bus.register('t5', ['t4'], task5);

    var run = bus.runTask('t3', 0);
    return Promise.all([
      run.should.eventually.deep.equal(3),
      run.then(function() {
        task1.should.have.been.calledWith(0, {});
        task2.should.have.been.calledWith(0, {});
        task3.should.have.been.calledWith(0, { t1: 1, t2: 2 });
        task4.should.have.callCount(0);
        task5.should.have.callCount(0);
      })
    ]);
  });
});
