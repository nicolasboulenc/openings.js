'use strict'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

let COLUMNS = 'abcdefgh'.split('')
let DEFAULT_DRAG_THROTTLE_RATE = 20
let ELLIPSIS = '…'
let MINIMUM_JQUERY_VERSION = '1.8.3'
let RUN_ASSERTS = true
let START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'
let START_POSITION = fenToObj(START_FEN)

// default animation speeds
let DEFAULT_APPEAR_SPEED = 200
let DEFAULT_MOVE_SPEED = 200
let DEFAULT_SNAPBACK_SPEED = 60
let DEFAULT_SNAP_SPEED = 30
let DEFAULT_TRASH_SPEED = 100

// use unique class names to prevent clashing with anything else on the page
// and simplify selectors
// NOTE: these should never change
let CSS = {}
CSS['alpha'] = 'alpha-d2270'
CSS['black'] = 'black-3c85d'
CSS['board'] = 'board-b72b1'
CSS['chessboard'] = 'chessboard-63f37'
CSS['clearfix'] = 'clearfix-7da63'
CSS['highlight1'] = 'highlight1-32417'
CSS['highlight2'] = 'highlight2-9c5d2'
CSS['notation'] = 'notation-322f9'
CSS['numeric'] = 'numeric-fc462'
CSS['piece'] = 'piece-417db'
CSS['row'] = 'row-5277c'
CSS['sparePieces'] = 'spare-pieces-7492f'
CSS['sparePiecesBottom'] = 'spare-pieces-bottom-ae20f'
CSS['sparePiecesTop'] = 'spare-pieces-top-4028b'
CSS['square'] = 'square-55d63'
CSS['white'] = 'white-1e1d7'

// ---------------------------------------------------------------------------
// Misc Util Functions
// ---------------------------------------------------------------------------

function throttle (f, interval, scope) {
let timeout = 0
let shouldFire = false
let args = []

let handleTimeout = function () {
	timeout = 0
	if (shouldFire) {
	shouldFire = false
	fire()
	}
}

let fire = function () {
	timeout = window.setTimeout(handleTimeout, interval)
	f.apply(scope, args)
}

return function (_args) {
	args = arguments
	if (!timeout) {
	fire()
	} else {
	shouldFire = true
	}
}
}

// function debounce (f, interval, scope) {
//   let timeout = 0
//   return function (_args) {
//     window.clearTimeout(timeout)
//     let args = arguments
//     timeout = window.setTimeout(function () {
//       f.apply(scope, args)
//     }, interval)
//   }
// }

function uuid () {
	return 'xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx'.replace(/x/g, function (c) {
		let r = (Math.random() * 16) | 0
		return r.toString(16)
	})
}

function deepCopy (thing) {
	return JSON.parse(JSON.stringify(thing))
}

function parseSemVer (version) {
	let tmp = version.split('.')
	return {
		major: parseInt(tmp[0], 10),
		minor: parseInt(tmp[1], 10),
		patch: parseInt(tmp[2], 10)
	}
}

// returns true if version is >= minimum
function validSemanticVersion (version, minimum) {
	version = parseSemVer(version)
	minimum = parseSemVer(minimum)

	let versionNum = (version.major * 100000 * 100000) +
						(version.minor * 100000) +
						version.patch
	let minimumNum = (minimum.major * 100000 * 100000) +
						(minimum.minor * 100000) +
						minimum.patch

	return versionNum >= minimumNum
}

function interpolateTemplate (str, obj) {
	for (let key in obj) {
		if (!obj.hasOwnProperty(key)) continue
		let keyTemplateStr = '{' + key + '}'
		let value = obj[key]
		while (str.indexOf(keyTemplateStr) !== -1) {
		str = str.replace(keyTemplateStr, value)
		}
	}
	return str
}

if (RUN_ASSERTS) {
	console.assert(interpolateTemplate('abc', {a: 'x'}) === 'abc')
	console.assert(interpolateTemplate('{a}bc', {}) === '{a}bc')
	console.assert(interpolateTemplate('{a}bc', {p: 'q'}) === '{a}bc')
	console.assert(interpolateTemplate('{a}bc', {a: 'x'}) === 'xbc')
	console.assert(interpolateTemplate('{a}bc{a}bc', {a: 'x'}) === 'xbcxbc')
	console.assert(interpolateTemplate('{a}{a}{b}', {a: 'x', b: 'y'}) === 'xxy')
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

function isString (s) {
	return typeof s === 'string'
}

function isFunction (f) {
	return typeof f === 'function'
}

function isInteger (n) {
	return typeof n === 'number' &&
			isFinite(n) &&
			Math.floor(n) === n
}

function validAnimationSpeed (speed) {
	if (speed === 'fast' || speed === 'slow') return true
	if (!isInteger(speed)) return false
	return speed >= 0
}

function validThrottleRate (rate) {
	return isInteger(rate) &&
			rate >= 1
}

function validMove (move) {
	// move should be a string
	if (!isString(move)) return false

	// move should be in the form of "e2-e4", "f6-d5"
	let squares = move.split('-')
	if (squares.length !== 2) return false

	return validSquare(squares[0]) && validSquare(squares[1])
}

function validSquare (square) {
	return isString(square) && square.search(/^[a-h][1-8]$/) !== -1
}

if (RUN_ASSERTS) {
	console.assert(validSquare('a1'))
	console.assert(validSquare('e2'))
	console.assert(!validSquare('D2'))
	console.assert(!validSquare('g9'))
	console.assert(!validSquare('a'))
	console.assert(!validSquare(true))
	console.assert(!validSquare(null))
	console.assert(!validSquare({}))
}

function validPieceCode (code) {
return isString(code) && code.search(/^[bw][KQRNBP]$/) !== -1
}

if (RUN_ASSERTS) {
	console.assert(validPieceCode('bP'))
	console.assert(validPieceCode('bK'))
	console.assert(validPieceCode('wK'))
	console.assert(validPieceCode('wR'))
	console.assert(!validPieceCode('WR'))
	console.assert(!validPieceCode('Wr'))
	console.assert(!validPieceCode('a'))
	console.assert(!validPieceCode(true))
	console.assert(!validPieceCode(null))
	console.assert(!validPieceCode({}))
}

function validFen (fen) {
	if (!isString(fen)) return false

	// cut off any move, castling, etc info from the end
	// we're only interested in position information
	fen = fen.replace(/ .+$/, '')

	// expand the empty square numbers to just 1s
	fen = expandFenEmptySquares(fen)

	// FEN should be 8 sections separated by slashes
	let chunks = fen.split('/')
	if (chunks.length !== 8) return false

	// check each section
	for (let i = 0; i < 8; i++) {
		if (chunks[i].length !== 8 ||
			chunks[i].search(/[^kqrnbpKQRNBP1]/) !== -1) {
		return false
		}
	}

	return true
}

if (RUN_ASSERTS) {
	console.assert(validFen(START_FEN))
	console.assert(validFen('8/8/8/8/8/8/8/8'))
	console.assert(validFen('r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R'))
	console.assert(validFen('3r3r/1p4pp/2nb1k2/pP3p2/8/PB2PN2/p4PPP/R4RK1 b - - 0 1'))
	console.assert(!validFen('3r3z/1p4pp/2nb1k2/pP3p2/8/PB2PN2/p4PPP/R4RK1 b - - 0 1'))
	console.assert(!validFen('anbqkbnr/8/8/8/8/8/PPPPPPPP/8'))
	console.assert(!validFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/'))
	console.assert(!validFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN'))
	console.assert(!validFen('888888/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'))
	console.assert(!validFen('888888/pppppppp/74/8/8/8/PPPPPPPP/RNBQKBNR'))
	console.assert(!validFen({}))
}

function validPositionObject (pos) {
	if (typeof pos !== "object") return false

	for (let i in pos) {
		if (!pos.hasOwnProperty(i)) continue

		if (!validSquare(i) || !validPieceCode(pos[i])) {
		return false
		}
	}

	return true
}

if (RUN_ASSERTS) {
	console.assert(validPositionObject(START_POSITION))
	console.assert(validPositionObject({}))
	console.assert(validPositionObject({e2: 'wP'}))
	console.assert(validPositionObject({e2: 'wP', d2: 'wP'}))
	console.assert(!validPositionObject({e2: 'BP'}))
	console.assert(!validPositionObject({y2: 'wP'}))
	console.assert(!validPositionObject(null))
	console.assert(!validPositionObject('start'))
	console.assert(!validPositionObject(START_FEN))
}

function isTouchDevice () {
	return 'ontouchstart' in document.documentElement
}

function validJQueryVersion () {
	return typeof window.$ &&
			$.fn &&
			$.fn.jquery &&
			validSemanticVersion($.fn.jquery, MINIMUM_JQUERY_VERSION)
}

// ---------------------------------------------------------------------------
// Chess Util Functions
// ---------------------------------------------------------------------------

// convert FEN piece code to bP, wK, etc
function fenToPieceCode (piece) {
	// black piece
	if (piece.toLowerCase() === piece) {
		return 'b' + piece.toUpperCase()
	}

	// white piece
	return 'w' + piece.toUpperCase()
}

// convert bP, wK, etc code to FEN structure
function pieceCodeToFen (piece) {
	let pieceCodeLetters = piece.split('')

	// white piece
	if (pieceCodeLetters[0] === 'w') {
		return pieceCodeLetters[1].toUpperCase()
	}

	// black piece
	return pieceCodeLetters[1].toLowerCase()
}

// convert FEN string to position object
// returns false if the FEN string is invalid
function fenToObj (fen) {
	if (!validFen(fen)) return false

	// cut off any move, castling, etc info from the end
	// we're only interested in position information
	fen = fen.replace(/ .+$/, '')

	let rows = fen.split('/')
	let position = {}

	let currentRow = 8
	for (let i = 0; i < 8; i++) {
		let row = rows[i].split('')
		let colIdx = 0

		// loop through each character in the FEN section
		for (let j = 0; j < row.length; j++) {
		// number / empty squares
		if (row[j].search(/[1-8]/) !== -1) {
			let numEmptySquares = parseInt(row[j], 10)
			colIdx = colIdx + numEmptySquares
		} else {
			// piece
			let square = COLUMNS[colIdx] + currentRow
			position[square] = fenToPieceCode(row[j])
			colIdx = colIdx + 1
		}
		}

		currentRow = currentRow - 1
	}

	return position
}

// position object to FEN string
// returns false if the obj is not a valid position object
function objToFen (obj) {
	if (!validPositionObject(obj)) return false

	let fen = ''

	let currentRow = 8
	for (let i = 0; i < 8; i++) {
		for (let j = 0; j < 8; j++) {
		let square = COLUMNS[j] + currentRow

		// piece exists
		if (obj.hasOwnProperty(square)) {
			fen = fen + pieceCodeToFen(obj[square])
		} else {
			// empty space
			fen = fen + '1'
		}
		}

		if (i !== 7) {
		fen = fen + '/'
		}

		currentRow = currentRow - 1
	}

	// squeeze the empty numbers together
	fen = squeezeFenEmptySquares(fen)

	return fen
}

if (RUN_ASSERTS) {
	console.assert(objToFen(START_POSITION) === START_FEN)
	console.assert(objToFen({}) === '8/8/8/8/8/8/8/8')
	console.assert(objToFen({a2: 'wP', 'b2': 'bP'}) === '8/8/8/8/8/8/Pp6/8')
}

function squeezeFenEmptySquares (fen) {
	return fen.replace(/11111111/g, '8')
		.replace(/1111111/g, '7')
		.replace(/111111/g, '6')
		.replace(/11111/g, '5')
		.replace(/1111/g, '4')
		.replace(/111/g, '3')
		.replace(/11/g, '2')
}

function expandFenEmptySquares (fen) {
	return fen.replace(/8/g, '11111111')
		.replace(/7/g, '1111111')
		.replace(/6/g, '111111')
		.replace(/5/g, '11111')
		.replace(/4/g, '1111')
		.replace(/3/g, '111')
		.replace(/2/g, '11')
}

// returns the distance between two squares
function squareDistance (squareA, squareB) {
	let squareAArray = squareA.split('')
	let squareAx = COLUMNS.indexOf(squareAArray[0]) + 1
	let squareAy = parseInt(squareAArray[1], 10)

	let squareBArray = squareB.split('')
	let squareBx = COLUMNS.indexOf(squareBArray[0]) + 1
	let squareBy = parseInt(squareBArray[1], 10)

	let xDelta = Math.abs(squareAx - squareBx)
	let yDelta = Math.abs(squareAy - squareBy)

	if (xDelta >= yDelta) return xDelta
	return yDelta
}

// returns the square of the closest instance of piece
// returns false if no instance of piece is found in position
function findClosestPiece (position, piece, square) {
	// create array of closest squares from square
	let closestSquares = createRadius(square)

	// search through the position in order of distance for the piece
	for (let i = 0; i < closestSquares.length; i++) {
		let s = closestSquares[i]

		if (position.hasOwnProperty(s) && position[s] === piece) {
		return s
		}
	}

	return false
}

// returns an array of closest squares from square
function createRadius (square) {
	let squares = []

	// calculate distance of all squares
	for (let i = 0; i < 8; i++) {
		for (let j = 0; j < 8; j++) {
		let s = COLUMNS[i] + (j + 1)

		// skip the square we're starting from
		if (square === s) continue

		squares.push({
			square: s,
			distance: squareDistance(square, s)
		})
		}
	}

	// sort by distance
	squares.sort(function (a, b) {
		return a.distance - b.distance
	})

	// just return the square code
	let surroundingSquares = []
	for (i = 0; i < squares.length; i++) {
		surroundingSquares.push(squares[i].square)
	}

	return surroundingSquares
}

// given a position and a set of moves, return a new position
// with the moves executed
function calculatePositionFromMoves (position, moves) {
	let newPosition = deepCopy(position)

	for (let i in moves) {
		if (!moves.hasOwnProperty(i)) continue

		// skip the move if the position doesn't have a piece on the source square
		if (!newPosition.hasOwnProperty(i)) continue

		let piece = newPosition[i]
		delete newPosition[i]
		newPosition[moves[i]] = piece
	}

	return newPosition
}

// TODO: add some asserts here for calculatePositionFromMoves

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

function buildContainerHTML (hasSparePieces) {
	let html = '<div class="{chessboard}">'

	if (hasSparePieces) {
		html += '<div class="{sparePieces} {sparePiecesTop}"></div>'
	}

	html += '<div class="{board}"></div>'

	if (hasSparePieces) {
		html += '<div class="{sparePieces} {sparePiecesBottom}"></div>'
	}

	html += '</div>'

	return interpolateTemplate(html, CSS)
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function expandConfigArgumentShorthand (config) {
	if (config === 'start') {
		config = {position: deepCopy(START_POSITION)}
	} else if (validFen(config)) {
		config = {position: fenToObj(config)}
	} else if (validPositionObject(config)) {
		config = {position: deepCopy(config)}
	}

	// config must be an object
	if (typeof config !== "object") config = {}

	return config
}

// validate config / set default options
function expandConfig (config) {
	// default for orientation is white
	if (config.orientation !== 'black') config.orientation = 'white'

	// default for showNotation is true
	if (config.showNotation !== false) config.showNotation = true

	// default for draggable is false
	if (config.draggable !== true) config.draggable = false

	// default for dropOffBoard is 'snapback'
	if (config.dropOffBoard !== 'trash') config.dropOffBoard = 'snapback'

	// default for sparePieces is false
	if (config.sparePieces !== true) config.sparePieces = false

	// draggable must be true if sparePieces is enabled
	if (config.sparePieces) config.draggable = true

	// default piece theme is wikipedia
	if (!config.hasOwnProperty('pieceTheme') ||
		(!isString(config.pieceTheme) && !isFunction(config.pieceTheme))) {
		config.pieceTheme = 'img/chesspieces/wikipedia/{piece}.png'
	}

	// animation speeds
	if (!validAnimationSpeed(config.appearSpeed)) config.appearSpeed = DEFAULT_APPEAR_SPEED
	if (!validAnimationSpeed(config.moveSpeed)) config.moveSpeed = DEFAULT_MOVE_SPEED
	if (!validAnimationSpeed(config.snapbackSpeed)) config.snapbackSpeed = DEFAULT_SNAPBACK_SPEED
	if (!validAnimationSpeed(config.snapSpeed)) config.snapSpeed = DEFAULT_SNAP_SPEED
	if (!validAnimationSpeed(config.trashSpeed)) config.trashSpeed = DEFAULT_TRASH_SPEED

	// throttle rate
	if (!validThrottleRate(config.dragThrottleRate)) config.dragThrottleRate = DEFAULT_DRAG_THROTTLE_RATE

	return config
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

// check for a compatible version of jQuery
function checkJQuery () {
	if (!validJQueryVersion()) {
		let errorMsg = 'Chessboard Error 1005: Unable to find a valid version of jQuery. ' +
		'Please include jQuery ' + MINIMUM_JQUERY_VERSION + ' or higher on the page' +
		'\n\n' +
		'Exiting' + ELLIPSIS
		window.alert(errorMsg)
		return false
	}

	return true
}

// return either boolean false or the $container element
function checkContainerArg (containerElOrString) {
	if (containerElOrString === '') {
		let errorMsg1 = 'Chessboard Error 1001: ' +
		'The first argument to Chessboard() cannot be an empty string.' +
		'\n\n' +
		'Exiting' + ELLIPSIS
		window.alert(errorMsg1)
		return false
	}

	// convert containerEl to query selector if it is a string
	if (isString(containerElOrString) &&
		containerElOrString.charAt(0) !== '#') {
		containerElOrString = '#' + containerElOrString
	}

	// containerEl must be something that becomes a jQuery collection of size 1
	let container = document.querySelector(containerElOrString)
	if(!container) {
		let errorMsg2 = 'Chessboard Error 1003: ' +
		'The first argument to Chessboard() must be the ID of a DOM node, ' +
		'an ID query selector, or a single DOM node.' +
		'\n\n' +
		'Exiting' + ELLIPSIS
		window.alert(errorMsg2)
		return false
	}

	return container
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

class Chessboard {

	_config = null;
	_container = null;
	_board = null;
	_draggedPiece = null;
	_sparePiecesTop = null;
	_sparePiecesBottom = null;

	_boardBorderSize = 2;
	_currentOrientation = 'white';
	_currentPosition = {};
	_draggedPiece = null;
	_draggedPieceLocation = null;
	_draggedPieceSource = null;
	_isDragging = false;
	_touchDeviceMoveStage = "selection";
	_sparePiecesElsIds = {};
	_squareElsIds = {};
	_squareElsOffsets = {};
	_squareSize = 16;

	_throttledMousemoveWindow = null;
	_throttledTouchmoveWindow = null;

	constructor(containerString, config) {

		this._container = checkContainerArg(containerString);
		if (!this._container) return null;

		// ensure the config object is what we expect
		config = expandConfigArgumentShorthand(config);
		this._config = expandConfig(config);

		// DOM elements
		this._board = null;
		this._draggedPiece = null;
		this._sparePiecesTop = null;
		this._sparePiecesBottom = null;

		this._boardBorderSize = 2;
		this._currentOrientation = 'white';
		this._currentPosition = {};
		this._draggedPiece = null;
		this._draggedPieceLocation = null;
		this._draggedPieceSource = null;
		this._isDragging = false;
		this._touchDeviceMoveStage = "selection";
		this._sparePiecesElsIds = {};
		this._squareElsIds = {};
		this._squareElsOffsets = {};
		this._squareSize = 16;

		this._throttledMousemoveWindow = throttle(this._mousemoveWindow, config.dragThrottleRate);
		this._throttledTouchmoveWindow = throttle(this._touchmoveWindow, config.dragThrottleRate);

		this._removeSquareHighlights();
		this._setInitialState();
		this._initDOM();
		this._addEvents();
	}

	// -------------------------------------------------------------------------
	// Validation / Errors
	// -------------------------------------------------------------------------

	_error(code, msg, obj) {
		// do nothing if showErrors is not set
		if(this._config.hasOwnProperty('showErrors') !== true || this._config.showErrors === false) {
			return;
		}

		let errorText = 'Chessboard Error ' + code + ': ' + msg;

		// print to console
		if(this._config.showErrors === 'console' && typeof console === 'object' && typeof console.log === 'function') {
			console.log(errorText);
			if (arguments.length >= 2) {
				console.log(obj);
			}
			return;
		}

		// alert errors
		if (this._config.showErrors === 'alert') {
			if (obj) {
				errorText += '\n\n' + JSON.stringify(obj);
			}
			window.alert(errorText);
			return;
		}

		// custom function
		if (isFunction(this._config.showErrors)) {
			this._config.showErrors(code, msg, obj);
		}
	}

	_setInitialState() {
		this._currentOrientation = this._config.orientation

		// make sure position is valid
		if (this._config.hasOwnProperty('position')) {
			if (this._config.position === 'start') {
				this._currentPosition = deepCopy(START_POSITION)
			} else if (validFen(this._config.position)) {
				this._currentPosition = fenToObj(this._config.position)
			} else if (validPositionObject(this._config.position)) {
				this._currentPosition = deepCopy(this._config.position)
			} else {
				this._error(7263, 'Invalid value passed to this._config.position.', this._config.position);
			}
		}
	}

	// -------------------------------------------------------------------------
	// DOM Misc
	// -------------------------------------------------------------------------

	// calculates square size based on the width of the container
	// got a little CSS black magic here, so let me explain:
	// get the width of the container element (could be anything), reduce by 1 for
	// fudge factor, and then keep reducing until we find an exact mod 8 for
	// our square size
	_calculateSquareSize() {
		let containerWidth = parseInt(this._container.style.width, 10);

		// defensive, prevent infinite loop
		if (!containerWidth || containerWidth <= 0) {
			return 0;
		}

		// pad one pixel
		let boardWidth = containerWidth - 1;

		while (boardWidth % 8 !== 0 && boardWidth > 0) {
			boardWidth = boardWidth - 1;
		}

		return boardWidth / 8;
	}

	// create random IDs for elements
	_createElIds() {
		// squares on the board
		for (let i = 0; i < COLUMNS.length; i++) {
			for (let j = 1; j <= 8; j++) {
				let square = COLUMNS[i] + j;
				this._squareElsIds[square] = square + '-' + uuid();
			}
		}

		// spare pieces
		let pieces = 'KQRNBP'.split('')
		for (let i = 0; i < pieces.length; i++) {
			let whitePiece = 'w' + pieces[i];
			let blackPiece = 'b' + pieces[i];
			this._sparePiecesElsIds[whitePiece] = whitePiece + '-' + uuid();
			this._sparePiecesElsIds[blackPiece] = blackPiece + '-' + uuid();
		}
	}

	// -------------------------------------------------------------------------
	// Markup Building
	// -------------------------------------------------------------------------
	_buildBoardHTML(orientation) {

		if (orientation !== 'black') {
			orientation = 'white'
		}

		let html = ''

		// algebraic notation / orientation
		let alpha = deepCopy(COLUMNS)
		let row = 8
		if (orientation === 'black') {
			alpha.reverse()
			row = 1
		}

		let squareColor = 'white'
		for (let i = 0; i < 8; i++) {
			html += '<div class="{row}">'
			for (let j = 0; j < 8; j++) {
				let square = alpha[j] + row

				html += '<div class="{square} ' + CSS[squareColor] + ' ' +
				'square-' + square + '" ' +
				'style="width:' + this._squareSize + 'px;height:' + this._squareSize + 'px;" ' +
				'id="' + this._squareElsIds[square] + '" ' +
				'data-square="' + square + '">'

				if (config.showNotation) {
					// alpha notation
					if ((orientation === 'white' && row === 1) ||
						(orientation === 'black' && row === 8)) {
						html += '<div class="{notation} {alpha}">' + alpha[j] + '</div>'
					}

					// numeric notation
					if (j === 0) {
						html += '<div class="{notation} {numeric}">' + row + '</div>'
					}
				}

				html += '</div>' // end .square
				squareColor = (squareColor === 'white') ? 'black' : 'white'
			}
			html += '<div class="{clearfix}"></div></div>'

			squareColor = (squareColor === 'white') ? 'black' : 'white'

			if (orientation === 'white') {
				row = row - 1
			} else {
				row = row + 1
			}
		}

		return interpolateTemplate(html, CSS);
	}

	_buildPieceImgSrc(piece) {
		if (isFunction(this._config.pieceTheme)) {
			return this._config.pieceTheme(piece);
		}

		if (isString(this._config.pieceTheme)) {
			return interpolateTemplate(this._config.pieceTheme, {piece: piece});
		}

		// NOTE: this should never happen
		error(8272, 'Unable to build image source for config.pieceTheme.');
		return '';
	}

	_buildPieceHTML(piece, hidden, id) {
		let html = '<img src="' + this._buildPieceImgSrc(piece) + '" '
		if (isString(id) && id !== '') {
			html += 'id="' + id + '" '
		}
		html += 'alt="" class="{piece}" data-piece="' + piece + '" style="width:' + this._squareSize + 'px;' + 'height:' + this._squareSize + 'px;';

		if (hidden) {
		html += 'display:none;'
		}
		html += '" />'
		html = interpolateTemplate(html, CSS);
		let elem = document.createElement("div");
		elem.innerHTML = html;
		return elem.children[0];
	}

	_buildSparePiecesHTML(color) {
		let pieces = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP']
		if (color === 'black') {
			pieces = ['bK', 'bQ', 'bR', 'bB', 'bN', 'bP']
		}

		let html = ''
		for (let i = 0; i < pieces.length; i++) {
			html += this._buildPieceHTML(pieces[i], false, sparePiecesElsIds[pieces[i]])
		}

		return html
	}

// -------------------------------------------------------------------------
// Animations
// -------------------------------------------------------------------------

	_animateSquareToSquare(src, dest, piece, completeFn) {
		// get information about the source and destination squares
		let $srcSquare = $('#' + squareElsIds[src])
		let srcSquarePosition = $srcSquare.offset()
		let $destSquare = $('#' + squareElsIds[dest])
		let destSquarePosition = $destSquare.offset()

		// create the animated piece and absolutely position it
		// over the source square
		let animatedPieceId = uuid()
		$('body').append(buildPieceHTML(piece, true, animatedPieceId))
		let $animatedPiece = $('#' + animatedPieceId)
		$animatedPiece.css({
		display: '',
		position: 'absolute',
		top: srcSquarePosition.top,
		left: srcSquarePosition.left
		})

		// remove original piece from source square
		$srcSquare.find('.' + CSS.piece).remove()

		function onFinishAnimation1 () {
		// add the "real" piece to the destination square
		$destSquare.append(buildPieceHTML(piece))

		// remove the animated piece
		$animatedPiece.remove()

		// run complete function
		if (isFunction(completeFn)) {
			completeFn()
		}
		}

		// animate the piece to the destination square
		let opts = {
		duration: config.moveSpeed,
		complete: onFinishAnimation1
		}
		$animatedPiece.animate(destSquarePosition, opts)
	}

	_animateSparePieceToSquare(piece, dest, completeFn) {
		let srcOffset = $('#' + sparePiecesElsIds[piece]).offset()
		let $destSquare = $('#' + squareElsIds[dest])
		let destOffset = $destSquare.offset()

		// create the animate piece
		let pieceId = uuid()
		$('body').append(buildPieceHTML(piece, true, pieceId))
		let $animatedPiece = $('#' + pieceId)
		$animatedPiece.css({
		display: '',
		position: 'absolute',
		left: srcOffset.left,
		top: srcOffset.top
		})

		// on complete
		function onFinishAnimation2 () {
		// add the "real" piece to the destination square
		$destSquare.find('.' + CSS.piece).remove()
		$destSquare.append(buildPieceHTML(piece))

		// remove the animated piece
		$animatedPiece.remove()

		// run complete function
		if (isFunction(completeFn)) {
			completeFn()
		}
		}

		// animate the piece to the destination square
		let opts = {
		duration: config.moveSpeed,
		complete: onFinishAnimation2
		}
		$animatedPiece.animate(destOffset, opts)
	}

	// execute an array of animations
	_doAnimations(animations, oldPos, newPos) {
		if (animations.length === 0) return

		let numFinished = 0
		function onFinishAnimation3 () {
		// exit if all the animations aren't finished
		numFinished = numFinished + 1
		if (numFinished !== animations.length) return

		drawPositionInstant()

		// run their onMoveEnd function
		if (isFunction(config.onMoveEnd)) {
			config.onMoveEnd(deepCopy(oldPos), deepCopy(newPos))
		}
		}

		for (let i = 0; i < animations.length; i++) {
		let animation = animations[i]

		// clear a piece
		if (animation.type === 'clear') {
			$('#' + squareElsIds[animation.square] + ' .' + CSS.piece)
			.fadeOut(config.trashSpeed, onFinishAnimation3)

		// add a piece with no spare pieces - fade the piece onto the square
		} else if (animation.type === 'add' && !config.sparePieces) {
			$('#' + squareElsIds[animation.square])
			.append(buildPieceHTML(animation.piece, true))
			.find('.' + CSS.piece)
			.fadeIn(config.appearSpeed, onFinishAnimation3)

		// add a piece with spare pieces - animate from the spares
		} else if (animation.type === 'add' && config.sparePieces) {
			animateSparePieceToSquare(animation.piece, animation.square, onFinishAnimation3)

		// move a piece from squareA to squareB
		} else if (animation.type === 'move') {
			animateSquareToSquare(animation.source, animation.destination, animation.piece, onFinishAnimation3)
		}
		}
	}

	// calculate an array of animations that need to happen in order to get
	// from pos1 to pos2
	_calculateAnimations(pos1, pos2) {
		// make copies of both
		pos1 = deepCopy(pos1)
		pos2 = deepCopy(pos2)

		let animations = []
		let squaresMovedTo = {}

		// remove pieces that are the same in both positions
		for (let i in pos2) {
		if (!pos2.hasOwnProperty(i)) continue

		if (pos1.hasOwnProperty(i) && pos1[i] === pos2[i]) {
			delete pos1[i]
			delete pos2[i]
		}
		}

		// find all the "move" animations
		for (i in pos2) {
		if (!pos2.hasOwnProperty(i)) continue

		let closestPiece = findClosestPiece(pos1, pos2[i], i)
		if (closestPiece) {
			animations.push({
			type: 'move',
			source: closestPiece,
			destination: i,
			piece: pos2[i]
			})

			delete pos1[closestPiece]
			delete pos2[i]
			squaresMovedTo[i] = true
		}
		}

		// "add" animations
		for (i in pos2) {
		if (!pos2.hasOwnProperty(i)) continue

		animations.push({
			type: 'add',
			square: i,
			piece: pos2[i]
		})

		delete pos2[i]
		}

		// "clear" animations
		for (i in pos1) {
		if (!pos1.hasOwnProperty(i)) continue

		// do not clear a piece if it is on a square that is the result
		// of a "move", ie: a piece capture
		if (squaresMovedTo.hasOwnProperty(i)) continue

		animations.push({
			type: 'clear',
			square: i,
			piece: pos1[i]
		})

		delete pos1[i]
		}

		return animations
	}

	// -------------------------------------------------------------------------
	// Control Flow
	// -------------------------------------------------------------------------

	_drawPositionInstant() {

		// clear the board
		let elem = document.querySelector('.' + CSS.piece);
		elem.parentNode.removeChild(elem);

		// add the pieces
		for (let i in this._currentPosition) {

			if (!this._currentPosition.hasOwnProperty(i)) continue

			elem = this._buildPieceHTML(this._currentPosition[i]);
			document.querySelector('#' + this._squareElsIds[i]).appendChild(elem);
		}
	}

	_drawBoard() {
		this._board.innerHTML = this._buildBoardHTML(this._currentOrientation, this._squareSize, this._config.showNotation);
		this._drawPositionInstant()

		if (this._config.sparePieces) {
			if(this._currentOrientation === 'white') {
				this._sparePiecesTop.innerHTML = this._buildSparePiecesHTML('black');
				this._sparePiecesBottom.innerHTML = this._buildSparePiecesHTML('white');
			} else {
				this._sparePiecesTop.innerHTML = this._buildSparePiecesHTML('white');
				this._sparePiecesBottom.innerHTML = this._buildSparePiecesHTML('black');
			}
		}
	}

	_setCurrentPosition(position) {
		let oldPos = deepCopy(currentPosition)
		let newPos = deepCopy(position)
		let oldFen = objToFen(oldPos)
		let newFen = objToFen(newPos)

		// do nothing if no change in position
		if (oldFen === newFen) return

		// run their onChange function
		if (isFunction(config.onChange)) {
		config.onChange(oldPos, newPos)
		}

		// update state
		currentPosition = position
	}

	_isXYOnSquare(x, y) {
		for (let i in squareElsOffsets) {
		if (!squareElsOffsets.hasOwnProperty(i)) continue

		let s = squareElsOffsets[i]
		if (x >= s.left &&
			x < s.left + squareSize &&
			y >= s.top &&
			y < s.top + squareSize) {
			return i
		}
		}

		return 'offboard'
	}

	// records the XY coords of every square into memory
	_captureSquareOffsets() {
		squareElsOffsets = {}

		for (let i in squareElsIds) {
		if (!squareElsIds.hasOwnProperty(i)) continue

		squareElsOffsets[i] = $('#' + squareElsIds[i]).offset()
		}
	}

	_removeSquareHighlights() {
		// $board
		// .find('.' + CSS.square)
		// .removeClass(CSS.highlight1 + ' ' + CSS.highlight2)
	}

	_snapbackDraggedPiece() {
		// there is no "snapback" for spare pieces
		if (draggedPieceSource === 'spare') {
			trashDraggedPiece();
			return;
		}

		// animation complete
		function complete() {
			drawPositionInstant()
			$draggedPiece.css('display', 'none')

			// run their onSnapbackEnd function
			if (isFunction(config.onSnapbackEnd)) {
				config.onSnapbackEnd(
				draggedPiece,
				draggedPieceSource,
				deepCopy(currentPosition),
				currentOrientation
				)
			}
		}

		// get source square position
		let sourceSquarePosition = $('#' + squareElsIds[draggedPieceSource]).offset()

		// animate the piece to the target square
		let opts = {
			duration: config.snapbackSpeed,
			complete: complete
		}
		$draggedPiece.animate(sourceSquarePosition, opts)

		// set state
		isDragging = false
	}

	_trashDraggedPiece() {
		removeSquareHighlights()

		// remove the source piece
		let newPosition = deepCopy(currentPosition)
		delete newPosition[draggedPieceSource]
		setCurrentPosition(newPosition)

		// redraw the position
		drawPositionInstant()

		// hide the dragged piece
		$draggedPiece.fadeOut(config.trashSpeed)

		// set state
		isDragging = false
	}

	_dropDraggedPieceOnSquare(square) {
		removeSquareHighlights()

		// update position
		let newPosition = deepCopy(currentPosition)
		delete newPosition[draggedPieceSource]
		newPosition[square] = draggedPiece
		setCurrentPosition(newPosition)

		// get target square information
		let targetSquarePosition = $('#' + squareElsIds[square]).offset()

		// animation complete
		function onAnimationComplete () {
		drawPositionInstant()
		$draggedPiece.css('display', 'none')

		// execute their onSnapEnd function
		if (isFunction(config.onSnapEnd)) {
			config.onSnapEnd(draggedPieceSource, square, draggedPiece)
		}
		}

		// snap the piece to the target square
		let opts = {
		duration: config.snapSpeed,
		complete: onAnimationComplete
		}
		$draggedPiece.animate(targetSquarePosition, opts)

		// set state
		isDragging = false
	}

	_beginDraggingPiece(source, piece, x, y) {
		// run their custom onDragStart function
		// their custom onDragStart function can cancel drag start
		if (isFunction(config.onDragStart) &&
			config.onDragStart(source, piece, deepCopy(currentPosition), currentOrientation) === false) {
		return
		}

		// set state
		isDragging = true
		draggedPiece = piece
		draggedPieceSource = source

		// if the piece came from spare pieces, location is offboard
		if (source === 'spare') {
		draggedPieceLocation = 'offboard'
		} else {
		draggedPieceLocation = source
		}

		// capture the x, y coords of all squares in memory
		captureSquareOffsets()

		// Nic fix
		if (isTouchDevice() && touchDeviceMoveStage === "selection") {
		// create the dragged piece
		$draggedPiece.attr('src', buildPieceImgSrc(piece)).css({ display: 'None' });
		return;
		}

		// create the dragged piece
		$draggedPiece.attr('src', buildPieceImgSrc(piece)).css({
		display: '',
		position: 'absolute',
		left: x - squareSize / 2,
		top: y - squareSize / 2
		})

		if (source !== 'spare') {
		// highlight the source square and hide the piece
		$('#' + squareElsIds[source])
			.addClass(CSS.highlight1)
			.find('.' + CSS.piece)
			.css('display', 'none')
		}
	}

	_updateDraggedPiece(x, y) {
		// put the dragged piece over the mouse cursor
		$draggedPiece.css({
		left: x - squareSize / 2,
		top: y - squareSize / 2
		})

		// get location
		let location = isXYOnSquare(x, y)

		// do nothing if the location has not changed
		if (location === draggedPieceLocation) return

		// remove highlight from previous square
		if (validSquare(draggedPieceLocation)) {
		$('#' + squareElsIds[draggedPieceLocation]).removeClass(CSS.highlight2)
		}

		// add highlight to new square
		if (validSquare(location)) {
		$('#' + squareElsIds[location]).addClass(CSS.highlight2)
		}

		// run onDragMove
		if (isFunction(config.onDragMove)) {
		config.onDragMove(
			location,
			draggedPieceLocation,
			draggedPieceSource,
			draggedPiece,
			deepCopy(currentPosition),
			currentOrientation
		)
		}

		// update state
		draggedPieceLocation = location
	}

	_stopDraggedPiece(location) {

		if(isTouchDevice() && touchDeviceMoveStage === "selection") {
			touchDeviceMoveStage = "destination"
			return;
		}

		// determine what the action should be
		let action = 'drop'
		if (location === 'offboard' && config.dropOffBoard === 'snapback') {
		action = 'snapback'
		}
		if (location === 'offboard' && config.dropOffBoard === 'trash') {
		action = 'trash'
		}

		// run their onDrop function, which can potentially change the drop action
		if (isFunction(config.onDrop)) {
		let newPosition = deepCopy(currentPosition)

		// source piece is a spare piece and position is off the board
		// if (draggedPieceSource === 'spare' && location === 'offboard') {...}
		// position has not changed; do nothing

		// source piece is a spare piece and position is on the board
		if (draggedPieceSource === 'spare' && validSquare(location)) {
			// add the piece to the board
			newPosition[location] = draggedPiece
		}

		// source piece was on the board and position is off the board
		if (validSquare(draggedPieceSource) && location === 'offboard') {
			// remove the piece from the board
			delete newPosition[draggedPieceSource]
		}

		// source piece was on the board and position is on the board
		if (validSquare(draggedPieceSource) && validSquare(location)) {
			// move the piece
			delete newPosition[draggedPieceSource]
			newPosition[location] = draggedPiece
		}

		let oldPosition = deepCopy(currentPosition)

		let result = config.onDrop(
			draggedPieceSource,
			location,
			draggedPiece,
			newPosition,
			oldPosition,
			currentOrientation
		)
		if (result === 'snapback' || result === 'trash') {
			action = result
		}
		}

		// do it!
		if (action === 'snapback') {
		snapbackDraggedPiece()
		} else if (action === 'trash') {
		trashDraggedPiece()
		} else if (action === 'drop') {
		dropDraggedPieceOnSquare(location)
		}

		touchDeviceMoveStage = "selection";
	}

	// -------------------------------------------------------------------------
	// Public Methods
	// -------------------------------------------------------------------------

	// clear the board
	clear(useAnimation) {
		widget.position({}, useAnimation)
	}

	// remove the widget from the page
	destroy() {
		// remove markup
		$container.html('')
		$draggedPiece.remove()

		// remove event handlers
		$container.unbind()
	}

	// shorthand method to get the current FEN
	fen() {
		return widget.position('fen')
	}

	// flip orientation
	flip() {
		return widget.orientation('flip')
	}

	// move pieces
	// TODO: this method should be variadic as well as accept an array of moves
	move() {
		// no need to throw an error here; just do nothing
		// TODO: this should return the current position
		if (arguments.length === 0) return

		let useAnimation = true

		// collect the moves into an object
		let moves = {}
		for (let i = 0; i < arguments.length; i++) {
		// any "false" to this function means no animations
		if (arguments[i] === false) {
			useAnimation = false
			continue
		}

		// skip invalid arguments
		if (!validMove(arguments[i])) {
			error(2826, 'Invalid move passed to the move method.', arguments[i])
			continue
		}

		let tmp = arguments[i].split('-')
		moves[tmp[0]] = tmp[1]
		}

		// calculate position from moves
		let newPos = calculatePositionFromMoves(currentPosition, moves)

		// update the board
		widget.position(newPos, useAnimation)

		// return the new position object
		return newPos
	}

	orientation(arg) {
		// no arguments, return the current orientation
		if (arguments.length === 0) {
		return currentOrientation
		}

		// set to white or black
		if (arg === 'white' || arg === 'black') {
		currentOrientation = arg
		drawBoard()
		return currentOrientation
		}

		// flip orientation
		if (arg === 'flip') {
		currentOrientation = currentOrientation === 'white' ? 'black' : 'white'
		drawBoard()
		return currentOrientation
		}

		error(5482, 'Invalid value passed to the orientation method.', arg)
	}

	position(position, useAnimation) {
		// no arguments, return the current position
		if (arguments.length === 0) {
		return deepCopy(currentPosition)
		}

		// get position as FEN
		if (isString(position) && position.toLowerCase() === 'fen') {
		return objToFen(currentPosition)
		}

		// start position
		if (isString(position) && position.toLowerCase() === 'start') {
		position = deepCopy(START_POSITION)
		}

		// convert FEN to position object
		if (validFen(position)) {
		position = fenToObj(position)
		}

		// validate position object
		if (!validPositionObject(position)) {
		error(6482, 'Invalid value passed to the position method.', position)
		return
		}

		// default for useAnimations is true
		if (useAnimation !== false) useAnimation = true

		if (useAnimation) {
		// start the animations
		let animations = calculateAnimations(currentPosition, position)
		doAnimations(animations, currentPosition, position)

		// set the new position
		setCurrentPosition(position)
		} else {
		// instant update
		setCurrentPosition(position)
		drawPositionInstant()
		}
	}

	resize() {
		// calulate the new square size
		this._squareSize = this._calculateSquareSize();

		// set board width
		this._board.style.width = this._squareSize * 8 + 'px';

		// set drag piece size
		// this._draggedPiece.style.height = this._squareSize;
		// this._draggedPiece.style.width = this._squareSize;

		// spare pieces
		if(this._config.sparePieces) {
			const elem = document.querySelector('.' + CSS.sparePieces);
			elem.style.paddingLeft = squareSize + boardBorderSize + 'px';
		}

		// redraw the board
		this._drawBoard();
	}

	// set the starting position
	start(useAnimation) {
		widget.position('start', useAnimation)
	}

	// -------------------------------------------------------------------------
	// Browser Events
	// -------------------------------------------------------------------------

	stopDefault(evt) {
		evt.preventDefault()
	}

	mousedownSquare(evt) {
		// do nothing if we're not draggable
		if (!config.draggable) return

		// do nothing if there is no piece on this square
		let square = $(this).attr('data-square')
		if (!validSquare(square)) return
		if (!currentPosition.hasOwnProperty(square)) return

		beginDraggingPiece(square, currentPosition[square], evt.pageX, evt.pageY)
	}

	touchstartSquare(e) {
		console.log("touch start");

		// do nothing if we're not draggable
		if (!config.draggable) return

		if(isTouchDevice() && touchDeviceMoveStage !== "selection") return;

		// do nothing if there is no piece on this square
		let square = $(this).attr('data-square')
		if (!validSquare(square)) return
		if (!currentPosition.hasOwnProperty(square)) return

		e = e.originalEvent
		beginDraggingPiece(
		square,
		currentPosition[square],
		e.changedTouches[0].pageX,
		e.changedTouches[0].pageY
		)
	}

	mousedownSparePiece(evt) {
		// do nothing if sparePieces is not enabled
		if (!config.sparePieces) return

		let piece = $(this).attr('data-piece')

		beginDraggingPiece('spare', piece, evt.pageX, evt.pageY)
	}

	touchstartSparePiece(e) {
		// do nothing if sparePieces is not enabled
		if (!config.sparePieces) return

		let piece = $(this).attr('data-piece')

		e = e.originalEvent
		beginDraggingPiece(
		'spare',
		piece,
		e.changedTouches[0].pageX,
		e.changedTouches[0].pageY
		)
	}

	mousemoveWindow(evt) {
		if (isDragging) {
		updateDraggedPiece(evt.pageX, evt.pageY)
		}
	}

	touchmoveWindow(evt) {
		console.log("touch mmove");
		// do nothing if we are not dragging a piece
		if (!isDragging) return

		// prevent screen from scrolling
		evt.preventDefault()

		// Nic fix
		if(isTouchDevice()) return;

		updateDraggedPiece(evt.originalEvent.changedTouches[0].pageX,
		evt.originalEvent.changedTouches[0].pageY)
	}

	mouseupWindow(evt) {
		// do nothing if we are not dragging a piece
		if (!isDragging) return

		// get the location
		let location = isXYOnSquare(evt.pageX, evt.pageY)

		stopDraggedPiece(location)
	}

	touchendWindow(evt) {
		console.log("touch end");

		// do nothing if we are not dragging a piece
		if (!isDragging) return

		// get the location
		let location = isXYOnSquare(evt.originalEvent.changedTouches[0].pageX,
		evt.originalEvent.changedTouches[0].pageY)

		stopDraggedPiece(location)
	}

	mouseenterSquare(evt) {
		// do not fire this event if we are dragging a piece
		// NOTE: this should never happen, but it's a safeguard
		if (isDragging) return

		// exit if they did not provide a onMouseoverSquare function
		if (!isFunction(config.onMouseoverSquare)) return

		// get the square
		let square = $(evt.currentTarget).attr('data-square')

		// NOTE: this should never happen; defensive
		if (!validSquare(square)) return

		// get the piece on this square
		let piece = false
		if (currentPosition.hasOwnProperty(square)) {
		piece = currentPosition[square]
		}

		// execute their function
		config.onMouseoverSquare(square, piece, deepCopy(currentPosition), currentOrientation)
	}

	mouseleaveSquare(evt) {
		// do not fire this event if we are dragging a piece
		// NOTE: this should never happen, but it's a safeguard
		if (isDragging) return

		// exit if they did not provide an onMouseoutSquare function
		if (!isFunction(config.onMouseoutSquare)) return

		// get the square
		let square = $(evt.currentTarget).attr('data-square')

		// NOTE: this should never happen; defensive
		if (!validSquare(square)) return

		// get the piece on this square
		let piece = false
		if (currentPosition.hasOwnProperty(square)) {
		piece = currentPosition[square]
		}

		// execute their function
		config.onMouseoutSquare(square, piece, deepCopy(currentPosition), currentOrientation)
	}

	// -------------------------------------------------------------------------
	// Initialization
	// -------------------------------------------------------------------------

	_addEvents() {
		// // prevent "image drag"
		// document.body.onmousedown = 
		// document.body.mousemove = ', '.' + CSS.piece, this.stopDefault.bind(this));

		// if (!isTouchDevice()) {
		// 	// mouse drag pieces
		// 	this._board.on('mousedown', '.' + CSS.square, this.mousedownSquare.bind(this));
		// 	this._container.on('mousedown', '.' + CSS.sparePieces + ' .' + CSS.piece, this.mousedownSparePiece.bind(this));

		// 	// mouse enter / leave square
		// 	this._board
		// 		.on('mouseenter', '.' + CSS.square, this.mouseenterSquare.bind(this))
		// 		.on('mouseleave', '.' + CSS.square, this.mouseleaveSquare.bind(this));

		// 	// piece drag
		// 	window
		// 		.on('mousemove', this.throttledMousemoveWindow.bind(this))
		// 		.on('mouseup', this.mouseupWindow.bind(this));
		// }
		// // touch drag pieces
		// else {
		// 	this._board.on('touchstart', '.' + CSS.square, this.touchstartSquare.bind(this));
		// 	this._container.on('touchstart', '.' + CSS.sparePieces + ' .' + CSS.piece, this.touchstartSparePiece.bind(this));
		// 	window
		// 		.on('touchmove', this.throttledTouchmoveWindow.bind(this))
		// 		.on('touchend', this.touchendWindow.bind(this));
		// }
	}

	_initDOM() {
		// create unique IDs for all the elements we will create
		this._createElIds();

		// build board and save it in memory
		this._container.innerHTML = buildContainerHTML(this._config.sparePieces);
		this._board = document.querySelector('.' + CSS.board);

		if (this._config.sparePieces) {
			this._sparePiecesTop = document.querySelector('.' + CSS.sparePiecesTop);
			this._sparePiecesBottom = document.querySelector('.' + CSS.sparePiecesBottom);
		}

		// create the drag piece
		let draggedPieceId = uuid();
		document.body.appendChild(this._buildPieceHTML('wP', true, draggedPieceId));
		// this._draggedPiece = document.querySelector('#' + draggedPieceId);

		// TODO: need to remove this dragged piece element if the board is no
		// longer in the DOM

		// get the border size
		this._boardBorderSize = parseInt(this._board.style.borderLeftWidth, 10);

		// set the size and draw the board
		this.resize();
	}
}









  // TODO: do module exports here
  window['Chessboard'] = constructor

  // support legacy ChessBoard name
  window['ChessBoard'] = window['Chessboard']

  // expose util functions
  window['Chessboard']['fenToObj'] = fenToObj
  window['Chessboard']['objToFen'] = objToFen

/* export Chessboard object if using node or any other CommonJS compatible
 * environment */
if (typeof exports !== 'undefined') {
  exports.Chessboard = window.Chessboard
}
