'use strict';

class ToolKit {
	constructor() {
	}

	cmpArray( a, b ) {
		if( !Array.isArray( a ) || !Array.isArray( b ) ) {
			return false;
		}

		if( a.length !== b.length )
			return false;

		let len = a.length;

		while( len-- ) {
			if( Array.isArray( a[ len ] ) && Array.isArray( b[ len ] ) ) {
				if( this.cmpArray( a[ len ], b[ len ] ) === false ) {
					return false;
				}
			} else if( a[ len ] !== b[ len ] ) {
				return false;
			}
		}

		return true;
	}

	timeout( ms = 200 ) {
		return new Promise(( res, rej ) => {
			setTimeout( res, ms );
		});
	}
}

exports = module.exports = ToolKit;
