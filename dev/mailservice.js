'use strict';

const	nodemailer	= require( 'nodemailer' ),
		fs			= require( 'fs' ),
		path		= require( 'path' );

const	{ extend, log }	= require( './toolkit.js' );

const	senderAddress	= 'andreas@example.de';

let MailService = target => class extends target {
	constructor( input = { } ) {
		super( ...arguments );

		extend( this ).with({
			mailHostName: 'local'
		}).and( input );
	}

	async init() {
		super.init && await super.init( ...arguments );

		if( this.DEVMODE ) {
			log( 'MailService is in DEVMODE.', 'yellow' );
		} else {
			log( 'MailService is LIVE.', 'red' );
		}

		let data, hosts;

		try {
			data	= fs.readFileSync( path.resolve( `${ __dirname }/../mailservice/hosts.json` ), 'utf-8' );
			hosts	= JSON.parse( data );
		} catch( ex ) {
			throw new Error( 'Error while reading ../mailservice/hosts.json: ' + ex );
		}

		if( !hosts[ this.mailHostName ] ) {
			throw new Error( `${ this.mailHostName } not found in hosts.json` );
		}

		Object.assign( this, {
			transporter:		nodemailer.createTransport( hosts[ this.mailHostName ] )
		});

		log( 'SMTP Transporter created, verifying connection...', 'yellow' );

		await this.verify();
	}

	async sendMail({ toList, subject = '', text = '', html = '' }) {
		toList = Array.isArray( toList ) ? toList : [ toList ];

		if( this.this.DEVMODE ) {
			//return 'this.DEVMODE';
		}

		if( toList.length === 0 ) {
			console.error( 'Parameter toList must contain at least one valid email address.' );
			return false;
		}

		let receipients = toList.join( ',' );

		if( receipients.length < 5 ) {
			console.error( 'malicous receipients email address.' );
			return false;
		}

		let mailOptions = {
			from:		senderAddress,
			to:			receipients,
			bcc:		'',
			subject:	subject,
			text:		text,
			html:		html
		};

		try {
			let sendResult = await this.transporter.sendMail( mailOptions );

			//console.log( `Mail was sent, id: ${ sendResult.messageId }\nResult: ${ sendResult.response }.` );
			return sendResult;
		} catch( ex ) {
			console.error( 'MailException on: ', toList, ex );
		}
	}

	async verify() {
		try {
			await this.transporter.verify();
			log( 'SMTP Connection established and ready.', 'green' );
		} catch( ex ) {
			console.error( 'SMTP Connection error: ', ex );
		}
	}

	parse( content ) {
		return {
			with:	function( replacementHash ) {
				for( let [ searchFor, value ] of Object.entries( replacementHash ) ) {
					content = content.replace( new RegExp( '%' + searchFor + '%', 'g' ), value );
				}

				return content;
			}
		};
	}
};

module.exports = exports = MailService;
