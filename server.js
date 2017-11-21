'use strict';

var express     = require('express');
var compression = require('compression');
var socket      = require("socket.io");
var parser      = require('body-parser');

var server = express();

server.use(compression());

server.use(express.static("static"));

server.use(parser.json());

var io = socket(server.listen(8080));

var waitingForMatch = null;

function newGameState() {
	// Initialize empty board
	var board = new Array(8);
	for (var i = 0; i < 8; i++) {
		board[i] = new Array(8);
		for (var j = 0; j < 8; j++) {
			board[i][j] = ' ';
		}
	}

	board[3][3] = 'w';
	board[3][4] = 'b';
	board[4][3] = 'b';
	board[4][4] = 'w';

	return board;
}

function isValidMove(state, move) {
	if (!("x" in move && "y" in move)) {
		state.error = "Invalid move!";
		return false;

	} else if (move.x < 0 || move.x > 7 ||
		       move.y < 0 || move.y > 7) {
		
		state.error = "Invalid move!";
		return false

	} else if (state.color !== state.turn) {
		state.error = "It's not your turn!";
		return false;

	} else if (state.board[move.x][move.y] !== ' ') {
		state.error = "That space is already occupied!";
		return false;

	}

	return true;
}

function makeMove(state, move) {
	var directions = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];
	var current = {x: 0, y: 0};
	var board = state.board;
	var opponentColor = state.color === 'w' ? 'b' : 'w';

	state.board[move.x][move.y] = state.color;

	scandirection: for (var dir = 0; dir < directions.length; dir++) {
		current.x = move.x + directions[dir][0];
		current.y = move.y + directions[dir][1];
		if (!(current.x < 0 || current.x > 7 || current.y < 0 || current.y > 7) && 
		    board[current.x][current.y] !== opponentColor) {
			continue;
		}
		while (!(current.x < 0 || current.x > 7 || current.y < 0 || current.y > 7) && 
			   board[current.x][current.y] !== ' ') {
			current.x += directions[dir][0];
			current.y += directions[dir][1];

			if (!(current.x < 0 || current.x > 7 || current.y < 0 || current.y > 7) && 
			    board[current.x][current.y] === state.color) {
				// We've found a potential move!
				// Scan backwards and flip tiles
				current.x -= directions[dir][0];
				current.y -= directions[dir][1];

				while(board[current.x][current.y] !== state.color) {
					board[current.x][current.y] = state.color;
					current.x -= directions[dir][0];
					current.y -= directions[dir][1];
				}

				continue scandirection;
			}
		}
	}

	return state;
}

function legalMovesRemain(state) {
	for (var i = 0; i < 8; i++) {
		for (var j = 0; j < 8; j++) {
			if (state.board[i][j] == ' ') {
				if (isLegalMove(state, {x: i, y: j}, true)) {
					return true;
				}
			}
		}
	}

	return false;
}

function isLegalMove(state, move, silent = false) {
	var directions = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];
	var current = {x: move.x, y: move.y};
	var board = state.board;
	var opponentColor = state.color === 'w' ? 'b' : 'w';

	for (var dir = 0; dir < directions.length; dir++) {
		current.x = move.x + directions[dir][0];
		current.y = move.y + directions[dir][1];
		if (!(current.x < 0 || current.x > 7 || current.y < 0 || current.y > 7) && 
		    board[current.x][current.y] !== opponentColor) {
			continue;
		}

		while (!(current.x < 0 || current.x > 7 || current.y < 0 || current.y > 7) && 
		       board[current.x][current.y] !== ' ') {
			current.x += directions[dir][0];
			current.y += directions[dir][1];

			if (!(current.x < 0 || current.x > 7 || current.y < 0 || current.y > 7) && 
			    board[current.x][current.y] === state.color) {
				return directions[dir];
				//return true;
			}
		}
	}
	
	if (!silent) {
		state.error = "That is not a legal move.";
	}
	return false;
}

io.on("connection", function(clientSocket) {
	console.log("New connection");

	clientSocket.on("waitingForOpponent", function(multiplayer) {
		if (multiplayer) {
			// Multiplayer
			if (!waitingForMatch) {
				// No match available
				waitingForMatch = clientSocket;
				console.log("Added client to wait queue");
			} else {
				console.log("Opponents matched!");

				// Make match
				clientSocket.opponent = waitingForMatch;
				var otherSocket = waitingForMatch;
				waitingForMatch = null;
				otherSocket.opponent = clientSocket;

				var state = {
					board: newGameState(),
					color: 'w',
					turn:  'b',
					multiplayer: true
				};
				clientSocket.state = state;
				clientSocket.emit("newState", state);

				state = {
					board: state.board,
					color: 'b',
					turn: 'b',
					multiplayer: true
				};
				otherSocket.state = state
				otherSocket.emit("newState", state);
			}
		} else {
			// Single player
			var state = {
				board: newGameState(),
				color: ['b', 'w'][Math.round(Math.random())],
				turn:  'b',
				multiplayer: false
			};
			clientSocket.state = state;
			clientSocket.emit("newState", state);
		}
	});

	clientSocket.on("move", function(move) {
		if (isValidMove(clientSocket.state, move) && isLegalMove(clientSocket.state, move)) {
			// Legal move
			//clientSocket.state.board[move.x][move.y] = clientSocket.state.color;
			makeMove(clientSocket.state, move);
			clientSocket.state.turn = clientSocket.state.turn === 'w' ? 'b' : 'w';
			clientSocket.state.error = null;

			clientSocket.opponent.state.board = clientSocket.state.board;
			clientSocket.opponent.state.turn = clientSocket.state.turn;
			clientSocket.opponent.state.error = null;

			if (legalMovesRemain(clientSocket.opponent.state)) {
				// Opponent has a move, play can continue normally
				clientSocket.emit("newState", clientSocket.state);
				clientSocket.opponent.emit("newState", clientSocket.opponent.state);
			} else if (legalMovesRemain(clientSocket.state)) {
				// Opponent cannot move, skip their turn
				console.log("Player '" + clientSocket.opponent.state.color + "' has no legal moves remaining. Skipping turn");
				
				// Skip opponent's turn, reset turn back to current player
				clientSocket.state.turn = clientSocket.state.turn === 'w' ? 'b' : 'w';
				clientSocket.opponent.state.turn = clientSocket.state.turn;

				// Emit new state
				clientSocket.emit("newState", clientSocket.state);
				clientSocket.opponent.emit("newState", clientSocket.opponent.state);

			} else {
				// Nobody can move, game over.
				console.log("No more remaining moves. Game over.");
				clientSocket.emit("gameOver", clientSocket.state);
				clientSocket.opponent.emit("gameOver", clientSocket.opponent.state);
			}

		} else {
			clientSocket.emit("newState", clientSocket.state);
		}
	});

	clientSocket.on("disconnect", function() {
		if (waitingForMatch === clientSocket) {
			waitingForMatch = null;
			console.log("Removed client from wait queue");
		}

		if (clientSocket.opponent) {
			clientSocket.opponent.emit("clientDisconnected");
		}
	});
});

server.get('/ai', function(req, res) {
	var state = req.body;

	res.status(501);
	res.end();
});