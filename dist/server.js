'use strict';

var _uuid = require('uuid');

var _uuid2 = _interopRequireDefault(_uuid);

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _socket = require('socket.io');

var _socket2 = _interopRequireDefault(_socket);

var _utils = require('./utils');

var utils = _interopRequireWildcard(_utils);

var _stryveApiClient = require('stryve-api-client');

var _stryveApiClient2 = _interopRequireDefault(_stryveApiClient);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var dev = process.env.NODE_ENV !== 'production',
    app = (0, _express2.default)(),
    server = _http2.default.Server(app),
    io = (0, _socket2.default)(server),
    api_base = 'http://api.stryve.io/api/',
    port = 3000;

// start the server
server.listen(port, function () {
	console.log("\nListening on *:" + port + "\r\n");
});

/********************************/
/**** ON NEW USER CONNECTION ****/
/********************************/
var users_io = io.of('/users');

users_io.on('connection', function (socket) {

	if (dev) console.log('User connected and ready.');

	socket.emit('connected', socket.id);

	/***********************************/
	/*** ON CONTACT MESSAGE RECEIVED ***/
	/***********************************/
	socket.on('contact-message', function (payload) {

		// parse the text
		payload.event_text = utils.parseEventText(payload.event_text);

		// return if no text to continue with
		if (!payload.event_text.length) {
			if (dev) console.log('Empty string provided. Nothing to do.');
			return;
		}

		// prepare request data
		var apiPayload = {
			event_uuid: _uuid2.default.v1(),
			sender_uuid: payload.sender_uuid,
			recipient_uuid: payload.recipient_uuid,
			event_type: 'user_message',
			event_text: payload.event_text,
			publish_to: 'both',
			editable: 'true'
		};

		// send the message back to sender to avoid http latency
		// (we will update it when we get it back from the server)
		socket.emit('contact-message::' + payload.sender_uuid + '::preliminary', apiPayload);

		// send ajax here
		_stryveApiClient2.default.contacts.postContactEvent(apiPayload, payload.access_token, function (res) {
			// send to intended recipient
			users_io.emit('contact-message::' + res.recipient_uuid, res);

			// send back to sender
			users_io.emit('contact-message::' + res.sender_uuid, res);
		}, function (res) {
			//TODO
			console.log(res);
		});
	});
});
/* end $users_io */

/********************************/
/*** ON NEW SERVER CONNECTION ***/
/********************************/
var servers_io = io.of('/servers');

servers_io.on('connection', function (socket) {

	if (dev) console.log('A user has connected to the server.');

	// create some variable to store user and server info
	if (typeof socket.connectedUsers === 'undefined') socket['connectedUsers'] = [];

	if (typeof socket.activeServers === 'undefined') socket['activeServers'] = [];

	/*********************/
	/*** ON DISCONNECT ***/
	/*********************/
	socket.on('disconnect', function () {
		console.log('A user disconnected from the server.');
	});

	// let the user know they have connected successfully
	// send them back their socket id
	servers_io.to(socket.id).emit('connected', socket.id);

	/*************************/
	/*** ON USER CONNECTED ***/
	/*************************/
	socket.on('user-connected', function (payload) {

		var apiPayload = {
			server_uuid: payload.server_uuid,
			event_type: 'user_connected',
			event_text: payload.owner_username + ' has connected to ' + payload.server_name + '.',
			publish_to: 'server_not_self'
		};

		// send the api request
		_stryveApiClient2.default.servers.postServerEvent(apiPayload, payload.access_token, function (res) {
			// add the user's info to the socket for later user
			socket.connectedUsers.push({ uuid: res.owner_uuid, username: res.owner_username });

			// add the servers's info to the socket for later user
			socket.activeServers.push({ uuid: res.server_uuid, name: res.server_name });

			// besides the socket initiator,  let all users know when a connection is received,
			// even if they don't want to hear it
			socket.broadcast.emit('user-connected', res);
		}, function (res) {
			//TODO
			if (dev) console.log(res);
		});
	});

	/****************************/
	/*** ON USER DISCONNECTED ***/
	/****************************/
	// on user disconnected - this may have to done another way. See disconnect below
	socket.on('user-disconnected', function (payload) {
		// TODO
		if (dev) console.log(payload);
	});

	/*******************************/
	/*** ON CHANNEL SUBSCRIPTION ***/
	/*******************************/
	socket.on('subscribe-to-channel', function (payload) {
		// subscribe to the intended channel
		socket.join(payload.channel_uuid);

		// update payload
		payload['uuid'] = _uuid2.default.v1();
		payload['event_type'] = 'user_subscribed';
		payload['event_text'] = payload.owner_username + ' has joined your channel';

		// broadcast user subscription to all subscribers but the instantiating socket
		socket.broadcast.emit('user-subscribed-to::' + payload.channel_uuid, payload);

		if (dev) console.log(payload.owner_username + ' has joined the ' + payload.channel_name + ' channel.');
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
		payload['event_text'] = payload.owner_username + ' has left your channel';

		// broadcast user subscription to all subscribers but the instantiating socket
		socket.broadcast.emit('user-unsubscribed-from::' + payload.channel_uuid, payload);

		if (dev) console.log(payload.owner_username + ' has left the ' + payload.channel_name + ' channel.');
	});

	/***********************************/
	/*** ON CHANNEL MESSAGE RECEIVED ***/
	/***********************************/
	socket.on('channel-message', function (payload) {
		// parse the text
		payload.event_text = utils.parseEventText(payload.event_text);

		// return if no text to continue with
		if (!payload.event_text.length) {
			if (dev) console.log('Empty string provided. Nothing to do.');
			return;
		}

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

		// save the  event to the bdatabase
		_stryveApiClient2.default.channels.postChannelEvent(apiPayload, payload.access_token, function (res) {
			servers_io.emit('channel-message::' + res.channel_uuid, res);
		}, function (res) {
			//TODO
			console.log(res);
		});
	});

	/******************************/
	/*** ON NEW CHANNEL CREATED ***/
	/******************************/
	socket.on('channel-created', function (channel) {
		socket.broadcast.emit('channel-created', channel);
	});
});
/* end $servers_io */