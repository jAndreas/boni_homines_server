'use strict';

const	nodemailer	= require( 'nodemailer' ),
		fs			= require( 'fs' ),
		path		= require( 'path' );

const	senderAddress	= 'andreas@bonihomines.de';

class MailService {
	constructor( hostname, DEVMODE ) {
		if( DEVMODE ) {
			console.log( 'MailService is in DEVMODE.' );
		} else {
			console.log( 'MailService is LIVE.' );
		}

		let data, hosts;

		try {
			data	= fs.readFileSync( path.resolve( `${ __dirname }/../mailservice/hosts.json` ), 'utf-8' );
			hosts	= JSON.parse( data );
		} catch( ex ) {
			throw new Error( 'Error while reading ../mailservice/hosts.json: ' + ex );
		}

		if( !hosts[ hostname ] ) {
			throw new Error( `${hostname} not found in hosts.json` );
		}

		Object.assign( this, {
			DEVMODE:			DEVMODE,
			transporter:		nodemailer.createTransport( hosts[ hostname ] )
		});

		console.log( 'SMTP Transporter created, verifying connection...' );

		this.verify();
	}

	async sendMail({ toList, subject = '', text = '', html = '' }) {
		toList = Array.isArray( toList ) ? toList : [ toList ];

		if( this.DEVMODE ) {
			//return 'DEVMODE';
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
			console.log( '...SMTP Connection established and ready.' );
		} catch( ex ) {
			console.error( '...SMTP Connection error: ', ex );
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
}

module.exports = exports = MailService;
