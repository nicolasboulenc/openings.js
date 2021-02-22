"use strict";

const PGN = {

	_WHITE: "w",
	_BLACK: "b",
	_TAGS: [	"Event", "Site", "Date", "Round", "White", "Black", "Result",
					"WhiteTitle", "BlackTitle", "WhiteElo", "BlackElo", "WhiteUSCF", "BlackUSCF", "WhiteNA", "BlackNA", "WhiteType", "BlackType",
					"EventDate", "EventSponsor", "Section", "Stage", "Board",
					"Opening", "Variation", "SubVariation",
					"ECO", "NIC",
					"Time", "UTCTime", "UTCDate",
					"TimeControl", "SetUp", "FEN", "Termination", "Annotator", "Mode", "PlyCount"	],
	_TOKENS: {	NUM: "n", MOVE: "m", ANNOTATION: "a", VARIATION_OPEN: "vo", VARIATION_CLOSE: "vc"	},
	_tags: [],
	_moves: [],
	_variations: [],

	_init: function() {
		this._tags = [];
		this._moves = [];
		this._variations = [];
	},

	_createMove: function(num=0, color="", move="") {
		return {    "num": num,
					"color": color,
					"san": move,
					"nag_codes": [],
					"annotation": "",
					"variation": ""		};
	},

	_parseTags: function(pgn) {
		const lines = pgn.split("[");
		if(lines.length === 1) return [];

		lines.forEach(line => {
			if (line === "") {
				return [];
			}

			line = line.split("]");
			line = line[0];

			line = line.split(" \"");
			const tag = line[0];
			const val = line[1].substr(0, line[1].length - 1)
			this._tags.push({"tag": tag, "val": val});
		});
	},

	_tokenize: function(pgn) {

		let char_index = pgn.indexOf("1.");
		const char_count = pgn.length - this.getTag("Result").length;

		const tokens = [];
		let char = "";
		let from = char_index;
		let token = "";

		while (char_index < char_count) {

			char = pgn.charAt(char_index);
			// move number
			if (isNaN(parseInt(char)) === false) {
				while (isNaN(parseInt(char)) === false || char === ".") {
					char_index++;
					char = pgn.charAt(char_index);
				}
				token = pgn.substring(from, char_index);
				tokens.push({type: this._TOKENS.NUM, value: token});
				from = char_index;
			}
			// variations
			else if (char === "(" || char === ")") {
				token = pgn.substring(from, char_index + 1);
				let type = (char === "(" ? this._TOKENS.VARIATION_OPEN : this._TOKENS.VARIATION_CLOSE);
				tokens.push({type: type, value: token});
				char_index++;
				from = char_index;
			}
			// annotations
			else if (char === "{") {
				while (pgn.charAt(char_index) !== "}") {
					char_index++;
				}
				token = pgn.substring(from, char_index);
				tokens.push({type: this._TOKENS.ANNOTATION, value: token});
				from = char_index;
			}
			// NAG ???
			// https://en.wikipedia.org/wiki/Numeric_Annotation_Glyphs
			// else if (char === "") {
			// }
			// move
			else if (	char === "a" || char === "b" || char === "c" || char === "d" ||
						char === "e" || char === "f" || char === "g" ||	char === "h" ||
						char === "K" || char === "Q" ||	char === "B" ||	char === "N" ||
						char === "R" ||	char === "O"	) {
				char_index = pgn.substring(char_index).search(/[(){}\s]/g) + char_index;
				token = pgn.substring(from, char_index);
				tokens.push({type: this._TOKENS.MOVE, value: token});
				from = char_index;
			}
			else {
				char_index++;
				from = char_index;
			}
		}

		return tokens;
	},

	_parseMoves: function(tokens) {

		const moves = [];
		let move = null;
		let color = this._WHITE;
		let move_number = 1;
		let variation_move_number = move_number;
		let variation = "";
		let variations_nested = 0;

		tokens.forEach(token => {
			if(token.type === this._TOKENS.MOVE) {
				// process main line moves
				if(variations_nested === 0) {
					move = this._createMove(move_number, color, token.value);
					moves.push(move);
					color = (color === this._WHITE ? this._BLACK : this._WHITE);
					if(color === this._WHITE) {
						move_number++;
					}
				}
				// process variations
				else {
					variation += (color === this._WHITE ? move_number + ". " : "") + token.value + " ";
					if(color === this._WHITE) {
						variation_move_number++;
					}
				}

				// increment move_number if white
			}
			else if(token.type === this._TOKENS.VARIATION_OPEN) {
				variation_move_number = move_number;
				variation += token.value;
				variations_nested++;
			}
			else if(token.type === this._TOKENS.VARIATION_CLOSE) {
				variation += token.value;
				variations_nested--;
				if(variations_nested === 0) {
					moves[moves.length - 1].variation = variation;
					variation = "";
				}
			}
		});

		return moves;
	},

	_parseVariations: function(tokens) {

		const variations = [];

		variations.push([]); // main line
		let variation_index = 0;
		let variation_stack = [0];

		tokens.forEach(token => {
			if(token.type === this._TOKENS.MOVE) {
				variations[variation_index].push(token.value);
			}
			else if(token.type === this._TOKENS.VARIATION_OPEN) {
				variations.push([]);
				const variation_new = variations.length - 1;
				variation_stack.push(variation_new);

				// copy moves from previous variation
				const moves_count = variations[variation_index].length - 1;
				let moves_index = 0;
				while(moves_index < moves_count) {
					const move = variations[variation_index][moves_index];
					variations[variation_new].push(move);
					moves_index++;
				}
				variation_index = variation_new;
			}
			else if(token.type === this._TOKENS.VARIATION_CLOSE) {
				variation_index = variation_stack.pop();
				variation_index = variation_stack[variation_stack.length - 1];
				// console.log(`close variation${variation_from} => ${variation_index}`);
				// variations[variation_index].push(`close variation${variation_from} => ${variation_index}`);
			}
		});

		return variations;
	},

	_stringifyTags: function() {
		let string = "";
		this._tags.forEach(t => {
			string += `[${t.tag} "${t.val}"]\n`;
		});
		return string;
	},

	_stringifyMoves: function(options={})
	{
		let move_text = "";
		this._moves.forEach(move => {

			if (move.color === this._WHITE) {
				move_text += `${move.num}.`;
			} else {
				move_text += " ";
			}

			move_text += move.san;

			if (typeof options.NAGCodes !== "undefined" && options.NAGCodes === true) {
				nag_codes = move.nag_codes;
				this._nag_codes.forEach(nag_code => {
					move_text += ` ${nag_code}`;
				});
			}
			if (typeof options.annotations !== "undefined" && options.annotations === true && move.annotation !== "") {
				move_text += ` ${move.annotation}`;
			}
			if (typeof options.variations !== "undefined" && options.variations === true && move.variation !== "") {
				move_text += ` ${move.variation}`;
			}

			if (move.color === this._BLACK) {
				move_text += " ";
			}
		});

		return move_text;
	},

	_stringifyVariations: function(variations) {

		let variationsStr = [];

		variations.forEach(variation => {
			let variationStr = "";
			variation.forEach((move, index) => {
				variationStr += (index % 2 === 0 ? (index / 2 + 1) + ". " : "") + move + " ";
			});
			variationStr = variationStr.substring(0, variationStr.length - 1);
			variationsStr.push(variationStr);
		});

		return variationsStr;
	},

	create: function() {
		return Object.create(this);
	},

	load: function(pgnStr) {
		this._init();
		this._tags = this._parseTags(pgnStr);
		const tokens = this._tokenize(pgnStr);
		this._moves = this._parseMoves(tokens);
		this._variations = this._parseVariations(tokens);
	},

	getTag: function(tag) {
		let index = this._tags.findIndex(t => {
			return t.tag === tag;
		});

		let val = ""
		if(index !== -1) {
			val = this._tags[index].val;
		}

		return val;
	},

	setTag: function(tag, val) {
		const is_valid = this._TAGS.includes(tag);
		if (is_valid === true) {
			let index = this._tags.findIndex(t => { return t.tag === tag; });
			if(index !== -1) {
				this._tags[index].val = val;
			}
			else {
				this._tags.push({"tag": tag, "val": val});
			}
			this._tags[tag] = val;
		}
	},

	getSANs: function() {
		const SANs = [];
		this._moves.forEach(move => {
			SANs.push(move.san);
		});
		return SANs;
	},

	getMoves: function() {
		// should return a copy
		return this._moves;
	},

	getVariations: function() {
		// should return a copy
		return this._variations;
	},

	stringify: function(options=null) {
		if (options === null) {
			options = { "NAGCodes": true, "annotations": true, "variations": true };
		}
		return `${this._stringifyTags()}\n${this._stringifyMoves(options)} ${this.getTag("Result")}`;
	}
}

// test 1
// let pgnStr = `[Event "World Championship Match (17)"]
// [Site "Reykjavik ISL"]
// [Date "1972.08.22"]
// [Round "?"]
// [White "Spasky"]
// [Black "Fischer"]
// [Result "*"]
// [ECO ""]

// 1.e4 d6 2.d4 g6 3.Nc3 Nf6 4. f4 Bg7 5. Nf3 c5 6. dc5 Qa5 7. Bd3 Qc5 8. Qe2 O-O 9. Be3 Qa5 10. O-O Bg4 11. Rad1 Nc6 12. Bc4 Nh5 13. Bb3 Bc3 14. bc3 Qc3 15. f5 Nf6 16. h3 Bf3 17. Qf3 Na5 18. Rd3 Qc7 19. Bh6 Nb3 20. cb3 Qc5 21. Kh1 Qe5 22. Bf8 Rf8 23. Re3 Rc8 24. fg6 hg6 25. Qf4 Qf4 26. Rf4 Nd7 27. Rf2 Ne5 28. Kh2 Rc1 29. Ree2 Nc6 30. Rc2 Re1 31. Rfe2 Ra1 32. Kg3 Kg7 33. Rcd2 Rf1 34. Rf2 Re1 35. Rfe2 Rf1 36. Re3 a6 37. Rc3 Re1 38. Rc4 Rf1 39. Rdc2 Ra1 40. Rf2 Re1 41. Rfc2 g5 42. Rc1 Re2 43. R1c2 Re1 44. Rc1 Re2 45. R1c2  *`;


// test 2
// const pgnStr = "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 (4... Bc5 5. Bxf7+ (5. Nxf7) 5... Ke7 6. Bb3) (4... Qe7 5. Bxf7+ Kd8 6. Bb3) (4... Nxe4 5. Bxf7+ Ke7 6. d4 h6 7. Nxe4 Kxf7 8. d5) (4... h6 5. Nxf7) 5. exd5 Nxd5 (5... Na5 6. Bb5+ (6. d3 h6 7. Nf3 e4 8. Qe2 Nxc4 9. dxc4 Bc5 10. Nfd2 O-O) 6... c6 7. dxc6 bxc6 8. Bd3) (5... b5 6. Bf1 h6 (6... Nd4 7. c3 Nxd5 8. cxd4 Qxg5 9. Bxb5+ Kd8 10. dxe5 (10. Qf3 exd4 11. Bc6 Nf4 12. Bxa8 Bg4 13. Qe4 Bd6)) 7. Nxf7 Kxf7 8. dxc6 Be6) (5... Nd4 6. c3 b5 7. Bf1 Nxd5 8. cxd4 Qxg5) 6. Nxf7 Kxf7 7. Qf3+ Ke6 8. Nc3 Ncb4 9. O-O c6 10. d4 *";
// const pgnVariations = [ "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 Kxf7 7. Qf3+ Ke6 8. Nc3 Ncb4 9. O-O c6 10. d4",
// "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 Bc5 5. Bxf7+ Ke7 6. Bb3",
// "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 Bc5 5. Nxf7",
// "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 Qe7 5. Bxf7+ Kd8 6. Bb3",
// "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 Nxe4 5. Bxf7+ Ke7 6. d4 h6 7. Nxe4 Kxf7 8. d5",
// "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 h6 5. Nxf7",
// "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Na5 6. Bb5+ c6 7. dxc6 bxc6 8. Bd3",
// "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Na5 6. d3 h6 7. Nf3 e4 8. Qe2 Nxc4 9. dxc4 Bc5 10. Nfd2 O-O",
// "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 b5 6. Bf1 h6 7. Nxf7 Kxf7 8. dxc6 Be6",
// "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 b5 6. Bf1 Nd4 7. c3 Nxd5 8. cxd4 Qxg5 9. Bxb5+ Kd8 10. dxe5",
// "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 b5 6. Bf1 Nd4 7. c3 Nxd5 8. cxd4 Qxg5 9. Bxb5+ Kd8 10. Qf3 exd4 11. Bc6 Nf4 12. Bxa8 Bg4 13. Qe4 Bd6",
// "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nd4 6. c3 b5 7. Bf1 Nxd5 8. cxd4 Qxg5" ];

// const tokens = PGN.load(pgnStr);
// const variationsStr = PGN._stringifyVariations(PGN._variations);

// variationsStr.forEach((variation, index) => {
// 	console.log(variation);
// 	console.log(pgnVariations[index]);
// 	console.log(variation === pgnVariations[index]);
// });
