var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');

var app = express();

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(express.static(path.join(__dirname, 'public')));

module.exports = app;
