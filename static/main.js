'use strict';

var socket = io.connect('/');

var state;
var highlighted = null;

$(".big-button").bind("click", function(event) {
	var multiplayer = this.id === "multiplayer-button";
	console.log("Multiplayer: " + multiplayer);
	$("#landing").addClass("hidden");
	$("#finding-opponent").removeClass("hidden");
	socket.emit("waitingForOpponent", multiplayer);
});

$(".play-again").bind("click", function() {
	console.log("Restarting game");
	socket.disconnect();
	socket.open();
});

socket.on("connect", function() {
	console.log("Connected!");
	$("body > div").addClass("hidden");
	$("#landing").removeClass("hidden");
})

socket.on("disconnect", function() {
	$("body > div").addClass("hidden");
	$("#error").removeClass("hidden");
	console.log("Disconnected!");
});

socket.on("newState", function(newState) {
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
		$("#turn").removeClass("hidden");
		$("#waitingForOpponent").addClass("hidden");
	} else {
		$("#turn").addClass("hidden");
		$("#waitingForOpponent").removeClass("hidden");
	}

	if (state.color === 'w') {
		$("#player").text("light");
	} else {
		$("#player").text("dark");
	}

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

	gameLoop();
});

socket.on("clientDisconnected", function() {
	console.log("Client disconnected");
	socket.disconnect();
	socket.open();
});

socket.on("gameOver", function(newState) {
	state.turn = null; // Disable interactivity

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

	if (((newState.color === 'b') && (blackScore > whiteScore)) || 
	    ((newState.color === 'w') && (whiteScore > blackScore))) {
			$("#won").removeClass("hidden");
	} else {
			$("#lost").removeClass("hidden");
	}
});

var context = $("#game-canvas").get(0).getContext("2d");
var imageSrcs = ["reversi_board.png", "white.png", "black.png", "cursor.png"];
var images = [];

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

	if (highlighted && state.turn === state.color) {
		context.drawImage(images[3], ((highlighted.x*64)+(4*(highlighted.x+1)))-1, 
		                             ((highlighted.y*64)+(4*(highlighted.y+1)))-1);
	}
}

for (var i=0; i<imageSrcs.length; i++) {
	var image = new Image();
	image.src = imageSrcs[i];
	images.push(image);
}

function gameLoop() {
	
	//Loop this function at 60 frames per second
	requestAnimationFrame(gameLoop);

	//Render the stage to see the animation
	if (state) {
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
	state.board[squareX][squareY] = state.color;
	state.turn = null; // Just make sure the user doesn't screw anything by clicking

	if (state.multiplayer) {
		// Multiplayer
		
		console.log("Sending move (" + squareX + ", " + squareY + ")");
		socket.emit("move", {x: squareX, y: squareY});
	} else {
		// Single player.
		// Make an AJAX request for the computer's move
	}
});