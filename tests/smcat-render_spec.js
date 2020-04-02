var should = require("should");
var assert = require('assert');
const modChildProcess = require('child_process');
var { render, renderRaw } = require("../src/smcat-render");

const exampleSMCATSrc = `fetch/initial,\nfetch.idle/atomic [label="idle" type=regular];`;
const exampleSMCATErrSrc = `fetch-initial,\nfetch.idle/atomic [label="idle" type=regular];`;

describe('smcat renderer', function() {

    before(function(done){
        done();
    });

    after(function(done){
        done();
    });

    it('should render valid svg from smcat', function(done){
        this.timeout(10000);
        let result = renderRaw(exampleSMCATSrc, (data) => {
            (!!data).should.be.true();
            data.should.have.property('data');
            data.should.have.property('err');
            data.should.have.property('code');
            data.data.should.match(/<svg.*?<\/svg>\s*$/si);
            data.code.should.be.exactly(0);
            should(data.err).be.exactly(null);

            done();
        });

        (!!result).should.be.true();
        result.should.be.instanceOf(modChildProcess.ChildProcess);
    });

    it('should time out', function (done) {
        let result = renderRaw(exampleSMCATSrc, (data) => {
            should(data).be.exactly(null);
            done();
        }, 10);

        (!!result).should.be.true();
        result.should.be.instanceOf(modChildProcess.ChildProcess);
    });

    it('should return syntax error', function(done) {
        let result = renderRaw(exampleSMCATErrSrc, (data) => {
            (!!data).should.be.true();
            data.should.have.property('err');
            data.should.have.property('code');
            data.err.should.match(/syntax\serror/si);
            data.code.should.be.above(0);

            done();
        });
    });

    it('should output post-processed renderings', function(done){
        this.timeout(10000);
        let result = render(exampleSMCATSrc, (data) => {
            (!!data).should.be.true();
            data.should.have.property('data');
            data.should.have.property('err');
            data.should.have.property('code');
            data.data.should.match(/<html.*?<svg.*?<\/svg>.*?<\/html>$/si);
            data.code.should.be.exactly(0);
            should(data.err).be.exactly(null);

            done();
        });

        (!!result).should.be.true();
        result.should.be.instanceOf(modChildProcess.ChildProcess);
    });
});