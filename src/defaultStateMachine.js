// Available variables/objects/functions:
// XState
// - Machine
// - interpret
// - assign
// - send
// - sendParent
// - spawn
// - raise
// - actions
// - XState (all XState exports)
//
// Common
// - setInterval, setTimeout, clearInterval, clearTimeout
// - node.send, node.warn, node.log, node.error
// - context.get, context.set
// - flow.get, flow.set
// - env.get
// - util

// First define names guards, actions, ...

/**
 * Guards
 */
const maxValueReached = (context, event) => {
  return context.counter >= 10;
};

/**
 * Actions
 */
const incrementCounter = assign({
  counter: (context, event) => context.counter + 1
});

const resetCounter = assign({
  counter: (context, event) => {
    // Can send log messages via
    //  - node.log
    //  - node.warn
    //  - node.error
    //node.warn("RESET");

    // Can send messages to the second outport
    // Specify an array to send multiple messages
    // at once
    //  - node.send(msg)
    node.send({ payload: "resetCounter" });
    
    return 0;
  }
});

/**
 * Activities
 */
const doStuff = () => {
  // See https://xstate.js.org/docs/guides/activities.html
  const interval = setInterval(() => {
    node.send({ payload: 'BEEP' });
  }, 1000);
  return () => clearInterval(interval);
};

/***************************
 * Main machine definition * 
 ***************************/
return {
  machine: {
    context: {
      counter: 0
    },
    initial: 'count',
    states: {
      count: {
        on: {
          '': { target: 'reset', cond: 'maxValueReached' }
        },
        after: {
          1000: { target: 'count', actions: 'incrementCounter' }
        }
      },
      reset: {
        entry: 'resetCounter',
        after: {
          5000: { target: 'count' }
        },
        activities: 'doStuff'
      }
    }
  },
  // Configuration containing guards, actions, activities, ...
  // see above
  config: {
    guards: { maxValueReached },
    actions: { incrementCounter, resetCounter },
    activities: { doStuff }
  },
  // Define listeners (can be an array of functions)
  //    Functions get called on every state/context update
  listeners: (data) => {
    //node.warn(data.state + ":" + data.context.counter);
  }
};