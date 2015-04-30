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
bus.register('name', [], function(eid) {
  return knex.select('name').from('mogs').where({ enclosure_id: eid });
})

bus.register('picture', [], function(eid) {
  return cameras[eid].takePicture();
});
```

Given its picture, we can approximate its age and gender, and given
its name and age, we can estimate how likely someone is to
adopt it.

```javascript
bus.register('age', ['picture'], function(eid, data) {
  return estimateAgeByFacialProportions(data.picture);
});

bus.register('gender', ['picture'], function(eid, data) {
  // mogs are highly gender-normative
  var colour = getPredominantColour(data.picture);
  return colour === 'pink' ? 'female' : 'male';
});

bus.register('adoptionProbability', ['name', 'age'], function(eid, data) {
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
});
```

Or, we could run only one such task.

```javascript
bus.runTask('adoptionProbability', 6).then(function(probability) {
  if (probability > 0.5) {
    console.debug('Guys, this should be an easy one, why is it still around?')
  }
});
```

And our mogs go happy to good homes.

---

# API Reference

`PromiseBus#register()` Registers a task to run on the bus.
- `name`, String naming this task. Optional, but if it isn't specified then function.name will be used instead.
- `dependencies`, Array of Strings listing the tasks this task depends on
- `task`, Function implementing the task itself. Will be passed the event's arguments, then its dependencies.
- Returns the `PromiseBus` instance for chaining.

`PromiseBus#unregister()` Unregisters an existing task.
- `name`, Name of the task to unregister
- Returns the `PromiseBus` instance for chaining.

`PromiseBus#tasks()` The list of tasks on the bus
- Returns an object of the form `{ name: { dependencies, task } }`

`PromiseBus#run()` Run the bus's tasks
- `...args`, Arguments to pass to the tasks
- Returns a Promise for an object of the form `{ name: return value }`

`PromiseBus#runTask()` Run a specific task (and its dependencies). Does not run disconnected tasks.
- `name`, The task to run
- `...args`, Arguments to pass to the tasks

`PromiseBus#runTasks()` Plural form of the above.
- `names`, Array with names of tasks to run
- `...args`, Arguments to pass to the tasks
