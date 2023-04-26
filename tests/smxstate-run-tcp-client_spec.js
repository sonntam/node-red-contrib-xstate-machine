var should = require("should");
var helper = require("node-red-node-test-helper");
var fs     = require("fs");
const path = require('path');

var smxstateNode = require("../src/smxstate-node");

helper.init(require.resolve('node-red'));

describe('smxstate node with tcp-client.js example machine', function() {

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

    var machinePath = path.join(__dirname, '../examples/machines/tcp-client.js');
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

    it('should transition state to RUN upon <sendCmd> event and back to <timeout>', function (done) {
        this.timeout(10000);
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
                    msg.payload.state.should.equal('waitingResp');
                }
                else if( msgcounter === 2 ) {
                    msg.payload.state.should.equal('timeout');
                    done();
                }
            });
            n1.receive({ topic: "sendCmd"});
        });
    });

    it('should transition state to RUN upon <sendCmd> event and response in 1s ', function (done) {
        this.timeout(10000);
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
                    msg.payload.state.should.equal('waitingResp');
                    setTimeout(()=>n1.receive({ topic: 'respReceived' }),1000)
                }
                else if( msgcounter === 2 ) {
                    msg.payload.state.should.equal('ready');
                    done();
                }
            });
            n1.receive({ topic: "sendCmd"});

        });
    });
});