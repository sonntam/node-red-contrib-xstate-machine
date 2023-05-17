var should = require("should");
var helper = require("node-red-node-test-helper");
var fs     = require("fs");
const path = require('path');

var smxstateNode = require("../src/smxstate-node");

helper.init(require.resolve('node-red'));

describe('smxstate node with default machine', function() {

    before(function(done){
        this.timeout(10000);
        helper.startServer(done);
    });

    afterEach(function(done){
        helper.unload();
        done();
    });

    after(function(done){
        helper.stopServer(done);
    });

    var machinePath = path.join(__dirname, '../src/defaultStateMachine.js');
    var flow = [
        {
            id: "n1", type: "smxstate", wires: [["n2"]],
            xstateDefinition: fs.readFileSync(machinePath, { encoding: "utf8" })
        },
        { id: "n2", type: "helper" }
    ];

    it('should be loaded', function(done){
        var flow = [{id:"n1",type:"smxstate",name:"xstate-test"}];
        helper.load(smxstateNode, flow, function() {
            var n1 = helper.getNode("n1");
            n1.should.have.property('name', 'xstate-test');
            done();
        });
    });

    it('should transition state to pause upon <PAUSE> event and back to run on <reset>', function (done) {
        
        helper.load(smxstateNode, flow, function () {
            var n1 = helper.getNode("n1");
            var n2 = helper.getNode("n2");
          
            var msgcounter = 0;
            n2.on("input", function (msg) {
                // Ignore context messages
                if( msg.hasOwnProperty('topic') && msg.topic === 'context' ) return;
                
                msg.should.have.property('topic', 'state');
                msg.should.have.property('payload');
                msg.payload.should.have.property('state');
                
                msgcounter++;
                if( msgcounter === 1 ) {
                    msg.payload.state.should.equal('pause');
                    n1.receive({ topic: 'reset' });
                }
                else if( msgcounter === 2 ) {
                    msg.payload.state.should.have.property('run','count');
                    done();
                }
            });
            n1.receive({ topic: "PAUSE"});
        });
    });

    it('should count to 10 and then reset to 0 (takes approx 10 seconds)', function (done) {
        this.timeout(20000);
        helper.load(smxstateNode, flow, function () {
            var n1 = helper.getNode("n1");
            var n2 = helper.getNode("n2");
          
            var msgcounter = 0;
            n2.on("input", function (msg) {
                // Ignore context messages
                if( msg.hasOwnProperty('topic') && msg.topic === 'context' ) {
                    msgcounter++;
                    msg.should.have.property('payload');
                    msg.payload.should.have.property('counter');
                    return;
                }

                msg.should.have.property('payload');
                msg.payload.should.have.property('state');

                if( msgcounter == 9 ) {
                    msg.payload.state.should.have.property('run','reset');
                }

                if( msgcounter == 10 ) {
                    msg.payload.state.should.have.property('run','count');
                    msg.payload.should.have.property('context');
                    msg.payload.context.should.have.property('counter', 0);
                    done();
                }
                
            });
        });
    });
});