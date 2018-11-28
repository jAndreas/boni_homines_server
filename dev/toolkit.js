'use strict';

const	fs			= require( 'fs-extra' ),
		util		= require( 'util' );

const	type		= input => Object.prototype.toString.call( input ).split( /\s/ )[ 1 ].slice( 0, -1 ),
		desc		= Object.getOwnPropertyDescriptor,
		defineProp	= Object.defineProperty,
		props		= Object.getOwnPropertyNames,
		getProto	= Object.getPrototypeOf,
		setProto	= Object.setPrototypeOf,
		slice		= Array.prototype.slice;

const	undef		= void 0,
		Seconds		= x => x * 1000,
		Minutes		= x => x * Seconds( 1 ) * 60,
		Hours		= x => x * Minutes( 1 ) * 60;

const	readDir		= util.promisify( fs.readdir ),
		readFile	= util.promisify( fs.readFile ),
		writeFile	= util.promisify( fs.writeFile );

const	colors		= {
	red:		'\x1b[31m',
	black:		'\x1b[30m',
	green:		'\x1b[32m',
	yellow:		'\x1b[33m',
	blue:		'\x1b[34m',
	purple:		'\x1b[35m',
	white:		'\x1b[37m',
	esc:		'\x1b[0m'
};

/*****************************************************************************************************
 * mix() should be used to augment an already existing class with multiple mixin-classes
 * It can also be used to extend a class at declaration, therefore it will create a anonymous
 * default class if none was passed.
 *****************************************************************************************************/
function Mix( TargetClass = class { } ) {
	let ComposedClass;

	return {
		With: function( ...sources ) {
			ComposedClass = sources.reduce( ( Composition, MixinFnc ) => MixinFnc( Composition ), TargetClass );
			return ComposedClass;
		}
	};
}

/*****************************************************************************************************
 * Composition() should be exclusively used, to extend a class with mixins at declaration.
 * This is just sugar to not to be forced to call mix().with() with empty arguments.
 *****************************************************************************************************/
function Composition( ...sources ) {
	return sources.reduce( ( Composition, MixinFnc ) => MixinFnc( Composition ), class { } );
}

/*****************************************************************************************************
 * MakeClass() should be used if there is no class to augment, but you still want to
 * use some features from mixin-functions. It will create+instantiate an anonymous class if nothing
 * was passed in and returns the option to directly mixin() stuff.
 *****************************************************************************************************/
function MakeClass( cls, args = { } ) {
	let	ComposedClass;

	return {
		Mixin: function( ...sources ) {
			ComposedClass = sources.reduce( ( Composition, MixinFnc ) => MixinFnc( Composition ), cls || class { } );
			return new ComposedClass( args );
		}
	};
}

function extend( target = { } ) {
	let actions = {
		'with': ( source = { }, DeepCloneFreeze ) => {
			let propList	= props( source ),
				len			= propList.length;

			while( len-- ) {
				loopKeys( propList[ len ] );
			}

			return actions;

			// -- locals --
			function loopKeys( key ) {
				if( typeof source[ key ] === 'object' && source[ key ] !== null && DeepCloneFreeze ) {
					if( Array.isArray( source[ key ] ) ) {
						if( Array.isArray( target[ key ] ) ) {
							target[ key ] = [ ...target[ key ], ...source[ key ] ];
							return;
						} else {
							target[ key ] = [ ];
						}
					} else {
						if( typeof target[ key ] === 'undefined' ) {
							target[ key ] = Object.create( null );
							setProto( target[ key ], getProto( source[ key ] ) );
						}
					}

					extend( target[ key ] ).with( source[ key ], DeepCloneFreeze );
				} else {
					defineProp( target, key, desc( source, key ) );
				}
			}
		},
		'get': function() {
			return target;
		}
	};

	actions.and = actions.with;

	return actions;
}

/*****************************************************************************************************
 * cmpArray() deep compares a js array structure
 *****************************************************************************************************/
function cmpArray( a, b ) {
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

/*****************************************************************************************************
 * timeout() creates a promisified timeout
 *****************************************************************************************************/
function timeout( ms = 200 ) {
	return new Promise(( res, rej ) => {
		setTimeout( res, ms );
	});
}

function mkdirSync( path ) {
	try {
		fs.mkdirSync( path );
	} catch (err) {
		if (err.code !== 'EEXIST') throw err
	}
}

function log( str = '', color = 'white', extra = '' ) {
	console.log( `${ colors[ color ]}${ str }${ colors.esc }${ extra }` );
}

exports = module.exports = { cmpArray, timeout, undef, type, Mix, extend, Composition, MakeClass, Seconds, Minutes, Hours, readDir, readFile, writeFile, mkdirSync, log };
