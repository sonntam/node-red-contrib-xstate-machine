const maxValueReached = (context, event) => {
  return context.counter >= 10;
};

const incrementCounter = (context, event) => {
  context.counter += 1;
}

const resetCounter = (context, event) => {
  node.warn("RESET");
  context.counter = 0;
}

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
              '1000': { target: 'count' }
          }
      }
    }
  },
  // Configuration containing guards, actions, activities, ...
  config: {
      guards: { maxValueReached },
      actions: { incrementCounter, resetCounter }
  },
  // Define listeners (can be an array of functions)
  //    Functions get called on every update
  listeners: (data) => { 
      node.warn(data.state + ":" + data.context.counter); 
  }
}