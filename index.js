'use strict';
/**
 * Define & init Node.js modules.
 */
const express = require('express');
const mysql = require('mysql');
const http = require('http');
const fs = require('fs');
const path = require('path');
const socket = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socket(server);

/**
 * @const
 * Object, that includes all ables server states.
 * @type {object}
 */
const factory = {
	MAINTENANCE: `Server is under maintenance now.`,
	USER_LIMIT: `Server refused the connection, because of <i>overload</i>.` +
				` Error code: <b>0x01</b>.`,
	UNEXPECTED_SQL_ERROR: `Unable to import adverts data from` +
						  `<i>MySQL-database</i>. Error code: <b>0x02</b>.`
}
/**
 * @const
 * Port, which server is located on.
 * @type {number}
 */
const location = 8080;
/**
 * @const
 * Array of connected users.
 * @type {array}
 */
const peers = [];
/**
 * @const
 * Maximum count of connected users.
 * @type {number}
 */
const limit = 3;
/**
 * @const
 * Is server under maintenance now?
 * @type {number}
 */
const maintenance = false;
/**
 * @const
 * Maximum count of data loading requests from one user per 1 day (24 hours).
 * @type {number}
 */
const requestLimit = 3;
/**
 * @var
 * Current server state: loading, ready.
 * @type {string}
 */
let readyState = 'loading';
/**
 * @const
 * Expire time adverts data interval.
 * @type {number}
 */
const EXPIRES_INTERVAL = 24 * 60 * 60;
/**
 * @const
 * MySQL-database account data.s
 * @type {object}
 */
const account = {
	host: 'localhost',
	user: 'anton',
	password: '123456',
	database: 'items'
};

/**
 * Load all files from './public' directory.
 */
app.use(express.static(path.join(__dirname, 'public')));
/**
 * Start the server.
 */
server.listen(location);
io.on('connection', socket => {
	if (maintenance) {
		socket.emit('break', factory.MAINTENANCE);
		return;
	}
	if (peers.length < limit) {
		peers.push(socket);
		socket.emit('disconnect', () => {
			const index = peers.indexOf(socket);
			peers.splice(index, 1);
		});
		socket.on('get', () => {
			fetchAdverts(socket);
		});
	} else {
		socket.emit('break', factory.USER_LIMIT);
	}
});

/** 
 * Load adverts data & start new timer to automaticly update it.
 */
fetchAdverts();
const updateTimer = setInterval(() => {
	console.log(`Timer says: "It's time to update!".`);
	fetchAdverts();
	console.log(`Timer says: "Data was updated. See you later!"`);
}, EXPIRES_INTERVAL);


/**
 * Loads, compares, if it is need sends to client new adverts data.
 * @param {object|boolean} [isClientRequest] - Client address, if need to send 
 * data to client.
 */
function fetchAdverts(isClientRequest=false) {
	/**
	 * Try to restore adverts data from file system.
	 */
	fs.readFile('posted.json', 'utf-8', (error, response) => {
		if (error ||
			JSON.parse(response).timeout + EXPIRES_INTERVAL < Date.now()) {
			/**
			 * Unable to restore data, load it from MySQL-datbase,
			 * and compare adverts.
			 */
			console.log('Unable to restore adverts data, load it from' +
						' MySQL-database.');
			const connection = mysql.createConnection(account);
			connection.connect();

			const request = `SELECT id, price, s, contact FROM items`;
			connection.query(request, (error, data) => {
				if (error) {
					if (isClientRequest) {
						isClientRequest.emit('break', 
											 factory.UNEXPECTED_SQL_ERROR);
					} else {
						fs.writeFileSync('./public/posted.json',
										 JSON.stringify({
										 	 state: false,
										 	 description: UNEXPECTED_SQL_ERROR
										 }));
					}
					console.log(`Loading adverts data from database is not ` +
								` possible, details: `, error);
					return;
				}
				/**
				 * Compare adverts & save new data.
				 */
				console.log('Data was sucessully loaded.');
				const compared = JSON.stringify(compareAdverts(data));
				fs.writeFileSync('posted.json', compared);
				if (isClientRequest) {
					socket.emit('post', compared);
				} else {
					fs.writeFileSync('./public/posted.json',
									 compared);
				};
				console.log('Data was sucessfully updated.');
			});
			connection.end();
			return;
		} 
		/**
		 * Data is ready to read. Send it to client if it possible!
		 */
		console.log('It is possible to restore data.');
		if (isClientRequest) {
			const compressed = JSON.parse(response);
			socket.emit('post', compressed);
		}
	});
};
/**
 * Compares adverts data.
 * @param {array} collection - Collection of adverts data, imported from 
 * MySQL-database.
 * @returns {object}
 */
function compareAdverts(collection) {
	let results = {};

	let compared = 0;

	const startTime = Date.now();

	if (collection instanceof Array) {
		console.log('Starting to compare...');
		collection.forEach(advert => {
			/**
			 * Create a new cell for each advert.
			 */
			if (!results.hasOwnProperty(advert.id)) {
				results[advert.id] = [];
			}
			/**
			 * Create a copy of adverts collection, remove current advert
			 * and all adverts, that was compared with current.
			 */
			const copy = [...collection];
			const currentIndex = copy.indexOf(advert);
			copy.splice(currentIndex);
			results[adverts.id].forEach(_compared => {
				if (_compared.hasOwnProperty('with')) {
					/**
					 * Find advert with the id.
					 */
					for (let _advert of copy) {
						if (_advert.id === _compared.with) {
							const index = copy.indexOf(_advert);
							copy.splice(index, 1);
							break;
						}
					}
				}
			});
			/**
			 * Compare advert with others.
			 */
			copy.forEach(second => {
				let i = advert, j = second;
				/**
				 * Translate phone numbers and place into numbers.
				 */
				i.contact = Number(String(i.contact).replace(/[()\s-]*/gim, ''));
				j.contact = Number(String(j.contact).replace(/[()\s-]*/gim, ''));
				i.s = Number(String(i.s).replace(/[м2\s]*/gim, ''));
				j.s = Number(String(j.s).replace(/[м2\s]*/gim, ''));
		
				
				let similarity = 0;

				if (!results.hasOwnProperty(j.id)) {
					results[j.id] = [];
				}
				/**
				 * Comparing it.
				 */
				const MAX_AUTHOR = 20;
				const MAX_PLACE = 40;
				const MAX_PRICE = 40;

				if (i.contact === j.contact) {
					similarity += MAX_AUTHOR;
				}

				if (i.s === j.s) {
					similarity += MAX_PLACE;
				} else {
					/**
					 * Maximal difference between places is 10 meters.
					 */
					const MAX_PLACE_DIFF = 10;
					if (Math.abs(i.s - j.s) <= MAX_PLACE_DIFF) {
						const diff = Math.abs(i.s - j.s) + 1;
						similarity += MAX_PLACE * (diff / (MAX_PLACE_DIFF * 2));
					}
				}

				if (i.price === j.price) {
					similarity += MAX_PRICE;
				} else {
					const min = Math.min(i.price, j.price);
					/**
					 * Maximal difference between prices is 10% of minimal
					 * price.
					 */
					const MAX_PRICE_DIFF = 0.1 * min;

					if (Math.abs(i.price - j.price) < MAX_PRICE_DIFF) {
						const diff = Math.abs(i.price - j.price);
						similarity += MAX_PRICE * (diff / (MAX_PRICE_DIFF * 2));
					}
				}

				/**
				 * Saving the result.
				 */		
				if (!isElementComparedWith(results[j.id], i.id)) {
					results[j.id].push({ 
						with: i.id,
						for: similarity
					});
				}
				if (!isElementComparedWith(results[i.id], j.id)) {
					results[i.id].push({
						with: j.id,
						for: similarity
					});
				}
				compared++;
				console.log(`Compared ${compared}`);
			});
		});
	}

	console.log(`Adverts were compared. \n` +
				`Operation counts: ${compared}. \n` +
				`Time: ${Date.now() - startTime}ms. \n`);
	return results;
}
/**
 * Helper function for comparing.
 * Checks if some advert was compared with other.
 * @param {object} element - Some advert data.
 * @param {number} comparedWithId - The id of other advert.
 * @access private
 */
function isElementComparedWith(element, comparedWithId) {
	for (let advert of element) {
		if (advert.with === comparedWithId) {
			return true;
		}
	}
	return false;
}
