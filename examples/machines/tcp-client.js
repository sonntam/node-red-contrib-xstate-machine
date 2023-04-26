// Available variables/objects/functions:
// xstate
// - .Machine
// - .interpret
// - .assign
// - .send
// - .sendParent
// - .spawn
// - .raise
// - .actions
//
// Common
// - setInterval, setTimeout, clearInterval, clearTimeout
// - node.send, node.warn, node.log, node.error
// - context.get, context.set
// - flow.get, flow.set
// - env.get
// - util


const { assign } = xstate;

// First define names guards, actions, ...

/**
 * Guards
 */
const maxValueReached = (context, event) => {
    node.warn(event)
    return context.counter >= 10;
};

const cmdSent = context => context.cmdSent;
const respReceived = context => context.respReceived;



/**
 * Actions
 */

const sendCmd = assign({ cmdSent: true });
// const showResp = assign({ respReceived: true });
const showResp = assign({
    respReceived: (context, event) => {
        // Can send log messages via
        //  - node.log
        //  - node.warn
        //  - node.error
        //node.warn("RESET");

        // Can send messages to the second outport
        // Specify an array to send multiple messages
        // at once
        //  - node.send(msg)

        node.warn(event)

        // node.send({ payload: "resetCounter" });
        node.send(event);

        return true;
    }
});
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

        node.warn(event)

        node.send({ payload: "resetCounter" });

        return 0;
    }
});

/**
 * Activities
 */
// const doStuff = () => {
//   // See https://xstate.js.org/docs/guides/activities.html
//   const interval = setInterval(() => {
//     node.send({ payload: 'BEEP' });
//   }, 1000);
//   return () => clearInterval(interval);
// };

/**
 * Services
 */
const waitResp = (context, event) => (cb) => {

    // node.warn(context)
    node.warn("waitResp")
    node.warn(event)

    node.send(event);

    if (event.payload.callback) {
        setTimeout(() => {
            // cb({ type: 'respReceived' });
            // cb({ type: 'respReceived' });
            cb({ type: 'timeout' });
        }, 3000);
    }


}

/***************************
 * Main machine definition * 
 ***************************/
// return {
//   machine: {
//     context: {
//       counter: 0
//     },
//     initial: 'run',
//     states: {
//       run: {
//         initial: 'count',
//         states: {
//           count: {
//             on: {
//               '': { target: 'reset', cond: 'maxValueReached' }
//             },
//             after: {
//               1000: { target: 'count', actions: 'incrementCounter' }
//             }
//           },
//           reset: {
//             exit: 'resetCounter',
//             after: {
//               5000: { target: 'count' }
//             },
//             activities: 'doStuff'
//           }
//         },
//         on: {
//           PAUSE: 'pause'
//         }
//       },
//       pause: {
//         on: {
//           RESUME: 'run'
//         }
//       }
//     }
//   },
//   // Configuration containing guards, actions, activities, ...
//   // see above
//   config: {
//     guards: { maxValueReached },
//     actions: { incrementCounter, resetCounter },
//     activities: { doStuff }
//   },
//   // Define listeners (can be an array of functions)
//   //    Functions get called on every state/context update
//   listeners: (data) => {
//     //node.warn(data.state + ":" + data.context.counter);
//   }
// };

return {
    machine: {
        context: {
            cmdSent: false,
            counter: 0,
            respReceived: false
        },
        initial: 'ready',
        states: {
            ready: {
                on: {
                    'sendCmd': {
                        target: 'waitingResp',
                        actions: sendCmd
                    }
                }
            },
            waitingResp: {
                invoke: { src: 'waitResp' },
                on: {
                    'respReceived': {
                        target: 'ready',
                        actions: showResp
                    },
                    'timeout': 'timeout'
                }
            },
            timeout: {
                on: {
                    'respReceived': {
                        target: 'ready',
                        actions: showResp
                    }
                }
            }
        }
    },
    config: {
        guards: {
            "cmdSent": cmdSent,
            "respReceived": respReceived
        },
        actions: { sendCmd, showResp },
        services: { waitResp }
    },
    listeners: (data) => {
        // node.warn("listeners: " + data.state);
        // node.warn(data.context);
    }
};