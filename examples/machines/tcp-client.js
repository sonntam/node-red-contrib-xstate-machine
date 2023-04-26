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

const cmdSent = context => context.cmdSent;
const respReceived = context => context.respReceived;



/**
 * Actions
 */

const sendCmd = assign({ cmdSent: true });
// const showResp = assign({ respReceived: true });
const showResp = assign({
    respReceived: (context, event) => {
        return true;
    }
});

/**
 * Services
 */
const waitResp = (context, event) => (cb) => {

    setTimeout(() => {
        cb({ type: 'timeout' });
    }, 3000);

}

/***************************
 * Main machine definition * 
 ***************************/
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
    }
};