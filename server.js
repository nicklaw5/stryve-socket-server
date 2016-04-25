var app         = require('express')();
var http        = require('http').Server(app);
var io          = require('socket.io')(http);
var request     = require('request');
var striptags 	= require('striptags');
var uuid 		= require('uuid');
var api_base    = 'http://api.stryve.io/api/';
var port = 3000;

http.listen(port, function(){
	console.log('listening on *:' + port);
});

var requestOptions = function(method, endpoint, access_token, form_data) {
	var options = {};

	if(method !== undefined && typeof method === 'string')
		options['method'] = method.toUpperCase();

	if(endpoint !== undefined && typeof endpoint === 'string')
		options['url'] = api_base + endpoint;

	if(form_data !== null && typeof form_data === 'object')
		options['formData'] = form_data;

	options['headers'] = {};

	if(access_token !== undefined && typeof access_token === 'string')
		options.headers['authorization'] = access_token;

	if(options.method == 'POST' || options.method == 'PUT')
		options.headers['content-type'] = 'multipart/form-data; boundary=---011000010111000001101001';

	options.headers['cache-control'] = 'no-cache';

	return options;
}

/********************************/
/*** ON NEW SOCKET CONNECTION ***/
/********************************/
io.on('connection', function(socket) {

	console.log('A user has connected to the server.');

	// let the user know they have connected successfully
	// send them back their socket id
	io.to(socket.id).emit('connected', socket.id);

	/*************************/
	/*** ON USER CONNECTED ***/
	/*************************/
	socket.on('user-connected', function(payload) {

		// socket['userData'] = payload;

		// prepare request data
		var form_data = {
			event_type: 	'user_connected',
			event_text: 	payload.owner_username + ' has connected to ' + payload.server_name + '.',
			publish_to: 	'server_not_self'
		};

		// set the request options
		var options = requestOptions('post', 'servers/' + payload.server_uuid + '/events', payload.access_token, form_data);

		// send the request
		request(options, function (error, response, body) {
		  	body = JSON.parse(body);

		 	// handle success response
			if (body.code == 201) {  // HTTP CREATED RESPONSE 201
				
				// add the user's info to the socket for later user
				socket['userData'] = {
					uuid: 		payload.owner_uuid,
					username: 	payload.owner_username
				};

				// add the servers's info to the socket for later user
				socket['serverData'] = {
					uuid: 		payload.server_uuid,
					name: 		payload.server_username
				};
				
				// besides the socket initiator,  let all users know when a connection is received,
				// even if they don't want to hear it
				socket.broadcast.emit('user-connected', body.response);
			} else {
				// TODO: perhaps log an error here
			}
		}.bind(io));
	});

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
	socket.on('subscribe-to-channel', function(payload) {
		// subscribe to the intended channel
		socket.join(payload.channel_uuid);

		// update payload
		payload['uuid'] 		= uuid.v1();
		payload['event_type'] 	= 'user_subscribed';
		payload['event_text'] 	= payload.owner_username + ' has joined your channel.';
		
		// broadcast user subscription to all subscribers but the instantiating socket
		socket.to(payload.channel_uuid).emit('user-subscribed-to::' + payload.channel_uuid, payload);

		console.log(payload.owner_username + ' has joined the ' + payload.channel_name + ' channel.');
	});

	/*********************************/
	/*** ON CHANNEL UNSUBSCRIPTION ***/
	/*********************************/
	socket.on('unsubscribe-from-channel', function(payload) {
		// unsubscribe from the intended channel
		socket.leave(payload.channel_uuid);
		
		// modify payload
		payload['uuid'] 		= uuid.v1();
		payload['event_type'] 	= 'user_unsubscribed';
		payload['event_text'] 	= payload.owner_username + ' has left your channel.';

		// broadcast user subscription to all subscribers but the instantiating socket
		socket.to(payload.channel_uuid).emit('user-unsubscribed-from::' + payload.channel_uuid, payload);

		console.log(payload.owner_username + ' has left the ' + payload.channel_name + ' channel.');
	});

	/*********************/
	/*** ON DISCONNECT ***/
	/*********************/
	socket.on('disconnect', function() {
		console.log('A user disconnected from the server.');	

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
	/*** ON CHANNEL MESSAGE RECEIVED ***/
	/***********************************/
	socket.on('channel-message', function(payload) {

		// replace certain emojis
		payload.event_text = payload.event_text.replace(/<3|&lt;3/g, ":heart:");
		payload.event_text = payload.event_text.replace(/<\/3|&lt;&#x2F;3/g, ":broken_heart:");

		// strip any html tags from the text for security
		payload.event_text = striptags(payload.event_text);

		// prepare request data
		var form_data = {
			event_type: 'user_message',
			event_text: payload.event_text,
			publish_to: 'channel_and_self',
			editable: 'true'
		};

		// set the request options
		var options = requestOptions('post', 'channels/' + payload.channel_uuid + '/events', payload.access_token, form_data);

		// send the request
		request(options, function (error, response, body) {
		  	body = JSON.parse(body);
		  	
		  	// handle success response
			if (body.code == 200) {
				// send message to all clients in this channel, including the user
				io.emit('channel-message::' + body.response.channel_uuid, body.response);

			// handle error response
			} else {
				// send error message back to the user
			}
		}.bind(io));
	});


	/***********************/
	/*** _TESTING STILL_ ***/
	/***********************/
	socket.on('get-clients', function(payload) {
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