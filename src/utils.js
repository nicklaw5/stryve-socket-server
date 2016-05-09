import striptags from 'striptags'

/**
 * Pares the provided string for insecurities.
 *
 * @param {string} text
 * @return string
 */
exports.parseEventText = text => {
	// replace certain emojis
	text = text.replace(/<3|&lt;3/g, ":heart:")
	text = text.replace(/<\/3|&lt;&#x2F;3/g, ":broken_heart:")

	// strip any html tags from the text for security
	return striptags(text)
}
