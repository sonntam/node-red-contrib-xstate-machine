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
            //should(data.err).be.exactly(null);
        }).then((result) => {

            (!!result).should.be.true();
            result.should.have.property('data');
            result.should.have.property('err');
            result.should.have.property('code');
            result.data.should.match(/<svg.*?<\/svg>\s*$/si);
            result.code.should.be.exactly(0);
            //should(result.err).be.exactly(null);

            done();
        });
    });

    it('should time out', function (done) {
        let result = renderRaw(exampleSMCATSrc, 10, (data) => {
            should(data).be.exactly(null);
        }).then((result) => {
            should(result).be.exactly(null);
            done();
        });
    });

    it('should return syntax error', function(done) {
        let result = renderRaw(exampleSMCATErrSrc, 39258235, (data) => {
            (!!data).should.be.true();
            data.should.have.property('err');
            data.should.have.property('code');
            should(data.err).not.be.exactly(null);
            data.err.should.match(/syntax\s?error/si);
            // Currently state-machine-cat at node>=12.0 does not return an error code on syntax error...
            //data.code.should.be.above(0);
        }).then( (result) => {
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
            //should(data.err).be.exactly(null);
        }).then( (result) => {
            done();
        });

    });
});