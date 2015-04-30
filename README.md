[![Build Status](https://secure.travis-ci.org/SohumB/promisebus.png)](http://travis-ci.org/SohumB/promisebus)

An EventEmitter-like interface for promises.

Like EventEmitter, it handles triggering sequences of asynchronous
actions on a common location. Unlike EventEmitter, it uses promise composition
to support return values and late binding of dependencies between tasks.

Suppose you have a stream of mogs to process, and you want them to
share an event bus.

```javascript
var PromiseBus = require('promisebus');

var bus = new PromiseBus();
```

Given a mog, we can go fetch its name from the database and take its
picture with a camera we have set up in the enclosure.

```javascript
bus.register([], function name(eid) {
  return knex.select('name').from('mogs').where({ enclosure_id: eid });
})

bus.register([], function picture(eid) {
  return cameras[eid].takePicture();
});
```

Given its picture, we can approximate its age and gender, and given
its name and age, we can estimate how likely someone is to
adopt it.

```javascript
bus.register(['picture'], function age(eid, data) {
  return estimateAgeByFacialProportions(data.picture);
});

bus.register(['picture'], function gender(eid, data) {
  // mogs are highly gender-normative
  var colour = getPredominantColour(data.picture);
  return colour === 'pink' ? 'female' : 'male';
});

bus.register(['name', 'age'], function adoptionProbability(eid, data) {
  return data.age < 2 || data.name.match(/fluff/) ? 0.9 : 0.2;
});
```

So now, when we receive a mog to process, we can run all these
disparate pieces of code in one step.

```javascript
bus.run(5).then(function(mog) {
  display mog.picture;
  console.log(mog.name, " is very happy to be adopted! ", mog.gender === 'female' ? "She" : "He", " hopes to see you soon!");
  if (mog.adoptionProbability < 0.5) {
    console.debug("We totally didn't call this one.")
  }
})
```

And our mogs go happy to good homes.

---

# API Reference

`PromiseBus#register` Registers a worker to run on the bus.
- `name`, String naming this worker. Optional, but then has to be specified in the function's name.
- `dependencies`, Array of Strings listing the workers this worker depends on
- `worker`, Function implementing the worker itself. Will be passed the event's arguments, then its dependencies.
- Returns the `PromiseBus` instance for chaining.

`PromiseBus#unregister` Unregisters an existing worker.
- `name`, Name of the worker to unregister
- Returns the `PromiseBus` instance for chaining.

`PromiseBus#workers` The list of workers on the bus
- Returns an object of the form `{ name: { dependencies, worker } }`

`PromiseBus#run` Run the bus's workers.
- `args`, Arguments to pass to the workers
- Returns a Promise for an object of the form `{ name: return value }`
