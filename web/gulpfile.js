var gulp = require('gulp');
var path = require('path');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var manifest = require('gulp-appcache');
var streamqueue = require('streamqueue');
var es = require('event-stream');
var clean = require('gulp-clean');
var runSequence = require('run-sequence');
var inject = require("gulp-inject");
var htmlreplace = require('gulp-html-replace');
var replace = require('gulp-replace');
var less = require('gulp-less');
var sourcemaps = require('gulp-sourcemaps');
var minifyCSS = require('gulp-minify-css');
var gulpFilter = require('gulp-filter');
var insert = require('gulp-insert');
var gzip = require('gulp-gzip');
var karma = require('karma').server;

var fs = require('fs');

function getIpAddress() {
    var os = require('os');
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
        var details = ifaces[dev];
        for (var i = 0; i < details.length; i++) {
            var detail = details[i];
            if (detail.family == 'IPv4') {
                if (dev == "eth0" || dev == "wlan0") {
                    return detail.address;
                }
            }
        }
        ;
    }
}

var init = fs.readFileSync("js/util/init.js", 'utf8');

var local_compiled = "if (typeof importScripts !== 'function') {\n\
    tutao.env = new tutao.Environment(tutao.Env.LOCAL_COMPILED, false, '" + getIpAddress() + "', 9000);\n\
    tutao.tutanota.Bootstrap.init();\n\
}\n";

var dev = "if (typeof importScripts !== 'function') {\n\
    tutao.env = new tutao.Environment(tutao.Env.DEV, true, 'tutao.tutanota.de', 9025);\n\
    tutao.tutanota.Bootstrap.init();\n\
}\n";

var test = "if (typeof importScripts !== 'function') {\n\
    tutao.env = new tutao.Environment(tutao.Env.TEST, true, 'test.tutanota.de', null);\n\
    tutao.tutanota.Bootstrap.init();\n\
}\n";

var prod = "if (typeof importScripts !== 'function') {\n\
    tutao.env = new tutao.Environment(tutao.Env.PROD, true, 'tutanota.de', null);\n\
    tutao.tutanota.Bootstrap.init();\n\
}\n";

var env = local_compiled;

gulp.task('clean', function () {
    return gulp.src(["build/*"], {read: false})
        .pipe(clean({force: true}));

});

gulp.task('minify', function () {
    return streamqueue({ objectMode: true },
        gulp.src("lib/*.js")
            .pipe(sourcemaps.init())
            .pipe(concat('lib.js'))
            .pipe(insert.prepend("if (typeof importScripts !== 'function') {"))
            .pipe(insert.append("}"))
            .pipe(uglify()),

        gulp.src("lib/worker/*.js")
            .pipe(sourcemaps.init())
            .pipe(concat('lib.js'))
            .pipe(uglify()),

        gulp.src('js/generated/entity/tutanota/**/*.js')
            .pipe(sourcemaps.init())
            .pipe(concat('gen1.js'))
            .pipe(replace("\"use strict\";", ""))
            .pipe(insert.prepend("\"use strict\";"))
            .pipe(uglify()),

        gulp.src('js/generated/entity/sys/**/*.js')
            .pipe(sourcemaps.init())
            .pipe(concat('gen2.js'))
            .pipe(replace("\"use strict\";", ""))
            .pipe(uglify()),

        gulp.src(['js/generated/entity/base/**/*.js'])
            .pipe(sourcemaps.init())
            .pipe(concat('gen3.js'))
            .pipe(replace("\"use strict\";", ""))
            .pipe(uglify()),

        gulp.src(['js/**/*.js', '!js/generated/entity/**', '!js/util/init.js'])
            .pipe(sourcemaps.init())
            .pipe(concat('js.js'))
            .pipe(replace("\"use strict\";", ""))
            .pipe(uglify()))
    .pipe(concat("app.min.js"))
        .pipe(insert.append(env))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('build/'));
});

gulp.task('concat', function () {
    return streamqueue({ objectMode: true },
        gulp.src("lib/worker/*.js")
            .pipe(concat('workerLib.js')),

        gulp.src(['lib/*.js'])
            .pipe(concat("lib.js"))
            .pipe(insert.prepend("if (typeof importScripts !== 'function') {\n"))
            .pipe(insert.append("}\n")),


        gulp.src(['js/**/*.js', "!js/util/init.js"])
            .pipe(concat("app.js"))
    ).pipe(concat("app.min.js"))
        .pipe(insert.append(env))
        .pipe(gulp.dest('build/'));
});

gulp.task('concatTest', function () {
    return streamqueue({ objectMode: true },
        gulp.src("lib/worker/*.js")
            .pipe(concat('workerLib.js')),

        gulp.src(['lib/*.js', 'test/lib/*.js'])
            .pipe(concat("lib.js"))
            .pipe(insert.prepend("if (typeof importScripts !== 'function') {\n"))
            .pipe(insert.append("\nmocha.setup('bdd');\n"))
            .pipe(insert.append("}\n")),


        gulp.src(['js/**/*.js', "!js/util/init.js", "!js/Bootstrap.js"])
            .pipe(concat("app.js")),

        gulp.src(['test/js/rest/EntityRestTestFunctions.js', 'test/js/**/*.js'])
            .pipe(concat("test.js"))
            .pipe(insert.prepend("if (typeof importScripts !== 'function') {\n"))
            .pipe(insert.append("}\n"))
            .pipe(insert.append(env))

    ).pipe(concat("app.min.js"))
        .pipe(gulp.dest('build/test/'));
});

gulp.task('index.html', function () {
    return gulp.src('./index.html')
        .pipe(inject(gulp.src(['lib/**/*.js', "js/**/*.js", "!js/util/init.js"], {read: false})))
        .pipe(gulp.dest('./'));
});

gulp.task('test.html', function () {
    return gulp.src('./test/index.html')
        .pipe(inject(gulp.src([ 'lib/**/*.js', 'test/lib/*.js'], {read: false}), {starttag: '<!-- inject:lib:{{ext}} -->'}))
        .pipe(inject(gulp.src([
            'js/**/*.js', "!js/util/init.js", "!js/Bootstrap.js",
            'test/js/rest/EntityRestTestFunctions.js', 'test/js/**/*.js'
        ], {read: false})))
        .pipe(gulp.dest('./test'));
});

gulp.task('processHtml', function () {
    return gulp.src('./index.html')
        .pipe(htmlreplace({
            'css': 'css/main.css',
            'js': ['cordova.js', 'app.min.js']
        }))
        .pipe(gulp.dest('./build'));
});

gulp.task('processTestHtml', function () {
    return gulp.src('./test/index.html')
        .pipe(htmlreplace({
            'js': ['app.min.js']
        }))
        .pipe(gulp.dest('./build/test'));
});

gulp.task('less', function () {
    return gulp.src('less/main.less')
        //.pipe(sourcemaps.init())
        .pipe(less())
        .pipe(minifyCSS())
        //.pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('./build/css/'));
});

gulp.task('copy', function () {
    return streamqueue({ objectMode: true },
        gulp.src('fonts/*')
            .pipe(gulpFilter(['icomoon.*']))
            .pipe(gulp.dest('./build/fonts')),
        gulp.src('graphics/**/*')
            .pipe(gulp.dest('./build/graphics'))
    );
});

gulp.task('manifest', function () {
    return gulp.src(['./build/**/*', '!build/fonts/icomoon.+(eot|svg|ttf)', '!build/*.map', "!build/test/**"])
        .pipe(manifest({
            timestamp: true,
            network: ['*'],
            filename: 'tutanota.appcache',
            exclude: ['build/tutanota.appcache']
        }))
        .pipe(gulp.dest('build'));
});

gulp.task('test', function(done) {
    karma.start({configFile: path.resolve('test/karma-ci.conf.js')}, function (error) {
        done(error);
    });
});

gulp.task('gzip', function () {
    return gulp.src(['./build/*', '!./build/*.map'])
        .pipe(gzip())
        .pipe(gulp.dest('build'));
});

gulp.task('dist', ['clean'], function (cb) {
    // does not minify and is therefore faster
    env = local_compiled;
    return runSequence(['copy', 'less', 'concat', 'processHtml', 'concatTest', 'processTestHtml'], 'manifest', cb); // 'gzip'
});

function dist(cb) {
    return runSequence(['copy', 'less', 'minify', 'processHtml'], 'manifest', 'gzip', cb);
}

gulp.task('distLocal', ['clean'], function (cb) {
    env = local_compiled;
    return dist(cb);
});

gulp.task('distDev', ['clean'], function (cb) {
    env = dev;
    return dist(cb);
});

gulp.task('distTest', ['clean'], function (cb) {
    env = test;
    return dist(cb);
});

gulp.task('distProd', ['clean'], function (cb) {
    env = prod;
    return dist(cb);
});