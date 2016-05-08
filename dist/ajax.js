'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.requestOptions = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

exports.post = post;

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _responseCodes = require('./response-codes');

var codes = _interopRequireWildcard(_responseCodes);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var BASE_URL = 'http://api.stryve.io/api/';

var requestOptions = exports.requestOptions = function requestOptions(options) {
	var newOptions = {};

	newOptions['json'] = true;

	if (typeof options.method === 'string') newOptions['method'] = options.method;

	if (typeof options.endpoint === 'string') newOptions['url'] = BASE_URL + options.endpoint;

	if (_typeof(options.body) === 'object') newOptions['body'] = options.body;

	newOptions['headers'] = {};

	if (typeof options.access_token === 'string') newOptions.headers['authorization'] = options.access_token;

	return newOptions;
};

function post(options, cb, errorCb) {
	(0, _request2.default)(requestOptions(options), function (error, response, body) {
		if (body.code === codes.CREATED) {
			cb(body.response);
		} else {
			// TODO: perhaps log an error here
			errorCb(error);
		}
	});
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