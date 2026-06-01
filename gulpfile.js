import gulp from 'gulp';
import pug from 'gulp-pug';
import gulpSass from 'gulp-sass';
import * as dartSass from 'sass';
import postcss from 'gulp-postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import plumber from 'gulp-plumber';
import notify from 'gulp-notify';
import rename from 'gulp-rename';
import gulpIf from 'gulp-if';
import sourcemaps from 'gulp-sourcemaps';
import size from 'gulp-size';
import replace from 'gulp-replace';
import cache from 'gulp-cache';
import browserSyncPkg from 'browser-sync';
import { deleteAsync } from 'del';
import * as esbuild from 'esbuild';
import imagemin from 'gulp-imagemin';
import webp from 'gulp-webp';
import svgSprite from 'gulp-svg-sprite';
import newer from 'gulp-newer';

const sass = gulpSass(dartSass);
const bs = browserSyncPkg.create();
const isProd = process.env.NODE_ENV === 'production';

const VERSION = Date.now().toString(36);

const onError = (taskName) => ({
    errorHandler: notify.onError({
        title: `Ошибка в ${taskName}`,
        message: '<%= error.message %>',
        sound: false,
    }),
});

const paths = {
    src:  'src',
    dist: 'dist',
    pug:   { entry: 'src/pug/index.pug',    watch: 'src/pug/**/*.pug',   dest: 'dist' },
    scss:  { entry: 'src/scss/main.scss',   watch: 'src/scss/**/*.scss', dest: 'dist/css' },
    js:    { entry: 'src/js/main.js',       watch: 'src/js/**/*.js',     dest: 'dist/js' },
    img:   { src: 'src/img/**/*.{jpg,jpeg,png,gif,svg}', dest: 'dist/img' },
    webp:  { src: 'src/img/**/*.{jpg,jpeg,png}',         dest: 'dist/img' },
    icons: { src: 'src/icons/*.svg',  dest: 'src/pug/blocks' },
    fonts: { src: 'src/fonts/**/*.{woff,woff2}',         dest: 'dist/fonts' },
};

export const clean = () => deleteAsync([paths.dist]);

export const sprite = () =>
    gulp.src(paths.icons.src, { allowEmpty: true })
        .pipe(plumber(onError('sprite')))
        .pipe(svgSprite({
            mode: {
                symbol: {
                    sprite: '_sprite.svg',
                    inline: true,
                    example: false,
                },
            },
            shape: {
                id: { generator: 'i-%s' },
                transform: [
                    { svgo: { plugins: [{ name: 'removeAttrs', params: { attrs: '(fill|stroke)' } }] } },
                ],
            },
        }))
        .pipe(gulp.dest(paths.icons.dest));

export const html = () =>
    gulp.src(paths.pug.entry)
        .pipe(plumber(onError('pug')))
        .pipe(pug({ pretty: !isProd }))
        .pipe(gulpIf(isProd, replace(/(\.(?:css|js))(")/g, `$1?v=${VERSION}$2`)))
        .pipe(size({ title: 'HTML', showFiles: true }))
        .pipe(gulp.dest(paths.pug.dest))
        .pipe(bs.stream());

export const styles = () =>
    gulp.src(paths.scss.entry)
        .pipe(plumber(onError('scss')))
        .pipe(gulpIf(!isProd, sourcemaps.init()))
        .pipe(sass.sync({ outputStyle: 'expanded' }))
        .pipe(postcss([
            autoprefixer(),
            ...(isProd ? [cssnano({ preset: ['default', { discardComments: { removeAll: true } }] })] : []),
        ]))
        .pipe(gulpIf(isProd, rename({ suffix: '.min' })))
        .pipe(gulpIf(!isProd, sourcemaps.write('.')))
        .pipe(size({ title: 'CSS', showFiles: true }))
        .pipe(gulp.dest(paths.scss.dest))
        .pipe(bs.stream());

export const scripts = async () => {
    try {
        const result = await esbuild.build({
            entryPoints: [paths.js.entry],
            bundle: true,
            minify: isProd,
            sourcemap: !isProd,
            target: ['es2020'],
            format: 'iife',
            legalComments: 'none',
            outfile: `${paths.js.dest}/main${isProd ? '.min' : ''}.js`,
            metafile: true,
        });
        const bytes = Object.values(result.metafile.outputs)
            .reduce((acc, o) => acc + o.bytes, 0);
        console.log(`JS:   main.js ${(bytes / 1024).toFixed(2)} KB`);
        bs.reload();
    } catch (err) {
        notify.onError({ title: 'Ошибка в JS', message: err.message })(err);
    }
};

export const images = () =>
    gulp.src(paths.img.src, { encoding: false, allowEmpty: true })
        .pipe(plumber(onError('images')))
        .pipe(newer(paths.img.dest))
        .pipe(gulpIf(isProd, cache(imagemin([], { verbose: false }))))
        .pipe(size({ title: 'IMG' }))
        .pipe(gulp.dest(paths.img.dest));

export const webpImages = () =>
    gulp.src(paths.webp.src, { encoding: false, allowEmpty: true })
        .pipe(plumber(onError('webp')))
        .pipe(newer({ dest: paths.webp.dest, ext: '.webp' }))
        .pipe(webp({ quality: 85 }))
        .pipe(gulp.dest(paths.webp.dest));

export const fonts = () =>
    gulp.src(paths.fonts.src, { encoding: false, allowEmpty: true })
        .pipe(newer(paths.fonts.dest))
        .pipe(gulp.dest(paths.fonts.dest));

export const clearCache = () => cache.clearAll();

export const serve = () => {
    bs.init({
        server: { baseDir: paths.dist },
        port: 3000,
        open: 'local',
        notify: false,
        ghostMode: false,
    });

    gulp.watch(paths.icons.src, gulp.series(sprite, html));
    gulp.watch(paths.pug.watch,  html);
    gulp.watch(paths.scss.watch, styles);
    gulp.watch(paths.js.watch,   scripts);
    gulp.watch(paths.img.src,    gulp.parallel(images, webpImages));
    gulp.watch(paths.fonts.src,  fonts);
};

const build = gulp.series(
    clean,
    sprite,
    gulp.parallel(html, styles, scripts, images, webpImages, fonts),
);

const dev = gulp.series(build, serve);

export { build, dev };
export default dev;
