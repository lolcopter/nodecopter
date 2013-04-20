var express = require('express'),
    socketio = require('socket.io'),
    _ = require('underscore'),
    http = require('http');

var start = function(port) {
    var app = express(),
        server = http.createServer(app),
        io = socketio.listen(server),
        sockets = [],
        callbacks = [];

    console.log("serving static files from", __dirname + "/../public");
    app.use('/', express['static'](__dirname + "/../public"))

    server.listen(port);

    io.sockets.on('connection', function(socket) {
        sockets.push(socket);
        socket.on('disconnect', function () {
            sockets = _.without(sockets, socket);
        });
        socket.on('input', function(data) {
            console.log(data);
            _.each(callbacks, function(callback) {
                callback(data);
            });            
        });
    });

    return {
        emit: function(state) {
            _.each(sockets, function(socket) {
                socket.emit('state', state);
            });
        },
        onInput: function(callback) {
            callbacks.push(callback);
        }
    }
}

module.exports = {
    start: start
}