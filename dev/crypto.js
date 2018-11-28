'use strict';

const	crypto = require( 'crypto' );

let Crypto = target => class extends target {
	constructor() {
		super( ...arguments );
	}

	async init() {
		super.init && await super.init( ...arguments );
	}

	getSalt() {
		return crypto.randomBytes( 16 ).toString( 'hex' );
	}

	createHash( pass, salt ) {
		if( typeof pass !== 'string' || typeof salt !== 'string' ) {
			throw new TypeError( 'Parameter pass and salt need to be of type String.' );
		}

		let hash = crypto.createHmac( 'sha512', salt );
			hash.update( pass );

		return {
			salt:		salt,
			hashedpass:	hash.digest( 'hex' )
		}
	}
}

module.exports = exports = Crypto;
