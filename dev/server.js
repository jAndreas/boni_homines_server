'use strict';

const	socketio		= require( 'socket.io' )(),
		CouchConnection	= require( './couch.js' ),
		MailService		= require( './mailservice.js' ),
		Crypto			= require( './crypto.js' ),
		PuppeTeer		= require( 'puppeteer' ),
		ToolKit			= require( './toolkit.js' ),
		stripHTML		= require( 'sanitize-html' ),
		util			= require( 'util' ),
		fs				= require( 'fs-extra' ),
		path			= require( 'path' ),
		childProc		= require( 'child_process' );

const	Seconds				= 1000,
		Minutes				= Seconds * 60,
		Hours				= Minutes * 60;

const	DDoSControl			= Object.create( null ),
		DDoSConfig			= [
			//	[ timeFrame (ms), numberOfPackets, banTime (ms) ]
			//	if there are <numberOfPackets> within the last <timeFrame> sent from Client, ban for <banTime>
			[ Seconds * 1, 4, Minutes * 5 ],
			[ Seconds * 10, 10, Minutes * 2 ]
		],
		DEVMODE				= process.argv[ 2 ] === 'dev';

const	readDir				= util.promisify( fs.readdir ),
		readFile			= util.promisify( fs.readFile ),
		writeFile			= util.promisify( fs.writeFile );

class Server {
	constructor( name = 'Default', port = 2000 ) {
		Object.assign(this, {
			db:						new CouchConnection( 'dvgadminLocal', DEVMODE ),
			mailService:			new MailService( 'local', DEVMODE ),
			crypto:					new Crypto(),
			tools:					new ToolKit(),
			io:						socketio.listen( port, {
										pingTimeout:		Seconds * 10,
										pingInterval:		Seconds * 30,
										transports:			[ 'websocket', 'polling' ]
									}),
			uri:					DEVMODE ? 'https://dev.example.de' : 'https://www.example.de',
			baseRootPath:			DEVMODE ? '/var/www/html/dev.example.de' : '/var/www/html/example.de',
			staticRootPath:			DEVMODE ? '/var/www/html/dev.example.de/static' : '/var/www/html/example.de/static',
			imageRootPath:			DEVMODE ? '/var/www/html/dev.example.de/images' : '/var/www/html/example.de/images',
			ignoredPackets:			new Map();
		});

		//this.ignoredPackets.set( '???', true );

		(async () => {
			console.log( `Server ${ name } is listening on port ${ port }.\n` );
			console.log( `Server is ready and waiting for incoming connections...\n-----` );
			this.io.on( 'connection', this.newConnection.bind( this ) );

			/*console.log( `Generating landing pages and other pre-rendered static data...\n-----\n` );
			await this.createIndexPage();
			await this.unlinkAllStaticContent();
			await this.createStaticPage();
			console.log( `\n-----\nDone! Launching Server...\n` );*/

			process.on( 'SIGINT', this.onProcessExit.bind( this ) );
			process.on( 'uncaughtException', this.onProcessExit.bind( this ) );
			process.on( 'SIGTERM', this.onProcessExit.bind( this ) );
		})();
	}

	newConnection( client ) {
		client.clientIPAddress		= client.request.headers[ 'x-forwarded-for' ] || client.conn.transport.socket._socket.remoteAddress;

		if( /bot|google|bing|msn|duckduckbot|slurp|headlesschrome/i.test( client.handshake.headers[ 'user-agent' ] ) === false ) {
			if( typeof DDoSControl[ client.id ] === 'undefined' ) {
				DDoSControl[ client.id ] = [ ];
			}
		} else {
			console.log( `\n\t [-] Incoming connection from an identified bot or crawler, skipping DDoSControl for ${ client.clientIPAddress }\nUser-Agend: ${ client.handshake.headers[ 'user-agent' ] }` );
		}

		client.use( this.DDoSCheck.bind( this, client ) );
		client.on( 'disconnect', this.closeConnection.bind( this, client ) );
	}

	async closeConnection( client, reason ) {
		delete DDoSControl[ client.id ];
		console.log( `Closed connection from: ${ client.clientIPAddress } (${ client.id }), reason: ${ reason }` );

		client = null;
	}

	DDoSCheck( client, packet, next ) {
		DEVMODE && console.log( 'Incoming packet ===> ', packet[ 0 ], ' from: ', client.clientIPAddress );

		if( this.ignoredPackets.has( packet[ 0 ] ) ) {
			DEVMODE && console.log( 'Ignoring DDoSControl for ', packet[ 0 ] );
			next();return;
		}

		if( client.id in DDoSControl ) {
			DDoSControl[ client.id ].push({
				packet:		packet[ 0 ],
				time:		Date.now()
			});

			if( DDoSControl[ client.id ].length > 100 ) {
				DDoSControl[ client.id ].shift();
			}

			let now = Date.now();

			for( let [ timeFrame, numberOfPackets, banTime ] of DDoSConfig ) {
				if( DDoSControl[ client.id ].filter( conn => now - conn.time < timeFrame ).length > numberOfPackets ) {
					console.log( `Suspicious connection behaviour. Blocking ${ client.clientIPAddress } for ${ banTime / 1000 / 60 } Minutess.` );
					this.banIP( client.clientIPAddress, banTime );
				}
			}
		}

		next();
	}

	async banIP( addr, duration ) {
		const subproc = childProc.spawn( addr.length > 15 ? 'ip6tables' : 'iptables', [ '-I', 'INPUT', '-s', addr, '-j', 'DROP' ], { detached: true, stdio: 'ignore' } );
		subproc.unref();

		console.log( `${ addr } has been banned.` );

		try {
			let result = await this.db.newBan( addr, duration );
		} catch( ex ) {
			console.log( `${ addr } could not be stored in Database:`, ex );
		}

		this.adminNotification( 'IP Ban', `${ addr } was banned for ${ duration / 1000 / 60 } Minutess by DDoSControl.` );

		setTimeout( this.unbanIP.bind( this, addr ), duration );
	}

	async unbanIP( addr ) {
		const subproc = childProc.spawn( addr.length > 15 ? 'ip6tables' : 'iptables', [ '-D', 'INPUT', '-s', addr, '-j', 'DROP' ], { detached: true, stdio: 'ignore' } );
		subproc.unref();

		console.log( `${ addr } has been released.` );

		try {
			let result = await this.db.removeBan( addr );
		} catch( ex ) {
			console.log( `${ addr } could not be removed in Database:`, ex );
		}
	}

	async adminNotification( subject = `admin notification [${ this.uri }]`, content = '' ) {
		let mailStatus = await this.mailService.sendMail({
			toList:		'admin@example.de',
			subject:	subject,
			text:		stripHTML( content, { allowedTags: [ ] } ),
			html:		content.replace( /\n/g, '<br/>' )
		});

		console.log( 'Admin Notification: ', subject, content );
	}

	mkdirSync( path ) {
		try {
			fs.mkdirSync( path );
		} catch (err) {
			if (err.code !== 'EEXIST') throw err
		}
	}

	//////////////////////////////////////////////////

	async onProcessExit() {
		DEVMODE && console.log('Processing & storing in-memory data while exiting server process...');

		DEVMODE && console.log('done');
		process.exit();
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

			bpContent = this.mailService.parse( bpContent ).with({
				uri:			this.uri,
				build:			Date.now()
			});

			await writeFile( indexTarget, bpContent );
			console.log( `${ indexTarget } was updated successfully.` );
		} catch( ex ) {

		}
	}

	async createStaticPage() {
		let lptarget	= `${ this.staticRootPath }/index.html`;

		console.group('createStaticPage');
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
				waitUntil:	[ 'domcontentloaded', 'networkidle0' ]
			});

			await browserPage.waitForSelector( 'div.supportSection', { timeout: 7000 });

			await browserPage.$$eval('script', scripts => Array.from( scripts ).forEach( scr => scr.remove() ) );
			await browserPage.$$eval('div.BFModalOverlay', overlays => Array.from( overlays ).forEach( ovl => ovl.remove() ) );

			let pageContent	= await browserPage.content();

			await browser.close();
			console.groupEnd('createStaticPage');

			this.mkdirSync( `${ this.staticRootPath }` );

			await writeFile( lptarget, pageContent );
		} catch( ex ) {
			await browser.close();
			console.groupEnd('createStaticPage');
			console.error( ex.message );
			return;
		}
	}



	async onExample( client, payload, answer ) {
		try {
			answer(this.message({
				msg: 'onExample Message return'
			}));

			this.io.emit( 'exampleBroadcastToAllClients', {
				user:	user.nickName,
				email:	user.email
			});
		} catch( ex ) {
			console.log( 'onExample:', ex );

			answer(this.message({
				error:	'Es ist ein unbekannter Fehler aufgetreten.',
				code:	0xa2
			}));
		}
	}

	message( info ) {
		return Object.assign({
			data:		{ },
			msg:		'',
			error:		'',
			errorCode:	0,
			warning:	''
		}, info );
	}
}

if( DEVMODE ) {
	console.log('DEV MODE SERVER');
	new Server( 'BONIHOMINES', 3230 );
} else {
	console.log('PROD MODE SERVER, WE ARE LIVE BOYS');
	new Server( 'BONIHOMINES', 3229 );
}
