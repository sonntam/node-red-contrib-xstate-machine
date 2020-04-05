// This is a simple run machine that has two parent states
//  - INIT
//  - RUN
// where the RUN state has 3 substates as well as a history state.
// The RUN state contains a final state "DONE". If it is reached it should
// return state to the "INIT" state.
return  {
    initial: 'INIT',
    states: {
      INIT: {
        on: {
          'init': 'RUN'
        }
      },
      RUN: {
          initial: 'STOP',
          states: {
              HIST: {
                  type: 'history'
              },
              STOP: {
                  on: {
                      run: "GO"
                  }
              },
              GO: {
                  on: {
                      stop: "STOP",
                      finish: 'DONE'
                  }
              },
              DONE: {
                  type: 'final'
              }
          },
          on: {
              pause: 'PAUSE'
          },
          onDone: 'INIT'
      },
      PAUSE: {
          on: {
              resume: 'RUN.HIST'
          }
      }
  }
 };