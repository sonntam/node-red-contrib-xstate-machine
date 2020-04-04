const gulp = require('gulp');
const path = require('path');
const del  = require('del');
const argv = require('minimist')(process.argv.slice(2));

const mergeStream = require('merge-stream');
var inlinesource  = require('gulp-inline-source');
var escape        = require('gulp-html-escape');
const fileinclude = require('gulp-file-include');
var rename        = require('gulp-rename');
var jsEscape      = require('gulp-js-escape');
const chmod       = require('gulp-chmod');
const minifyInl   = require('gulp-minify-inline');

// Gulp configuration
const cfg = {
	// Paths
	src: path.join(__dirname, 'src'),
	build: path.join(__dirname, 'dist'),
	tmp: path.join(__dirname, 'tmp'),

	testHtml: path.join(__dirname, 'tests/smxstate-help-viewer.html'),
	nodeHtml: path.join(__dirname, 'src/smxstate-node.html'),
	jsescape: path.join(__dirname, 'src/defaultStateMachine.js'),
	copyFiles: [path.join(__dirname, 'src/smxstate-node.js')],

	production: !!argv.production
};

gulp.task('copy', function () {
	var jsStream = gulp.src(cfg.copyFiles)
		.pipe(chmod(0o555))
		.pipe(gulp.dest(cfg.build));
	return mergeStream(jsStream);
});

gulp.task('build:jsescape', function () {
	return gulp.src(cfg.jsescape)
	.pipe(jsEscape())
	.pipe(rename( (path) => {
		path.extname = ".escape.js"
	}))
	.pipe(gulp.dest(cfg.tmp));
});

gulp.task('build:html', function () {
	let stream = gulp.src(cfg.nodeHtml)
	.pipe(inlinesource({compress: cfg.production, pretty: !cfg.production}))
	.pipe(fileinclude({ prefix: '!!!!', basepath: '@file'}));

	if( cfg.production )
		stream.pipe(minifyInl());

	return stream.pipe(chmod(0o555))
	.pipe(gulp.dest(cfg.build));
});

gulp.task('build:testhtml', function(cb) {
	if( cfg.production ) { console.log("Production build - doing nothing."); cb(); return; };
	return gulp.src(cfg.testHtml)
	.pipe(fileinclude({ prefix: '!!!!', basepath: '@file'}))
	.pipe(gulp.dest(cfg.tmp));
})

gulp.task('clean', function(cb) {
	return del('./dist/*.*', {
		"force": true
	}, cb);
});

gulp.task('build', gulp.series('clean', 'copy', 'build:jsescape', 'build:html', 'build:testhtml'));

