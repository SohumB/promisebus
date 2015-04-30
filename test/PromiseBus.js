var sinon = require('sinon');
var Promise = require('bluebird');
var Bus = require('../PromiseBus');

describe('PromiseBus', function() {
  it('registers workers', function() {
    var bus = new Bus();

    var worker = sinon.stub();
    bus.register('foo', [], worker);

    bus.workers().should.deep.equal({
      foo: {
        dependencies: [],
        worker: worker,
        name: 'foo'
      }
    });
  });

  it('uses the function name as a name when none is provided', function() {
    var bus = new Bus();

    var worker = function foo() {};
    bus.register([], worker);

    bus.workers().should.deep.equal({
      foo: {
        dependencies: [],
        worker: worker,
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

  it('runs workers with arguments', function() {
    var bus = new Bus();

    var worker1 = sinon.stub().resolves(1);
    var worker2 = sinon.stub().resolves(2);

    bus.register('w1', [], worker1);
    bus.register('w2', [], worker2);

    var run = bus.run('arg1', 2, { obj: 3 });

    return Promise.all([
      run.should.eventually.deep.equal({ w1: 1, w2: 2 }),
      run.then(function() {
        worker1.should.have.been.calledWith('arg1', 2, { obj: 3 }, {});
        worker2.should.have.been.calledWith('arg1', 2, { obj: 3 }, {});
      })
    ]);
  });

  it('constructs and runs a dependency graph', function() {
    var bus = new Bus();

    var worker1 = sinon.stub().resolves(1);
    var worker2 = sinon.stub().resolves(2);
    var worker3 = sinon.stub().resolves(3);
    var worker4 = sinon.stub().resolves(4);
    var worker5 = sinon.stub().resolves(5);

    bus.register('w1', [], worker1);
    bus.register('w2', ['w1'], worker2);
    bus.register('w3', ['w1'], worker3);
    bus.register('w4', ['w2', 'w3'], worker4);
    bus.register('w5', ['w3'], worker5);

    var run = bus.run(0);

    return Promise.all([
      run.should.eventually.deep.equal({ w1: 1, w2: 2, w3: 3, w4: 4, w5: 5 }),
      run.then(function() {
        worker1.should.have.been.calledWith(0, {});
        worker2.should.have.been.calledWith(0, { w1: 1 });
        worker3.should.have.been.calledWith(0, { w1: 1 });
        worker4.should.have.been.calledWith(0, { w2: 2, w3: 3 });
        worker5.should.have.been.calledWith(0, { w3: 3 });
      })
    ]);
  });

  it('bails out early on unsatisfiable dependency graphs', function() {
    var bus = new Bus();

    var worker1 = sinon.stub().resolves(1);
    var worker2 = sinon.stub().resolves(2);
    var worker3 = sinon.stub().resolves(3);
    var worker4 = sinon.stub().resolves(4);

    bus.register('w1', [], worker1);
    bus.register('w2', ['w1'], worker2);
    bus.register('w3', ['w4'], worker3);
    bus.register('w4', ['w3'], worker4);

    (function() {
      bus.run();
    }).should.throw(/Unsatisfiable dependency graph found for promisebus/);

    worker1.should.not.have.been.called;
    worker2.should.not.have.been.called;
    worker3.should.not.have.been.called;
    worker4.should.not.have.been.called;
  });

  it('can run an empty bus', function() {
    var bus = new Bus();
    (function() {
      bus.run();
    }).should.not.throw;
  });

  it('doesn\'t accidentally store state', function() {
    var bus = new Bus();

    var worker = sinon.stub().resolves(1);
    bus.register('w1', [], worker);

    var state1 = bus.workers('event');
    var run1 = bus.run();

    var state2 = run1.then(function() { return bus.workers(); });
    var run2 = state2.then(function() { return bus.run(); });

    return Promise.all([
      run1.should.eventually.deep.equal({ w1: 1 }),
      run2.should.eventually.deep.equal({ w1: 1 }),
      state2.should.eventually.equal(state1)
    ]);
  });
});
