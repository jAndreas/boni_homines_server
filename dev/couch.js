'use strict';

const	nano			= require( 'nano' ),
		agentkeepalive	= require( 'agentkeepalive' ),
		fs				= require( 'fs' ),
		path			= require( 'path' );

const	{ extend, log }		= require( './toolkit.js' );

const	exampleTemplate	=		{
	firstName:			'',
	lastName:			'',
	nickName:			'',
	email:				'',
	pass:				'',
	confirmed:			false,
	confirmedUser:		false,
	isAdmin:			false,
	donator:			false,
	emailOptions:		{
		recvMailOnVideo:	true,
		recvMailOnArticle:	true,
		recvMailOnNews:		true
	},
	origin:				'',
	creationDate:		0,
	updateDate:			0
};

const	sessionCache		= Object.create( null );

let CouchConnection = target => class extends target {
	constructor( input = { } ) {
		super( ...arguments );

		extend( this ).with({
			couchUser:		'dvgadminLocal',
			databases:		[ 'example1', 'example2' ]
		}).and( input );
	}

	async init() {
		super.init && await super.init( ...arguments );

		let data;

		try {
			data = fs.readFileSync( path.resolve( `${ __dirname }/../couchdb/logins.json` ), 'utf-8' );
		} catch( ex ) {
			throw new Error( 'Error while reading ../couchdb/logins.json: ' + ex );
		}

		let users	= JSON.parse( data );

		if(!users[ this.couchUser ] ) {
			throw new Error( `${ this.couchUser } not found in logins.json` );
		}

		let performanceAgent	= new agentkeepalive({
			maxSockets:				50,
			maxKeepAliveRequests:	0,
			maxKeepAliveTime:		30000
		});

		this.couch = nano({
			url:				`http://${ users[ this.couchUser ].name }:${ users[ this.couchUser ].pass }@${ users[ this.couchUser ].server }:${ users[ this.couchUser ].port }`,
			requestDefaults:	{
				agent:	performanceAgent
			}
		});

		try {
			this.setupDatabaseLinks();
		} catch( ex ) {
			log( `Error while setting up CouchDB links: ${ ex.message }`, 'red' );
		}

		if( this.DEVMODE ) {
			log( 'CouchConnection is in DEVMODE.', 'yellow' );
		} else {
			log( 'CouchConnection is LIVE.', 'red' );
		}

		log( 'Connection to CouchDB was established.', 'green' );
	}

	setupDatabaseLinks() {
		if( Array.isArray( this.databases ) ) {
			this.databases.forEach( dbName => {
				this[ dbName ] = this.couch.db.use( this.DEVMODE ? dbName + '_dev' : dbName );
			});
		}
	}

	async findBanByIP( origin = '' ) {
		try {
			let couchData = await this.dvgbans.view( 'lookups', 'findBanByIP', { key: origin } );
			return couchData.rows.map( r => r.value || null );
		} catch( ex ) {
			throw ex;
		}
	}

	async findAllBannedIPs() {
		try {
			let couchData = await this.dvgbans.view( 'lookups', 'findAllBannedIPs' );
			return couchData.rows.map( r => r.value || null );
		} catch( ex ) {
			throw ex;
		}
	}

	async newBan( addr, duration ) {
		let uuid		= await this.getId(),
			banObj		= Object.assign({
				_id:			uuid
			}, banTemplate, {
				origin:			addr,
				creationDate:	Date.now()
			});

		try {
			let couchData = await this.dvgbans.insert( banObj );
			return couchData.ok;
		} catch( ex ) {
			console.error( 'newBan Error: ', ex );
			throw ex;
		}
	}

	async removeBan( addr ) {
		try {
			let result = await this.findBanByIP( addr );
			console.log( `findBanByIP (${ addr }) returned: `, result );

			if( Array.isArray( result ) && result.length ) {
				let couchData = await this.dvgbans.destroy( result[ 0 ]._id, result[ 0 ]._rev );
				console.log( `Removed ban ${ addr }, database ok: ${ couchData.ok }` );
				return couchData.ok;
			}
		} catch( ex ) {
			console.error( 'removeBan: ', ex );
			throw ex;
		}
	}

	/*async newPendingSubscriber( data = { } ) {
		let uuid		= await this.getId( 2 ),
			storageObj	= Object.assign({
				_id:			uuid[ 0 ]
			}, exampleTemplate, {
				email:			data.emailAddress,
				origin:			data.origin,
				secret:			uuid[ 1 ],
				creationDate:	Date.now(),
				updateDate:		Date.now()
			});

		try {
			let couchData = await this.dvgusers.insert( storageObj );
			console.log( 'New pending subscriber stored, ok: ', couchData.ok );

			return uuid[ 1 ];
		} catch( ex ) {
			console.error( 'newPendingSubscriber: ', ex );
			throw ex;
		}
	}*/

	async getId( max = 1 ) {
		let couchData = await this.couch.uuids( max );
		return couchData.uuids.length === 1 ? couchData.uuids[ 0 ] : couchData.uuids;
	}
};

module.exports = exports = CouchConnection;
