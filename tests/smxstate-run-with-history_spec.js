var should = require("should");
var helper = require("node-red-node-test-helper");
var fs     = require("fs");
const path = require('path');

var smxstateNode = require("../src/smxstate-node");

helper.init(require.resolve('node-red'));

describe('smxstate node', function() {

    before(function(done){
        helper.startServer(done);
    });

    afterEach(function(done){
        helper.unload();
        done();
    });

    after(function(done){
        helper.stopServer(done);
    });

    var machinePath = path.join(__dirname, '../examples/machines/run-with-history.js');
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

    it('should transition state to RUN upon <init> event and back to INIT on <reset>', function (done) {
        
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
                    msg.payload.state.should.have.property('RUN','STOP');
                    n1.receive({ topic: 'reset' });
                }
                else if( msgcounter === 2 ) {
                    msg.payload.state.should.equal('INIT');
                    done();
                }
            });
            n1.receive({ topic: "init"});
        });
    });

    it('should transition back to last state using shallow history state', function (done) {
        
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
                    msg.payload.state.should.have.property('RUN','STOP');
                }
                else if( msgcounter === 2 ) {
                    msg.payload.state.should.have.property('RUN','GO');
                }
                else if( msgcounter === 3 ) {
                    msg.payload.state.should.equal('PAUSE');
                }
                else if( msgcounter === 4 ) {
                    msg.payload.state.should.have.property('RUN','GO');
                    done();
                }
            });
            n1.receive({ topic: "init"});
            n1.receive({ topic: "run"});
            n1.receive({ topic: "pause"});
            n1.receive({ topic: "resume"});
        });
    });

    it('should return to INIT state when reached final state', function (done) {
        
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
                    msg.payload.state.should.have.property('RUN','STOP');
                }
                else if( msgcounter === 2 ) {
                    msg.payload.state.should.have.property('RUN','GO');
                }
                else if( msgcounter === 3 ) {
                    msg.payload.state.should.equal('INIT');
                    done();
                }

            });
            n1.receive({ topic: "init"});
            n1.receive({ topic: "run"});
            n1.receive({ topic: "finish"});
        });
    });
});