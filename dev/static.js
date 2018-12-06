'use strict';

const	PuppeTeer	= require( 'puppeteer' ),
		fs			= require( 'fs' );

const	{ extend, log }		= require( './toolkit.js' );

let Static = target => class extends target {
	constructor( input = { } ) {
		super( ...arguments );

		extend( this ).with({
		}).and( input );
	}

	async init() {
		super.init && await super.init( ...arguments );

		/*console.log( `Generating landing pages and other pre-rendered static data...\n-----\n` );
		await this.createIndexPage();
		await this.unlinkAllStaticContent();
		await this.createStaticIndexPage();
		console.log( `\n-----\nDone! Launching Server...\n` );*/
	}

	async unlinkAllStaticContent() {
		console.log( `Removing static content data at: ${ this.staticRootPath }...` );
		fs.removeSync( this.staticRootPath );
	}

	async createIndexPage() {
		let indexBluePrintPath		= path.resolve( `${ __dirname }/../blueprints/webrootIndex.html` ),
			indexTarget				= `${ this.baseRootPath }/index.html`,
			bpContent;

		try {
			bpContent		= await readFile( indexBluePrintPath, 'utf8' );

			// do stuff

			bpContent = this.parse( bpContent ).with({
				uri:			this.uri,
				build:			Date.now()
			});

			await writeFile( indexTarget, bpContent );
			console.log( `${ indexTarget } was updated successfully.` );
		} catch( ex ) {

		}
	}

	async createStaticIndexPage() {
		let lptarget	= `${ this.staticRootPath }/index.html`;

		console.group( 'createStaticIndexPage' );
		console.log( `Writing down static version of ${ this.uri }...` );

		let browser				= await PuppeTeer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] }),
			browserPage			= await browser.newPage();

		try {
			/*browserPage.on('console', msg => {
				if( /trace|groupEnd/.test( msg.text() ) ) {
					return;
				}
				console.log( `\t => Chrome: ${ msg.text() }` )
			});*/

			await browserPage.goto(`${ this.uri }/#ref=SupportSection`, {
				waitUntil:	[ 'domcontentloaded', 'networkidle0' ],
				timeout:	5000
			});

			await browserPage.waitForSelector( 'div.supportSection', { timeout: 7000 });

			await browserPage.$$eval('script', scripts => Array.from( scripts ).forEach( scr => scr.remove() ) );
			await browserPage.$$eval('div.BFModalOverlay', overlays => Array.from( overlays ).forEach( ovl => ovl.remove() ) );

			let pageContent	= await browserPage.content();

			await browser.close();
			console.groupEnd('createStaticIndexPage');

			mkdirSync( `${ this.staticRootPath }` );

			await writeFile( lptarget, pageContent );
		} catch( ex ) {
			await browser.close();
			console.groupEnd('createStaticIndexPage');
			console.error( ex.message );
			return;
		}
	}

	async createStaticFile({ outputFileName = '', url = '', waitFor = '' }) {
		let lptarget	= `${ this.staticRootPath }/${ outputFileName }`;

		console.group( 'createStaticFile' );
		console.log( `Writing down static version of ${ url }...` );

		let browser				= await PuppeTeer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] }),
			browserPage			= await browser.newPage();

		try {
			/*browserPage.on('console', msg => {
				if( /trace|groupEnd/.test( msg.text() ) ) {
					return;
				}
				console.log( `\t => Chrome: ${ msg.text() }` )
			});*/

			await browserPage.goto(`${ url }`, {
				waitUntil:	[ 'domcontentloaded', 'networkidle0' ],
				timeout:	5000
			});

			await browserPage.waitForSelector( waitFor, { timeout: 7000 });

			let pageContent	= await browserPage.content();

			await browser.close();
			console.groupEnd( 'createStaticIndexPage' );

			mkdirSync( `${ this.staticRootPath }` );

			await writeFile( lptarget, pageContent );
		} catch( ex ) {
			await browser.close();
			console.groupEnd('createStaticIndexPage');
			console.error( ex.message );
			return;
		}
	}
}

module.exports = exports = Static;
