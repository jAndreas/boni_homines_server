'use strict';

const	socketio	= require( 'socket.io' )();

const	{ extend, Seconds }	= require( './toolkit.js' );

const	defaultPort		= 2000;

let ClientConnection = target => class extends target {
	constructor( input = { } ) {
		super( ...arguments );

		extend( this ).with({
			socket:	socketio.listen( input.port || defaultPort, {
						pingTimeout:		Seconds( 10 ),
						pingInterval:		Seconds( 30 ),
						transports:			[ 'websocket', 'polling' ]
					})
		}).and( input );
	}

	async init() {
		super.init && await super.init( ...arguments );
	}
};

module.exports = exports = ClientConnection;
