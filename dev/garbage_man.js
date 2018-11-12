'use strict';

const	CouchConnection	= require( './couch.js' ),
		fs				= require( 'fs' ),
		childProc		= require( 'child_process' );

const	Seconds				= 1000,
		Minutes				= Seconds * 60,
		Hours				= Minutes * 60;

const	DEVMODE				= process.argv[ 2 ] === 'dev';

class GarbageMan {
	constructor() {
		Object.assign(this, {
			db:						new CouchConnection( 'dvgadminLocal', process.argv[ 2 ] === 'dev' ),
			clearBanTableInterval:	Hours * 1
		});

		this.clearBanTable();
	}

	async clearBanTable() {
		let now = new Date();

		if( now.getHours() === 2 ) {
			try {
				let result = await this.db.findAllBannedIPs();

				if( Array.isArray( result ) ) {
					for( let doc of result ) {
						const subproc = childProc.spawn( doc.origin.length > 15 ? 'ip6tables' : 'iptables', [ '-D', 'INPUT', '-s', doc.origin, '-j', 'DROP' ], { detached: true, stdio: 'ignore' } );
						subproc.unref();

						console.log( `${ doc.origin } has been released (iptables).` );

						try {
							let result = await this.db.removeBan( doc.origin );
						} catch( ex ) {
							console.log( `${ doc.origin } could not be removed in Database:`, ex );
						}
					}
				}
			} catch( ex ) {

			}
		}

		setTimeout( this.clearBanTable.bind( this ), this.clearBanTableInterval );
	}
}

new GarbageMan();
