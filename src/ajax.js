import request from 'request'
import * as codes from './response-codes'
const BASE_URL = 'http://api.stryve.io/api/'

export const requestOptions = (options) => {
	let newOptions = {};

	newOptions['json'] = true

	if(typeof options.method === 'string')
		newOptions['method'] = options.method;

	if(typeof options.endpoint === 'string')
		newOptions['url'] = BASE_URL + options.endpoint;

	if(typeof options.body === 'object')
		newOptions['body'] = options.body;

	newOptions['headers'] = {};

	if(typeof options.access_token === 'string')
		newOptions.headers['authorization'] = options.access_token;

	return newOptions;
}

export function post(options, cb, errorCb) {
	request(requestOptions(options), (error, response, body) => {
		if (body.code === codes.CREATED) {
			cb(body.response)
		} else {
			// TODO: perhaps log an error here
			errorCb(error)
		}
	})
}

// export function post(endpoint, body, useAccessToken, cb) {

// 	if(useAccessToken) {
// 		request
// 			.post(base_url + endpoint)
// 			.set('Content-Type', 'application/json')
// 			.set('Authorization', token.get())
// 			.send((typeof body == 'object')? JSON.stringify(body) : '')
// 			.end((err, res) => {
// 				cb(res.body)
// 		})
// 	} else {
// 		request
// 			.post(base_url + endpoint)
// 			.set('Content-Type', 'application/json')
// 			.send(JSON.stringify(body))
// 			.end((err, res) => {
// 				cb(res.body)
// 		})
// 	}
// }