import uuid from 'uuid'
import http from 'http'
import express from 'express'
import socketio from 'socket.io'
import * as utils from './utils'

/** TESTING API CLIENT **/
import client from '../../stryve-api-client/lib/index'

const dev 		= process.env.NODE_ENV !== 'production'
	, app		= express()
	, server	= http.Server(app)
	, io 		= socketio(server)
	, api_base	= 'http://api.stryve.io/api/'
	, port		= 3000

// start the server
server.listen(port, () => {
	if(dev) console.log("\nListening on *:" + port + "\r\n")
})

/********************************/
/**** ON NEW USER CONNECTION ****/
/********************************/
const users_io = io.of('/users')

users_io.on('connection', socket => {

	if(dev)	console.log('User connected and ready.')

	socket.emit('connected', socket.id)

	/***********************************/
	/*** ON CONTACT MESSAGE RECEIVED ***/
	/***********************************/
	socket.on('contact-message', payload => {
		
		// parse the text
		payload.event_text = utils.parseEventText(payload.event_text)

		// return if no text to continue with
		if(!payload.event_text.length) {
			if(dev) console.log('Empty string provided. Nothing to do.')
			return
		}

		// prepare request data
		const apiPayload = {
			event_uuid: 	uuid.v1(),
			sender_uuid: 	payload.sender_uuid,
			recipient_uuid:	payload.recipient_uuid,
			event_type: 	'user_message',
			event_text: 	payload.event_text,
			publish_to: 	'both',
			editable: 		'true'
		}

		// send the message back to sender to avoid http latency
		// (we will update it when we get it back from the server)
		socket.emit('contact-message::' + payload.sender_uuid + '::preliminary', apiPayload)

		// send ajax here
		client.contacts.postContactEvent(
			apiPayload,
			payload.access_token,
			res => {
				// send to intended recipient
				users_io.emit('contact-message::' + res.recipient_uuid, res)

				// send back to sender
				users_io.emit('contact-message::' + res.sender_uuid, res)
			},
			res => {
				//TODO
				console.log(res)
			}
		)	
	})
})
/* end $users_io */

/********************************/
/*** ON NEW SERVER CONNECTION ***/
/********************************/
const servers_io = io.of('/servers')

servers_io.on('connection', socket => {

	if(dev)	console.log('A user has connected to the server.')

	// create some variable to store user and server info
	if(typeof socket.connectedUsers === 'undefined')
		socket['connectedUsers'] =  []

	if(typeof socket.activeServers === 'undefined')
		socket['activeServers'] = []

	/*********************/
	/*** ON DISCONNECT ***/
	/*********************/
	socket.on('disconnect', () => {
		console.log('A user disconnected from the server.')
	})

	// let the user know they have connected successfully
	// send them back their socket id
	servers_io.to(socket.id).emit('connected', socket.id)

	/*************************/
	/*** ON USER CONNECTED ***/
	/*************************/
	socket.on('user-connected', payload => {

		const apiPayload = {
			server_uuid: 	payload.server_uuid,
			event_type: 	'user_connected',
			event_text: 	payload.owner_username + ' has connected to ' + payload.server_name + '.',
			publish_to: 	'server_not_self'
		}

		// send the api request
		client.servers.postServerEvent(
			apiPayload,
			payload.access_token,
			res => {
				// add the user's info to the socket for later user
				socket.connectedUsers.push({ uuid: res.owner_uuid, username: res.owner_username })

				// add the servers's info to the socket for later user
				socket.activeServers.push({ uuid: res.server_uuid, name: res.server_name })
			
				// besides the socket initiator,  let all users know when a connection is received,
				// even if they don't want to hear it
				socket.broadcast.emit('user-connected', res)
			},
			res => {
				//TODO
				if(dev)	console.log(res)
			}
		)
	})

	/****************************/
	/*** ON USER DISCONNECTED ***/
	/****************************/
	// on user disconnected - this may have to done another way. See disconnect below
	socket.on('user-disconnected', function(payload) {
		// TODO
		if(dev) console.log(payload)
	})


	/*******************************/
	/*** ON CHANNEL SUBSCRIPTION ***/
	/*******************************/
	socket.on('subscribe-to-channel', payload => {
		// subscribe to the intended channel
		socket.join(payload.channel_uuid)

		// update payload
		payload['uuid'] 		= uuid.v1()
		payload['event_type'] 	= 'user_subscribed'
		payload['event_text'] 	= payload.owner_username + ' has joined your channel.'
		
		// broadcast user subscription to all subscribers but the instantiating socket
		socket.broadcast.emit('user-subscribed-to::' + payload.channel_uuid, payload)

		if(dev)
			console.log(payload.owner_username + ' has joined the ' + payload.channel_name + ' channel.')
	})

	/*********************************/
	/*** ON CHANNEL UNSUBSCRIPTION ***/
	/*********************************/
	socket.on('unsubscribe-from-channel', payload => {
		// unsubscribe from the intended channel
		socket.leave(payload.channel_uuid)
		
		// modify payload
		payload['uuid'] 		= uuid.v1()
		payload['event_type'] 	= 'user_unsubscribed'
		payload['event_text'] 	= payload.owner_username + ' has left your channel.'

		// broadcast user subscription to all subscribers but the instantiating socket
		socket.broadcast.emit('user-unsubscribed-from::' + payload.channel_uuid, payload)

		if(dev)
			console.log(payload.owner_username + ' has left the ' + payload.channel_name + ' channel.')
	})

	/***********************************/
	/*** ON CHANNEL MESSAGE RECEIVED ***/
	/***********************************/
	socket.on('channel-message', payload => {
		// parse the text
		payload.event_text = utils.parseEventText(payload.event_text)

		// return if no text to continue with
		if(!payload.event_text.length) {
			if(dev) console.log('Empty string provided. Nothing to do.')
			return
		}

		// prepare request data
		const apiPayload = {
			uuid: 			uuid.v1(),
			channel_uuid: 	payload.channel_uuid,
			event_type: 	'user_message',
			event_text: 	payload.event_text,
			publish_to: 	'channel_and_self',
			editable: 		'true'
		}

		// send the message back to sender to avoid http latency
		// (we will update it when we get it back from the server)
		socket.emit('channel-message::' + payload.channel_uuid + '::preliminary', apiPayload)

		// save the  event to the bdatabase
		client.channels.postChannelEvent(
			apiPayload,
			payload.access_token,
			res => {
				servers_io.emit('channel-message::' + res.channel_uuid, res)
			},
			res => {
				//TODO
				console.log(res)
			}
		)
	})
	
	/***********************/
	/***  TESTING STILL  ***/
	/***********************/
	socket.on('get-clients', payload => {
		// console.log(io.sockets.sockets)
		// console.log(Object.keys(io.engine.clients))
		// console.log(Object.keys(io.engine.clients))


		// console.log(io.sockets.connected) //Return {socket_1_id: {}, socket_2_id: {}} . This is the most convenient one, since you can just refer to io.sockets.connected[id] then do common things like emit()
		// console.log(io.sockets.sockets) //Returns [{socket_1}, {socket_2}, ....]. Can refer to socket_i.id to distinguish
		// console.log(io.sockets.adapter.sids) //Return {socket_1_id: {}, socket_2_id: {}} . Looks similar to the first one but the object is not actually the socket, just the information.

		// // Not directly helps but still relevant
		console.log(io.sockets.adapter.rooms) //Returns {room_1_id: {}, room_2_id: {}}
		// console.log(io.sockets.server.eio.clients) //Return client sockets
		// console.log(io.sockets.server.eio.clientsCount) //Return number of connected clients

		io.emit('server-channels', io.sockets.adapter.rooms)
		// io.emit('rooms', io.sockets.server.eio)
		// io.emit('rooms', io.sockets.sockets)
		// io.emit('rooms', io.sockets.adapter.sids)
		// io.emit('rooms', io.sockets.sockets)
		// io.emit('rooms', io.engine.clients)
	})
})

/* end $servers_io */