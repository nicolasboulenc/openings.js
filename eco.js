"use strict";

const ECO = {

	_tree: null,

	load: async function(url) {

		this._tree = null;
		fetch(url)
		.then(response => response.text())
		.then(text => {
			const eco_array = text.split("\n");
			let eco_index = 0;

			// tidy up array
			while (eco_index < eco_array.length) {
				if (eco_array[eco_index].length === 0 || eco_array[eco_index] === "\r") {
					eco_array.splice(eco_index, 1);
				}
				else if (eco_array[eco_index].charAt(0) === "#") {
					eco_array.splice(eco_index, 1);
				}
				else if (eco_array[eco_index].charAt(0) === " ") {
					// append moves to previous line although not first move
					eco_array[eco_index - 1] += eco_array[eco_index];
					eco_array.splice(eco_index, 1);
				}
				else {
					eco_index++;
				}
			}

			// build tree
			this._tree = this._createNode("A00a", "Start position", "*");
			eco_array.forEach((line, index) => {
				if(index === 0) return;
				this._buildTree(line);
			});
		});
	},

	_buildTree: function(line) {

		if(line === "") return;

		const pos0 = line.indexOf("\"");
		const eco = line.substr(0, pos0).trim();
		const pos1 = line.indexOf("\"", pos0 + 1);
		const name = line.substr(pos0 + 1, pos1 - pos0 - 1);
		let moves = line.substr(pos1 + 1).trim();

		let probe = this._tree;
		moves = moves.split(" ");
		moves.forEach(move => {
			if (move === "") return;

			const pos = move.indexOf(".");
			if (pos !== -1) {
				move = move.substr(pos + 1);
			}

			const node_index = probe.nodes.findIndex(node => node.move === move);
			let node = null;
			if (node_index === -1) {
				node = this._createNode(eco, name, move);
				probe.nodes.push(node);
			}
			else {
				node = probe.nodes[node_index];
			}
			probe = node;
		});
	},

	_createNode: function(eco="", name="", move="") {
		return {"eco": eco, "name": name, "move": move, "nodes": []};
	},

	identifyMoves: function(moves) {
		if (this._tree === null) return null;

		let probe = this._tree;
		const opening = { "eco": "", "name": "" };

		let do_continue = true;
		let move_index = 0;
		let move_count = moves.length;

		while (move_index < move_count && do_continue === true) {
			const move_index = probe.nodes.findIndex(node => node.move === moves[move_index]);
			if (move_index !== -1) {
				probe = probe.nodes[node_index];
				opening.eco = probe.eco;
				opening.name = probe.name;
			} else {
				do_continue = false;
			}
			move_index++;
		}

		return opening;
	},

	identifyMoveText: function(moves_text) {
		if (this._tree === null) return null;

		moves = moves_text.split(" ");
		let probe = this._tree;
		const opening = { "eco": "", "name": "" };

		let do_continue = true;
		let move_index = 0;
		let move_count = moves.length;

		while (move_index < move_count && do_continue === true) {
			let move = moves[move_index];
			const pos = move.indexOf(".");
			if (pos !== -1) {
				move = move.substr(pos + 1);
			}
			const move_index = probe.nodes.findIndex(node => node.move === moves[move_index]);
			if (move_index !== -1) {
				probe = probe.nodes[node_index];
				opening.eco = probe.eco;
				opening.name = probe.name;
			} else {
				do_continue = false;
			}

			move_index++;
		}
		return opening;
	}
}