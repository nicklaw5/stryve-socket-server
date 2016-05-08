'use strict';

var _uuid = require('uuid');

var _uuid2 = _interopRequireDefault(_uuid);

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _socket = require('socket.io');

var _socket2 = _interopRequireDefault(_socket);

var _striptags = require('striptags');

var _striptags2 = _interopRequireDefault(_striptags);

var _ajax = require('./ajax');

var ajax = _interopRequireWildcard(_ajax);

var _index = require('../../stryve-api-client/lib/index');

var _index2 = _interopRequireDefault(_index);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var dev = process.env.NODE_ENV !== 'production',
    app = (0, _express2.default)(),
    server = _http2.default.Server(app),
    io = (0, _socket2.default)(server),
    api_base = 'http://api.stryve.io/api/',
    port = 3000;

// start the server


/** TESTING API CLIENT **/
server.listen(port, function () {
	if (dev) console.log("\nListening on *:" + port + "\r\n");
});

/********************************/
/**** ON NEW USER CONNECTION ****/
/********************************/
var users_io = io.of('/users');

users_io.on('connection', function (socket) {
	if (dev) console.log('User connected and ready.');

	socket.emit('connected', socket.id);
});

/********************************/
/*** ON NEW SERVER CONNECTION ***/
/********************************/
var servers_io = io.of('/servers');

servers_io.on('connection', function (socket) {

	if (dev) console.log('A user has connected to the server.');

	// let the user know they have connected successfully
	// send them back their socket id
	servers_io.to(socket.id).emit('connected', socket.id);

	/*************************/
	/*** ON USER CONNECTED ***/
	/*************************/
	socket.on('user-connected', function (payload) {

		if (typeof socket.connectedUsers === 'undefined') socket['connectedUsers'] = [];

		if (typeof socket.activeServers === 'undefined') socket['activeServers'] = [];

		var apiPayload = {
			server_uuid: payload.server_uuid,
			event_type: 'user_connected',
			event_text: payload.owner_username + ' has connected to ' + payload.server_name + '.',
			publish_to: 'server_not_self'
		};

		// send the api request
		_index2.default.servers.postServerEvent(apiPayload, payload.access_token, function (res) {
			console.log(res);

			// add the user's info to the socket for later user
			socket.connectedUsers.push({ uuid: res.response.owner_uuid, username: res.response.owner_username });

			// add the servers's info to the socket for later user
			socket.activeServers.push({ uuid: res.response.server_uuid, name: res.response.server_username });

			// console.log(socket);

			// besides the socket initiator,  let all users know when a connection is received,
			// even if they don't want to hear it
			socket.broadcast.emit('user-connected', res);
		}, function (res) {
			//TODO
			console.log(res);
		});
	});

	/****************************/
	/*** ON USER DISCONNECTED ***/
	/****************************/
	// on user disconnected - this may have to done another way. See disconnect below
	// socket.on('user-disconnected', function(payload) {
	// // prepare request data
	// var form_data = {
	// 	event_type: 	'user_disconnected',
	// 	event_text: 	payload.owner_username + ' has disconnected to ' + payload.server_name + '.',
	// 	publish_to: 	'server_not_self'
	// };

	// // set the request options
	// var options = requestOptions('post', 'servers/' + payload.server_uuid + '/events', payload.access_token, form_data);

	// // send the request
	// request(options, function (error, response, body) {
	//   	body = JSON.parse(body);

	//   	console.log(body);

	//  	// handle success response
	// 	if (body.code == 201) {  // HTTP CREATED RESPONSE 201
	// 		// we nned to send this back to all sockets including the user
	// 		// because we need to be able to terminate the connection
	// 		// from the users end
	// 		io.emit('user-disconnected', body.response);
	// 	} else {
	// 		// TODO: perhaps log an error here
	// 	}
	// }.bind(io));
	// });

	/*******************************/
	/*** ON CHANNEL SUBSCRIPTION ***/
	/*******************************/
	socket.on('subscribe-to-channel', function (payload) {
		// subscribe to the intended channel
		socket.join(payload.channel_uuid);

		// update payload
		payload['uuid'] = _uuid2.default.v1();
		payload['event_type'] = 'user_subscribed';
		payload['event_text'] = payload.owner_username + ' has joined your channel.';

		// broadcast user subscription to all subscribers but the instantiating socket
		// socket.to(payload.channel_uuid).emit('user-subscribed-to::' + payload.channel_uuid, payload);
		servers_io.emit('user-subscribed-to::' + payload.channel_uuid, payload);

		console.log(payload.owner_username + ' has joined the ' + payload.channel_name + ' channel.');
	});

	/*********************************/
	/*** ON CHANNEL UNSUBSCRIPTION ***/
	/*********************************/
	socket.on('unsubscribe-from-channel', function (payload) {
		// unsubscribe from the intended channel
		socket.leave(payload.channel_uuid);

		// modify payload
		payload['uuid'] = _uuid2.default.v1();
		payload['event_type'] = 'user_unsubscribed';
		payload['event_text'] = payload.owner_username + ' has left your channel.';

		// broadcast user subscription to all subscribers but the instantiating socket
		// socket.to(payload.channel_uuid).emit('user-unsubscribed-from::' + payload.channel_uuid, payload);
		servers_io.emit('user-unsubscribed-from::' + payload.channel_uuid, payload);

		console.log(payload.owner_username + ' has left the ' + payload.channel_name + ' channel.');
	});

	/*********************/
	/*** ON DISCONNECT ***/
	/*********************/
	socket.on('disconnect', function () {
		console.log('A user disconnected from the server.');
		// console.log(socket);
		// let everyone else know that the user has disconnected
		// prepare request data
		// var form_data = {
		// 	event_type: 	'user_disconnected',
		// 	event_text: 	socket.userData.username + ' has disconnected from ' + payload.serverData.name + '.',
		// 	publish_to: 	'server_not_self'
		// };

		// // set the request options
		// var options = requestOptions('post', 'servers/' + payload.server_uuid + '/events', payload.access_token, form_data);

		// // send the request
		// request(options, function (error, response, body) {
		//   	body = JSON.parse(body);

		//   	console.log(body);

		//  	// handle success response
		// 	if (body.code == 201) {  // HTTP CREATED RESPONSE 201
		// 		// we nned to send this back to all sockets including the user
		// 		// because we need to be able to terminate the connection
		// 		// from the users end
		// 		io.emit('user-disconnected', body.response);
		// 	} else {
		// 		// TODO: perhaps log an error here
		// 	}
		// }.bind(io));
	});

	/***********************************/
	/*** ON CONTACT MESSAGE RECEIVED ***/
	/***********************************/
	socket.on('contact-message', function (payload) {

		// parse the text
		payload.event_text = parseEventText(payload.event_text);

		// return if no text to continue with
		if (!payload.event_text.length) return;

		// prepare request data
		var form_data = {
			uuid: _uuid2.default.v1(),
			recipient_uuid: payload.recipient_uuid,
			event_type: 'user_message',
			event_text: payload.event_text,
			publish_to: 'both',
			editable: 'true'
		};

		// send the message back to sender to avoid http latency
		// (we will update it when we get it back from the server)
		socket.emit('contact-message::' + payload.contact_uuid + '::preliminary', form_data);

		// set the request options
		// var options = requestOptions('post', 'channels/' + payload.channel_uuid + '/events', payload.access_token, form_data);

		// // send the request
		// request(options, function (error, response, body) {
		//   	body = JSON.parse(body);

		//   	// handle success response
		// 	if (body.code == 200) {
		// 		// send message to all clients in this channel, including the user
		// 		io.emit('channel-message::' + body.response.channel_uuid, body.response);

		// 	// handle error response
		// 	} else {
		// 		// send error message back to the user
		// 		// TODO
		// 	}
		// }.bind(io));
	}.bind(socket));

	/***********************************/
	/*** ON CHANNEL MESSAGE RECEIVED ***/
	/***********************************/
	socket.on('channel-message', function (payload) {
		// parse the text
		payload.event_text = parseEventText(payload.event_text);

		// return if no text to continue with
		if (!payload.event_text.length) return;

		// prepare request data
		var apiPayload = {
			uuid: _uuid2.default.v1(),
			channel_uuid: payload.channel_uuid,
			event_type: 'user_message',
			event_text: payload.event_text,
			publish_to: 'channel_and_self',
			editable: 'true'
		};

		// send the message back to sender to avoid http latency
		// (we will update it when we get it back from the server)
		socket.emit('channel-message::' + payload.channel_uuid + '::preliminary', apiPayload);

		_index2.default.channels.postChannelEvent(apiPayload, payload.access_token, function (res) {
			servers_io.emit('channel-message::' + res.response.channel_uuid, res.response);
		}, function (res) {
			//TODO
			console.log(res);
		});
	});

	/***********************/
	/*** _TESTING STILL_ ***/
	/***********************/
	socket.on('get-clients', function (payload) {
		// console.log(io.sockets.sockets);
		// console.log(Object.keys(io.engine.clients));
		// console.log(Object.keys(io.engine.clients));

		// console.log(io.sockets.connected); //Return {socket_1_id: {}, socket_2_id: {}} . This is the most convenient one, since you can just refer to io.sockets.connected[id] then do common things like emit()
		// console.log(io.sockets.sockets); //Returns [{socket_1}, {socket_2}, ....]. Can refer to socket_i.id to distinguish
		// console.log(io.sockets.adapter.sids); //Return {socket_1_id: {}, socket_2_id: {}} . Looks similar to the first one but the object is not actually the socket, just the information.

		// // Not directly helps but still relevant
		console.log(io.sockets.adapter.rooms); //Returns {room_1_id: {}, room_2_id: {}}
		// console.log(io.sockets.server.eio.clients); //Return client sockets
		// console.log(io.sockets.server.eio.clientsCount); //Return number of connected clients

		io.emit('server-channels', io.sockets.adapter.rooms);
		// io.emit('rooms', io.sockets.server.eio);
		// io.emit('rooms', io.sockets.sockets);
		// io.emit('rooms', io.sockets.adapter.sids);
		// io.emit('rooms', io.sockets.sockets);
		// io.emit('rooms', io.engine.clients);
	});
});

/**
 * Pares the provided string for insecurities.
 *
 * @param {string} text
 * @return string
 */
function parseEventText(text) {
	// replace certain emojis
	text = text.replace(/<3|&lt;3/g, ":heart:");
	text = text.replace(/<\/3|&lt;&#x2F;3/g, ":broken_heart:");

	// strip any html tags from the text for security
	text = (0, _striptags2.default)(text);

	return text;
}

/*******************************************************************/
/*******************************************************************/
/*******************************************************************/
// // sending to sender-client only
//  socket.emit('message', "this is a test");

//  // sending to all clients, include sender
//  io.emit('message', "this is a test");

//  // sending to all clients except sender
//  socket.broadcast.emit('message', "this is a test");

//  // sending to all clients in 'game' room(channel) except sender
//  socket.broadcast.to('game').emit('message', 'nice game');

//  // sending to all clients in 'game' room(channel), include sender
//  io.in('game').emit('message', 'cool game');

//  // sending to sender client, only if they are in 'game' room(channel)
//  socket.to('game').emit('message', 'enjoy the game');

//  // sending to all clients in namespace 'myNamespace', include sender
//  io.of('myNamespace').emit('message', 'gg');

//  // sending to individual socketid
//  socket.broadcast.to(socketid).emit('message', 'for your eyes only');
/*******************************************************************/
/*******************************************************************/
/*******************************************************************/