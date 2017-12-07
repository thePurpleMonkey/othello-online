'use strict';

var socket;

var state;
var highlighted = null;
var cursorActive = true;
var ai;

$("#multiplayer-button").on("click", function(event) {
	$("#landing").addClass("hidden");
	$("#finding-opponent").removeClass("hidden");
	socket = createSocket();
	socket.emit("waitingForOpponent");
});

$("#solo-button").on("click", function(event) {
	// Single player
	$("#difficulty").removeClass("hidden");
	$("#landing").addClass("hidden");
});

$(".difficulty-button").bind("click", function() {
	switch (this.id) {
		case "easy-button":
			ai = "random";
			break;
		
		case "medium-button":
			ai = "greedy";
			break;

		case "difficult-button":
			ai = "minimax";
			break;
	}

	state = {
		// Player is always dark, and goes first
		color: "b",
		turn: "b",

		multiplayer: false
	};

	// Create board
	state.board = new Array(8);
	for (var i = 0; i < 8; i++) {
		state.board[i] = new Array(8);
		for (var j = 0; j < 8; j++) {
			state.board[i][j] = ' ';
		}
	}

	state.board[3][3] = 'w';
	state.board[3][4] = 'b';
	state.board[4][3] = 'b';
	state.board[4][4] = 'w';

	// Initialize user interface
	$("#player").text("dark");
	$("#difficulty").addClass("hidden");
	$("#game-div").removeClass("hidden");
	$("#white-score").text("2");
	$("#black-score").text("2");
	$("#waitingForOpponent").addClass("hidden");


	// Start game
	gameLoop();
});

$(".play-again").bind("click", function() {
	console.log("Restarting game");
	if (state.multiplayer) {
		socket.emit("restart");
	} else {
		location.reload();
	}

	//$("#main > div").addClass("hidden");
	//$("#landing").removeClass("hidden");
	$("#won").addClass("hidden");
	$("#lost").addClass("hidden");
	$("#tied").addClass("hidden");
});

function createSocket() {
	var s = io.connect('/');
	
	s.on("connect", function() {
		console.log("Connected!");
		//$("#main > div").addClass("hidden");
		//$("#landing").removeClass("hidden");
	});
	
	s.on("disconnect", function() {
		$("#main > div").addClass("hidden");
		// $("#error").removeClass("hidden");
		$("#landing").removeClass("hidden");
		$("#won").addClass("hidden");
		$("#lost").addClass("hidden");
		$("#tied").addClass("hidden");
		alert("Uh oh! You or your opponent lost connection to the server. Your game had to be aborted. Sorry :(")
		console.log("Disconnected!");
	});
	
	s.on("newState", function(newState) {
		console.log("Received new state");
		$("#finding-opponent").addClass("hidden");
		$("#game-div").removeClass("hidden");
		state = newState;
	
		if (state.error) {
			$("#errorMsg").text(state.error);
			$("#errorMsg").removeClass("hidden");
		} else {
			$("#errorMsg").addClass("hidden");
		}
	
		if (state.color === state.turn) {
			// Our turn
			$("#turn").removeClass("hidden");
			$("#waitingForOpponent").addClass("hidden");
			document.title = "*Your turn! - Othello Online"
			cursorActive = true;
		} else {
			// Their turn
			$("#turn").addClass("hidden");
			$("#waitingForOpponent").removeClass("hidden");
			document.title = "Othello Online";
			cursorActive = false;
		}
	
		if (state.color === 'w') {
			$("#player").text("light");
		} else {
			$("#player").text("dark");
		}

		$("#won").addClass("hidden");
		$("#lost").addClass("hidden");
		$("#tied").addClass("hidden");
	
		updateScore(state.board);
	
		gameLoop();
	});
	
	s.on("clientDisconnected", function() {
		console.log("Client disconnected");
		s.disconnect();
		//$("#main > div").addClass("hidden");
		// $("#landing").removeClass("hidden");
	});
	
	s.on("gameOver", function(newState) {
		console.log("Received gameOver event.");
		state = newState;
		state.turn = null;	// Disable interactivity
		displayBoard();		// Display the final board
		updateScore(state.board);

		$("#waitingForOpponent").addClass("hidden");
		$("#turn").addClass("hidden");
		document.title = "Game over - Othello Online"
	
		// Calculate score
		var blackScore = 0;
		var whiteScore = 0;
		for (var i = 0; i < 8; i++) {
			for (var j = 0; j < 8; j++) {
				if (newState.board[i][j] === 'w') {
					whiteScore++;
				} else if (newState.board[i][j] === 'b') {
					blackScore++;
				}
			}
		}
		
		console.log("Black Score: " + blackScore);
		console.log("White Score: " + whiteScore);

		if (whiteScore === blackScore) {
			$("#tied").removeClass("hidden");
		} else if (((newState.color === 'b') && (blackScore > whiteScore)) || 
			       ((newState.color === 'w') && (whiteScore > blackScore))) {
			$("#won").removeClass("hidden");
		} else {
			$("#lost").removeClass("hidden");
		}
	});

	return s;
}

var context = $("#game-canvas").get(0).getContext("2d");
var imageSrcs = ["reversi_board.png", "white.png", "black.png", "cursor.png"];
var images = [];

// Start pre-loading images immediately
for (var i=0; i<imageSrcs.length; i++) {
	var image = new Image();
	image.src = imageSrcs[i];
	images.push(image);
}

function displayBoard() {
	context.drawImage(images[0], 0, 0);
	for (var x = 0; x < 8; x++) {
		for (var y = 0; y < 8; y++) {
			switch (state.board[x][y]) {
				case 'b':
					context.drawImage(images[2], (x*64)+(4*(x+1)), (y*64)+(4*(y+1)));
					break;
					
				case 'w':
					context.drawImage(images[1], (x*64)+(4*(x+1)), (y*64)+(4*(y+1)));
					break;
			}
		}
	}

	// Only display cursor when it's the player's turn and the game is active
	if (highlighted && state.turn === state.color && cursorActive) {
		context.drawImage(images[3], ((highlighted.x*64)+(4*(highlighted.x+1)))-1, 
		                             ((highlighted.y*64)+(4*(highlighted.y+1)))-1);
	}
}

// Calculate and display score
function updateScore(board) {
	var blackScore = 0;
	var whiteScore = 0;
	for (var i = 0; i < 8; i++) {
		for (var j = 0; j < 8; j++) {
			if (state.board[i][j] === 'w') {
				whiteScore++;
			} else if (state.board[i][j] === 'b') {
				blackScore++;
			}
		}
	}

	$("#white-score").text(whiteScore);
	$("#black-score").text(blackScore);
}

// Display game while there's a state to display
function gameLoop() {
	if (state) {
		//Loop this function at 60 frames per second
		requestAnimationFrame(gameLoop);
	
		//Render the stage to see the animation
		displayBoard(state.board);
	}
}

$("#game-canvas").on("mousemove", function(event) {
	var squareX = Math.floor((event.pageX - $(this).offset().left) / 68);
	var squareY = Math.floor((event.pageY - $(this).offset().top) / 68);
	//console.log(squareX + ", " + squareY);
	highlighted = {x: squareX, y: squareY};
});

$("#game-canvas").on("mouseleave", function(event) {
	highlighted = null;
});

$("#game-canvas").on("click", function(event) {
	var squareX = Math.floor((event.pageX - $(this).offset().left) / 68);
	var squareY = Math.floor((event.pageY - $(this).offset().top) / 68);

	if (state.multiplayer) {
		// Multiplayer
		cursorActive = false; // Just make sure the user doesn't screw anything by clicking
		
		// Show move made by player until we receive confirmation from server.
		state.board[squareX][squareY] = state.color;
		
		console.log("Sending move (" + squareX + ", " + squareY + ")");
		socket.emit("move", {x: squareX, y: squareY});
	} else {
		// Single player.
		if (cursorActive && state.board[squareX][squareY] === ' ') {
			cursorActive = false;
			playerMove({x: squareX, y: squareY});
		}
	}
});

function playerMove(move) {
	// Let server handle logic for playing move
	$.ajax( "/player/makeMove", {
		contentType: "application/json",
		data: JSON.stringify({state: state, move: move}),
		method: "POST",
		error: function(jqXHR, textStatus, errorThrown) {
			//alert("makeMove AJAX error: " + textStatus + "\n" + errorThrown);
			console.log(jqXHR.responseJSON);
			//$("#errorMsg").text("Error: " + textStatus + "\n" + errorThrown);
			$("#errorMsg").text(jqXHR.responseJSON.error);
			$("#errorMsg").removeClass("hidden");
			cursorActive = true;
		},
		success: function(data, textStatus) {
			state = data;
			updateScore(state.board);
			$("#errorMsg").addClass("hidden");
			$("#turn").addClass("hidden");
			$("#waitingForOpponent").removeClass("hidden");
			document.title = "Othello Online";

			console.log("State after player moved:");
			console.log(state);

			var aiState = JSON.parse(JSON.stringify(state)); // Copy state
			aiState.color = state.color === "b" ? "w" : "b";
			aiState.turn = state.turn === "b" ? "w" : "b";

			console.log("State before AI played:");
			console.log(aiState);

			checkLegalMovesRemain(aiState, function(movesRemain) {
				if (movesRemain) {
					// The AI can make a move. Continue as normal.
					// Wait a small amount of time for the user to visually process their move.
					setTimeout(aiMove, 1000, aiState); // Make an AJAX request for the computer's move
				} else {
					checkLegalMovesRemain(state, function(movesRemain) {
						if (movesRemain) {
							// The player can make a move, but the AI can't. Skip the AI's turn.
							console.log("AI has no legal moves; skipping turn.");
							$("#turn").removeClass("hidden");
							$("#waitingForOpponent").addClass("hidden");
							document.title = "*Your turn! - Othello Online"
							cursorActive = true;
						} else {
							// Neither play can make a move. Game over.
							updateScore(state.board);
							var blackScore = parseInt($("#black-score").text());
							var whiteScore = parseInt($("#white-score").text());

							if (blackScore > whiteScore) {
								// Player wins!
								$("#won").removeClass("hidden");
							} else if (blackScore === whiteScore) {
								// Players tied 
								$("#tied").removeClass("hidden");
							} else {
								// Player loses. :(
								$("#lost").removeClass("hidden");
							}
						}
					});
				}
			});

		}
	});
}

function checkLegalMovesRemain(state, next) {
	$.ajax("/player/legalMovesRemain", {
		contentType: "application/json",
		data: JSON.stringify(state),
		method: "POST",
		success: function(data, textStatus) {
			next(data.result);
		},
		error: function(jqXHR, textStatus, errorThrown) {
			alert("Error: Unable to contact server.\n" + textStatus + ": " + errorThrown);
			// $("#errorMsg").text("Error: " + textStatus + "\n" + errorThrown)
			// $("#errorMsg").removeClass("hidden");
		}
	});
}

function aiMove(aiState) {
	$.ajax("/ai/" + ai, {
		contentType: "application/json",
		data: JSON.stringify(aiState),
		method: "POST",
		success: function(data, textStatus) {
			state = data;
			$("#errorMsg").addClass("hidden");
			updateScore(state.board);

			console.log("State after AI played");
			console.log(state);
			
			checkLegalMovesRemain(state, function(movesRemain) {
				if (movesRemain) {
					// Player can make another move. Enable UI
					$("#turn").removeClass("hidden");
					$("#waitingForOpponent").addClass("hidden");
					document.title = "*Your turn! - Othello Online"
					cursorActive = true;
				} else {
					// The player cannot make a move. Check if the AI can make another move.
					var aiState_ = JSON.parse(JSON.stringify(state));
					aiState_.color = state.color === "w" ? "b" : "w";

					checkLegalMovesRemain(aiState_, function(movesRemain) {
						if (movesRemain) {
							// The AI can make a move, but the player can't. Skip the players's turn.
							console.log("Player has no legal moves; skipping turn.");
							setTimeout(aiMove, 2000);
						} else {
							// Neither play can make a move. Game over.
							updateScore(state.board);
							var blackScore = parseInt($("#black-score").text());
							var whiteScore = parseInt($("#white-score").text());

							document.title = "Game over - Othello Online";
							if (blackScore > whiteScore) {
								// Player wins!
								$("#waitingForOpponent").addClass("hidden");
								$("#turn").addClass("hidden");
								$("#won").removeClass("hidden");
							} else if (blackScore === whiteScore) {
								// Players tied 
								$("#waitingForOpponent").addClass("hidden");
								$("#turn").addClass("hidden");
								$("#tied").removeClass("hidden");
							} else {
								// Player loses. :(
								$("#waitingForOpponent").addClass("hidden");
								$("#turn").addClass("hidden");
								$("#lost").removeClass("hidden");
							}
						}
					});
				}
			});
		},
		error: function(jqXHR, textStatus, errorThrown) {
			//alert("AJAX error: " + textStatus + "\n" + errorThrown);
			$("#errorMsg").text("Error: " + textStatus + "\n" + errorThrown)
			$("#errorMsg").removeClass("hidden");
		}
	});
}