'use strict';

const	childProc					= require( 'child_process' );

const	{ Seconds, Minutes, Hours, extend }	= require( './toolkit.js' );

const	clientPackageData	= Object.create( null ),
		config				= [
			//	[ timeFrame (ms), numberOfPackets, banTime (ms) ]
			//	if there are <numberOfPackets> within the last <timeFrame> sent from Client, ban for <banTime>
			[ Seconds( 1 ), 4, Minutes( 5 ) ],
			[ Seconds( 10 ), 10, Minutes( 2 ) ]
		];

let DDoSControl = target => class extends target {
	constructor( input = { } ) {
		super( ...arguments );

		extend( this ).with({
			ignoredPackets:		new Map()
		}).and( input );
	}

	async init() {
		super.init && await super.init( ...arguments );

		this.socket.on( 'connection', this.newConnection.bind( this ) );
	}

	newConnection( client ) {
		client.clientIPAddress		= client.request.headers[ 'x-forwarded-for' ] || client.conn.transport.socket._socket.remoteAddress;

		if( /bot|google|bing|msn|duckduckbot|slurp|headlesschrome/i.test( client.handshake.headers[ 'user-agent' ] ) === false ) {
			if( typeof clientPackageData[ client.id ] === 'undefined' ) {
				clientPackageData[ client.id ] = [ ];
			}
		} else {
			console.log( `\n\t [-] Incoming connection from an identified bot or crawler, skipping DDoSControl for ${ client.clientIPAddress }\nUser-Agent: ${ client.handshake.headers[ 'user-agent' ] }` );
		}

		client.use( this.checkIncomingPackage.bind( this, client ) );
		client.on( 'disconnect', this.closeConnection.bind( this, client ) );
	}

	async closeConnection( client, reason ) {
		delete clientPackageData[ client.id ];
	}

	checkIncomingPackage( client, packet, next ) {
		this.DEVMODE && console.log( 'Incoming packet ===> ', packet[ 0 ], ' from: ', client.clientIPAddress );

		if( this.ignoredPackets.has( packet[ 0 ] ) ) {
			this.DEVMODE && console.log( 'Ignoring DDoSControl for ', packet[ 0 ] );
			next();return;
		}

		if( client.id in clientPackageData ) {
			clientPackageData[ client.id ].push({
				packet:		packet[ 0 ],
				time:		Date.now()
			});

			if( clientPackageData[ client.id ].length > 100 ) {
				clientPackageData[ client.id ].shift();
			}

			let now = Date.now();

			for( let [ timeFrame, numberOfPackets, banTime ] of config ) {
				if( clientPackageData[ client.id ].filter( conn => now - conn.time < timeFrame ).length > numberOfPackets ) {
					console.log( `Suspicious connection behaviour. Blocking ${ client.clientIPAddress } for ${ banTime / 1000 / 60 } Minutes.` );
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
			let result = await this.newBan( addr, duration );
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
			let result = await this.removeBan( addr );
		} catch( ex ) {
			console.log( `${ addr } could not be removed in Database:`, ex );
		}
	}
}

module.exports = exports = DDoSControl;
