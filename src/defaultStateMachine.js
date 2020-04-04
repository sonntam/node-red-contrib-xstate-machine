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
const incrementCounter = (context, event) => {
  context.counter += 1;
};

const resetCounter = (context, event) => {
  // Can send log messages via
  //  - node.log
  //  - node.warn
  //  - node.error
  node.warn("RESET");

  context.counter = 0;

  // Can send messages to the second outport
  // Specify an array to send multiple messages
  // at once
  //  - node.send(msg)
  node.send({ payload: "resetCounter" });
};

/**
 * Activities
 */
const doStuff = () => {
  debugger;
  const interval = setInterval(() => node.warn('BEEP'), 1000);
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
          500: { target: 'count', actions: 'incrementCounter' }
        }
      },
      reset: {
        entry: 'resetCounter',
        after: {
          '5000': { target: 'count' }
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
    node.warn(data.state + ":" + data.context.counter);
  }
};